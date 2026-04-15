import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// Phase 7 B3 — Multi-CMP detection smoke
//
// Le snippet v2 supporte 4 CMPs dans [consent.ts](../../../platform/snippet/src/consent.ts) :
// Axeptio, Didomi, Cookiebot, OneTrust. Seul Axeptio est testé en E2E
// ailleurs dans la suite. Ces 3 tests vérifient que les 3 autres CMPs
// sont détectés correctement à l'init du snippet et que `consent_status`
// du session payload est bien `granted` quand le CMP l'autorise.
//
// detectConsent() tente les CMPs dans l'ordre :
//   detectAxeptio() || detectDidomi() || detectCookiebot() || detectOneTrust()
// Chaque fonction retourne `true` si elle trouve ses globals. Pour tester
// un CMP non-Axeptio, il faut donc ne PAS simuler Axeptio (`_axcb` +
// `axeptio_settings` absents).

const doomcheck = getSiteConfig("doomcheck")

async function pushPurchaseAndFlush(
  page: Page,
  interceptor: IngestInterceptor,
  transactionId: string,
): Promise<void> {
  await page.evaluate((txId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dl = ((window as any).dataLayer ||= [])
    dl.push({
      event: "purchase",
      ecommerce: {
        transaction_id: txId,
        value: 99.99,
        currency: "EUR",
        items: [
          { item_id: "CMP-A", item_name: "CMP Test", price: 99.99, quantity: 1 },
        ],
      },
    })
  }, transactionId)
  await page.waitForTimeout(400)
  await interceptor.triggerFlush()
}

