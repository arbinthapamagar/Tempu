import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const formatDate = (date, fmt = 'MMM dd, yyyy') => {
  if (!date) return '—'
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, fmt)
  } catch {
    return '—'
  }
}

export const formatDateTime = (date) => formatDate(date, 'MMM dd, yyyy hh:mm a')

export const formatRelative = (date) => {
  if (!date) return '—'
  try {
    return formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, { addSuffix: true })
  } catch {
    return '—'
  }
}

export const formatCurrency = (amount, currency = 'NPR') => {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatNumber = (n) => {
  if (n == null) return '—'
  return new Intl.NumberFormat('en').format(n)
}

export const formatDistance = (km) => {
  if (km == null) return '—'
  return `${km.toFixed(1)} km`
}

export const formatDuration = (mins) => {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export const formatPhone = (phone) => {
  if (!phone) return '—'
  return phone.replace(/(\d{3})(\d{4})(\d{3})/, '+977 $1-$2-$3')
}
