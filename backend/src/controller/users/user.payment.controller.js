import mongoose from 'mongoose';
import crypto from 'crypto';
import { User } from '../../models/user.model.js';
import { Driver } from '../../models/driver.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { esewaFormFields, esewaDecodeCallback, esewaStatus } from '../../services/payments/esewa.js';
import { khaltiInitiate, khaltiLookup, khaltiConfigured } from '../../services/payments/khalti.js';

// Wallet top-ups through real payment gateways. Money is only ever credited
// after the gateway itself confirms the payment server-to-server (eSewa status
// API / Khalti lookup) — never on the strength of a client request or a
// redirect alone. Crediting is idempotent: a pending→completed flip guards the
// balance increment, so a reloaded callback or a racing status poll can't pay
// twice.
//
// Adding a provider (e.g. Fonepay once merchant credentials exist) = add it to
// PROVIDERS + its branches in startPayment() and reconcile().

const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;

const PROVIDERS = {
    esewa: { label: 'eSewa', enabled: () => true },
    khalti: { label: 'Khalti', enabled: khaltiConfigured },
};

// Where gateways send the user back. Set PAYMENT_CALLBACK_BASE_URL in
// production (https://api.example.com); locally it's derived from the request,
// which is the same host the app already reaches.
const callbackBase = (req) =>
    (process.env.PAYMENT_CALLBACK_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Crediting
// ---------------------------------------------------------------------------

async function completeTopup(txn, gatewayData) {
    const updated = await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'pending' },
        { $set: { status: 'completed', gatewayData } },
        { returnDocument: 'after' },
    );
    if (!updated) return Transaction.findById(txn._id); // already settled — no second credit
    if (updated.driverId) {
        await Driver.findByIdAndUpdate(updated.driverId, { $inc: { topupBalance: updated.amount } });
    } else {
        await User.findByIdAndUpdate(updated.userId, { $inc: { walletBalance: updated.amount } });
    }
    return updated;
}

async function failTopup(txn, reason, gatewayData = null) {
    const updated = await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'pending' },
        { $set: { status: 'failed', failureReason: reason, gatewayData } },
        { returnDocument: 'after' },
    );
    return updated || Transaction.findById(txn._id);
}

// Ask the gateway what actually happened and settle the transaction.
const ESEWA_GIVE_UP_MS = 15 * 60 * 1000;
async function reconcile(txn) {
    if (txn.status !== 'pending') return txn;
    try {
        if (txn.method === 'esewa') {
            const s = await esewaStatus({ amount: txn.amount, transactionUuid: txn.orderRef });
            if (s.status === 'COMPLETE') return completeTopup(txn, s);
            const stale = Date.now() - new Date(txn.createdAt).getTime() > ESEWA_GIVE_UP_MS;
            if (s.status === 'CANCELED' || s.status === 'FULL_REFUND' || (s.status === 'NOT_FOUND' && stale)) {
                return failTopup(txn, `eSewa: ${s.status}`, s);
            }
            return txn;
        }
        if (txn.method === 'khalti') {
            const l = await khaltiLookup(txn.gatewayRef);
            if (l.status === 'Completed') {
                if (Number(l.total_amount) !== Math.round(txn.amount * 100)) {
                    return failTopup(txn, 'Khalti: amount mismatch', l);
                }
                return completeTopup(txn, l);
            }
            if (['Expired', 'User canceled', 'Refunded', 'Partially Refunded'].includes(l.status)) {
                return failTopup(txn, `Khalti: ${l.status}`, l);
            }
            return txn;
        }
    } catch (err) {
        // Gateway unreachable — leave it pending; the next poll retries.
        console.warn('[payments] reconcile failed:', txn._id.toString(), err.message);
    }
    return txn;
}

// Settle top-ups nobody polled (app closed mid-payment, callback never
// reached us). Runs on a timer from index.js; each one is checked with the
// gateway, so a late success is still credited and the rest are closed.
async function reconcileStaleTopups({ olderThanMs = 15 * 60 * 1000, limit = 50 } = {}) {
    const stale = await Transaction.find({
        type: 'wallet_topup',
        status: 'pending',
        method: { $in: Object.keys(PROVIDERS) },
        createdAt: { $lt: new Date(Date.now() - olderThanMs) },
    }).limit(limit);
    for (const txn of stale) {
        const settled = await reconcile(txn);
        // Still pending an hour later (gateway never heard of it): close it.
        if (settled.status === 'pending' && Date.now() - new Date(txn.createdAt).getTime() > 60 * 60 * 1000) {
            await failTopup(txn, 'Expired: payment was not completed');
        }
    }
    return stale.length;
}

