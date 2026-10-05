# Fáza 0 – Základ: implementačný plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prázdna, ale kompletne nastavená aplikácia: Vue 3 + Vuetify 4 PWA a Hono API v jednom Cloudflare Workeri, D1 so schémou pre všetky fázy, prihlásenie cez Cloudflare Access, export dát, testy a lokálny vývoj.

**Architecture:** Jeden Worker obsluhuje `/api/v1/*` (Hono) a všetko ostatné idú statické súbory SPA (Cloudflare assets s `single-page-application` fallbackom). Dáta v D1 cez Drizzle, typy DTO zdieľa frontend aj backend cez `shared/`. Prihlásenie overuje JWT z Cloudflare Access, lokálne ho nahrádza `DEV_USER_EMAIL`.

**Tech Stack:** Node 22, npm, TypeScript 6.0, Vite 8, Vue 3.5, Vuetify 4.2, Tailwind 4.3, vite-plugin-pwa 2, Hono 4, Zod 4, Drizzle ORM 0.45 + drizzle-kit 0.31, jose 6, TanStack Vue Query 5, Wrangler 4.147, @cloudflare/vite-plugin 1.62, Vitest 4.1 + @cloudflare/vitest-plugin 1.3, @vue/test-utils + jsdom.

**Spec:** [docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md](../specs/2026-10-05-kucharska-kniha-design.md)

## Odchýlky od spec (zistené pri overení verzií, spec sa upraví v Task 9)

- **npm namiesto pnpm** – pnpm nie je nainštalované, npm áno; nič to nemení na architektúre.
- **TypeScript 6.0, nie 7** – TS 7 je natívny kompilátor bez JS API, `vue-tsc` na ňom nebeží.
- **Vitest 4.1 + `@cloudflare/vitest-plugin`** – nástupca `vitest-pool-workers`, vyžaduje Vitest 4.
- **Typované API cez DTO v `shared/` + tenký `apiFetch`, nie `hono/client`** – RPC typy by museli ťahať typy Workers runtime do frontendového tsconfigu (kolízia s DOM typmi). DTO v `shared/` dodržia pravidlo hraníc: `src/` a `worker/` sa navzájom nepoznajú.
- **Font cez `@fontsource-variable/nunito`, nie Google Fonts** – PWA musí fungovať offline, font je súčasťou buildu.

## Global Constraints

