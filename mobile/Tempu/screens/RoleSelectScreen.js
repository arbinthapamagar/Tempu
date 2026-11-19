import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';
import { LANGUAGES, useLanguage } from '../context/LanguageContext';

// One tappable row per role: photo, what it is, chevron. The whole row is
// the button, so there's no separate CTA competing with the title.
function RoleCard({ image, title, desc, onPress, last }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, !last && styles.cardDivider, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Image source={image} style={styles.vehicle} resizeMode="contain" />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

function LanguagePicker({ visible, onClose }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.langBackdrop} onPress={onClose}>
        <Pressable style={styles.langSheet}>
          <Text style={styles.langTitle}>{t('lang.choose')}</Text>
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              style={[styles.langRow, lang === l.code && styles.langRowActive]}
              onPress={() => { setLang(l.code); onClose(); }}
            >
              <Text style={styles.langLabel}>{l.label}</Text>
              {lang === l.code && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function RoleSelectScreen({ onPassenger, onDriver, onSignIn, onContact }) {
  const { t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  return (
    <SafeAreaView style={styles.root}>
      {/* Top bar: wordmark + round action */}
      <View style={styles.header}>
        <Image source={require('../assets/logo-wordmark.png')} style={styles.brand} resizeMode="contain" />
        <Pressable style={styles.headerBtn} onPress={() => setLangOpen(true)} hitSlop={8}>
          <Ionicons name="language" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.title}>{t('role.title')}</Text>
          <Text style={styles.subtitle}>{t('role.subtitle')}</Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <RoleCard
            image={require('../assets/ev-scooter.png')}
            title={t('role.rideTitle')}
            desc={t('role.rideDesc')}
            onPress={onPassenger}
          />
          <RoleCard
            image={require('../assets/ev-tuktuk.png')}
            title={t('role.driveTitle')}
            desc={t('role.driveDesc')}
            onPress={onDriver}
            last
          />
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <View style={styles.signinRow}>
            <Text style={styles.footerText}>{t('role.haveAccount')}</Text>
            <Pressable onPress={onSignIn} hitSlop={8}>
              <Text style={styles.footerLink}>{t('role.signIn')}</Text>
            </Pressable>
          </View>

          {onContact && (
            <Pressable onPress={onContact} hitSlop={8} style={styles.contactRow}>
              <Ionicons name="headset" size={18} color={colors.textMuted} />
              <Text style={styles.contactText}>{t('role.contact')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Cards sit flat on hairline borders; shadows are kept for floating UI only.
const CARD_SHADOW = {};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  // logo-wordmark.png is 1266x358 (~3.5:1); keep that ratio or it shrinks.
  brand: {
    height: 44,
    width: 156,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  hero: { marginBottom: 24 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },

  cards: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 14,
    backgroundColor: colors.surface,
  },
  cardDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  vehicle: { width: 92, height: 64 },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  signinRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 16 },
  footerLink: { fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 16 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 32,
  },
  langSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  langTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.primary,
    padding: 8,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  langRowActive: { backgroundColor: colors.primarySoft },
  langLabel: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.primary },
  contactText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textMuted,
    fontSize: 14,
  },
});
