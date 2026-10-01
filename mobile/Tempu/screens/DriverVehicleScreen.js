import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import { describeDateInput, formatDateInput, parseDateInput } from '../utils/dateInput';

const VEHICLE_TYPES = [
  { id: 'tuktuk', label: 'Tempu', img: require('../assets/ev-tuktuk.png') },
  { id: 'scooter', label: 'Scooter', img: require('../assets/ev-scooter.png') },
  { id: 'tuktuk_delivery', label: 'Delivery', img: require('../assets/ev-delivery.png') },
];

// What a driver sends. Types match backend/src/constants/documentTypes.js;
// every item can be a photo or a PDF scan (handy for a multi-page blue book).
const DOCS = [
  { type: 'driving_license', label: 'Driving License', hint: 'Front of your licence', icon: 'card-outline', required: true },
  { type: 'bluebook', label: 'Blue Book', hint: 'Vehicle registration book — a PDF of all pages is fine', icon: 'book-outline', required: true },
  { type: 'police_clearance', label: 'Police Clearance', hint: 'Official police clearance report', icon: 'shield-checkmark-outline', required: true },
  { type: 'vehicle_front', label: 'Vehicle — Front', hint: 'Whole vehicle, number plate visible', icon: 'car-outline', required: true },
  { type: 'vehicle_back', label: 'Vehicle — Back', hint: 'Whole vehicle, back plate visible', icon: 'car-outline', required: true },
  { type: 'vehicle_left', label: 'Vehicle — Left side', hint: 'Full left side of the vehicle', icon: 'car-outline', required: true },
  { type: 'vehicle_right', label: 'Vehicle — Right side', hint: 'Full right side of the vehicle', icon: 'car-outline', required: true },
  { type: 'citizenship', label: 'Citizenship', hint: 'Citizenship card or equivalent ID', icon: 'person-outline', required: false },
  { type: 'insurance', label: 'Insurance', hint: 'Vehicle insurance paper', icon: 'document-text-outline', required: false },
];

const MAX_BYTES = 10 * 1024 * 1024; // matches the backend limit

// One document. Tap to choose a photo or a PDF; once uploaded it says so, and
// offers a preview (collapsed by default so the list stays short) and Replace.
function DocUploadRow({ doc, file, onPick, uploading }) {
  const uploaded = !!file;
  const isPdf = file?.mimeType === 'application/pdf';
  const [showPreview, setShowPreview] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const pick = (kind) => { setChoosing(false); onPick(kind); };

  return (
    <View style={[styles.docRow, styles.docCard, uploaded && styles.docRowDone]}>
      <Pressable style={styles.docMain} onPress={() => setChoosing((v) => !v)} disabled={uploading}>
        <View style={[styles.docIcon, uploaded && styles.docIconDone]}>
          {uploading ? (
            <ActivityIndicator size="small" color={uploaded ? '#fff' : colors.primary} />
          ) : (
            <Ionicons
              name={uploaded ? 'checkmark' : doc.icon}
              size={18}
              color={uploaded ? '#fff' : colors.primary}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.docLabel}>{doc.label}</Text>
            {doc.required && !uploaded && <Text style={styles.docRequired}>Required</Text>}
          </View>
          <Text style={[styles.docHint, uploaded && styles.docHintDone]} numberOfLines={1}>
            {uploading ? 'Uploading…' : uploaded ? `Uploaded${isPdf ? ' · PDF' : ''}` : doc.hint}
          </Text>
        </View>
        <Ionicons
          name={uploaded ? 'checkmark-circle' : 'cloud-upload-outline'}
          size={20}
          color={uploaded ? colors.primary : colors.textFaint}
        />
      </Pressable>

      {choosing && !uploading && (
        <View style={styles.pickRow}>
          <Pressable style={styles.pickBtn} onPress={() => pick('photo')}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={styles.pickText}>Photo</Text>
          </Pressable>
          <Pressable style={styles.pickBtn} onPress={() => pick('pdf')}>
            <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
            <Text style={styles.pickText}>PDF file</Text>
          </Pressable>
        </View>
      )}

      {uploaded && !uploading && !choosing && (
        <>
          <View style={styles.docActions}>
            <Pressable style={styles.docAction} onPress={() => setShowPreview((v) => !v)} hitSlop={6}>
              <Ionicons name={showPreview ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.primary} />
              <Text style={styles.docActionText}>{showPreview ? 'Hide preview' : 'Preview'}</Text>
            </Pressable>
            <Pressable style={styles.docAction} onPress={() => setChoosing(true)} hitSlop={6}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.docActionText}>Replace</Text>
            </Pressable>
          </View>
          {showPreview && (isPdf ? (
            <Pressable style={styles.pdfPreview} onPress={() => Linking.openURL(file.uri).catch(() => {})}>
              <Ionicons name="document-text" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pdfName} numberOfLines={1}>{file.name || 'document.pdf'}</Text>
                <Text style={styles.pdfSub}>PDF · tap to open</Text>
              </View>
            </Pressable>
          ) : (
            <Image source={{ uri: file.uri }} style={styles.docPreview} resizeMode="contain" />
          ))}
        </>
      )}
    </View>
  );
}

