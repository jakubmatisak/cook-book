interface ClipboardLike {
  clipboard?: { writeText(text: string): Promise<void> }
}

interface ShareLike {
  share?: (data: { title?: string; text?: string }) => Promise<void>
}

/** Skopíruje text do schránky; bez podpory alebo pri odmietnutí vráti false. */
export async function copyText(
  text: string,
  nav: ClipboardLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<boolean> {
  if (!nav?.clipboard) return false
  try {
    await nav.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const canShare = (
  nav: ShareLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
) => typeof nav?.share === 'function'

/** Zdieľanie cez systémové okno (mobil). Zrušenie používateľom nie je chyba. */
export async function shareText(
  data: { title: string; text: string },
  nav: ShareLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!nav?.share) return 'unsupported'
  try {
    await nav.share(data)
    return 'shared'
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') return 'cancelled'
    throw error
  }
}
