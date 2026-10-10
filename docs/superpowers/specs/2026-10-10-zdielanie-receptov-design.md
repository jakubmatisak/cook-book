# 1.10.0 – Zdieľanie receptov s konkrétnym e-mailom

Schválené v chate 2026-10-10. Domácnosť ponúkne recepty (vybrané, celú kategóriu alebo tag) na e-mail; príjemca ich
prijme (všetky alebo vybrané) a jeho domácnosť ich má len na čítanie, môže si ich skopírovať k sebe. Verejný odkaz
`/s/<token>` (1.5.0) ostáva bez zmeny.

## Rozhodnutia

| Otázka | Rozhodnutie |
|---|---|
| E-mail bez účtu | Zdieľanie počká; pri prvom prihlásení človeka s čakajúcou ponukou sa založí účet a vlastná domácnosť (vlastník). Kto sa prihlási, rozhoduje stále Cloudflare Access. |
| Komu zdieľanie patrí | Domácnosti: odosiela domácnosť (vidia všetci jej členovia), po prijatí ho vidí celá domácnosť príjemcu. Kontakty sú domácnosti. |
| Plán a nákup u príjemcu | Len cez kópiu: „Pridať do plánu“ / „Do nákupu“ najprv potichu skopíruje recept a pracuje s kópiou. |
| Kategória / tag | Prijíma sa celé; recepty pridané neskôr pribúdajú samy, príjemca dostane upozornenie „pribudli N receptov“. |
| Výber pri prijatí | Len pri ponuke konkrétnych receptov (Prijať všetko / Vybrať… / Odmietnuť). |
| Upozornenia | Len v aplikácii (Prehľad, počet v menu); e-mailom nie (free plán). |

V prvej verzii sú všetky doplnkové nápady: živé zdieľanie (príjemca vidí aktuálnu verziu), zrušenie a prehľad
„Zdieľam / Zdieľané so mnou“, zdieľanie kategórie a tagu, správa k zdieľaniu, výber pri prijatí, filtre v zozname
receptov, pôvod kópie s upozornením na zmenu originálu.

## A. Dáta (jedna migrácia)

**`contacts`** – kontakty domácnosti.
- `id`, `household_id` (cascade), `email` (malými písmenami), `name` (nepovinné, napr. „Svokra“), `created_at`,
  `updated_at`; unikátny index `(household_id, email)`.
- Uloží sa automaticky pri prvom zdieľaní na e-mail; v Nastaveniach premenovanie a zmazanie (zmazanie kontaktu
  nezruší zdieľania).

**`recipe_shares`** – jedna ponuka.
- `id`, `from_household_id` (cascade), `from_user_id` (set null), `to_email`, `to_household_id` (set null, vyplní sa
  pri prijatí), `kind` (`recipes` | `category` | `tag`), `category` (pri `category`), `tag_id` (pri `tag`, cascade),
  `message` (≤ 500 znakov), `status` (`pending` | `accepted` | `declined` | `revoked`), `created_at`,
  `responded_at`, `seen_at` (príjemca naposledy videl obsah – kvôli „pribudli recepty“).
- Indexy: `(to_email, status)`, `(to_household_id, status)`, `(from_household_id, status)`.

**`recipe_share_items`** – recepty v ponuke druhu `recipes`.
- `share_id` (cascade), `recipe_id` (cascade), PK `(share_id, recipe_id)`, index `recipe_id`.
- Pri prijatí s výberom sa nevybrané riadky zmažú.

**`recipes`** – pôvod kópie.
- `copied_from_recipe_id` (bez cudzieho kľúča – originál môže zaniknúť), `copied_from_name` (napr. „Jakub“),
  `copied_source_updated_at` (`updated_at` originálu v čase kópie / poslednej náhrady).

## B. Prístup