// ---------------------------------------------------------------------------
// Authenticated API (rider wallet + driver prepaid balance)
// ---------------------------------------------------------------------------

async function ownerFilter(req, target) {
    if (target === 'driver') {
        const driver = await Driver.findOne({ userId: req.user._id }).select('_id');
        if (!driver) throw new apiError(404, 'Driver profile not found');
        return { driverId: driver._id };
    }
    return { userId: req.user._id };
}

async function balanceFor(owner) {
    if (owner.driverId) {
        const d = await Driver.findById(owner.driverId).select('topupBalance');
        return { topupBalance: d?.topupBalance ?? 0 };
    }
    const u = await User.findById(owner.userId).select('walletBalance');
    return { walletBalance: u?.walletBalance ?? 0 };
}

const getPaymentMethods = asyncHandler(async (req, res) => {
    const methods = Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, enabled: !!p.enabled() }));
    return res.status(200).json(new apiResponse(200, { methods, min: MIN_TOPUP, max: MAX_TOPUP }, 'Payment methods'));
});

const initiateTopup = (target) => asyncHandler(async (req, res) => {
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || '');
    if (!Number.isInteger(amount) || amount < MIN_TOPUP) {
        throw new apiError(400, `Enter a whole amount of at least Rs ${MIN_TOPUP}`);
    }
    if (amount > MAX_TOPUP) throw new apiError(400, `Maximum top-up amount is Rs ${MAX_TOPUP.toLocaleString('en-IN')}`);
    const provider = PROVIDERS[method];
    if (!provider) throw new apiError(400, 'Payment method must be esewa or khalti');
    if (!provider.enabled()) throw new apiError(503, `${provider.label} payments are not available right now`);

    const owner = await ownerFilter(req, target);
    const txn = await Transaction.create({
        ...owner,
        amount,
        type: 'wallet_topup',
        method,
        status: 'pending',
        note: target === 'driver' ? 'Driver fee-balance top-up' : 'Wallet top-up',
    });
    // Unique, gateway-safe order id (letters, digits, hyphens).
    txn.orderRef = `TPU-${txn._id.toString()}-${crypto.randomBytes(3).toString('hex')}`;

    const base = callbackBase(req);
    let paymentUrl;
    if (method === 'esewa') {
        txn.gatewayRef = txn.orderRef;
        paymentUrl = `${base}/api/v1/payments/esewa/pay/${txn._id}`;
    } else {
        try {
            const k = await khaltiInitiate({
                amount,
                purchaseOrderId: txn.orderRef,
                purchaseOrderName: target === 'driver' ? 'Tempu driver top-up' : 'Tempu wallet top-up',
                returnUrl: `${base}/api/v1/payments/khalti/return/${txn._id}`,
                websiteUrl: base,
                customer: { name: req.user.name, phone: req.user.phone, ...(req.user.email ? { email: req.user.email } : {}) },
            });
            txn.gatewayRef = k.pidx;
            paymentUrl = k.payment_url;
        } catch (err) {
            txn.status = 'failed';
            txn.failureReason = err.message;
            await txn.save();
            throw new apiError(502, 'Could not start the Khalti payment. Please try again.');
        }
    }
    await txn.save();

    return res.status(201).json(new apiResponse(201, {
        transactionId: txn._id,
        method,
        amount,
        paymentUrl,
    }, 'Payment started'));
});

const getTopupStatus = (target) => asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new apiError(400, 'Invalid transaction id');
    const owner = await ownerFilter(req, target);
    let txn = await Transaction.findOne({ _id: req.params.id, type: 'wallet_topup', ...owner });
    if (!txn) throw new apiError(404, 'Top-up not found');
    txn = await reconcile(txn);
    return res.status(200).json(new apiResponse(200, {
        transactionId: txn._id,
        status: txn.status,
        amount: txn.amount,
        method: txn.method,
        failureReason: txn.status === 'failed' ? txn.failureReason : null,
        ...(await balanceFor(owner)),
    }, 'Top-up status'));
});