- Node 22, balíčky cez npm, `package-lock.json` v gite.
- Jazyk UI je slovenčina, texty priamo v komponentoch.
- `src/` neimportuje z `worker/`, `worker/` neimportuje zo `src/`; obe smú importovať zo `shared/`.
- Všetky API odpovede sú JSON; chyba má tvar `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- Každá DB query na dáta domácnosti filtruje `household_id` prihláseného používateľa.
- ID sú ULID (text), časy ISO 8601 text v UTC.
- Tailwind bez preflight, prefix `tw` (triedy `tw:flex`), farby mapované na Vuetify CSS premenné.
- Žiadne tajomstvá ani osobné e-maily v gite: `.dev.vars` je v `.gitignore`, produkčné hodnoty idú cez `wrangler secret put`.
- Free plán Cloudflare: žiadne platené funkcie (žiadne Durable Objects v tejto fáze).

## Review Focus

1. **Chýbajúci, expirovaný alebo cudzí Access JWT na produkčnom hostname** → 401; dev bypass sa nesmie uplatniť mimo `localhost`/`127.0.0.1`, ani keď je `DEV_USER_EMAIL` omylom nastavený. Test v Task 4.
2. **E-mail s inou veľkosťou písmen alebo medzerami** (`Jan@X.sk` v JWT, ` jan@x.sk ` v `ALLOWED_EMAILS`) → používateľ je povolený a je to ten istý záznam. Test v Task 4.
3. **Dvaja používatelia sa prihlásia prvýkrát naraz / opakované volanie `/me`** → vznikne práve jedna domácnosť a predvolené sloty a kategórie sa nezduplikujú. Test v Task 3 (idempotencia) a Task 4.
4. **Neznáma API cesta** (`/api/v1/neexistuje`) → JSON 404, nie `index.html`; **hlboký link SPA** (`/recepty/123` po F5) → `index.html`. Test v Task 4 (API) a ručná kontrola v Task 7 (SPA).
5. **Service worker nesmie podsunúť `index.html` namiesto `/api/*` a `/cdn-cgi/*`** (Access login) → `navigateFallbackDenylist`. Kontrola konfigurácie v Task 7.

## Štruktúra súborov

```
package.json, package-lock.json, tsconfig.json, tsconfig.app.json, tsconfig.worker.json, tsconfig.node.json
vite.config.ts, vitest.config.ts, drizzle.config.ts, wrangler.jsonc, worker-configuration.d.ts (generované)
eslint.config.js, .prettierrc.json, .dev.vars.example, index.html, README.md, CLAUDE.md
public/                     favicon.svg, pwa-*.png, apple-touch-icon-180x180.png, maskable-icon-512x512.png
shared/ids.ts               newId()
shared/units.ts             jednotky, prevody, formátovanie množstva
shared/api.ts               DTO typy API (MeResponse, ApiErrorBody, ExportFile …)
worker/index.ts             export default { fetch } → createApp()
worker/app.ts               createApp(deps): Hono app, error handling, routy
worker/env.ts               AppEnv typ (Bindings + Variables)
worker/errors.ts            HttpError, onError, notFound
worker/middleware/auth.ts   resolveEmail, isAllowedEmail, authMiddleware
worker/db/client.ts         getDb(env)
worker/db/schema.ts         celá Drizzle schéma
worker/db/migrations/       generované drizzle-kit
worker/services/household.ts  ensureHousehold, ensureUser, DEFAULT_HOUSEHOLD_ID
worker/services/export.ts   exportHousehold(db, householdId)
worker/routes/me.ts, worker/routes/export.ts
src/main.ts, src/App.vue
src/plugins/vuetify.ts, src/plugins/query.ts
src/design/tokens.ts, src/design/settings.scss
src/styles/main.css         tailwind + font + globálne
src/router/index.ts
src/api/http.ts, src/api/me.ts
src/components/AppShell.vue, src/components/EmptyState.vue, src/components/navigation.ts
src/features/recipes/pages/RecipesPage.vue
src/features/meal-plan/pages/MealPlanPage.vue
src/features/shopping/pages/ShoppingPage.vue
src/features/family/pages/FamilyPage.vue
src/features/settings/pages/SettingsPage.vue, src/features/settings/pages/MorePage.vue
src/pages/NotFoundPage.vue
tests/unit/units.test.ts, tests/unit/http.test.ts, tests/unit/AppShell.test.ts, tests/unit/setup.ts
tests/worker/setup.ts, tests/worker/schema.test.ts, tests/worker/auth.test.ts, tests/worker/api.test.ts, tests/worker/helpers.ts
```

---

### Task 1: Kostra projektu a build

**Files:**
- Create: `package.json`, `tsconfig*.json`, `vite.config.ts`, `wrangler.jsonc`, `index.html`, `src/main.ts`, `src/App.vue`, `worker/index.ts`, `.dev.vars.example`, `.prettierrc.json`, `eslint.config.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm skripty `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `cf-typegen`, `db:generate`, `db:migrate:local`, `db:migrate:remote`, `deploy`; globálny typ `Env` z `worker-configuration.d.ts`.

- [ ] **Step 1: Inicializácia a závislosti**

```bash
npm init -y
npm install vue@^3.5 vue-router@^5 vuetify@^4.2 @mdi/js @tanstack/vue-query@^5 hono@^4.13 zod@^4 drizzle-orm@^0.45 jose@^6 ulidx@^2 idb-keyval@^6 @fontsource-variable/nunito
npm install -D vite@^8 @vitejs/plugin-vue@^6 vite-plugin-vuetify@^2.1 sass-embedded tailwindcss@^4.3 @tailwindcss/vite@^4.3 @cloudflare/vite-plugin wrangler@^4.147 vite-plugin-pwa@^2 @vite-pwa/assets-generator drizzle-kit@^0.31 typescript@~6.0 vue-tsc@^3.3 vitest@~4.1 @vitest/runner@~4.1 @vitest/snapshot@~4.1 @cloudflare/vitest-plugin @vue/test-utils jsdom eslint @eslint/js typescript-eslint eslint-plugin-vue prettier
```

- [ ] **Step 2: `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "kucharska-kniha",
  "main": "./worker/index.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/img/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "kucharska-kniha-db",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "worker/db/migrations"
    }
  ],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "kucharska-kniha-img" }],
  "observability": { "enabled": true }
}
```
`database_id` sa nahradí skutočným ID po `wrangler d1 create` (Task 9). `ALLOWED_EMAILS`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` nie sú vo `vars` – lokálne idú z `.dev.vars`, v produkcii cez `wrangler secret put` (prežijú deploy).

- [ ] **Step 3: `.dev.vars.example`** (skopírovať na `.dev.vars`)

```
DEV_USER_EMAIL=ja@example.com
ALLOWED_EMAILS=ja@example.com,manzelka@example.com
ACCESS_TEAM_DOMAIN=
ACCESS_AUD=
```

- [ ] **Step 4: `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: { configFile: 'src/design/settings.scss' } }),
    tailwindcss(),
    cloudflare(),
    VitePWA(/* Task 7 */),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
```

- [ ] **Step 5: tsconfigy** – `tsconfig.json` s `references` na `tsconfig.app.json` (include `src`, `shared`, `env.d.ts`; lib DOM; types `vite/client`, `vite-plugin-pwa/vue`), `tsconfig.worker.json` (include `worker`, `shared`, `worker-configuration.d.ts`; lib ES2023, bez DOM) a `tsconfig.node.json` (konfiguračné súbory a `tests`). Všetky `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `paths` pre `@/*` a `@shared/*`.

- [ ] **Step 6: Minimálny `worker/index.ts`, `index.html`, `src/main.ts`, `src/App.vue`** (App zobrazí „Kuchárska kniha“, Worker vráti `{ ok: true }` na `/api/v1/health`).

- [ ] **Step 7: Skripty v `package.json`**

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "npm run build && vite preview",
    "typecheck": "vue-tsc -b",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "cf-typegen": "wrangler types",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply kucharska-kniha-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply kucharska-kniha-db --remote",
    "deploy": "npm run build && wrangler deploy"
  }
}
```

- [ ] **Step 8: Overenie**

Run: `npm run cf-typegen && npm run build`
Expected: build prejde, v `dist/` je klientská časť aj Worker.

Run: `npm run dev` a `curl http://localhost:5173/api/v1/health`
Expected: `{"ok":true}`; `http://localhost:5173/` vráti HTML s „Kuchárska kniha“.