- **Čítanie cudzieho receptu**: domácnosť H smie čítať recept R inej domácnosti, len ak existuje zdieľanie so
  `status = accepted`, `to_household_id = H`, `from_household_id = R.household_id`, R nie je zmazaný a zároveň:
  `kind = recipes` a R je v `recipe_share_items`, alebo `kind = category` a R má kategóriu v hlavnom type alebo
  „hodí sa aj ako“, alebo `kind = tag` a R má daný tag. Inak 404 (ako neexistujúci recept).
- Obal receptu (`/img/...`) sa smie zobraziť aj domácnosti, ktorá recept smie čítať.
- **Zápis**: všetky úpravy ostávajú filtrované na vlastnú domácnosť – zdieľaný recept príjemca nezmení, neohodnotí,
  nepridá poznámku.
- **Súkromie**: odosielateľ nezistí, či e-mail patrí používateľovi (rovnaká odpoveď); vidí len stav ponuky.
  Príjemca vidí meno odosielateľa a názov jeho domácnosti.
- **Prvé prihlásenie** (`worker/middleware/auth.ts`): e-mail bez účtu a bez ALLOWED_EMAILS, na ktorý čaká ponuka
  (`pending`), dostane účet a vlastnú domácnosť (vlastník, názov podľa mena z e-mailu). Bez čakajúcej ponuky ostáva
  403 „Tento účet nemá prístup do Peace in Kitchen.“

## C. API (`/api/v1/sharing`; `/api/v1/shared` je verejný odkaz)

- `POST /sharing` `{ emails[], kind, recipeIds?, category?, tagId?, message? }` – vytvorí ponuky (jednu na e-mail);
  ak tomu istému e-mailu už čaká ponuka druhu `recipes`, recepty sa pridajú k nej. Uloží kontakty. Vráti
  `{ created, merged }` bez informácie o existencii účtov.
- `GET /sharing/outgoing` – ponuky mojej domácnosti: príjemca (kontakt/e-mail), čo, stav, počet receptov, dátum.
- `POST /sharing/:id/revoke` – odosielateľ zruší; `POST /sharing/:id/items/remove { recipeIds }` – odoberie recepty.
- `GET /sharing/incoming` – čakajúce ponuky na môj e-mail a prijaté zdieľania mojej domácnosti (zoskupené podľa
  odosielateľa) vrátane počtu nových receptov od `seen_at`.
- `POST /sharing/:id/accept { recipeIds? }` – prijme do aktívnej domácnosti (voliteľne len vybrané);
  `POST /sharing/:id/decline`; `POST /sharing/:id/leave` – príjemca zdieľanie zruší zo svojej strany;
  `POST /sharing/:id/seen`.
- `GET /sharing/recipes` – recepty zdieľané s mojou domácnosťou (súhrny s `sharedFrom`), pre filter „Zdieľané so
  mnou“; `GET /sharing/recipes/:id` – detail len na čítanie.
- `POST /sharing/recipes/:id/copy` – kópia k sebe (s pôvodom); `POST /recipes/:id/replace-from-source` – nahradí
  moju kópiu aktuálnou verziou originálu (ak ho ešte smiem čítať).
- `GET /sharing/notices` – upozornenia pre Prehľad: čakajúce ponuky, pribudnuté recepty, zmenené originály kópií
  (s možnosťou skryť – `POST /sharing/notices/dismiss`).
- `GET /contacts`, `PATCH /contacts/:id { name }`, `DELETE /contacts/:id`.
- Detail vlastného receptu dostane `sharedWith: { name|email }[]` (len prijaté a čakajúce).

## D. UI

**Odosielateľ**
- Detail receptu: v ponuke zdieľania „Zdieľať s…“ vedľa verejného odkazu. Dialóg: pole e-mailov ako čipy
  (`v-combobox` multiple chips, overenie e-mailu, našepkáva len kontakty), prepínač „Vybrané recepty / Celá kategória
  / Celý tag“ (kategória a tag cez `v-select`), nepovinná správa, súhrn „Zdieľaš 5 receptov s 2 ľuďmi“.
