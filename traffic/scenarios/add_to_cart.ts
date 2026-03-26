import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, safeClick } from "../utils";

/**
 * Add-to-cart scenario: browses a product, adds it to cart, then abandons.
 */
export async function runAddToCart(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[add_to_cart][${site.name}]`;

  const slug = randomItem(
    site.productSlugs.length > 0 ? site.productSlugs : [""]
  );
  const productUrl = buildUrl(
    `${site.baseUrl}/products/${slug}`,
    utmParams
  );

  log(label, `navigate → ${productUrl}`);
  if (dry) return;

  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1500, 3500);

  // Click add to cart button
  const atcBtn = page
    .locator("button")
    .filter({ hasText: /(add to cart|ajouter au panier)/i })
    .first();
  const btnVisible = await atcBtn.isVisible().catch(() => false);

  if (btnVisible) {
    log(label, "clicking add to cart");
    await safeClick(page, atcBtn);
    await randomDelay(500, 1500);
  } else {
    log(label, "add-to-cart button not found, skipping");
  }

  // Navigate to cart
  await randomDelay(800, 2000);
  await page.goto(buildUrl(`${site.baseUrl}/cart`, {}), {
    waitUntil: "domcontentloaded",
  });
  await scrollPage(page);

  // Abandon — close without checking out
  log(label, "abandoning cart");
  await randomDelay(1000, 3000);
  log(label, "done");
}
