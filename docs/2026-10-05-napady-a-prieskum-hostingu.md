# Online kuchárska kniha – nápady a prieskum free hostingu

Dátum: 5. 10. 2026
Pre koho: ty a manželka (2 používatelia), mobil + desktop, nulové náklady.

---

## 1. Zoznam nápadov – čo má appka vedieť

Rozdelené na **MVP** (prvá použiteľná verzia), **2. fáza** (keď MVP žije) a **neskôr / možno**.
Odporúčam MVP držať malé – 3 veci, ktoré si menoval (recepty, jedálniček, nákupný zoznam), a všetko ostatné pridávať až keď to reálne chýba.

### 1.1 Recepty

**MVP**
- Recept: názov, fotka, kategória (polievka, hlavné jedlo, príloha, dezert, raňajky, desiata…), čas prípravy, náročnosť, počet porcií.
- Ingrediencie ako štruktúrované položky (množstvo + jednotka + názov), nie voľný text – inak sa nedá robiť nákupný zoznam.
- Postup po krokoch.
- Tagy / štítky (rýchle, bezmäsité, detské obľúbené, na víkend, do krabičky, sezónne…).
- Vyhľadávanie a filtrovanie (podľa názvu, ingrediencie, tagu, kategórie).
- Obľúbené / hodnotenie (srdiečko alebo 1–5 hviezdičiek, zvlášť za každého člena rodiny).
- Poznámky k receptu („nabudúce menej soli“, „deti chceli bez cibule“).

**2. fáza**
- Import receptu z URL (schema.org/Recipe – väčšina receptových webov to má, vrátane slovenských/českých).
- Prepočet porcií (2 → 4 → 6, ingrediencie sa prepočítajú).
- Varianty receptu (detská verzia bez korenia, dospelá pikantná).
- „Čo mám uvariť“ – náhodný výber alebo návrh podľa toho, čo je doma / čo sa dávno nevarilo.
- Režim varenia: veľké písmo, obrazovka nezhasína (Wake Lock API), odškrtávanie krokov, časovače pri krokoch.
- Fotky z mobilu priamo k receptu (kamera), viac fotiek.
- História: kedy sa recept naposledy varil, koľkokrát.

**Neskôr / možno**
- Nutričné hodnoty (kalórie, bielkoviny…) – vyžaduje databázu potravín, veľa práce, malý prínos pre rodinu.
- OCR z fotky receptu z knihy / papiera.
- Zdieľanie receptu linkom navonok (babka, kamarátka).
- Hlasové ovládanie pri varení.

### 1.2 Rodina a porcie (deti vs. dospelí)

**MVP**
- Členovia rodiny: meno, typ (dospelý / dieťa), voliteľne vek.
- Porcie: dieťa = napr. 0,5 porcie dospelého (nastaviteľný koeficient na člena). Jedálniček potom počíta reálne množstvo.

**2. fáza**
- Preferencie a alergie na člena (nemá rád hríby, bez laktózy) → recepty sa označia varovaním pri plánovaní.
- „Kto je doma“ pri konkrétnom jedle (dieťa je v škôlke na obed → neráta sa).
- Oddelené detské jedlo: v jeden deň môže byť „dospelí: X, deti: Y“.

### 1.3 Týždenný jedálniček

**MVP**
- Kalendár po dňoch, sloty: raňajky / desiata / obed / olovrant / večera (konfigurovateľné, nie každý slot musí byť vyplnený).
- Priradenie receptu do slotu (alebo voľný text „zvyšky“, „ideme von“).
- Pohľad na týždeň (desktop: tabuľka, mobil: zoznam po dňoch).
- Kopírovanie týždňa / jedla na iný deň.

**2. fáza**
- Šablóny týždňov („bežný školský týždeň“, „prázdniny“).
- Automatický návrh jedálnička podľa pravidiel (max 1× cestoviny týždenne, ryba v piatok, nedeľa polievka).
- Varenie na viac dní – jeden recept pokryje obed + večera nasledujúci deň (zvyšky).
- Príprava vopred (meal prep) – označenie, čo sa dá uvariť v nedeľu dopredu.

