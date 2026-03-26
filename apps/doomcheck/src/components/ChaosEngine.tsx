"use client";

import { useEffect } from "react";

const CHAOS_FLAGS = (process.env.NEXT_PUBLIC_CHAOS_FLAGS ?? "")
  .split(",")
  .map((f) => f.trim());

export function ChaosEngine() {
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("js_error")) return;

    const interval = setInterval(() => {
      throw new Error(
        "[doomcheck chaos] js_error: simulated uncaught JS exception"
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
