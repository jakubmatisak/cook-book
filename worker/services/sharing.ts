import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type {
  ContactDto,
  CreateSharesResult,
  IncomingShareDto,
  OutgoingShareDto,
  ShareNoticeDto,
} from '../../shared/api'
import { newId } from '../../shared/ids'
import type { CreateShareInput } from '../../shared/schemas/sharing'
import { SHARE_LIMITS } from '../../shared/sharing'
import type { Db } from '../db/client'
import {
  contacts,
  householdMembers,
  households,
  recipes,
  recipeShareItems,
  recipeShares,
  recipeTags,
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

/**
 * Podmienka nad `recipes`: recept iná domácnosť zdieľa s niektorou z domácností `householdIds` a tá zdieľanie
 * prijala – vybraný recept, celá kategória (hlavný typ aj „hodí sa aj ako“) alebo tag. Len na čítanie.
 */
export const sharedWithHouseholds = (householdIds: readonly string[]) => sql`exists (
  select 1 from recipe_shares s
  where s.status = 'accepted'
    and s.to_household_id in (select value from json_each(${JSON.stringify(householdIds)}))
    and s.from_household_id = ${recipes.householdId}
    and ${shareCoversRecipe()}
)`

/** Ponuka `s` obsahuje recept z `recipes`: vybraný recept, kategória (hlavná aj „hodí sa aj ako“) alebo tag. */
const shareCoversRecipe = () => sql`(
  (s.kind = 'recipes' and exists (
    select 1 from recipe_share_items i where i.share_id = s.id and i.recipe_id = ${recipes.id}))
  or (s.kind = 'category' and (s.category = ${recipes.category} or exists (
    select 1 from json_each(${recipes.alsoCategories}) where value = s.category)))
  or (s.kind = 'tag' and exists (
    select 1 from recipe_tags t where t.tag_id = s.tag_id and t.recipe_id = ${recipes.id}))
)`

/** Podmienka nad `recipes`: vlastná domácnosť recept niekomu ponúka (čakajúca alebo prijatá ponuka). */
export const sharedByOwner = () => sql`exists (
  select 1 from recipe_shares s
  where s.from_household_id = ${recipes.householdId}
    and s.status in ('pending', 'accepted')
    and ${shareCoversRecipe()}
)`

/** Komu domácnosť recept zdieľa (čakajúce aj prijaté ponuky): meno kontaktu, inak e-mail; zoradené. */
export async function sharedWithLabels(db: Db, householdId: string, recipeId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: sql<string>`coalesce(${contacts.name}, ${recipeShares.toEmail})` })
    .from(recipeShares)
    .innerJoin(recipes, eq(recipes.id, recipeId))
    .leftJoin(
      contacts,
      and(eq(contacts.householdId, recipeShares.fromHouseholdId), eq(contacts.email, recipeShares.toEmail)),
    )
    .where(
      and(
        eq(recipeShares.fromHouseholdId, householdId),
        eq(recipes.householdId, householdId),
        inArray(recipeShares.status, ['pending', 'accepted']),
        sql`exists (select 1 from recipe_shares s where s.id = ${recipeShares.id} and ${shareCoversRecipe()})`,
      ),
    )
  return rows.map((r) => r.label).sort((a, b) => a.localeCompare(b, 'sk'))
}

/** Od koho má domácnosť zdieľané recepty domácnosti `fromHouseholdId`: meno odosielateľa, inak názov domácnosti. */
export async function sharedFromName(
  db: Db,
  toHouseholdId: string,
  fromHouseholdId: string,
): Promise<string> {
  const row = await db
    .select({ userName: users.name, householdName: households.name })
    .from(recipeShares)
    .innerJoin(households, eq(households.id, recipeShares.fromHouseholdId))
    .leftJoin(users, eq(users.id, recipeShares.fromUserId))
    .where(
      and(
        eq(recipeShares.toHouseholdId, toHouseholdId),
        eq(recipeShares.fromHouseholdId, fromHouseholdId),
        eq(recipeShares.status, 'accepted'),
      ),
    )
    .orderBy(desc(recipeShares.respondedAt))
    .get()
  return row?.userName ?? row?.householdName ?? ''
}

type ShareRow = typeof recipeShares.$inferSelect
interface SharedRecipe {
  id: string
  title: string
  createdAt: string
}

/**
 * Živé recepty každej ponuky (vybrané, kategória či tag) – pevný počet dotazov bez ohľadu na počet ponúk
 * (limit dotazov D1 na jednu požiadavku).
 */
