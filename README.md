# Kuchárska kniha

Rodinná webová aplikácia (PWA) na recepty, týždenný jedálniček a nákupný zoznam. Beží celá zadarmo na Cloudflare:
jeden Worker servíruje Vue frontend aj API, dáta sú v D1, fotky v R2 a prihlásenie rieši Cloudflare Access.

- Návrh a fázy: [docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md](docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md)
- Prieskum a zoznam nápadov: [docs/2026-10-05-napady-a-prieskum-hostingu.md](docs/2026-10-05-napady-a-prieskum-hostingu.md)

## Čo aplikácia vie

- **Recepty:** ingrediencie s množstvom a jednotkou, postup, tagy, fotka (zmenšená v prehliadači), obľúbené, vyhľadávanie bez diakritiky aj podľa ingrediencie.
- **Katalóg ingrediencií:** pribúda sám pri písaní receptov, každej sa dá nastaviť kategória obchodu a jednotka.
- **Rodina:** dospelí a deti s veľkosťou porcie.
- **Týždenný jedálniček:** recept alebo vlastný text do jedla dňa, porcie podľa rodiny, presun, kópia a kopírovanie celého týždňa.
- **Záloha:** export všetkých dát do JSON.

- **Nákupný zoznam:** vygenerovaný z jedálnička podľa porcií rodiny (sčítané ingrediencie, prevody jednotiek, zaokrúhlenie pre obchod), ručné položky jedným riadkom („2 kg zemiaky“), skupiny podľa kategórie obchodu, odškrtávanie zdieľané medzi vami aj bez signálu.

## Technológie

Vue 3 · Vuetify 4 · TanStack Query · vite-plugin-pwa · Hono · Drizzle ORM · Cloudflare
Workers + D1 + R2 · Vitest (+ Workers runtime cez `@cloudflare/vitest-plugin`).

## Lokálny vývoj

Potrebuješ Node 22 alebo novší.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Aplikácia beží na <http://localhost:5180>. Lokálne sa prihlasuješ automaticky ako `DEV_USER_EMAIL` z `.dev.vars`.
Tento režim funguje len na `localhost`, v produkcii sa nikdy neuplatní.

| Príkaz                     | Čo robí                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Vite + lokálny Worker (Miniflare) s lokálnou D1 a R2        |
| `npm test`                 | unit testy (jsdom) a testy API v reálnom Workers runtime    |
| `npm run check`            | typecheck, lint, formát a testy – spusti pred commitom      |
| `npm run build`            | produkčný build do `dist/`                                  |
| `npm run preview`          | build + lokálny náhľad produkcie na <http://localhost:5181> |
| `npm run db:generate`      | po zmene `worker/db/schema.ts` vygeneruje novú SQL migráciu |
| `npm run db:migrate:local` | aplikuje migrácie na lokálnu D1                             |
| `npm run cf-typegen`       | po zmene `wrangler.jsonc` pregeneruje typy bindingov        |

## Nasadenie na Cloudflare (raz, zadarmo)

Stačí bezplatný Cloudflare účet. Kreditnú kartu Workers, D1, R2 ani Zero Trust Free nevyžadujú; ak by ju
niektorý krok pýtal, zastav sa a over, že máš vybraný Free plán.

1. **Prihlásenie wranglera**

   ```bash
   npx wrangler login
   ```

2. **Databáza a úložisko fotiek**

   ```bash
   npx wrangler d1 create kucharska-kniha-db
   npx wrangler r2 bucket create kucharska-kniha-img
   ```

   `database_id` z výstupu prvého príkazu vlož do `wrangler.jsonc` namiesto núl a commitni.

3. **Migrácie a prvý deploy**

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

   Worker beží na `https://cook-book.jakub-matisak.workers.dev`. Kým nezapneš Access, API vracia 401,
   takže dáta nie sú prístupné.

4. **Cloudflare Access (prihlásenie)**
   - Dashboard → Workers & Pages → `cook-book` → Settings → Domains & Routes → pri `workers.dev` zapni
     **Cloudflare Access**. Zapni ho aj pre Preview URLs.
   - Okno ukáže `POLICY_AUD` a `TEAM_DOMAIN`; obe si skopíruj.
   - Zero Trust → Access → Applications → otvor vytvorenú aplikáciu → Policies: ponechaj len pravidlo **Allow**
     s tvojím a manželkiným e-mailom.
   - Login method nechaj **One-time PIN** (kód príde e-mailom) alebo pridaj Google.
   - Session duration nastav na **1 month**, aby sa nainštalovaná PWA nemusela prihlasovať každý deň.

5. **Tajomstvá Workera** (prežijú ďalšie deploye)

   ```bash
   npx wrangler secret put ACCESS_TEAM_DOMAIN
   npx wrangler secret put ACCESS_AUD
   npx wrangler secret put ALLOWED_EMAILS
   ```

   `ACCESS_TEAM_DOMAIN` je `TEAM_DOMAIN` (napr. `tvoj-tim.cloudflareaccess.com`), `ACCESS_AUD` je `POLICY_AUD`,
   `ALLOWED_EMAILS` sú e-maily oddelené čiarkou. Aplikácia overuje podpis Access tokenu aj zoznam e-mailov,
   takže ochrana platí aj keby Access niekto omylom vypol.

6. **Inštalácia na mobil**
   - Android (Chrome): menu → Inštalovať aplikáciu.
   - iPhone (Safari): Zdieľať → Pridať na plochu.

### Automatický deploy z GitHubu (voliteľné)

Dashboard → Workers & Pages → `cook-book` → Settings → Builds → pripoj GitHub repozitár. Build command
`npm run build`, deploy command `npx wrangler deploy`. Migrácie pri zmene schémy spúšťaj ručne
`npm run db:migrate:remote` pred pushom.

## Záloha

Nastavenia → **Exportovať dáta** stiahne celú domácnosť ako JSON. D1 navyše drží 7 dní histórie (Time Travel).

## Štruktúra

```
src/      frontend (Vue) – features/<doména>/pages, components, api, plugins, design
worker/   backend (Hono na Workers) – routes, services, middleware, db (schéma + migrácie)
shared/   typy a čisté funkcie zdieľané frontendom aj backendom
tests/    unit/ (jsdom) a worker/ (Workers runtime + D1)
```
