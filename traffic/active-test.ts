import { chromium, type BrowserContext, type Page } from "playwright";

type AssetMode = "published" | "staging" | "v1-smoke";

interface Options {
  assets: AssetMode;
  dryRun: boolean;
  headful: boolean;
  site: "doomcheck";
}

const SITE = {
  baseUrl: "https://doomcheck.me",
  productPath: "/products/novapro-x12",
  siteKey: "c26715146ef8af54",
} as const;

const STAGING_CONFIG_URL = `https://cdn.korvus.fr/v2/s-staging/${SITE.siteKey}.js`;
const STAGING_ENGINE_URL = "https://cdn.korvus.fr/v2/korvus.staging.js";
const V1_ENGINE_URL = "https://cdn.korvus.fr/v1/korvus.min.js";

function usage(): never {
  throw new Error(
    "usage: npm run active-test -- --site doomcheck --assets published|staging|v1-smoke [--dry-run] [--headful]",
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = { assets: "published", dryRun: false, headful: false, site: "doomcheck" };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--headful") options.headful = true;
    else if (argument === "--assets") {
      const value = argv[++index];
      if (value !== "published" && value !== "staging" && value !== "v1-smoke") usage();
      options.assets = value;
    } else if (argument === "--site") {
      const value = argv[++index];
      if (value !== "doomcheck") usage();
      options.site = value;
    } else usage();
  }
  return options;
}

function step(name: string, detail: string): void {
  console.log(`STEP ${name}: PASS — ${detail}`);
}

async function requireVisible(page: Page, selector: string, label: string): Promise<void> {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 15_000 });
  step(label, selector);
}

async function prepareStaging(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    window.__korvus_booted = true;
  });
}

async function injectStaging(page: Page): Promise<void> {
  const productionWasBlocked = await page.evaluate(() => window.__korvus_booted === true);
  if (!productionWasBlocked) throw new Error("production engine guard was not preserved");

  await page.addScriptTag({ url: STAGING_CONFIG_URL });
  await page.evaluate(() => {
    delete window.__korvus_booted;
  });
  await page.addScriptTag({ url: STAGING_ENGINE_URL });
  const stagingBooted = await page.waitForFunction(() => window.__korvus_booted === true, undefined, {
    timeout: 15_000,
  });
  await stagingBooted.dispose();
  step("staging-assets", `${STAGING_CONFIG_URL} + ${STAGING_ENGINE_URL}`);
}

async function injectV1Smoke(page: Page): Promise<void> {
  const productionWasBlocked = await page.evaluate(() => window.__korvus_booted === true);
  if (!productionWasBlocked) throw new Error("production engine guard was not preserved");
  await page.evaluate(() => {
    delete window.__korvus_booted;
  });
  await page.addScriptTag({ url: V1_ENGINE_URL });
  await page.waitForFunction(() => window.__korvus_booted === true, undefined, { timeout: 15_000 });
  const version = await page.evaluate(() => window.__korvus_version ?? "unknown");
  step("v1-smoke-asset", `${V1_ENGINE_URL}; version=${version}`);
}

async function requirePublishedTag(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__korvus_booted === true, undefined, { timeout: 15_000 });
  const version = await page.evaluate(() => window.__korvus_version ?? "unknown");
  step("published-assets", `site tag booted; version=${version}`);
}

async function acceptConsent(page: Page): Promise<void> {
  const banner = page.getByRole("dialog", { name: "Cookie consent" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Accept" }).click();
  } else {
    await page.waitForFunction(() => typeof window.__korvusCMP?.accept === "function");
    await page.evaluate(() => window.__korvusCMP?.accept());
  }
  await page.waitForFunction(() => window.__korvusCMP?.getStatus() === "accepted");
  step("consent", "granted");
}

async function runFlow(options: Options): Promise<void> {
  const marker = `codex-z12-${Date.now()}`;
  const productUrl = `${SITE.baseUrl}${SITE.productPath}?utm_source=codex&utm_medium=e2e&utm_campaign=${marker}`;

  if (options.dryRun) {
    console.log(`PLAN site=${options.site} assets=${options.assets}`);
    console.log(`PLAN product=${productUrl}`);
    if (options.assets === "staging") {
      console.log("PLAN init-script: window.__korvus_booted = true");
      console.log(`PLAN config=${STAGING_CONFIG_URL}`);
      console.log(`PLAN engine=${STAGING_ENGINE_URL}`);
    } else if (options.assets === "v1-smoke") {
      console.log("PLAN init-script: window.__korvus_booted = true");
      console.log(`PLAN engine=${V1_ENGINE_URL}`);
    }
    console.log("PLAN consent > product > add_to_cart > cart > checkout > promo DOOM20 > payment > purchase");
    console.log("RESULT dry-run PASS");
    return;
  }

  const browser = await chromium.launch({ headless: !options.headful });
  const context = await browser.newContext();
  if (options.assets !== "published") await prepareStaging(context);

  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") console.error(`BROWSER ${message.type()}: ${message.text()}`);
    });

    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    if (options.assets === "staging") await injectStaging(page);
    else if (options.assets === "v1-smoke") await injectV1Smoke(page);
    else await requirePublishedTag(page);

    await acceptConsent(page);
    await requireVisible(page, "[data-add-to-cart]", "product");
    await page.locator("[data-add-to-cart]").click();
    await page.getByRole("button", { name: "Added to Cart" }).waitFor({ state: "visible" });
    step("add-to-cart", "product added");

    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL("**/cart");
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await page.waitForURL("**/checkout");
    step("cart", "checkout reached through site navigation");

    const promo = page.locator(".discount-tag");
    await promo.waitFor({ state: "visible" });
    const promoText = (await promo.innerText()).replace(/\s+/g, " ").trim();
    if (!promoText.includes("DOOM20")) throw new Error(`unexpected promo text: ${promoText}`);
    step("promo", promoText);

    const fields: Record<string, string> = {
      email: "codex-test@doomcheck.me",
      firstName: "Codex",
      lastName: "Test",
      address: "1 Void Street",
      city: "Doomhaven",
      zip: "00100",
      country: "FR",
      cardNumber: "4242 4242 4242 4242",
      cardExpiry: "12/28",
      cardCvc: "123",
    };
    for (const [name, value] of Object.entries(fields)) await page.locator(`input[name="${name}"]`).fill(value);

    const payButton = page.locator('button.w-full[type="submit"]');
    await payButton.waitFor({ state: "visible" });
    step("payment", (await payButton.innerText()).trim());
    await payButton.click();
    await page.waitForURL("**/checkout/confirmation?**", { timeout: 15_000 });
    await page.getByRole("heading", { name: "Order Confirmed" }).waitFor({ state: "visible" });

    const resultUrl = new URL(page.url());
    const orderId = resultUrl.searchParams.get("order");
    if (!orderId?.startsWith("DC-")) throw new Error("confirmation has no Doomcheck order id");
    await page.waitForTimeout(2_000);
    step("purchase", `order_id=${orderId}; consent=granted`);
    console.log(`RESULT active-test PASS site=${options.site} assets=${options.assets} marker=${marker}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

declare global {
  interface Window {
    __korvus_booted?: boolean;
    __korvus_version?: string;
    __korvusCMP?: {
      accept: () => void;
      getStatus: () => "accepted" | "declined" | null;
    };
  }
}

runFlow(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
  console.error(`RESULT active-test FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
