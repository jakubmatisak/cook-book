/** Nákupný zoznam: stránka, generovanie z jedálnička, úprava položky. */
export default {
  printView: { heading: 'Vytlačené {date}' },
  title: 'Nákupný zoznam',
  fromPlan: 'Z jedálnička',
  moreActions: 'Ďalšie akcie',
  print: 'Tlačiť nákup',
  clearChecked: 'Vymazať kúpené',
  subtitle: '{toBuy} na kúpenie · {inCart} v košíku',
  inCart: 'V košíku ({n})',
  allInCart: 'Všetko je v košíku.',
  categoryOther: 'Ostatné',
  confirmDelete: 'Naozaj zmazať',
  plural: { changes: '{n} zmena | {n} zmeny | {n} zmien' },
  offline: {
    queued: 'Čaká na odoslanie: {changes} z času bez signálu.',
    noSignal: 'Bez signálu. Odškrtávať môžeš ďalej, zmeny sa odošlú po pripojení.',
  },
  add: {
    label: 'Pridať položku, napr. 2 kg zemiaky',
    aria: 'Pridať položku',
  },
  empty: {
    title: 'Zoznam je prázdny',
    text: 'Vygeneruj ho z jedálnička alebo pridaj položky ručne.',
    generate: 'Vygenerovať z jedálnička',
  },
  item: {
    staple: 'Stála položka',
    editAria: 'Upraviť {name}',
  },
  generate: {
    title: 'Vygenerovať z jedálnička',
    text: 'Spočíta ingrediencie naplánovaných receptov podľa porcií vašej rodiny. Nekúpené položky z minulého generovania sa nahradia, kúpené a ručne pridané ostanú.',
    presets: {
      rest: 'Od dnes do konca týždňa',
      this: 'Celý tento týždeň',
      next: 'Budúci týždeň',
      custom: 'Vlastné dni',
    },
    from: 'Od',
    to: 'Do',
    submit: 'Vygenerovať',
    errors: {
      pickDates: 'Vyber dátum od aj do.',
      order: 'Dátum „do“ musí byť po dátume „od“.',
      tooLong: 'Najviac {days} naraz.',
      failed: 'Generovanie zlyhalo.',
    },
  },
  edit: {
    title: 'Upraviť položku',
    name: 'Názov',
    quantity: 'Množstvo',
    unit: 'Jednotka',
    category: 'Kategória v obchode',
    errors: {
      nameRequired: 'Zadaj názov.',
      quantityInvalid: 'Množstvo napr. 2 alebo 1,5.',
      saveFailed: 'Uloženie zlyhalo.',
      deleteFailed: 'Zmazanie zlyhalo.',
    },
  },
  snackbar: {
    addFailed: 'Položku sa nepodarilo pridať.',
    toggleFailed: 'Zmena sa neuložila.',
    cleared: 'Odstránené z košíka: {items}.',
  },
}
