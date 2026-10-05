# Kuchárska kniha – návrh architektúry a fázovanie

Dátum: 5. 10. 2026
Stav: návrh na review
Nadväzuje na: [napady-a-prieskum-hostingu](../../2026-10-05-napady-a-prieskum-hostingu.md)

## 0. Rozhodnutia a predpoklady

Rozhodnuté (z diskusie):
- Vlastná aplikácia, nie hotové Mealie.
- Hosting celý na Cloudflare, free plán, žiadna karta.
- Frontend Vue 3 + Vuetify 4, vlastný vizuál cez Vuetify theme/defaults, Tailwind len na utility.
- Architektúra sa navrhuje pre celú aplikáciu naraz, funkcie sa dopĺňajú po fázach.
- Používatelia: 2 dospelí (ty a manželka), rodina s deťmi ako „členovia“ bez prihlásenia.

Predpoklady (ak nesedia, oprav ich pred implementáciou):
- P1: Deti vs. dospelí znamená **oboje**: menšie porcie toho istého jedla (koeficient na člena) aj možnosť iného jedla pre deti v tom istom slote. Model to pokrýva, UI pre „iné jedlo“ ide až do fázy 4.
- P2: Fotky receptov sú vo fáze 1, ale ako voliteľné pole. Recept bez fotky je plnohodnotný.
- P3: Jazyk UI je slovenčina, bez i18n vrstvy (texty priamo v komponentoch). Keby bola treba, dá sa pridať vue-i18n neskôr bez zmeny architektúry.
- P4: Doména zatiaľ `*.workers.dev`. Vlastná doména je len zmena v konfigurácii.
- P5: Import receptov z URL nie je v MVP (fáza 4). Existujúce recepty sa prepíšu ručne alebo cez JSON import.

## 0a. Zmeny po implementácii fázy 0 (5. 10. 2026)

- **npm namiesto pnpm.** Príkazy v časti 3 platia s `npm run` / `npx`; aktuálny postup je v README.
- **TypeScript 6.0.** TS 7 je natívny kompilátor bez JS API a `vue-tsc` na ňom nebeží.
- **`@cloudflare/vitest-plugin` + Vitest 4** namiesto `vitest-pool-workers` (premenovaný nástupca).
- **Typované API cez DTO v `shared/api.ts`, nie `hono/client`.** RPC typy by ťahali typy Workers runtime do frontendu; DTO dodržia hranicu src/worker.
- **Font zo `@fontsource-variable/nunito`**, nie Google Fonts, kvôli offline PWA.
- **Vuetify 4 CSS vrstvy:** poradie `theme, vuetify-core, vuetify-components, vuetify-overrides, vuetify-utilities, utilities, vuetify-final`; Tailwind `tw:` triedy prebijú Vuetify utility.
- **Zaoblenie** cez SASS mapu `$rounded` (lg 12 px, xl 20 px).
- **Domácnosť má pevné ID `default`**; prvý povolený používateľ ju založí so seedom (5 slotov, 11 kategórií obchodu, zoznam „Nákup“, nastavenia), ďalší sa pridajú do nej.
- **Access:** okrem JWT z hlavičky sa akceptuje aj cookie `CF_Authorization`; `ACCESS_TEAM_DOMAIN` sa normalizuje (s alebo bez `https://`). Access sa zapína one-click v nastaveniach Workera.
- **Dev server na porte 5180** (5173 obsadený), náhľad 5181.

## 0b. Zmeny po implementácii fázy 1 (5. 10. 2026)

- **Migrácia 0001:** `recipes.title_normalized` na vyhľadávanie bez diakritiky, unikátne `(household_id, slug)`, `(household_id, name_normalized)` pre ingrediencie a `(recipe_id, position)` pre kroky.
- **Ingrediencie a tagy v recepte sa posielajú menom.** Server ich nájde bez ohľadu na diakritiku a veľkosť písmen, chýbajúce založí; prvá použitá jednotka sa stane predvolenou.
- **Fotky:** typ sa určuje z obsahu súboru (WebP, JPEG, PNG), nie z deklarovaného MIME. Kľúč v R2 je `<household>/<id>.<ext>`, výdaj cez `/img/...` len pre vlastnú domácnosť.
- **Validácia formulára:** Vuetify `rules` + zod `safeParse` zo `shared/schemas/recipe.ts` (O3 uzavreté, bez vee-validate).
- **JSON import presunutý do fázy 4** k importu z URL: vyžaduje mapovanie konfliktov mien a fotky nie sú v exporte.
- **Katalóg ingrediencií** je samostatná stránka v menu Viac.

## 0c. Zmeny po implementácii fázy 2 (5. 10. 2026)