- [ ] **Step 9: Commit** – `chore: kostra projektu (Vite, Vue, Vuetify, Tailwind, Cloudflare Worker)`

---

### Task 2: Zdieľané utility – ID a jednotky

**Files:**
- Create: `shared/ids.ts`, `shared/units.ts`, `vitest.config.ts`
- Test: `tests/unit/units.test.ts`

**Interfaces:**
- Produces:
  - `newId(): string` – ULID.
  - `UNITS: readonly UnitDef[]`, `type UnitCode = 'g'|'kg'|'ml'|'l'|'ks'|'PL'|'ČL'|'šálka'|'balenie'|'štipka'`
  - `toBase(quantity: number, unit: UnitCode): { quantity: number; unit: UnitCode }` – kg→g, l→ml, ostatné bez zmeny.
  - `formatQuantity(quantity: number | null, unit: UnitCode | null): string` – slovenská desatinná čiarka, g≥1000 → kg, ml≥1000 → l, max 2 desatinné miesta, bez koncových núl.
  - `isUnitCode(value: string): value is UnitCode`

- [ ] **Step 1: Failing test `tests/unit/units.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { formatQuantity, isUnitCode, toBase, UNITS } from '@shared/units'

describe('toBase', () => {
  it('prevedie kg na g a l na ml', () => {
    expect(toBase(1.25, 'kg')).toEqual({ quantity: 1250, unit: 'g' })
    expect(toBase(0.5, 'l')).toEqual({ quantity: 500, unit: 'ml' })
  })
  it('nemení jednotky bez prevodu', () => {
    expect(toBase(2, 'PL')).toEqual({ quantity: 2, unit: 'PL' })
    expect(toBase(3, 'ks')).toEqual({ quantity: 3, unit: 'ks' })
  })
})

describe('formatQuantity', () => {
  it('používa desatinnú čiarku a odstráni koncové nuly', () => {
    expect(formatQuantity(1.5, 'ks')).toBe('1,5 ks')
    expect(formatQuantity(2.0, 'PL')).toBe('2 PL')
    expect(formatQuantity(0.333333, 'šálka')).toBe('0,33 šálka')
  })
  it('povýši g na kg a ml na l od 1000', () => {
    expect(formatQuantity(1250, 'g')).toBe('1,25 kg')
    expect(formatQuantity(999, 'g')).toBe('999 g')
    expect(formatQuantity(1500, 'ml')).toBe('1,5 l')
  })
  it('zvládne chýbajúce množstvo alebo jednotku', () => {
    expect(formatQuantity(null, 'štipka')).toBe('štipka')
    expect(formatQuantity(3, null)).toBe('3')
    expect(formatQuantity(null, null)).toBe('')
  })
  it('neplatné čísla nezobrazí', () => {
    expect(formatQuantity(Number.NaN, 'g')).toBe('g')
    expect(formatQuantity(-2, 'g')).toBe('g')
  })
})

describe('UNITS', () => {
  it('má unikátne kódy a isUnitCode ich rozpozná', () => {
    const codes = UNITS.map((u) => u.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(isUnitCode('kg')).toBe(true)
    expect(isUnitCode('libra')).toBe(false)
  })
})
```

- [ ] **Step 2: `vitest.config.ts`** – projekt `unit` (jsdom, `tests/unit/**`), projekt `worker` pridá Task 3.

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue(), vuetify({ autoImport: true })],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/unit/setup.ts'],
          server: { deps: { inline: ['vuetify'] } },
        },
      },
    ],
  },
})
```

- [ ] **Step 3: Run** `npx vitest run --project unit` → FAIL (modul neexistuje).

- [ ] **Step 4: Implementácia `shared/units.ts`**

```ts
export type UnitCode = 'g' | 'kg' | 'ml' | 'l' | 'ks' | 'PL' | 'ČL' | 'šálka' | 'balenie' | 'štipka'
export interface UnitDef { code: UnitCode; label: string; base?: { unit: UnitCode; factor: number } }

export const UNITS: readonly UnitDef[] = [
  { code: 'g', label: 'gram' },
  { code: 'kg', label: 'kilogram', base: { unit: 'g', factor: 1000 } },
  { code: 'ml', label: 'mililiter' },
  { code: 'l', label: 'liter', base: { unit: 'ml', factor: 1000 } },
  { code: 'ks', label: 'kus' },
  { code: 'PL', label: 'polievková lyžica' },
  { code: 'ČL', label: 'čajová lyžička' },
  { code: 'šálka', label: 'šálka' },
  { code: 'balenie', label: 'balenie' },
  { code: 'štipka', label: 'štipka' },
] as const

const byCode = new Map(UNITS.map((u) => [u.code, u]))
export const isUnitCode = (value: string): value is UnitCode => byCode.has(value as UnitCode)

export function toBase(quantity: number, unit: UnitCode): { quantity: number; unit: UnitCode } {
  const base = byCode.get(unit)?.base
  return base ? { quantity: quantity * base.factor, unit: base.unit } : { quantity, unit }
}

