# Plán: domácnosti, vlastníci a členovia

Stav: **na schválenie**, kód sa nezačal. Rozhodnutia používateľa:

- členov pridáva vlastník v aplikácii (pozvánky),
- len vlastník mení nastavenia domácnosti, členov a roly, export a rodinu,
- existujúce účty: prvý = vlastník, druhý = člen,
- jeden človek môže byť členom **viacerých domácností** (napr. vlastná a rodičov); každá má **vlastný jedálniček,
  nákupný zoznam, špajzu, recepty, rodinu a nastavenia**. Člen jednej domácnosti vojde rovno, člen viacerých si vyberie.

## Čo smie kto (v rámci jednej domácnosti)

| Oblasť                                                                               | Člen | Vlastník |
| ------------------------------------------------------------------------------------ | :--: | :------: |
| Recepty, plán, nákup, špajza, stále položky, tagy, ingrediencie, import, tlač        |  ✔   |    ✔     |
| Vlastný vzhľad/jazyk/filtre (používateľské nastavenia, platia vo všetkých domácnostiach) |  ✔   |    ✔     |
| Nastavenia domácnosti (začiatok týždňa, porcia dieťaťa, koreniny, názov, časy jedál) |  –   |    ✔     |
| Rodina: osoby, alergie, averzie                                                      |  –   |    ✔     |
| Členovia a roly: pozvať, zmeniť rolu, odobrať                                        |  –   |    ✔     |
| Export a záloha (JSON, Markdown všetkých receptov)                                   |  –   |    ✔     |

Vlastníkov môže byť v domácnosti viac, vždy aspoň jeden. Rola je **na členstve**: môžeš byť vlastníkom u seba a členom u
rodičov. Člen vidí zoznam členov a rodinu iba na čítanie.

## Dátový model (migrácia `0002_domacnosti.sql`)

- Nová tabuľka `household_members(user_id, household_id, role 'owner'|'member', last_login_at, created_at)`,
  primárny kľúč `(user_id, household_id)`, cudzie kľúče s kaskádou.
- Backfill: každý existujúci účet dostane členstvo vo svojej doterajšej domácnosti; najstarší podľa `created_at` je
  `owner`, ostatní `member`. Nič sa nemaže.
- `users.household_id` sa prestane používať (stĺpec ostane, aby migrácia bola bezpečná; nové kódy ho nečítajú).
  `users` ostáva len ako identita (e-mail, meno).
- Pozvánka = riadok v `users` (ak e-mail ešte nie je) + riadok v `household_members`; pri prvom prihlásení ho
  `ensureUser` nájde.
- Export dostane tabuľku `householdMembers` (poradie po `users` a `households`).
- Migráciu treba pri nasadení aplikovať na produkčnú D1: `npm run db:migrate:remote` pred `wrangler deploy`.

## Aktívna domácnosť (jadro zmeny)

- Požiadavka nesie ID domácnosti v **query parametri `h`** (`apiFetch` ho pridáva automaticky). Nie v hlavičke:
  service worker kešuje odpovede `GET /api/v1/*` podľa adresy, takže by sa pri hlavičke zmiešali dáta dvoch domácností.
- `authMiddleware` overí členstvo (`user_id` + `h`), nastaví `c.get('user')` s `householdId` a `role` pre túto
  domácnosť. Neplatné alebo cudzie `h` → 403. Chýbajúce `h`: ak má používateľ jedinú domácnosť, použije sa ona;
  inak 400 `household_required`. Všetky existujúce routy ďalej filtrujú `user.householdId`, takže sa neprepisujú.
- `GET /me` bez `h` vráti zoznam domácností používateľa (`id`, `name`, `role`) a, ak je len jedna, rovno jej dáta.
  S `h` vráti dáta tej domácnosti ako dnes plus `user.role` a `households`.
- **Nákupný zoznam:** `shopping_lists` už má `household_id`, takže každá domácnosť má vlastný predvolený zoznam. Kľúče
  cache v TanStack Query dostanú ID domácnosti, takže sa pri prepnutí nikdy neukážu položky inej domácnosti.