**Neskôr**
- Zdieľaný kalendár s exportom do Google/Apple kalendára (ICS).
- Notifikácia večer: „zajtra treba vybrať mäso z mrazničky“.

### 1.4 Nákupný zoznam

**MVP**
- Generovanie zoznamu z jedálnička na vybrané obdobie (celý týždeň alebo len pondelok–streda).
- Agregácia rovnakých ingrediencií naprieč receptmi (3 recepty s cibuľou → „cibuľa 5 ks“).
- Ručné pridanie položiek (toaletný papier, mlieko navyše).
- Odškrtávanie v obchode, real-time synchronizácia medzi vami dvoma (jeden nakupuje, druhý z domu dopíše).
- Zoradenie podľa kategórie v obchode (zelenina, mäso, mliečne, trvanlivé, drogéria).

**2. fáza**
- „Toto mám doma“ – odškrtnutie pred nákupom, položka sa nezobrazí.
- Stále položky (každý týždeň chlieb, mlieko, vajcia).
- Viac zoznamov (Lidl / Kaufland / lekáreň).
- Normalizácia jednotiek (200 g + 0,3 kg = 500 g).

**Neskôr**
- Jednoduchá evidencia zásob špajze/mrazničky (čo sa minie, kde to je).
- Odhad ceny nákupu.

### 1.5 Prierezové veci

**MVP**
- Prihlásenie len pre vás dvoch (jednoduché, nič verejné).
- PWA: inštalovateľné na mobil (ikona na ploche, celá obrazovka), funguje aj na desktope.
- Offline čítanie receptov a nákupného zoznamu (v obchode býva zlý signál).
- Responzívny dizajn: mobil na prvom mieste, desktop pre plánovanie týždňa.
- Export / záloha dát (JSON), aby ste neboli závislí na jednej službe.

**2. fáza**
- Tmavý režim.
- Slovenčina + možnosť ďalších jazykov (pravdepodobne netreba).
- Push notifikácie (na iOS fungujú len ak je PWA nainštalovaná na ploche).

---

## 2. Prieskum: kde a ako to hostovať zadarmo

### 2.1 Čo appka potrebuje
1. **Statický frontend** (HTML/JS/CSS) – to je zadarmo prakticky všade.
2. **Databáza** – recepty, jedálniček, zoznam; musí sa synchronizovať medzi vami dvoma.
3. **Úložisko fotiek** – jediná vec, ktorá na free tieroch býva problém.
4. **Prihlásenie** – 2 používatelia, nič komplikované.
5. **Žiadne „zaspávanie“** – kuchárska kniha sa používa denne/týždenne; nesmie sa stať, že na dovolenke sa databáza vypne.

### 2.2 Porovnanie – frontend hosting

| Služba | Bandwidth | Buildy | Poznámka |
|---|---|---|---|
| Cloudflare Workers / Pages | neobmedzený | 500 / mes. | jediný bez limitu bandwidthu, povolené aj komerčné použitie |
| Netlify Free | 100 GB / mes. | 300 min / mes. | výborné DX, pre vás viac než dosť |
| Vercel Hobby | 100 GB / mes. | 6000 min / mes. | len nekomerčné (u vás OK), najlepšie pre Next.js |
| GitHub Pages | 100 GB / mes. (soft) | 10 / hod. | len statika, bez backendu |

Pre 2 ľudí je bandwidth irelevantný – rozhoduje to, čo je pri frontende ako **backend**.

### 2.3 Porovnanie – databáza / backend

