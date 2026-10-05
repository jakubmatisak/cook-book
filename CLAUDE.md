# Kuchárska kniha – pravidlá projektu

Rodinná PWA: recepty, týždenný jedálniček, nákupný zoznam. Jeden Cloudflare Worker (Hono API + statický Vue SPA),
D1 cez Drizzle, R2 na fotky, prihlásenie Cloudflare Access. Všetko na free pláne.

- Spec (architektúra, dátový model, fázy): `docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md`
- Plány fáz: `docs/superpowers/plans/`

## Hranice kódu

- `src/` (frontend) a `worker/` (backend) sa navzájom neimportujú. Obe smú importovať len zo `shared/`.
- DTO typy API patria do `shared/api.ts`; frontend volá API len cez `src/api/` (`apiFetch`).
- Každá DB query na dáta domácnosti filtruje `householdId` z `c.get('user')`.
- Chyby API vždy cez `HttpError` → `{ error: { code, message, details? } }`.
- Schéma v `worker/db/schema.ts` už obsahuje tabuľky pre všetky fázy. Zmena schémy = `npm run db:generate` a commit
  vygenerovanej migrácie.

## UI

- Texty sú po slovensky priamo v komponentoch.
- Vzhľad sa mení v `src/design/tokens.ts` (farby), `src/plugins/vuetify.ts` (defaults) a `src/design/settings.scss`
  (SASS premenné). Nepíš farby natvrdo do komponentov.
- Len Vuetify: komponenty, ich props (variant, density, color, rounded) a utility triedy (`d-flex`, `ga-2`, `pa-4`, `text-h5`…). Žiadny Tailwind, žiadne `<style>` bloky ani vlastné `<button>`/`<div>` widgety; inline `style` len tam, kde Vuetify nemá prop (šírka stĺpca a pod.).
- Spoločné časti: `PageHeader` (nadpis + akcie), `EmptyState` (v-empty-state).
- Mobil je prvý; desktopová bočná lišta od Vuetify `mdAndUp` (840 px).

## Príkazy

- `npm run dev` – <http://localhost:5180> (5173 je obsadený iným projektom)
- `npm run check` – typecheck, lint, formát, testy; musí prejsť pred commitom
- `npx vitest run --project unit` / `--project worker`

## Testy

- Logika (shared, worker/services) a API routy: TDD, testy v `tests/unit` a `tests/worker`.
- Worker testy bežia v skutočnom Workers runtime s D1; `tests/worker/setup.ts` maže dáta pred každým testom.
- Vstavaný prehliadač Claude desktop aplikácie neregistruje service workery; PWA over v Playwright Chromiu.
