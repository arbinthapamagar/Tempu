import { useState } from 'react'
import { Card } from './Slider'
import { computeFare, driverEconomics, rs, VEHICLE_META } from '../../utils/fareCalc'

// A coloured "who gets what" row.
function Row({ label, value, tone, strong, sub }) {
  const toneText =
    tone === 'profit' ? 'text-emerald-700'
    : tone === 'cost' ? 'text-red-600'
    : tone === 'fee' ? 'text-amber-700'
    : 'text-gray-700'
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${strong ? 'bg-gray-50 font-semibold' : ''}`}>
      <span className={strong ? 'text-gray-800' : 'text-gray-500'}>
        {label}{sub && <span className="block text-[11px] text-gray-400">{sub}</span>}
      </span>
      <span className={`tabular-nums font-semibold ${strong ? 'text-gray-900' : toneText}`}>{value}</span>
    </div>
  )
}

export function DriverEconomics({ f, config, city, vehicleKey, pickup, drop, slot }) {
  const [tripsPerDay, setTripsPerDay] = useState(15)
  const [avgKm, setAvgKm] = useState(4)
  const [daysPerMonth, setDaysPerMonth] = useState(26)

  const e = driverEconomics(f, config)

  // Daily/monthly estimate uses a representative trip at `avgKm` with the same
  // city / vehicle / time-slot settings as the simulator.
  const avgFare = computeFare({ config, city, vehicleKey, pickup, drop, distance: avgKm, slot })
  const avgEcon = driverEconomics(avgFare, config)
  const dayGross = avgEcon.driverGross * tripsPerDay
  const dayCost = avgEcon.runningCost * tripsPerDay
  const dayProfit = avgEcon.driverNetProfit * tripsPerDay
  const dayFee = avgEcon.platformFee * tripsPerDay
  const monthProfit = dayProfit * daysPerMonth

  const vlabel = VEHICLE_META[vehicleKey]?.label || vehicleKey

  return (
    <Card title={`Driver Economics & Profit — ${vlabel}`}>
      <p className="text-xs text-gray-400 -mt-1 mb-3">
        Commission is the platform's cut (it's built into the per-km rate, not the flat base fare).
        VAT is pass-through to the government. "Profit" is what the driver keeps after their own electricity + maintenance.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ---- per km ---- */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Per kilometre</h4>
          <Row label="Rider pays / km (before VAT)" value={rs(e.riderPerKm)} strong />
          <Row label="Driver revenue / km" value={rs(e.driverRevPerKm)} />
          <Row label="– Running cost / km (elec + maint)" value={rs(e.runCostPerKm)} tone="cost" />
          <Row label="Driver profit / km" value={rs(e.driverProfitPerKm)} tone="profit" strong />
          <Row label={`Platform fee / km (${e.commPct}%)`} value={rs(e.platformFeePerKm)} tone="fee" />
        </div>

        {/* ---- per trip ---- */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            This trip · {e.billedDistance} km{f.distFloored ? ` (min, ride was ${f.actualDistance} km)` : ''}
          </h4>
          <Row label="Base fare" value={rs(e.baseFare)} />
          <Row label="Distance charge" value={rs(e.distanceCharge)} sub={`${e.billedDistance} km × ${rs(f.finalPerKm)}`} />
          <Row label="Subtotal (before VAT)" value={rs(e.subtotalFare)} strong />
          <Row label={`VAT (${f.vatPct}%) → govt`} value={rs(e.vat)} tone="fee" />
          <Row label="Rider pays (after VAT)" value={rs(e.riderPays)} strong />
        </div>
      </div>

      {/* ---- who keeps what, this trip ---- */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Split label="Driver gross" value={rs(e.driverGross)} tone="gray" />
        <Split label="– Running cost" value={rs(e.runningCost)} tone="cost" />
        <Split label="Driver NET profit" value={rs(e.driverNetProfit)} tone="profit" big />
        <Split label="Platform fee" value={rs(e.platformFee)} tone="fee" />
      </div>

      {/* ---- daily / monthly estimate ---- */}
      <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Estimated earnings</h4>
        <div className="flex flex-wrap gap-3 mb-3">
          <NumInput label="Trips / day" value={tripsPerDay} onChange={setTripsPerDay} />
          <NumInput label="Avg km / trip" value={avgKm} onChange={setAvgKm} step={0.5} />
          <NumInput label="Working days / month" value={daysPerMonth} onChange={setDaysPerMonth} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Split label="Per-trip profit" value={rs(avgEcon.driverNetProfit)} tone="profit" sub={`@ ${avgKm} km`} />
          <Split label="Daily gross" value={rs(dayGross)} tone="gray" sub={`${tripsPerDay} trips`} />
          <Split label="Daily NET profit" value={rs(dayProfit)} tone="profit" big sub={`– ${rs(dayCost)} costs`} />
          <Split label="Monthly NET profit" value={rs(monthProfit)} tone="profit" sub={`× ${daysPerMonth} days`} />
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Daily platform fee from this driver ≈ {rs(dayFee)}. Estimates assume every trip at the average distance, current city/vehicle/time-slot.
        </p>
      </div>
    </Card>
  )
}

function Split({ label, value, tone, big, sub }) {
  const bg =
    tone === 'profit' ? 'bg-emerald-50 border-emerald-200'
    : tone === 'cost' ? 'bg-red-50 border-red-200'
    : tone === 'fee' ? 'bg-amber-50 border-amber-200'
    : 'bg-gray-50 border-gray-200'
  const text =
    tone === 'profit' ? 'text-emerald-700'
    : tone === 'cost' ? 'text-red-600'
    : tone === 'fee' ? 'text-amber-700'
    : 'text-gray-800'
  return (
    <div className={`rounded-lg border p-2.5 ${bg}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`tabular-nums font-bold ${big ? 'text-lg' : 'text-sm'} ${text}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

function NumInput({ label, value, onChange, step = 1 }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="number" min={0} step={step} value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
      />
    </label>
  )
}
