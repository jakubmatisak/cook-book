# Zmeny

## 1.5.3 – 2026-10-08

### Opravy

- Mriežka receptov má toľko stĺpcov, koľko sa zmestí: 4 pri 1440 px, 5 na Full HD, na mobile jeden.

## 1.5.2 – 2026-10-08

### Opravy

- Späť v detaile receptu vedie vždy do receptov, nie späť do režimu varenia či na inú predošlú stránku.
- Ikony v lište detailu receptu sú rovnako veľké (srdiečko bez pozadia); akcie zdieľania sú štítky rovnakej
  veľkosti ako Zdieľané.
- Panel ingrediencií v režime varenia má na počítači riadny nadpis.

## 1.5.1 – 2026-10-08

### Opravy

- Na ultraširokom monitore má obsah najviac Full HD šírku (1920 px) a je vycentrovaný.
- Tlač zdieľaného a verejného receptu je kompaktná ako pri detaile: suroviny a postup vedľa seba, menší nadpis
  a hustejšie riadky.

## 1.5.0 – 2026-10-08

### Nové

- Zdieľanie receptu odkazom: detail receptu → Zdieľať odkazom vytvorí odkaz, ktorý recept (s fotkou a tlačidlom
  Tlačiť) otvorí komukoľvek aj bez prihlásenia. Zdieľaný recept je hore označený, odkaz sa dá skopírovať a
  zdieľanie zastaviť. Vyžaduje výnimku Bypass v Cloudflare Access (návod v README).

### Opravy

- Verejný recept čísluje kroky od 1 (predtým od 2).

## 1.4.6 – 2026-10-08

### Nové

- Recepty sa dajú zoradiť podľa kategórie (aj stĺpec Kategória v tabuľke), v poradí typov jedla.
- Obsah na počítači využíva celú šírku obrazovky.

### Opravy

- Fotky, ktoré už nepoužíva žiadny recept (po výmene titulnej fotky alebo zmazaní receptu), sa zmažú z úložiska.

## 1.4.5 – 2026-10-08

### Nové

- Kategória Prílohové omáčky a Pestá (filter, úvodná stránka, editor, import z webu, Markdown export).
- Detail receptu: titulná fotka je menší štvorec vpravo a text ju obteká (pod 600 px ostáva hore na celú
  šírku), aby sa nenaťahovala a bola ostrá aj z malého súboru. Rovnako verejný recept.
- Popis receptu je zarovnaný do bloku.

## 1.4.4 – 2026-10-08

### Opravy

- Rýchlejšia Špajza, zlúčenie a mazanie ingrediencií a ukladanie receptu: ďalšie indexy v databáze, dotazy už
  neprechádzajú celé tabuľky.

## 1.4.3 – 2026-10-08

### Opravy

- Aplikácia sa sama načíta znova najviac raz za 15 s, takže sa po vydaní novej verzie nemôže obnovovať dokola.

## 1.4.2 – 2026-10-08

### Opravy

- Ingrediencie sa načítajú bez čítania celej databázy (index na počet použití). Predtým jedno otvorenie
  zoznamu prečítalo stovky tisíc riadkov a appka sa blížila k dennému limitu databázy na free pláne.

## 1.4.1 – 2026-10-08

### Opravy

- Písmo podľa typografie Vuetify 4: popisy, nápovedy a nadpisy majú opäť správnu veľkosť (staré triedy
  z Vuetify 3 sa ticho ignorovali). Režim varenia má väčší text krokov, sekcie Nastavení sú veľkými písmenami.

## 1.4.0 – 2026-10-07

### Nové

- Ingrediencie: zlúčenie dvoch a viac ingrediencií (napr. Banán a Banány) – v hromadnom výbere tlačidlo Zlúčiť,
  výber, ktorá ostane, a prípadne nový názov. Recepty, nákup, špajza, stále položky aj alergie sa prepíšu na
  ponechanú, zásoby sa sčítajú a zlúčené názvy si ingrediencia zapamätá, takže ďalší import ich priradí k nej.
- Mobil: nadpis, hľadanie a filtre zoznamov ostávajú hore, posúva sa len zoznam; menší nadpis stránky.
- Tagy a Pri stole majú rovnaké rozloženie ako ostatné zoznamy (ukotvená hlavička, akcie ako ikonky na mobile).

## 1.3.2 – 2026-10-07

### Opravy

