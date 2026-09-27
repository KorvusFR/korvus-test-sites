# traffic/ — Korvus synthetic traffic generator

Playwright-based headless browser sessions that simulate realistic user behaviour on all 4 test sites.

## Prerequisites

```bash
cd traffic
npm install
npx playwright install chromium
```

## Quick start

```bash
# Dry run — lists all planned sessions without executing them
npx ts-node runner.ts --dry-run

# Run with defaults (10 sessions, 3 concurrent)
npx ts-node runner.ts

# Target a single site
npx ts-node runner.ts --site doomcheck

# Custom volume
npx ts-node runner.ts --sessions 50 --concurrency 5
```

## Parcours actif de validation V2

Le parcours déterministe des paliers 0 et 2 cible Doomcheck : consentement
accordé, fiche produit, ajout au panier, code `DOOM20`, paiement simulé et page
de confirmation. Il n'utilise ni mot de passe Shopify ni moyen de paiement réel.

```bash
# Vérifier la commande sans ouvrir de navigateur
npm run active-test -- --site doomcheck --assets published --dry-run

# Smoke pré-déploiement avec l'asset V1 gelé du CDN
npm run active-test -- --site doomcheck --assets v1-smoke

# Palier 0 : moteur et config de recette. Le script bloque d'abord le moteur
# publié avec window.__korvus_booted = true, puis charge les deux assets staging.
npm run active-test -- --site doomcheck --assets staging

# Palier 2 : balise publiée par GTM, sans injection locale
npm run active-test -- --site doomcheck --assets published
```

Une réussite se termine par `RESULT active-test PASS`. Le mode `staging` doit
charger `v2/s-staging/c26715146ef8af54.js` puis
`v2/korvus.staging.js`. Ne pas l'exécuter avant le déploiement du serveur V2 et
la génération de ces fichiers. La boutique `taguardian-fr.myshopify.com` n'est
pas une cible de cette commande : son storefront est protégé et son checkout
Shopify est hors de portée du moteur de la boutique.

Le mode `published` exige que la balise du site pose `window.__korvus_booted` :
une balise absente ou en erreur fait échouer le test. Au 2026-09-27, le chemin
auto-hébergé `/api/snippet/korvus.min.js` de Doomcheck répond 404 ; le mode
`v1-smoke` sert donc uniquement à valider le scénario avec l'asset V1 gelé du
CDN jusqu'à la publication de la balise V2.

## Scenarios

| Scenario | Default % | Description |
|---|---|---|
| `purchase` | 20% | Full tunnel: product → cart → checkout → confirmation |
| `add_to_cart` | 30% | Add to cart + abandon (no checkout) |
| `browse` | 30% | Catalog + product pages, no cart interaction |
| `bounce` | 20% | Home page only, leaves immediately |

Every session:
- Uses a randomised realistic User-Agent (desktop Chrome/Safari/Firefox, mobile iOS/Android)
- Injects random UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`)
- Adds 1–4s random delays between actions
- Scrolls the page before clicking (simulates human reading)

## Configuration

All settings live in `config.ts`:

| Setting | Description |
|---|---|
| `sites[]` | Base URLs, cart localStorage keys, product slugs per site |
| `distribution` | Scenario weights (must sum to 1.0) |
| `concurrency` | Number of parallel browser sessions |
| `totalSessions` | Sessions to run in one invocation |
| `utmCampaigns` | Pool of UTM sets to rotate through |

### Changing scenario distribution

Edit `defaultRunnerConfig.distribution` in `config.ts`:

```ts
distribution: {
  purchase: 0.4,    // 40% full purchase
  add_to_cart: 0.3, // 30% cart abandon
  browse: 0.2,      // 20% browse only
  bounce: 0.1,      // 10% bounce
},
```

### Adding a site

Add an entry to the `sites` array in `config.ts`:

```ts
{
  name: "my-new-site",
  baseUrl: "http://localhost:3004",
  cartKey: "my_cart",
  hasGtm: false,
  productSlugs: ["slug-1", "slug-2"],
  categoryPaths: ["/catalog/widgets"],
}
```

## TypeScript check

```bash
npx tsc --noEmit
```
