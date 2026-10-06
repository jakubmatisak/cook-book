/** Verejné recepty: zoznam, detail, kópia do vlastnej domácnosti a zverejnenie receptu. */
export default {
  detail: {
    from: 'Zdieľa: {name}',
    copy: 'Pridať do mojich receptov',
    copied: 'Recept je v tvojich receptoch.',
    open: 'Otvoriť',
    alreadyMine: 'Toto je recept tvojej domácnosti.',
    openMine: 'Otvoriť môj recept',
    source: 'Zdroj receptu',
    notFound: {
      title: 'Recept sa nenašiel',
      text: 'Autor ho možno skryl alebo zmazal.',
      back: 'Späť na verejné recepty',
    },
  },
  visibility: {
    publish: 'Zverejniť recept',
    hide: 'Skryť pred ostatnými',
    publishTitle: 'Zverejniť recept?',
    publishText:
      'Verejný recept uvidia a môžu si ho skopírovať všetci prihlásení v aplikácii, aj z iných domácností. Zobrazí sa s názvom tvojej domácnosti.',
    hideTitle: 'Skryť recept?',
    hideText: 'Recept uvidí už len tvoja domácnosť. Kópie, ktoré si ostatní už urobili, im ostanú.',
    published: 'Recept je verejný.',
    hidden: 'Recept je súkromný.',
    chip: 'Verejný',
  },
}
