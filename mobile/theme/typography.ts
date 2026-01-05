import { scaleFont } from './scale';

export const fontFamilies = {
  regular: 'InterRegular',
  medium: 'InterMedium',
  semibold: 'InterSemiBold',
  bold: 'InterBold',
} as const;

const s = (n: number) => n;
const S = (n: number) => scaleFont(n);

export const typography = {
  label: {
    fontFamily: fontFamilies.medium,
    fontSize: s(14),
    lineHeight: s(20),
  },

  body: {
    fontFamily: fontFamilies.regular,
    fontSize: s(16),
    lineHeight: s(24),
  },
  bodyStrong: {
    fontFamily: fontFamilies.semibold,
    fontSize: s(16),
    lineHeight: s(24),
  },

  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: s(12),
    lineHeight: s(16),
  },

  h3: { fontFamily: fontFamilies.semibold, fontSize: s(18), lineHeight: s(26) },
  h2: { fontFamily: fontFamilies.bold, fontSize: S(22), lineHeight: S(30) },
  h1: { fontFamily: fontFamilies.bold, fontSize: S(26), lineHeight: S(34) },
} as const;

export type TextVariant = keyof typeof typography;
