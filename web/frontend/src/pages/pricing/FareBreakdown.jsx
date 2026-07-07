import { rs } from '../../utils/fareCalc'

// Tone a row: discounts & low multipliers green, mid amber, high red.
function toneFor(row) {
  if (row.discount) return 'green'
  if (row.factor != null) {
    if (row.factor < 1) return 'green'
    if (row.factor < 1.25) return 'teal'
    if (row.factor < 1.5) return 'amber'
    return 'red'
  }
  return 'teal'
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700',
  teal: 'bg-orange-50/60 text-gray-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
}

export function FareBreakdown({ f }) {
  if (!f) return null
  return (
    <div className="space-y-1.5">
      {f.rows.map((row, i) => (
        <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${row.strong ? 'bg-gray-50 font-semibold text-gray-800' : TONES[toneFor(row)]}`}>
          <span>{row.label}</span>
          <span className="flex items-center gap-2 tabular-nums">
            {row.factor != null && <span className="text-xs opacity-70">×{row.factor.toFixed(2)}</span>}
            <span>{rs(row.amount)}</span>
          </span>
        </div>
      ))}

      {/* Fare assembly */}
      <div className="mt-3 border-t border-dashed border-gray-200 pt-3 space-y-1.5">
        <Line label="Base fare" value={rs(f.baseFare)} />
        <Line label={`Distance cost (${f.billedDistance} km × ${rs(f.finalPerKm)})`} value={rs(f.distanceCost)} />
        {f.distFloored && (
          <p className="px-3 text-xs text-amber-600">
            Ride is {f.actualDistance} km - billed as the {f.billedDistance} km minimum.
          </p>
        )}
        <Line label="Subtotal fare" value={rs(f.subtotalFare)} strong />
        <Line label={`VAT (${f.vatPct}%)`} value={rs(f.vat)} tone="amber" />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-orange-600 px-4 py-3 text-white">
        <span className="text-sm font-medium">Final fare</span>
        <span className="text-xl font-bold tabular-nums">{rs(f.finalFare)}</span>
      </div>
    </div>
  )
}

function Line({ label, value, strong, tone }) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 text-sm rounded-lg ${strong ? 'bg-gray-50 font-semibold text-gray-800' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
