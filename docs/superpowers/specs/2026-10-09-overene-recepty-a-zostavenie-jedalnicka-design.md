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

Tlačidlo **Zostaviť jedálniček** v hlavičke Plánu otvorí sprievodcu na celú obrazovku (v-dialog fullscreen) so štyrmi
krokmi (v-stepper). Medzi krokmi sa dá vrátiť, nič sa neukladá až do potvrdenia.

### Krok 1 – Dni
- Výber dní z kalendárového rozsahu (od–do, najviac 14 dní); predvoľby „Zvyšok týždňa“, „Budúci týždeň“.
- Každý deň sa dá odškrtnúť (napr. bez soboty).
- Obsadené jedlá dňa: predvolene sa **nemenia** (sprievodca dopĺňa len prázdne). Voľba „Nahradiť aj obsadené“.

### Krok 2 – Jedlá dňa a z čoho vyberať
Pre každé zapnuté jedlo dňa domácnosti (Raňajky, Obed, Večera…) riadok s nastavením:
- **Zapnuté áno/nie** (napr. raňajky nezostavovať).
- **Typy jedla:** predvolene podľa názvu jedla dňa – Raňajky → Raňajky; Desiata/Olovrant → Desiata; Obed → Hlavné
  jedlo; Večera → Hlavné jedlo; inak Hlavné jedlo. Dá sa zmeniť (viac typov).
- **Obed: aj polievka** – prepínač; ak je zapnutý, obed dostane dve jedlá (polievku a hlavné).
- **Množina** (spoločná pre všetky jedlá dňa, dá sa prepísať pre konkrétny deň v kroku 3):
  - Všetky recepty / **Len overené** / **Len nové** (ešte nevarené) / Len obľúbené.
  - Tagy (voliteľne, napr. „Taková normální kuchařka“).
  - Detské recepty podľa nastavenia človeka (vypnuté = nikdy).
- **Zvyšky** (pre hlavné jedlá, nie raňajky): prepínač „Variť na viac dní“ a predvolené „+1 deň“ (0–3).

### Krok 3 – Výnimky po dňoch (voliteľné)
Zoznam vybraných dní; pri každom sa dá prepnúť množina len pre ten deň (napr. „v nedeľu len nové“) alebo deň vynechať.
Krok je zbalený, kto ho nepotrebuje, ide rovno ďalej.

### Krok 4 – Kontrola a potvrdenie
Mriežka **dni × jedlá dňa** s navrhnutými receptami (na mobile zoznam po dňoch).
Pri každom políčku:
- **Iný návrh** (ďalší najlepší z množiny), **Vybrať recept** (existujúci výber receptu), **Vymazať**.
- **Zvyšky:** pri uvarenom jedle voľba „+0 / +1 / +2 / +3 dni“; nasledujúce dni toho istého jedla dňa sa vyplnia
  ako *Zvyšky: Názov receptu* (dá sa zrušiť – políčko sa uvoľní na nový návrh).
- Súhrn: koľko jedál, koľko varení, koľko zvyškov.

**Potvrdiť** uloží všetko naraz; **Zrušiť** zahodí návrh.

### Ako sa navrhuje
- Kandidáti = recepty domácnosti z množiny a typov jedla daného políčka; vynechajú sa recepty s alergénmi členov
  a tie, čo sa varili posledné 3 dni pred rozsahom (rovnako ako dnešné „Čo uvariť dnes“).
- Poradie podľa existujúceho skóre návrhov (čo je doma v špajzi, ako dávno sa varilo, obľúbené, preferencie rodiny)
  s náhodným premiešaním medzi podobne dobrými, aby každé zostavenie nebolo rovnaké.
- V rámci jedného zostavenia sa recept neopakuje (okrem zvyškov). Keď kandidáti dôjdu, políčko ostane prázdne
  s textom „Nič nevyhovuje – zmeň množinu alebo vyber ručne“.
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
- `POST /plan/compose` – vstup: dni, nastavenia jedál dňa, množina, výnimky, zvyšky; výstup: návrh (bez zápisu).
- `POST /plan/compose/apply` – vstup: potvrdený návrh (zoznam políčok s receptom, porciami, väzbou zvyškov);
  zapíše položky v jednej dávke (D1 batch, po 15 riadkoch kvôli limitu parametrov) a vráti uložené položky.
- „Iný návrh“ pre jedno políčko volá `compose` s parametrom políčka a zoznamom už použitých receptov.

## Mimo rozsahu
- Automatické naplánovanie nákupu (nákup sa generuje ako doteraz).
- Šablóny zostavenia (uložené nastavenia sprievodcu) – prípadne neskôr.
- Zvyšky pre raňajky a v inom jedle dňa (napr. obed → večera).

## Testy
- Worker: overené (prepínač, editor, hromadne, filter, kópia bez príznaku); compose (množina, typy, bez opakovania,
  alergény, výnimky dňa, zvyšky cez koniec týždňa, obsadené políčka); apply (dávka, porcie × (1+N), zvyšky
  mimo nákupu a cook logu, kaskádové mazanie).
- Unit: prepínač v detaile, editore a hromadných úpravách; sprievodca – kroky, iný návrh, zvyšky +N, potvrdenie.
- Verzia 1.7.0 (CHANGELOG, README, tag), migrácia pred nasadením.
