export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
};

// Font families (loaded in App.js). Display = Bricolage Grotesque (handcrafted,
// irregular grotesque); body = Plus Jakarta Sans; data/prices/labels = JetBrains
// Mono. Matches the Stitch design system.
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodyRegular: 'PlusJakartaSans_400Regular',
  bodySemibold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  mono: 'JetBrainsMono_600SemiBold',
  monoSemibold: 'JetBrainsMono_700Bold',
};

export const type = {
  display: { fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontFamily: fonts.display, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontFamily: fonts.display, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontFamily: fonts.displayBold },
  body: { fontSize: 14, fontFamily: fonts.body },
  bodyBold: { fontSize: 14, fontFamily: fonts.bodyBold },
  small: { fontSize: 13, fontFamily: fonts.body },
  caption: { fontSize: 12, fontFamily: fonts.bodySemibold },
  // Prices / numeric data — JetBrains Mono, matches the design's price-lg / data-label.
  price: { fontSize: 20, fontFamily: fonts.monoSemibold, letterSpacing: -0.2 },
  dataLabel: { fontSize: 13, fontFamily: fonts.mono, letterSpacing: 0.4 },
  micro: { fontSize: 11, fontFamily: fonts.monoSemibold, letterSpacing: 0.4 },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.monoSemibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