- **Predvolené voľby** (používateľ neodpovedal, menia sa v aplikácii): deti majú menšiu porciu toho istého jedla (koeficient 0,5), všetkých 5 jedál dňa zapnutých, týždeň od pondelka, účty nie sú prepojené s členmi rodiny.
- **Dátumy** sú reťazce `YYYY-MM-DD` a počíta sa s nimi v UTC (`shared/dates.ts`); zmena času ani časové pásmo neposunú deň.
- **Porcie záznamu** počíta `shared/portions.ts`: ručné číslo, inak súčet koeficientov aktívnych členov zaokrúhlený na štvrtiny; bez členov porcie receptu. Fáza 3 to použije na prepočet nákupu.
- **Začiatok týždňa** len pondelok, nedeľa alebo sobota.
- **Presun a kópia jedla** cez dialóg úpravy (deň v rámci týždňa a jedlo dňa), nie drag & drop.
- **Kopírovanie týždňa** s voľbou nahradiť; záznamy so zmazaným receptom sa kopírujú a v pláne sa označia.
- **Vypnuté jedlo dňa** sa v pláne zobrazí, ak v ňom v danom týždni niečo je.
- **Nastavenia** sa vždy zlučujú s predvolenými, chýbajúci kľúč nepokazí aplikáciu.
- **Slovenské hlášky validácie** cez `z.config(z.locales.sk())` v `shared/schemas/zod.ts`.

## 0d. Zmeny po implementácii fázy 3 a redizajne (5. 10. 2026)

- **Tailwind odstránený.** Na želanie používateľa je UI čisté Vuetify: komponenty, defaults v `src/plugins/vuetify.ts`, utility triedy. Žiadne `<style>` bloky ani vlastné widgety. Časť 2.7 o Tailwinde už neplatí.
- **Nákupný zoznam:** generátor je čistá funkcia `shared/shopping.ts`; voliteľné ingrediencie sa nepridávajú; kusy a balenia sa zaokrúhľujú nahor, gramy a mililitre nahor na krok 1/5/10; pri opätovnom generovaní sa kúpené položky nechajú a ich ingrediencia sa znova nepridá.
- **Offline odškrtávanie:** fronta v IndexedDB, hromadné odoslanie po pripojení; server použije len zmenu novšiu ako posledná úprava položky (posledná vyhráva).
- **Synchronizácia medzi vami:** obnova zoznamu každých 5 s, kým je stránka viditeľná (bez Durable Objects).
- **Ručná položka** z jedného riadku („2 kg zemiaky“) prevezme kategóriu obchodu známej ingrediencie.
- **Nasadenie:** Worker sa volá `cook-book` (prepojený s GitHub repom jakubmatisak/cook-book), beží na cook-book.jakub-matisak.workers.dev za Cloudflare Access.

## 1. Fázy – čo, kedy a prečo

Pravidlo: každá fáza končí niečím, čo reálne používate. Nič sa nebuduje „na neskôr“, len dátový model je od začiatku kompletný, aby sa neskôr nemuselo migrovať s bolesťou.

### Fáza 0 – Základ (MUST, bez toho nič nebeží)
- Repo, tooling, CI/CD, nasadenie prázdnej appky na Cloudflare.
- Prihlásenie cez Cloudflare Access, mapovanie na používateľa.
- Databáza so **všetkými** tabuľkami (schéma nižšie), migrácie.
- Design systém: Vuetify theme, defaults, Tailwind, fonty, ikony, layout (bottom navigation na mobile, side rail na desktope).
- PWA shell: manifest, ikona, inštalovateľnosť, offline app shell.
- Export dát (JSON) – od prvého dňa, aby boli dáta vždy vaše.

### Fáza 1 – Recepty (MUST)
- CRUD receptu: názov, popis, kategória, porcie, časy, náročnosť, zdroj.
- Štruktúrované ingrediencie (množstvo, jednotka, položka z katalógu ingrediencií, poznámka, skupina napr. „na cesto“ / „na plnku“).
- Kroky postupu.
- Tagy, kategórie, vyhľadávanie (názov, ingrediencia, tag), filtre.
- Fotka (nahranie z mobilu, zmenšenie v prehliadači, R2).
- Obľúbené (srdiečko) na používateľa.
- Katalóg ingrediencií s kategóriou obchodu (zelenina, mäso, mliečne…), automaticky sa plní pri písaní receptov.

### Fáza 2 – Rodina a jedálniček (MUST)
- Členovia rodiny: meno, dospelý/dieťa, koeficient porcie, aktívny.
- Sloty dňa (raňajky, desiata, obed, olovrant, večera) – zapínateľné.
- Týždenný plán: priradenie receptu alebo voľného textu do slotu, poznámka, prepísanie počtu porcií.
- Pohľad týždeň (desktop mriežka, mobil zoznam dní), presun/kopírovanie jedla medzi dňami, kopírovanie celého týždňa.