async function recipesOfShares(db: Db, shares: readonly ShareRow[]): Promise<Map<string, SharedRecipe[]>> {
  const result = new Map<string, SharedRecipe[]>(shares.map((s) => [s.id, []]))
  if (shares.length === 0) return result
  const senders = [...new Set(shares.map((s) => s.fromHouseholdId))]
  const tagIds = [...new Set(shares.flatMap((s) => (s.tagId ? [s.tagId] : [])))]
  const [live, items, tagLinks] = await db.batch([
    db
      .select({
        id: recipes.id,
        title: recipes.title,
        createdAt: recipes.createdAt,
        householdId: recipes.householdId,
        category: recipes.category,
        alsoCategories: recipes.alsoCategories,
      })
      .from(recipes)
      .where(
        and(
          isNull(recipes.deletedAt),
          sql`${recipes.householdId} in (select value from json_each(${jsonIds(senders)}))`,
        ),
      ),
    db
      .select({ shareId: recipeShareItems.shareId, recipeId: recipeShareItems.recipeId })
      .from(recipeShareItems)
      .where(
        sql`${recipeShareItems.shareId} in (select value from json_each(${jsonIds(shares.map((s) => s.id))}))`,
      ),
    db
      .select({ tagId: recipeTags.tagId, recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(sql`${recipeTags.tagId} in (select value from json_each(${jsonIds(tagIds)}))`),
  ])
  const byId = new Map(live.map((r) => [r.id, r]))
  const group = (pairs: { key: string; recipeId: string }[]) => {
    const map = new Map<string, string[]>()
    for (const { key, recipeId } of pairs) map.set(key, [...(map.get(key) ?? []), recipeId])
    return map
  }
  const itemsOf = group(items.map((i) => ({ key: i.shareId, recipeId: i.recipeId })))
  const taggedOf = group(tagLinks.map((l) => ({ key: l.tagId, recipeId: l.recipeId })))

  for (const s of shares) {
    const ids =
      s.kind === 'recipes'
        ? (itemsOf.get(s.id) ?? [])
        : s.kind === 'tag'
          ? (taggedOf.get(s.tagId ?? '') ?? [])
          : live
              .filter((r) => r.category === s.category || r.alsoCategories.includes(s.category!))
              .map((r) => r.id)
    const list = ids.flatMap((id) => {
      const r = byId.get(id)
      return r && r.householdId === s.fromHouseholdId
        ? [{ id: r.id, title: r.title, createdAt: r.createdAt }]
        : []
    })
    result.set(
      s.id,
      list.sort((a, b) => a.title.localeCompare(b.title, 'sk')),
    )
  }
  return result
}

async function tagNames(db: Db, shares: readonly ShareRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(shares.flatMap((s) => (s.tagId ? [s.tagId] : [])))]
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(sql`${tags.id} in (select value from json_each(${jsonIds(ids)}))`)
  return new Map(rows.map((t) => [t.id, t.name]))
}

/** Odoslané ponuky domácnosti, najnovšie prvé, s menom kontaktu a živými receptmi. */
export async function listOutgoing(db: Db, householdId: string): Promise<OutgoingShareDto[]> {
  const shares = await db
    .select()
    .from(recipeShares)
    .where(eq(recipeShares.fromHouseholdId, householdId))
    .orderBy(desc(recipeShares.createdAt))
  const recipesOf = await recipesOfShares(db, shares)
  const names = await tagNames(db, shares)
  const contactRows = await db
    .select({ email: contacts.email, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.householdId, householdId))
  const contactName = new Map(contactRows.map((c) => [c.email, c.name]))
  return shares.map((s) => {
    const list = recipesOf.get(s.id) ?? []
    return {
      id: s.id,
      toEmail: s.toEmail,
      toName: contactName.get(s.toEmail) ?? null,
      kind: s.kind,
      category: s.category,
      tagName: s.tagId ? (names.get(s.tagId) ?? null) : null,
      recipeCount: list.length,
      recipes: list.map(({ id, title }) => ({ id, title })),
      status: s.status,
      message: s.message,
      createdAt: s.createdAt,
    }
  })
}

/**
 * Ponuky pre mňa: čakajúce na môj e-mail a prijaté mojou aktívnou domácnosťou. Ponuka vybraných receptov,
 * z ktorej sa všetky recepty zmazali, sa neukáže.
 */
export async function listIncoming(db: Db, user: AuthUser): Promise<IncomingShareDto[]> {
  const rows = await db
    .select({ share: recipeShares, householdName: households.name, userName: users.name })
    .from(recipeShares)
    .innerJoin(households, eq(households.id, recipeShares.fromHouseholdId))
    .leftJoin(users, eq(users.id, recipeShares.fromUserId))
    .where(
      or(
        and(eq(recipeShares.toEmail, user.email.toLowerCase()), eq(recipeShares.status, 'pending')),
        and(eq(recipeShares.toHouseholdId, user.householdId), eq(recipeShares.status, 'accepted')),
      ),
    )
    .orderBy(desc(recipeShares.createdAt))
  const shares = rows.map((r) => r.share)
  const recipesOf = await recipesOfShares(db, shares)
  const names = await tagNames(db, shares)
  return rows.flatMap(({ share: s, householdName, userName }) => {
    const list = recipesOf.get(s.id) ?? []
    if (s.kind === 'recipes' && list.length === 0) return []
    const since = s.seenAt ?? s.respondedAt
    const newCount =
      s.status === 'accepted' && s.kind !== 'recipes' && since
        ? list.filter((r) => r.createdAt > since).length
        : 0
    return [
      {
        id: s.id,
        fromName: userName ?? householdName,
        fromHouseholdName: householdName,
        kind: s.kind,
        category: s.category,
        tagName: s.tagId ? (names.get(s.tagId) ?? null) : null,
        message: s.message,
        status: s.status,
        recipes: list.map(({ id, title }) => ({ id, title })),
        newCount,
        createdAt: s.createdAt,
      },
    ]
  })
}

async function findShare(db: Db, id: string, where: SQL | undefined): Promise<ShareRow> {
  const found = await db
    .select()
    .from(recipeShares)
    .where(and(eq(recipeShares.id, id), where))
    .get()
  if (!found) throw new HttpError(404, 'not_found', 'Zdieľanie neexistuje.')
  return found
}

const pendingFor = (user: AuthUser) =>
  and(eq(recipeShares.toEmail, user.email.toLowerCase()), eq(recipeShares.status, 'pending'))

const inList = (column: typeof recipeShareItems.recipeId, ids: readonly string[]) =>
  sql`${column} in (select value from json_each(${jsonIds(ids)}))`

/** Príjemca prijme čakajúcu ponuku do aktívnej domácnosti; pri vybraných receptoch môže prijať len niektoré. */
export async function acceptShare(
  db: Db,
  user: AuthUser,
  id: string,
  recipeIds?: readonly string[],
): Promise<void> {
  const s = await findShare(db, id, pendingFor(user))
  if (s.kind === 'recipes' && recipeIds) {
    const keep = new Set(recipeIds)
    const items = await db
      .select({ recipeId: recipeShareItems.recipeId })
      .from(recipeShareItems)
      .where(eq(recipeShareItems.shareId, s.id))
    const drop = items.map((i) => i.recipeId).filter((r) => !keep.has(r))
    if (drop.length === items.length)
      throw new HttpError(400, 'nothing_selected', 'Vyber aspoň jeden recept.')
    if (drop.length) {
      await db
        .delete(recipeShareItems)
        .where(and(eq(recipeShareItems.shareId, s.id), inList(recipeShareItems.recipeId, drop)))
    }
  }
  const now = new Date().toISOString()
  await db
    .update(recipeShares)
    .set({ status: 'accepted', toHouseholdId: user.householdId, respondedAt: now, seenAt: now })
    .where(eq(recipeShares.id, s.id))
}

/** Príjemca ponuku odmietne. */
export async function declineShare(db: Db, user: AuthUser, id: string): Promise<void> {
  const s = await findShare(db, id, pendingFor(user))
  await db
    .update(recipeShares)
    .set({ status: 'declined', respondedAt: new Date().toISOString() })
    .where(eq(recipeShares.id, s.id))
}

/** Príjemca zruší prijaté zdieľanie zo svojej strany (jeho kópie ostávajú). */
export async function leaveShare(db: Db, householdId: string, id: string): Promise<void> {
  const s = await findShare(
    db,
    id,
    and(eq(recipeShares.toHouseholdId, householdId), eq(recipeShares.status, 'accepted')),
  )
  await db.update(recipeShares).set({ status: 'revoked' }).where(eq(recipeShares.id, s.id))
}

/** Odosielateľ zruší čakajúcu alebo prijatú ponuku. */
export async function revokeShare(db: Db, householdId: string, id: string): Promise<void> {
  const s = await findShare(
    db,
    id,
    and(eq(recipeShares.fromHouseholdId, householdId), inArray(recipeShares.status, ['pending', 'accepted'])),
  )
  await db.update(recipeShares).set({ status: 'revoked' }).where(eq(recipeShares.id, s.id))
}

/** Odosielateľ odoberie recepty z ponuky vybraných receptov. */
export async function removeShareItems(
  db: Db,
  householdId: string,
  id: string,
  recipeIds: readonly string[],
): Promise<void> {
  const s = await findShare(db, id, eq(recipeShares.fromHouseholdId, householdId))
  await db
    .delete(recipeShareItems)
    .where(and(eq(recipeShareItems.shareId, s.id), inList(recipeShareItems.recipeId, recipeIds)))
}

/** Príjemca si pozrel zdieľanie: recepty pridané doteraz už nie sú „nové“. */
export async function markShareSeen(db: Db, householdId: string, id: string): Promise<void> {
  const s = await findShare(db, id, eq(recipeShares.toHouseholdId, householdId))
  await db.update(recipeShares).set({ seenAt: new Date().toISOString() }).where(eq(recipeShares.id, s.id))
}

/** Vlastné kópie cudzích receptov, ktorých originál (stále čitateľný) sa od kópie zmenil. */
async function changedCopies(db: Db, householdId: string): Promise<ShareNoticeDto[]> {
  const copies = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      parentId: recipes.parentRecipeId,
      fromName: recipes.copiedFromName,
      since: recipes.copiedSourceUpdatedAt,
    })
    .from(recipes)
    .where(
      and(
        eq(recipes.householdId, householdId),
        isNull(recipes.deletedAt),
        isNotNull(recipes.parentRecipeId),
        isNotNull(recipes.copiedSourceUpdatedAt),
      ),
    )
  if (copies.length === 0) return []
  const parents = await db
    .select({ id: recipes.id, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(
      and(
        sql`${recipes.id} in (select value from json_each(${jsonIds(copies.map((c) => c.parentId!))}))`,
        isNull(recipes.deletedAt),
        ne(recipes.householdId, householdId),
        or(eq(recipes.visibility, 'public'), sharedWithHouseholds([householdId])),
      ),
    )
  const updatedAt = new Map(parents.map((p) => [p.id, p.updatedAt]))
  return copies.flatMap((c) => {
    const current = updatedAt.get(c.parentId!)
    return current && current > c.since!
      ? [
          {
            kind: 'changed' as const,
            recipeId: c.id,
            title: c.title,
            fromName: c.fromName ?? '',
            sourceId: c.parentId!,
          },
        ]
      : []
  })
}

/** Upozornenia na Prehľade: nové ponuky, pribudnuté recepty v prijatých kategóriách a tagoch, zmenené originály. */
export async function listNotices(db: Db, user: AuthUser): Promise<ShareNoticeDto[]> {
  const incoming = await listIncoming(db, user)
  const offers: ShareNoticeDto[] = incoming
    .filter((s) => s.status === 'pending')
    .map((s) => ({
      kind: 'offer',
      shareId: s.id,
      fromName: s.fromName,
      count: s.recipes.length,
      message: s.message,
    }))
  const fresh: ShareNoticeDto[] = incoming
    .filter((s) => s.status === 'accepted' && s.newCount > 0)
    .map((s) => ({
      kind: 'new',
      shareId: s.id,
      fromName: s.fromName,
      category: s.category,
      tagName: s.tagName,
      count: s.newCount,
    }))
  return [...offers, ...fresh, ...(await changedCopies(db, user.householdId))]
}

/** Skryje upozornenie na zmenený originál: kópia sa odteraz porovnáva s jeho aktuálnou verziou. */
export async function dismissChangedNotice(db: Db, householdId: string, recipeId: string): Promise<void> {
  await db
    .update(recipes)
    .set({
      copiedSourceUpdatedAt: sql`(select p.updated_at from recipes p where p.id = ${recipes.parentRecipeId})`,
    })
    .where(
      and(eq(recipes.id, recipeId), eq(recipes.householdId, householdId), isNotNull(recipes.parentRecipeId)),
    )
}

/** Počet čakajúcich ponúk na e-mail (aj pre človeka, ktorý ešte nemá domácnosť). */
export async function pendingShareCount(db: Db, email: string): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(recipeShares)
    .where(and(eq(recipeShares.toEmail, email.toLowerCase()), eq(recipeShares.status, 'pending')))
    .get()
  return row?.n ?? 0
}

// ─── Kontakty ────────────────────────────────────────────────────────────────

const contactNotFound = () => new HttpError(404, 'not_found', 'Kontakt neexistuje.')

/** Kontakty domácnosti podľa e-mailu. */
export async function listContacts(db: Db, householdId: string): Promise<ContactDto[]> {
  return db
    .select({ id: contacts.id, email: contacts.email, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.householdId, householdId))
    .orderBy(asc(contacts.email))
}

export async function renameContact(
  db: Db,
  householdId: string,
  id: string,
  name: string | null,
): Promise<void> {
  const res = await db
    .update(contacts)
    .set({ name })
    .where(and(eq(contacts.id, id), eq(contacts.householdId, householdId)))
    .returning({ id: contacts.id })
  if (res.length === 0) throw contactNotFound()
}

/** Zmaže kontakt; zdieľania s ním ostávajú. */
export async function deleteContact(db: Db, householdId: string, id: string): Promise<void> {
  const res = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.householdId, householdId)))
    .returning({ id: contacts.id })
  if (res.length === 0) throw contactNotFound()
}
