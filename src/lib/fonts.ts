export type FontSource = 'google' | 'system' | 'local'

export interface FontOption {
  id: string
  label: string
  /** CSS font-family value with fallbacks */
  cssFamily: string
  /** Which font-family name to use for preview (first in stack) */
  family: string
  source: FontSource
  /** Google Fonts param for URL building (e.g. EB+Garamond) — only for google */
  googleParam?: string
  note?: string
}

/**
 * Daftar font pilihan user — 16 font sesuai request + default Inter
 * Google fonts di-load via @import di src/index.css, system fonts pakai fallback OS.
 * Bell Centennial & Retina MicroPlus proprietary → butuh install lokal, kalau nggak ada fallback ke serif/sans.
 */
export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'eb-garamond',
    label: 'EB Garamond',
    family: 'EB Garamond',
    cssFamily: '"EB Garamond", Georgia, "Times New Roman", serif',
    source: 'google',
    googleParam: 'EB+Garamond:wght@400;600;700',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    family: 'Montserrat',
    cssFamily: 'Montserrat, Inter, ui-sans-serif, system-ui, sans-serif',
    source: 'google',
    googleParam: 'Montserrat:wght@400;500;600;700',
  },
  {
    id: 'lato',
    label: 'Lato',
    family: 'Lato',
    cssFamily: 'Lato, Inter, ui-sans-serif, sans-serif',
    source: 'google',
    googleParam: 'Lato:wght@400;700',
  },
  {
    id: 'times',
    label: 'Times New Roman',
    family: 'Times New Roman',
    cssFamily: '"Times New Roman", Times, Georgia, serif',
    source: 'system',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    family: 'Oswald',
    cssFamily: 'Oswald, Inter, ui-sans-serif, sans-serif',
    source: 'google',
    googleParam: 'Oswald:wght@400;600',
  },
  {
    id: 'calibri',
    label: 'Calibri',
    family: 'Calibri',
    cssFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
    source: 'system',
  },
  {
    id: 'palatino',
    label: 'Palatino',
    family: 'Palatino',
    cssFamily: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    source: 'system',
  },
  {
    id: 'noto-sans',
    label: 'Noto Sans',
    family: 'Noto Sans',
    cssFamily: '"Noto Sans", Inter, ui-sans-serif, sans-serif',
    source: 'google',
    googleParam: 'Noto+Sans:wght@400;600;700',
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    family: 'Open Sans',
    cssFamily: '"Open Sans", Inter, ui-sans-serif, sans-serif',
    source: 'google',
    googleParam: 'Open+Sans:wght@400;600;700',
  },
  {
    id: 'baskerville',
    label: 'Baskerville',
    family: 'Baskerville',
    cssFamily: 'Baskerville, "Libre Baskerville", "Times New Roman", serif',
    source: 'system',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    family: 'Roboto',
    cssFamily: 'Roboto, Inter, ui-sans-serif, sans-serif',
    source: 'google',
    googleParam: 'Roboto:wght@400;500;700',
  },
  {
    id: 'arial',
    label: 'Arial',
    family: 'Arial',
    cssFamily: 'Arial, Helvetica, ui-sans-serif, sans-serif',
    source: 'system',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    family: 'Merriweather',
    cssFamily: 'Merriweather, Georgia, serif',
    source: 'google',
    googleParam: 'Merriweather:wght@400;700',
  },
  {
    id: 'helvetica',
    label: 'Helvetica',
    family: 'Helvetica',
    cssFamily: 'Helvetica, Arial, ui-sans-serif, sans-serif',
    source: 'system',
  },
  {
    id: 'bell-centennial',
    label: 'Bell Centennial',
    family: 'Bell Centennial',
    cssFamily: '"Bell Centennial", "Bell Gothic", "Helvetica Neue", sans-serif',
    source: 'local',
    note: 'Butuh install lokal — proprietary (Bell Labs). Kalau belum ada, fallback ke Helvetica.',
  },
  {
    id: 'retina-microplus',
    label: 'Retina MicroPlus',
    family: 'Retina MicroPlus',
    cssFamily: '"Retina MicroPlus", "Inter", ui-sans-serif, sans-serif',
    source: 'local',
    note: 'Proprietary (Retina). Butuh file .otf/.woff lokal. Fallback ke Inter.',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    family: 'Georgia',
    cssFamily: 'Georgia, "Times New Roman", serif',
    source: 'system',
  },
]

export const DEFAULT_FONT_ID = '' // kosong = pakai default Inter dari @theme

export function getFontById(id: string): FontOption | undefined {
  for (let i = 0; i < FONT_OPTIONS.length; i++) if (FONT_OPTIONS[i].id === id) return FONT_OPTIONS[i]
  return undefined
}

export const FONT_STORAGE_KEY = 'taskapp_font'

export function applyFont(id: string): void {
  const opt = id ? getFontById(id) : undefined
  const family = opt ? opt.cssFamily : 'Inter, ui-sans-serif, system-ui, sans-serif'
  try {
    document.documentElement.style.setProperty('--font-sans', family)
    // Also set html font-family so even non-Tailwind places follow
    document.documentElement.style.fontFamily = family
    if (id) localStorage.setItem(FONT_STORAGE_KEY, id)
    else localStorage.removeItem(FONT_STORAGE_KEY)
  } catch {}
}

export function initFont(): string {
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY) || ''
    if (saved) applyFont(saved)
    return saved
  } catch { return '' }
}

/** Google Fonts URL gabungan untuk 8 font yang butuh load */
export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Noto+Sans:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Oswald:wght@400;600&family=Roboto:wght@400;500;700&display=swap'
