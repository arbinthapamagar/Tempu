import { Zap, CloudRain, Clock, Ruler, BatteryCharging } from '@/components/ui/icons'
import { Card, Slider, Toggle, Field } from './Slider'
import { VEHICLE_KEYS, VEHICLE_META, getActiveSlot, currentHour } from '../../utils/fareCalc'

const PREMIUM_LABELS = ['Normal', 'Light Rain', 'Heavy Rain', 'Peak Hour', 'Festival', 'Strike', 'Bandh']

export function AdminControls({ config, setConfig, activeSlotIndex, setActiveSlotIndex }) {
  const patch = (p) => setConfig((c) => ({ ...c, ...p }))
  const patchPremium = (p) => setConfig((c) => ({ ...c, premium: { ...c.premium, ...p } }))
  const patchLD = (p) => setConfig((c) => ({ ...c, longDistanceDiscount: { ...c.longDistanceDiscount, ...p } }))
  const patchSlot = (i, p) => setConfig((c) => ({ ...c, timeSlots: c.timeSlots.map((s, idx) => (idx === i ? { ...s, ...p } : s)) }))
  const patchVehicle = (k, p) => setConfig((c) => ({ ...c, vehicles: { ...c.vehicles, [k]: { ...c.vehicles[k], ...p } } }))

  const useCurrentTime = () => {
    const slot = getActiveSlot(config.timeSlots, currentHour())
    const idx = config.timeSlots.findIndex((s) => s === slot)
    if (idx >= 0) setActiveSlotIndex(idx)
  }

  return (
    <div className="space-y-3">
      {/* Global controls */}
      <Card title="Global Controls" icon={Zap}>
        <div className="space-y-3">
          <Slider label="Electricity cost" value={config.electricityCost} min={5} max={50} step={0.5}
            onChange={(v) => patch({ electricityCost: v })} suffix=" Rs/kWh" hint="NEA rate, default 17" />
          <Slider label="VAT" value={config.vatPercent} min={0} max={30} step={1}
            onChange={(v) => patch({ vatPercent: v })} suffix="%" />
          <Slider label="Platform commission" value={config.commissionPercent} min={0} max={30} step={1}
            onChange={(v) => patch({ commissionPercent: v })} suffix="%" />
          <Slider label="Driver profit margin" value={config.profitMarginPercent} min={0} max={50} step={1}
            onChange={(v) => patch({ profitMarginPercent: v })} suffix="%" />
        </div>
      </Card>

      {/* Weather / event premium */}
      <Card title="Weather / Event Premium" icon={CloudRain}>
        <div className="space-y-3">
          <Slider label="Premium multiplier" value={config.premium?.multiplier} min={1} max={3} step={0.1}
            onChange={(v) => patchPremium({ multiplier: v })} format={(v) => v.toFixed(1)} suffix="×" />
          <div className="flex flex-wrap gap-1.5">
            {PREMIUM_LABELS.map((l) => (
              <button key={l} onClick={() => patchPremium({ label: l })}
                className={`text-xs px-2.5 py-1 rounded-full border ${config.premium?.label === l ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                {l}
              </button>
            ))}
          </div>
          <Toggle label="Apply premium to all cities at once"
            checked={!!config.premium?.applyToAllCities}
            onChange={(v) => patchPremium({ applyToAllCities: v })} />
        </div>
      </Card>

      {/* Time-based slots */}
      <Card title="Time-Based Pricing Slots" icon={Clock}
        right={<button onClick={useCurrentTime} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100">Use current time</button>}>
        <div className="space-y-3">
          {config.timeSlots?.map((s, i) => (
            <div key={i} className={`rounded-lg border p-3 ${i === activeSlotIndex ? 'border-orange-400' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <input value={s.name} onChange={(e) => patchSlot(i, { name: e.target.value })}
                  className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:outline-none" />
                <button onClick={() => setActiveSlotIndex(i)}
                  className={`text-xs px-2 py-0.5 rounded-full ${i === activeSlotIndex ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {i === activeSlotIndex ? 'Active' : 'Set active'}
                </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Field type="number" min={0} value={s.startHour} onChange={(v) => patchSlot(i, { startHour: v })} className="w-16" />
                <span className="text-xs text-gray-400">to</span>
                <Field type="number" min={0} value={s.endHour} onChange={(v) => patchSlot(i, { endHour: v })} className="w-16" />
                <span className="text-xs text-gray-400">hrs</span>
              </div>
              <Slider value={s.multiplier} min={0.8} max={2.0} step={0.1}
                onChange={(v) => patchSlot(i, { multiplier: v })} format={(v) => v.toFixed(1)} suffix="×" />
            </div>
          ))}
        </div>
      </Card>

      {/* Long distance discount */}
      <Card title="Long-Distance Discount" icon={Ruler}>
        <div className="space-y-3">
          <Toggle label="Enable long-distance discount"
            checked={!!config.longDistanceDiscount?.enabled}
            onChange={(v) => patchLD({ enabled: v })} />
          {config.longDistanceDiscount?.enabled && (
            <>
              <Slider label="Discount" value={config.longDistanceDiscount?.percent} min={0} max={50} step={1}
                onChange={(v) => patchLD({ percent: v })} suffix="%" />
              <Slider label="Applies over" value={config.longDistanceDiscount?.thresholdKm} min={1} max={50} step={1}
                onChange={(v) => patchLD({ thresholdKm: v })} suffix=" km" />
            </>
          )}
        </div>
      </Card>

      {/* Per-vehicle EV defaults */}
      <Card title="Per-Vehicle Global Defaults (EV)" icon={BatteryCharging}>
        <div className="space-y-3">
          {VEHICLE_KEYS.map((k) => (
            <div key={k} className="rounded-lg border border-gray-100 p-3">
              <p className="text-sm font-semibold text-gray-800 mb-3">{VEHICLE_META[k].label}</p>
              <div className="space-y-3">
                <Slider label="Efficiency" value={config.vehicles?.[k]?.efficiency} min={1} max={50} step={1}
                  onChange={(v) => patchVehicle(k, { efficiency: v })} suffix=" km/kWh" />
                <Slider label="Maintenance / km" value={config.vehicles?.[k]?.maintenancePerKm} min={0} max={20} step={0.5}
                  onChange={(v) => patchVehicle(k, { maintenancePerKm: v })} suffix=" Rs" />
                <Slider label="Base fare" value={config.vehicles?.[k]?.baseFare} min={0} max={300} step={5}
                  onChange={(v) => patchVehicle(k, { baseFare: v })} suffix=" Rs" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