- **Offline fronta odškrtávania nákupu** si ku každej čakajúcej zmene uloží ID domácnosti a odošle ju s týmto `h`,
  nikdy s aktuálnym. Zmena v inej domácnosti sa nikdy nepošle do aktívnej.
- Obľúbené a „naposledy varené“ sú naviazané na recept, a ten patrí jednej domácnosti, takže sa nemiešajú.

## Vstup a výber domácnosti

- **Jedna domácnosť:** po prihlásení rovno dnu, žiadny výber.
- **Viac domácností:** pri otvorení aplikácie v novom okne prehliadača sa ukáže stránka **Vyber domácnosť**
  (zoznam s názvom a rolou; naposledy použitá je zvýraznená). Voľba sa drží v `sessionStorage`, takže dve karty
  môžu byť v dvoch domácnostiach naraz, a zapíše sa aj ako „naposledy použitá“.
- V hlavičke je **prepínač domácností** (názov aktívnej, menu s ostatnými); zobrazí sa len pri viac ako jednej.
  Prepnutie vyprázdni cache dopytov a presmeruje na úvod.
- Odkazy v aplikácii (napr. `/nakup`) ostávajú rovnaké; ID domácnosti žije v stave, nie v URL stránky.

## Prístup do aplikácie (kam ide `ALLOWED_EMAILS`)

1. Vstup: e-mail je povolený, ak je v `ALLOWED_EMAILS` **alebo** má aspoň jedno členstvo.
2. `ALLOWED_EMAILS` ostáva tajomstvom (`wrangler secret put ALLOWED_EMAILS`) a stáva sa zoznamom **správcov
   inštancie**: štartovací zoznam a záloha. Ich e-mail sa v aplikácii neodoberie (zámok „nastavené pri nasadení“).
3. Prázdna databáza: prvý prihlásený e-mail zo zoznamu založí domácnosť a stane sa vlastníkom.
4. **Zakladanie ďalších domácností** (napr. rodičov) smie len e-mail z `ALLOWED_EMAILS`; ostatných pozýva vlastník
   do existujúcich domácností. Dôvod: pri Access „Everyone“ nesmie môcť ktokoľvek zakladať domácnosti (limity free plánu).
5. Cloudflare Access: odporúčané **Allow → Include: Everyone** s One-time PIN (Access len overí e-mail, aplikácia
   rozhodne o prístupe; nový člen sa pridáva len v aplikácii). Prísnejšie: ponechať zoznam e-mailov v Access.
   Cudzí e-mail bez členstva dostane 403 a žiadne dáta.

## Backend

- `UserRow`/kontext: `householdId`, `role` platné pre aktívnu domácnosť.
- Middleware `requireOwner` → `HttpError(403, 'owner_required', 'Túto zmenu môže urobiť len vlastník domácnosti.')` na:
  `PUT /settings`, `PUT /slots/:id`, `POST|PUT|DELETE /members…` (rodina vrátane preferencií), `GET /export`,
  `GET /export/recipes.md`, `/household/*`. `POST /ingredients/starter` ostáva otvorené (volá sa automaticky).
- `/household` (všetko v aktívnej domácnosti):
  - `GET /household/members` → `[{ userId, email, name, role, lastLoginAt, locked }]` (pre všetkých, len čítanie).
  - `POST /household/members { email, role }` pozvánka; neplatný e-mail 400, už člen 409.
  - `PUT /household/members/:userId { role }`, `DELETE /household/members/:userId`; poistka posledného vlastníka
    → 409 `last_owner`; `locked` e-mail sa nedá odobrať → 409 `locked`. Odobratie zmaže len členstvo, nie účet.
  - `PUT /household { name }` premenovanie.
- `POST /households { name }` (len e-mail z `ALLOWED_EMAILS`): založí domácnosť s predvolenými slotmi, kategóriami,
  zoznamom a nastaveniami (`ensureHousehold` sa zovšeobecní na `createHousehold`) a zakladateľa urobí vlastníkom.
