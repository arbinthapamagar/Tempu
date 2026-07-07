import { useState } from 'react'
import { MapPin, Plus, Trash2, Check, Pencil } from '@/components/ui/icons'
import { Card, Slider, Toggle, Field } from './Slider'
import { Simulator } from './Simulator'
import { VEHICLE_KEYS, VEHICLE_META } from '../../utils/fareCalc'

// Per-city pricing editor (one city, by index) + a fare simulator scoped to it.
export function CityDetail({ config, setConfig, index, activeSlotIndex, onRename, onDelete }) {
  const [newLoc, setNewLoc] = useState('')
  const city = config.cities?.[index]
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(city?.name || '')

  const patchCity = (p) => setConfig((c) => ({ ...c, cities: c.cities.map((ct, i) => (i === index ? { ...ct, ...p } : ct)) }))
  const patchCityVehicle = (k, p) => setConfig((c) => ({
    ...c,
    cities: c.cities.map((ct, i) => (i === index ? { ...ct, vehicleOverrides: { ...ct.vehicleOverrides, [k]: { ...ct.vehicleOverrides?.[k], ...p } } } : ct)),
  }))
  const patchLocation = (li, p) => patchCity({ locations: city.locations.map((l, i) => (i === li ? { ...l, ...p } : l)) })
  const removeLocation = (li) => patchCity({ locations: city.locations.filter((_, i) => i !== li) })

  const addLocation = () => {
    const name = newLoc.trim()
    if (!name) return
    patchCity({ locations: [...(city.locations || []), { name, microZoneMultiplier: 1 }] })
    setNewLoc('')
  }

  const patchDistance = (di, p) => patchCity({ distances: city.distances.map((d, i) => (i === di ? { ...d, ...p } : d)) })
  const addDistance = () => {
    const first = city.locations?.[0]?.name || ''
    const second = city.locations?.[1]?.name || first
    patchCity({ distances: [...(city.distances || []), { from: first, to: second, km: 0 }] })
  }
  const removeDistance = (di) => patchCity({ distances: city.distances.filter((_, i) => i !== di) })

  if (!city) return <p className="text-sm text-gray-500">City not found.</p>

  return (
    <div>
      {/* Rename / delete city */}
      <div className="flex items-center gap-2 mb-4">
        {editingName ? (
          <>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onRename?.(nameDraft); setEditingName(false) } }}
              autoFocus
              className="text-lg font-semibold text-gray-900 border-b-2 border-orange-400 focus:outline-none"
            />
            <button onClick={() => { onRename?.(nameDraft); setEditingName(false) }}
              className="p-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700" title="Save name">
              <Check className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">{city.name}</h2>
            <button onClick={() => { setNameDraft(city.name); setEditingName(true) }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50" title="Rename city">
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={() => { if (window.confirm(`Delete ${city.name}? This removes its locations and overrides.`)) onDelete?.() }}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-red-600 border border-red-200 hover:bg-red-50">
          <Trash2 className="h-4 w-4" /> Delete city
        </button>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:divide-x lg:divide-gray-200">
      {/* Left: this city's settings */}
      <div className="space-y-3 lg:pr-6">
        <Card title={`${city.name} - rates`}>
          <div className="space-y-3">
            <Slider label="Zone traffic multiplier" value={city.zoneMultiplier} min={1} max={2} step={0.1}
              onChange={(v) => patchCity({ zoneMultiplier: v })} format={(v) => v.toFixed(1)} suffix="×"
              hint="Heavier traffic = higher fares for this city" />

            <div className="rounded-lg border border-gray-100 p-3 space-y-3">
              <Toggle label="Use a city-specific surge" checked={!!city.premiumOverride}
                onChange={(v) => patchCity({ premiumOverride: v })}
                hint="Otherwise this city follows the global weather/event premium" />
              {city.premiumOverride && (
                <Slider label="City surge" value={city.premiumMultiplier} min={1} max={3} step={0.1}
                  onChange={(v) => patchCity({ premiumMultiplier: v })} format={(v) => v.toFixed(1)} suffix="×" />
              )}
            </div>

            <div className="rounded-lg border border-gray-100 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Base fare override (per vehicle)</p>
              {VEHICLE_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-sm text-gray-800 w-16 shrink-0">{VEHICLE_META[k].label}</span>
                  <Toggle label="" checked={!!city.vehicleOverrides?.[k]?.override}
                    onChange={(v) => patchCityVehicle(k, { override: v })} />
                  {city.vehicleOverrides?.[k]?.override && (
                    <Field type="number" min={0} value={city.vehicleOverrides[k].baseFare}
                      onChange={(v) => patchCityVehicle(k, { baseFare: v })} className="flex-1" placeholder="Base fare Rs" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Locations" icon={MapPin}>
          <div className="space-y-2 mb-3">
            {city.locations?.map((l, li) => (
              <div key={li} className="flex items-center gap-2">
                <input value={l.name} onChange={(e) => patchLocation(li, { name: e.target.value })}
                  className="flex-1 text-sm text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:outline-none" />
                <div className="w-40">
                  <Slider value={l.microZoneMultiplier} min={1} max={1.5} step={0.05}
                    onChange={(v) => patchLocation(li, { microZoneMultiplier: v })} format={(v) => v.toFixed(2)} suffix="×" />
                </div>
                <button onClick={() => removeLocation(li)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {(!city.locations || city.locations.length === 0) && <p className="text-sm text-gray-400">No locations yet.</p>}
          </div>
          <div className="flex gap-2">
            <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Add a landmark / area"
              onKeyDown={(e) => e.key === 'Enter' && addLocation()}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
            <button onClick={addLocation} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </Card>

        <Card title="Distances between locations">
          <div className="flex justify-end mb-3">
            <button onClick={addDistance} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
              <Plus className="h-3.5 w-3.5" /> Add pair
            </button>
          </div>
          {(!city.distances || city.distances.length === 0) ? (
            <p className="text-xs text-gray-400">No distances set yet. Passengers can still type the distance in.</p>
          ) : (
            <div className="space-y-2">
              {city.distances.map((d, di) => (
                <div key={di} className="flex items-center gap-2">
                  <select value={d.from} onChange={(e) => patchDistance(di, { from: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none">
                    {city.locations?.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">→</span>
                  <select value={d.to} onChange={(e) => patchDistance(di, { to: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none">
                    {city.locations?.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>
                  <Field type="number" min={0} step={0.5} value={d.km} onChange={(v) => patchDistance(di, { km: v })} className="w-20" />
                  <button onClick={() => removeDistance(di)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right: simulator scoped to this city */}
      <div className="lg:pl-6">
        <Simulator config={config} activeSlotIndex={activeSlotIndex} lockedCityName={city.name} />
      </div>
    </div>
    </div>
  )
}