const PROMOTE: Partial<Record<UnitCode, UnitCode>> = { g: 'kg', ml: 'l' }
const nf = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2, useGrouping: false })

export function formatQuantity(quantity: number | null, unit: UnitCode | null): string {
  const valid = quantity !== null && Number.isFinite(quantity) && quantity > 0
  if (!valid) return unit ?? ''
  let q = quantity
  let u = unit
  const up = u ? PROMOTE[u] : undefined
  if (u && up && q >= 1000) { q = q / 1000; u = up }
  const n = nf.format(q)
  return u ? `${n} ${u}` : n
}
```

`shared/ids.ts`:
```ts
import { ulid } from 'ulidx'
export const newId = (): string => ulid()
```

`tests/unit/setup.ts`:
```ts
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
```

- [ ] **Step 5: Run** `npx vitest run --project unit` → PASS.
- [ ] **Step 6: Commit** – `feat(shared): ULID a jednotky s prevodom a formátovaním`

---

### Task 3: Databázová schéma a migrácie

**Files:**
- Create: `worker/db/schema.ts`, `worker/db/client.ts`, `drizzle.config.ts`, `worker/db/migrations/*` (generované), `tests/worker/setup.ts`, `tests/worker/env.d.ts`
- Modify: `vitest.config.ts` (projekt `worker`)
- Test: `tests/worker/schema.test.ts`

**Interfaces:**
- Consumes: `newId` zo `shared/ids.ts`, `UnitCode` zo `shared/units.ts`.
- Produces: Drizzle tabuľky `households, users, familyMembers, memberPreferences, shopCategories, ingredients, images, recipes, recipeIngredients, recipeSteps, tags, recipeTags, recipeFavorites, recipeRatings, recipeNotes, cookLog, mealSlots, mealPlanEntries, mealPlanEntryMembers, weekTemplates, weekTemplateEntries, shoppingLists, shoppingItems, shoppingItemSources, stapleItems, pantryItems, settings`; `getDb(env: { DB: D1Database }): Db`; `type Db`.

- [ ] **Step 1: `worker/db/schema.ts`** – presne podľa spec 2.4. Spoločné stĺpce:

```ts
const id = () => text('id').primaryKey().$defaultFn(newId)
const createdAt = () => text('created_at').notNull().$defaultFn(nowIso)
const updatedAt = () => text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso)
const householdRef = () => text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' })
```
Unikátne obmedzenia (kvôli idempotentnému seedu): `users.email`, `shop_categories(household_id, name)`, `meal_slots(household_id, name)`, `shopping_lists(household_id, name)`, `tags(household_id, name)`, `images.r2_key`. Indexy podľa spec 2.4. Enumy cez `text('x', { enum: [...] })`. Boolean cez `integer('x', { mode: 'boolean' })`. JSON cez `text('x', { mode: 'json' }).$type<...>()`.

- [ ] **Step 2: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({ dialect: 'sqlite', schema: './worker/db/schema.ts', out: './worker/db/migrations' })
```

- [ ] **Step 3: Generovanie** `npm run db:generate` → `worker/db/migrations/0000_*.sql`.

- [ ] **Step 4: Worker test projekt** – do `vitest.config.ts` pridať:

```ts
{
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: {
      bindings: {
        TEST_MIGRATIONS: await readD1Migrations('./worker/db/migrations'),
        ALLOWED_EMAILS: 'ja@example.com, Manzelka@Example.com ',
        DEV_USER_EMAIL: 'ja@example.com',
        ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com',
        ACCESS_AUD: 'test-aud',
      },
    },
  }))],
  resolve: { alias },
  test: { name: 'worker', include: ['tests/worker/**/*.test.ts'], setupFiles: ['tests/worker/setup.ts'] },
}
```

`tests/worker/setup.ts`:
```ts
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
```

- [ ] **Step 5: Test `tests/worker/schema.test.ts`**

```ts
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const EXPECTED = ['households','users','family_members','member_preferences','shop_categories','ingredients','images','recipes','recipe_ingredients','recipe_steps','tags','recipe_tags','recipe_favorites','recipe_ratings','recipe_notes','cook_log','meal_slots','meal_plan_entries','meal_plan_entry_members','week_templates','week_template_entries','shopping_lists','shopping_items','shopping_item_sources','staple_items','pantry_items','settings']

