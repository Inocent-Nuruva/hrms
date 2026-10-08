export const PROFILE_CARD_PALETTES = [
  { id: 'alliance-navy', label: 'Midnight Crest', color: '#1E2A6E' },
  { id: 'alliance-royal', label: 'Regal Iris', color: '#2B3A8D' },
  { id: 'alliance-red', label: 'Emberglass', color: '#EB3239' },
  { id: 'alliance-gold', label: 'Gilded Hour', color: '#E8B44A' },
  { id: 'alliance-cloud', label: 'Porcelain Mist', color: '#F3F5FB' },
  { id: 'alliance-blue', label: 'Blue Horizon', color: '#1F6FEB' },
  { id: 'tomato', label: 'Vermilion', color: '#FF6347' },
  { id: 'ocean', label: 'Ocean', color: '#0877B9' },
  { id: 'forest', label: 'Forest', color: '#08785C' },
  { id: 'plum', label: 'Plum', color: '#6845A8' },
  { id: 'coral', label: 'Coral', color: '#B84F3E' },
  { id: 'midnight', label: 'Midnight', color: '#334155' },
  { id: 'berry', label: 'Berry', color: '#A33F69' },
  { id: 'neutral', label: 'Neutral', color: '#64748B' },
  { id: 'white', label: 'Dynamic', color: '#FFFFFF' },
] as const;

export const PROFILE_CARD_ARTWORKS = [
  { id: 'none', label: 'None' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'waves', label: 'Waves' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'arches', label: 'Arches' },
  { id: 'sprigs', label: 'Sprigs' },
] as const;

export type ProfileCardPaletteId = (typeof PROFILE_CARD_PALETTES)[number]['id'];
export type ProfileCardArtworkId = (typeof PROFILE_CARD_ARTWORKS)[number]['id'];
export type ProfileCardStyle = {
  palette: ProfileCardPaletteId;
  artwork: ProfileCardArtworkId;
};

export const DEFAULT_PROFILE_CARD_STYLE: ProfileCardStyle = {
  palette: 'ocean',
  artwork: 'waves',
};

export function profilePaletteAccent(paletteId: string, isDark = false): string {
  if (paletteId === 'white') return isDark ? '#475569' : '#0877B9';
  return PROFILE_CARD_PALETTES.find((item) => item.id === paletteId)?.color ?? '#0078D4';
}

export function profilePaletteColor(paletteId: string, isDark = false): string {
  if (paletteId === 'white' && isDark) return '#181818';
  return PROFILE_CARD_PALETTES.find((item) => item.id === paletteId)?.color ?? PROFILE_CARD_PALETTES[0].color;
}

export function profilePaletteForeground(color: string): string {
  const value = Number.parseInt(color.replace('#', ''), 16);
  if (!Number.isFinite(value)) return '#FFFFFF';
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#111111';
}

export function profilePaletteContainer(color: string, isDark = false): string {
  const value = Number.parseInt(color.replace('#', ''), 16);
  if (!Number.isFinite(value)) return isDark ? '#252B32' : '#F3F5FB';
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const base = isDark ? 24 : 255;
  const accentWeight = isDark ? 0.32 : 0.12;
  return `#${channels.map((channel) => Math.round(base * (1 - accentWeight) + channel * accentWeight).toString(16).padStart(2, '0')).join('')}`;
}

export function normalizeProfileCardStyle(value: unknown): ProfileCardStyle {
  if (!value || typeof value !== 'object') return DEFAULT_PROFILE_CARD_STYLE;
  const style = value as Partial<ProfileCardStyle>;
  const palette = PROFILE_CARD_PALETTES.find((item) => item.id === style.palette);
  const artwork = PROFILE_CARD_ARTWORKS.find((item) => item.id === style.artwork);
  return palette && artwork
    ? { palette: palette.id, artwork: artwork.id }
    : DEFAULT_PROFILE_CARD_STYLE;
}
