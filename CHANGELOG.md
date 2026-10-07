# Zmeny

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
