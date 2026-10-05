# Fáza 1 – Recepty: implementačný plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recepty so štruktúrovanými ingredienciami, krokmi, tagmi, fotkou, obľúbenými, vyhľadávaním a katalógom ingrediencií s kategóriou obchodu.

**Architecture:** Nové Hono routy pod `/api/v1` (recipes, ingredients, tags, shop-categories, images) a `/img/*` pre fotky z R2, oboje za tým istým auth middleware. Vstupy validuje zod schéma v `shared/schemas`, ktorú používa aj frontend. Frontend: zoznam, detail a editor receptu, katalóg ingrediencií.

**Tech Stack:** ako fáza 0.

**Spec:** [docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md](../specs/2026-10-05-kucharska-kniha-design.md) – fáza 1, 2.4, 2.5, 2.7, 2.9.

## Global Constraints

- Všetko z fázy 0 (hranice src/worker/shared, chyby `HttpError`, filter `householdId`, slovenčina, `tw:` prefix).
- D1: max 100 viazaných parametrov na príkaz → viac riadkov sa vkladá po jednom príkaze v `db.batch`.
- Fotky: klient zmenší na max 1600 px a WebP (kvalita 0,82); server prijme len `image/webp|jpeg|png` do 5 MB.
- Vyhľadávanie ignoruje diakritiku a veľkosť písmen (`normalizeText`).

## Rozhodnutia nad rámec spec

- **Validácia formulárov:** Vuetify `rules` pre okamžitú spätnú väzbu + zod `safeParse` pred odoslaním (O3 zo spec). Bez vee-validate.
- **Migrácia 0001:** `recipes.title_normalized`, unikát `(household_id, slug)` pre recepty, unikát `(household_id, name_normalized)` pre ingrediencie (nahrádza index), unikát `(recipe_id, position)` pre kroky (odložené pripomienky z recenzie fázy 0).
- **Ingrediencie v recepte** sa posielajú menom; server nájde existujúcu (aj zmazanú – obnoví ju) alebo založí novú. Prvá použitá jednotka sa stane predvolenou.
- **Tagy** sa posielajú menom, chýbajúce sa založia.
- **Úprava receptu** = úplná náhrada ingrediencií, krokov a tagov v jednom `db.batch`.
- **Mazanie receptu** je mäkké (`deleted_at`), obľúbené a väzby ostávajú kvôli prípadnému obnoveniu.
- **JSON import** (spomenutý vo fáze 0) sa presúva do fázy 4 s importom z URL: potrebuje mapovanie konfliktov mien kategórií a tagov a fotky nie sú v exporte.

## Review Focus

1. **Recept s 30+ ingredienciami** sa uloží (D1 limit parametrov). Test v Task 3.
2. **„gulas“ nájde „Guláš“ a „cibula“ nájde recept s cibuľou.** Test v Task 3.
3. **Cudzia domácnosť** nevidí, neupraví ani nenačíta fotku/recept inej domácnosti (404). Test v Task 3 a 4.
4. **Dva recepty s rovnakým názvom** dostanú rôzne slugy. Test v Task 3.
5. **Fotka iného typu alebo príliš veľká** → 400/413, nič sa neuloží do R2. Test v Task 4.

---

### Task 1: Zdieľané – text, kategórie, schémy

**Files:** `shared/text.ts`, `shared/recipes.ts`, `shared/schemas/recipe.ts`, `shared/api.ts` (rozšírenie); Test: `tests/unit/text.test.ts`, `tests/unit/recipe-schema.test.ts`

**Produces:**
- `normalizeText(s: string): string` – NFD, bez diakritiky, lowercase, zlúčené medzery, trim.
- `slugify(s: string): string` – normalizeText, nealfanumerické → `-`, max 80 znakov, prázdne → `recept`.
- `RECIPE_CATEGORIES` (presun zo schémy), `RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string>`, `DIFFICULTY_LABELS`.
- `recipeInputSchema` (zod): title 1–200, description ≤ 5000, category, servings 1–50 int, prepMinutes/cookMinutes 0–1440 int nullable, difficulty 1–3, sourceUrl URL nullable, sourceText ≤ 500, coverImageId nullable, ingredients ≤ 100 `{ name 1–120, quantity >0 nullable, unit UnitCode nullable, note ≤ 200 nullable, groupName ≤ 80 nullable, isOptional }`, steps ≤ 100 `{ text 1–5000, timerSeconds 1–86400 nullable }`, tags ≤ 30 mien 1–40 (deduplikované bez ohľadu na veľkosť písmen). `type RecipeInput`.
- DTO: `RecipeSummaryDto`, `RecipeDetailDto`, `RecipeIngredientDto`, `RecipeStepDto`, `IngredientDto`, `TagDto`, `ShopCategoryDto`, `ImageDto`.

### Task 2: Migrácia 0001

