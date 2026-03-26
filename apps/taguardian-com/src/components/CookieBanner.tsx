"use client";

import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pushDataLayer } from "@/lib/gtm";

const CONSENT_KEY = "taguardian_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState | "loading">("loading");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY) as ConsentState | null;
      setConsent(stored);
    } catch {
      setConsent(null);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    pushDataLayer("cookie_consent", { consent_status: "accepted" });
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
    pushDataLayer("cookie_consent", { consent_status: "declined" });
  }

  // Don't render until we've read localStorage
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5"
    >
      <div className="flex items-start gap-3">
        <Cookie className="w-5 h-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
            We use cookies
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            We use analytics and functional cookies to improve your experience.
            You can accept all cookies or decline non-essential ones. See our{" "}
            <span className="underline cursor-default">Cookie Policy</span> for details.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={accept}>
              Accept all
            </Button>
            <Button size="sm" variant="outline" onClick={decline}>
              Decline
            </Button>
          </div>
        </div>
        <button
          onClick={decline}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
