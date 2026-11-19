// Khalti ePayment / KPG-2 (https://docs.khalti.com/khalti-epayment).
// Sandbox base by default; production sets KHALTI_BASE_URL=https://khalti.com/api/v2/
const cfg = () => ({
    baseUrl: (process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2/').replace(/\/?$/, '/'),
    secretKey: process.env.KHALTI_SECRET_KEY || '',
});

export const khaltiConfigured = () => !!cfg().secretKey;

async function call(path, body) {
    const { baseUrl, secretKey } = cfg();
    const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Key ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
}

// Amount in rupees; Khalti takes paisa. Returns { pidx, payment_url }.
export async function khaltiInitiate({ amount, purchaseOrderId, purchaseOrderName, returnUrl, websiteUrl, customer }) {
    const { ok, status, json } = await call('epayment/initiate/', {
        return_url: returnUrl,
        website_url: websiteUrl,
        amount: Math.round(amount * 100),
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        ...(customer ? { customer_info: customer } : {}),
    });
    if (!ok || !json?.pidx) {
        const detail = json?.detail || json?.error_key || JSON.stringify(json || {});
        const err = new Error(`Khalti initiate failed (${status}): ${detail}`);
        err.gatewayStatus = status;
        throw err;
    }
    return json;
}

// Returns { status: 'Completed' | 'Pending' | 'Initiated' | 'Expired' | 'User canceled' | ..., total_amount (paisa), transaction_id }.
export async function khaltiLookup(pidx) {
    const { ok, status, json } = await call('epayment/lookup/', { pidx });
    if (!json) throw new Error(`Khalti lookup failed (${status})`);
    if (!ok && !json.status) throw new Error(`Khalti lookup failed (${status}): ${json.detail || ''}`);
    return json;
}
