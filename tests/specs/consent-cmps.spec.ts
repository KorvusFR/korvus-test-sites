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

// Helper revocation : pousse un js_error (event exempt, jamais consent-gated)
// pour forcer un flush apres une revocation. On ne peut pas utiliser
// pushPurchaseAndFlush car post-revoke le datalayer collector est detruit
// et le buffer est purge des events consent-gated → pas d'event a flusher
// → pas de batch → interceptor.getSession() retourne undefined. js_error
// est exempt CNIL et passe meme apres revoke, ce qui force un POST avec
// la session a jour (consent_status = "denied").
async function pushExemptErrorAndFlush(
  page: Page,
  interceptor: IngestInterceptor,
  marker: string,
): Promise<void> {
  await page.evaluate((msg: string) => {
    window.dispatchEvent(new ErrorEvent("error", {
      message: msg,
      filename: "post-revoke.js",
      lineno: 1,
      colno: 1,
      error: new Error(msg),
    }))
  }, marker)
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
        // Audit pré-prod 2026-04-25 (Bug C) — detectDidomi exige les APIs
        // notice + isConsentRequired pour distinguer pré-interaction de
        // refus explicite (anti-false-grant CNIL). Mock ici un user qui a
        // déjà interagi : isConsentRequired=true (consent applicable) +
        // notice fermée → on lit getUserConsentStatusForPurpose=true → grant.
        isConsentRequired: () => true,
        notice: { isVisible: () => false },
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
    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-CB")

    session = interceptor.getSession()
    expect(
      session?.consent_status,
      "Post-revoke : session.consent_status must be 'denied'",
    ).toBe("denied")
  })

  test("Cookiebot : granted → denied via CookiebotCallback_OnLoad (révocation cross-tab)", async ({
    page,
  }) => {
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

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-CB-ONLOAD")
    expect(
      interceptor.getSession()?.consent_status,
      "OnLoad cross-tab revocation must flip session.consent_status",
    ).toBe("denied")
  })

  test("OneTrust : granted → denied via OnConsentChanged callback", async ({
    page,
  }) => {
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

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.OnetrustActiveGroups = ",C0001,C0003,C0004," // C0002 retiré
      if (typeof w.__ot_changed_cb === "function") {
        w.__ot_changed_cb()
      }
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-OT")
    expect(
      interceptor.getSession()?.consent_status,
      "OneTrust OnConsentChanged revocation must flip session.consent_status",
    ).toBe("denied")
  })

  test("Didomi : granted → denied via on('consent.changed') callback", async ({
    page,
  }) => {
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
        // Audit pré-prod 2026-04-25 (Bug C) — detectDidomi exige les APIs
        // notice + isConsentRequired pour distinguer pré-interaction de
        // refus explicite (anti-false-grant CNIL). Mock ici un user qui a
        // déjà interagi : isConsentRequired=true + notice fermée → on lit
        // getUserConsentStatusForPurpose pour la décision finale.
        isConsentRequired: () => true,
        notice: { isVisible: () => false },
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

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__didomi.granted = false
      if (typeof w.__didomi.changeCb === "function") {
        w.__didomi.changeCb()
      }
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-DIDOMI")
    expect(
      interceptor.getSession()?.consent_status,
      "Didomi consent.changed revocation must flip session.consent_status",
    ).toBe("denied")
  })
})

// ============================================================================
// Refonte consent — Nouveaux CMPs (Tier 2 + Tier 3 + Tier 4 + Polling)
// ============================================================================
//
// Tests E2E pour les 13 nouveaux détecteurs ajoutés dans la refonte
// [consent.ts](../../../platform/snippet/src/consent.ts).
// Pattern identique aux tests B3/B7 : inject globals via addInitScript,
// push purchase, vérifie session.consent_status et passage du consent gate.

