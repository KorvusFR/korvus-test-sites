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
│   └── doomcheck/        ← Next.js, chaos lab (à venir)
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
- **Rôle** : e-com high-ticket B2B (cybersécurité), ~100 produits €200–€5000, blog
- **GTM** : snippet GTM standard dans `layout.tsx`, ID configurable via `NEXT_PUBLIC_GTM_ID`
- **dataLayer** : initialisé avant le snippet GTM, lib `src/lib/gtm.ts`
- **Events dataLayer** : `pageview` (chaque navigation), `add_to_cart`, `begin_checkout`, `purchase` — schéma GA4 ecommerce standard
- **Dark mode** : toggle header + `ThemeScript` anti-flash, clé localStorage `taguardian_theme`
- **Panier** : localStorage, clé `taguardian_cart`
- **Cookie banner** : consent stocké localStorage, push `cookie_consent` event

### `apps/doomcheck/` *(à venir)*
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

## Déploiement — Coolify (VPS 2)

- **Serveur** : `57.129.133.114` (VPS 2)
- **Orchestrateur** : Coolify — une app Coolify par domaine
- **Base directory** dans Coolify : `/apps/[nom-app]` (ex : `/apps/athletedatahub`)
- **Build** : Docker via le `Dockerfile` présent à la racine de chaque app
- **Variables d'env** : configurées dans l'interface Coolify (pas dans le repo)

---

## Conventions de développement

- `npx tsc --noEmit` doit retourner **0 erreur** avant tout commit
- `npm run build` doit passer sans erreur ESLint ni TypeScript
- Pas de `node_modules` ni `.next/` commités — chaque app a son `.gitignore`
- Les pages dynamiques Next.js 15 reçoivent `params` et `searchParams` comme `Promise<{...}>` (async)
- Pas de lib i18n complexe — switch simple sur variable d'env
- Pas d'abstraction prématurée — composants UI copiés/adaptés par app, pas partagés
