# Overené recepty a Zostaviť jedálniček (1.7.0)

## Cieľ

1. Recept sa dá jedným ťuknutím označiť ako **overený** (uvarili sme a funguje). Platí pre celú domácnosť.
2. V jedálničku je sprievodca **Zostaviť jedálniček**, ktorý na zvolené dni a jedlá dňa navrhne recepty z množiny,
   ktorú si človek určí (napr. len overené, len ešte nevarené). Navrhne aj zvyšky (uvarím raz, jem viac dní). Na konci
   je kontrola, kde sa dá čokoľvek zmeniť, a až po potvrdení sa jedálniček uloží.

Nákup z vlastného obdobia už existuje (Nákup → Z jedálnička → Vlastné obdobie), ostáva bez zmeny.

## Časť A – Overené recepty

**Dáta:** `recipes.is_verified` (bool, predvolene `false`), migrácia. Patrí domácnosti, nie človeku. Kópia verejného
receptu do inej domácnosti príznak nepreberá (tam overený nie je).

**Kde sa nastavuje:**
- **Detail receptu:** prepínač „Overený recept“ v hlavičke. Zmena sa uloží hneď, bez otvárania editora
  (`PUT /recipes/:id/verified`, rovnako ako obľúbené).
- **Editor (nový aj úprava):** prepínač pri základných údajoch; posiela sa s receptom.
- **Hromadné úpravy:** nová akcia „Overený: áno / nie“ pre vybrané recepty.

**Kde je vidieť:**
- Odznak „Overený“ na karte receptu aj v tabuľke.
- Filter v zozname receptov: „Len overené“ (v rýchlych filtroch, pamätá sa v adrese).
- Cudzie verejné recepty príznak nemajú, prepínač sa pri nich nezobrazí.

## Časť B – Zostaviť jedálniček (sprievodca)

Tlačidlo **Zostaviť jedálniček** v hlavičke Plánu otvorí sprievodcu na celú obrazovku (v-dialog fullscreen) s tromi
krokmi (v-stepper). Medzi krokmi sa dá vrátiť, nič sa neukladá až do potvrdenia.

### Krok 1 – Obdobie a jedlá dňa
- Rozsah od–do (najviac 14 dní); predvoľby „Zvyšok týždňa“, „Budúci týždeň“.
- Pre každé zapnuté jedlo dňa domácnosti (Raňajky, Obed, Večera…):
  - **Typy jedla:** predvolene podľa názvu jedla dňa – Raňajky → Raňajky; Desiata/Olovrant → Desiata; Obed → Hlavné
    jedlo; Večera → Hlavné jedlo; inak Hlavné jedlo. Dá sa zmeniť (viac typov).
  - **Obed: aj polievka** – prepínač; ak je zapnutý, obed dostane dve jedlá (polievku a hlavné).
- **Tagy** (voliteľne, napr. „Taková normální kuchařka“) – spoločné pre celé zostavenie.
- **Zvyšky** (hlavné jedlá a polievky): „Variť na viac dní“ a predvolené „+1 deň“ (0–3).
- Obsadené políčka: predvolene sa **nemenia** (sprievodca dopĺňa len prázdne). Voľba „Nahradiť aj obsadené“.
- Detské recepty podľa nastavenia človeka (vypnuté = nikdy).

### Krok 2 – Vymaľuj, čo chceš naplniť
Mriežka **dni × jedlá dňa** (riadky dni, stĺpce jedlá dňa; na mobile dni pod sebou, políčka vedľa seba).
Nad mriežkou sú **farebné štetce** (v-chip-group, jeden zvolený):

| Štetec | Farba | Z čoho sa navrhuje |
|---|---|---|
| Všetky | primárna | všetky recepty domácnosti daného typu |
| Overené | zelená | len overené |
| Nové | modrá | len ešte nevarené |
| Obľúbené | červená | len obľúbené človeka, ktorý zostavuje |
| Nevypĺňať | šedá, preškrtnutá | políčko ostane, ako je |

- Ťuknutie na políčko ho vyfarbí zvoleným štetcom; ťuknutie na **deň** alebo **jedlo dňa** vyfarbí celý riadok
  alebo stĺpec. Predvolene je všetko „Všetky“, obsadené políčka (ak sa nenahrádzajú) sú „Nevypĺňať“ a ukazujú, čo
  v nich je.
