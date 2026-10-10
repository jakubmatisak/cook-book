import { normalizeText } from './text'

/**
 * Návrh kategórie obchodu podľa názvu ingrediencie (bez diakritiky). Pravidlá idú od konkrétnych k všeobecným:
 * „Kyslé mlieko“ je mliečne, „Kyslé uhorky“ konzervy, „Uhorky“ zelenina; „Mleté mäso“ je mäso, „Mletá paprika“
 * korenie. Kategória sa hľadá podľa názvu (predvolené názvy); keď domácnosť nemá Pečenie či Konzervy, použije sa
 * Trvanlivé. Bez istoty sa nenavrhne nič.
 */
interface Rule {
  pattern: RegExp
  categories: readonly string[]
}

const RULES: readonly Rule[] = [
  { pattern: /\b(vyvar|bujon)/, categories: ['Koreniny a dochucovadlá'] },
  // Pred mliečnymi a pečením: kondenzované mlieko, keksy (aj kakaové) a orieškový krém sú trvanlivé.
  { pattern: /\b(kondenzov|keks|susienk|nutell)|\bkrem\b.*oriesk/, categories: ['Trvanlivé'] },
  {
    pattern:
      /\b(mliek|mlieko|smotan|syr|jogurt|tvaroh|masl|margarin|hera\b|vajc|vajic|zltk|bielk|hermelin|gouda|cedar|cheddar|camembert|mozzarel|parmez|eidam|bryndz|kefir|zakys|pomazank)/,
    categories: ['Mliečne a vajcia'],
  },
  {
    pattern:
      /\b(nakladan|steriliz|kompot|lekvar|dzem|konzerv|zavar|pretlak|pasirovan|pyre|kapar|sardel|tuniak|pastet|olivy|lupan|past[ay]\b)|\bkysl\w*\s+(uhor|kapust)/,
    categories: ['Konzervy a zaváraniny', 'Trvanlivé'],
  },
  { pattern: /\bmrazen/, categories: ['Mrazené'] },
  {
    pattern:
      /\b(mas[oa]\b|maso|hovadz|bravc|telac|kralic|sliepk|kacic|moriak|rumpsteak|steak|sunk|salam|klobas|spekac|park[yu]\b|slanin|tlacenk|jazyk|skvark|drobk|kare\b|ryb[ay]?\b|losos|treska|pstruh|kapor)/,
    categories: ['Mäso a ryby'],
  },
  {
    pattern:
      /\b(korenie|korenia|horcic|kecup|chren|ocot|octu|sriracha|omack|sojov|barbecue|bbq|kmin|rasc|oregan|bazalk|tymian|majoran|rozmarin|salvi|muskat|kurkum|chilli\b|cili vlock|sol\b|soli\b)|\b(mlet|sladk|uden|stiplav)\w*\s+(\w+\s+)?paprik|\bpaprik\w*\s+(sladk|mlet|uden|stiplav)/,
    categories: ['Koreniny a dochucovadlá'],
  },
  {
    pattern:
      /\b(muk[ayu]\b|muka|cukr|cukor|prasok do pec|kypriac|sod[ay] bikarb|amoni|skrob|puding|polev|zelatin|farbiv|esenci|kandizov|oblatk|piskot|cesto|kosick|drozdi|kakao|cokolad|kokos|mak\b|orech|oriesk|mandl)/,
    categories: ['Pečenie', 'Trvanlivé'],
  },
  {
    pattern: /\b(chlieb|chleba|rozok|rozk|zeml|baget|vianock|toast|tortil|pernik|pecivo|kroasan|croissant)/,
    categories: ['Pečivo'],
  },
  { pattern: /\b(rum|vino|vina|pivo|lieh|vodka|slivovic|borovick|dzus)\b/, categories: ['Nápoje'] },
  { pattern: /\b(spagat|alobal|folia|sacok|vreck)/, categories: ['Drogéria'] },
  {
    pattern:
      /\b(olej|mast\b|tuk\b|ryz|cestovin|spaget|tagliatel|makaron|rezanc|penne|fusill|lasagn|krup|psen|raz\b|krupic|vlock|musli|kondenzov|susen|keks|susienk|sirup|med\b|sosovic|cicer|fazul(?!k))/,
    categories: ['Trvanlivé'],
  },
  {
    pattern:
      /\b(paradaj|rajcin|uhork|cibul|cesnak|salot|mrkv|petrzl|zeler|zemiak|kapust|kalerab|brokolic|karfiol|spenat|salat|redkov|tekvic|cukin|baklazan|paprik|feferon|cili papric|hub[yu]?\b|sampin|bylink|porr|kopr|pazitk|vnat|zazvor|korenov\w* zelenin|kukuric|hrasok|fazulk|listy)/,
    categories: ['Zelenina'],
  },
  {
    pattern:
      /\b(ovocie|jablk|hrusk|banan|pomaranc|citron|limet|jahod|malin|cucoriedk|ceresn|visn|slivk|marhul|broskyn|hrozn|kiwi|ananas|mango|sipk|ribezl|egres|melon|avokad)/,
    categories: ['Ovocie'],
  },
]

/** ID navrhnutej kategórie domácnosti, alebo null (bez istoty či bez zodpovedajúcej kategórie). */
export function suggestShopCategory(
  ingredientName: string,
  categories: readonly { id: string; name: string }[],
): string | null {
  const name = normalizeText(ingredientName).replace(/[^a-z0-9 ]/g, ' ')
  const byName = new Map(categories.map((c) => [normalizeText(c.name), c.id]))
  const rule = RULES.find((r) => r.pattern.test(name))
  if (!rule) return null
  for (const category of rule.categories) {
    const id = byName.get(normalizeText(category))
    if (id) return id
  }
  return null
}
