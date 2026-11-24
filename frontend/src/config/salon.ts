interface SalonTheme {
  charcoal: string;
  charcoalDeep: string;
  charcoalRaised: string;
  gold: string;
  goldLight: string;
  cream: string;
}

function readHexColor(value: string | undefined, fallback: string, setting: string): string {
  const color = value?.trim() || fallback;
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    throw new Error(`${setting} must be a 3- or 6-digit hex color.`);
  }
  return color;
}

function hexToRgbChannels(color: string): string {
  const hex = color.slice(1);
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : hex;
  const channels = expanded.match(/.{2}/g);
  if (!channels || channels.length !== 3) {
    throw new Error('Salon theme colors must be valid hexadecimal colors.');
  }
  return channels.map((channel) => String(parseInt(channel, 16))).join(' ');
}

const theme: SalonTheme = {
  charcoal: readHexColor(
    import.meta.env.VITE_SALON_THEME_CHARCOAL,
    '#171716',
    'VITE_SALON_THEME_CHARCOAL',
  ),
  charcoalDeep: readHexColor(
    import.meta.env.VITE_SALON_THEME_CHARCOAL_DEEP,
    '#111110',
    'VITE_SALON_THEME_CHARCOAL_DEEP',
  ),
  charcoalRaised: readHexColor(
    import.meta.env.VITE_SALON_THEME_CHARCOAL_RAISED,
    '#201f1c',
    'VITE_SALON_THEME_CHARCOAL_RAISED',
  ),
  gold: readHexColor(
    import.meta.env.VITE_SALON_THEME_GOLD,
    '#c6a66a',
    'VITE_SALON_THEME_GOLD',
  ),
  goldLight: readHexColor(
    import.meta.env.VITE_SALON_THEME_GOLD_LIGHT,
    '#e4cf9f',
    'VITE_SALON_THEME_GOLD_LIGHT',
  ),
  cream: readHexColor(
    import.meta.env.VITE_SALON_THEME_CREAM,
    '#f2eee5',
    'VITE_SALON_THEME_CREAM',
  ),
};

export const salonConfig = Object.freeze({
  name: import.meta.env.VITE_SALON_NAME?.trim() || 'Salon',
  logoUrl: import.meta.env.VITE_SALON_LOGO_URL?.trim() || null,
  address: import.meta.env.VITE_SALON_ADDRESS?.trim() || null,
  contactNumber: import.meta.env.VITE_SALON_CONTACT_NUMBER?.trim() || null,
  theme: Object.freeze(theme),
});

export const salonThemeCssVariables = Object.freeze({
  '--salon-charcoal-rgb': hexToRgbChannels(theme.charcoal),
  '--salon-charcoal-deep-rgb': hexToRgbChannels(theme.charcoalDeep),
  '--salon-charcoal-raised-rgb': hexToRgbChannels(theme.charcoalRaised),
  '--salon-gold-rgb': hexToRgbChannels(theme.gold),
  '--salon-gold-light-rgb': hexToRgbChannels(theme.goldLight),
  '--salon-cream-rgb': hexToRgbChannels(theme.cream),
});
