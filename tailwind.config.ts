import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        serif: ["DM Serif Display", "serif"],
      },
      colors: {
        nictm: {
          950: "#0F2518",
          900: "#1B3D2B",
          800: "#2A5440",
          700: "#3D7055",
          600: "#528F6E",
          200: "#A8CFBB",
          100: "#D6EDE1",
          50:  "#EDF7F1",
          gold:  "#B8960C",
          "gold-m": "#C9A827",
          "gold-l": "#F9F3DC",
        },
      },
    },
  },
  plugins: [],
};
export default config;
