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
  plan: {
    title: 'Jedálniček',
    slots: 'Jedlá dňa',
    slotsHint: 'Vypnuté jedlá sa v pláne nezobrazujú, kým v nich nič nie je.',
    weekStart: 'Týždeň začína',
    weekdays: { monday: 'Pondelok', sunday: 'Nedeľa', saturday: 'Sobota' },
    childPortion: 'Predvolená porcia dieťaťa',
    factorTimesAdult: '{factor} × dospelý',
    childPortionHint: 'Použije sa pri pridaní nového dieťaťa v Rodine.',
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
