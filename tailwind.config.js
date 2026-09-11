/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'primary-red': '#D4380D',
        'shakti-purple': '#722ED1',
        saffron: '#FA8C16',
        'forest-green': '#389E0D',
        'off-white': '#F5F5F5',
        ink: '#141414',
        stone: '#595959',
        'error-red': '#CF1322',
        'near-black': '#0A0A0A',
        charcoal: '#1A1A1A',
      },
      fontFamily: {
        // Android-only fallback so Devanagari text (hi/mr) never renders as
        // boxes/tofu on system fonts that lack full Devanagari coverage.
        // iOS is untouched — its system font already covers Devanagari.
        'devanagari-regular': ['NotoSansDevanagari_400Regular'],
        'devanagari-semibold': ['NotoSansDevanagari_600SemiBold'],
        'devanagari-bold': ['NotoSansDevanagari_700Bold'],
      },
    },
  },
  plugins: [],
};
