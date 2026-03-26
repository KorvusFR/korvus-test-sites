import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, safeClick } from "../utils";

const FAKE_CARDS = [
  { number: "4242 4242 4242 4242", expiry: "12/28", cvc: "123" },
  { number: "4111 1111 1111 1111", expiry: "08/27", cvc: "456" },
  { number: "5555 5555 5555 4444", expiry: "03/29", cvc: "789" },
];

const FAKE_NAMES = [
  { first: "Alex", last: "Voss" },
  { first: "Sam", last: "Decker" },
  { first: "Jordan", last: "Holt" },
  { first: "Taylor", last: "Marsh" },
  { first: "Morgan", last: "Blake" },
];

const FAKE_EMAILS = [
  "buyer@example.com",
  "testuser@void.dev",
  "demo@doomcheck.me",
  "shopper@null.io",
];

/**
 * Purchase scenario: full tunnel — product → cart → checkout → confirmation.
 */
export async function runPurchase(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[purchase][${site.name}]`;

  if (site.productSlugs.length === 0) {
    log(label, "no product slugs configured, skipping");
    return;
  }

  const slug = randomItem(site.productSlugs);
  const productUrl = buildUrl(`${site.baseUrl}/products/${slug}`, utmParams);

  log(label, `navigate → ${productUrl}`);
  if (dry) return;

  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1500, 3000);

  // Add to cart
  const atcBtn = page
    .locator("button")
    .filter({ hasText: /(add to cart|ajouter au panier)/i })
    .first();
  const btnVisible = await atcBtn.isVisible().catch(() => false);

  if (btnVisible) {
    log(label, "clicking add to cart");
    await safeClick(page, atcBtn);
    await randomDelay(600, 1500);
  } else {
    log(label, "add-to-cart not found — skipping purchase");
    return;
  }

  // Go to cart
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(800, 2000);

  // Proceed to checkout
  const checkoutLink = page
    .locator("a[href*='checkout'], button")
    .filter({ hasText: /checkout/i })
    .first();
  const checkoutVisible = await checkoutLink.isVisible().catch(() => false);
  if (checkoutVisible) {
    await safeClick(page, checkoutLink);
    await page.waitForURL("**/checkout**", { timeout: 8000 });
  } else {
    await page.goto(`${site.baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
  }

  await scrollPage(page);
  await randomDelay(1000, 2000);

  // Fill checkout form
  const name = randomItem(FAKE_NAMES);
  const card = randomItem(FAKE_CARDS);
  const email = randomItem(FAKE_EMAILS);

  log(label, "filling checkout form");

  async function fill(selector: string, value: string) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await safeClick(page, el);
      await randomDelay(100, 300);
      await el.fill(value);
      await randomDelay(200, 600);
    }
  }

  await fill("input[name='email'], input[type='email']", email);
  await fill("input[name='firstName']", name.first);
  await fill("input[name='lastName']", name.last);
  await fill("input[name='address']", "1 Void Street");
  await fill("input[name='city']", "Doomhaven");
  await fill("input[name='zip']", "00100");
  await fill("input[name='country']", "FR");
  await fill("input[name='cardNumber']", card.number);
  await fill("input[name='cardExpiry']", card.expiry);
  await fill("input[name='cardCvc']", card.cvc);

  await randomDelay(800, 2000);

  // Submit
  log(label, "submitting order");
  const submitBtn = page
    .locator("button[type='submit']")
    .first();
  const submitVisible = await submitBtn.isVisible().catch(() => false);

  if (submitVisible) {
    await safeClick(page, submitBtn);
    try {
      await page.waitForURL("**/confirmation**", { timeout: 10000 });
      log(label, "reached confirmation page ✓");
    } catch {
      log(label, "confirmation page not reached (may be expected with checkout_crash flag)");
    }
  }

  await randomDelay(1000, 2000);
  log(label, "done");
}
