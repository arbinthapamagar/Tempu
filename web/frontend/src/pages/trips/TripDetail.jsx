import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, User, Car, CreditCard, Clock, Navigation } from '@/components/ui/icons'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Avatar } from '../../components/ui/Avatar'
import { TableSpinner } from '../../components/ui/Spinner'
import { tripsApi } from '../../api/trips.api'
import { formatDate, formatDateTime, formatCurrency, formatDistance, formatDuration } from '../../utils/format'

function InfoCard({ title, icon: Icon, children, color = 'indigo' }) {
  const colors = { indigo: 'text-orange-600 bg-orange-50', emerald: 'text-emerald-600 bg-emerald-50', amber: 'text-amber-600 bg-amber-50', blue: 'text-orange-600 bg-orange-50' }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className={`rounded-lg p-1.5 ${colors[color]}`}><Icon className="h-4 w-4" /></div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || '-'}</p>
    </div>
  )
}

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: tripRes, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripsApi.get(id),
  })

  const { data: bidsRes } = useQuery({
    queryKey: ['trip-bids', id],
    queryFn: () => tripsApi.bids(id),
  })

  const trip = tripRes?.data
  const bids = bidsRes?.data || []

  if (isLoading) return <TableSpinner />
  if (!trip) return <div className="p-4 text-gray-500">Trip not found.</div>

  const rider = trip.userId
  const driver = trip.driverId

  const timeline = [
    { label: 'Trip Created', time: trip.createdAt, done: true },
    { label: 'Bid Accepted', time: trip.acceptedAt, done: !!trip.acceptedAt },
    { label: 'Driver En Route', time: trip.acceptedAt, done: ['arriving', 'started', 'completed'].includes(trip.status) },
    { label: 'Trip Started', time: trip.startedAt, done: !!trip.startedAt },
    { label: 'Trip Completed', time: trip.completedAt, done: !!trip.completedAt },
    trip.status === 'cancelled' && { label: 'Cancelled', time: trip.cancelledAt, done: true, cancel: true },
  ].filter(Boolean)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Trips
        </button>
        <StatusBadge status={trip.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Route */}
        <InfoCard title="Route Details" icon={Navigation} color="indigo" className="lg:col-span-1">
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <div className="mt-0.5"><div className="h-3 w-3 rounded-full bg-emerald-500" /></div>
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p className="text-sm text-gray-800 font-medium">{trip.pickup?.address}</p>
              </div>
            </div>
            <div className="ml-1 h-8 border-l-2 border-dashed border-gray-200" />
            <div className="flex gap-3 items-start">
              <div className="mt-0.5"><div className="h-3 w-3 rounded-full bg-red-500" /></div>
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p className="text-sm text-gray-800 font-medium">{trip.dropoff?.address}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
            <div className="text-center">
              <p className="text-xs text-gray-400">Distance</p>
              <p className="text-sm font-bold text-gray-800">{formatDistance(trip.distance)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Duration</p>
              <p className="text-sm font-bold text-gray-800">{formatDuration(trip.duration)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Vehicle</p>
              <p className="text-sm font-bold text-gray-800 capitalize">{trip.vehicleType}</p>
            </div>
          </div>
        </InfoCard>

        {/* Rider */}
        <InfoCard title="Rider" icon={User} color="blue">
          {rider ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar src={rider.avatarUrl} name={rider.name} size="md" />
                <div>
                  <p className="font-semibold text-gray-900">{rider.name}</p>
                  <p className="text-sm text-gray-500">{rider.phone}</p>
                </div>
              </div>
              <Field label="Rating" value={`${rider.rating?.average?.toFixed(1) || '-'} / 5.0`} />
              <Field label="User Type" value={rider.userType} />
            </div>
          ) : <p className="text-sm text-gray-400">No rider info</p>}
        </InfoCard>

        {/* Driver */}
        <InfoCard title="Driver" icon={Car} color="emerald">
          {driver ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar src={driver.userId?.avatarUrl} name={driver.userId?.name} size="md" />
                <div>
                  <p className="font-semibold text-gray-900">{driver.userId?.name}</p>
                  <p className="text-sm text-gray-500">{driver.userId?.phone}</p>
                </div>
              </div>
              <Field label="Vehicle" value={`${driver.vehicleModel || ''} ${driver.vehiclePlate}`} />
              <Field label="Rating" value={`${driver.rating?.toFixed(1) || '-'} / 5.0`} />
            </div>
          ) : <p className="text-sm text-gray-400 italic">No driver assigned</p>}
        </InfoCard>

        {/* Payment */}
        <InfoCard title="Payment Details" icon={CreditCard} color="amber">
          <Field label="Offered Price" value={formatCurrency(trip.offeredPrice)} />
          <Field label="Final Price" value={formatCurrency(trip.finalPrice)} />
          <Field label="Platform Fee" value={formatCurrency(trip.platformFee)} />
          <Field label="Payment Method" value={trip.paymentMethod} />
          <Field label="Payment Status" value={<StatusBadge status={trip.paymentStatus} />} />
        </InfoCard>

        {/* Timeline */}
        <InfoCard title="Trip Timeline" icon={Clock} color="indigo">
          <div className="space-y-3">
            {timeline.map((event, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className={`mt-0.5 h-3 w-3 rounded-full shrink-0 ${event.done ? (event.cancel ? 'bg-red-500' : 'bg-orange-600') : 'bg-gray-200'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${event.done ? 'text-gray-900' : 'text-gray-400'}`}>{event.label}</p>
                  {event.time && <p className="text-xs text-gray-400">{formatDateTime(event.time)}</p>}
                </div>
              </div>
            ))}
          </div>
          {trip.cancelReason && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600 font-medium">Cancel Reason: {trip.cancelReason}</p>
              {trip.cancelledBy && <p className="text-xs text-red-400">By: {trip.cancelledBy}</p>}
            </div>
          )}
        </InfoCard>

        {/* Bids */}
        {bids.length > 0 && (
          <div className="lg:col-span-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Bids Received ({bids.length})</h3>
            <div className="space-y-3">
              {bids.map((bid) => (
                <div key={bid._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{bid.driverId?.userId?.name || '-'}</p>
                    <p className="text-xs text-gray-400">{bid.message || 'No message'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">{formatCurrency(bid.amount)}</p>
                    <StatusBadge status={bid.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
