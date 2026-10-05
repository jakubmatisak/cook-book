/**
 * Jediný zdroj pravdy pre farby a tvary. Vuetify téma sa skladá odtiaľto
 * a Tailwind farby odkazujú na Vuetify CSS premenné (src/styles/main.css).
 */
export const colors = {
  light: {
    primary: '#B4532A', // terakota
    secondary: '#5F7A3A', // olivová
    background: '#FBF7F1', // krémová
    surface: '#FFFFFF',
    'surface-variant': '#F2EBE1',
    'on-surface-variant': '#4A3F37',
    'on-background': '#2B2420',
    'on-surface': '#2B2420',
    error: '#B3261E',
    success: '#3F7D3A',
    warning: '#B7791F',
    info: '#36677F',
  },
  dark: {
    primary: '#E48A62',
    secondary: '#A5C27A',
    background: '#1C1815',
    surface: '#26211D',
    'surface-variant': '#3A322C',
    'on-surface-variant': '#E6DCD2',
    'on-background': '#F1E9E1',
    'on-surface': '#F1E9E1',
    error: '#F2B8B5',
    success: '#8CCB86',
    warning: '#E8B866',
    info: '#8EC1DA',
  },
} as const

export const radius = {
  control: 'lg',
  card: 'xl',
} as const
