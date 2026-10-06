# Ďalšie požiadavky: návrh poradia a rozhodnutia

Stav: **na schválenie**, nič z toho sa ešte nerobí. Plán domácností a rolí je hotový samostatne
(`2026-10-06-faza-5-domacnosti.md`).

## A. Používateľské nastavenia, predvolené filtre a i18n

Požiadavky: aplikácia plne lokalizovaná cez i18n; všetky nastavenia sa pamätajú na používateľa (jazyk, vzhľad
a pod.); predvolené filtre sa pamätajú a je tlačidlo na ich úplný reset.

- **Tabuľka `user_settings(user_id, key, value json)`**, nezávislá od domácnosti (platí vo všetkých domácnostiach
  človeka). Kľúče: `locale`, `theme`, `recipeView`, `recipeFilters` (posledné/predvolené filtre), `recipeSort`.
- **API:** `GET /me` vráti `userSettings`; `PUT /me/settings` (len vlastné, zod `strict`).
- **Vzhľad a jazyk** sa dnes držia v `localStorage`; po prihlásení sa načítajú zo servera a lokálna kópia ostáva
  rýchlou predvoľbou pri štarte (bez bliknutia).
- **Predvolené filtre:** filtre zoznamu receptov sa pri každej zmene uložia; pri otvorení Receptov bez filtrov
  v adrese sa načítajú uložené; tlačidlo **Zrušiť všetky filtre** vymaže aktuálne aj uložené (reset).
- **i18n:** `vue-i18n`, jazyky `sk` (predvolený) a `en`. Texty sa presunú z komponentov do `src/locales/*.json`
  (pravidlo v `CLAUDE.md` „texty po slovensky priamo v komponentoch“ sa zmení). Chyby API majú stabilné `code`;
  klient ich prekladá podľa kódu, serverové `message` ostáva slovenský záložný text. Dátumy, čísla a množné čísla
  cez `Intl` a pravidlá i18n. Veľká, mechanická zmena: robiť po fázach (zdieľané komponenty, potom stránky), každá
  s testom, že žiadny kľúč nechýba v oboch jazykoch.
- **Otvorená otázka:** majú sa v angličtine prekladať aj názvy štartovacích surovín a kategórií obchodu (dnes dáta
  v slovenčine)? Odporúčam nie: sú to dáta domácnosti, nie texty aplikácie.

## B. Verejné recepty

Požiadavka: recept dať označiť ako verejný, aby ho videli všetci bez ohľadu na rodinu.

- **Rozhodnutie potrebné od teba:** „všetci“ znamená (1) všetci prihlásení používatelia aplikácie, v každej
  domácnosti (odporúčam), alebo (2) aj ľudia bez prihlásenia cez verejný odkaz? Verzia (2) znamená odkazy mimo
  Cloudflare Access (iná cesta pre Worker, iný model ochrany, cache) a je podstatne väčšia.
- **Návrh (1):** `recipes.visibility` `private` | `public` (predvolene `private`). Verejné recepty sú čitateľné pre
  každého prihláseného, upravovať ich smie len domácnosť, ktorá ich vlastní (a len jej vlastníci môžu zmeniť
  viditeľnosť). Nová stránka **Verejné recepty** (zoznam s filtrami ako Recepty, autor = názov domácnosti) a v
  detaile **Pridať do mojich receptov**: vytvorí kópiu v aktívnej domácnosti (ingrediencie sa spárujú podľa
  `name_normalized`, chýbajúce sa založia, fotka sa skopíruje). Zmena na súkromný recept neovplyvní už vytvorené
  kópie. Kópia nesie `source` s odkazom na pôvodný recept.
- **Bezpečnosť:** čítanie verejného receptu cez nové endpointy (`/public/recipes`), nikdy cez `h` cudzej
  domácnosti; fotky verejných receptov sa servírujú podľa `images.recipe` viditeľnosti, nie len podľa členstva.
- **Testy:** súkromný recept inej domácnosti sa nikdy nevráti; verejný áno; kópia je nezávislá; člen nesmie meniť
  viditeľnosť; vypnutie verejnosti skryje recept z výpisu.

## C. Návštevy (hostia) s alergiami a averziami

Požiadavka: viesť ľudí, ktorí k vám prídu na návštevu, so zoznamom alergénov a averzií, aby sa pri plánovaní
nenavrhlo nič, čo nemajú radi.

- **Model:** typ osoby v Rodine dostane tretiu hodnotu `guest` (návšteva) popri `adult` a `child`. Preferencie
  (alergie, averzie, diéty) už pre každú osobu existujú, takže sa použijú rovnako a bez migrácie (stĺpec je text).
- **Správanie:** návšteva sa **nepočíta do porcií „celej rodiny“** ani do predvoleného publika jedla; pridá sa len
  tam, kde ju vyberieš (publikum jedla `custom`). Upozornenia na alergie a averzie sa zobrazia pri plánovaní jedla,
  v ktorom je vybraná, a v návrhoch „Čo uvariť dnes“, keď si v dialógu zvolíš, že príde návšteva.
- **UI:** v Rodine samostatná skupina **Návštevy** (rýchle pridanie: meno + alergie/averzie), voliteľne
  „platí do“ (po návšteve sa skryje a neprekáža). Úpravy návštev patria vlastníkovi (rovnako ako rodina).
- **Otvorená otázka:** stačí ručné vyberanie návštev pri jedle, alebo chceš aj „týždeň s návštevou“ (zvolíš
  návštevu pre celý deň/týždeň a plánovač bude varovať pri každom jedle)? Odporúčam začať ručným výberom.

## D. Ukážkové recepty

20 základných receptov (zoznam som napísal v chate, čaká na schválenie). Po schválení: tlačidlo „Pridať ukážkové
recepty“ (nie automaticky), vytvorí ich v aktívnej domácnosti (len vlastník).

## E. Čaká na teba (nie je to kód)

- Zapnúť One-time PIN v Cloudflare Zero Trust, aby sa mohla prihlásiť manželka, a pri novej verzii domácností
  zvážiť Access „Everyone“ (viď README). Ak by ju aplikácia po prihlásení pustila s hláškou „nemá prístup“,
  treba ju pozvať v Nastaveniach → Domácnosť a členovia (alebo mať e-mail v `ALLOWED_EMAILS`).

## Odporúčané poradie

1. Dokončiť a nasadiť domácnosti a roly (migrácia `db:migrate:remote` pred nasadením).
2. C. Návštevy (malé, využíva existujúci model).
3. A. Používateľské nastavenia a predvolené filtre (menšia časť), potom i18n po fázach.
4. B. Verejné recepty (po rozhodnutí „všetci prihlásení“ alebo „aj verejný odkaz“).