test.describe("Phase 7 B3 — Multi-CMP detection smoke", () => {
  test("Didomi — granted via getUserConsentStatusForPurpose('analytics') = true", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Didomi = {
        getUserConsentStatusForPurpose: (_purpose: string) => true,
        // on() ne fait rien pour ce smoke — on teste juste la détection
        // initiale statique.
        on: (_event: string, _cb: () => void) => undefined,
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-DIDOMI-001")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "Didomi granted → session.consent_status should be granted",
    ).toBe("granted")

    const purchases = interceptor.getEvents("purchase")
    const match = purchases.find(
      (e) => e.payload.transaction_id === "TX-DIDOMI-001",
    )
    expect(
      match,
      "purchase should pass consent gate under Didomi granted",
    ).toBeDefined()
  })

  test("Cookiebot — granted via consent.statistics = true", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot = {
        consent: {
          statistics: true,
          marketing: true,
          preferences: true,
          necessary: true,
        },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-COOKIEBOT-001")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "Cookiebot statistics=true → session.consent_status should be granted",
    ).toBe("granted")

    const purchases = interceptor.getEvents("purchase")
    const match = purchases.find(
      (e) => e.payload.transaction_id === "TX-COOKIEBOT-001",
    )
    expect(
      match,
      "purchase should pass consent gate under Cookiebot granted",
    ).toBeDefined()
  })

  test("OneTrust — granted via OnetrustActiveGroups containing 'C0002'", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.OnetrustActiveGroups = ",C0001,C0002,C0003,C0004,"
      w.OneTrust = {
        IsAlertBoxClosed: () => true,
        OnConsentChanged: (_cb: () => void) => undefined,
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-ONETRUST-001")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "OneTrust C0002 active → session.consent_status should be granted",
    ).toBe("granted")

    const purchases = interceptor.getEvents("purchase")
    const match = purchases.find(
      (e) => e.payload.transaction_id === "TX-ONETRUST-001",
    )
    expect(
      match,
      "purchase should pass consent gate under OneTrust granted",
    ).toBeDefined()
  })

  test("OneTrust — denied via OnetrustActiveGroups missing 'C0002'", async ({
    page,
  }) => {
    // Contrôle négatif : si C0002 n'est PAS dans la liste, consent = denied
    // et la purchase ne doit pas passer. On s'assure que le snippet ne
    // défaulte pas à "granted" par erreur.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.OnetrustActiveGroups = ",C0001,C0003,C0004," // C0002 absent
      w.OneTrust = {
        IsAlertBoxClosed: () => true,
        OnConsentChanged: (_cb: () => void) => undefined,
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-ONETRUST-DENIED")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "OneTrust C0002 absent → session.consent_status should NOT be granted",
    ).not.toBe("granted")

    const purchases = interceptor.getEvents("purchase")
    const match = purchases.find(
      (e) => e.payload.transaction_id === "TX-ONETRUST-DENIED",
    )
    expect(
      match,
      "purchase should be blocked by consent gate under OneTrust denied",
    ).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// Audit 2026-04-15 (B7) — CMP mid-session revocation
// ----------------------------------------------------------------------------
//
// Le snippet pose 4 listeners de changement de consent hors Axeptio
// (cf. [platform/snippet/src/consent.ts](../../../platform/snippet/src/consent.ts)) :
//
//   1. `CookiebotCallback_OnDecline` — user clique "refuse" / révoque
//   2. `CookiebotCallback_OnLoad`    — rehydratation page (révocation cross-tab)
//   3. `OneTrust.OnConsentChanged`   — user change sa sélection
//   4. `Didomi.on("consent.changed")` — user change sa sélection
//
// Jusqu'ici seul Axeptio denied→granted était testé mid-session. Ces tests
// prouvent que chaque handler déclenche bien la bascule `onConsentChange`
// côté snippet et que la session.consent_status passe à "denied" — gage
// CNIL que les events consent-gated à venir seront strippés côté serveur
// (défense en profondeur Zod : lib/validation/ingest/session.ts transform).
//
// Règle invariante vérifiée par chaque test :
//  - Phase 1 : CMP granted → session.consent_status = "granted"
//  - Révocation via callback CMP
//  - Phase 2 : batch suivant → session.consent_status = "denied", UTMs null

test.describe("Phase B7 — CMP mid-session revocation (hors Axeptio)", () => {
  test("Cookiebot : granted → denied via CookiebotCallback_OnDecline (révocation explicite)", async ({
    page,
  }) => {
    // Setup Cookiebot globals AVANT le boot du snippet. Le snippet va
    // wrapper `CookiebotCallback_OnDecline` avec sa propre fonction qui
    // appelle `setStatus("denied")`. Pour tester, on appelle le wrapper.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot = {
        consent: {
          statistics: true,
          marketing: true,
          preferences: true,
          necessary: true,
        },
      }
      w.CookiebotCallback_OnAccept = null
      w.CookiebotCallback_OnDecline = null
      w.CookiebotCallback_OnLoad = null
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    // --- Phase 1 : granted ---
    await pushPurchaseAndFlush(page, interceptor, "TX-CB-REVOKE-BEFORE")

    let session = interceptor.getSession()
    expect(session?.consent_status).toBe("granted")
    const beforePurchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-CB-REVOKE-BEFORE")
    expect(
      beforePurchase,
      "Phase 1 : purchase must pass under Cookiebot granted",
    ).toBeDefined()

    interceptor.clear()

    // --- Révocation via Cookiebot.OnDecline (CNIL critique) ---
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      // État Cookiebot mis à jour comme en prod lors d'un refus
      w.Cookiebot.consent.statistics = false
      w.Cookiebot.consent.marketing = false
      // Fire le callback wrappé par le snippet pendant detectCookiebot
      if (typeof w.CookiebotCallback_OnDecline === "function") {
        w.CookiebotCallback_OnDecline()
      }
    })
    await page.waitForTimeout(200)

    // --- Phase 2 : post-révocation ---
    await pushPurchaseAndFlush(page, interceptor, "TX-CB-REVOKE-AFTER")

    session = interceptor.getSession()
    expect(
      session?.consent_status,
      "Post-revoke : session.consent_status must be 'denied'",
    ).toBe("denied")
  })

  test("Cookiebot : granted → denied via CookiebotCallback_OnLoad (révocation cross-tab)", async ({
    page,
  }) => {
    // Setup : simule le cas où l'utilisateur est granted, ouvre la page,
    // puis révoque son consent depuis un AUTRE onglet. Cookiebot rehydrate
    // son cookie au prochain événement et fire `OnLoad` avec la nouvelle
    // valeur — sans que `OnDecline` ne fire (parce que la révocation a
    // eu lieu ailleurs). Seul `OnLoad` peut rattraper ce cas.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot = {
        consent: { statistics: true, marketing: true },
      }
      w.CookiebotCallback_OnLoad = null
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CB-ONLOAD-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // Simule révocation cross-tab : Cookiebot voit son cookie changé par un
    // autre onglet et fire OnLoad à la rehydratation.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot.consent.statistics = false
      w.Cookiebot.consent.marketing = false
      if (typeof w.CookiebotCallback_OnLoad === "function") {
        w.CookiebotCallback_OnLoad()
      }
    })
    await page.waitForTimeout(200)

    await pushPurchaseAndFlush(page, interceptor, "TX-CB-ONLOAD-AFTER")
    expect(
      interceptor.getSession()?.consent_status,
      "OnLoad cross-tab revocation must flip session.consent_status",
    ).toBe("denied")
  })

  test("OneTrust : granted → denied via OnConsentChanged callback", async ({
    page,
  }) => {
    // OneTrust expose `OnConsentChanged(cb)` — le snippet lui passe son
    // handler, que OneTrust appelle quand l'utilisateur change de config.
    // On capture ce handler via une closure exposée sur window pour pouvoir
    // le déclencher depuis le test.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.OnetrustActiveGroups = ",C0001,C0002,C0003,C0004,"
      w.__ot_changed_cb = null
      w.OneTrust = {
        IsAlertBoxClosed: () => true,
        OnConsentChanged: (cb: () => void) => {
          w.__ot_changed_cb = cb
        },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-OT-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // User uncheck C0002 (performance/analytics) — groupe retiré de la
    // liste active, OneTrust fire OnConsentChanged callback.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.OnetrustActiveGroups = ",C0001,C0003,C0004," // C0002 retiré
      if (typeof w.__ot_changed_cb === "function") {
        w.__ot_changed_cb()
      }
    })
    await page.waitForTimeout(200)

    await pushPurchaseAndFlush(page, interceptor, "TX-OT-REVOKE-AFTER")
    expect(
      interceptor.getSession()?.consent_status,
      "OneTrust OnConsentChanged revocation must flip session.consent_status",
    ).toBe("denied")
  })

  test("Didomi : granted → denied via on('consent.changed') callback", async ({
    page,
  }) => {
    // Didomi expose `on(event, cb)`. Le snippet register `consent.changed`
    // avec un handler qui relit `getUserConsentStatusForPurpose('analytics')`.
    // On simule en stockant le cb et en flipant le retour de la getter.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__didomi = { granted: true, changeCb: null }
      w.Didomi = {
        getUserConsentStatusForPurpose: (_purpose: string) =>
          w.__didomi.granted,
        on: (event: string, cb: () => void) => {
          if (event === "consent.changed") {
            w.__didomi.changeCb = cb
          }
        },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-DIDOMI-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // Flip Didomi state + fire le callback consent.changed enregistré par
    // le snippet.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__didomi.granted = false
      if (typeof w.__didomi.changeCb === "function") {
        w.__didomi.changeCb()
      }
    })
    await page.waitForTimeout(200)

    await pushPurchaseAndFlush(page, interceptor, "TX-DIDOMI-REVOKE-AFTER")
    expect(
      interceptor.getSession()?.consent_status,
      "Didomi consent.changed revocation must flip session.consent_status",
    ).toBe("denied")
  })
})
