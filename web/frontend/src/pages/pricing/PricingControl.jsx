import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, ChevronRight, ArrowLeft, Plus, ChevronDown, MapPin } from '@/components/ui/icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { TableSpinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { AdminControls } from './AdminControls'
import { CityDetail } from './CityDetail'
import { pricingApi } from '../../api/pricing.api'
import { getActiveSlot, currentHour, VEHICLE_KEYS } from '../../utils/fareCalc'
import toast from 'react-hot-toast'

export default function PricingControl() {
  const { data, isLoading } = useQuery({ queryKey: ['pricing'], queryFn: pricingApi.get })
  if (isLoading) return <TableSpinner />
  return <Dashboard initial={data?.data || {}} />
}

function Dashboard({ initial }) {
  const qc = useQueryClient()
  const [config, setConfig] = useState(initial)
  const [selected, setSelected] = useState(null) // null = city list, else city index
  const [showGlobal, setShowGlobal] = useState(false)
  const [newCity, setNewCity] = useState('')
  const [activeSlotIndex, setActiveSlotIndex] = useState(() => {
    const slot = getActiveSlot(initial.timeSlots || [], currentHour())
    const idx = (initial.timeSlots || []).findIndex((s) => s === slot)
    return idx >= 0 ? idx : 0
  })

  const buildPayload = (c) => ({
    electricityCost: c.electricityCost,
    vatPercent: c.vatPercent,
    commissionPercent: c.commissionPercent,
    profitMarginPercent: c.profitMarginPercent,
    premium: c.premium,
    timeSlots: c.timeSlots,
    longDistanceDiscount: c.longDistanceDiscount,
    driverFee: c.driverFee,
    vehicles: c.vehicles,
    cities: c.cities,
  })

  const save = useMutation({
    mutationFn: (override) => pricingApi.update(buildPayload(override || config)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing'] }); toast.success('Pricing saved') },
    onError: (err) => toast.error(err?.message || 'Failed to save pricing'),
  })

  const cities = config.cities || []

  const addCity = () => {
    const name = newCity.trim()
    if (!name) return
    const next = {
      ...config,
      cities: [...(config.cities || []), {
        name, zoneMultiplier: 1, premiumOverride: false, premiumMultiplier: 1,
        vehicleOverrides: Object.fromEntries(VEHICLE_KEYS.map((k) => [k, { override: false, baseFare: 0 }])),
        locations: [], distances: [],
      }],
    }
    setConfig(next)
    setNewCity('')
    setSelected(cities.length)
    save.mutate(next) // persist immediately so it survives a refresh
  }

  // City detail view
  if (selected != null && cities[selected]) {
    const city = cities[selected]
    return (
      <div>
        <PageHeader
          title={city.name}
          description="Pricing for this city - every change recalculates the estimate live."
          actions={<Button icon={Save} onClick={() => save.mutate()} loading={save.isPending}>Save</Button>}
        />
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5">
          <ArrowLeft className="h-4 w-4" /> All cities
        </button>
        <CityDetail
          key={city.name}
          config={config}
          setConfig={setConfig}
          index={selected}
          activeSlotIndex={activeSlotIndex}
          onRename={(name) => {
            const trimmed = name.trim()
            if (!trimmed) return
            const next = { ...config, cities: config.cities.map((c, i) => (i === selected ? { ...c, name: trimmed } : c)) }
            setConfig(next)
            save.mutate(next)
          }}
          onDelete={() => {
            const next = { ...config, cities: config.cities.filter((_, i) => i !== selected) }
            setSelected(null)
            setConfig(next)
            save.mutate(next)
          }}
        />
      </div>
    )
  }

  // City list view
  return (
    <div>
      <PageHeader
        title="Pricing Control"
        description="Pick a city to manage its fares. Global rates below apply to every city."
        actions={<Button icon={Save} onClick={() => save.mutate()} loading={save.isPending}>Save</Button>}
      />

      {/* City picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {cities.map((c, i) => (
          <button key={c.name + i} onClick={() => setSelected(i)}
            className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-400 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {c.locations?.length || 0} locations · zone ×{(c.zoneMultiplier || 1).toFixed(1)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 mt-1" />
            </div>
            {c.premiumOverride && (
              <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                Surge ×{(c.premiumMultiplier || 1).toFixed(1)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add city */}
      <div className="flex gap-2 max-w-md mb-8">
        <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Add a city (e.g. Gorkha)"
          onKeyDown={(e) => e.key === 'Enter' && addCity()}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
        <button onClick={addCity} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">
          <Plus className="h-4 w-4" /> Add city
        </button>
      </div>

      {/* Global defaults (collapsible) */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button onClick={() => setShowGlobal((s) => !s)} className="flex items-center justify-between w-full px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">Global rates &amp; defaults (all cities)</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showGlobal ? 'rotate-180' : ''}`} />
        </button>
        {showGlobal && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            <AdminControls config={config} setConfig={setConfig} activeSlotIndex={activeSlotIndex} setActiveSlotIndex={setActiveSlotIndex} />
          </div>
        )}
      </div>
    </div>
  )
}