**Files:** `worker/db/schema.ts`, `worker/db/migrations/0001_*.sql`; Test: `tests/worker/schema.test.ts` (rozšírenie)

Test: druhý recept s rovnakým `(household_id, slug)` a druhá ingrediencia s rovnakým `(household_id, name_normalized)` zlyhá na UNIQUE.

### Task 3: API receptov, ingrediencií, tagov, kategórií

**Files:** `worker/services/recipes.ts`, `worker/routes/recipes.ts`, `worker/routes/ingredients.ts`, `worker/routes/tags.ts`, `worker/routes/shopCategories.ts`, `worker/app.ts`; Test: `tests/worker/recipes.test.ts`, `tests/worker/ingredients.test.ts`

Endpointy: `GET/POST /recipes`, `GET/PUT/DELETE /recipes/:id`, `PUT/DELETE /recipes/:id/favorite`, `GET/POST /ingredients`, `PUT /ingredients/:id`, `GET /tags`, `GET /shop-categories`.

Testy: vytvorenie s ingredienciami/krokmi/tagmi a detail; auto-založenie a znovupoužitie ingrediencie (aj z inej veľkosti písmen); 35 ingrediencií; úprava nahradí zoznamy; mäkké zmazanie zmizne zo zoznamu a detail je 404; vyhľadávanie podľa názvu bez diakritiky a podľa ingrediencie; filter kategória, tag, obľúbené; obľúbené sú na používateľa; slug unikátny; 400 pri neplatnom vstupe s `issues`; 404 pre recept inej domácnosti; ingrediencia: zmena kategórie obchodu a predvolenej jednotky, kategória inej domácnosti → 400.

### Task 4: Fotky (R2)

**Files:** `worker/routes/images.ts`, `worker/app.ts` (root app bez basePath, `/api/v1` + `/img`); Test: `tests/worker/images.test.ts`

`POST /api/v1/images` (multipart `file`) → `ImageDto { id, url }`; `GET /img/:householdId/:file` → obsah z R2, `Cache-Control: private, max-age=31536000, immutable`. Testy: upload a stiahnutie; zlý typ 400; > 5 MB 413; fotka cudzej domácnosti 404; recept s `coverImageId` cudzej domácnosti 400.

### Task 5: Frontend – API vrstva a pomocné funkcie

**Files:** `src/api/recipes.ts`, `src/api/catalog.ts`, `src/lib/image.ts`, `src/features/recipes/form.ts`; Test: `tests/unit/image.test.ts`, `tests/unit/recipe-form.test.ts`

- `fitWithin(w, h, max): { width, height }` (zachová pomer, nikdy nezväčší) a `resizeImage(file): Promise<Blob>` (canvas → WebP).
- `emptyRecipeForm()`, `recipeToForm(detail)`, `formToInput(form): RecipeInput` – prázdne riadky ingrediencií a krokov sa vynechajú, čísla zo stringov, prázdne stringy → null.
- Query hooky: `useRecipes(filters)`, `useRecipe(id)`, `useSaveRecipe()`, `useDeleteRecipe()`, `useToggleFavorite()`, `useIngredients()`, `useUpdateIngredient()`, `useTags()`, `useShopCategories()`, `uploadImage(blob)`.

### Task 6: Frontend – zoznam a detail receptu

**Files:** `src/features/recipes/pages/RecipesPage.vue`, `RecipeDetailPage.vue`, `components/RecipeCard.vue`, `components/FavoriteButton.vue`, `src/router/index.ts`

Zoznam: vyhľadávanie (debounce 250 ms), čipy kategórií, filter tagu a obľúbených (stav v URL query), mriežka kariet, FAB „Nový recept“, prázdne stavy. Detail: fotka, meta (čas, porcie, náročnosť), ingrediencie podľa skupín s `formatQuantity`, očíslované kroky, tagy, zdroj, obľúbené, upraviť, zmazať s potvrdením.

### Task 7: Frontend – editor receptu

**Files:** `src/features/recipes/pages/RecipeEditPage.vue`, `components/IngredientRows.vue`, `components/StepRows.vue`, `components/ImagePicker.vue`

Formulár podľa `RecipeInput`; ingrediencie: množstvo, jednotka, názov (combobox z katalógu), poznámka, skupina, voliteľná; kroky s posunom hore/dole; tagy combobox; fotka (výber/kamera, náhľad, nahranie po zmenšení). Uloženie → detail. Neuložené zmeny → potvrdenie pri odchode.

### Task 8: Frontend – katalóg ingrediencií

**Files:** `src/features/ingredients/pages/IngredientsPage.vue`, `MorePage.vue`, router

Zoznam ingrediencií s vyhľadávaním, zmena kategórie obchodu a predvolenej jednotky priamo v riadku.

### Task 9: Overenie a dokumentácia

Prehliadač mobil + desktop: vytvoriť recept s fotkou, nájsť ho, upraviť, obľúbiť, zmazať. `npm run check`, build, aktualizácia spec (0a) a README.