### Fáza 3 – Nákupný zoznam (MUST)
- Generovanie z plánu pre rozsah dátumov, prepočet podľa porcií členov, agregácia rovnakých ingrediencií, normalizácia jednotiek (g/kg, ml/l, ks).
- Ručné položky, odškrtávanie, zoradenie podľa kategórie obchodu.
- Synchronizácia medzi vami (polling každých pár sekúnd, keď je obrazovka otvorená).
- Offline čítanie zoznamu a receptov (cache), odškrtnutie offline sa odošle po pripojení.
- Po tejto fáze je MVP hotové.

### Fáza 4 – Pohodlie (SHOULD)
- Import receptu z URL (schema.org/Recipe).
- Prepočet porcií v detaile receptu.
- Režim varenia (veľké písmo, obrazovka nezhasne, odškrtávanie krokov, časovače).
- Hodnotenie a poznámky na člena rodiny, história varenia („naposledy pred 3 týždňami“).
- Stále položky nákupu, „mám doma“ pred nákupom.
- Šablóny týždňov.
- Iné jedlo pre deti v tom istom slote (P1), kto je doma pri jedle.

### Fáza 5 – Voliteľné (OPTIONAL, podľa chuti)
- Preferencie a alergie členov s varovaním pri plánovaní.
- Varianty receptu (detská/dospelá).
- Návrh jedálnička podľa pravidiel, „čo uvariť“.
- Viac nákupných zoznamov, zásoby špajze/mrazničky.
- Realtime cez Durable Objects (WebSocket) namiesto pollingu.
- Push notifikácie, export do kalendára (ICS).
- Zdieľanie receptu verejným linkom, OCR, nutričné hodnoty, tmavý režim (tmavý režim je vo Vuetify lacný, môže ísť aj skôr).

## 2. Architektúra

### 2.1 Prehľad

```
Prehliadač (PWA, Vue 3 + Vuetify 4)
   │  HTTPS, cookie CF_Authorization
   ▼
Cloudflare Access (Zero Trust, One-time PIN na e-mail)
   │  pridá hlavičku Cf-Access-Jwt-Assertion
   ▼
Cloudflare Worker (jeden)
   ├── static assets  → /            (Vue SPA, build z Vite)
   ├── Hono API       → /api/v1/*    (JSON, zod validácia)
   │     ├── D1  (SQLite)  – všetky dáta
   │     └── R2  (objekty) – fotky
   └── /img/*         → R2 s cache hlavičkami
```

Jeden Worker, jedno nasadenie, jeden repozitár. Žiadne servery, žiadny Docker, nič nezaspáva.

### 2.2 Prečo tieto voľby

| Voľba | Dôvod | Alternatíva, ktorú som zavrhol |
|---|---|---|
| Jeden Worker so static assets | statika je zadarmo a bez limitu, API v tom istom deployi, žiadne CORS | Pages + samostatný Worker: dve nasadenia, Pages už nedostáva nové funkcie |
| Hono | malý, rýchly, natívne pre Workers, dobrá typová integrácia so zod | čisté `fetch` handlery: rýchlo sa z toho stane špagety |
| D1 + Drizzle ORM | relačný model receptov/ingrediencií/plánu je prirodzene SQL; Drizzle má typy aj migrácie pre D1 | Firestore: NoSQL by komplikoval agregáciu zoznamu; Supabase: zaspáva |
| R2 pre fotky | 10 GB zadarmo, nulový egress, natívny binding | Cloudinary free: ďalší účet, závislosť |
| Cloudflare Access | nula vlastnej auth logiky, 50 používateľov zadarmo, prihlásenie kódom z e-mailu alebo Google | vlastné heslo + cookie: musel by som riešiť hashovanie, session, reset |
| Vue 3.5 + Vuetify 4 | tvoja voľba; MD3 komponenty, data tables, bottom nav, dialógy hotové | – |
| Tailwind v4 len utility, bez preflight, prefix `tw` | Vuetify má vlastný reset; preflight by ho rozbil. Utility sú na rýchle rozloženie | len Vuetify utility classes: slabšie, menej flexibilné |
| TanStack Query (vue-query) | server cache, refetch pri fokuse, polling, offline retry, optimistic update | Pinia store ručne: musel by som to všetko napísať sám |
| vite-plugin-pwa (Workbox) | manifest + service worker + runtime caching bez ručného kódu | ručný SW: zbytočná práca |
| Vitest + @cloudflare/vitest-plugin | testy bežia v skutočnom Workers runtime s lokálnym D1 | mockovať D1: nepresné |

### 2.3 Štruktúra repozitára

