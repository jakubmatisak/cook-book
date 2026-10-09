# 1.8.0 – „Hodí sa aj ako“ a základné recepty po kategóriách

Schválené v chate 2026-10-09: hlavný typ jedla + „Hodí sa aj ako“; základné recepty importovateľné a odstrániteľné
po kategóriách v Nastaveniach; už importované sa nemažú, len doplnia.

## A. Hodí sa aj ako (hotové)

- `recipes.also_categories` (JSON pole typov jedla, bez hlavného, v poradí kategórií), migrácia 0013.
- Editor (výber viacerých typov), detail („Hodí sa aj ako: Desiata, Dezert“), hromadná úprava (pridať / odobrať).
- Filter typu jedla, počty v Prehľade a v zozname, verejné recepty a kópia, sprievodca jedálnička berú hlavný typ aj
  „aj ako“.

## B. Nový typ jedla Večera

- `vecera` v `RECIPE_CATEGORIES` (za Desiatou). Studené večere majú typ Večera.
- Sprievodca: jedlo dňa Večera má predvolené typy Hlavné jedlo + Večera.

## C. Základné recepty po kategóriách

**Balíky** (v Nastaveniach každý zvlášť): Raňajky, Desiata, Olovrant, Večera, Polievky, Hlavné jedlá, Šaláty a prílohy,
Dezerty, Detské (len pri zapnutých detských jedlách). Balík ≠ typ jedla receptu (olovrant je napr. Dezert, hodí sa
aj ako Desiata).

- Dáta: každý ukážkový recept má trvalý `key`, balík a `alsoCategories`. 21 doterajších sa rozdelí do balíkov podľa
  typu; pribudne 40 nových (po 10 raňajok, desiat, olovrantov, večerí – typická slovenská kuchyňa).
- `recipes.sample_key` (null pri vlastných receptoch) – podľa neho sa vie, čo je z ktorého balíka.
- `GET /recipes/samples` – pre každý balík `{ set, total, imported }`.
- `POST /recipes/samples?set=<balík>` – po dávkach (limit dopytov Workera) pridá chýbajúce recepty.
  Recept, ktorý domácnosť už má s rovnakým názvom, **bez kľúča a bez fotky** a s pôvodným popisom alebo prvým krokom
  (staršie importy), sa nevytvorí znova, ale **doplní**: kľúč a „hodí sa aj ako“ (ak nemá žiadne).
  Rovnomenný recept s vlastnou fotkou (napr. z vlastných fotiek) sa nechá tak a balík ho preskočí.
  `basic` ostáva ako všetky balíky okrem detských (staršia verzia aplikácie).
- `POST /recipes/samples/remove?set=<balík>` – zmaže (ako bežné mazanie, vrátane jedál v jedálničku a nepoužitých
  fotiek) recepty domácnosti s kľúčom z balíka. Vlastné recepty sa nikdy nezmažú. V Nastaveniach po potvrdení, okno
  upozorní na jedálniček.

## D. Fotky – zrušené

Fotky z Wikimedia Commons sa vybrali, ale používateľ ich odmietol („sú škaredé“). Základné recepty sú bez fotiek;
pri doplnení starších importov sa dopĺňa len kľúč a „hodí sa aj ako“.

## Testy

- Worker: stav balíkov, import, doplnenie staršieho importu, preskočenie rovnomenného
  vlastného receptu s fotkou, odstránenie balíka nechá vlastné recepty, `basic` spätne funguje.
- Unit: dáta (kľúče jedinečné, každý recept prejde schémou, balíky majú 10+ receptov),
  karta v Nastaveniach (import, odstránenie s potvrdením).