// ---------------------------------------------------------------------------
// Public gateway pages (browser redirects — no auth header available)
// ---------------------------------------------------------------------------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function resultPage(res, { ok, pending, amount, method }) {
    const title = ok ? 'Payment successful' : pending ? 'Payment processing' : 'Payment not completed';
    const body = ok
        ? `Rs ${esc(amount)} was added via ${esc(method)}.`
        : pending
            ? 'We are still confirming this payment. Your balance updates as soon as it clears.'
            : 'You were not charged. You can try again from the app.';
    const color = ok ? '#1b7f3b' : pending ? '#9a6b00' : '#b3261e';
    const mark = ok ? '✓' : pending ? '…' : '✕';
    res.status(200).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Tempu</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f7f7;color:#111;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.card{background:#fff;border:1px solid #e6e6e6;border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center}
.mark{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;background:${color}}
h1{font-size:22px;margin:0 0 8px}p{color:#555;line-height:1.5;margin:0 0 20px}.hint{font-weight:600;color:#111}</style></head>
<body><div class="card"><div class="mark">${mark}</div><h1>${title}</h1><p>${body}</p>
<p class="hint">You can close this page and return to the Tempu app.</p></div></body></html>`);
}

async function findPublicTxn(id, method) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Transaction.findOne({ _id: id, type: 'wallet_topup', method });
}

// Serves the signed eSewa checkout form and submits it straight away.
const esewaPay = asyncHandler(async (req, res) => {
    const txn = await findPublicTxn(req.params.id, 'esewa');
    if (!txn || txn.status !== 'pending') return resultPage(res, { ok: txn?.status === 'completed', amount: txn?.amount, method: 'eSewa' });

    const base = callbackBase(req);
    const { action, fields } = esewaFormFields({
        amount: txn.amount,
        transactionUuid: txn.orderRef,
        successUrl: `${base}/api/v1/payments/esewa/return/${txn._id}`,
        failureUrl: `${base}/api/v1/payments/esewa/failure/${txn._id}`,
    });
    const nonce = crypto.randomBytes(16).toString('base64');
    // This page must post to eSewa and run one inline script; helmet's
    // app-wide CSP forbids both, so it gets its own narrow policy.
    res.setHeader('Content-Security-Policy',
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action ${new URL(action).origin}`);
    const inputs = Object.entries(fields)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
    res.status(200).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to eSewa · Tempu</title>
<style>body{margin:0;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f7f7f7}
button{font:inherit;font-weight:600;background:#60bb46;color:#fff;border:0;border-radius:999px;padding:14px 28px}</style></head>
<body><form id="f" method="POST" action="${esc(action)}">${inputs}<p>Redirecting to eSewa…</p><button type="submit">Continue to eSewa</button></form>
<script nonce="${nonce}">document.getElementById('f').submit();</script></body></html>`);
});

const esewaReturn = asyncHandler(async (req, res) => {
    let txn = await findPublicTxn(req.params.id, 'esewa');
    if (!txn) return resultPage(res, { ok: false });
    const payload = esewaDecodeCallback(req.query.data);
    // The redirect is only a hint; reconcile() asks eSewa's status API before
    // crediting, so a forged or replayed `data` can't add money.
    if (payload && payload.transaction_uuid === txn.orderRef) txn = await reconcile(txn);
    else if (txn.status === 'pending') txn = await reconcile(txn);
    return resultPage(res, { ok: txn.status === 'completed', pending: txn.status === 'pending', amount: txn.amount, method: 'eSewa' });
});

const esewaFailure = asyncHandler(async (req, res) => {
    let txn = await findPublicTxn(req.params.id, 'esewa');
    if (!txn) return resultPage(res, { ok: false });
    txn = await reconcile(txn); // paid after all? credit it
    if (txn.status === 'pending') txn = await failTopup(txn, 'eSewa: cancelled by user');
    return resultPage(res, { ok: txn.status === 'completed', amount: txn.amount, method: 'eSewa' });
});

const khaltiReturn = asyncHandler(async (req, res) => {
    let txn = await findPublicTxn(req.params.id, 'khalti');
    if (!txn) return resultPage(res, { ok: false });
    if (req.query.pidx && req.query.pidx !== txn.gatewayRef) return resultPage(res, { ok: false });
    txn = await reconcile(txn);
    if (txn.status === 'pending' && /cancel/i.test(String(req.query.status || ''))) {
        // Khalti said cancelled; confirm once more, then close it out.
        txn = await reconcile(txn);
        if (txn.status === 'pending') txn = await failTopup(txn, 'Khalti: cancelled by user');
    }
    return resultPage(res, { ok: txn.status === 'completed', pending: txn.status === 'pending', amount: txn.amount, method: 'Khalti' });
});

export {
    reconcileStaleTopups,
    getPaymentMethods, initiateTopup, getTopupStatus,
    esewaPay, esewaReturn, esewaFailure, khaltiReturn,
};
