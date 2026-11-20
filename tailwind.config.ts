import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f7f3ea",
        ink: "#2b2622",
        accent: "#b4532a",
      },
      fontFamily: {
        serif: ["\"Noto Serif SC\"", "\"Songti SC\"", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