Jeden balík (nie monorepo), tri hlavné priečinky zdieľajú jeden `package.json` a jednu Vite konfiguráciu. Cloudflare Vite plugin postaví frontend aj Worker naraz.

```
kucharska-kniha/
├── docs/                      # špecifikácie, plány
├── public/                    # ikony PWA, favicon, robots
├── src/                       # FRONTEND (Vue)
│   ├── main.ts
│   ├── App.vue
│   ├── router/                # vue-router, lazy routes
│   ├── plugins/
│   │   ├── vuetify.ts         # createVuetify: theme, defaults, icons, locale sk
│   │   └── query.ts           # VueQueryPlugin
│   ├── design/
│   │   ├── tokens.ts          # farby, radius, spacing – jediný zdroj pravdy
│   │   └── settings.scss      # Vuetify SASS premenné (border radius, font)
│   ├── styles/
│   │   └── tailwind.css       # @import tailwind theme+utilities, @theme z tokens
│   ├── api/                   # apiFetch (typy DTO zo shared/api.ts) + query hooks
│   ├── components/            # zdieľané UI (AppShell, EmptyState, ImagePicker…)
│   ├── features/              # podľa domény, každá má pages/, components/, queries.ts
│   │   ├── recipes/
│   │   ├── ingredients/
│   │   ├── family/
│   │   ├── meal-plan/
│   │   ├── shopping/
│   │   └── settings/
│   └── lib/                   # čisté funkcie (formátovanie, dátumy, image resize)
├── worker/                    # BACKEND (Hono na Workers)
│   ├── index.ts               # app, middleware, mount routerov, fallback na assets
│   ├── env.d.ts               # typy bindingov (DB, BUCKET, vars)
│   ├── middleware/
│   │   ├── auth.ts            # overenie Access JWT, načítanie usera, dev bypass
│   │   └── errors.ts          # jednotný tvar chýb
│   ├── db/
│   │   ├── schema.ts          # Drizzle schéma – všetky tabuľky
│   │   └── migrations/        # generované drizzle-kit, aplikované wrangler
│   ├── routes/                # jeden súbor na doménu: recipes.ts, mealPlan.ts…
│   ├── services/              # logika: shoppingListGenerator.ts, unitNormalizer.ts…
│   └── images.ts              # upload do R2, výdaj z R2
├── shared/                    # ZDIEĽANÉ FE+BE
│   ├── schemas/               # zod schémy DTO (RecipeInput, PlanEntryInput…)
│   ├── units.ts               # jednotky a prevody
│   └── types.ts
├── tests/
│   ├── unit/                  # Vitest: shared/, src/lib/, worker/services/
│   ├── worker/                # @cloudflare/vitest-plugin: API proti lokálnemu D1
│   └── e2e/                   # Playwright (neskôr)
├── wrangler.jsonc             # Worker, D1, R2 bindingy, assets
├── drizzle.config.ts
├── vite.config.ts             # vue, vuetify, tailwind, cloudflare, pwa
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

Pravidlo hraníc: `src/` nikdy nesiahne na `worker/` a naopak; obe siahajú len na `shared/`. Frontend volá API len cez `src/api/`.

### 2.4 Dátový model (kompletný, pre všetky fázy)

Všetko je viazané na `household` (domácnosť). Dnes je jedna, ale model to nestojí nič navyše a nikdy nebude treba prerábať. Všetky tabuľky majú `id` (text, ULID), `created_at`, `updated_at`; tie, kde dáva zmysel mazanie s návratom, majú `deleted_at`.

**Ľudia**
- `households` – id, name
- `users` – id, household_id, email (unikátny, z Access), name, created_at. Prihlásený človek.
- `family_members` – id, household_id, name, kind (`adult`|`child`), birth_date?, portion_factor (real, default 1.0 dospelý / 0.5 dieťa), color, is_active, sort_order. Kto je, pre koho sa varí. Používateľ môže byť zároveň členom (`users.member_id`).
- `member_preferences` (F5) – id, member_id, kind (`dislike`|`allergy`|`diet`), ingredient_id?, tag_id?, note

**Katalóg**
- `ingredients` – id, household_id, name, name_normalized (bez diakritiky, lowercase, pre vyhľadávanie a dedup), default_unit, shop_category_id, aliases (json), deleted_at
- `shop_categories` – id, household_id, name, sort_order (zelenina, ovocie, mäso, mliečne, pečivo, trvanlivé, mrazené, drogéria, iné)
- jednotky nie sú tabuľka, ale enum v `shared/units.ts`: `g, kg, ml, l, ks, PL, ČL, šálka, balenie, štipka` s prevodom na základ (g / ml / ks) kde sa dá

**Recepty**
- `recipes` – id, household_id, title, slug, description, category (enum: polievka, hlavné, príloha, šalát, dezert, raňajky, desiata, nápoj, iné), servings (int), prep_minutes?, cook_minutes?, difficulty (1–3), source_url?, source_text?, cover_image_id?, parent_recipe_id? (F5 varianty), variant_label?, created_by (user_id), deleted_at
- `recipe_ingredients` – id, recipe_id, ingredient_id, quantity? (real), unit?, note?, group_name?, is_optional, sort_order
- `recipe_steps` – id, recipe_id, position, text, timer_seconds?, image_id?
- `tags` – id, household_id, name, color; `recipe_tags` – recipe_id, tag_id
- `recipe_favorites` – recipe_id, user_id
- `recipe_ratings` (F4) – recipe_id, member_id, rating (1–5), note
- `recipe_notes` (F4) – id, recipe_id, user_id, text, created_at
- `cook_log` (F4) – id, recipe_id, cooked_on (date), plan_entry_id?, servings
- `images` – id, household_id, r2_key, mime, width, height, bytes, created_by

**Jedálniček**
- `meal_slots` – id, household_id, name, sort_order, is_enabled, default_time?
- `meal_plan_entries` – id, household_id, date (ISO date), slot_id, recipe_id?, free_text?, servings_override?, note?, sort_order, audience (`all`|`adults`|`children`|`custom`, F4). V jednom slote môže byť viac záznamov (dospelí X, deti Y).
- `meal_plan_entry_members` (F4) – entry_id, member_id. Keď audience=`custom`. Keď prázdne, jedia všetci aktívni podľa audience.
- `week_templates` (F4) – id, household_id, name; `week_template_entries` – template_id, weekday (0–6), slot_id, recipe_id?, free_text?

**Nákup**
- `shopping_lists` – id, household_id, name, is_default, sort_order
- `shopping_items` – id, list_id, ingredient_id?, name (snapshot), quantity?, unit?, shop_category_id?, is_checked, checked_at?, checked_by?, source (`manual`|`generated`|`staple`), generated_range_from?, generated_range_to?, sort_order, updated_at. `updated_at` slúži na synchronizáciu (klient posiela zmeny, server rieši last-write-wins na úrovni položky).
- `shopping_item_sources` – item_id, plan_entry_id, recipe_ingredient_id, quantity_contrib. Odkiaľ sa položka vzala (zobrazí „cibuľa: guláš 2 ks, rizoto 1 ks“).
- `staple_items` (F4) – id, household_id, ingredient_id, quantity, unit, every_n_weeks
- `pantry_items` (F5) – id, household_id, ingredient_id, quantity, unit, location, expires_on?

**Ostatné**
- `settings` – household_id, key, value (json). Napr. prvý deň týždňa, zapnuté sloty, predvolený koeficient dieťaťa.

Indexy: `recipes(household_id, deleted_at)`, `ingredients(household_id, name_normalized)`, `meal_plan_entries(household_id, date)`, `shopping_items(list_id, is_checked, sort_order)`, FTS nie je v D1 spoľahlivé na diakritiku, vyhľadávanie ide cez `LIKE` nad `name_normalized` a `title` (pre stovky receptov úplne stačí).

### 2.5 API

REST JSON pod `/api/v1`, jeden Hono router na doménu, zod validácia vstupov zo `shared/schemas`. Frontend volá API cez tenký `apiFetch` a typy odpovedí berie zo `shared/api.ts` (DTO zdieľané s backendom).

| Doména | Endpointy (výber) |
|---|---|
| me | `GET /me` (user + household + members + settings) |
| recipes | `GET /recipes?q&tag&category&favorite`, `GET /recipes/:id`, `POST /recipes`, `PUT /recipes/:id`, `DELETE /recipes/:id` (soft), `POST /recipes/:id/favorite`, `POST /recipes/import` (F4, z URL) |
| ingredients | `GET /ingredients?q`, `POST /ingredients`, `PUT /ingredients/:id`, `POST /ingredients/merge` (zlúčenie duplicít) |
| tags, shop-categories | CRUD |
| family | `GET/POST/PUT /members`, `PUT /slots` |
| plan | `GET /plan?from&to`, `POST /plan/entries`, `PUT /plan/entries/:id`, `DELETE /plan/entries/:id`, `POST /plan/copy` (deň→deň, týždeň→týždeň), `POST /plan/apply-template` (F4) |
| shopping | `GET /shopping/lists`, `GET /shopping/lists/:id/items?since` (delta sync), `POST /shopping/lists/:id/generate {from,to}`, `POST /shopping/items`, `PATCH /shopping/items/:id`, `POST /shopping/items/batch` (offline fronta), `DELETE /shopping/lists/:id/checked` |
| images | `POST /images` (multipart, do R2), `GET /img/:key` (mimo /api, cache 1 rok) |
| export | `GET /export` (celý household ako JSON), `POST /import` (JSON späť) |

Chyby: vždy `{ error: { code, message, details? } }`, HTTP 400/401/403/404/409/500.

### 2.6 Prihlásenie

1. Cloudflare Zero Trust (free do 50 používateľov): Access aplikácia pre `*.workers.dev` hostname appky, policy „Allow“ pre dva e-maily, identity provider One-time PIN (kód na e-mail). Voliteľne Google login.
2. Access po prihlásení pridá hlavičku `Cf-Access-Jwt-Assertion`. Worker middleware ju overí knižnicou `jose` proti `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (certs cachuje) a skontroluje `aud`.
3. E-mail z JWT → `users`. Ak používateľ neexistuje a e-mail je v povolenom zozname (`ALLOWED_EMAILS` var), vytvorí sa a priradí do domácnosti. Inak 403.
4. Lokálny vývoj: `DEV_USER_EMAIL` v `.dev.vars` middleware obíde Access a prihlási dev používateľa.
5. Verejné bez Access: nič. Aj `/img/*` je za Access (obrázky sa aj tak načítavajú z prihláseného prehliadača).

