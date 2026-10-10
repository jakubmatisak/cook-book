import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { CreateSharesResult } from '../../shared/api'
import { newId } from '../../shared/ids'
import type { CreateShareInput } from '../../shared/schemas/sharing'
import { SHARE_LIMITS } from '../../shared/sharing'
import type { Db } from '../db/client'
import {
  contacts,
  householdMembers,
  recipes,
  recipeShareItems,
  recipeShares,
  tags,
  users,
} from '../db/schema'
import type { AuthUser } from '../env'
import { HttpError } from '../errors'
import { chunk } from '../http'

const notFound = () => new HttpError(404, 'not_found', 'Recept neexistuje.')

/** Zoznam ID ako JSON pre `json_each` – jeden viazaný parameter namiesto stoviek (limit D1). */
const jsonIds = (ids: readonly string[]) => JSON.stringify(ids)

/** Overí, že všetky recepty (alebo tag) patria domácnosti odosielateľa a recepty nie sú zmazané. */
async function assertOwnSource(db: Db, householdId: string, input: CreateShareInput): Promise<string[]> {
  if (input.kind === 'tag') {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, input.tagId!), eq(tags.householdId, householdId)))
      .get()
    if (!tag) throw new HttpError(404, 'not_found', 'Tag neexistuje.')
    return []
  }
  if (input.kind === 'category') return []
  const ids = [...new Set(input.recipeIds ?? [])]
  const found = await db
    .select({ n: sql<number>`count(*)` })
    .from(recipes)
    .where(
      and(
        eq(recipes.householdId, householdId),
        isNull(recipes.deletedAt),
        sql`${recipes.id} in (select value from json_each(${jsonIds(ids)}))`,
      ),
    )
    .get()
  if ((found?.n ?? 0) !== ids.length) throw notFound()
  return ids
}

/** E-maily ľudí z vlastnej domácnosti (vrátane odosielateľa) – im sa nezdieľa, recepty už majú. */
async function ownHouseholdEmails(db: Db, user: AuthUser): Promise<Set<string>> {
  const members = await db
    .select({ email: users.email })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, user.householdId))
  return new Set([user.email.toLowerCase(), ...members.map((m) => m.email.toLowerCase())])
}

/**
 * Ponúkne recepty (vybrané, kategóriu alebo tag) na e-maily. Čakajúca ponuka receptov pre ten istý e-mail sa
 * doplní, kategória či tag sa neponúkne druhýkrát. E-maily sa uložia do kontaktov domácnosti. Odpoveď nezávisí
 * od toho, či e-mail patrí používateľovi aplikácie.
 */
export async function createShares(
  db: Db,
  user: AuthUser,
  input: CreateShareInput,
): Promise<CreateSharesResult> {
  const own = await ownHouseholdEmails(db, user)
  if (input.emails.some((e) => own.has(e))) {
    throw new HttpError(400, 'own_household', 'Tento človek už je vo vašej domácnosti.')
  }
  const recipeIds = await assertOwnSource(db, user.householdId, input)

  const open = await db
    .select({
      id: recipeShares.id,
      toEmail: recipeShares.toEmail,
      kind: recipeShares.kind,
      category: recipeShares.category,
      tagId: recipeShares.tagId,
      status: recipeShares.status,
    })
    .from(recipeShares)
    .where(
      and(
        eq(recipeShares.fromHouseholdId, user.householdId),
        inArray(recipeShares.status, ['pending', 'accepted']),
      ),
    )
  const pendingCount = open.filter((s) => s.status === 'pending').length

  const now = new Date().toISOString()
  const newShares: (typeof recipeShares.$inferInsert)[] = []
  const itemTargets: string[] = []
  for (const email of input.emails) {
    const mine = open.filter((s) => s.toEmail === email)
    if (input.kind === 'recipes') {
      const pending = mine.find((s) => s.kind === 'recipes' && s.status === 'pending')
      if (pending) {
        itemTargets.push(pending.id)
        continue
      }
    } else if (
      mine.some(
        (s) =>
          s.kind === input.kind &&
          s.category === (input.category ?? null) &&
          s.tagId === (input.tagId ?? null),
      )
    ) {
      continue
    }
    const id = newId()
    newShares.push({
      id,
      fromHouseholdId: user.householdId,
      fromUserId: user.id || null,
      toEmail: email,
      kind: input.kind,
      category: input.kind === 'category' ? input.category! : null,
      tagId: input.kind === 'tag' ? input.tagId! : null,
      message: input.message,
      createdAt: now,
    })
    if (input.kind === 'recipes') itemTargets.push(id)
  }
  if (pendingCount + newShares.length > SHARE_LIMITS.pendingPerHousehold) {
    throw new HttpError(400, 'too_many_pending', 'Čaká priveľa nevybavených ponúk zdieľania.')
  }

  const statements = [
    ...newShares.map((s) => db.insert(recipeShares).values(s)),
    // Recepty ponuky jedným príkazom cez json_each (nezávisle od počtu receptov).
    ...itemTargets.map((shareId) =>
      db
        .insert(recipeShareItems)
        .select(
          db
            .select({ shareId: sql<string>`${shareId}`.as('share_id'), recipeId: recipes.id })
            .from(recipes)
            .where(sql`${recipes.id} in (select value from json_each(${jsonIds(recipeIds)}))`),
        )
        .onConflictDoNothing(),
    ),
    ...chunk(input.emails, 15).map((part) =>
      db
        .insert(contacts)
        .values(
          part.map((email) => ({ householdId: user.householdId, email, createdAt: now, updatedAt: now })),
        )
        .onConflictDoNothing(),
    ),
  ]
  if (statements.length > 0) await db.batch(statements as [(typeof statements)[number], ...typeof statements])
  return { sent: input.emails.length }
}