export default function DriverVehicleScreen({ onSuccess, onBack }) {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 2 fields
  const [uploads, setUploads] = useState({}); // { type: { uri, name, mimeType } }
  const [uploading, setUploading] = useState({}); // { type: bool }
  const [uploadError, setUploadError] = useState('');
  const [finishing, setFinishing] = useState(false);

  const licenseExpired = (() => {
    const expiry = parseDateInput(licenseExpiry);
    if (!expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
  })();

  const validateStep1 = () => {
    if (!vehicleType) return 'Please select your vehicle type.';
    if (!vehiclePlate.trim()) return 'Vehicle plate number is required.';
    if (!licenseNumber.trim()) return 'License number is required.';
    if (!licenseExpiry.trim()) return 'License expiry date is required (YYYY-MM-DD).';
    if (!parseDateInput(licenseExpiry)) return 'Enter a real date as YYYY-MM-DD (e.g. 2027-06-30).';
    // An expired licence is a warning, not a block: the admin reviews every
    // application anyway (see licenseExpired below).
    return '';
  };

  const handleStep1 = async () => {
    setError('');
    const err = validateStep1();
    if (err) { setError(err); return; }
    setSubmitting(true);
    try {
      await userApi.registerAsDriver({
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim() || undefined,
        vehicleColor: vehicleColor.trim() || undefined,
        vehicleYear: vehicleYear.trim() || undefined,
        licenseNumber: licenseNumber.trim(),
        licenseExpiry: licenseExpiry.trim(),
      });
      setStep(2);
    } catch (e) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickAndUpload = async (type, kind = 'photo') => {
    let file = null;
    if (kind === 'pdf') {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      file = { uri: a.uri, name: a.name || 'document.pdf', mimeType: 'application/pdf', size: a.size };
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const a = res.assets[0];
      file = { uri: a.uri, name: a.fileName || 'document.jpg', mimeType: a.mimeType || 'image/jpeg', size: a.fileSize };
    }
    const label = DOCS.find((d) => d.type === type)?.label || type;
    if (file.size && file.size > MAX_BYTES) {
      setUploadError(`${label}: file is too large (max 10 MB).`);
      return;
    }
    setUploading((u) => ({ ...u, [type]: true }));
    setUploadError('');
    try {
      await userApi.uploadDriverDocument(type, file);
      setUploads((u) => ({ ...u, [type]: file }));
    } catch (e) {
      setUploadError(`${label}: ${e.message || 'Upload failed'}`);
    } finally {
      setUploading((u) => ({ ...u, [type]: false }));
    }
  };

  const handleFinish = () => {
    const missing = DOCS.filter((d) => d.required && !uploads[d.type]);
    if (missing.length > 0) {
      setUploadError(`Please upload: ${missing.map((d) => d.label).join(', ')}`);
      return;
    }
    setFinishing(true);
    onSuccess();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../assets/logo-wordmark.png')} style={styles.brand} resizeMode="contain" />
          <View style={styles.steps}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepLine, step >= 2 && styles.stepLineFill]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
          </View>
          <Text style={styles.title}>
            {step === 1 ? 'Vehicle & License' : 'Upload Documents'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Tell us about your vehicle. Step 1 of 2.'
              : 'Upload clear photos of each document. Your application will be reviewed by our team.'}
          </Text>
        </View>

        {/* STEP 1 */}
        {step === 1 && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Vehicle type</Text>
              <View style={styles.typeGrid}>
                {VEHICLE_TYPES.map((v) => {
                  const sel = vehicleType === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setVehicleType(v.id)}
                      style={[styles.typeChip, sel && styles.typeChipSelected]}
                    >
                      {sel && (
                        <View style={styles.typeCheck}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                      <Image source={v.img} style={styles.typeImg} resizeMode="contain" />
                      <Text style={[styles.typeLabel, sel && styles.typeLabelSelected]}>
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vehicle plate number</Text>
              <TextInput
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                placeholder="e.g. BA 1 PA 1234"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                autoCapitalize="characters"
                editable={!submitting}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Model <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="e.g. Honda Activa"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  editable={!submitting}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Color <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  value={vehicleColor}
                  onChangeText={setVehicleColor}
                  placeholder="e.g. Red"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vehicle year <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                value={vehicleYear}
                onChangeText={setVehicleYear}
                placeholder="e.g. 2021"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={styles.input}
                maxLength={4}
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Driving license number</Text>
              <TextInput
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="e.g. 01-01-0123456"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                autoCapitalize="characters"
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>License expiry date</Text>
              <TextInput
                value={licenseExpiry}
                onChangeText={(t) => { setLicenseExpiry(formatDateInput(t)); setError(''); }}
                placeholder="YYYY-MM-DD (e.g. 2027-06-30)"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={10}
                editable={!submitting}
              />
              {describeDateInput(licenseExpiry) ? (
                <Text style={styles.dateHint}>
                  {licenseExpired ? 'Expired' : 'Expires'} {describeDateInput(licenseExpiry)}
                </Text>
              ) : null}
              {licenseExpired && (
                <View style={styles.warnBox}>
                  <Ionicons name="warning-outline" size={16} color="#b45309" />
                  <Text style={styles.warnText}>
                    This date is in the past. You can continue, but our team may ask you to renew your licence before approval.
                  </Text>
                </View>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                pressed && styles.btnPressed,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleStep1}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Next: Upload documents →</Text>
              }
            </Pressable>
          </View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <View style={styles.form}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>
                Upload clear, readable photos. Your application will stay <Text style={{ fontWeight: '700' }}>under review</Text> until our admin approves it.
              </Text>
            </View>

            {DOCS.map((doc) => (
              <DocUploadRow
                key={doc.type}
                doc={doc}
                file={uploads[doc.type]}
                uploading={!!uploading[doc.type]}
                onPick={(kind) => pickAndUpload(doc.type, kind)}
              />
            ))}

            {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                pressed && styles.btnPressed,
                finishing && styles.btnDisabled,
              ]}
              onPress={handleFinish}
              disabled={finishing}
            >
              {finishing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Submit application</Text>
              }
            </Pressable>
          </View>
        )}

        <Pressable style={styles.backLink} onPress={step === 2 ? () => setStep(1) : onBack} hitSlop={8}>
          <Text style={styles.backLinkText}>← {step === 2 ? 'Back to vehicle info' : 'Go back'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  docCard: { flexDirection: 'column', alignItems: 'stretch' },
  docMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docHintDone: { color: colors.primary, fontWeight: '600' },
  docActions: { flexDirection: 'row', gap: 20, marginTop: 10, paddingLeft: 48 },
  docAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docActionText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pickText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  pdfPreview: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, backgroundColor: colors.surfaceMuted || '#f2f2f2',
  },
  pdfName: { fontSize: 14, fontWeight: '700', color: colors.text },
  pdfSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  docPreview: { marginTop: 10, width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.surfaceMuted || '#f2f2f2' },
  dateHint: { marginTop: 6, fontSize: 13, color: colors.textMuted },
  warnBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 8, padding: 10, borderRadius: 12,
    backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a',
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#92400e' },
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header: { marginBottom: 28 },
  // logo-wordmark.png is 1266x358 (~3.5:1), same size as the other auth screens.
  brand: {
    height: 44,
    width: 156,
    marginBottom: 16,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 0,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  stepLineFill: { backgroundColor: colors.primary },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },

  form: { marginBottom: 16 },
  field: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  optional: { color: colors.textFaint, fontWeight: '400' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Same EV artwork as the rider's Home service cards.
  typeChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeImg: { width: 64, height: 56 },
  typeCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  typeLabelSelected: { color: colors.primary },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 18,
  },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  docRowDone: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconDone: { backgroundColor: colors.primary },
  docLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  docRequired: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  docHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },

  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPressed: { backgroundColor: colors.primaryDark },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  backLink: { alignItems: 'center', paddingTop: 8 },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
});
