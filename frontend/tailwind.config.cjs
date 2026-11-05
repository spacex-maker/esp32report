/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        board: {
          50: "#f0f7f6",
          100: "#d9ebe9",
          200: "#b3d6d2",
          300: "#7fb8b1",
          400: "#4d968e",
          500: "#2f7a72",
          600: "#24615c",
          700: "#1f4e4a",
          800: "#1b403d",
          900: "#183633",
        },
        ink: {
          50: "#f3f5f7",
          100: "#e4e8ed",
          200: "#c9d1db",
          700: "#3d4654",
          800: "#232a35",
          900: "#12161d",
        },
        copper: {
          400: "#d4a574",
          500: "#c4894a",
          600: "#a66f35",
        },
      },
      backgroundImage: {
        "console-mesh":
          "radial-gradient(ellipse 80% 50% at 10% 0%, rgba(47,122,114,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(196,137,74,0.12), transparent 50%), linear-gradient(165deg, #eef2f4 0%, #e2e8ec 45%, #d5dde3 100%)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.85)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