- Pod mriežkou súhrn: „Naplní sa 12 políčok: 8× Všetky, 4× Nové“.
- Farby sú tokeny v `src/design/tokens.ts` (success / info / error / surface-variant), nie natvrdo.

### Krok 3 – Kontrola a potvrdenie
Mriežka **dni × jedlá dňa** s navrhnutými receptami (na mobile zoznam po dňoch).
Pri každom políčku:
- **Iný návrh** (ďalší najlepší podľa štetca), **Vybrať recept** (existujúci výber receptu), **Vymazať**.
- **Zvyšky:** pri uvarenom jedle voľba „+0 / +1 / +2 / +3 dni“; nasledujúce dni toho istého jedla dňa sa vyplnia
  ako *Zvyšky: Názov receptu* (dá sa zrušiť – políčko sa uvoľní na nový návrh).
- Súhrn: koľko jedál, koľko varení, koľko zvyškov.

**Potvrdiť** uloží všetko naraz; **Zrušiť** zahodí návrh.

### Ako sa navrhuje
- Kandidáti = recepty domácnosti podľa štetca a typov jedla daného políčka; vynechajú sa recepty s alergénmi členov
  a tie, čo sa varili posledné 3 dni pred rozsahom (rovnako ako dnešné „Čo uvariť dnes“).
- Poradie podľa existujúceho skóre návrhov (čo je doma v špajzi, ako dávno sa varilo, obľúbené, preferencie rodiny)
  s náhodným premiešaním medzi podobne dobrými, aby každé zostavenie nebolo rovnaké.
- **Opakovanie:** hlavné jedlá a polievky sa v rámci zostavenia neopakujú (okrem zvyškov) a nenavrhnú sa ani
  recepty, ktoré už sú v jedálničku v zostavovanom rozsahu. Ostatné typy (raňajky, desiata, …) sa opakovať môžu,
  ale prednosť majú tie, ktoré ešte nepadli. Opakovaný návrh má v kontrole odznak **„Už máme: Po“** (dni, kedy je
  ten istý recept v jedálničku alebo v návrhu).
- **Kto je pri stole:** pre každý deň aktívni členovia rodiny a návštevy, ktoré majú v ten deň pobyt. Recepty, ktoré
  niekto z nich **nemá rád** (Časť D) alebo obsahujú jeho averziu na surovinu, sa navrhujú až keď nič iné nie je;
  alergény sa nenavrhnú nikdy. Každé políčko v kontrole ukáže upozornenie („Peter nemá rád“, „Babka: averzia –
  cibuľa“), aj keď recept človek vybral ručne.
- Keď kandidáti dôjdu, políčko ostane prázdne s textom „Nič nevyhovuje – zmeň štetec alebo vyber ručne“.
- **Zvyšky:** po uvarení s „+N“ dostanú nasledujúcich N vybraných dní v tom istom jedle dňa zvyšky. Ak nasledujúci
  deň v rozsahu nie je (koniec rozsahu, vynechaný deň), zvyšky pokračujú na najbližší ďalší vybraný deň – takto
  sa nedeľné varenie dostane aj na pondelok ďalšieho týždňa, ak je v rozsahu.

### Dáta zvyškov
- `meal_plan_entries.leftover_of_entry_id` (odkaz na položku, kde sa varí; `on delete cascade`). Zvyšky = položka
  s rovnakým receptom a týmto odkazom.
- Pri uvarenej položke sa porcie nastavia na `porcie × (1 + N)` (existujúci `servings_override`), takže **nákup**
  počíta suroviny raz a správne. Zvyšky do nákupu ani do „naposledy varené“ nevstupujú.
- V jedálničku sa zvyšky zobrazia s odznakom „Zvyšky“; zmazanie uvarenej položky zmaže aj jej zvyšky.

### API
- `POST /plan/compose` – vstup: políčka (deň, jedlo dňa, štetec), typy jedál dňa, polievka k obedu, tagy, zvyšky; výstup: návrh (bez zápisu).
- `POST /plan/compose/apply` – vstup: potvrdený návrh (zoznam políčok s receptom, porciami, väzbou zvyškov);
  zapíše položky v jednej dávke (D1 batch, po 15 riadkoch kvôli limitu parametrov) a vráti uložené položky.
