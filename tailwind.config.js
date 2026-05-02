export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#faf3e0",
          100: "#f5ead3",
          200: "#e8dcc0",
        },
        ink: {
          DEFAULT: "#3a2e1f",
          soft: "#5a4530",
          muted: "#8b6542",
        },
        terracotta: {
          DEFAULT: "#c4543a",
          dark: "#a4432e",
        },
        ochre: "#d49134",
        sage: "#5a7a3d",
        rose: "#e06a8a",
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
      },
      boxShadow: {
        stamp: "4px 4px 0 0 #3a2e1f",
        "stamp-lg": "6px 6px 0 0 #3a2e1f",
        "stamp-orange": "4px 4px 0 0 #c4543a",
        "stamp-orange-lg": "6px 6px 0 0 #c4543a",
        "stamp-sm": "2px 2px 0 0 #3a2e1f",
      },
    },
  },
  plugins: [],
};
