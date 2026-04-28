# korvus-test-sites — Contexte permanent Claude Code

## Objectif du repo

Environnement de **faux sites e-commerce** servant de terrain de test pour le snippet Korvus en conditions réelles (Next.js App Router, GTM, Shopify). Ce repo ne contient pas la prod Korvus, la base de données, ni le backend — uniquement des faux sites clients simulés.

---

## Architecture

Pas de monorepo, pas de `node_modules` partagés. Chaque app est **totalement indépendante** :

```
korvus-test-sites/
├── apps/
│   ├── athletedatahub/   ← Next.js, sport/nutrition
│   ├── taguardian-com/   ← Next.js, B2B cybersécurité
│   └── doomcheck/        ← Next.js, chaos lab
├── Caddyfile             ← Config Caddy (tous les domaines, y compris gtm.korvus.fr)
├── docker-compose.yml    ← Orchestration des 3 apps (réseau Docker externe `web`)
└── CLAUDE.md
```

Le Shopify Dev Store `taguardian.fr` est **externe** au repo (géré dans l'interface Shopify Partners).

---

## Apps existantes

### `apps/athletedatahub/`
- **Domaine** : athletedatahub.com (EN) · athletedatahub.fr (FR)
- **Rôle** : e-com sport/nutrition, SPA Next.js, ~50 produits JSON statiques
- **i18n** : switch via `NEXT_PUBLIC_LOCALE=EN|FR` — langue des labels + devise (USD/EUR)
- **Injection snippet** : `{/* INJECT_SCRIPTS */}` dans `src/app/layout.tsx` → `<head>`
- **Panier** : localStorage, clé `adh_cart`
- **Pas de GTM** — injection directe dans le `<head>`

### `apps/taguardian-com/`
- **Domaine** : taguardian.com
- **Tests auto** : **hors scope**, réservé aux tests manuels et au load testing utilisateur. Aucun projet Playwright ne l'exécute. Voir [.claude/rules/tests-snippet.md](.claude/rules/tests-snippet.md).
- **Rôle** : e-com high-ticket B2B (cybersécurité), ~100 produits €200–€5000, blog
- **GTM** : snippet GTM standard dans `layout.tsx`, ID configurable via `NEXT_PUBLIC_GTM_ID`
- **dataLayer** : initialisé avant le snippet GTM, lib `src/lib/gtm.ts`
- **Events dataLayer** : `pageview` (chaque navigation), `add_to_cart`, `begin_checkout`, `purchase` — schéma GA4 ecommerce standard
- **Dark mode** : toggle header + `ThemeScript` anti-flash, clé localStorage `taguardian_theme`
- **Panier** : localStorage, clé `taguardian_cart`
- **Cookie banner** : consent stocké localStorage, push `cookie_consent` event

### `apps/doomcheck/`
- **Domaine** : doomcheck.me
- **Rôle** : chaos lab — anomalies injectables (erreurs JS, latence réseau, DOM mutations)
- **Objectif** : tester la robustesse du snippet Korvus en conditions dégradées

### `taguardian.fr` *(Shopify Dev Store externe)*
- **Rôle** : simuler un site Shopify avec snippet Korvus injecté via les customizations du thème
- **Géré** : Shopify Partners, pas de fichiers dans ce repo

---

## Stack commune

| Élément | Valeur |
|---------|--------|
| Framework | Next.js 15 App Router |
| Langage | TypeScript strict (`strict: true`, 0 erreur `tsc --noEmit`) |
| Style | Tailwind CSS v3 + composants UI custom (pas de CLI shadcn) |
| Panier | React Context + `localStorage` |
| Data | JSON statique dans `/data` — pas de base de données |
| Paiement | Simulé — formulaire fake, aucun vrai paiement |
| Runtime | Node.js 22 Alpine (Docker) |

---

## Pattern Dockerfile (identique pour toutes les apps)

```dockerfile
# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_XXX=""
ENV NEXT_PUBLIC_XXX=$NEXT_PUBLIC_XXX
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public* ./public/   # glob = pas de plantage si public/ vide
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

Points clés :
- `output: "standalone"` dans `next.config.ts`
- Variables publiques passées comme `ARG` au build (ex : `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_LOCALE`)
- `COPY --from=builder /app/public* ./public/` — le glob évite l'échec si `public/` est absent ou vide

---

## Convention injection snippet Korvus

Dans **chaque** `src/app/layout.tsx`, le `<head>` contient :

```tsx
<head>
  {/* INJECT_SCRIPTS */}
</head>
```

C'est le point d'insertion officiel pour le snippet Korvus (et tout autre script tiers : GTM, etc.). Ne pas supprimer ce commentaire.

---

## Déploiement — GitHub Actions + Docker Compose

- **Serveur** : `91.134.132.241` (OVH Dunkerque, partagé avec le stack GTM)
- **Déclencheur** : `git push origin main` → GitHub Actions (`.github/workflows/deploy.yml`)
- **CI** : détecte les apps modifiées via `dorny/paths-filter`, SCP les fichiers vers le VPS, puis `docker compose build/up` uniquement pour les apps touchées
- **Orchestrateur** : Docker Compose (`docker-compose.yml` à la racine du repo)
- **Reverse proxy** : Caddy 2 Alpine (auto SSL Let's Encrypt) — instance globale dans `/opt/caddy/`
- **Réseau Docker** : `web` (externe, partagé entre tous les projets du VPS)
- **Build** : Docker via le `Dockerfile` présent dans chaque app (`apps/[nom-app]/Dockerfile`)
- **Variables de build** : passées comme `args` dans `docker-compose.yml`
- **Chemin sur le VPS** : `/opt/korvus-test-sites`
- **Note** : un commit ne touchant que `.gitignore` ou `tests/` ne déclenche pas de redéploiement (seuls `apps/`, `docker-compose.yml`, `Caddyfile` sont surveillés)

### Architecture VPS

Le VPS héberge plusieurs projets qui partagent un Caddy global :

| Chemin VPS | Rôle | Compose propre |
|---|---|---|
| `/opt/caddy/` | Caddy global (reverse proxy + SSL) | Oui — ports 80/443 |
| `/opt/gtm/` | Dashboard GTM Korvus (app + Postgres) | Oui — réseau `web` + `backend` |
| `/opt/korvus-test-sites/` | 3 apps test (ce repo) | Oui — réseau `web` |

Le `Caddyfile` qui gère **tous** les domaines (y compris `gtm.korvus.fr`) est versionné dans ce repo et copié dans `/opt/caddy/Caddyfile` au déploiement.

---

## Références

- [.claude/rules/tests-snippet.md](.claude/rules/tests-snippet.md) — Cahier de recette snippet : 21 tests Playwright, infra (IngestInterceptor, inject-snippet), specs par catégorie

---

## Conventions de développement

- `npx tsc --noEmit` doit retourner **0 erreur** avant tout commit
- `npm run build` doit passer sans erreur ESLint ni TypeScript
- Pas de `node_modules` ni `.next/` commités — chaque app a son `.gitignore`
- Les pages dynamiques Next.js 15 reçoivent `params` et `searchParams` comme `Promise<{...}>` (async)
- Pas de lib i18n complexe — switch simple sur variable d'env
- Pas d'abstraction prématurée — composants UI copiés/adaptés par app, pas partagés
