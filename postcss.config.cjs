/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {
      theme: {
        extend: {
          colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            muted: 'var(--muted)',
            'muted-foreground': 'var(--muted-foreground)',
            popover: 'var(--popover)',
            'popover-foreground': 'var(--popover-foreground)',
            card: 'var(--card)',
            'card-foreground': 'var(--card-foreground)',
            border: 'var(--border)',
            input: 'var(--input)',
            primary: 'var(--primary)',
            'primary-foreground': 'var(--primary-foreground)',
            secondary: 'var(--secondary)',
            'secondary-foreground': 'var(--secondary-foreground)',
            accent: 'var(--accent)',
            'accent-foreground': 'var(--accent-foreground)',
            destructive: 'var(--destructive)',
            'destructive-foreground': 'var(--destructive-foreground)',
            ring: 'var(--ring)',
          },
          borderRadius: {
            DEFAULT: 'var(--radius)',
            md: 'var(--radius-md)',
            sm: 'var(--radius-sm)',
          },
          fontFamily: {
            inter: ['var(--font-inter)'],
          },
          transitionTimingFunction: {
            'ease-in-out': 'var(--timing-ease-in-out)',
          },
        },
      },
    },
    autoprefixer: {},
  },
};