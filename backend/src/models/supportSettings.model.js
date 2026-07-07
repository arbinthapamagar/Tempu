import mongoose from 'mongoose';

// Global support capabilities - a single document (key:'global') that applies to
// ALL tickets/users. Text messages are always allowed; the rest are toggles.
// Calls are blocked by default; voice notes and documents are allowed.
const supportSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    voiceMessages: { type: Boolean, default: true },
    documents: { type: Boolean, default: true },
    audioCall: { type: Boolean, default: false },
    videoCall: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

export const SupportSettings = mongoose.model('SupportSettings', supportSettingsSchema);

// Get-or-create the singleton.
export async function getSupportSettings() {
  let doc = await SupportSettings.findOne({ key: 'global' });
  if (!doc) doc = await SupportSettings.create({ key: 'global' });
  return doc;
}
