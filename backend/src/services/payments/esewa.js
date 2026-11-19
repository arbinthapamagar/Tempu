import crypto from 'crypto';

// eSewa ePay v2 (https://developer.esewa.com.np/pages/Epay).
// Defaults are eSewa's public UAT values; production sets all four env vars.
const cfg = () => ({
    productCode: process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST',
    secretKey: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q',
    formUrl: process.env.ESEWA_FORM_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    statusUrl: process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/',
});

// HMAC-SHA256 (base64) over "field=value,field=value" in signed_field_names order.
export function esewaSign(fields, signedFieldNames) {
    const message = signedFieldNames
        .split(',')
        .map((name) => `${name}=${fields[name]}`)
        .join(',');
    return crypto.createHmac('sha256', cfg().secretKey).update(message).digest('base64');
}

// Fields for the auto-submitted checkout form. Amounts are whole rupees.
export function esewaFormFields({ amount, transactionUuid, successUrl, failureUrl }) {
    const { productCode } = cfg();
    const fields = {
        amount: String(amount),
        tax_amount: '0',
        total_amount: String(amount),
        transaction_uuid: transactionUuid,
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
    };
    fields.signature = esewaSign(fields, fields.signed_field_names);
    return { action: cfg().formUrl, fields };
}

// Decode + verify the base64 `data` eSewa appends to success_url. Returns the
// payload only if its signature checks out; null otherwise.
export function esewaDecodeCallback(data) {
    let payload;
    try {
        payload = JSON.parse(Buffer.from(String(data), 'base64').toString('utf8'));
    } catch {
        return null;
    }
    if (!payload?.signed_field_names || !payload?.signature) return null;
    const expected = esewaSign(payload, payload.signed_field_names);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(payload.signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return payload;
}

// Server-to-server status check — the source of truth before crediting.
// Returns { status: 'COMPLETE' | 'PENDING' | 'NOT_FOUND' | 'CANCELED' | ..., ref_id }.
export async function esewaStatus({ amount, transactionUuid }) {
    const { productCode, statusUrl } = cfg();
    const qs = new URLSearchParams({
        product_code: productCode,
        total_amount: String(amount),
        transaction_uuid: transactionUuid,
    });
    const res = await fetch(`${statusUrl}?${qs}`, { signal: AbortSignal.timeout(15000) });
    const json = await res.json().catch(() => null);
    if (!json) throw new Error(`eSewa status check failed (${res.status})`);
    return json;
}
