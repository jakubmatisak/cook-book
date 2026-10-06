import type { RecipeInputRaw } from '../schemas/recipe'

/**
 * Detské recepty (kategória Detské, do 18 mesiacov): kaše, přesnídavky a príkrmy bez soli, cukru a medu.
 * Veky sú orientačné, pri zavádzaní príkrmov rozhoduje pediater. Sú to údaje (po slovensky), nie texty aplikácie.
 */
type Ing = NonNullable<RecipeInputRaw['ingredients']>[number]
type Step = NonNullable<RecipeInputRaw['steps']>[number]

const i = (
  name: string,
  quantity: number | null,
  unit: Ing['unit'] = null,
  extra: Partial<Ing> = {},
): Ing => ({ name, quantity, unit, ...extra })
const s = (text: string, timerMinutes?: number): Step =>
  timerMinutes ? { text, timerSeconds: timerMinutes * 60 } : { text }

const TAG = 'Do 18 mesiacov'
const NOTE = ' Bez soli, cukru a medu. Vek je orientačný, zavádzanie nových potravín konzultuj s pediatrom.'

const baby = (
  title: string,
  age: string,
  text: string,
  extra: Pick<RecipeInputRaw, 'prepMinutes' | 'cookMinutes' | 'ingredients' | 'steps'>,
): RecipeInputRaw => ({
  category: 'detske',
  servings: 2,
  difficulty: 1,
  tags: [TAG],
  title,
  description: `${age}. ${text}${NOTE}`,
  ...extra,
})