describe('schéma', () => {
  it('migrácie vytvoria všetky tabuľky', async () => {
    const { results } = await env.DB.prepare("select name from sqlite_master where type='table'").all<{ name: string }>()
    const names = results.map((r) => r.name)
    for (const t of EXPECTED) expect(names).toContain(t)
  })
  it('cudzie kľúče sú vynútené', async () => {
    await expect(
      env.DB.prepare("insert into users (id, household_id, email, name, created_at, updated_at) values ('u1','neexistuje','a@b.c','A','x','x')").run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })
})
```

- [ ] **Step 6: Run** `npx vitest run --project worker` → PASS.
- [ ] **Step 7: Commit** – `feat(db): kompletná schéma pre všetky fázy a migrácie`

---

### Task 4: API – chyby, prihlásenie, domácnosť, /me, /export

**Files:**
- Create: `worker/env.ts`, `worker/errors.ts`, `worker/app.ts`, `worker/middleware/auth.ts`, `worker/services/household.ts`, `worker/services/export.ts`, `worker/routes/me.ts`, `worker/routes/export.ts`, `shared/api.ts`, `tests/worker/helpers.ts`
- Modify: `worker/index.ts`
- Test: `tests/worker/auth.test.ts`, `tests/worker/api.test.ts`

**Interfaces:**
- Consumes: `getDb`, tabuľky z Task 3, `newId`.
- Produces:
  - `createApp(deps?: { accessKey?: JWTVerifyGetKey }): Hono<AppEnv>` (basePath `/api/v1`)
  - `class HttpError(status: ContentfulStatusCode, code: string, message: string, details?: unknown)`
  - `isAllowedEmail(email: string, allowed: string | undefined): boolean`
  - `ensureHousehold(db: Db): Promise<string>`, `ensureUser(db: Db, email: string): Promise<UserRow>`, `DEFAULT_HOUSEHOLD_ID = 'default'`
  - `exportHousehold(db: Db, householdId: string): Promise<ExportFile>`
  - `shared/api.ts`: `ApiErrorBody`, `MeResponse`, `UserDto`, `HouseholdDto`, `FamilyMemberDto`, `MealSlotDto`, `ExportFile`
  - Endpointy: `GET /api/v1/health` (bez auth), `GET /api/v1/me`, `GET /api/v1/export`

- [ ] **Step 1: Failing testy `tests/worker/auth.test.ts`** – podpis tokenov vlastným RSA kľúčom, ktorý sa do `createApp` vloží cez `createLocalJWKSet`:

```ts
import { env } from 'cloudflare:workers'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../worker/app'
import { isAllowedEmail } from '../../worker/middleware/auth'

let privateKey: CryptoKey
let app: ReturnType<typeof createApp>
const PROD = 'https://kucharska-kniha.example.workers.dev'

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }
  app = createApp({ accessKey: createLocalJWKSet({ keys: [jwk] }) })
})

const sign = (email: string, opts: { aud?: string; exp?: string; iss?: string } = {}) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? 'https://test.cloudflareaccess.com')
    .setAudience(opts.aud ?? 'test-aud')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey)

