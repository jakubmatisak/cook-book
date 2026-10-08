/** Nastavenia: účet, vzhľad, domácnosť, jedálniček, špajza a export. */
export default {
  mine: 'Moje nastavenia',
  household: 'Domácnosť',
  ownerOnly: 'Nastavenia domácnosti môže meniť len vlastník.',
  changeFailed: 'Zmena sa neuložila.',
  account: {
    title: 'Účet',
    household: 'Domácnosť: {name} · {people} v rodine',
    loggedIn:
      'Prihlásený ako {email}. Odhlásením sa tento prehliadač zabudne a pri ďalšom otvorení sa treba prihlásiť znova.',
    logout: 'Odhlásiť sa',
  },
  appearance: {
    title: 'Vzhľad',
    aria: 'Svetlý alebo tmavý vzhľad',
    system: 'Podľa zariadenia',
    light: 'Svetlý',
    dark: 'Tmavý',
  },
  density: {
    title: 'Hustota rozhrania',
    aria: 'Veľkosť polí, tlačidiel, zoznamov a tabuliek',
    compact: 'Kompaktná',
    comfortable: 'Pohodlná',
    default: 'Priestranná',
    hint: 'Platí na počítači. Na mobile je rozhranie vždy kompaktné.',
  },
  plan: {
    title: 'Jedálniček',
    slots: 'Jedlá dňa',
    slotsHint: 'Vypnuté jedlá sa v pláne nezobrazujú, kým v nich nič nie je.',
    weekStart: 'Týždeň začína',
    weekdays: { monday: 'Pondelok', sunday: 'Nedeľa', saturday: 'Sobota' },
    childPortion: 'Predvolená porcia dieťaťa',
    factorTimesAdult: '{factor} × dospelý',
    childPortionHint: 'Použije sa pri pridaní nového dieťaťa v sekcii Pri stole.',
  },
  capture: {
    title: 'Pridať recept z internetu jedným klikom',
    bookmarkTitle: 'Záložka v prehliadači (najjednoduchšie)',
    bookmarkText:
      'Funguje v každom prehliadači, nič sa neinštaluje. Pretiahni tlačidlo nižšie na lištu záložiek. Keď si na stránke s receptom, klikni na túto záložku a recept sa načíta do Kuchárskej knihy.',
    bookmarkButton: 'Do kuchárskej knihy',
    bookmarkHint:
      'Tlačidlo nekliknite tu, len ho pretiahnite myšou na lištu záložiek (alebo naň kliknite pravým a zvoľte „Pridať záložku“).',
    extensionTitle: 'Rozšírenie do Chromu',
    extensionText: 'Ikonka v lište Chromu, ktorá recept z otvorenej stránky pridá jedným kliknutím.',
    extensionDownload: 'Stiahnuť rozšírenie (.zip)',
    step1: 'Rozbaľ stiahnutý súbor do priečinka.',
    step2: 'V Chrome otvor chrome://extensions a zapni „Režim pre vývojárov“.',
    step3: 'Klikni na „Načítať nezabalené“ a vyber rozbalený priečinok.',
    step4: 'V nastaveniach rozšírenia (otvoria sa samy) vlož túto adresu aplikácie:',
    copyAddress: 'Skopírovať adresu aplikácie',
    copied: 'Adresa je skopírovaná.',
    copyFailed: 'Adresu sa nepodarilo skopírovať.',
  },
  others: {
    title: 'Recepty od iných',
    label: 'Zobrazovať recepty od iných',
    hint: 'Verejné recepty iných domácností sa ukážu v receptoch a na úvode spolu s tvojimi. Vo filtri ich môžeš kedykoľvek skryť.',
  },
  kids: {
    title: 'Detské recepty',
    label: 'Zobrazovať detské recepty',
    hint: 'Kaše, přesnídavky a príkrmy. Po vypnutí sa detské recepty skryjú v celej aplikácii (zoznam, plánovanie, návrhy) a kategória Detské sa nebude ponúkať.',
  },
  pantry: {
    title: 'Špajza a recepty',
    ignoreSpices: 'Pri „Čo viem uvariť“ ignorovať koreniny',
    ignoreSpicesHint:
      'Koreniny sa nepočítajú ako chýbajúce, takže uvidíš aj recepty, ktoré viem uvariť bez nich.',
  },
  export: {
    title: 'Záloha a export',
    intro:
      'Záloha stiahne všetky recepty, jedálničky a zoznamy ako JSON súbor, odporúčame ju raz za mesiac. Recepty vieš stiahnuť aj ako čitateľný textový súbor (Markdown). Tlač do PDF nájdeš pri recepte, jedálničku a nákupe v menu Tlačiť, v okne tlače zvoľ Uložiť ako PDF.',
    exportData: 'Exportovať dáta',
    recipesMarkdown: 'Recepty ako Markdown',
    exported: 'Export stiahnutý.',
    recipesExported: 'Recepty stiahnuté.',
    failed: 'Export sa nepodaril.',
    recipesFailed: 'Export receptov sa nepodaril.',
  },
}
