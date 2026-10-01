import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME } from '../constants/documentTypes.js';

const TEMP_DIR = './public/temp';

// Ensure the upload dir exists (multer/diskStorage does NOT create it and will
// otherwise fail with ENOENT on a fresh checkout). Created once at startup and
// defensively per-request.
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    cb(null, TEMP_DIR);
  },
  filename: function (req, file, cb) {
    // Prefix with a timestamp so concurrent uploads of the same filename don't clobber each other.
    const safe = (file.originalname || 'upload').replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

export const upload = multer({ storage });

// Driver documents: photos or PDF scans only, up to 10 MB.
export const uploadDocument = multer({
  storage,
  limits: { fileSize: DOCUMENT_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (DOCUMENT_MIME.test(file.mimetype)) return cb(null, true);
    const err = new Error('Upload a photo (JPG, PNG) or a PDF file');
    err.statusCode = 400;
    cb(err);
  },
});