- „Iný návrh“ pre jedno políčko volá `compose` s parametrom políčka a zoznamom už použitých receptov.

## Časť C – Zoznam receptov: rozloženie ovládačov

- **Mobil:** prepínač Mriežka / Tabuľka sa presunie z panela Filtre priamo do riadku s hľadaním (vedľa tlačidiel
  Filtre a Výber). Z panela Filtre sa odstráni.
- **Počítač:** tlačidlá Filtre, Obľúbené a Čo viem uvariť sa presunú doprava – celý riadok ovládačov bude zarovnaný
  vpravo (Filtre · Obľúbené · Čo viem uvariť · Zoradenie · smer · Mriežka/Tabuľka · Výber). Panel filtrov sa otvára
  sprava ako doteraz.

## Časť D – Pri stole: jedlá, ktoré niekto nemá rád

- Každý človek (člen aj návšteva) má v karte Pri stole sekciu **Nemá rád jedlá**: combobox, kde sa vyberie recept
  z kuchárky, alebo sa napíše voľný text („rybacia polievka“), ak recept v kuchárke nie je. Zobrazujú sa ako čipy
  s krížikom.
- Dáta: nový druh preferencie `dislike_recipe` v `member_preferences` + stĺpec `recipe_id` (odkaz na recept,
  `on delete set null`); voľný text v `note`. Migrácia.
- Zhoda s receptom: rovnaký `recipe_id`, alebo voľný text, ktorý sa po normalizácii (bez diakritiky, malé písmená)
  zhoduje s názvom receptu alebo je v ňom obsiahnutý.
- Upozornenia v jedálničku (existujúce upozornenia na alergie a averzie) ukážu aj „Peter nemá rád“ – rovnako pre
  návštevy vybrané pri jedle. Sprievodca Zostaviť jedálniček ich berie do úvahy (Časť B, Kto je pri stole).

## Časť E – Detail receptu na počítači (rozloženie B)

Podľa návrhu B (canvas „Detail receptu – desktop“), len od `mdAndUp`; mobil ostáva bez zmeny.

- **Hlavička na celú šírku** (v-card, `surface`): vľavo štvorcová fotka 280 × 280; vpravo kategória kapitálkami,
  názov, tagy a odznak „Overený“, riadok údajov (Porcie · Náročnosť · Naposledy varené · Zdroj) a tlačidlá Režim
  varenia (primárne) a Naplánovať. Ikonové akcie (obľúbené, upraviť, ponuka) ostávajú v lište hore.
- Recept bez fotky: hlavička bez fotky, text na celú šírku.
- **Telo:** stĺpec Suroviny (380 px, s počtom porcií a skupinami) oddelený linkou od stĺpca Postup (max. 820 px).
- Pod postupom prílohy a poznámky ako doteraz; zdroj je na počítači v riadku údajov hlavičky (na mobile ostáva
  úplne dole).

## Mimo rozsahu
- Automatické naplánovanie nákupu (nákup sa generuje ako doteraz).
- Šablóny zostavenia (uložené nastavenia sprievodcu) – prípadne neskôr.
- Zvyšky pre raňajky a v inom jedle dňa (napr. obed → večera).

## Testy
- Worker: overené (prepínač, editor, hromadne, filter, kópia bez príznaku); compose (štetce, typy, opakovanie len mimo hlavných jedál a polievok,
  alergény, odznak „Už máme“, zvyšky cez koniec týždňa, obsadené políčka); apply (dávka, porcie × (1+N), zvyšky
  mimo nákupu a cook logu, kaskádové mazanie).
- Unit: prepínač v detaile, editore a hromadných úpravách; sprievodca – kroky, maľovanie štetcom (políčko, riadok, stĺpec), iný návrh, zvyšky +N, potvrdenie; zoznam receptov – prepínač pohľadu na mobile mimo panela, ovládače vpravo na počítači.
- Worker aj unit: averzia na jedlo (recept aj voľný text), upozornenie v jedálničku a v sprievodcovi, návšteva s pobytom; detail na počítači v rozložení B.
- Verzia 1.7.0 (CHANGELOG, README, tag), migrácia pred nasadením.
