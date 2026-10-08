# Kuchárska kniha (Family Cookbook)

A private family web app (PWA) for recipes, a weekly meal plan and a shopping list. It runs entirely on the
free tier of Cloudflare: one Worker serves the Vue frontend and the API, data lives in D1, photos in R2 and
sign-in is handled by Cloudflare Access.

> The app UI is in **Slovak and English**. This README is in English first, [Slovenská verzia](#slovenská-verzia) is below.
> Status: **1.4.3**.

- Website with screenshots: <https://jakubmatisak.github.io/cook-book-website/>
- Design and phases: [docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md](docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md) (Slovak)
- Research and idea list: [docs/2026-10-05-napady-a-prieskum-hostingu.md](docs/2026-10-05-napady-a-prieskum-hostingu.md) (Slovak)

## Features

- **Recipes:** ingredients with quantity and unit, steps with timers, tags, a photo (resized in the browser),
  favourites, accent-insensitive search by title or ingredient.
- **Recipe list:** grid or table view, a filter panel with counts (category, time, difficulty, tags), sorting by
  name, date added, time, difficulty and when it was last cooked.
- **Import from the web:** paste a link, the app reads schema.org data (JSON-LD or microdata), fills in the title,
  ingredients, steps and photo, and you review it before saving. Imported recipes get the tag _Z internetu_.
- **Cooking:** portion scaling, a cooking mode with step checklist, timers and the screen kept awake, dark mode.
- **Ingredient catalogue:** a built-in starter list of about 200 common Slovak ingredients with units and store
  categories (added automatically once), rename and delete.
- **Households, owners and members:** one person can belong to several households (for example their own and their
  parents'). Each household has its own recipes, meal plan, shopping list, pantry and family. Someone who belongs
  to a single household goes straight in, otherwise they pick one (and can switch from the header). Owners
  (there can be several) invite people by e-mail, change roles and manage household settings, the family and
  backups. Members do everything around cooking.
- **Guests:** add visitors to the family with their allergies, dislikes and diets. A guest does not count towards
  portions until you pick them for a particular meal in the plan; then portions, the shopping list and warnings
  include them.
- **Public recipes:** a household owner can publish a recipe; every signed-in user (in any household) can browse
  public recipes, filter them by meal type and add a copy (with photo) to their own recipes. Copies are independent
  and private.
- **Languages and personal settings:** the whole app is available in Slovak and English. Language, appearance, the
  list view and the last-used recipe filters are saved per user (with a button to reset all filters), so they
  follow you across devices and households.
- **At the table (Family):** adults and children with portion factors; allergies, dislikes and diets produce warnings when
  planning meals.
- **Weekly meal plan:** meal slots, drag and drop, copy a week, week templates, and "what to cook today"
  suggestions based on the pantry and what you cooked recently.
- **Shopping list:** generated from the plan scaled to family portions (units are converted and summed, pantry stock
  is subtracted), recurring staple items, manual items typed as one line ("2 kg potatoes"), grouped by store
  category, ticking works offline and syncs between household members.
- **Pantry:** what you have at home with quantities and expiry dates. The "What can I cook" filter ranks recipes
  by what is missing; a setting can ignore spices, and a view shows recipes missing just one ingredient.
- **Print and export:** print a recipe, the week or the shopping list (use "Save as PDF" in the print dialog),
  export a recipe or all recipes as Markdown, full JSON backup.
- **PWA:** installable on Android and iPhone, works offline for reading and ticking the shopping list.

## Tech stack

Vue 3 · Vuetify 4 (no Tailwind, no custom CSS) · TanStack Query · vite-plugin-pwa · Hono · Drizzle ORM ·
Cloudflare Workers + D1 + R2 · Vitest (plus the Workers runtime through `@cloudflare/vitest-plugin`).

## Local development

Requires Node 22 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The app runs at <http://localhost:5180>. Locally you are signed in automatically as `DEV_USER_EMAIL` from
`.dev.vars`. This works on `localhost` only and is never active in production.

| Command                    | What it does                                                      |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run dev`              | Vite + a local Worker (Miniflare) with local D1 and R2            |
| `npm test`                 | unit tests (jsdom) and API tests in the real Workers runtime      |
| `npm run check`            | typecheck, lint, format and tests; run it before committing       |
| `npm run build`            | production build into `dist/`                                     |
| `npm run preview`          | build + local preview of production at <http://localhost:5181>    |
| `npm run db:generate`      | generate a new SQL migration after changing `worker/db/schema.ts` |
| `npm run db:migrate:local` | apply migrations to the local D1                                  |
| `npm run cf-typegen`       | regenerate binding types after changing `wrangler.jsonc`          |

## Deploying to Cloudflare (once, free)

A free Cloudflare account is enough. Workers, D1, R2 and Zero Trust Free do not need a credit card. If a step asks
for one, stop and check that the Free plan is selected.

1. **Log in with wrangler**

   ```bash
   npx wrangler login
   ```

2. **Database and photo storage**

   ```bash
   npx wrangler d1 create kucharska-kniha-db
   npx wrangler r2 bucket create kucharska-kniha-img
   ```

   Put the `database_id` from the output of the first command into `wrangler.jsonc` and commit it. (A D1
   database ID is an identifier, not a credential.)

3. **Migrations and the first deploy**

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

   The Worker runs at `https://cook-book.<your-subdomain>.workers.dev`. Until you turn on Access the API returns
   401, so no data is exposed.

4. **Cloudflare Access (sign-in)**
   - Dashboard → Workers & Pages → `cook-book` → Settings → Domains & Routes → turn on **Cloudflare Access** for
     `workers.dev` (and for Preview URLs).
   - The dialog shows `POLICY_AUD` and `TEAM_DOMAIN`. Copy both.
   - Zero Trust → Access controls → Applications → open the application → Policies: keep a single **Allow** rule.
     Either include **Everyone** (recommended: Access only checks that the person owns the e-mail address, the app
     decides who gets in, so you add people inside the app) or list the e-mail addresses (then add each invited
     person here too).
   - **Enable One-time PIN** so people without a Cloudflare account can sign in with an e-mailed code: Zero Trust →
     Integrations → Identity providers → Add new identity provider → One-time PIN, then allow it for the
     application under Authentication. New Zero Trust organizations use the Cloudflare identity provider by
     default, which only lets members of your Cloudflare account in, so this step is required for anyone who does not have a Cloudflare account.
   - Set the session duration to **1 month** so an installed PWA does not ask to sign in every day.

5. **Worker secrets** (they survive later deploys)

   ```bash
   npx wrangler secret put ACCESS_TEAM_DOMAIN
   npx wrangler secret put ACCESS_AUD
   npx wrangler secret put ALLOWED_EMAILS
   ```

   `ACCESS_TEAM_DOMAIN` is the `TEAM_DOMAIN` (for example `your-team.cloudflareaccess.com`), `ACCESS_AUD` is the
   `POLICY_AUD`, `ALLOWED_EMAILS` is a comma-separated list of addresses. The app verifies the Access token
   signature itself, so protection still holds if Access is switched off by mistake.

   `ALLOWED_EMAILS` lists the **administrators** of the installation: they can always sign in (the first one
   becomes the owner of the first household) and only they can create additional households. Anyone else let in
   by Cloudflare Access who is not in a household yet sees a screen to **create their own household** (and
   becomes its owner) or to wait for an invitation from an owner (Settings → Household and members). So the
   Access policy decides who can use the app; each household only ever sees its own data.

6. **Install on a phone**
   - Android (Chrome): menu → Install app.
   - iPhone (Safari): Share → Add to Home Screen.

### Automatic deploy from GitHub (optional)

Dashboard → Workers & Pages → `cook-book` → Settings → Builds → connect the GitHub repository. Build command
`npm run build`, deploy command `npx wrangler deploy`. Run `npm run db:migrate:remote` by hand before pushing
when the schema changes (always before deploying a version that adds a migration).

### Link preview (Open Graph)

`index.html` has Open Graph and Twitter tags and the default preview image `public/og-image.png` (a pot). The image
needs a full address: build with `SITE_URL=https://your-app.example.com npm run build` (or put `VITE_SITE_URL` in
`.env.local`). Note that Cloudflare Access protects the whole site, so chat apps cannot read the preview of a private
link; to allow it, add an Access **Bypass** policy for the path `/og-image.png` (and for any page you want previewed).

### Signing out

The app menu (the account icon in the top right corner) has **Sign out**, which uses Cloudflare Access
(`/cdn-cgi/access/logout`). It is shown only on the deployed site, not locally.

## Backup and export

Settings → **Export data** downloads the whole household as JSON, **Recipes as Markdown** downloads all recipes as
a readable text file. D1 also keeps 7 days of history (Time Travel).

PDF: use **Print** in the menu of a recipe, the meal plan or the shopping list and choose **Save as PDF** in the
print dialog (on iPhone: Share → Save to Files).

## Chrome extension (add a recipe from the page you are on)

The `extension/` folder is a small Chrome extension: click its icon on a page with a recipe and the app opens with
the recipe already imported, ready to check and save.

1. Open `chrome://extensions`, turn on **Developer mode** and choose **Load unpacked** → the `extension/` folder.
2. Enter the address of your app in the extension settings (it opens after installing; it is stored only in your browser).
3. Pin the icon (puzzle icon in the toolbar → pin). On a page with a recipe, click it.

No extension? Open **Settings → Add a recipe from the web with one click**: it has a bookmark you drag to the bookmarks bar (works in every browser) and the extension as a ready-to-download .zip with the steps to load it in Chrome. The zip is built from `extension/` during `npm run dev` and `npm run build`.

## Project structure

```
src/      frontend (Vue): features/<domain>/pages, components, api, plugins, design
worker/   backend (Hono on Workers): routes, services, middleware, db (schema + migrations)
shared/   types and pure functions shared by the frontend and the backend
tests/    unit/ (jsdom) and worker/ (Workers runtime + D1)
```

Code boundaries: `src/` and `worker/` never import each other, both may import from `shared/`. Every query on
household data filters by `householdId`. The UI uses plain Vuetify components and utility classes only.

## Privacy

All data is private to one household and protected by Cloudflare Access plus an address allow-list in the app.
The repository contains no secrets or personal addresses: they live in Worker secrets and in the git-ignored
`.dev.vars`.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). You may download, run, change and deploy the app for yourself, your family and other noncommercial purposes. **Commercial use (a business, selling it, running it as a service for others) needs the author's written permission.** Versions published before this change were released under the MIT License, and that license stays valid for the copies obtained under it.

---

<a id="slovenská-verzia"></a>

# Slovenská verzia

Rodinná webová aplikácia (PWA) na recepty, týždenný jedálniček a nákupný zoznam. Beží celá zadarmo na
Cloudflare: jeden Worker servíruje Vue frontend aj API, dáta sú v D1, fotky v R2 a prihlásenie rieši
Cloudflare Access. Verzia **1.4.3**.

Stránka so screenshotmi: <https://jakubmatisak.github.io/cook-book-website/>

## Čo aplikácia vie

- **Recepty:** ingrediencie s množstvom a jednotkou, postup s časovačmi, tagy, fotka (zmenšená v prehliadači),
  obľúbené, vyhľadávanie bez diakritiky podľa názvu aj ingrediencie.
- **Zoznam receptov:** mriežka alebo tabuľka, panel filtrov s počtami (kategória, čas, náročnosť, tagy), zoradenie
  podľa názvu, dátumu pridania, času, náročnosti a toho, kedy sa varilo naposledy.
- **Import z webu:** vlož odkaz na recept, načíta sa názov, ingrediencie, postup a fotka a ty ich pred uložením
  skontroluješ. Importované recepty dostanú tag _Z internetu_.
- **Varenie:** prepočet porcií, režim varenia s odškrtávaním krokov, časovačmi a zapnutou obrazovkou, tmavý režim.
- **Katalóg ingrediencií:** štartovací zoznam asi 200 bežných slovenských surovín s jednotkou a kategóriou obchodu
  (pridá sa sám raz), premenovanie a mazanie.
- **Domácnosti, vlastníci a členovia:** jeden človek môže byť členom viacerých domácností (napríklad vlastnej a
  rodičov). Každá má vlastné recepty, jedálniček, nákupný zoznam, špajzu a rodinu. Kto je členom jednej
  domácnosti, vojde rovno, inak si vyberie (a prepína v hlavičke). Vlastníci (môže ich byť viac) pozývajú ľudí
  e-mailom, menia roly a spravujú nastavenia domácnosti, rodinu a zálohy. Členovia robia všetko okolo varenia.
- **Návštevy:** pridaj do rodiny návštevu s alergiami, averziami a diétami. Návšteva sa nepočíta do porcií, kým ju
  v jedálničku nevyberieš pri konkrétnom jedle; vtedy ju zohľadní počet porcií, nákupný zoznam aj upozornenia.
- **Verejné recepty:** vlastník domácnosti môže recept zverejniť; každý prihlásený (v ktorejkoľvek domácnosti) si
  verejné recepty prehliada, filtruje podľa typu jedla a pridá si kópiu (aj s fotkou) do svojich receptov. Kópie sú
  nezávislé a súkromné.
- **Jazyky a osobné nastavenia:** celá aplikácia je po slovensky aj anglicky. Jazyk, vzhľad, pohľad zoznamu a
  naposledy použité filtre receptov sa ukladajú na človeka (s tlačidlom na úplný reset filtrov), takže ho
  nasledujú na všetkých zariadeniach aj domácnostiach.
- **Pri stole (Rodina):** dospelí a deti s veľkosťou porcie; alergie, averzie a diéty členov upozornia pri plánovaní jedla.
- **Týždenný jedálniček:** jedlá dňa, presun ťahaním, kopírovanie týždňa, šablóny týždňov a návrhy „Čo uvariť
  dnes“ podľa špajze a toho, kedy sa varilo naposledy.
- **Nákupný zoznam:** vygenerovaný z jedálnička podľa porcií rodiny (sčítané ingrediencie, prevody jednotiek,
  odpočet špajze), stále položky, ručné položky jedným riadkom („2 kg zemiaky“), skupiny podľa kategórie obchodu,
  odškrtávanie zdieľané medzi vami aj bez signálu.
- **Špajza:** čo máš doma, s množstvom a trvanlivosťou. Filter „Čo viem uvariť“ zoradí recepty podľa toho, čo
  chýba; v nastaveniach sa dajú ignorovať koreniny a je pohľad na recepty, kde chýba len jedna surovina.
- **Tlač a export:** tlač receptu, týždňa a nákupu (v okne tlače „Uložiť ako PDF“), recept ako Markdown (kopírovať,
  zdieľať, stiahnuť), všetky recepty v jednom súbore, záloha do JSON.
- **PWA:** inštalácia na Android aj iPhone, čítanie a odškrtávanie nákupu funguje aj offline.

## Technológie

Vue 3 · Vuetify 4 (bez Tailwindu a vlastného CSS) · TanStack Query · vite-plugin-pwa · Hono · Drizzle ORM ·
Cloudflare Workers + D1 + R2 · Vitest (+ Workers runtime cez `@cloudflare/vitest-plugin`).

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

Príkazy sú rovnaké ako v tabuľke vyššie (`npm run check` spusti pred commitom).

## Nasadenie na Cloudflare (raz, zadarmo)

Stačí bezplatný Cloudflare účet. Kreditnú kartu Workers, D1, R2 ani Zero Trust Free nevyžadujú; ak by ju
niektorý krok pýtal, zastav sa a over, že máš vybraný Free plán.

1. **Prihlásenie wranglera:** `npx wrangler login`
2. **Databáza a úložisko fotiek:** `npx wrangler d1 create kucharska-kniha-db` a
   `npx wrangler r2 bucket create kucharska-kniha-img`. `database_id` z výstupu prvého príkazu vlož do
   `wrangler.jsonc` a commitni (ID databázy je identifikátor, nie tajomstvo).
3. **Migrácie a prvý deploy:** `npm run db:migrate:remote` a `npm run deploy`. Worker beží na
   `https://cook-book.<tvoja-subdomena>.workers.dev`. Kým nezapneš Access, API vracia 401, takže dáta nie sú
   prístupné.
4. **Cloudflare Access (prihlásenie)**
   - Dashboard → Workers & Pages → `cook-book` → Settings → Domains & Routes → pri `workers.dev` zapni
     **Cloudflare Access** (aj pre Preview URLs). Okno ukáže `POLICY_AUD` a `TEAM_DOMAIN`, obe si skopíruj.
   - Zero Trust → Access controls → Applications → otvor aplikáciu → Policies: ponechaj jedno pravidlo
     **Allow**. Buď s **Everyone** (odporúčané: Access len overí, že človek vlastní e-mail, o vstupe rozhoduje
     aplikácia, takže ľudí pridávaš priamo v aplikácii), alebo so zoznamom e-mailov (potom každého pozvaného
     pridaj aj tu).
   - **Zapni One-time PIN**, aby sa dalo prihlásiť aj bez Cloudflare účtu (kód príde e-mailom): Zero Trust →
     Integrations → Identity providers → Add new identity provider → One-time PIN, potom ho v aplikácii povoľ v
     záložke Authentication. Nové organizácie majú predvolene prihlásenie cez Cloudflare účet, ktoré pustí len
     členov tvojho účtu, takže tento krok je nutný pre každého, kto nemá Cloudflare účet.
   - Session duration nastav na **1 month**, aby sa nainštalovaná PWA nemusela prihlasovať každý deň.
5. **Tajomstvá Workera** (prežijú ďalšie deploye): `npx wrangler secret put ACCESS_TEAM_DOMAIN`,
   `ACCESS_AUD` a `ALLOWED_EMAILS`. `ACCESS_TEAM_DOMAIN` je `TEAM_DOMAIN` (napr. `tvoj-tim.cloudflareaccess.com`),
   `ACCESS_AUD` je `POLICY_AUD`, `ALLOWED_EMAILS` sú e-maily oddelené čiarkou. Aplikácia overuje podpis Access
   tokenu sama, takže ochrana platí aj keby Access niekto omylom vypol.

   `ALLOWED_EMAILS` je zoznam **správcov** inštalácie: môžu sa vždy prihlásiť (prvý sa stane vlastníkom prvej
   domácnosti) a len oni môžu zakladať ďalšie domácnosti. Ktokoľvek iný, koho pustí Cloudflare Access a ešte nie
   je v žiadnej domácnosti, uvidí obrazovku, kde si **založí vlastnú domácnosť** (stane sa jej vlastníkom), alebo
   počká na pozvánku od vlastníka (Nastavenia → Domácnosť a členovia). O tom, kto môže aplikáciu používať, teda
   rozhoduje pravidlo v Cloudflare Access; každá domácnosť vidí len svoje dáta.

6. **Inštalácia na mobil:** Android (Chrome): menu → Inštalovať aplikáciu. iPhone (Safari): Zdieľať → Pridať na
   plochu.

**Automatický deploy z GitHubu (voliteľné):** Dashboard → Workers & Pages → `cook-book` → Settings → Builds →
pripoj GitHub repozitár. Build command `npm run build`, deploy command `npx wrangler deploy`. Migrácie pri zmene
schémy spúšťaj ručne `npm run db:migrate:remote` pred pushom (vždy pred nasadením verzie, ktorá pridáva migráciu).

**Náhľad odkazu (Open Graph):** `index.html` má značky Open Graph a Twitter a predvolený obrázok náhľadu
`public/og-image.png` (hrniec). Obrázok potrebuje úplnú adresu: zostav s
`SITE_URL=https://tvoja-aplikacia.example.com npm run build` (alebo daj `VITE_SITE_URL` do `.env.local`). Pozor:
Cloudflare Access chráni celú stránku, takže chatové aplikácie náhľad súkromného odkazu nevidia; povoliť sa dá
pravidlom Access **Bypass** pre cestu `/og-image.png` (a pre stránky, ktoré chceš zdieľať s náhľadom).

**Odhlásenie:** v ponuke účtu v pravom hornom rohu je **Odhlásiť sa** (cez Cloudflare Access). Ukazuje sa len na
nasadenej stránke, lokálne nie.

## Záloha a export

Nastavenia → **Exportovať dáta** stiahne celú domácnosť ako JSON, **Recepty ako Markdown** všetky recepty v
čitateľnom textovom súbore. D1 navyše drží 7 dní histórie (Time Travel).

PDF: pri recepte, jedálničku a nákupe zvoľ v menu **Tlačiť** a v okne tlače **Uložiť ako PDF** (na iPhone cez
Zdieľať → Uložiť do Súborov).

## Rozšírenie do Chromu (pridať recept zo stránky, na ktorej si)

Priečinok `extension/` je malé rozšírenie do Chromu: klikneš na jeho ikonu na stránke s receptom a aplikácia sa
otvorí s už načítaným receptom na kontrolu a uloženie.

1. Otvor `chrome://extensions`, zapni **Režim pre vývojárov** a zvoľ **Načítať nezabalené** → priečinok `extension/`.
2. V nastaveniach rozšírenia zadaj adresu svojej aplikácie (otvoria sa po inštalácii; uloží sa len v tvojom prehliadači).
3. Pripni ikonu (puzzle ikona v lište → pripnúť). Na stránke s receptom na ňu klikni.

Bez rozšírenia: v **Nastaveniach → Pridať recept z internetu jedným klikom** je záložka na pretiahnutie na lištu záložiek (funguje v každom prehliadači) a rozšírenie na stiahnutie ako .zip s postupom, ako ho načítať do Chromu. Súbor .zip vzniká z `extension/` pri `npm run dev` a `npm run build`.

## Štruktúra

```
src/      frontend (Vue): features/<doména>/pages, components, api, plugins, design
worker/   backend (Hono na Workers): routes, services, middleware, db (schéma + migrácie)
shared/   typy a čisté funkcie zdieľané frontendom aj backendom
tests/    unit/ (jsdom) a worker/ (Workers runtime + D1)
```

## Licencia

[PolyForm Noncommercial 1.0.0](LICENSE). Aplikáciu si môžeš stiahnuť, spustiť, upraviť a nasadiť pre seba, rodinu a iné nekomerčné účely. **Komerčné použitie (firma, predaj, prevádzka ako služba pre iných) vyžaduje písomný súhlas autora.** Verzie zverejnené pred touto zmenou boli vydané pod licenciou MIT a tá ostáva platná pre kópie získané podľa nej.