test.describe("Tier 2 — TCF v2 (IAB)", () => {
  test("TCF v2 granted — purpose 1+5 consentis", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__tcfapi = (cmd: string, _v: number, cb: (data: unknown, success: boolean) => void) => {
        if (cmd === "getTCData") {
          cb({
            gdprApplies: true,
            purpose: { consents: { 1: true, 2: true, 5: true, 7: true } },
          }, true)
        }
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TCF-GRANTED")

    const session = interceptor.getSession()
    expect(session?.consent_status).toBe("granted")
    const purchase = interceptor.getEvents("purchase").find(
      (e) => e.payload.transaction_id === "TX-TCF-GRANTED",
    )
    expect(purchase, "purchase should pass under TCF granted").toBeDefined()
  })

  test("TCF v2 denied — purpose 5 refusé", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__tcfapi = (cmd: string, _v: number, cb: (data: unknown, success: boolean) => void) => {
        if (cmd === "getTCData") {
          cb({
            gdprApplies: true,
            purpose: { consents: { 1: true, 5: false } },
          }, true)
        }
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TCF-DENIED")

    const session = interceptor.getSession()
    expect(session?.consent_status).not.toBe("granted")
    const purchase = interceptor.getEvents("purchase").find(
      (e) => e.payload.transaction_id === "TX-TCF-DENIED",
    )
    expect(purchase, "purchase should be blocked under TCF denied").toBeUndefined()
  })

  test("TCF v2 révocation mid-session via addEventListener", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__tcf_event_cb = null
      w.__tcfapi = (cmd: string, _v: number, cb: (data: unknown, success: boolean) => void) => {
        if (cmd === "getTCData") {
          cb({
            gdprApplies: true,
            purpose: { consents: { 1: true, 5: true } },
          }, true)
        } else if (cmd === "addEventListener") {
          w.__tcf_event_cb = cb
        }
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TCF-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // Revocation via TCF addEventListener
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      if (typeof w.__tcf_event_cb === "function") {
        w.__tcf_event_cb(
          {
            gdprApplies: true,
            eventStatus: "useractioncomplete",
            purpose: { consents: { 1: true, 5: false } },
          },
          true,
        )
      }
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-TCF")
    expect(
      interceptor.getSession()?.consent_status,
      "TCF revocation must flip consent_status",
    ).toBe("denied")
  })
})

