import { z } from 'zod'

/** Zod s globálne nastavenými slovenskými hláškami – schémy importujú z tohto súboru, nie priamo zo 'zod'. */
z.config(z.locales.sk())

export { z }
