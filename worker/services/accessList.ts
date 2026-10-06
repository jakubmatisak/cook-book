/** Zoznam správcov inštancie (tajomstvo ALLOWED_EMAILS): e-maily oddelené čiarkou, bez ohľadu na veľkosť písmen. */
export function isAllowedEmail(email: string, allowed: string | undefined): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return (allowed ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized)
}
