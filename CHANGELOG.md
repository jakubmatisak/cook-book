# Zmeny

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