| Služba | Free limit | Zaspáva? | Fotky | Auth | Riziko |
|---|---|---|---|---|---|
| **Cloudflare D1** (SQLite) | 5 GB, 5 mil. čítaní/deň, 100 tis. zápisov/deň | **nie** | R2: 10 GB zadarmo, nulový egress | Cloudflare Access (zadarmo do 50 ľudí) alebo vlastné | od 9/2026 pri prekročení denného limitu query zlyhajú – pre 2 ľudí nereálne dosiahnuť |
| **Supabase** (Postgres) | 500 MB DB, 1 GB súbory, 50 tis. MAU | **áno – po 7 dňoch bez DB aktivity sa projekt pozastaví**, obnoviť treba ručne v dashboarde | 1 GB | vstavaná, hotová | pauza po dovolenke; 2 aktívne projekty max |
| **Firebase** (Firestore) | 1 GiB, 50 tis. čítaní/deň | nie | **od 2/2026 Storage vyžaduje Blaze plán (karta)** | vstavaná, hotová | fotky nie sú zadarmo bez karty; NoSQL model |
| **Neon** (Postgres) | 0,5 GB, 100 CU-hodín/mes., scale-to-zero | áno (cold start pár sekúnd, ale neblokuje) | nie, treba inde | Neon Auth 60 tis. MAU | len DB, treba ešte API vrstvu |
| **Turso** (SQLite) | 5 GB, 500 mil. čítaní/mes., 10 mil. zápisov/mes. | nie (scale-to-zero zrušený 1/2026) | nie | nie | len DB, treba API vrstvu |
| **PocketBase** (self-hosted) | zadarmo binárka, DB + auth + súbory v jednom | závisí od hostingu | áno, lokálne | vstavaná | **Fly.io free tier už nie je**; ostáva Oracle/Google Cloud Always Free – vyžadujú kartu a správu VPS |

### 2.4 Hotové riešenie namiesto vlastného vývoja

Existujú open-source self-hosted appky, ktoré robia presne toto:
- **Mealie** – recepty, import z URL, plánovač, nákupný zoznam, viac používateľov, pekné UI, PWA. Najbližšie tvojej predstave.
- **Tandoor** – silnejšie plánovanie a nákup, komplexnejšie.
- **Grocy** – skôr evidencia domácnosti a zásob.

Háčik: všetky bežia ako Docker kontajner s trvalým diskom. **Zadarmo bez karty sa dnes nehostujú** – Fly.io free zrušené, Render free spí. Realistické free možnosti sú Oracle Cloud Always Free (ARM VM, 24 GB RAM, trvalý disk – skutočne zadarmo, ale kartu chcú na overenie a VM si spravuješ sám) alebo domáci Raspberry Pi / NAS + Cloudflare Tunnel (zadarmo, prístup zvonku bez otvárania portov).

Zmysel to má, ak chceš **používať**, nie stavať. Ak chceš stavať (a podľa zadania áno), Mealie je výborná inšpirácia na dátový model a UX.

### 2.5 Odporúčanie

**Variant A (odporúčam): všetko na Cloudflare**
- Frontend: PWA (SvelteKit / React + Vite / Vue) nasadená ako Workers static assets (Pages je stále podporované, ale všetok vývoj ide do Workers – nový projekt začať na Workers).
- API: ten istý Worker (Hono alebo SvelteKit adapter).
- Databáza: D1 (SQLite) – relačný model sa pre recepty/ingrediencie/plán hodí ideálne.
- Fotky: R2 (10 GB zadarmo, bez poplatkov za sťahovanie) – pri fotkách zmenšených na ~1 500 px je to tisíce receptov.
- Prihlásenie: Cloudflare Access pred celou appkou – zadarmo do 50 používateľov, prihlásenie jednorazovým kódom na e-mail alebo Google účtom, **nemusíš písať žiadnu auth logiku**. Alternatíva: jednoduchý zdieľaný prístupový kód uložený v Worker secret.
- Realtime odškrtávanie zoznamu: pre 2 ľudí stačí polling každých pár sekúnd; Durable Objects (WebSocket) sú na free pláne tiež dostupné, ak to bude treba.
- Doména: `*.workers.dev` zadarmo; vlastná doména cca 10 €/rok cez Cloudflare Registrar (voliteľné).
- Riziko: zamknutie na jedného poskytovateľa – rieši export dát do JSON (je v MVP) a štandardné SQLite (D1 export je bežný .sql).

