import multer from 'multer';
import fs from 'fs';
import path from 'path';

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
