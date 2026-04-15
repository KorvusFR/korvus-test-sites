# Tests Snippet — Cahier de recette

> Tests Playwright E2E mockés pour valider le snippet Korvus v2. Chaque test doit passer avant tout déploiement du snippet.
> La **passe réelle** contre `/api/ingest` vit côté platform : [platform/.claude/rules/e2e-local-setup.md](../../../platform/.claude/rules/e2e-local-setup.md).

## Environnement de test

- **Framework** : Playwright, config dans `tests/playwright.config.ts`
- **2 projets Playwright automatisés** : `athletedatahub` (port 3001), `doomcheck` (port 3003)
- **Hors scope auto** : `taguardian-com` (port 3002, GTM dataLayer) — volontairement gardé pour tests manuels et load testing côté utilisateur, **ne jamais automatiser**. Idem pour le Shopify Dev Store `taguardian.fr` (hors repo).
- **Lancement** : `cd tests && npx playwright test`
- **Mock par défaut** : tous ces specs interceptent `/api/ingest` via `IngestInterceptor`. Pour taper la vraie route, aller côté platform Phase 4.

## Infra de test

### Helpers (`tests/helpers/`)

| Fichier | Rôle |
|---|---|
| `ingest-interceptor.ts` | Intercepte les POST `/api/ingest` via `page.route()`, stocke les batches, expose `getEvents()`, `getSession()`, `getPageviews()`, `waitForEvent()`, `triggerFlush()` |
| `inject-snippet.ts` | Injecte `korvus.min.js` (lu depuis `platform/snippet/dist/`) dans la page via `addInitScript`, avec config `window.__korvus` contrôlée par le test |
| `assertions.ts` | Helpers d'assertion : `expectEvent()`, `expectNoEvent()`, `expectSessionField()`, `expectPageviewField()` |

### Injection du snippet

Le snippet est chargé depuis `platform/snippet/dist/korvus.min.js` (workspace voisin). Les tests ne dépendent pas d'un serveur d'ingestion réel — les requêtes `/api/ingest` sont interceptées par Playwright et répondent `200 {}`.

Configs par site dans `inject-snippet.ts` (websiteId, apiKey, endpoint, platform). Chaque test peut override la config (ex : `domSelectors`, `datalayerEventMapping`).

### Flush du buffer

Le snippet batch les events toutes les 30s. Pour éviter d'attendre, les tests appellent `interceptor.triggerFlush()` qui simule `visibilitychange → hidden` pour forcer le flush.

## Specs implémentées (`tests/specs/`)

### `errors.spec.ts` — Tests 4-7

Tests sur doomcheck (chaos engine).

- **Test 4 — `js_error`** : capture erreur JS non gérée (message, source, lineno, colno, stack), déduplication par `count`, filtrage erreurs extensions
- **Test 5 — `request_error`** : capture fetch 500 (url, status_code, method, duration_ms), timeout, filtrage domaines analytics, intégrité de la réponse originale
- **Test 6 — `resource_error`** : capture img/script/link cassés (tag, url), filtrage deny-list
- **Test 7 — `ux_error`** : capture éléments d'erreur visibles (.alert, role="alert"), ignore éléments masqués

### `webperf.spec.ts` — Test 8-9

Tests sur doomcheck.

- **Test 8 — Web Performance** : capture LCP, TTFB, FCP, lcp_element, resource_timings
- **Test 9 — `scripts_hash`** : hash change quand un script est ajouté, stable sinon

### `ecommerce.spec.ts` — Tests 10-15

Tests sur doomcheck.