**Variant B: Supabase + Netlify/Vercel**
- Najrýchlejší štart, hotové auth, Postgres, vstavaný realtime, 1 GB na fotky.
- Jediný problém je pauza po 7 dňoch nečinnosti. Rieši sa to bezplatným cron pingom (napr. GitHub Actions / cron-job.org raz za 3 dni spraví jednu query), ale je to barlička a pravidlá sa menia.
- Vyber, ak chceš minimálne backendu a Postgres ti je bližší ako SQLite.

**Variant C: Mealie na Oracle Always Free alebo doma na Raspberry Pi**
- Nič neprogramuješ, za hodinu beží. Prispôsobenie (detské porcie, vlastné pravidlá) je ale limitované tým, čo Mealie vie.

### 2.6 PWA: mobil + desktop bez obchodov s aplikáciami
- Jedna codebase, Android aj iPhone aj Windows/Mac. Inštaluje sa z prehliadača („Pridať na plochu“), beží na celú obrazovku s vlastnou ikonou.
- iOS obmedzenia: inštalácia len cez Safari → Zdieľať → Pridať na plochu; push notifikácie len pre nainštalovanú PWA; žiadny Wake Lock problém od iOS 16.4+.
- Offline: service worker cachuje appku + posledné dáta (recepty, aktuálny zoznam). Zápisy offline sa dajú zaradiť do fronty a odoslať po pripojení – do MVP by som dal len offline čítanie.
- Netreba Google Play ani App Store, žiadne poplatky za vývojársky účet.

---

## 3. Otvorené otázky pred návrhom

Toto treba vyjasniť, než začnem kresliť architektúru a spec:

1. **Staviame vlastné, alebo nasadíme Mealie?** Predpokladám vlastné (zadanie hovorí „postaviť“), ale ak je cieľ hlavne používať, Mealie ušetrí mesiace.
2. **Deti vs. dospelí** – ide o (a) menšie porcie toho istého jedla, (b) iné jedlo pre deti, alebo (c) oboje? Ovplyvňuje to dátový model jedálnička.
3. **Fotky** – sú nutnosť v MVP, alebo stačí text a fotky pridáme v 2. fáze?
4. **Technológia frontendu** – máš preferenciu (React / Vue / Svelte / čisté HTML+JS)? Niečo, v čom sa budeš chcieť sám hrabať?
5. **Doména** – stačí `nieco.workers.dev`, alebo chceš vlastnú (cca 10 €/rok, jediný náklad)?
6. **Existujúce recepty** – máš ich niekde (Word, papier, iná appka, weby)? Určí to, či import z URL patrí do MVP.

---

## Zdroje
- [Free Cloud Hosting 2026: 14 Platforms Compared](https://snapdeploy.dev/blog/free-cloud-deployment-platforms-2026-comparison)
- [Netlify vs Vercel – real limits for personal users](https://cmaven.github.io/en/hosting/netlify-vercel-static-hosting-comparison/)
- [We Hosted the Same Site on All 4 Free Hosts in 2026](https://pressless.io/blog/host-website-free-2026)
- [Supabase Free Tier Limits 2026](https://www.itpathsolutions.com/supabase-free-tier-limits)
- [Supabase Review 2026: Free Tier Catch](https://www.jetadmin.io/blog/supabase-review/)
- [Firebase pricing](https://firebase.google.com/pricing)
- [Firebase Free Tier 2026 – Storage change](https://agentdeals.dev/vendor/firebase)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 free tier limit enforcement (2026-09-01)](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [Cloudflare free limits overview (05/2026)](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/)
- [Cloudflare Pages vs Workers in 2026](https://mecanik.dev/en/posts/cloudflare-pages-vs-workers-which-to-use-in-2026/)
- [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/)
- [Neon vs Turso](https://agentdeals.dev/neon-vs-turso)
- [Turso vs Neon vs Supabase 2026](https://devtoolpicks.com/blog/turso-vs-neon-vs-supabase-indie-hackers-2026)
- [PocketBase FAQ – hosting](https://pocketbase.io/faq/)
- [Render: platforms with a real free tier 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026.md)
- [Mealie vs Tandoor vs Grocy](https://sumguy.com/mealie-vs-tandoor-vs-grocy/)