Záložný plán, ak by Access robil problémy s PWA na iOS (cookie po inštalácii): vlastná jednoduchá auth – jeden zdieľaný prístupový kód v Worker secret, po overení HttpOnly cookie s podpísaným tokenom na 90 dní. Štruktúra middleware je rovnaká, mení sa len `auth.ts`.

### 2.7 Frontend

- **Vue 3.5, TypeScript, `<script setup>`**, Composition API.
- **Vuetify 4** cez `vite-plugin-vuetify` (autoimport komponentov, SASS premenné). Konfigurácia v `src/plugins/vuetify.ts`:
  - `theme`: svetlá téma s farbami z `tokens.ts` (napr. teplá paleta: primary terakota/olivová, surface krémová), tmavá téma pripravená, prepínateľná neskôr.
  - `defaults`: globálne tvary – `VBtn { rounded: 'lg', variant: 'flat' }`, `VCard { rounded: 'xl', variant: 'flat', border: true }`, `VTextField/VSelect { variant: 'outlined', density: 'comfortable' }`, `VChip { rounded: 'lg' }`. Toto je „upravený dizajn“: jedno miesto, celá appka vyzerá inak než default Material.
  - `locale`: sk (Vuetify má slovenský locale).
  - `icons`: `@mdi/js` (tree-shake, nie celý font).
