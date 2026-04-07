import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  retries: 0,
  fullyParallel: true,
  reporter: "html",

  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "athletedatahub",
      use: { baseURL: "http://localhost:3001" },
      testMatch: "**/athletedatahub.spec.ts",
    },
    {
      name: "taguardian-com",
      use: { baseURL: "http://localhost:3002" },
      testMatch: "**/taguardian-com.spec.ts",
    },
    {
      name: "doomcheck",
      use: { baseURL: "http://localhost:3003" },
      testIgnore: ["**/athletedatahub.spec.ts", "**/taguardian-com.spec.ts"],
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
  ],
})
