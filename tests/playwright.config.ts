import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  retries: 0,
  fullyParallel: true,
  reporter: "html",
  // Phase 7 A1 — Gate de parité dist. Fail loud si korvus.min.js est stale
  // avant même de démarrer les webServers. Voir global-setup.ts.
  globalSetup: require.resolve("./global-setup.ts"),

  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },

  projects: [
    // Chromium — baseline
    {
      name: "athletedatahub",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3001" },
      testMatch: "**/athletedatahub.spec.ts",
    },
    // `taguardian-com` (port 3002) : volontairement absent de la matrice.
    // Décision pérenne — le site est réservé aux tests manuels et au load
    // testing côté utilisateur (cf. test_website/.claude/rules/tests-snippet.md
    // et platform/.claude/rules/testing.md). Le webServer est démarré plus
    // bas uniquement pour que l'utilisateur puisse l'atteindre en manuel
    // pendant un run global. Ne PAS ajouter de project qui exécuterait
    // `taguardian-com.spec.ts` — ce spec est orphelin exprès.
    {
      name: "doomcheck",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3003" },
      testIgnore: [
        "**/athletedatahub.spec.ts",
        "**/taguardian-com.spec.ts",
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    // WebKit — Phase 7 A3. Même specs, moteur Safari pour catcher les
    // divergences visibilitychange / pushState / PerformanceObserver /
    // custom elements. Tourne en matrice avec Chromium.
    {
      name: "athletedatahub-webkit",
      use: { ...devices["Desktop Safari"], baseURL: "http://localhost:3001" },
      testMatch: "**/athletedatahub.spec.ts",
    },
    {
      name: "doomcheck-webkit",
      use: { ...devices["Desktop Safari"], baseURL: "http://localhost:3003" },
      testIgnore: [
        "**/athletedatahub.spec.ts",
        "**/taguardian-com.spec.ts",
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    // Audit 2026-04-15 (B6b) — matrice complète sur doomcheck (suite
    // snippet exhaustive). Ajoute Firefox desktop + Mobile Chrome (Pixel 7)
    // + Mobile Safari (iPhone 13) pour couvrir :
    //  - Firefox : deuxième engine indépendant, divergences
    //    PerformanceObserver / fetch timing / MutationObserver batching
    //  - Mobile Chrome : viewport bucketing (393 → 376), touch delegation,
    //    pointer events sur Android
    //  - Mobile Safari : le plus gros angle mort prod (trafic e-com FR
    //    ~50% iOS Safari), pagehide, bfcache agressif, sessionStorage
    //    Safari private, visibilitychange unreliable sur iOS
    // athletedatahub reste Chrome+Safari desktop — ses tests sont
    // site-specific et n'apportent pas de valeur marginale en matrice.
    {
      name: "doomcheck-firefox",
      use: { ...devices["Desktop Firefox"], baseURL: "http://localhost:3003" },
      testIgnore: [
        "**/athletedatahub.spec.ts",
        "**/taguardian-com.spec.ts",
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    {
      name: "doomcheck-mobile-chrome",
      use: { ...devices["Pixel 7"], baseURL: "http://localhost:3003" },
      testIgnore: [
        "**/athletedatahub.spec.ts",
        "**/taguardian-com.spec.ts",
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    {
      name: "doomcheck-mobile-safari",
      use: { ...devices["iPhone 13"], baseURL: "http://localhost:3003" },
      testIgnore: [
        "**/athletedatahub.spec.ts",
        "**/taguardian-com.spec.ts",
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    // floral-nuxt — Nuxt 3 SSR + SPA, 3 locales (FR/ES/IT) sur ports
    // 3004/3005/3006 via NUXT_PUBLIC_LOCALE. Replique les patterns
    // Interflora pour valider la cascade i18n du snippet (cart/checkout/
    // order_confirmation multilingue) + l'hygiene SPA (pushState dedup,
    // listener leak, timer cleanup). Chromium uniquement : la matrice
    // cross-engine vit sur doomcheck (cf. tests-snippet.md).
    //
    // floral-nuxt.spec.ts parse le project name pour extraire la locale,
    // donc les 3 projects DOIVENT s'appeler floral-nuxt-{fr,es,it}.
    // perf-memory-spa et spa-navigation tournent uniquement sur le project
    // FR (skip interne sur les autres).
    {
      name: "floral-nuxt-fr",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3004" },
      testMatch: [
        "**/floral-nuxt.spec.ts",
        "**/perf-memory-spa.spec.ts",
        "**/spa-navigation.spec.ts",
      ],
    },
    {
      name: "floral-nuxt-es",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3005" },
      testMatch: "**/floral-nuxt.spec.ts",
    },
    {
      name: "floral-nuxt-it",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3006" },
      testMatch: "**/floral-nuxt.spec.ts",
    },
  ],

  webServer: [
    {
      command: "npm run dev -- --port 3001",
      url: "http://localhost:3001",
      cwd: "../apps/athletedatahub",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --port 3002",
      url: "http://localhost:3002",
      cwd: "../apps/taguardian-com",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --port 3003",
      url: "http://localhost:3003",
      cwd: "../apps/doomcheck",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:fr",
      url: "http://localhost:3004",
      cwd: "../apps/floral-nuxt",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:es",
      url: "http://localhost:3005",
      cwd: "../apps/floral-nuxt",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:it",
      url: "http://localhost:3006",
      cwd: "../apps/floral-nuxt",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
