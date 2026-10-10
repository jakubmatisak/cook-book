# Zdieľanie receptov s konkrétnym e-mailom – plán implementácie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domácnosť ponúkne recepty (vybrané, kategóriu alebo tag) na e-mail; príjemca prijme a jeho domácnosť ich
má len na čítanie s možnosťou kópie.

**Architecture:** Nové tabuľky `contacts`, `recipe_shares`, `recipe_share_items`. Prístup k cudzím receptom sa
zovšeobecní: dnes „verejný“, nově „verejný ALEBO zdieľaný s mojou domácnosťou“ (jeden SQL predikát v
`worker/services/sharing.ts`). Detail len na čítanie, kópia, obal a cudzie recepty v zozname už existujú pre verejné
recepty (`publicRecipes.ts`, `/public/:id`, `householdName` v súhrne) – rozšíria sa, nepíšu nanovo.

**Tech Stack:** Hono Worker, Drizzle/D1, zod v4, Vue 3 + Vuetify 4, TanStack Vue Query, vue-i18n, vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-zdielanie-receptov-design.md`

## Global Constraints

- Len Vuetify (komponenty, props, utility triedy); žiadne `<style>`, farby len z tém, hustota cez `useDensity`.
- Každý text SK aj EN (`src/locales/{sk,en}/*.ts`).
- Každá DB query na dáta domácnosti filtruje `householdId` z `c.get('user')`; chyby cez `HttpError`.
- D1: ≤ 100 premenných na príkaz (vkladanie po dávkach `chunk`), ≤ 50 dotazov na požiadavku.
- `src/` a `worker/` sa neimportujú navzájom, spoločné veci v `shared/`.
- Kontrola pred commitom: `(npm run typecheck && npx eslint . --ignore-pattern ".claude/**" && npx prettier --check . --ignore-path .prettierignore --ignore-path .gitignore "!.claude/**" && npx vitest run)`.
- Commity končia `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push a produkčná D1 len na pokyn.
- Limity: 20 príjemcov naraz, 200 receptov v ponuke, 100 čakajúcich ponúk na domácnosť, správa ≤ 500 znakov.

## Review Focus

1. Cudzí recept bez prijatého zdieľania (pending, declined, revoked, iná domácnosť, zmazaný) sa nesmie dať prečítať
   ani cez `/public/recipes/:id`, ani cez `/img/...`, ani v zozname – test pre každý stav (Task 3).
2. Príjemca nesmie zdieľaný recept zmeniť cez žiadny existujúci endpoint (`PUT /recipes/:id`, hodnotenie, obľúbené,
   poznámky, viditeľnosť, hromadné akcie) – test na `PUT` a hromadnú úpravu (Task 3).
3. Odpoveď `POST /sharing` je rovnaká pre e-mail s účtom aj bez neho (Task 2).
4. Prijatie ponuky používateľom, ktorému nepatrí (iný e-mail), musí zlyhať 404 (Task 4).
5. Veľa receptov naraz (200) neprekročí limity D1 – test so 150 receptmi (Task 2).

---

### Task 1: Dáta, konštanty a DTO

**Files:**
- Create: `shared/sharing.ts`, `shared/schemas/sharing.ts`
- Modify: `worker/db/schema.ts`, `shared/api.ts`, `tests/worker/setup.ts`
- Create: migrácia cez `npm run db:generate` (`worker/db/migrations/0015_*.sql`)
- Test: `tests/worker/sharing-schema.test.ts`, `tests/unit/sharing-schema.test.ts`

**Interfaces – Produces:**
- `SHARE_KINDS = ['recipes','category','tag']`, `SHARE_STATUSES = ['pending','accepted','declined','revoked']`,
  `SHARE_LIMITS = { recipients: 20, recipes: 200, pendingPerHousehold: 100, message: 500 }` (`shared/sharing.ts`).
- Tabuľky `contacts`, `recipeShares`, `recipeShareItems`; `recipes.copiedFromName`, `recipes.copiedSourceUpdatedAt`
  (pôvod kópie ostáva v existujúcom `parentRecipeId`).
- `createShareSchema` (`emails[]` 1–20 platných, malými písmenami, bez duplicít; `kind`; `recipeIds?` 1–200 pri
  `recipes`; `category?` pri `category`; `tagId?` pri `tag`; `message?` ≤ 500), `acceptShareSchema`
  (`recipeIds?`), `shareItemsSchema` (`recipeIds` 1–200), `contactNameSchema` (`name` ≤ 60, prázdne = null).
- DTO v `shared/api.ts`: `ShareKind`, `ShareStatus`, `OutgoingShareDto`, `IncomingShareDto`, `ShareNoticeDto`,
  `ContactDto`, `CreateSharesResult { sent: number }`; `RecipeSummaryDto.sharedFrom?: string`,
  `RecipeDetailDto.sharedWith?: string[]`, `RecipeDetailDto.copiedFrom?: string | null`,
  `PublicRecipeDetailDto.sharedFrom?: string`.

- [ ] **Step 1: Failing testy** – unit: `createShareSchema` odmietne 21 e-mailov, neplatný e-mail, `kind: 'recipes'`
  bez `recipeIds`, `kind: 'tag'` bez `tagId`; e-maily zmenší a odstráni duplicity. Worker: po migrácii existujú
  tabuľky `contacts`, `recipe_shares`, `recipe_share_items` a stĺpce `recipes.copied_from_name`,
  `recipes.copied_source_updated_at` (`pragma table_info`).
- [ ] **Step 2: Spustiť** `npx vitest run tests/unit/sharing-schema.test.ts tests/worker/sharing-schema.test.ts` → FAIL.
- [ ] **Step 3: Implementácia** – schéma:

```ts
export const contacts = sqliteTable(
  'contacts',
  {
    id: id(),
    householdId: householdRef(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('contacts_household_email_uq').on(t.householdId, t.email)],
)

export const recipeShares = sqliteTable(
  'recipe_shares',
  {
    id: id(),
    fromHouseholdId: text('from_household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    fromUserId: text('from_user_id').references(() => users.id, { onDelete: 'set null' }),
    toEmail: text('to_email').notNull(),
    toHouseholdId: text('to_household_id').references(() => households.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: SHARE_KINDS }).notNull(),
    category: text('category', { enum: RECIPE_CATEGORIES }),
    tagId: text('tag_id').references(() => tags.id, { onDelete: 'cascade' }),
    message: text('message'),
    status: text('status', { enum: SHARE_STATUSES }).notNull().default('pending'),
    createdAt: createdAt(),
    respondedAt: text('responded_at'),
    seenAt: text('seen_at'),
  },
  (t) => [
    index('recipe_shares_to_email_idx').on(t.toEmail, t.status),
    index('recipe_shares_to_household_idx').on(t.toHouseholdId, t.status),
    index('recipe_shares_from_household_idx').on(t.fromHouseholdId, t.status),
  ],
)

export const recipeShareItems = sqliteTable(
  'recipe_share_items',
  {
    shareId: text('share_id').notNull().references(() => recipeShares.id, { onDelete: 'cascade' }),
    recipeId: recipeRef(),
  },
  (t) => [primaryKey({ columns: [t.shareId, t.recipeId] }), index('recipe_share_items_recipe_idx').on(t.recipeId)],
)
```

  (`recipeShares` a `recipeShareItems` za `tags`/`recipes`; do `recipes` pridať `copiedFromName: text('copied_from_name')`,
  `copiedSourceUpdatedAt: text('copied_source_updated_at')`.) `npm run db:generate`. Do `TABLES_CHILD_FIRST` pridať
  `'recipe_share_items', 'recipe_shares', 'contacts'` pred `'recipe_tags'`.
- [ ] **Step 4: Spustiť** testy z kroku 2 → PASS; celý `npx vitest run --project worker` zelený.
- [ ] **Step 5: Commit** `feat(sharing): dáta a schémy zdieľania receptov`.

### Task 2: Odoslanie ponuky (`POST /sharing`) a kontakty

**Files:**
- Create: `worker/services/sharing.ts`, `worker/routes/sharing.ts`
- Modify: `worker/app.ts` (`app.route('/api/v1/sharing', sharingRoutes)`)
- Test: `tests/worker/sharing-send.test.ts`

**Interfaces – Produces:** `createShares(db, user: AuthUser, input: CreateShareInput): Promise<CreateSharesResult>`;
uloží kontakty (`insert … onConflictDoNothing`).

Pravidlá: recepty, kategória aj tag musia patriť domácnosti odosielateľa (inak 404); e-mail odosielateľa alebo člena
jeho domácnosti → 400 `own_household` „Tento človek už je vo vašej domácnosti.“; ak tomu istému e-mailu už čaká
ponuka druhu `recipes` od tejto domácnosti, recepty sa doplnia do nej (bez duplicít); kategória/tag s rovnakým
cieľom a čakajúcou alebo prijatou ponukou sa nezduplikuje; viac ako 100 čakajúcich ponúk → 400 `too_many_pending`;
vkladanie položiek `chunk(…, 40)`; odpoveď `{ sent: emails.length }` vždy rovnaká.

- [ ] **Step 1: Failing testy** – (a) ponuka 2 receptov na 2 e-maily vytvorí 2 ponuky `pending`, 4 položky,
  2 kontakty; (b) druhá ponuka na ten istý e-mail sa zlúči (1 ponuka, 3 položky); (c) cudzí recept → 404;
  (d) e-mail člena domácnosti → 400 `own_household`; (e) odpoveď pre e-mail s účtom aj bez je zhodná (`toEqual`);
  (f) 150 receptov prejde (201) a vytvorí 150 položiek; (g) zdieľanie tagu a kategórie uloží `tag_id`/`category`.
- [ ] **Step 2: Spustiť** `npx vitest run tests/worker/sharing-send.test.ts` → FAIL (404 route).
- [ ] **Step 3: Implementácia** služby a route `POST /` (`parseBody(c, createShareSchema)`, 201).
- [ ] **Step 4: Spustiť** → PASS.
- [ ] **Step 5: Commit** `feat(sharing): odoslanie ponuky na e-mail, kontakty`.

### Task 3: Prístup k zdieľaným receptom (detail, obal, kópia, zákaz zápisu)

**Files:**
- Modify: `worker/services/sharing.ts` (`sharedRecipeCondition`), `worker/services/publicRecipes.ts`,
  `worker/routes/images.ts`
- Test: `tests/worker/sharing-access.test.ts`

**Interfaces – Produces:**
- `sharedWithHousehold(householdId: string): SQL` – podmienka nad `recipes`: existuje `recipe_shares` so
  `status='accepted'`, `to_household_id = householdId`, `from_household_id = recipes.household_id` a (`kind='recipes'`
  a položka existuje | `kind='category'` a kategória v `category` alebo `also_categories` | `kind='tag'` a recept má
  tag).
- `getPublicRecipe` akceptuje `or(visibility='public', sharedWithHousehold(user.householdId))` a vráti
  `sharedFrom` (meno odosielateľa – `users.name` z najnovšieho prijatého zdieľania, inak názov domácnosti), keď je
  recept dostupný cez zdieľanie.
- `copyPublicRecipe` nastaví `copiedFromName` (meno odosielateľa / názov domácnosti) a `copiedSourceUpdatedAt`
  (= `updatedAt` originálu); `isPublicImage(db, r2Key, householdIds)` povolí aj obal receptu zdieľaného s
  niektorou z domácností používateľa.

- [ ] **Step 1: Failing testy** – A zdieľa recept s B: pending → `GET /public/recipes/:id` ako B 404; po prijatí
  (priamy update v DB v teste, kým nie je Task 4) 200 so `sharedFrom`; declined/revoked → 404; zmazaný → 404;
  kategória: recept pridaný do kategórie po prijatí je viditeľný; tag: recept s tagom viditeľný, bez neho 404;
  obal zdieľaného receptu B vidí (200), pred prijatím 404; kópia má `copiedFrom` a `parentRecipeId`;
  `PUT /recipes/:id` ako B → 404; `POST /recipes/bulk` (hromadná úprava) ako B na cudzí recept → `affected: 0`.
- [ ] **Step 2: Spustiť** `npx vitest run tests/worker/sharing-access.test.ts` → FAIL.
- [ ] **Step 3: Implementácia.**
- [ ] **Step 4: Spustiť** → PASS; `tests/worker/public-recipes.test.ts` a `images.test.ts` zelené.
- [ ] **Step 5: Commit** `feat(sharing): prístup k zdieľaným receptom len na čítanie`.

### Task 4: Prijatie, odmietnutie, zrušenie, prehľady

**Files:**
- Modify: `worker/services/sharing.ts`, `worker/routes/sharing.ts`
- Test: `tests/worker/sharing-flow.test.ts`

**Interfaces – Produces (routes pod `/api/v1/sharing`):**
- `GET /outgoing` → `OutgoingShareDto[]` (`id, toEmail, toName, kind, category, tagName, recipeCount, status,
  createdAt, message`), najnovšie prvé.
- `GET /incoming` → `IncomingShareDto[]` (`id, fromName, fromHouseholdName, kind, category, tagName, message,
  status, recipes: {id,title}[]` – pri `recipes` zoznam položiek, pri kategórii/tagu aktuálne zodpovedajúce recepty,
  `newCount` = recepty vytvorené po `seenAt`): čakajúce na môj e-mail + prijaté mojou domácnosťou.
- `POST /:id/accept { recipeIds? }` (len príjemca podľa e-mailu, len `pending`; nevybrané položky zmaže; nastaví
  `to_household_id`, `responded_at`, `seen_at`), `POST /:id/decline`, `POST /:id/leave` (príjemca prijaté →
  `revoked`), `POST /:id/revoke` (odosielateľ), `POST /:id/items/remove { recipeIds }` (odosielateľ),
  `POST /:id/seen` (príjemca).
- Ponuka `recipes` bez živých receptov sa v `incoming` nevracia.

- [ ] **Step 1: Failing testy** – celý tok A→B: `incoming` ako B ukáže pending s 2 receptmi; accept s výberom 1
  receptu → druhý recept 404; `outgoing` ako A ukáže `accepted` a `recipeCount: 1`; accept cudzej ponuky
  (C) → 404; decline → `declined` a `incoming` ju nevráti; revoke → B stratí prístup; leave → B stratí prístup;
  items/remove odoberie recept; `newCount` pri tagu po pridaní receptu = 1, po `seen` = 0.
- [ ] **Step 2: Spustiť** `npx vitest run tests/worker/sharing-flow.test.ts` → FAIL.
- [ ] **Step 3: Implementácia.**
- [ ] **Step 4: Spustiť** → PASS.
- [ ] **Step 5: Commit** `feat(sharing): prijatie, odmietnutie, zrušenie a prehľady zdieľaní`.

### Task 5: Zoznam receptov a detail vlastného receptu

**Files:**
- Modify: `worker/services/recipes.ts` (`listRecipes`, `getRecipeDetail`), `shared/schemas/recipe.ts` (query
  `shared=only`, `sharedByMe=1`), `worker/routes/recipes.ts`
- Test: `tests/worker/sharing-list.test.ts`

**Interfaces – Produces:** `RecipeListOptions.sharedMode?: 'only'` (cudzie recepty zdieľané s mojou domácnosťou,
súhrn s `householdName` a `sharedFrom`), `RecipeListOptions.sharedByMe?: boolean` (len moje recepty v
čakajúcom/prijatom zdieľaní); detail vlastného receptu `sharedWith` (mená kontaktov alebo e-maily z ponúk
`pending`/`accepted`, ktoré recept obsahujú), detail `copiedFrom` (`copiedFromName`).

- [ ] **Step 1: Failing testy** – B so `?shared=only` vidí 1 recept so `sharedFrom: 'ja'`; bez parametra ho nevidí;
  A so `?sharedByMe=1` vidí len zdieľaný recept; detail A má `sharedWith: ['Svokra']` po premenovaní kontaktu.
- [ ] **Step 2–4:** FAIL → implementácia → PASS (aj `tests/worker/public-in-list.test.ts`).
- [ ] **Step 5: Commit** `feat(sharing): filtre Zdieľané so mnou a Zdieľam, komu je recept zdieľaný`.

### Task 6: Upozornenia, náhrada kópie, kontakty, nováčik

**Files:**
- Modify: `worker/services/sharing.ts`, `worker/routes/sharing.ts`, `worker/routes/households.ts`,
  `worker/routes/recipes.ts`
- Create: `worker/routes/contacts.ts` (`/api/v1/contacts`)
- Test: `tests/worker/sharing-notices.test.ts`, `tests/worker/contacts.test.ts`

**Interfaces – Produces:**
- `GET /sharing/notices` → `ShareNoticeDto[]`: `{ kind: 'offer', shareId, fromName, count, message }`,
  `{ kind: 'new', shareId, fromName, label, count }`, `{ kind: 'changed', recipeId, title, fromName, sourceId }`
  (vlastná kópia, ktorej originál je stále čitateľný a `updatedAt > copiedSourceUpdatedAt`).
- `POST /sharing/notices/dismiss { recipeId }` – nastaví `copiedSourceUpdatedAt` na aktuálny čas originálu (skryje).
- `POST /recipes/:id/replace-from-source` – prepíše vlastnú kópiu obsahom originálu (cez `saveRecipe` s `id`),
  aktualizuje `copiedSourceUpdatedAt`; originál nečitateľný → 404.
- `GET /contacts`, `PATCH /contacts/:id { name }`, `DELETE /contacts/:id` (len vlastná domácnosť).
- `GET /households/account` pridá `pendingShares: number` (počet čakajúcich ponúk na e-mail) – nováčik bez
  domácnosti vidí na obrazovke zakladania domácnosti, že na neho čakajú recepty.

- [ ] **Step 1: Failing testy** – offer notice pre B; po prijatí `new` notice pri tagu; kópia → zmena originálu →
  `changed`; dismiss → zmizne; replace → kópia má nový názov; kontakty list/rename/delete, cudzí kontakt 404;
  nováčik `c@example.com` s čakajúcou ponukou: `/households/account` → `pendingShares: 1`.
- [ ] **Step 2–4:** FAIL → implementácia → PASS.
- [ ] **Step 5: Commit** `feat(sharing): upozornenia, náhrada kópie, kontakty`.

### Task 7: Frontend API a dialóg „Zdieľať s…“

**Files:**
- Create: `src/api/sharing.ts`, `src/features/sharing/components/ShareWithDialog.vue`, `src/locales/{sk,en}/sharing.ts`
  (registrovať v `src/locales/{sk,en}/index.ts`)
- Modify: `src/features/recipes/pages/RecipeDetailPage.vue` (ponuka zdieľania → „Zdieľať s…“, riadok „Zdieľané so“,
  čip „Skopírované od“), `src/features/recipes/pages/RecipesPage.vue` (hromadná akcia),
  `src/features/tags/pages/TagsPage.vue` (akcia „Zdieľať tag“)
- Test: `tests/unit/share-with-dialog.test.ts`

**Interfaces – Produces:** `useOutgoingShares`, `useIncomingShares`, `useShareNotices`, `useCreateShares`,
`useAcceptShare`, `useDeclineShare`, `useRevokeShare`, `useLeaveShare`, `useRemoveShareItems`, `useMarkShareSeen`,
`useDismissNotice`, `useReplaceFromSource`, `useContacts`, `useRenameContact`, `useDeleteContact`;
`ShareWithDialog` props `{ modelValue, recipeIds?: string[], kind?: ShareKind, tagId?: string, category? }`,
emit `done(text)`.

Dialóg: `v-combobox` (multiple, chips, closable-chips, `:items` = kontakty `name <email>`, hodnota e-mail,
overenie každého čipu, neplatný čip červený s hláškou), `v-btn-toggle` druhu (len keď nie sú dané recepty),
`v-select` kategórie/tagu, `v-textarea` správy (counter 500), súhrn „Zdieľaš 5 receptov s 2 ľuďmi“; po odoslaní
snackbar a pri nových e-mailoch (nie sú v kontaktoch) `v-alert` info s pripomienkou Cloudflare Access.

- [ ] **Step 1: Failing test** – dialóg s 2 receptmi: zadanie 2 e-mailov a odoslanie pošle
  `POST /sharing { emails, kind:'recipes', recipeIds }`; neplatný e-mail zablokuje tlačidlo; súhrn ukazuje počty;
  nový e-mail ukáže pripomienku Access.
- [ ] **Step 2–4:** FAIL → implementácia → PASS.
- [ ] **Step 5: Commit** `feat(sharing): dialóg Zdieľať s… v detaile, hromadne a pri tagu`.

### Task 8: Stránka Zdieľanie, menu, Prehľad

**Files:**
- Create: `src/features/sharing/pages/SharingPage.vue`, `src/features/sharing/components/ShareNoticeCards.vue`,
  `src/features/sharing/components/AcceptShareDialog.vue`
- Modify: `src/router/index.ts` (`/sharing`), `src/components/navigation.ts` (SECONDARY_NAV + ikona
  `mdiShareVariantOutline`), `src/components/AppShell.vue` (odznak počtu čakajúcich ponúk pri položke),
  `src/features/home/pages/HomePage.vue` (karty upozornení nad dlaždicami),
  `src/features/households/components/CreateOwnHousehold.vue` (info „Čakajú na teba zdieľané recepty“)
- Test: `tests/unit/sharing-page.test.ts`, `tests/unit/share-notices.test.ts`; upraviť `AppShell.test.ts`
  (`ALL_TITLES` + „Zdieľanie“)

Stránka: `PageHeader` + `v-tabs` „Zdieľam / Zdieľané so mnou“; zoznamy ako `v-list` s `v-list-item` (komu/od koho,
čo, čip stavu `color` podľa stavu, dátum), akcie v `v-menu` (Zrušiť zdieľanie, Odobrať recept; Opustiť
zdieľanie), `EmptyState` pri prázdnom zozname. Prehľad: `v-card` pre každé upozornenie (`variant="tonal"`,
`color="primary"`), tlačidlá Prijať všetko / Vybrať… / Odmietnuť, Zobraziť / Skryť, Otvoriť originál / Nahradiť
moju kópiu (s potvrdzovacím `v-dialog`) / Skryť. `AcceptShareDialog`: `v-list` s `v-checkbox-btn`, Vybrať všetko.

- [ ] **Step 1: Failing testy** – stránka ukáže odoslanú ponuku so stavom a zrušenie zavolá revoke; Prehľad ukáže
  kartu ponuky a „Prijať všetko“ zavolá accept bez `recipeIds`, „Vybrať…“ s výberom pošle `recipeIds`;
  menu obsahuje Zdieľanie s odznakom 1.
- [ ] **Step 2–4:** FAIL → implementácia → PASS.
- [ ] **Step 5: Commit** `feat(sharing): stránka Zdieľanie a upozornenia na Prehľade`.

### Task 9: Zoznam receptov, detail zdieľaného receptu, Kontakty v Nastaveniach

**Files:**
- Modify: `src/api/recipes.ts` (`shared?: 'only'`, `sharedByMe?: boolean` vo filtroch),
  `src/features/recipes/components/RecipeQuickFilters.vue` (čipy „Zdieľané so mnou“, „Zdieľam“),
  `RecipeCard.vue`/`RecipeTable.vue` (odznak „Od {meno}“ pri `sharedFrom`), `PublicRecipePage.vue`
  (`sharedFrom` čip, tlačidlo „Pridať do plánu“ = kópia + `EntryDialog` s id kópie, späť na zoznam so
  `shared=only`), `src/features/settings/pages/SettingsPage.vue` + nový `ContactsCard.vue`
- Test: `tests/unit/shared-recipes-ui.test.ts`, `tests/unit/contacts-card.test.ts`

- [ ] **Step 1: Failing testy** – čip „Zdieľané so mnou“ pošle `shared=only`; karta so `sharedFrom` ukáže
  „Od Jakub“ a vedie na `/public/:id`; detail zdieľaného receptu „Pridať do plánu“ zavolá copy a otvorí plán;
  karta Kontakty premenuje a zmaže kontakt.
- [ ] **Step 2–4:** FAIL → implementácia → PASS.
- [ ] **Step 5: Commit** `feat(sharing): zdieľané recepty v zozname, detail a kontakty`.

### Task 10: Kontrola UI (hustoty, témy, mobil/desktop)

- [ ] Spustiť `npm run dev`, v Playwright Chromiu prejsť: dialóg Zdieľať s…, Prehľad s upozorneniami, stránku
  Zdieľanie (obe karty), detail zdieľaného receptu, zoznam s filtrom, Nastavenia → Kontakty; pre každú:
  šírka 375 a 1440, hustota compact/comfortable/default (`PUT /me/settings`), svetlá a tmavá téma, schémy
  `salvia-horcica` a `modrotlac`.
- [ ] Opraviť zarovnanie (výšky tlačidiel podľa `useControlHeight`, `align-center`, rovnaké `ga-*`), farby len
  `color` props; po opravách `npm run check`.
- [ ] Screenshoty (mobil + desktop, svetlá + tmavá) poslať používateľovi cez SendUserFile.
- [ ] Commit `fix(sharing): zarovnanie a vzhľad podľa hustoty a tém`.

### Task 11: Vydanie 1.10.0

- [ ] Verzia 1.10.0: `package.json`, `package-lock.json` (2×), README (2×), CHANGELOG, `tests/unit/AppShell.test.ts`
  („Verzia 1.10.0“), `tests/unit/version.test.ts`; `npm run check`; commit `release: 1.10.0 – zdieľanie receptov
  s e-mailom`; tag `v1.10.0`.
- [ ] Až na pokyn: `npm run db:migrate:remote`, push `main`, overenie v produkcii.
