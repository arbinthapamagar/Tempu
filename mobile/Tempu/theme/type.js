export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
};

// Font families (loaded in App.js). Display = Bricolage Grotesque (handcrafted,
// irregular grotesque); body = Hanken Grotesk; data/labels = Spline Sans Mono.
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'HankenGrotesk_500Medium',
  bodyRegular: 'HankenGrotesk_400Regular',
  bodySemibold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
  mono: 'SplineSansMono_500Medium',
  monoSemibold: 'SplineSansMono_600SemiBold',
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
  micro: { fontSize: 11, fontFamily: fonts.monoSemibold, letterSpacing: 0.4 },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.monoSemibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
