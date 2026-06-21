import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

const VEHICLE_TYPES = [
  { id: 'tuktuk', label: 'Rickshaw', emoji: '🛺' },
  { id: 'scooter', label: 'Scooter', emoji: '🛵' },
  { id: 'taxi', label: 'Taxi', emoji: '🚕' },
  { id: 'tuktuk_delivery', label: 'Delivery', emoji: '📦' },
];

const DOCS = [
  { type: 'driving_license', label: 'Driving License', hint: 'Clear photo of your license (front)', required: true },
  { type: 'police_clearance', label: 'Police Clearance Report', hint: 'Official police clearance document', required: true },
  { type: 'vehicle_photo', label: 'Vehicle Photo', hint: 'Full photo of your vehicle', required: true },
  { type: 'vehicle_registration', label: 'Number Plate (Front)', hint: 'Clear photo of the front plate', required: true },
  { type: 'vehicle_plate_back', label: 'Number Plate (Back)', hint: 'Clear photo of the back plate', required: true },
  { type: 'citizenship', label: 'Citizenship', hint: 'Citizenship card or equivalent ID', required: false },
];

function DocUploadRow({ doc, uri, onPick, uploading }) {
  const uploaded = !!uri;
  return (
    <Pressable
      style={[styles.docRow, uploaded && styles.docRowDone]}
      onPress={onPick}
      disabled={uploading}
    >
      <View style={[styles.docIcon, uploaded && styles.docIconDone]}>
        {uploading ? (
          <ActivityIndicator size="small" color={uploaded ? '#fff' : colors.primary} />
        ) : (
          <Ionicons
            name={uploaded ? 'checkmark' : 'camera-outline'}
            size={18}
            color={uploaded ? '#fff' : colors.primary}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.docLabel}>{doc.label}</Text>
          {doc.required && <Text style={styles.docRequired}>Required</Text>}
        </View>
        <Text style={styles.docHint} numberOfLines={1}>
          {uploaded ? 'Uploaded' : doc.hint}
        </Text>
      </View>
      <Ionicons
        name={uploaded ? 'checkmark-circle' : 'cloud-upload-outline'}
        size={20}
        color={uploaded ? colors.primary : colors.textFaint}
      />
    </Pressable>
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
  const [uploads, setUploads] = useState({}); // { type: uri }
  const [uploading, setUploading] = useState({}); // { type: bool }
  const [uploadError, setUploadError] = useState('');
  const [finishing, setFinishing] = useState(false);

  const validateStep1 = () => {
    if (!vehicleType) return 'Please select your vehicle type.';
    if (!vehiclePlate.trim()) return 'Vehicle plate number is required.';
    if (!licenseNumber.trim()) return 'License number is required.';
    if (!licenseExpiry.trim()) return 'License expiry date is required (YYYY-MM-DD).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry.trim())) return 'Date format should be YYYY-MM-DD (e.g. 2027-06-30).';
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

  const pickAndUpload = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setUploading((u) => ({ ...u, [type]: true }));
    setUploadError('');
    try {
      await userApi.uploadDriverDocument(type, uri);
      setUploads((u) => ({ ...u, [type]: uri }));
    } catch (e) {
      setUploadError(`${type}: ${e.message || 'Upload failed'}`);
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
          <Text style={styles.brand}>Tempu</Text>
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
                      <Text style={styles.typeEmoji}>{v.emoji}</Text>
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
                onChangeText={setLicenseExpiry}
                placeholder="YYYY-MM-DD (e.g. 2027-06-30)"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                editable={!submitting}
              />
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
              <Ionicons name="information-circle-outline" size={18} color="#1a56db" />
              <Text style={styles.infoText}>
                Upload clear, readable photos. Your application will stay <Text style={{ fontWeight: '700' }}>under review</Text> until our admin approves it.
              </Text>
            </View>

            {DOCS.map((doc) => (
              <DocUploadRow
                key={doc.type}
                doc={doc}
                uri={uploads[doc.type]}
                uploading={!!uploading[doc.type]}
                onPick={() => pickAndUpload(doc.type)}
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
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header: { marginBottom: 28 },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
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
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  typeEmoji: { fontSize: 16 },
  typeLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  typeLabelSelected: { color: '#1a56db' },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 18,
  },
  infoText: { flex: 1, color: '#1a56db', fontSize: 13, lineHeight: 19 },

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
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
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
    color: '#9a6b1f',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  docHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },

  btn: {
    backgroundColor: '#1a56db',
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPressed: { backgroundColor: '#1447b8' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  backLink: { alignItems: 'center', paddingTop: 8 },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
});
