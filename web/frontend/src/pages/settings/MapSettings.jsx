import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, MapPin, Zap, CheckCircle, XCircle } from '@/components/ui/icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { TableSpinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { mapSettingsApi } from '../../api/mapSettings.api'
import toast from 'react-hot-toast'

export default function MapSettings() {
  const { data, isLoading } = useQuery({ queryKey: ['map-settings'], queryFn: mapSettingsApi.get })
  if (isLoading) return <TableSpinner />
  return <Form initial={data?.data || {}} />
}

function Form({ initial }) {
  const qc = useQueryClient()
  const [provider, setProvider] = useState(initial.provider || 'osm')
  const [apiKey, setApiKey] = useState(initial.googleMapsApiKey || '')
  const [countryCode, setCountryCode] = useState(initial.countryCode || 'np')

  // Test panel state
  const [testResult, setTestResult] = useState(null)

  const save = useMutation({
    mutationFn: () => mapSettingsApi.update({
      provider,
      googleMapsApiKey: apiKey.trim(),
      countryCode: countryCode.trim().toLowerCase(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['map-settings'] }); toast.success('Map settings saved') },
    onError: (err) => toast.error(err?.message || 'Failed to save map settings'),
  })

  // Test uses the CURRENT form values (not the saved doc) so you can verify the
  // key before committing it. No query needed — the backend probes the provider
  // with a fixed internal request; an invalid/blocked/not-enabled key fails.
  const runTest = useMutation({
    mutationFn: () => mapSettingsApi.test({
      provider,
      googleMapsApiKey: apiKey.trim(),
      countryCode: countryCode.trim().toLowerCase(),
    }),
    onSuccess: (res) => setTestResult(res?.data || null),
    onError: (err) => setTestResult({ ok: false, error: err?.message || 'Test request failed' }),
  })

  const googleSelected = provider === 'google'
  const googleActiveNow = googleSelected && apiKey.trim().length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        title="Map & Location"
        description="Choose which provider powers place search, geocoding and directions in the app."
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      {/* Settings */}
      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <Select
          label="Map provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          options={[
            { value: 'osm', label: 'OpenStreetMap (free — default)' },
            { value: 'google', label: 'Google Maps (requires API key)' },
          ]}
        />

        <Input
          label="Google Maps API key"
          icon={MapPin}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={!googleSelected}
        />

        <Input
          label="Country code (ISO 3166-1 alpha-2)"
          type="text"
          maxLength={2}
          placeholder="np"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
        />

        <div className={
          'rounded-lg border px-4 py-3 text-sm ' +
          (googleActiveNow
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-amber-200 bg-amber-50 text-amber-800')
        }>
          {googleActiveNow
            ? 'Google Maps is active — search & geocoding will use your key.'
            : googleSelected
              ? 'Google is selected but no key is set — the app falls back to free OpenStreetMap until you add a key.'
              : 'Using free OpenStreetMap. Switch to Google and add a key for better Nepal coverage.'}
        </div>

        <div className="text-xs text-gray-500 leading-relaxed">
          <p className="font-medium text-gray-700 mb-1">How to get a key</p>
          Create a key in the Google Cloud Console, enable <b>Places API</b> and
          <b> Geocoding API</b>, then <b>restrict the key</b> (by API + by your backend
          server IP) before pasting it here. The key is stored server-side and never
          shipped to the app — the app calls your backend, which calls Google.
        </div>
      </div>

      {/* Test panel */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900">Test API key</h2>
          </div>
          <Button variant="secondary" onClick={() => runTest.mutate()} disabled={runTest.isPending}>
            {runTest.isPending ? 'Testing…' : 'Test API key'}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Checks the {googleSelected ? 'Google' : 'OpenStreetMap'} key/provider above by
          calling the provider once — <b>without saving</b>. Confirms the key is valid and
          the Places API is enabled. No search term needed.
        </p>

        {/* Result */}
        {testResult && (
          <div className={
            'rounded-lg border p-4 ' +
            (testResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')
          }>
            <div className="flex items-center gap-2">
              {testResult.ok
                ? <CheckCircle className="h-4 w-4 text-green-600" />
                : <XCircle className="h-4 w-4 text-red-600" />}
              <span className={'text-sm font-semibold ' + (testResult.ok ? 'text-green-800' : 'text-red-800')}>
                {testResult.ok
                  ? `API key valid — ${testResult.provider.toUpperCase()} responding`
                  : 'Key check failed'}
              </span>
            </div>

            {!testResult.ok && (
              <p className="mt-1.5 text-sm text-red-700 break-words">{testResult.error}</p>
            )}

            <pre className="mt-3 max-h-56 overflow-auto rounded bg-white/70 border border-gray-200 p-2 text-[11px] leading-relaxed text-gray-700">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