- **Test 10 — `add_to_cart_attempt`** : capture clic ATC avec product_id depuis JSON-LD
- **Test 11 — `search_performed`** : capture recherche avec query (consent granted) et results_count (exempt)
- **Test 12 — `pageviews.product_available`** (v2 — remplace `out_of_stock_viewed` supprimé) : PDP en rupture → colonne `product_available = false` dans la pageview (pas un raw_event)
- **Test 13 — `structured_data_check`** : vérifie détection JSON-LD Product
- **Test 14 — `datalayer_validation`** : vérifie validation purchase dataLayer (valid/invalid), bloqué sans consent
- **Test 15 — `pageviews.product_*`** (v2 — remplace `product_seen` supprimé) : PDP → colonnes dénormalisées `product_id`/`product_name`/`product_price_visible`/`product_currency` dans la pageview. Price/currency consent-gated.

### `consent.spec.ts` — Tests 16-18

Tests sur doomcheck avec simulation Axeptio CMP.

- **Test 16 — Mode exempt** : consent denied → seuls les events exempts passent, pas d'UTMs
- **Test 17 — Mode consent** : consent granted → tous les events passent, UTMs captés
- **Test 18 — Opt-out** : cookie `korvus_optout=1` → aucun event, aucune requête réseau

### `batching.spec.ts` — Tests 19-20

Tests sur doomcheck.

- **Test 19 — Batching** : un seul POST à 30s, flush via visibilitychange
- **Test 20 — Buffer overflow** : buffer max 100 events, les plus anciens droppés

### `performance.spec.ts` — Tests 1-3 + Phase 3 gates

Tests de non-régression. Mesures via `PerformanceObserver` natif, pas Lighthouse (trop de variance sur runners).

- **Test 1 — Impact Core Web Vitals** : delta LCP/FCP/TTFB avec/sans snippet, 5 runs avec/sans, seuils < 100/50/50ms
- **Test 2 — Intégrité fetch** : 5 appels variés avec/sans snippet, réponses identiques (status, body length, content-type), cross-origin error préservé
- **Test 3 — Crash isolation** : snippet corrompu → site fonctionne, pas d'erreur console (4 scénarios : config cassée, endpoint unreachable, endpoint 500, sessionStorage bloqué, sendBeacon retiré)
- **Phase 3 — Gate 1** : `gzip(korvus.min.js) < 110 KB` — contrat dur, déterministe (fs + zlib)
- **Phase 3 — Gates 2/3** : TBT delta < 500 ms, long tasks delta ≤ 5 — **smoke anti-catastrophe uniquement** (dev server local = env biaisé, vraie perf = Phase 6 RUM prod)

### `athletedatahub.spec.ts` — Tests spécifiques site + happy path chaîné

Tests sur `athletedatahub` (port 3001).

