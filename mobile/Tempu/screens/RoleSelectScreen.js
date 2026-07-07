import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';

function RoleCard({ icon, badge, title, desc, cta, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon} size={30} color={colors.primary} />
        </View>
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

export default function RoleSelectScreen({ onPassenger, onDriver, onSignIn, onContact }) {
  return (
    <SafeAreaView style={styles.root}>
      {/* Top bar: wordmark + round action */}
      <View style={styles.header}>
        <Text style={styles.brand}>Tempu</Text>
        <View style={styles.headerBtn}>
          <Ionicons name="language" size={20} color={colors.textMuted} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.title}>How would you like to use Tempu?</Text>
          <Text style={styles.subtitle}>
            Join Nepal's smartest urban transport ecosystem.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <RoleCard
            icon="rickshaw"
            badge="POPULAR"
            title="I need a ride"
            desc="Request a safe, fast trip through the city with vetted local drivers."
            cta="Get Started as Rider"
            onPress={onPassenger}
          />
          <RoleCard
            icon="car"
            title="I want to drive"
            desc="Earn more on your own schedule. Join our fleet of electric and eco-friendly vehicles."
            cta="Apply to Drive"
            onPress={onDriver}
          />
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <View style={styles.signinRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={onSignIn} hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>

          {onContact && (
            <Pressable onPress={onContact} hitSlop={8} style={styles.contactRow}>
              <Ionicons name="headset" size={18} color={colors.textMuted} />
              <Text style={styles.contactText}>Contact support</Text>
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
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: colors.primary,
    letterSpacing: -0.3,
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
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
  contactText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textMuted,
    fontSize: 14,
  },
});
