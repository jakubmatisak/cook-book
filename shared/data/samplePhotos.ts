/**
 * Fotky základných receptov (Wikimedia Commons, voľné licencie). Súbor je v `public/samples/<kľúč>.webp`, tu je autor
 * a licencia – zapíšu sa do poznámky importovaného receptu. Recept bez záznamu sa importuje bez fotky.
 */
export interface SamplePhotoCredit {
  author: string
  license: string
  /** Stránka súboru na Wikimedia Commons. */
  source: string
}

export const SAMPLE_PHOTOS: Readonly<Record<string, SamplePhotoCredit>> = {}

export const samplePhotoCredit = (credit: SamplePhotoCredit): string =>
  `Fotka: ${credit.author}, ${credit.license}, Wikimedia Commons (${credit.source})`