export const BABY_RECIPES: readonly RecipeInputRaw[] = [
  // Kaše
  baby('Ryžová kaša nemliečna', 'Od 6. mesiaca', 'Jemná kaša z ryžovej múky, prvá kaša pre bábätko.', {
    prepMinutes: 2,
    cookMinutes: 5,
    ingredients: [i('Ryžová múka', 3, 'PL')],
    steps: [
      s('Vodu priveď do varu.'),
      s('Zasyp ryžovú múku, za stáleho miešania povar.', 3),
      s('Nechaj vychladnúť na jedlú teplotu.'),
    ],
  }),
  baby('Ovsená kaša nemliečna s jablkom', 'Od 6.–7. mesiaca', 'Jemné ovsené vločky uvarené s jablkom.', {
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [i('Jemné ovsené vločky', 3, 'PL'), i('Jablko', 0.5, 'ks')],
    steps: [
      s('Jablko olúpaj a nastrúhaj.'),
      s('Vodu priveď do varu, pridaj vločky a jablko.'),
      s('Povar a rozmixuj do hladka.', 7),
    ],
  }),
  baby('Kukuričná kaša nemliečna', 'Od 7. mesiaca', 'Kukuričná krupica uvarená vo vode.', {
    prepMinutes: 2,
    cookMinutes: 8,
    ingredients: [i('Kukuričná krupica', 3, 'PL')],
    steps: [
      s('Vodu priveď do varu.'),
      s('Zasyp krupicu a za stáleho miešania povar.', 6),
      s('Nechaj vychladnúť.'),
    ],
  }),
  baby('Pohánková kaša', 'Od 8. mesiaca', 'Pohánková múka alebo mletá pohánka uvarená do hladka.', {
    prepMinutes: 2,
    cookMinutes: 8,
    ingredients: [i('Pohánková múka', 3, 'PL')],
    steps: [
      s('Vodu priveď do varu.'),
      s('Zasyp múku a za stáleho miešania povar.', 6),
      s('Nechaj vychladnúť na jedlú teplotu.'),
    ],
  }),
  baby('Krupicová kaša mliečna', 'Od 8.–9. mesiaca', 'Klasická jemná krupicová kaša na mlieku.', {
    prepMinutes: 2,
    cookMinutes: 8,
    ingredients: [i('Detská krupica', 3, 'PL'), i('Mlieko', 200, 'ml')],
    steps: [
      s('Mlieko zohrej do varu.'),
      s('Zasyp krupicu a za stáleho miešania povar.', 5),
      s('Nechaj trochu vychladnúť.'),
    ],
  }),
  baby('Ovsená kaša mliečna s banánom', 'Od 9. mesiaca', 'Ovsené vločky na mlieku s roztlačeným banánom.', {
    prepMinutes: 5,
    cookMinutes: 8,
    ingredients: [i('Jemné ovsené vločky', 3, 'PL'), i('Mlieko', 200, 'ml'), i('Banán', 0.5, 'ks')],
    steps: [
      s('Mlieko zohrej a povar v ňom vločky.', 6),
      s('Banán roztlač vidličkou a vmiešaj do kaše.'),
      s('Nechaj vychladnúť.'),
    ],
  }),
  baby('Ryžová kaša mliečna s hruškou', 'Od 9. mesiaca', 'Ryžová kaša na mlieku s jemne uvarenou hruškou.', {
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [i('Ryžová múka', 3, 'PL'), i('Mlieko', 200, 'ml'), i('Hruška', 0.5, 'ks')],
    steps: [
      s('Hrušku olúpaj a nastrúhaj.'),
      s('Mlieko zohrej, zasyp múku a hrušku, za miešania povar.', 7),
      s('Nechaj vychladnúť.'),
    ],
  }),
  baby('Pšeno s ovocím', 'Od 9. mesiaca', 'Uvarené pšeno rozmixované s mäkkým ovocím.', {
    prepMinutes: 5,
    cookMinutes: 20,
    ingredients: [i('Pšeno', 3, 'PL'), i('Jablko', 0.5, 'ks')],
    steps: [
      s('Pšeno prepláchni horúcou vodou.'),
      s('Varíš s vodou a nakrájaným jablkom do mäkka.', 18),
      s('Rozmixuj do požadovanej hustoty.'),
    ],
  }),

  // Přesnídavky
  baby('Jablková přesnídavka', 'Od 5.–6. mesiaca', 'Najjednoduchšie ovocné pyré z uvareného jablka.', {
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [i('Jablko', 1, 'ks')],
    steps: [
      s('Jablko olúpaj, zbav jadierok a nakrájaj.'),
      s('Dusíš v troche vody do mäkka.', 8),
      s('Rozmixuj do hladka.'),
    ],
  }),
  baby('Hruškovo-banánová přesnídavka', 'Od 6.–7. mesiaca', 'Sladké pyré z hrušky a banánu.', {
    prepMinutes: 5,
    ingredients: [i('Hruška', 1, 'ks'), i('Banán', 0.5, 'ks')],
    steps: [s('Hrušku olúpaj a rýchlo uduš do mäkka.', 5), s('Pridaj banán a rozmixuj do hladka.')],
  }),
  baby('Marhuľová přesnídavka', 'Od 7. mesiaca', 'Pyré z marhúľ alebo broskýň.', {
    prepMinutes: 5,
    cookMinutes: 5,
    ingredients: [i('Marhule', 3, 'ks')],
    steps: [s('Marhule olúpaj a vykôstkuj.'), s('Krátko uduš v troche vody.', 4), s('Rozmixuj do hladka.')],
  }),
  baby('Jablko s ovsenými vločkami', 'Od 7. mesiaca', 'Přesnídavka z jablka zahustená ovsenými vločkami.', {
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [i('Jablko', 1, 'ks'), i('Jemné ovsené vločky', 1, 'PL')],
    steps: [s('Jablko olúpaj, nakrájaj a uduš do mäkka.', 8), s('Pridaj vločky, rozmixuj do hladka.')],
  }),

  // Zeleninové
  baby('Mrkvové pyré', 'Od 5.–6. mesiaca', 'Prvý zeleninový príkrm.', {
    prepMinutes: 5,
    cookMinutes: 20,
    ingredients: [i('Mrkva', 2, 'ks')],
    steps: [
      s('Mrkvu olúpaj a nakrájaj na kolieska.'),
      s('Uvar do mäkka v troche vody.', 18),
      s('Rozmixuj do hladka, riedi vodou z varenia.'),
    ],
  }),
  baby('Tekvicové pyré z Hokkaida', 'Od 6. mesiaca', 'Jemné pyré z tekvice Hokkaido.', {
    prepMinutes: 5,
    cookMinutes: 15,
    ingredients: [i('Tekvica Hokkaido', 200, 'g')],
    steps: [
      s('Tekvicu nakrájaj na kocky (kôra sa nemusí lúpať).'),
      s('Uvar do mäkka.', 12),
      s('Rozmixuj do hladka.'),
    ],
  }),
  baby('Cuketa s ryžou', 'Od 7. mesiaca', 'Jemný zeleninový príkrm s ryžou.', {
    prepMinutes: 5,
    cookMinutes: 20,
    ingredients: [i('Cuketa', 0.5, 'ks'), i('Ryža', 2, 'PL')],
    steps: [
      s('Ryžu povar so zeleninou v malom množstve vody.', 18),
      s('Cuketu olúpaj a nakrájaj, pridaj k ryži na posledných 8 minút.'),
      s('Rozmixuj do požadovanej hustoty.'),
    ],
  }),
  baby('Zemiaky s mrkvou', 'Od 6.–7. mesiaca', 'Základný zeleninový príkrm zo zemiakov a mrkvy.', {
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [i('Zemiaky', 1, 'ks'), i('Mrkva', 1, 'ks')],
    steps: [
      s('Zeleninu olúpaj a nakrájaj.'),
      s('Uvar do mäkka.', 18),
      s('Rozmixuj alebo roztlač podľa veku.'),
    ],
  }),

  // Mäsové a plnohodnotné
  baby('Mrkva s králičím mäsom', 'Od 7. mesiaca', 'Príkrm s chudým, ľahko stráviteľným mäsom.', {
    prepMinutes: 10,
    cookMinutes: 30,
    ingredients: [i('Mrkva', 1, 'ks'), i('Králičie mäso', 30, 'g'), i('Zemiaky', 0.5, 'ks')],
    steps: [
      s('Mäso uvar v troche vody do mäkka.', 25),
      s('Pridaj nakrájanú zeleninu a dovar.', 12),
      s('Všetko rozmixuj do hladka.'),
    ],
  }),
  baby('Brokolica so zemiakmi a kuracím mäsom', 'Od 8. mesiaca', 'Príkrm s brokolicou a kuracími prsiami.', {
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [i('Brokolica', 60, 'g'), i('Zemiaky', 1, 'ks'), i('Kuracie prsia', 30, 'g')],
    steps: [
      s('Mäso a zemiaky uvar v malom množstve vody.', 18),
      s('Pridaj brokolicu a dovar.', 7),
      s('Rozmixuj do požadovanej hustoty.'),
    ],
  }),
  baby('Zeleninová polievka bez soli', 'Od 9. mesiaca', 'Zeleninový vývar so zeleninou a drobnou rezancou.', {
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [
      i('Mrkva', 1, 'ks'),
      i('Petržlen', 0.5, 'ks'),
      i('Zemiaky', 1, 'ks'),
      i('Detské rezance', 1, 'PL'),
    ],
    steps: [
      s('Zeleninu olúpaj a nakrájaj nadrobno.'),
      s('Uvar v 400 ml vody do mäkka.', 20),
      s('Pridaj rezance a dovar.', 4),
    ],
  }),
  baby(
    'Cestoviny so zeleninovou omáčkou',
    'Od 10.–12. mesiaca',
    'Malé cestoviny s jemnou zeleninovou omáčkou.',
    {
      prepMinutes: 10,
      cookMinutes: 20,
      ingredients: [
        i('Cestoviny', 30, 'g'),
        i('Mrkva', 0.5, 'ks'),
        i('Cuketa', 0.5, 'ks'),
        i('Paradajky', 1, 'ks'),
      ],
      steps: [
        s('Cestoviny uvar do mäkka bez soli.', 10),
        s('Zeleninu nadrobno nakrájaj a uduš.', 12),
        s('Zmixuj omáčku a zmiešaj s cestovinami.'),
      ],
    },
  ),
  baby(
    'Zemiaková kaša s mrkvou a žĺtkom',
    'Od 9.–10. mesiaca',
    'Zemiaková kaša s mrkvou a uvareným žĺtkom.',
    {
      prepMinutes: 10,
      cookMinutes: 25,
      ingredients: [i('Zemiaky', 1, 'ks'), i('Mrkva', 1, 'ks'), i('Vajce', 1, 'ks'), i('Olej', 1, 'ČL')],
      steps: [
        s('Vajce uvar natvrdo, použi len žĺtok.', 10),
        s('Zemiaky a mrkvu uvar do mäkka a roztlač.', 18),
        s('Vmiešaj žĺtok a lyžičku oleja.'),
      ],
    },
  ),

  // Od 12. mesiaca
  baby(
    'Banánové mini lievance bez cukru',
    'Od 12. mesiaca',
    'Malé lievance z banánu a vajca, bez pridaného cukru.',
    {
      prepMinutes: 5,
      cookMinutes: 10,
      ingredients: [i('Banán', 1, 'ks'), i('Vajce', 1, 'ks'), i('Ovsená múka', 3, 'PL')],
      steps: [
        s('Banán roztlač a vymiešaj s vajcom a múkou.'),
        s('Na miernom ohni smaž malé lievance z oboch strán.', 6),
      ],
    },
  ),
  baby('Mäsovo-zeleninové guľky', 'Od 12. mesiaca', 'Malé guľky z mletého mäsa a zeleniny, pečené v rúre.', {
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients: [
      i('Mleté kuracie mäso', 100, 'g'),
      i('Mrkva', 0.5, 'ks'),
      i('Vajce', 1, 'ks'),
      i('Strúhanka', 1, 'PL'),
    ],
    steps: [
      s('Mäso zmiešaj s nastrúhanou mrkvou, vajcom a strúhankou.'),
      s('Vytvaruj malé guľky.'),
      s('Peč v rúre pri 180 °C.', 20),
    ],
  }),
]
