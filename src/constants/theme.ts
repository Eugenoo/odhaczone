// Design tokens taken from the Figma file "TODO" (pages: Design, Components).

export const Colors = {
  background: '#F8F8F8',
  desktopBackdrop: '#ECECEC',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#797676',
  textDone: '#7E7D7D',
  strike: '#878585',
  checkboxFill: '#F5F5F5',
  checkboxBorder: '#797676',
  accent: '#A7C957',
  muted: '#D9D9D9',
  danger: '#FF383C',
  dashed: '#D8D5E6',
  dashedFill: '#F4F4F4',
  allTasks: '#000000',
} as const;

/** Each list has a strong colour (dot, title) and a light one (card, task tag). */
export const ListColors = {
  purple: { strong: '#9B88FF', light: '#E6DEFF' },
  green: { strong: '#A7C957', light: '#D3DEB9' },
  orange: { strong: '#F2A65A', light: '#FCE3CB' },
  blue: { strong: '#5FA8D3', light: '#D4E9F5' },
  pink: { strong: '#E07A9B', light: '#F8D9E3' },
} as const;

export type ListColor = keyof typeof ListColors;

export const Fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Layout = {
  /** Width of the Figma frames; the app is a centered column of at most this size on desktop. */
  maxWidth: 420,
  screenPadding: 20,
  navBarHeight: 55,
  navBarSideInset: 8,
  navBarBottomInset: 19,
  /** Extra px the nav bar floats above the bottom edge / home indicator. */
  navBarLift: 12,
  mainButtonSize: 50,
} as const;
