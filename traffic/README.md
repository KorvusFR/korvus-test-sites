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
