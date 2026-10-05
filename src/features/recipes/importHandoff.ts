import type { ImportRecipeResultDto } from '@shared/api'

interface HandoffStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'kniha:import'

/**
 * Odovzdanie importovaného receptu z dialógu do editora cez úložisko karty prehliadača.
 * Výsledok sa prečíta raz; chyby úložiska (súkromné okno) sa ticho ignorujú.
 */
export function createImportHandoff(
  storage: HandoffStorage | undefined = typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
) {
  return {
    put(result: ImportRecipeResultDto): void {
      try {
        storage?.setItem(KEY, JSON.stringify(result))
      } catch {
        // úložisko nie je dostupné
      }
    },
    take(): ImportRecipeResultDto | null {
      try {
        const raw = storage?.getItem(KEY)
        if (!raw) return null
        storage?.removeItem(KEY)
        const parsed = JSON.parse(raw) as ImportRecipeResultDto
        return typeof parsed?.recipe?.title === 'string' && parsed.recipe.title ? parsed : null
      } catch {
        return null
      }
    },
  }
}

export const importHandoff = createImportHandoff()
