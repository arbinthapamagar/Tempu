// Shared document helpers - used by the admin document queue and the driver
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

// Keep in step with backend/src/constants/documentTypes.js.
export const DOC_TYPE_LABELS = {
  driving_license: 'Driving License',
  bluebook: 'Blue Book',
  police_clearance: 'Police Clearance',
  citizenship: 'Citizenship',
  vehicle_front: 'Vehicle – Front',
  vehicle_back: 'Vehicle – Back',
  vehicle_left: 'Vehicle – Left side',
  vehicle_right: 'Vehicle – Right side',
  insurance: 'Insurance',
  profile_photo: 'Profile Photo',
  // older uploads
  vehicle_photo: 'Vehicle Photo',
  vehicle_registration: 'Vehicle Registration',
  vehicle_plate_back: 'Number Plate (Back)',
  police_report: 'Police Report',
}

// Order a driver's documents are shown and bundled in; the first block is what
// the app asks every driver for (REQUIRED_DOC_TYPES).
export const DOC_ORDER = Object.keys(DOC_TYPE_LABELS)
export const REQUIRED_DOC_TYPES = [
  'driving_license', 'bluebook', 'police_clearance',
  'vehicle_front', 'vehicle_back', 'vehicle_left', 'vehicle_right',
]

export const sortDocs = (docs = []) =>
  [...docs].sort((a, b) => {
    const ia = DOC_ORDER.indexOf(a.type), ib = DOC_ORDER.indexOf(b.type)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

// A PDF either by the stored mime type or, for older rows, by the URL.
export const isPdfDoc = (doc) => doc?.mimeType === 'application/pdf' || isPdf(doc?.fileUrl)

export const docTypeLabel = (type) =>
  DOC_TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : '-')
