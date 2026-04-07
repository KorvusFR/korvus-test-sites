"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Cookie } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pushDataLayer } from "@/lib/gtm";

declare global {
  interface Window {
    __korvusCMP?: {
      accept: () => void;
      decline: () => void;
      getStatus: () => "accepted" | "declined" | null;
    };
  }
}

const CONSENT_KEY = "doomcheck_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState | "loading">("loading");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY) as ConsentState;
      setConsent(stored);
    } catch {
      setConsent(null);
    }
  }, []);

  const accept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    pushDataLayer("cookie_consent", { consent_status: "accepted" });
  }, []);

  const decline = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
    pushDataLayer("cookie_consent", { consent_status: "declined" });
  }, []);

  // Register window.__korvusCMP
  useEffect(() => {
    window.__korvusCMP = {
      accept,
      decline,
      getStatus: () => {
        try {
          return localStorage.getItem(CONSENT_KEY) as ConsentState;
        } catch {
          return null;
        }
      },
    };
  }, [accept, decline]);

  // Don't render until we've read localStorage
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-doom-800 border border-doom-700 rounded-2xl shadow-2xl p-5"
    >
      <div className="flex items-start gap-3">
        <Cookie className="w-5 h-5 text-doom-red flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-slate-100 text-sm mb-1">
            We use cookies
          </h3>
          <p className="text-xs text-doom-400 leading-relaxed mb-4">
            Analytics and functional cookies to monitor your experience.
            Accept all or decline non-essential ones.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={accept}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={decline}>
              Decline
            </Button>
          </div>
        </div>
        <button
          onClick={decline}
          className="text-doom-400 hover:text-slate-200 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
