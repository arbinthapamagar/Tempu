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

function RoleCard({ image, badge, title, desc, cta, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <Image source={image} style={styles.vehicle} resizeMode="contain" />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
      <View style={styles.cardBtn}>
        <Text style={styles.cardBtnText}>{cta}</Text>
      </View>
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
            cta={t('role.rideCta')}
            onPress={onPassenger}
          />
          <RoleCard
            image={require('../assets/ev-tuktuk.png')}
            badge={t('role.popular')}
            title={t('role.driveTitle')}
            desc={t('role.driveDesc')}
            cta={t('role.driveCta')}
            onPress={onDriver}
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

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 24,
  elevation: 3,
};

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

  hero: { marginBottom: 40 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 40,
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

  cards: { gap: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...CARD_SHADOW,
  },
  cardPressed: { transform: [{ scale: 0.98 }] },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vehicle: {
    width: 96,
    height: 80,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.primary,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 24,
  },
  cardBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  cardBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#ffffff',
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
    borderRadius: 20,
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
