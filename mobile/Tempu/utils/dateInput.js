// Typed date fields (YYYY-MM-DD). The text boxes accepted anything, so a
// licence expiry could end up as "20021010101010". formatDateInput keeps only
// digits and inserts the dashes as you type; parseDateInput checks the result
// is a real calendar date (no 2027-02-30).
//
//   <TextInput value={v} onChangeText={(t) => setV(formatDateInput(t))} maxLength={10} … />

export function formatDateInput(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

// A local-midnight Date for a complete, real YYYY-MM-DD; otherwise null.
export function parseDateInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== day) return null;
  return date;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2027-06-30" → "30 Jun 2027", for a friendly confirmation under the field.
export function describeDateInput(value) {
  const date = parseDateInput(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : '';
}