- Zoznam receptov: hromadná akcia „Zdieľať s…“ (rovnaký dialóg s vybranými receptami).
- Tagy: pri tagu akcia „Zdieľať tag“.
- Nová stránka **Zdieľanie** (`/sharing`, v SECONDARY_NAV, počet čakajúcich ponúk ako odznak): karty
  „Zdieľam“ a „Zdieľané so mnou“. Pri odoslaných: komu, čo, stav (čip), dátum; akcie Zrušiť, Odobrať recept.
- Detail receptu: „Zdieľané so: Svokra, Mama“. Zoznam receptov: filter „Zdieľam“.
- Po zdieľaní na nový e-mail pripomienka: „Aby sa mohol prihlásiť, pridaj jeho e-mail do Cloudflare Access.“
- Nastavenia: karta **Kontakty** (premenovať, zmazať).

**Príjemca**
- Prehľad: karta ponuky („Jakub (Matisákovci) s tebou chce zdieľať 5 receptov“ + správa): Prijať všetko /
  Vybrať… (dialóg so zaškrtávaním) / Odmietnuť. Ďalej upozornenia „V tagu Vianoce od Jakuba pribudli 2 recepty“
  (Zobraziť, Skryť) a „Recept Bábovka, ktorý máš skopírovaný, sa u Jakuba zmenil“ (Otvoriť originál, Nahradiť moju
  kópiu s potvrdením, Skryť).
- Zoznam receptov: filter „Zdieľané so mnou“, karty s odznakom „Od Jakuba“; predvolene sa cudzie recepty
  nemiešajú do zoznamu, návrhov ani sprievodcu jedálnička.
- Detail zdieľaného receptu len na čítanie: bez úprav, mazania, hodnotenia, poznámok; tlačidlá Skopírovať k sebe,
  Pridať do plánu, Do nákupu (obe cez tichú kópiu).
- Kópia: čip „Skopírované od Jakuba“, inak bežný vlastný recept.

**Vzhľad**: len Vuetify, farby z tokenov, hustota cez `useDensity`, texty SK aj EN.

## E. Pravidlá a limity

- E-maily bez ohľadu na veľkosť písmen; vlastný e-mail a členovia vlastnej domácnosti sa zadať nedajú
  („Tento človek už je vo vašej domácnosti“).
- Najviac 20 príjemcov naraz, 200 receptov v ponuke, 100 čakajúcich ponúk na domácnosť.
- Vkladanie po dávkach (D1: 100 premenných na dotaz, 50 dotazov na požiadavku).
- Zmazaný recept zo zdieľania zmizne; ponuka bez receptov sa skryje. Odmietnuté a zrušené ponuky ostávajú
  v prehľade odosielateľa so stavom; tie isté recepty sa dajú ponúknuť znova.
- Po zrušení zdieľania príjemca stratí prístup, kópie mu ostanú.

## F. Testy a kontrola UI

- Worker (TDD): prístup podľa stavu (pending/declined/revoked neukáže), kategória a tag vrátane neskôr pridaných,
  zákaz zápisu, obal receptu, prvé prihlásenie (účet + domácnosť vs. 403), kontakty, zlúčenie čakajúcej ponuky,
  kópia s pôvodom a upozornenie na zmenu originálu, náhrada kópie, limity a dávky, rovnaká odpoveď pre známy
  aj neznámy e-mail.
- Frontend: dialóg s čipmi, hromadná akcia, karty na Prehľade, výber pri prijatí, detail len na čítanie, stránka
  Zdieľanie, karta Kontakty.
- Kontrola UI lokálne v Playwright Chromiu: všetky nové obrazovky na mobile aj desktope, hustota kompaktná /
  pohodlná / predvolená, svetlá aj tmavá téma, aspoň 2 farebné schémy; opraviť zarovnanie a výšky, screenshoty
  poslať používateľovi.

## G. Vydanie

Verzia 1.10.0 (bežné miesta verzie), tag. Migrácia do produkčnej D1 a nasadenie až na pokyn používateľa; potom
pridať e-mail príjemcu do Cloudflare Access a overiť v produkcii.
