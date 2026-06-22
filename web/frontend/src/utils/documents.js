// Shared document helpers — used by the admin document queue and the driver
// document section so the list/table + PDF-aware preview behave identically.

export const isPdf = (url) => /\.pdf(\?|$)/i.test(url || '')

// Force-download a file rather than navigating to it. Cloudinary honours the
// `fl_attachment` delivery flag (works cross-origin, keeps the original name);
// any other URL falls back to the raw link.
export const downloadUrl = (url) => {
  if (!url) return url
  if (/res\.cloudinary\.com/.test(url) && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/fl_attachment/')
  }
  return url
}

export const DOC_TYPE_LABELS = {
  citizenship: 'Citizenship',
  driving_license: 'Driving License',
  police_clearance: 'Police Report',
  police_report: 'Police Report',
  vehicle_registration: 'Vehicle Registration',
  insurance: 'Insurance',
  bluebook: 'Bluebook',
  profile_photo: 'Profile Photo',
  vehicle_photo: 'Vehicle Photo',
}

export const docTypeLabel = (type) =>
  DOC_TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : '—')
