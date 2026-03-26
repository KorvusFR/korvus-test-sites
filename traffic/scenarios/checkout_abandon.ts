import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, safeClick } from "../utils";

/**
 * Checkout abandon scenario: adds product, goes to checkout, fills some fields and leaves.
 */
export async function runCheckoutAbandon(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[checkout_abandon][${site.name}]`;

  if (site.productSlugs.length === 0) return;

  const slug = randomItem(site.productSlugs);
  const productUrl = buildUrl(`${site.baseUrl}/products/${slug}`, utmParams);

  log(label, `navigate → ${productUrl}`);
  if (dry) return;

  // Visit Product
  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1000, 2500);

  // Add to Cart
  const atcBtn = page.locator("button").filter({ hasText: /(add to cart|ajouter au panier)/i }).first();
  if (await atcBtn.isVisible().catch(() => false)) {
    log(label, "clicking add to cart");
    await safeClick(page, atcBtn);
    await randomDelay(800, 1500);
  } else return;

  // Go to cart
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(800, 2000);

  // Checkout Link
  const checkoutLink = page.locator("a[href*='checkout'], button").filter({ hasText: /(checkout|passer commande)/i }).first();
  if (await checkoutLink.isVisible().catch(() => false)) {
    await safeClick(page, checkoutLink);
    await page.waitForURL("**/checkout**", { timeout: 8000 });
  } else {
    await page.goto(`${site.baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
  }

  await scrollPage(page);
  await randomDelay(1000, 2500);

  log(label, "filling partial checkout form (abandon)");
  const elEmail = page.locator("input[name='email'], input[type='email']").first();
  if (await elEmail.isVisible().catch(() => false)) {
    await safeClick(page, elEmail);
    await elEmail.fill("abandon@void.dev");
    await randomDelay(400, 800);
  }

  const elName = page.locator("input[name='firstName']").first();
  if (await elName.isVisible().catch(() => false)) {
    await safeClick(page, elName);
    await elName.fill("Abandoner");
    await randomDelay(1000, 3000);
  }

  log(label, "leaving checkout");
}
