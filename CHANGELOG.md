# Zmeny

## 1.7.1 – 2026-10-09

### Opravy

- Zostaviť jedálniček: potvrdenie väčšieho návrhu (viac ako 7 jedál) skončilo chybou „Nastala neočakávaná chyba“.
  Jedlá sa teraz ukladajú po menších dávkach, aby sa zmestili do limitu databázy.
- Ťuknutie na obsadené políčko sa najprv opýta, či jedlo nahradiť; vyfarbenie celého dňa alebo jedla dňa obsadené
  políčka preskočí. Vyfarbené obsadené políčko ukáže „… · namiesto: pôvodné jedlo“ a pri potvrdení sa nahradí.
- Sprievodca je zarovnaný: karty jedál dňa majú rovnakú výšku, stĺpce mriežky rovnakú šírku, výber času začína pri
  každom dni na rovnakom mieste a karty v kontrole sú v riadku rovnako vysoké. Pri piatich jedlách dňa sa okno už
  nerozšíri za okraj obrazovky.
- „Iný návrh“ je neaktívny, keď pre políčko nie je žiadny ďalší recept.

## 1.7.0 – 2026-10-09

### Nové

- **Zostaviť jedálniček** – sprievodca v jedálničku v troch krokoch:
  - obdobie (najviac 14 dní), jedlá dňa s typmi jedla, k obedu aj polievka, tagy, varenie na viac dní (+1 až +3)
    a voľba nahradiť obsadené políčka;
  - mriežka dni × jedlá dňa, ktorú vymaľuješ štetcami Všetky, Overené, Nové, Obľúbené alebo Nevypĺňať (políčko,
    celý deň aj celé jedlo dňa) a čas na varenie po dňoch (Do 30 min / Do 60 min / Bez limitu, predvoľby
    „Pracovné dni do 30 min“ a „Víkend bez limitu“);
  - kontrola návrhu: iný návrh, vybrať recept, vymazať, zvyšky +0 až +3 dni, odznak „Už máme“ a upozornenia
    pre ľudí pri stole; Potvrdiť uloží všetko naraz.
  - Hlavné jedlá a polievky sa neopakujú, alergény ľudí pri stole (aj návštev s pobytom v ten deň) sa nenavrhnú
    nikdy, neobľúbené jedlá až nakoniec. Recept bez zadaného času limit spĺňa, ale ide až za receptami so
    známym časom.
- **Zvyšky** v jedálničku: varenie má porcie na viac dní, zvyšky majú odznak „Zvyšky“, do nákupu ani do
  „naposledy varené“ nevstupujú a zmažú sa spolu s varením.
- **Overené recepty:** prepínač v detaile a v editore, odznak na karte, filter „Overené“ a hromadná úprava.
  Príznak patrí domácnosti.
- **Neobľúbené jedlá** pri každom človeku v Pri stole: recept z kuchárky alebo voľný text; upozornia v jedálničku
  aj v sprievodcovi.
- Detail receptu na počítači má novú hlavičku na celú šírku s fotkou, údajmi (porcie, náročnosť, čas, naposledy
  varené, zdroj) a tlačidlami Režim varenia a Naplánovať. Mobil ostáva bez zmeny.
- Zoznam receptov: na mobile je prepínač mriežka/tabuľka priamo vedľa hľadania, na počítači sú ovládače vpravo.

## 1.6.0 – 2026-10-08

### Nové

- Poznámky pri každom recepte: voľný text (odhady, pôvodný zápis, tipy) v editore, v detaile, na zdieľanom
  odkaze aj v exporte do Markdownu.
- Prílohy receptu: v editore sa nahrá viac fotiek naraz (zmenšené na 1600 px), dajú sa preusporiadať a odobrať.
  V detaile sú galériou náhľadov nad poznámkami; klik otvorí fotku na celú obrazovku s listovaním. Zdieľaný
  odkaz a iné domácnosti prílohy nevidia. Fotky odobratej prílohy aj zmazaného receptu sa zmažú z úložiska.
- Nastavenie „Zobrazovať recepty od iných“: verejné recepty iných domácností sa ukážu v receptoch a na úvode bez
  ďalšieho filtra; filter „Len moje“ ich skryje. Výber receptu do jedálnička ponúka naďalej len vlastné recepty.
- Zdroj receptu je v detaile aj na zdieľanom odkaze úplne dole, pod postupom, prílohami a poznámkami.

### Opravy

- Nákupný zoznam sa už sám od seba neobnovuje každých 5 sekúnd (zbytočné dotazy na server). Zoznam sa načíta
  pri otvorení, po návrate do aplikácie a po pripojení. Iné pravidelné dotazy aplikácia nerobí.

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