- Mobil: prvé otvorenie po vydaní novej verzie sa nezasekne – nová verzia sa načíta až pri najbližšom prechode
  na inú stránku (rovno na cieľ), nie uprostred ťukania. Keď stará stránka žiada súbor, ktorý po vydaní na
  serveri už nie je, cieľ sa načíta celý znova namiesto toho, aby sa nič nestalo.

## 1.3.1 – 2026-10-07

### Opravy

- Recept s dlhým názvom (napr. z recepty.aktuality.sk) sa dá uložiť – kontrola adresy receptu už nepoužíva
  LIKE, ktorý D1 obmedzuje na 50 bajtov.

## 1.3.0 – 2026-10-07

### Nové

- Nákup: kúpené položky sa dajú dole v košíku presunúť do špajze (označia sa ako doma aj s kúpeným množstvom,
  ktoré sa pripočíta k zásobe) alebo len vymazať.
- Recepty na počítači: filtre v jednom riadku; Detské recepty a Recepty od iných sú v paneli Filtre a zapnuté sa
  ukážu ako čipy.

### Opravy

- Špajza: zaškrtnutie prepočíta len jeden riadok a po uložení sa nič znova nesťahuje (na mobile rýchlejšie).

## 1.2.1 – 2026-10-07

### Opravy

- Špajza: zaškrtnutie „mám doma“ je okamžité aj pri rýchlom zaškrtávaní viacerých vecí (načítanie zo servera
  ho už neprepíše).
- Režim varenia: text krokov je zarovnaný vľavo.

## 1.2.0 – 2026-10-07

### Nové

- Ingrediencie: filter podľa kategórie obchodu (napr. len mäso) s počtom ingrediencií pri každej kategórii
  a voľbou Bez kategórie; na mobile v spodnom paneli Filtre ako v Špajzi.

## 1.1.0 – 2026-10-07

### Nové

- Kto sa prihlási cez Cloudflare Access a ešte nie je v žiadnej domácnosti, si založí vlastnú a je jej vlastníkom
  (alebo počká na pozvánku – vidí, ktorým e-mailom je prihlásený).
- Aplikácia sa po vydaní novej verzie aktualizuje sama: novú verziu hľadá pri spustení a pri každom návrate do
  nej, nainštaluje ju a znova sa načíta.
- Adresy sú po anglicky (`/recipes?pantry=1&missing=1`); staré slovenské adresy a záložky sa presmerujú.
- Hustota rozhrania: na mobile vždy kompaktná, na počítači voľba v Nastaveniach (kompaktná, pohodlná,
  priestranná); tlačidlá v riadku s poľami majú rovnakú výšku ako polia.
- Mobil (do 1200 px): filtre Receptov a Špajze v paneli, akcie v hlavičke ako ikonky, tabuľka receptov ako
  kompaktný zoznam, kratšie „Čo uvariť dnes“.
- Rozbalenie sekcie V košíku a karty Čo uvariť dnes si pamätajú nastavenia človeka.
- Skupiny ingrediencií (Korpus, Náplň…) pri zadávaní aj pri importe; import z aktuality.sk, dobruchut,
  kuchynalidla.sk a najrecept.topky.sk.
- Verejné recepty iných domácností v zozname receptov (filter Recepty od iných).
- Špajza: filter podľa kategórie, pridanie a úprava suroviny (názov, kategória, jednotka).
- Editor receptu: zaškrtávacie pole Detský recept.
- Nastavenia: pridávanie receptov z internetu jedným klikom (záložka a rozšírenie do Chromu).
- Pruh načítania pod hornou lištou pri prechode na stránku a načítavaní dát.

### Opravy

- PWA sa dá nainštalovať aj za Cloudflare Access (manifest sa sťahuje s prihlásením).
- Stiahnutý recept v Markdowne má správnu diakritiku aj na Androide (značka UTF-8).
- Tlač receptu je kompaktná, otvorené menu ani hlášky sa netlačia.
- Ingrediencie sa pri otvorení neseknú (vykresľujú sa po dávkach).
- Stĺpec množstva v recepte sa rozšíri pre dlhé jednotky („0,5 balenie“), suroviny bez množstva sú zarovnané.
- Bez vodorovných posuvníkov v paneloch filtrov a nástrojov.

### Licencia

- PolyForm Noncommercial 1.0.0 namiesto MIT: nekomerčné použitie je voľné, komerčné len s písomným súhlasom.