- **SASS premenné** v `src/design/settings.scss`: `$border-radius-root`, `$body-font-family` (Nunito Variable z `@fontsource-variable/nunito`, len latin a latin-ext, súčasť buildu kvôli offline PWA).
- **Tailwind v4** v `src/styles/tailwind.css`: importujú sa len `theme` a `utilities` vrstvy (bez `preflight`), prefix `tw` (triedy sa píšu `tw:flex`, `tw:bg-primary`), v `@theme` sa farby mapujú na Vuetify CSS premenné (`--color-primary: rgb(var(--v-theme-primary))`), takže `tw:bg-primary` a Vuetify `color="primary"` sú vždy tá istá farba.
- **Layout**: `AppShell` – mobil: `v-app-bar` + `v-bottom-navigation` (Recepty, Plán, Nákup, Viac); desktop ≥ md: `v-navigation-drawer rail` vľavo. Max šírka obsahu 1200 px.
- **Dáta**: TanStack Vue Query. Query kľúče podľa domény, mutácie s optimistic update pre odškrtávanie a obľúbené. Nákupný zoznam: `refetchInterval` 5 s keď je stránka viditeľná.
- **Formuláre**: zod schémy zo `shared/` + `vee-validate` (alebo ručné `rules` vo Vuetify poliach; rozhodne sa v F1 podľa toho, čo je menej kódu).
- **Obrázky**: pred uploadom zmenšiť v prehliadači (canvas, max 1600 px, WebP ~0.8), až potom `POST /images`.
- **PWA**: `vite-plugin-pwa`, `registerType: 'autoUpdate'`, precache app shellu, runtime cache `NetworkFirst` pre `/api/v1/*` GET a `CacheFirst` pre `/img/*`. Offline zápisy nákupného zoznamu: fronta v IndexedDB (idb-keyval), po `online` evente `POST /shopping/items/batch`.
- **Routing**: lazy chunky na feature, `/recepty`, `/recepty/:id`, `/recepty/novy`, `/plan`, `/nakup`, `/rodina`, `/nastavenia`.

### 2.8 Backend – kľúčová logika

