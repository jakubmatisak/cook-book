# Fáza 2 – Rodina a týždenný jedálniček: implementačný plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Členovia rodiny s koeficientom porcie, nastaviteľné jedlá dňa a týždenný plán (recept alebo voľný text v slote), s presunom a kopírovaním jedál aj celého týždňa.

**Architecture:** Nové routy `/api/v1/members`, `/slots/:id`, `/settings`, `/plan`. Dátumy sú ISO reťazce `YYYY-MM-DD` a počíta sa s nimi v UTC (žiadne časové pásma). Porcie záznamu počíta čistá funkcia v `shared/portions.ts`, ktorú použije aj fáza 3. Frontend: stránka Rodina, nastavenia jedál dňa a týždňa, stránka Plán (mriežka na desktope, zoznam dní na mobile).

**Spec:** [docs/superpowers/specs/2026-10-05-kucharska-kniha-design.md](../specs/2026-10-05-kucharska-kniha-design.md) – fáza 2, 2.4 (Jedálniček), 2.5 (plan, family).

## Predvolené rozhodnutia (používateľ neodpovedal, dajú sa zmeniť v aplikácii)

- Deti majú menšiu porciu toho istého jedla; samostatné jedlo pre deti v slote je fáza 4 (`audience` ostáva `all`).
- Predvolený koeficient dieťaťa 0,5 (nastavenie domácnosti), dospelý 1.
- Všetkých 5 jedál dňa zapnutých; týždeň začína pondelkom.
- Používateľské účty sa s členmi rodiny neprepájajú.

## Global Constraints

- Všetko z fáz 0 a 1.
- Dátum = `YYYY-MM-DD`; rozsah `GET /plan` najviac 62 dní; kopírovanie najviac 14 dní.
- Záznam plánu má recept **alebo** voľný text (aspoň jedno).
- Recept a slot záznamu musia patriť domácnosti; nový záznam nesmie odkazovať na zmazaný recept.
- Porcie záznamu: `servingsOverride` ak je zadané, inak súčet `portionFactor` aktívnych členov; bez členov `null` (UI ukáže porcie receptu).

## Review Focus

1. **Týždeň cez prelom mesiaca, roka a zmenu času** (napr. 27. 10. 2026) má 7 po sebe idúcich dátumov. Test v Task 1.
2. **Začiatok týždňa nedeľa** posunie mriežku aj kopírovanie týždňa správne. Test v Task 1 a 3.
3. **Kopírovanie týždňa dvakrát** bez „nahradiť“ jedlá zdvojí, s „nahradiť“ nie. Test v Task 3.
4. **Recept zmazaný po naplánovaní** sa v pláne stále zobrazí s označením. Test v Task 3.
5. **Vypnutý slot s naplánovaným jedlom** nezmizne z plánu. Riešené v UI Task 6, overené v prehliadači.

---

### Task 1: Zdieľané – dátumy, porcie, schémy

**Files:** `shared/dates.ts`, `shared/portions.ts`, `shared/schemas/family.ts`, `shared/schemas/plan.ts`, `shared/api.ts`; Test: `tests/unit/dates.test.ts`, `tests/unit/portions.test.ts`, `tests/unit/plan-schema.test.ts`

**Produces:**
- `isIsoDate(s)`, `addDays(iso, n)`, `weekday(iso): 0–6` (0 = nedeľa), `startOfWeek(iso, weekStartsOn)`, `weekDates(startIso): string[7]`, `daysBetween(a, b)`, `todayIso(now = new Date())` (lokálny dátum), `formatDayLabel(iso): { short: 'Po', long: 'pondelok', date: '6. 10.' }`, `formatWeekRange(startIso): '6. – 12. 10. 2026'`.
- `entryPortions(entry: { servingsOverride: number | null; audience: PlanAudience }, members: Pick<FamilyMemberDto, 'kind' | 'portionFactor' | 'isActive'>[]): number | null`.
- `memberInputSchema`, `slotUpdateSchema`, `settingsUpdateSchema`, `planEntryInputSchema`, `planRangeQuerySchema`, `planCopySchema`.
- DTO `PlanEntryDto { id, date, slotId, recipeId, recipe: { id, title, coverImageUrl, servings, deleted } | null, freeText, servingsOverride, note, sortOrder, audience }`, `PlanCopyResult { copied: number }`.

