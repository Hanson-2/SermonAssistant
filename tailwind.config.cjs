/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'w-4', 'w-3', 'w-1',
    'h-1.5', 'h-1',
    'bg-gradient-to-r',
    'from-blue-500', 'to-blue-400',
    'from-gray-400', 'to-gray-300',
    'ring-1', 'ring-white',
    'shadow',
    'hover:scale-125',
    'transition-all',
    'duration-200',
    'cursor-pointer',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