**Generátor nákupného zoznamu** (`worker/services/shoppingListGenerator.ts`, čistá funkcia, testovateľná bez DB):
1. Vstup: záznamy plánu v rozsahu, ich recepty s ingredienciami, členovia, existujúce položky zoznamu.
2. Pre každý záznam: `faktor = servings_override ?? Σ portion_factor(jedia)` / `recipe.servings`.
3. Každá ingrediencia × faktor → previesť na základnú jednotku (g/ml/ks) ak sa dá; ak nie (šálka, štipka), ostáva ako je.
4. Zoskupiť podľa `ingredient_id` + základná jednotka. Sčítať. Zapamätať zdroje.
5. Porovnať s existujúcimi `generated` položkami: neodškrtnuté nahradiť, odškrtnuté nechať (už kúpené), `manual` nechať vždy.
6. Výstup: zoznam insert/update/delete operácií; router ich vykoná v jednej D1 batch transakcii.

**Normalizácia jednotiek** (`shared/units.ts`): tabuľka prevodov, zaokrúhľovanie na „pekné“ hodnoty pri zobrazení (1 250 g → 1,25 kg).

**Normalizácia názvov** (`shared/text.ts`): odstránenie diakritiky, lowercase, trim, pre dedup ingrediencií a vyhľadávanie.

### 2.9 Chyby, hranice, bezpečnosť

- Každá query filtruje `household_id` z prihláseného používateľa; nikdy sa neverí ID z klienta bez tejto podmienky.
- Zod na vstupe, Drizzle typy na výstupe. Chyby validácie 400 s detailmi poľa.
- D1 má limit 100 000 zápisov/deň na free pláne. Generátor zoznamu používa batch, bežné používanie je rádovo desiatky zápisov denne.
- Upload obrázkov: max 5 MB po zmenšení, len `image/*`, názov v R2 je ULID, nie pôvodný názov.
- Frontend: globálny error handler zobrazí `v-snackbar`, 401 presmeruje na Access login (reload stránky).
- Zálohy: `GET /export` + odporúčanie raz za mesiac stiahnuť JSON. D1 má na free pláne Time Travel 7 dní späť.

### 2.10 Testovanie

- **Unit (Vitest)**: `shared/units`, `shared/text`, generátor nákupného zoznamu, prepočet porcií, image resize helper (jsdom). Tu je väčšina logiky, tu je väčšina testov.
- **Worker (@cloudflare/vitest-plugin)**: každá route proti lokálnemu D1 s migráciami, happy path + 400/403/404.
- **Komponenty**: minimálne; iba kritické formuláre (editor receptu) cez `@vue/test-utils`.
- **E2E (Playwright, od F3)**: smoke – prihlás sa (dev bypass), vytvor recept, naplánuj, vygeneruj zoznam, odškrtni.
- TDD na službách a routoch; UI sa overuje ručne v prehliadači na mobile aj desktope.

### 2.11 Prostredia a nasadenie

| | Lokálne | Produkcia |
|---|---|---|
| Spustenie | `pnpm dev` (Vite + Cloudflare plugin = Miniflare, lokálny D1 v `.wrangler/state`) | Worker na `kucharska-kniha.<account>.workers.dev` |
| DB | lokálny SQLite, migrácie `wrangler d1 migrations apply --local` | D1 `kucharska-kniha-db`, migrácie `--remote` |
| R2 | lokálna emulácia | bucket `kucharska-kniha-img` |
| Auth | `DEV_USER_EMAIL` | Cloudflare Access |
| Deploy | – | Workers Builds: push do `main` na GitHube → automatický build a deploy (zadarmo). Preview na PR vetvy. |

Migrácie sa aplikujú ručne príkazom pred deployom (bezpečnejšie než automaticky); neskôr sa dá pridať do build kroku.

## 3. Postupy – fáza 0 krok za krokom

Toto sú konkrétne kroky, ktoré vykonám (alebo ty, kde je potrebný tvoj účet). Ostatné fázy dostanú rovnako podrobný plán cez `writing-plans` až po schválení tohto dokumentu.

