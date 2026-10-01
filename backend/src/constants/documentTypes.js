// Driver document types — the single list the Document model, the driver
// upload endpoint and the admin tools agree on. The mobile app and admin panel
// carry the matching labels (mobile/Tempu/screens/DriverVehicleScreen.js DOCS,
// web/frontend/src/utils/documents.js DOC_TYPE_LABELS).
export const DOCUMENT_TYPES = [
    'driving_license',
    'bluebook', // vehicle registration book ("blue book")
    'police_clearance',
    'citizenship',
    'vehicle_front',
    'vehicle_back',
    'vehicle_left',
    'vehicle_right',
    'insurance',
    'profile_photo',
    // Older uploads still in the database; no longer requested by the app.
    'vehicle_photo',
    'vehicle_registration',
    'vehicle_plate_back',
];

// Accepted upload formats for documents: photos and PDF scans.
export const DOCUMENT_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