- `lastLoginAt` sa zapíše najviac raz za hodinu (šetrí zápisy na free pláne).

## Frontend

- Stav aktívnej domácnosti (`src/lib/household.ts`: čítanie/zápis `sessionStorage`, „naposledy použitá“ v `localStorage`),
  `apiFetch` pridáva `h`. Query kľúče obsahujú ID domácnosti.
- Stránka **Vyber domácnosť** a prepínač v hlavičke (čisté Vuetify: `v-list`, `v-menu`).
- `useIsOwner()` z `/me`; server je zdroj pravdy, klient len skrýva/zakazuje.
- **Nastavenia** sa rozdelia na „Moje“ (vzhľad; neskôr jazyk a filtre) a „Domácnosť“ (len vlastník; člen vidí zakázané
  s textom „Zmeniť môže len vlastník.“). Nová karta **Členovia domácnosti** (zoznam, pozvať, zmena roly, odobratie
  s potvrdením). Rodina a export: tlačidlá len pre vlastníka. Pre správcu inštancie tlačidlo „Nová domácnosť“.
- Čisté Vuetify, texty po slovensky v komponentoch (alebo cez i18n, ak sa zavedie skôr), žiadne rodovo odvodené
  texty podľa mena.

## Poradie krokov (každý: testy → `npm run check` → commit; nasadenie až na pokyn)

1. **Schéma a migrácia** (`household_members`, backfill, export). Testy: backfill (najstarší = vlastník), export obsahuje tabuľku.
2. **Kontext domácnosti a autorizácia vstupu.** Testy: jedna domácnosť bez `h` funguje; viac domácností bez `h` → 400;
   cudzie `h` → 403; pozvaný e-mail mimo `ALLOWED_EMAILS` prejde; cudzí 403; prvý e-mail v prázdnej DB = vlastník;
   izolácia dát medzi domácnosťami (recepty, plán, **nákupný zoznam**, špajza).
3. **`requireOwner` na chránených routách.** Test na každú routu: člen 403, vlastník 2xx; rola je podľa aktívnej
   domácnosti (vlastník v A je člen v B).
4. **Správa členov a domácností** (`/household/*`, `POST /households`). Testy: pozvánka, duplicita, rola, odobratie,
   posledný vlastník, `locked`, premenovanie, zakladanie len pre správcu.
5. **Klient: aktívna domácnosť.** `apiFetch` s `h`, kľúče cache, **offline fronta s ID domácnosti**, stránka výberu, prepínač.
   Testy: fronta odošle zmenu do pôvodnej domácnosti aj po prepnutí; cache sa nemieša.
6. **Klient: roly v UI.** Karta Členovia, zakázané/skryté prvky pre člena, rozdelenie Nastavení; testy + overenie
   v prehliadači (desktop a 375 px, dve domácnosti, nákupný zoznam v oboch).
7. **Dokumentácia:** README (EN + SK) a špecifikácia: domácnosti, roly, pozvánky, Access, úloha `ALLOWED_EMAILS`, migrácia.

## Poradie s ďalšími požiadavkami

Najprv tento plán, potom používateľské nastavenia (jazyk, vzhľad, predvolené filtre s resetom) v tabuľke
`user_settings` (podľa `user_id`, nezávisle od domácnosti) a potom i18n.

## Riziká a poistky

- **Miešanie dát domácností:** `h` v URL (nie v hlavičke) kvôli service worker cache, kľúče cache s ID domácnosti,
  offline fronta s ID domácnosti, testy izolácie na úrovni API aj klienta.
- **Vymknutie sa z aplikácie:** poistka posledného vlastníka a zámok e-mailov z `ALLOWED_EMAILS`.
- **Nasadenie:** kód očakáva tabuľku `household_members`; poradie `db:migrate:remote` → `build` → `wrangler deploy`.
  Nasadiť až po overení krokov 2 a 5 (izolácia).
- **Starý klient po nasadení:** PWA s tabom bez `h` funguje, kým má používateľ jedinú domácnosť; ďalšie domácnosti
  vyžadujú aktualizovanú aplikáciu (dve obnovenia stránky).
