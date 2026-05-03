/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 20px 70px rgba(45, 212, 191, 0.16)"
      }
    }
  },
  plugins: []
};
