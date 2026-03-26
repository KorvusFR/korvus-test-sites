import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        doom: {
          950: "#05050a",
          900: "#0a0a0f",
          800: "#0f0f1a",
          700: "#1a1a2e",
          600: "#252540",
          500: "#3a3a5c",
          400: "#6e6e99",
          red: "#ff2d55",
          green: "#39ff14",
        },
      },
      fontFamily: {
        mono: ["'Share Tech Mono'", "Courier New", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        glitch: "glitch 0.4s infinite",
        scanline: "scanline 6s linear infinite",
      },
      keyframes: {
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "25%": { transform: "translate(-2px, 1px)" },
          "50%": { transform: "translate(2px, -1px)" },
          "75%": { transform: "translate(-1px, 2px)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
