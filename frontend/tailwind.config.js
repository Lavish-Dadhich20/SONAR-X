/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sonar: {
          bg: "#080c14",
          surface: "#0e1524",
          card: "#131c2e",
          border: "#1e2b45",
          borderLight: "#2a3b5c",
          cyan: "#00d4ff",
          cyanMuted: "rgba(0, 212, 255, 0.15)",
          cyanGlow: "rgba(0, 212, 255, 0.35)",
          text: "#f1f5f9",
          muted: "#849ab8",
          dim: "#475d7a",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        }
      },
      animation: {
        sweep: 'sweep 4s linear infinite',
        pulseSubtle: 'pulseSubtle 2.5s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