### 3.1 Čo potrebujem od teba (účty)
1. Cloudflare účet (zadarmo) – [dash.cloudflare.com](https://dash.cloudflare.com). Po registrácii zapnúť **Zero Trust** (free plán, pýta si vybrať plán „Free“, kartu nevyžaduje pri 0 € – ak by si pýtal kartu, povieme a ideme záložnou auth).
2. GitHub účet a prázdne repo `kucharska-kniha` (súkromné).
3. Dva e-maily (tvoj a manželkin), ktoré budú povolené v Access.

### 3.2 Založenie projektu
```bash
pnpm create cloudflare@latest kucharska-kniha --framework=vue
```
(šablóna Vue + Cloudflare Vite plugin; následne pridám Vuetify, Tailwind, Hono, Drizzle, PWA)
```bash
pnpm add vue-router pinia @tanstack/vue-query vuetify @mdi/js hono zod drizzle-orm jose idb-keyval
pnpm add -D vite-plugin-vuetify sass-embedded tailwindcss @tailwindcss/vite vite-plugin-pwa drizzle-kit wrangler @cloudflare/vite-plugin @cloudflare/vitest-pool-workers vitest @vue/test-utils jsdom typescript vue-tsc eslint prettier
```

### 3.3 Konfigurácia
1. `wrangler.jsonc`: názov Workera, `main: worker/index.ts`, `assets: { directory: dist/client, not_found_handling: single-page-application }`, bindingy `DB` (D1), `BUCKET` (R2), vars `ALLOWED_EMAILS`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.
2. `vite.config.ts`: pluginy `vue()`, `vuetify({ autoImport: true, styles: { configFile: 'src/design/settings.scss' } })`, `tailwindcss()`, `cloudflare()`, `VitePWA({...})`.
3. `src/styles/tailwind.css`: `@import "tailwindcss/theme" layer(theme); @import "tailwindcss/utilities" layer(utilities) prefix(tw);` + `@theme` s mapovaním na `--v-theme-*`.
4. `src/plugins/vuetify.ts`: theme + defaults podľa 2.7.
5. `drizzle.config.ts`: dialect sqlite, driver d1-http pre remote, `out: worker/db/migrations`.
6. `.dev.vars`: `DEV_USER_EMAIL=...` (nie v gite).
7. ESLint + Prettier, `pnpm typecheck` (`vue-tsc`), `pnpm test`.

### 3.4 Databáza
```bash
pnpm wrangler d1 create kucharska-kniha-db
pnpm wrangler r2 bucket create kucharska-kniha-img
```
ID z výstupu do `wrangler.jsonc`. Napísať `worker/db/schema.ts` (celý model z 2.4), `pnpm drizzle-kit generate`, `pnpm wrangler d1 migrations apply kucharska-kniha-db --local` a neskôr `--remote`. Seed: default sloty, kategórie obchodu, domácnosť.

### 3.5 Worker
`worker/index.ts`: Hono app, `errors` middleware, `auth` middleware na `/api/*` a `/img/*`, router `me`, `export`. Test: `GET /api/v1/me` vráti dev používateľa; bez hlavičky a bez dev bypassu 401.

### 3.6 Frontend shell
`AppShell` s bottom nav / rail, 4 prázdne stránky s `EmptyState`, stránka Nastavenia s tlačidlom „Exportovať dáta“. Vuetify theme viditeľne nie default. Lighthouse PWA: inštalovateľné.

### 3.7 Nasadenie a Access
1. Push do GitHubu, v Cloudflare dashboarde Workers → Create → Import repository → Workers Builds (build `pnpm build`, deploy `wrangler deploy`).
2. `pnpm wrangler d1 migrations apply kucharska-kniha-db --remote`.
3. Zero Trust → Access → Applications → Self-hosted: doména `kucharska-kniha.<account>.workers.dev`, policy Allow pre vaše dva e-maily, login method One-time PIN. Skopírovať AUD tag a team domain do vars Workera.
4. Otvoriť na mobile, prihlásiť sa kódom z e-mailu, pridať na plochu. Overiť, že po reštarte PWA ostáva prihlásená (cookie Access má predvolene 24 h, nastaviť session duration na maximum, 1 mesiac).

### 3.8 Hotovo, keď
- Appka beží na `workers.dev`, prihlásenie funguje obom, PWA sa dá nainštalovať na Android aj iPhone.
- `pnpm test` zelený, `pnpm typecheck` čistý, Workers Builds deployuje z `main`.
- Export JSON vráti prázdnu domácnosť s default slotmi a kategóriami.

## 4. Nástroje pre vývoj s AI
- **Vuetify MCP** (hosted `https://mcp.vuetifyjs.com/mcp`) – pridané do `.mcp.json` v projekte; dáva presné API komponentov Vuetify 4. Aktivuje sa po reštarte session a schválení.
- **Cloudflare docs MCP** (`https://docs.mcp.cloudflare.com/mcp`) – aktuálna dokumentácia Workers/D1/R2, tiež v `.mcp.json`.

## 5. Otvorené body
- O1: Potvrdiť predpoklady P1–P5 v časti 0.
- O2: Farebná paleta a font – navrhnem 2–3 varianty vo fáze 0 (vizuálny výber, prípadne cez prehliadač).
- O3: Vee-validate vs. Vuetify `rules` – rozhodne sa pri prvom formulári v F1.
