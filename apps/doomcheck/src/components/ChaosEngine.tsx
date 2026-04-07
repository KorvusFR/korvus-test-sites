"use client";

import { useEffect } from "react";

const CHAOS_FLAGS = (process.env.NEXT_PUBLIC_CHAOS_FLAGS ?? "")
  .split(",")
  .map((f) => f.trim());

export function ChaosEngine() {
  // js_error — throw uncaught exception every 30s
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("js_error")) return;

    const interval = setInterval(() => {
      throw new Error(
        "[doomcheck chaos] js_error: simulated uncaught JS exception"
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // request_error_500 — fetch /api/chaos/error (returns 500)
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("request_error_500")) return;

    fetch("/api/chaos/error").catch(() => {});
  }, []);

  // request_timeout — fetch /api/chaos/timeout (responds after 15s)
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("request_timeout")) return;

    fetch("/api/chaos/timeout").catch(() => {});
  }, []);

  // ux_error — inject alert div after 3s
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("ux_error")) return;

    const timer = setTimeout(() => {
      const div = document.createElement("div");
      div.className = "alert alert-danger";
      div.setAttribute("role", "alert");
      div.textContent = "Une erreur est survenue, veuillez réessayer";
      document.body.appendChild(div);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // layout_shift — inject 300px div at top of body after 2s
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("layout_shift")) return;

    const timer = setTimeout(() => {
      const div = document.createElement("div");
      div.style.height = "300px";
      div.style.background = "linear-gradient(135deg, #1a0a0a, #2d0000)";
      div.style.width = "100%";
      document.body.insertBefore(div, document.body.firstChild);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // broken_img — inject image with broken src (404 → resource_error)
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("broken_img")) return;

    const img = document.createElement("img");
    img.src = "/nonexistent-chaos.jpg";
    img.alt = "chaos broken image";
    img.style.position = "fixed";
    img.style.bottom = "0";
    img.style.right = "0";
    img.style.width = "1px";
    img.style.height = "1px";
    img.style.opacity = "0.01";
    document.body.appendChild(img);

    return () => {
      img.remove();
    };
  }, []);

  // hidden_alert — inject hidden alert div (ux_error on hidden elements)
  useEffect(() => {
    if (!CHAOS_FLAGS.includes("hidden_alert")) return;

    const div = document.createElement("div");
    div.className = "alert alert-danger";
    div.style.display = "none";
    div.textContent = "Hidden error";
    document.body.appendChild(div);

    return () => {
      div.remove();
    };
  }, []);

  return null;
}
