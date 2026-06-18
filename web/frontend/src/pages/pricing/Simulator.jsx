import { useState } from 'react'
import { ChevronDown, Copy, Clock, CloudRain, Leaf, BatteryCharging, Timer, GitCompare, History } from 'lucide-react'
import { Card } from './Slider'
import { FareBreakdown } from './FareBreakdown'
import {
  VEHICLE_KEYS, VEHICLE_META, computeFare, lookupDistance, travelTimeMinutes,
  co2SavedKg, chargingCost, bidFeedback, suggestedRange, quickBid, rs,
} from '../../utils/fareCalc'
import toast from 'react-hot-toast'

const FALLBACK_DISTANCE = 5

const BID_TONES = {
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
}

function fmtTime(min) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function Simulator({ config, activeSlotIndex, lockedCityName }) {
  const cities = config.cities || []
  const [cityName, setCityName] = useState(lockedCityName || cities[0]?.name || '')
  const [vehicleKey, setVehicleKey] = useState(VEHICLE_KEYS[0])
  const activeCityName = lockedCityName || cityName
  const city = cities.find((c) => c.name === activeCityName) || cities[0]
  const locNames = city?.locations?.map((l) => l.name) || []

  const [pickup, setPickup] = useState(locNames[0] || '')
  const [drop, setDrop] = useState(locNames[1] || locNames[0] || '')
  const [distOverride, setDistOverride] = useState(null) // null → auto
  const [bid, setBid] = useState('')
  const [openBreakdown, setOpenBreakdown] = useState(true)
  const [showCompare, setShowCompare] = useState(false)
  const [history, setHistory] = useState([])

  const slot = config.timeSlots?.[activeSlotIndex] || null
  const premiumLabel = config.premium?.label || 'Normal'
  const premiumValue = city?.premiumOverride ? city.premiumMultiplier : (config.premium?.applyToAllCities ? config.premium?.multiplier : 1)

  const autoDist = lookupDistance(city, pickup, drop) ?? FALLBACK_DISTANCE
  const distance = distOverride != null ? distOverride : autoDist

  const f = computeFare({ config, city, vehicleKey, pickup, drop, distance, slot })
  const standard = f.finalFare
  const range = suggestedRange(standard)
  const offered = parseFloat(bid) || 0
  const fb = bidFeedback(offered, standard)

  const travelMin = travelTimeMinutes(distance)
  const co2 = co2SavedKg(distance)
  const charge = chargingCost(distance, f.efficiency, config.electricityCost)

  // Analytics across all cities for the selected vehicle + distance
  const perCity = cities.map((c) => {
    const cf = computeFare({ config, city: c, vehicleKey, pickup, drop, distance, slot })
    return { name: c.name, perKm: cf.finalPerKm, fare: cf.finalFare }
  })
  const avgPerKm = perCity.length ? perCity.reduce((s, x) => s + x.perKm, 0) / perCity.length : 0
  const cheapest = perCity.reduce((a, b) => (b.fare < a.fare ? b : a), perCity[0] || { name: '—', fare: 0 })
  const dearest = perCity.reduce((a, b) => (b.fare > a.fare ? b : a), perCity[0] || { name: '—', fare: 0 })

  const selectCity = (name) => {
    const c = cities.find((x) => x.name === name)
    setCityName(name)
    setPickup(c?.locations?.[0]?.name || '')
    setDrop(c?.locations?.[1]?.name || c?.locations?.[0]?.name || '')
    setDistOverride(null)
  }
  const selectPickup = (v) => { setPickup(v); setDistOverride(null) }
  const selectDrop = (v) => { setDrop(v); setDistOverride(null) }

  const summaryText = () =>
    [
      `Tempu EV Fare Estimate`,
      `${city?.name} · ${VEHICLE_META[vehicleKey].label}`,
      `${pickup} → ${drop} (${distance} km)`,
      `Time slot: ${slot?.name || '—'} (×${slot?.multiplier ?? 1})`,
      `Premium: ${premiumLabel} (×${premiumValue})`,
      `Final cost/km: ${rs(f.finalPerKm)}`,
      `Standard fare: ${rs(standard)}`,
      `Est. time: ${fmtTime(travelMin)} · CO₂ saved: ${co2.toFixed(2)} kg`,
    ].join('\n')

  const copySummary = async () => {
    try { await navigator.clipboard.writeText(summaryText()); toast.success('Fare summary copied') }
    catch { toast.error('Copy failed') }
  }

  const saveHistory = () => {
    const d = new Date()
    const stamp = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setHistory((h) => [{ stamp, city: city?.name, vehicle: VEHICLE_META[vehicleKey].short, route: `${pickup}→${drop}`, fare: standard }, ...h].slice(0, 5))
    toast.success('Saved to history')
  }

  return (
    <div className="space-y-3">
      {/* Always-visible badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
          <Clock className="h-3.5 w-3.5" /> {slot?.name || 'No slot'} ×{slot?.multiplier ?? 1}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CloudRain className="h-3.5 w-3.5" /> {premiumLabel} ×{premiumValue}
        </span>
      </div>

      {/* Route selection */}
      <Card title={lockedCityName ? `Fare estimator — ${lockedCityName}` : 'Trip'} icon={Timer}>
        <div className="grid grid-cols-2 gap-3">
          {!lockedCityName && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">City</span>
              <select value={cityName} onChange={(e) => selectCity(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className={lockedCityName ? 'col-span-2' : ''}>
            <span className="block text-xs font-medium text-gray-600 mb-1">Vehicle</span>
            <div className="flex gap-1.5">
              {VEHICLE_KEYS.map((k) => (
                <button key={k} onClick={() => setVehicleKey(k)}
                  className={`flex-1 text-xs font-medium py-2 rounded-lg border ${vehicleKey === k ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                  {VEHICLE_META[k].label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Pickup</span>
            <select value={pickup} onChange={(e) => selectPickup(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
              {locNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Drop</span>
            <select value={drop} onChange={(e) => selectDrop(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
              {locNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="block text-xs font-medium text-gray-600 mb-1">Distance (km) — auto-filled, editable</span>
            <input type="number" min={0} step={0.5} value={distance}
              onChange={(e) => setDistOverride(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          </label>
        </div>

        {/* Headline */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Standard fare</p>
            <p className="text-2xl font-bold text-orange-700 tabular-nums">{rs(standard)}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {fmtTime(travelMin)}</p>
            <p className="mt-0.5">@ 20 km/h avg</p>
          </div>
        </div>
      </Card>

      {/* Fare breakdown accordion */}
      <Card>
        <button onClick={() => setOpenBreakdown((o) => !o)} className="flex items-center justify-between w-full mb-1">
          <span className="text-sm font-semibold text-gray-800">Fare Breakdown</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openBreakdown ? 'rotate-180' : ''}`} />
        </button>
        {openBreakdown && <div className="mt-3"><FareBreakdown f={f} /></div>}
      </Card>

      {/* Bidding */}
      <Card title="Place a Bid">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="number" min={0} value={bid} onChange={(e) => setBid(e.target.value)} placeholder="Your offer (Rs)"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
            <button onClick={() => setBid(String(Math.round(quickBid(standard))))}
              className="text-xs font-medium px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 whitespace-nowrap">
              Quick bid (90%)
            </button>
          </div>
          <p className="text-xs text-gray-500">Suggested range: <strong>{rs(range.low)}</strong> – <strong>{rs(range.high)}</strong></p>
          {fb && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${BID_TONES[fb.level]}`}>
              <span className="font-semibold">{fb.label}.</span> {fb.driver}.
            </div>
          )}
        </div>
      </Card>

      {/* Compare vehicles */}
      <Card>
        <button onClick={() => setShowCompare((s) => !s)} className="flex items-center justify-between w-full">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"><GitCompare className="h-4 w-4 text-orange-600" /> Compare all vehicles</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCompare ? 'rotate-180' : ''}`} />
        </button>
        {showCompare && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {VEHICLE_KEYS.map((k) => {
              const cf = computeFare({ config, city, vehicleKey: k, pickup, drop, distance, slot })
              return (
                <div key={k} className={`rounded-lg border p-3 ${k === vehicleKey ? 'border-orange-400 bg-orange-50/40' : 'border-gray-200'}`}>
                  <p className="text-sm font-semibold text-gray-800">{VEHICLE_META[k].label}</p>
                  <p className="text-lg font-bold text-orange-700 tabular-nums mt-1">{rs(cf.finalFare)}</p>
                  <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                    <p>Cost/km: {rs(cf.finalPerKm)}</p>
                    <p>Base fare: {rs(cf.baseFare)}</p>
                    <p>VAT: {rs(cf.vat)}</p>
                    <p>Charge: {rs(chargingCost(distance, cf.efficiency, config.electricityCost))}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Analytics bar */}
      <Card title="Summary / Analytics">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label={`Avg fare/km (${VEHICLE_META[vehicleKey].short}, all cities)`} value={rs(avgPerKm)} />
          <Stat label="Cheapest city" value={`${cheapest?.name}`} sub={rs(cheapest?.fare)} tone="green" />
          <Stat label="Most expensive city" value={`${dearest?.name}`} sub={rs(dearest?.fare)} tone="red" />
          <Stat label="Active premium" value={premiumLabel} sub={`×${premiumValue}`} icon={CloudRain} />
          <Stat label="CO₂ saved vs petrol" value={`${co2.toFixed(2)} kg`} icon={Leaf} tone="green" />
          <Stat label="Charging cost (this trip)" value={rs(charge)} icon={BatteryCharging} />
        </div>
      </Card>

      {/* Actions + history */}
      <div className="flex flex-wrap gap-2">
        <button onClick={copySummary} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
          <Copy className="h-4 w-4" /> Copy fare summary
        </button>
        <button onClick={saveHistory} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
          <History className="h-4 w-4" /> Save to history
        </button>
      </div>

      {history.length > 0 && (
        <Card title="Fare History (last 5)" icon={History}>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{h.stamp} · {h.city} · {h.vehicle} · {h.route}</span>
                <span className="font-semibold text-gray-800 tabular-nums">{rs(h.fare)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, sub, icon: Icon, tone }) {
  const toneText = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-gray-900'
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <p className="text-xs text-gray-400 flex items-center gap-1">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</p>
      <p className={`text-base font-bold ${toneText} mt-0.5`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