- page_type detection (home, pdp JSON-LD, plp, search, checkout, cart via pageTypeRules)
- `structured_data_check` sur PDP
- `pageviews.product_*` (v2, remplace l'ancien `product_seen` spécifique ADH)
- `pageviews.product_available` (v2, remplace l'ancien `out_of_stock_viewed` spécifique ADH)
- `tag_fired` tests **skipped** — legacy v1 basé sur `window.fbq`/`window.gtag`, v2 détecte via interception URL réseau (cf. checkout.spec.ts)
- `search_performed` avec domSelectors custom
- **Happy path chaîné** (Phase 2) : PDP réelle → click ATC → navigation checkout → injection payment radio → click Payer → push purchase dataLayer → assert `add_to_cart_attempt`, `structured_data_check`, `payment_method_selected`, `payment_attempted`, `purchase` tous présents

## Phase 2 — Nouveaux specs v2

Les specs suivants ont été ajoutés pour couvrir les 12 events v2 non couverts par la suite legacy et les angles de l'audit externe :

### `checkout.spec.ts` — 24 tests, tourne sur `doomcheck`

Couvre (au moins un cascade chacun) : `add_to_cart_succeeded` (badge_count, localstorage_cart, url_change), `variant_selected` (select_change, radio_change, data_attr_click, OOS oos_class_marker), `promo_applied` source `dom`, `promo_code_rejected`, `payment_method_selected` (radio_change, data_attr_click, wallet_button_click), `shipping_method_selected` (radio_change, data_attr_click), `payment_attempted` (submit_button_click, keyword_button_click, wallet_button_click), `3ds_initiated` (iframe_acs_pattern_match, iframe_payment_redirect), `3ds_completed` (success via `/merci`, failed via error element), `tag_fired` via interception URL (Meta + GA4), `datalayer_unknown`.

### `csp.spec.ts` — 2 tests (audit item b)

CSP stricte via `page.route` qui injecte le header `Content-Security-Policy` sur la fixture `/sim/pdp`. Vérifie que `csp_violation` est émis sur une img cross-origin bloquée, et que le snippet ne crash pas sous CSP.

### `late-gtm.spec.ts` — 2 tests (audit item c)

`dataLayer.push` 3 s et 5 s après le boot du snippet → vérifie que le monkey-patch persiste et capture les events tardifs.

### Fixtures doomcheck

- `apps/doomcheck/src/app/sim/pdp/page.tsx` — PDP minimal avec JSON-LD Product (force `page_type=pdp`) + `<button class="add-to-cart" id="sim-atc">` **statique** (le collector `add_to_cart_attempt` appelle `findAtcButton()` **une seule fois à l'init** → le bouton DOIT exister avant le boot du snippet)
- `apps/doomcheck/src/app/sim/checkout/page.tsx` — checkout minimal avec `<span class="sim-promo-code">SUMMER20</span>` **statique** (le collector `promo-applied` lit le sélecteur une seule fois au idle → doit être là dès le load)
- Les deux pages ont un `<div id="sim-root">` vide que les tests Playwright remplissent runtime via `page.evaluate()`
- Pour `/sim/checkout`, les tests passent `pageTypeRules: { checkout: { url_contains: "/sim/checkout" } }` pour forcer `page_type=checkout`

## Gotchas v2 collectors (appris en Phase 1 + 2)

Les erreurs les plus coûteuses en temps debug. À lire avant d'étendre un spec.

- **`window.onerror` n'est PAS écouté en v2**. Le collector `js-error` utilise `addEventListener("error", ..., true)` (audit 2026-04-14, isolation vs APM/Sentry clients). Tester via `window.dispatchEvent(new ErrorEvent("error", { message, filename, lineno, colno, error }))`. Appeler `window.onerror?.(...)` no-op silencieusement.
- **`request_error` et `resource_error` payload** : plus de champ `url`. Le snippet strip en `url_host` + `url_path` (query string retiré côté snippet, CNIL). Tests qui lisent `e.payload.url` cassent — utiliser `e.payload.url_path` ou `e.payload.url_host`.
- **`product_seen` et `out_of_stock_viewed` supprimés en v2** — remplacés par les colonnes dénormalisées `pageviews.product_id`, `product_name`, `product_available`, `product_price_visible`, `product_currency`. Tester via `interceptor.getPageviews()`, pas `getEvents()`. `price`/`currency` sont consent-gated.
- **`search_performed.query` consent-gated** : null sans consent granted. Le `results_count` et `has_zero_results` restent exempts. Pour tester la query, simuler Axeptio granted.
- **`findAtcButton` appelé UNE SEULE FOIS à l'init** du collector `add_to_cart_attempt`. Conséquence : le bouton ATC (matchant `config.domSelectors.add_to_cart` ou selectors platform) doit exister dans le DOM **avant** le boot du snippet (≤ ~2 s post-load). Ajouter via `page.evaluate` après `waitBoot` = trop tard. C'est pour ça que `sim/pdp/page.tsx` a un bouton statique.
- **Cascade variant OOS `disabled_attribute`** : vérifie le **disabled attribute sur le variant element lui-même** (select/radio), PAS sur le bouton ATC. Pour simuler "ATC désactivé après select", c'est la cascade `atc_disabled_after_select` (fenêtre 500 ms post-select). Pour OOS général, le plus simple est `oos_class_marker` : wrapper parent avec classe `out-of-stock`, `oos`, `sold-out`, etc. (cf. `lib/patterns/out-of-stock.ts`).
- **`3ds_completed` outcome success** utilise `isOrderConfirmationUrl(url)` qui fait un `pathname.includes(pattern)` substring strict. `/order-confirmation` ne matche PAS `/confirmation` (pas de slash avant `confirmation`). Utiliser `/merci`, `/thank-you`, `/checkout/confirmation`, ou `/order-received` pour trigger success.
- **`tag_fired` v2** détecté via **interception URL réseau** (fetch/XHR contre `facebook.com/tr`, `google-analytics.com/g/collect`, `bat.bing.com`, etc.), plus via présence de `window.fbq`/`window.gtag`. Les tests legacy basés sur ces globals sont `test.skip()` et à réécrire. Pour trigger : `await page.route("**facebook.com/tr**", r => r.fulfill({ status: 200, body: "" }))` puis `fetch("https://www.facebook.com/tr?id=...&ev=PageView")` depuis la page.
- **Custom elements** (`<apple-pay-button>`, `.gpay-button`) n'ont pas de layout par défaut → `page.click` timeout sur "element is not visible". Utiliser `el.dispatchEvent(new MouseEvent("click", { bubbles: true }))` dans un `page.evaluate`. Le snippet écoute via delegated click sur `document`, pas via le rendu.
- **`promo_applied` source DOM** est lu **une seule fois** dans `scheduleIdleTask()` après le boot. L'élément doit être dans le DOM au moment du read (statique dans la page ou via `page.addInitScript` DOMContentLoaded, pas `page.evaluate` post-boot).
- **`add_to_cart_succeeded` cascade `badge_count`** nécessite **deux mutations distinctes** post-ATC : la première pose la baseline (lit la valeur courante), la seconde déclenche le delta (détection de l'incrément). Séparer par un `page.waitForTimeout(100)` minimum, sinon MutationObserver batche et on perd le delta.
- **`payment_method_selected` cascades 2-5** requièrent un contexte parent — id/class matchant `payment|paiement|paymentmethod|checkout|method|mode`. Le radio_change est la seule cascade qui n'exige pas ce contexte (le nom du radio suffit). Pour les autres, wrapper l'élément dans un parent avec `id="payment-options"` ou `class="checkout-payment"`.
- **`shipping_method_selected`** : même logique, token parent `shipping|livraison|delivery|carrier`.
- **`payment_attempted` cascade 2 (keyword button click)** : regex word-boundary Unicode strict. `<button>Payer</button>` OK. `<button>Compare payment plans</button>` NON (matcherait "payment" mais le filtre Unicode sait différencier). Utiliser des keywords clairs : `Pay`, `Payer`, `Bezahlen`, `Pagar`.
- **`pushState` vs `popstate`** : le snippet monkey-patche `history.pushState` directement, donc `window.history.pushState(...)` dans un `page.evaluate` trigger `dispatchNav` automatiquement. Pas besoin de `dispatchEvent(new PopStateEvent("popstate"))` en plus (mais harmless).

## Test manquant

- **Test 21 — Inactivité** (30 min idle → stop collecte) : non implémenté, nécessite un timeout de 31 min peu pratique en CI

## Split helper mock ↔ helper real ingest

- `tests/helpers/inject-snippet.ts` (ce repo) → **mocke `/api/ingest`** via `IngestInterceptor`. Utilisé par tous les specs de `test_website/tests/specs/`.
- `../platform/tests/e2e/helpers/inject-snippet.ts` (côté platform) → **ne mocke PAS**. Utilisé uniquement par le spec Phase 4 `ingest-smoke.spec.ts` qui tape la vraie route. Voir [platform/.claude/rules/e2e-local-setup.md](../../../platform/.claude/rules/e2e-local-setup.md).

Ne jamais importer le mauvais : un helper mock importé dans un spec real ingest masque le vrai comportement serveur ; un helper real importé dans un spec mock laisse fuir du vrai trafic vers le dev server.
