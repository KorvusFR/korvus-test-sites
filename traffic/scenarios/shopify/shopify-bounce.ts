import type { Page } from "playwright";
import type { SiteConfig } from "../../config";
import { buildUrl, scrollPage, randomDelay, log, handleShopifyPassword } from "../../utils";

/**
 * Shopify bounce: home page → minimal scroll → immediate exit.
 */
export async function runShopifyBounce(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[shopify-bounce][${site.name}]`;

  const homeUrl = buildUrl(site.baseUrl, utmParams);
  log(label, `navigate → ${homeUrl}`);
  if (dry) return;

  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
  await handleShopifyPassword(page, "rtewng");
  await scrollPage(page);
  await randomDelay(800, 2000);

  log(label, "done");
}