### Task 2: API rodiny, jedál dňa a nastavení

**Files:** `worker/routes/family.ts`, `worker/services/family.ts`, `worker/routes/me.ts` (nastavenia zlúčené s predvolenými – odložená pripomienka z fázy 0); Test: `tests/worker/family.test.ts`

`GET/POST /members`, `PUT/DELETE /members/:id`, `PUT /slots/:id`, `PUT /settings`. Testy: CRUD člena; dieťa bez koeficientu dostane koeficient z nastavení; člen inej domácnosti 404; zmena a vypnutie slotu; slot inej domácnosti 404; nastavenia sa zlúčia, neznámy kľúč 400; `/me` vráti predvolené nastavenia aj keď riadok chýba.

### Task 3: API jedálnička

**Files:** `worker/routes/plan.ts`, `worker/services/plan.ts`; Test: `tests/worker/plan.test.ts`

`GET /plan?from&to`, `POST /plan/entries`, `PUT/DELETE /plan/entries/:id`, `POST /plan/copy { fromDate, toDate, days, replace }`. Testy: záznam s receptom a s voľným textom; bez oboch 400; cudzí slot/recept 400; zmazaný recept pri vytvorení 400; zoznam zoradený (dátum, poradie slotu, poradie) s receptom; zmazaný recept po naplánovaní má `deleted: true`; presun cez PUT; zmazanie; kopírovanie týždňa posunie dátumy; dvojité kopírovanie zdvojí, `replace` nie; rozsah > 62 dní 400; izolácia domácností.

### Task 4: Frontend – API vrstva

**Files:** `src/api/family.ts`, `src/api/plan.ts`

Mutácie členov, slotov a nastavení invalidujú `['me']`; plán `usePlan(from, to)`, `useCreateEntry`, `useUpdateEntry`, `useDeleteEntry`, `useCopyPlan` invalidujú `['plan']`.

### Task 5: Frontend – Rodina a nastavenia

**Files:** `src/features/family/pages/FamilyPage.vue`, `src/features/family/components/MemberDialog.vue`, `src/features/settings/pages/SettingsPage.vue`

Rodina: zoznam členov (dospelý/dieťa, porcia, aktívny), pridať/upraviť v dialógu (meno, typ, koeficient posuvníkom 0,25–1,5, farba, aktívny), zmazať s potvrdením, súčet porcií domácnosti. Nastavenia: prepínače jedál dňa, začiatok týždňa, predvolený koeficient dieťaťa.

### Task 6: Frontend – týždenný plán

**Files:** `src/features/meal-plan/pages/MealPlanPage.vue`, `components/WeekGrid.vue`, `components/WeekList.vue`, `components/PlanEntryCard.vue`, `components/EntryDialog.vue`, `composables/useWeek.ts`

Navigácia týždňov (predošlý, dnes, ďalší; týždeň v URL `?tyzden=YYYY-MM-DD`), mriežka dni × jedlá na desktope, zoznam dní na mobile so zvýrazneným dneškom. Pridanie do slotu: recept (vyhľadávanie) alebo voľný text, porcie, poznámka. Úprava: zmena dňa a jedla (presun), „Kopírovať na iný deň“, zmazanie. „Kopírovať týždeň do ďalšieho“ s voľbou nahradiť. Vypnutý slot sa zobrazí, ak má v týždni jedlo.

### Task 7: Overenie a dokumentácia

Prehliadač mobil + desktop: pridať členov, naplánovať týždeň, presunúť, skopírovať týždeň. `npm run check`, build, spec 0c, README.
