import { describe, expect, it } from 'vitest'
import { suggestShopCategory } from '@shared/shopCategorySuggest'

const CATEGORIES = [
  'Zelenina',
  'Ovocie',
  'Mäso a ryby',
  'Mliečne a vajcia',
  'Pečivo',
  'Pečenie',
  'Konzervy a zaváraniny',
  'Trvanlivé',
  'Koreniny a dochucovadlá',
  'Mrazené',
  'Nápoje',
  'Drogéria',
  'Iné',
].map((name, i) => ({ id: `c${i}`, name }))
const nameOf = (id: string | null) => CATEGORIES.find((c) => c.id === id)?.name ?? null
const suggest = (ingredient: string, categories = CATEGORIES) =>
  nameOf(suggestShopCategory(ingredient, categories))

describe('návrh kategórie obchodu', () => {
  it.each([
    ['Plnotučná horčica', 'Koreniny a dochucovadlá'],
    ['Dijonská horčica', 'Koreniny a dochucovadlá'],
    ['Nakladané marhule', 'Konzervy a zaváraniny'],
    ['Kyslé uhorky', 'Konzervy a zaváraniny'],
    ['Broskyňový kompót', 'Konzervy a zaváraniny'],
    ['Slivkový lekvár', 'Konzervy a zaváraniny'],
    ['Paradajky krájané v konzerve', 'Konzervy a zaváraniny'],
    ['Uhorky', 'Zelenina'],
    ['Paradajka', 'Zelenina'],
    ['Červená cibuľa', 'Zelenina'],
    ['Hruška', 'Ovocie'],
    ['Mleté hovädzie mäso', 'Mäso a ryby'],
    ['Údený jazyk', 'Mäso a ryby'],
    ['Špekačky', 'Mäso a ryby'],
    ['Žĺtky', 'Mliečne a vajcia'],
    ['Smotana', 'Mliečne a vajcia'],
    ['Hermelín', 'Mliečne a vajcia'],
    ['Margarín', 'Mliečne a vajcia'],
    ['Rožok', 'Pečivo'],
    ['Kváskový chlieb', 'Pečivo'],
    ['Pohánková múka', 'Pečenie'],
    ['práškového cukru', 'Pečenie'],
    ['kypriaci prášok', 'Pečenie'],
    ['Vanilkový puding', 'Pečenie'],
    ['plátky želatína', 'Pečenie'],
    ['Slnečnicový olej', 'Trvanlivé'],
    ['Tagliatelle', 'Trvanlivé'],
    ['Mleté čierne korenie', 'Koreniny a dochucovadlá'],
    ['Jablčný ocot', 'Koreniny a dochucovadlá'],
    ['Kurací vývar', 'Koreniny a dochucovadlá'],
    ['Rum', 'Nápoje'],
    ['Víno biele', 'Nápoje'],
    ['Kuchynský špagát', 'Drogéria'],
    ['Mletá červená paprika', 'Koreniny a dochucovadlá'],
    ['Paprika sladká', 'Koreniny a dochucovadlá'],
    ['červenú papriku', 'Zelenina'],
    ['lúpaných krájaných paradajok Freshona', 'Konzervy a zaváraniny'],
    ['paradajkovej pasty', 'Konzervy a zaváraniny'],
    ['Kakaové keksy', 'Trvanlivé'],
    ['Kondenzované mlieko', 'Trvanlivé'],
    ['červených fazúľ Freshona', 'Trvanlivé'],
    ['Zelené fazuľky', 'Zelenina'],
  ])('%s → %s', (ingredient, category) => {
    expect(suggest(ingredient)).toBe(category)
  })

  it('bez istoty nenavrhne nič', () => {
    expect(suggest('Mochnáče')).toBeNull()
    expect(suggest('Plnka')).toBeNull()
  })

  it('bez kategórie Pečenie či Konzervy navrhne Trvanlivé', () => {
    const basic = CATEGORIES.filter((c) => c.name !== 'Pečenie' && c.name !== 'Konzervy a zaváraniny')
    expect(suggest('Pohánková múka', basic)).toBe('Trvanlivé')
    expect(suggest('Nakladané marhule', basic)).toBe('Trvanlivé')
  })

  it('premenovanú kategóriu domácnosti (iný názov) nenájde a nenavrhne', () => {
    const renamed = [{ id: 'x', name: 'Jarné veci' }]
    expect(suggestShopCategory('Uhorky', renamed)).toBeNull()
  })
})
