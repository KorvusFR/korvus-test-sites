import { defineConfig, devices } from "@playwright/test"

// Config Playwright dediee au sous-set "quick-add hors PDP" sur ADH.
// Utilisee quand une autre instance Claude tient les ports 3002/3003 :
// on cible uniquement le project athletedatahub (port 3001 deja lance
// manuellement) et on skip le globalSetup + webServers du config principal
// pour eviter les conflits EADDRINUSE.
//
// Lancement :
//   1. nohup npm --prefix apps/athletedatahub run dev -- --port 3001 &
//   2. cd tests && npx playwright test --config=playwright.adh-quickadd.config.ts

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Pas de globalSetup : la gate de parite dist (snippet build) n est pas
  // necessaire ici, on a deja rebuilt avant de lancer.

  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
    baseURL: "http://localhost:3011",
  },

  projects: [
    {
      name: "athletedatahub-quickadd",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3011" },
      testMatch: "**/athletedatahub.spec.ts",
      grep: /quick-add hors PDP/,
    },
  ],

  // Pas de webServer : on suppose ADH deja lance sur 3001.
})
