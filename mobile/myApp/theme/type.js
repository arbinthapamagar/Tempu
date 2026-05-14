export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
};

export const type = {
  display: { fontSize: 28, fontWeight: weight.heavy, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: weight.heavy, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: weight.heavy, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: weight.bold },
  body: { fontSize: 14, fontWeight: weight.medium },
  bodyBold: { fontSize: 14, fontWeight: weight.bold },
  small: { fontSize: 13, fontWeight: weight.medium },
  caption: { fontSize: 12, fontWeight: weight.semibold },
  micro: { fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: weight.heavy,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
