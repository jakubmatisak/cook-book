/** Základné recepty v Nastaveniach: balíky po kategóriách, pridanie a odstránenie. */
export default {
  title: 'Základné recepty',
  text: 'Typické slovenské recepty rozdelené do balíkov. Každý balík pridáš alebo odstrániš zvlášť; recepty si potom môžeš upraviť. Recepty, ktoré už máš, sa nezdvoja a tvoje vlastné recepty sa pri odstránení balíka nezmažú.',
  status: '{imported} z {total}',
  add: 'Pridať',
  adding: 'Pridávam… {done} z {of}',
  remove: 'Odstrániť',
  groups: {
    ranajky: 'Raňajky',
    desiata: 'Desiata',
    olovrant: 'Olovrant',
    vecera: 'Večera',
    polievky: 'Polievky',
    hlavne: 'Hlavné jedlá',
    salaty: 'Šaláty a prílohy',
    dezerty: 'Dezerty',
    kids: 'Detské (kaše a príkrmy do 18 mesiacov)',
  },
  removeDialog: {
    title: 'Odstrániť balík {group}?',
    text: 'Zmaže sa {recipes} z tohto balíka aj s ich jedlami v jedálničku. Tvoje vlastné recepty ostanú.',
    confirm: 'Odstrániť',
  },
  added: 'Pridané: {recipes}.',
  none: 'Všetky recepty z balíka už máš.',
  removed: 'Odstránené: {recipes}.',
}
