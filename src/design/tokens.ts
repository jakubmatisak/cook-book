import type { ColorScheme } from '@shared/userSettings'

/**
 * Farebné schémy aplikácie (každá svetlá aj tmavá). Človek si ju vyberá v Nastaveniach, predvolená je Šalvia
 * a horčica. Vzhľad komponentov je v src/plugins/vuetify.ts, tvary v src/design/settings.scss.
 * `success` je farba odznaku Overený a potvrdení, `secondary` doplnková farba schémy.
 */
export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  'surface-variant': string
  'on-surface-variant': string
  'on-background': string
  'on-surface': string
  error: string
  success: string
  warning: string
  info: string
}

const scheme = (
  light: Omit<ThemeColors, 'on-surface' | 'info'> & { info?: string },
  dark: Omit<ThemeColors, 'on-surface' | 'info'> & { info?: string },
): { light: ThemeColors; dark: ThemeColors } => ({
  light: { info: '#36677F', ...light, 'on-surface': light['on-background'] },
  dark: { info: '#8EC1DA', ...dark, 'on-surface': dark['on-background'] },
})

export const schemes: Readonly<Record<ColorScheme, { light: ThemeColors; dark: ThemeColors }>> = {
  'salvia-horcica': scheme(
    {
      primary: '#577A54',
      secondary: '#D9A22E',
      background: '#F8F7F0',
      surface: '#FFFFFF',
      'surface-variant': '#ECEBDF',
      'on-surface-variant': '#3E473A',
      'on-background': '#22261E',
      error: '#B3261E',
      success: '#D9A22E',
      warning: '#B5651D',
    },
    {
      primary: '#A4C49E',
      secondary: '#E2B95A',
      background: '#161915',
      surface: '#1F231D',
      'surface-variant': '#2C312A',
      'on-surface-variant': '#DDE3D6',
      'on-background': '#ECEEE6',
      error: '#F2B8B5',
      success: '#E2B95A',
      warning: '#F0A060',
    },
  ),
  'salvia-terakota': scheme(
    {
      primary: '#567A5F',
      secondary: '#B4532A',
      background: '#F7F4EC',
      surface: '#FFFDF8',
      'surface-variant': '#E9E5D8',
      'on-surface-variant': '#3F4A3E',
      'on-background': '#23281F',
      error: '#B3261E',
      success: '#B4532A',
      warning: '#9A6417',
    },
    {
      primary: '#9CC3A3',
      secondary: '#E48A62',
      background: '#171A16',
      surface: '#20241F',
      'surface-variant': '#2D332C',
      'on-surface-variant': '#DCE3D8',
      'on-background': '#ECEEE6',
      error: '#F2B8B5',
      success: '#E48A62',
      warning: '#E8B866',
    },
  ),
  eukalyptus: scheme(
    {
      primary: '#3E6B5A',
      secondary: '#6E4E7A',
      background: '#F3F5F2',
      surface: '#FFFFFF',
      'surface-variant': '#E1E9E4',
      'on-surface-variant': '#33443D',
      'on-background': '#1D2522',
      error: '#B3261E',
      success: '#6E4E7A',
      warning: '#B0461C',
    },
    {
      primary: '#7FB8A2',
      secondary: '#C3A6D6',
      background: '#121815',
      surface: '#1A211D',
      'surface-variant': '#26302B',
      'on-surface-variant': '#D3E0D9',
      'on-background': '#E6EEEA',
      error: '#F2B8B5',
      success: '#C3A6D6',
      warning: '#F08A5D',
    },
  ),
  'salvia-paprika': scheme(
    {
      primary: '#4F7A5A',
      secondary: '#B5543A',
      background: '#F5F4EE',
      surface: '#FFFFFF',
      'surface-variant': '#E6ECE2',
      'on-surface-variant': '#3C4A3F',
      'on-background': '#20261F',
      error: '#B3261E',
      success: '#2F6B8A',
      warning: '#B5543A',
    },
    {
      primary: '#8DBF96',
      secondary: '#E58C70',
      background: '#151916',
      surface: '#1E2420',
      'surface-variant': '#2A332C',
      'on-surface-variant': '#D7E2D6',
      'on-background': '#E8EDE5',
      error: '#F2B8B5',
      success: '#86C3E0',
      warning: '#E58C70',
    },
  ),
  terakota: scheme(
    {
      primary: '#B4532A',
      secondary: '#5F7A3A',
      background: '#FAF6F0',
      surface: '#FFFFFF',
      'surface-variant': '#F1E9DE',
      'on-surface-variant': '#4A3F37',
      'on-background': '#2B2420',
      error: '#B3261E',
      success: '#3F7D3A',
      warning: '#B7791F',
    },
    {
      primary: '#E48A62',
      secondary: '#A5C27A',
      background: '#1C1815',
      surface: '#26211D',
      'surface-variant': '#3A322C',
      'on-surface-variant': '#E6DCD2',
      'on-background': '#F1E9E1',
      error: '#F2B8B5',
      success: '#8CCB86',
      warning: '#E8B866',
    },
  ),
  modrotlac: scheme(
    {
      primary: '#2B4C7E',
      secondary: '#C9952B',
      background: '#F6F5F1',
      surface: '#FFFFFF',
      'surface-variant': '#E4E9F2',
      'on-surface-variant': '#2E3A4D',
      'on-background': '#1C2330',
      error: '#B3261E',
      success: '#3B7A4A',
      warning: '#9A6B12',
    },
    {
      primary: '#8FB0E6',
      secondary: '#E7BE5F',
      background: '#12161E',
      surface: '#1A2029',
      'surface-variant': '#263040',
      'on-surface-variant': '#D5DEEC',
      'on-background': '#E6EBF3',
      error: '#F2B8B5',
      success: '#8FD0A0',
      warning: '#E7BE5F',
    },
  ),
  paprika: scheme(
    {
      primary: '#A8322A',
      secondary: '#5F6E2E',
      background: '#FBF6EF',
      surface: '#FFFDF9',
      'surface-variant': '#F2E7DA',
      'on-surface-variant': '#4A3A30',
      'on-background': '#2A201B',
      error: '#8C1D18',
      success: '#5F6E2E',
      warning: '#A0620F',
    },
    {
      primary: '#F08A7E',
      secondary: '#B7C47A',
      background: '#1B1514',
      surface: '#241C1A',
      'surface-variant': '#352A26',
      'on-surface-variant': '#EADBD3',
      'on-background': '#F3E9E4',
      error: '#FFB4AB',
      success: '#B7C47A',
      warning: '#EDBB6A',
    },
  ),
  'grafit-horcica': scheme(
    {
      primary: '#D19A12',
      secondary: '#34434B',
      background: '#F4F2EC',
      surface: '#FFFFFF',
      'surface-variant': '#E9E6DD',
      'on-surface-variant': '#34434B',
      'on-background': '#1E2326',
      error: '#B3261E',
      success: '#34434B',
      warning: '#B0461C',
    },
    {
      primary: '#F2BE3A',
      secondary: '#9FB3BD',
      background: '#15181A',
      surface: '#1D2124',
      'surface-variant': '#2A3034',
      'on-surface-variant': '#D8DEE1',
      'on-background': '#ECEAE4',
      error: '#F2B8B5',
      success: '#9FB3BD',
      warning: '#F08A5D',
    },
  ),
}
