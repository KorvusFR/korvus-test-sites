"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { gtmPageView } from "@/lib/gtm";

/**
 * Pushes a `page_view` event to the dataLayer on every route change.
 * Must be wrapped in <Suspense> in the layout because useSearchParams
 * requires it in Next.js App Router.
 */
export function GTMPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    gtmPageView(url, document.title);
  }, [pathname, searchParams]);

  return null;
}