test.describe("Tier 2 — Google Consent Mode v2", () => {
  test("Google Consent Mode granted via dataLayer consent entry", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer = [
        ["consent", "default", { analytics_storage: "denied", ad_storage: "denied" }],
        ["consent", "update", { analytics_storage: "granted" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-GCM-GRANTED")

    const session = interceptor.getSession()
    expect(session?.consent_status).toBe("granted")
    const purchase = interceptor.getEvents("purchase").find(
      (e) => e.payload.transaction_id === "TX-GCM-GRANTED",
    )
    expect(purchase, "purchase should pass under GCM granted").toBeDefined()
  })

  test("Google Consent Mode denied — analytics_storage: 'denied'", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer = [
        ["consent", "default", { analytics_storage: "denied" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-GCM-DENIED")

    const session = interceptor.getSession()
    expect(session?.consent_status).not.toBe("granted")
  })

  test("Google Consent Mode révocation via dataLayer.push", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer = [
        ["consent", "update", { analytics_storage: "granted" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-GCM-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // Revocation via dataLayer.push
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer.push(["consent", "update", { analytics_storage: "denied" }])
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-GCM")
    expect(
      interceptor.getSession()?.consent_status,
      "GCM revocation must flip consent_status",
    ).toBe("denied")
  })
})

test.describe("Tier 3 — Tarteaucitron", () => {
  test("Tarteaucitron granted — service analytics à true", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.tarteaucitron = {
        state: { "google-analytics": true, marketing: false },
        job: ["google-analytics"],
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TAC-GRANTED")

    expect(interceptor.getSession()?.consent_status).toBe("granted")
    expect(
      interceptor.getEvents("purchase").find(
        (e) => e.payload.transaction_id === "TX-TAC-GRANTED",
      ),
    ).toBeDefined()
  })

  test("Tarteaucitron denied — service analytics à false", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.tarteaucitron = {
        state: { "google-analytics": false },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TAC-DENIED")
    expect(interceptor.getSession()?.consent_status).not.toBe("granted")
  })

  test("Tarteaucitron révocation via tac.close_alert", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.tarteaucitron = {
        state: { analytics: true },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-TAC-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.tarteaucitron.state.analytics = false
      document.dispatchEvent(new Event("tac.close_alert"))
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-TAC")
    expect(interceptor.getSession()?.consent_status).toBe("denied")
  })
})

test.describe("Tier 3 — Usercentrics", () => {
  test("Usercentrics granted — analytics service consenti", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.UC_UI = {
        getServicesBaseInfo: () => [
          { name: "Google Analytics", categorySlug: "analytics", consent: { status: true } },
          { name: "Facebook Pixel", categorySlug: "marketing", consent: { status: false } },
        ],
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-UC-GRANTED")
    expect(interceptor.getSession()?.consent_status).toBe("granted")
  })

  test("Usercentrics denied — analytics service refusé", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.UC_UI = {
        getServicesBaseInfo: () => [
          { name: "Google Analytics", categorySlug: "analytics", consent: { status: false } },
        ],
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-UC-DENIED")
    expect(interceptor.getSession()?.consent_status).not.toBe("granted")
  })

  test("Usercentrics révocation via UC_UI_CMP_EVENT DENY_ALL", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.UC_UI = {
        getServicesBaseInfo: () => [
          { name: "Google Analytics", categorySlug: "analytics", consent: { status: true } },
        ],
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-UC-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("UC_UI_CMP_EVENT", {
        detail: { type: "DENY_ALL" },
      }))
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-UC")
    expect(interceptor.getSession()?.consent_status).toBe("denied")
  })
})

test.describe("Tier 3 — CookieYes (cookie-based)", () => {
  test("CookieYes granted via cookie analytics:yes", async ({ page, context }) => {
    await context.addCookies([{
      name: "cookieyes-consent",
      value: "consent:yes,analytics:yes,functional:yes",
      domain: "localhost",
      path: "/",
    }])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CY-GRANTED")
    expect(interceptor.getSession()?.consent_status).toBe("granted")
  })

  test("CookieYes denied via cookie analytics:no", async ({ page, context }) => {
    await context.addCookies([{
      name: "cookieyes-consent",
      value: "consent:yes,analytics:no,functional:yes",
      domain: "localhost",
      path: "/",
    }])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CY-DENIED")
    expect(interceptor.getSession()?.consent_status).not.toBe("granted")
  })

  test("CookieYes révocation via cookieyes_consent_update event", async ({ page, context }) => {
    await context.addCookies([{
      name: "cookieyes-consent",
      value: "consent:yes,analytics:yes",
      domain: "localhost",
      path: "/",
    }])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CY-REVOKE-BEFORE")
    expect(interceptor.getSession()?.consent_status).toBe("granted")

    interceptor.clear()

    // Update cookie and fire event
    await page.evaluate(() => {
      document.cookie = "cookieyes-consent=consent:yes,analytics:no; path=/"
      document.dispatchEvent(new Event("cookieyes_consent_update"))
    })
    await page.waitForTimeout(200)

    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-CY")
    expect(interceptor.getSession()?.consent_status).toBe("denied")
  })
})

test.describe("Tier 3 — Complianz (cookie-based)", () => {
  test("Complianz granted via cmplz_statistics=allow", async ({ page, context }) => {
    await context.addCookies([{
      name: "cmplz_statistics",
      value: "allow",
      domain: "localhost",
      path: "/",
    }])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CMPLZ-GRANTED")
    expect(interceptor.getSession()?.consent_status).toBe("granted")
  })

  test("Complianz denied via cmplz_statistics=deny", async ({ page, context }) => {
    await context.addCookies([{
      name: "cmplz_statistics",
      value: "deny",
      domain: "localhost",
      path: "/",
    }])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-CMPLZ-DENIED")
    expect(interceptor.getSession()?.consent_status).not.toBe("granted")
  })
})

// ============================================================================
// Polling — CMP qui charge tard
// ============================================================================

test.describe("Polling — CMP tardif", () => {
  test("CMP injecté 2s après boot → polling détecte et consent_status correct", async ({
    page,
  }) => {
    // No CMP at boot — snippet starts polling
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    // Verify initial state is unknown
    await interceptor.triggerFlush()
    const initialSession = interceptor.getSession()
    expect(
      initialSession?.consent_status,
      "Initial consent should be unknown (no CMP at boot)",
    ).toBe("unknown")

    interceptor.clear()

    // Inject CMP globals 2s after boot — polling should pick this up
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w._axcb = []
      w.axeptio_settings = { cookies: { google_analytics: true } }
    })

    // Wait for polling to detect (polls every 500ms)
    await page.waitForTimeout(1500)

    // Push purchase and flush
    await pushPurchaseAndFlush(page, interceptor, "TX-POLL-LATE")

    const session = interceptor.getSession()
    expect(
      session?.consent_status,
      "Polling should have detected late CMP → granted",
    ).toBe("granted")

    const purchase = interceptor.getEvents("purchase").find(
      (e) => e.payload.transaction_id === "TX-POLL-LATE",
    )
    expect(
      purchase,
      "purchase pushed after polling detection should pass consent gate",
    ).toBeDefined()
  })

  test("Aucun CMP → consent reste unknown après timeout polling", async ({
    page,
  }) => {
    // No CMP at all — polling should stop after 10s, consent stays unknown
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")

    // Wait for polling to finish (10s max)
    await page.waitForTimeout(12000)

    await interceptor.triggerFlush()
    const session = interceptor.getSession()
    expect(
      session?.consent_status,
      "No CMP detected → consent should stay unknown",
    ).toBe("unknown")
  })
})
