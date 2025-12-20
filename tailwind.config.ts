import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Cyberpunk fonts - Manrope for display, JetBrains Mono for body
        display: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        sans: ['var(--font-jetbrains-mono)', 'monospace'], // Override sans with mono for cyberpunk
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        // Explicit neon colors for direct use
        neon: {
          green: '#00ff88',
          magenta: '#ff00ff',
          cyan: '#00d4ff',
          red: '#ff3366',
        },
      },
      // Remove border-radius - cyberpunk uses clip-path chamfered corners
      borderRadius: {
        lg: '0px',
        md: '0px',
        sm: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '9999px', // Keep for traffic lights and circular elements
      },
      boxShadow: {
        'neon': '0 0 5px hsl(var(--primary)), 0 0 10px hsl(var(--primary) / 0.5)',
        'neon-lg': '0 0 5px hsl(var(--primary)), 0 0 10px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.1)',
        'neon-secondary': '0 0 5px hsl(var(--secondary)), 0 0 10px hsl(var(--secondary) / 0.5)',
        'neon-subtle': '0 0 2px hsl(var(--primary)), 0 0 5px hsl(var(--primary) / 0.3)',
        'neon-destructive': '0 0 5px hsl(var(--destructive)), 0 0 10px hsl(var(--destructive) / 0.5)',
      },
      keyframes: {
        'glitch': {
          '0%, 100%': {
            clipPath: 'inset(0 0 0 0)',
            transform: 'translate(0)',
          },
          '20%': {
            clipPath: 'inset(20% 0 30% 0)',
            transform: 'translate(-2px, 2px)',
          },
          '40%': {
            clipPath: 'inset(50% 0 20% 0)',
            transform: 'translate(2px, -1px)',
          },
          '60%': {
            clipPath: 'inset(10% 0 60% 0)',
            transform: 'translate(-1px, 1px)',
          },
          '80%': {
            clipPath: 'inset(70% 0 5% 0)',
            transform: 'translate(1px, -2px)',
          },
        },
        'neon-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 5px hsl(var(--primary)), 0 0 10px hsl(var(--primary) / 0.5)',
          },
          '50%': {
            boxShadow: '0 0 10px hsl(var(--primary)), 0 0 20px hsl(var(--primary) / 0.5), 0 0 30px hsl(var(--primary) / 0.3)',
          },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'glitch': 'glitch 0.3s ease-in-out',
        'glitch-loop': 'glitch 0.5s ease-in-out infinite',
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'scan': 'scan 2s linear infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