async function call(url: string, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext()
  const res = await app.request(url, { headers }, env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('isAllowedEmail', () => {
  it('ignoruje veľkosť písmen a medzery', () => {
    expect(isAllowedEmail('MANZELKA@example.com', ' ja@example.com , manzelka@EXAMPLE.com ')).toBe(true)
    expect(isAllowedEmail('cudzi@example.com', 'ja@example.com')).toBe(false)
  })
  it('prázdny zoznam nepovolí nikoho', () => {
    expect(isAllowedEmail('ja@example.com', '')).toBe(false)
    expect(isAllowedEmail('ja@example.com', undefined)).toBe(false)
  })
})

describe('Access JWT', () => {
  it('platný token s povoleným e-mailom prejde', async () => {
    const res = await call(`${PROD}/api/v1/me`, { 'Cf-Access-Jwt-Assertion': await sign('Ja@Example.com') })
    expect(res.status).toBe(200)
    expect((await res.json<{ user: { email: string } }>()).user.email).toBe('ja@example.com')
  })
  it('token z cookie CF_Authorization prejde', async () => {
    const res = await call(`${PROD}/api/v1/me`, { Cookie: `CF_Authorization=${await sign('ja@example.com')}` })
    expect(res.status).toBe(200)
  })
  it('bez tokenu na produkčnom hoste je 401 aj s DEV_USER_EMAIL', async () => {
    const res = await call(`${PROD}/api/v1/me`)
    expect(res.status).toBe(401)
    expect((await res.json<{ error: { code: string } }>()).error.code).toBe('unauthorized')
  })
  it('zlé aud, expirovaný a cudzí issuer sú 401', async () => {
    for (const token of [await sign('ja@example.com', { aud: 'iny' }), await sign('ja@example.com', { exp: '-1m' }), await sign('ja@example.com', { iss: 'https://zly.example.com' })]) {
      expect((await call(`${PROD}/api/v1/me`, { 'Cf-Access-Jwt-Assertion': token })).status).toBe(401)
    }
  })
  it('nepovolený e-mail je 403', async () => {
    const res = await call(`${PROD}/api/v1/me`, { 'Cf-Access-Jwt-Assertion': await sign('cudzi@example.com') })
    expect(res.status).toBe(403)
  })
  it('na localhoste bez tokenu použije DEV_USER_EMAIL', async () => {
    const res = await call('http://localhost/api/v1/me')
    expect(res.status).toBe(200)
  })
  it('health nevyžaduje prihlásenie', async () => {
    expect((await call(`${PROD}/api/v1/health`)).status).toBe(200)
  })
})
```

- [ ] **Step 2: Failing testy `tests/worker/api.test.ts`**

```ts
// rovnaký call() helper z tests/worker/helpers.ts (createApp() bez deps, localhost → dev bypass)
describe('/me', () => {
  it('prvé volanie vytvorí domácnosť so seedom, opakované nič neduplikuje', async () => {
    const [a, b] = await Promise.all([call('http://localhost/api/v1/me'), call('http://localhost/api/v1/me')])
    expect(a.status).toBe(200); expect(b.status).toBe(200)
    await call('http://localhost/api/v1/me')
    const me = await (await call('http://localhost/api/v1/me')).json<MeResponse>()
    expect(me.household.id).toBe('default')
    expect(me.slots.map((s) => s.name)).toEqual(['Raňajky', 'Desiata', 'Obed', 'Olovrant', 'Večera'])
    const households = await env.DB.prepare('select count(*) as n from households').first<{ n: number }>()
    const users = await env.DB.prepare('select count(*) as n from users').first<{ n: number }>()
    const slots = await env.DB.prepare('select count(*) as n from meal_slots').first<{ n: number }>()
    expect([households?.n, users?.n, slots?.n]).toEqual([1, 1, 5])
  })
  it('druhý povolený používateľ sa pridá do tej istej domácnosti', async () => { /* ensureUser(db,'manzelka@example.com') → householdId 'default' */ })
})
describe('/export', () => {
  it('vráti všetky tabuľky domácnosti ako stiahnuteľný JSON', async () => {
    const res = await call('http://localhost/api/v1/export')
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="kucharska-kniha-\d{4}-\d{2}-\d{2}\.json"/)
    const body = await res.json<ExportFile>()
    expect(body.format).toBe('kucharska-kniha-export'); expect(body.version).toBe(1)
    expect(body.tables.mealSlots).toHaveLength(5)
    expect(body.tables.shopCategories.length).toBeGreaterThan(5)
    expect(body.tables.shoppingLists).toHaveLength(1)
    expect(Object.keys(body.tables)).toHaveLength(27)
  })
})
describe('chyby', () => {
  it('neznáma API cesta je JSON 404', async () => {
    const res = await call('http://localhost/api/v1/neexistuje')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('not_found')
  })
})
```

- [ ] **Step 3: Run** `npx vitest run --project worker` → FAIL.

- [ ] **Step 4: Implementácia**
  - `worker/errors.ts`: `HttpError`, `onError` (HttpError → jeho status; `ZodError` → 400 `validation_error` s `issues`; ostatné → `console.error` + 500 `internal_error`), `notFound` → 404 `not_found`.
  - `worker/middleware/auth.ts`:
    - `isAllowedEmail` – split podľa `,`, trim, lowercase, porovnanie.
    - `resolveEmail(c, accessKey?)` – token z `Cf-Access-Jwt-Assertion` alebo cookie `CF_Authorization`. S tokenom: ak chýba `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` → 500 `auth_misconfigured`; `jwtVerify(token, accessKey ?? remoteJwks(team), { issuer: 'https://' + team, audience: aud })`, chyba → 401 `unauthorized`; `payload.email` musí byť string. Bez tokenu: ak `DEV_USER_EMAIL` a hostname je `localhost`/`127.0.0.1`/`[::1]` → dev e-mail; inak 401.
    - `remoteJwks(team)` – cache `createRemoteJWKSet(new URL('https://' + team + '/cdn-cgi/access/certs'))` v module-level `Map`.
    - `authMiddleware(deps)` – `email.trim().toLowerCase()`, `isAllowedEmail` → inak 403 `forbidden`, `ensureUser`, `c.set('user')`, `c.set('db')`.
  - `worker/services/household.ts`: `ensureHousehold` – ak `households` s id `default` neexistuje, jeden `db.batch([...])`: insert domácnosti + seed (5 slotov, 11 kategórií obchodu, zoznam „Nákup“, settings `weekStartsOn=1`, `childPortionFactor=0.5`), všetko s `onConflictDoNothing()`. `ensureUser` – select podľa e-mailu; ak nie je, `ensureHousehold`, insert s `onConflictDoNothing()` (meno = časť e-mailu pred `@`), znovu select.
  - `worker/services/export.ts`: jeden `db.batch` so select na každú z 27 tabuliek, filtrované cez `household_id` alebo cez `inArray(parentId, subquery)` pre podriadené tabuľky.
  - `worker/routes/me.ts`, `worker/routes/export.ts`, `worker/app.ts` (`new Hono<AppEnv>().basePath('/api/v1')`, `health` pred auth, `use('*', authMiddleware(deps))`, `route('/me')`, `route('/export')`, `onError`, `notFound`), `worker/index.ts` → `export default { fetch: createApp().fetch } satisfies ExportedHandler<Env>`.

- [ ] **Step 5: Run** `npx vitest run --project worker` → PASS.
- [ ] **Step 6: Commit** – `feat(api): prihlásenie cez Cloudflare Access, domácnosť, /me a /export`

---

### Task 5: Design systém – Vuetify téma, defaults, Tailwind

**Files:**
- Create: `src/design/tokens.ts`, `src/design/settings.scss`, `src/plugins/vuetify.ts`, `src/styles/main.css`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `vuetify` inštancia s témami `light` (predvolená) a `dark`; `tokens` (`colors.light`, `colors.dark`, `radius`); Tailwind triedy `tw:*` s farbami `primary, secondary, surface, background, on-surface, error, success, warning, info`.

- [ ] **Step 1: `src/design/tokens.ts`** – paleta: primary terakota `#B4532A`, secondary olivová `#5F7A3A`, background krémová `#FBF7F1`, surface `#FFFFFF`, surface-variant `#F2EBE1`, on-background `#2B2420`, error `#B3261E`, success `#3F7D3A`, warning `#B7791F`, info `#36677F`; tmavá verzia s tými istými menami.
- [ ] **Step 2: `src/plugins/vuetify.ts`** – `createVuetify({ theme: { defaultTheme: 'light', themes }, defaults, locale: { locale: 'sk', messages: { sk } }, icons: { defaultSet: 'mdi', aliases, sets: { mdi } } })` s `mdi-svg` setom; `defaults` podľa spec 2.7 (`VBtn rounded lg flat`, `VCard rounded xl flat border`, `VTextField/VSelect/VTextarea/VAutocomplete outlined comfortable`, `VChip rounded lg`, `VAppBar flat`, `VBottomNavigation grow`).
- [ ] **Step 3: `src/design/settings.scss`** – `@use 'vuetify/settings' with ($body-font-family: ('Nunito Variable', system-ui, sans-serif), $border-radius-root: 12px);`
- [ ] **Step 4: `src/styles/main.css`** – poradie vrstiev tak, aby Tailwind utility vyhrali nad Vuetify (presné mená vrstiev Vuetify overiť v `node_modules/vuetify/lib/styles/main.css`):

```css
@layer theme, base, vuetify, components, utilities;
@import 'tailwindcss/theme.css' layer(theme) prefix(tw);
@import 'tailwindcss/utilities.css' layer(utilities);
@import '@fontsource-variable/nunito';

@theme inline {
  --color-primary: rgb(var(--v-theme-primary));
  --color-secondary: rgb(var(--v-theme-secondary));
  --color-surface: rgb(var(--v-theme-surface));
  --color-background: rgb(var(--v-theme-background));
  --color-on-surface: rgb(var(--v-theme-on-surface));
  --color-error: rgb(var(--v-theme-error));
  --color-success: rgb(var(--v-theme-success));
  --color-warning: rgb(var(--v-theme-warning));
  --color-info: rgb(var(--v-theme-info));
}
```
- [ ] **Step 5: Overenie** – `npm run build` prejde; v `npm run dev` ukážková stránka s `v-btn color="primary"` a `<div class="tw:bg-primary tw:p-4">` má rovnakú farbu (kontrola v prehliadači, výpočtom `getComputedStyle`).
- [ ] **Step 6: Commit** – `feat(ui): design systém – Vuetify téma, defaults, Tailwind s prefixom`

---

### Task 6: App shell, routing, API klient, Nastavenia s exportom

**Files:**
- Create: `src/router/index.ts`, `src/components/navigation.ts`, `src/components/AppShell.vue`, `src/components/EmptyState.vue`, `src/api/http.ts`, `src/api/me.ts`, `src/plugins/query.ts`, `src/features/*/pages/*.vue`, `src/pages/NotFoundPage.vue`
- Modify: `src/App.vue`, `src/main.ts`
- Test: `tests/unit/http.test.ts`, `tests/unit/AppShell.test.ts`

**Interfaces:**
- Consumes: `MeResponse`, `ApiErrorBody` zo `shared/api.ts`; `/api/v1/me`, `/api/v1/export`.
- Produces:
  - `class ApiError extends Error { status: number; code: string; details?: unknown }`
  - `apiFetch<T>(path: string, init?: RequestInit, opts?: { fetchFn?: typeof fetch; onUnauthorized?: () => void }): Promise<T>` – prefix `/api/v1`, JSON, pri 401 zavolá `onUnauthorized` (predvolene `location.reload()` → Access login) a hodí `ApiError`.
  - `downloadFile(path: string, fallbackName: string): Promise<void>`
  - `useMe()` – `useQuery({ queryKey: ['me'], queryFn })`
  - `NAV_ITEMS: { to: string; title: string; icon: string }[]` – Recepty, Plán, Nákup, Viac
  - Routy: `/` → `/recepty`, `/recepty`, `/plan`, `/nakup`, `/viac`, `/rodina`, `/nastavenia`, `/:pathMatch(.*)*`

- [ ] **Step 1: Failing test `tests/unit/http.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from '@/api/http'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('apiFetch', () => {
  it('pridá /api/v1 a vráti JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await expect(apiFetch('/me', undefined, { fetchFn })).resolves.toEqual({ ok: true })
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/me')
  })
  it('chybu API prevedie na ApiError s kódom', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(403, { error: { code: 'forbidden', message: 'Nemáš prístup' } }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ status: 403, code: 'forbidden', message: 'Nemáš prístup' })
  })
  it('pri 401 zavolá onUnauthorized', async () => {
    const onUnauthorized = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'x' } }))
    await expect(apiFetch('/me', undefined, { fetchFn, onUnauthorized })).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
  it('odpoveď bez JSON (napr. HTML z Access) je ApiError, nie pád parsera', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ code: 'invalid_response' })
  })
  it('výpadok siete je ApiError network_error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })
})
```

- [ ] **Step 2: Failing test `tests/unit/AppShell.test.ts`** – mount `AppShell` s vuetify + memory routerom, overí, že sú 4 navigačné položky s textami Recepty, Plán, Nákup, Viac a že slot obsahu sa vyrenderuje.

- [ ] **Step 3: Run** `npx vitest run --project unit` → FAIL.

- [ ] **Step 4: Implementácia** – `AppShell`: `v-app-bar` s názvom, na `mdAndUp` `v-navigation-drawer` `rail` s `NAV_ITEMS`, inak `v-bottom-navigation` (`useDisplay()`); `v-main` s kontajnerom `max-width: 1200px`. `EmptyState` (ikona, nadpis, text, slot pre akciu). Stránky Recepty/Plán/Nákup/Rodina: `EmptyState` s textom „Príde vo fáze N“. `MorePage`: zoznam odkazov Rodina, Nastavenia. `SettingsPage`: `useMe()` → meno, e-mail, domácnosť, počet slotov; tlačidlo „Exportovať dáta“ → `downloadFile('/export', ...)`, chyba → `v-snackbar`. `NotFoundPage`. `query.ts`: `QueryClient` so `staleTime: 30_000`, `retry` nie pri 4xx.

- [ ] **Step 5: Run** `npx vitest run --project unit` → PASS; `npm run typecheck` čistý.
- [ ] **Step 6: Overenie v prehliadači** – `npm run dev`, mobil (375×812) aj desktop: bottom nav vs. rail, prepínanie stránok, Nastavenia zobrazia dev používateľa, export stiahne JSON.
- [ ] **Step 7: Commit** – `feat(ui): app shell, navigácia, nastavenia s exportom dát`

---

### Task 7: PWA

**Files:**
- Create: `public/favicon.svg`, `pwa-assets.config.ts`, vygenerované PNG ikony v `public/`
- Modify: `vite.config.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: Ikona** – `public/favicon.svg` (hrniec na terakotovom kruhu), `pwa-assets.config.ts` s `minimal2023Preset`, `npx pwa-assets-generator` → `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`.
- [ ] **Step 2: `VitePWA` konfigurácia**

```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
  manifest: {
    name: 'Kuchárska kniha', short_name: 'Kniha', lang: 'sk', start_url: '/', display: 'standalone',
    background_color: '#FBF7F1', theme_color: '#B4532A',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/img\//, /^\/cdn-cgi\//],
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    runtimeCaching: [
      { urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/') && !url.pathname.startsWith('/api/v1/export'), handler: 'NetworkFirst', method: 'GET', options: { cacheName: 'api', networkTimeoutSeconds: 4, expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 } } },
      { urlPattern: ({ url }) => url.pathname.startsWith('/img/'), handler: 'CacheFirst', options: { cacheName: 'img', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
    ],
  },
})
```
- [ ] **Step 3: `index.html`** – `lang="sk"`, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`.
- [ ] **Step 4: Overenie** – `npm run preview`: manifest dostupný, SW zaregistrovaný, `/recepty/123` po obnovení vráti aplikáciu, `/api/v1/neexistuje` JSON 404, v `dist` je `sw.js` s denylistom.
- [ ] **Step 5: Commit** – `feat(pwa): manifest, ikony, service worker s offline cache`

---

### Task 8: Lint, formát, CI kontrola

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (`check` = typecheck + lint + test)

- [ ] **Step 1:** ESLint flat config: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-vue` `flat/recommended`, ignorovať `dist`, `worker-configuration.d.ts`, `worker/db/migrations`, `dev-dist`.
- [ ] **Step 2:** Prettier: `{ "semi": false, "singleQuote": true, "printWidth": 110 }`.
- [ ] **Step 3: Run** `npm run format && npm run check` → všetko zelené.
- [ ] **Step 4: Commit** – `chore: eslint, prettier, skript check`

---

### Task 9: Dokumentácia a príprava nasadenia

**Files:**
- Create: `README.md`, `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md` (odchýlky z hlavičky plánu)

- [ ] **Step 1: README** – lokálny vývoj (`npm install`, `cp .dev.vars.example .dev.vars`, `npm run db:migrate:local`, `npm run dev`), testy, a postup nasadenia: `npx wrangler login`, `npx wrangler d1 create kucharska-kniha-db` (ID do `wrangler.jsonc`), `npx wrangler r2 bucket create kucharska-kniha-img`, `npm run db:migrate:remote`, `npm run deploy`, nastavenie Zero Trust Access (self-hosted aplikácia, policy pre 2 e-maily, One-time PIN, session 1 mesiac), `npx wrangler secret put ALLOWED_EMAILS|ACCESS_TEAM_DOMAIN|ACCESS_AUD`, voliteľne Workers Builds z GitHubu.
- [ ] **Step 2: CLAUDE.md** – krátke pravidlá projektu: hranice `src`/`worker`/`shared`, príkazy, kde je spec a plány, slovenčina v UI.
- [ ] **Step 3: Úprava spec** – odchýlky uvedené na začiatku plánu.
- [ ] **Step 4: Finálne overenie** – `npm run check && npm run build`.
- [ ] **Step 5: Commit** – `docs: README s nasadením, CLAUDE.md, aktualizácia spec`

---

## Čo táto fáza zámerne nerobí

- Skutočné nasadenie na Cloudflare: vyžaduje tvoj účet a prihlásenie `wrangler login` (README obsahuje presný postup).
- Upload obrázkov (`/img`, `POST /images`): ide do fázy 1 s editorom receptu; R2 binding je pripravený.
- Import JSON (`POST /import`): fáza 1, keď budú existovať dáta na import.
- Offline fronta zápisov: fáza 3 s nákupným zoznamom.
