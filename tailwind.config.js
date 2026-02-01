module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Bosch Corporate Colors
        bosch: {
          red: '#D80E29',       // Bosch Red
          lightRed: '#FF4759',  // Lighter accent
          darkRed: '#A60017',   // Darker shade

          blue: '#005691',      // Bosch Blue
          lightBlue: '#1F8EE6', // Light Blue
          darkBlue: '#003A63',  // Dark Blue

          teal: '#008ECF',      // Light Blue / Teal-ish
          green: '#78BE20',     // Bosch Green

          gray: {
            50: '#F5F5F7',
            100: '#E0E2E5',
            200: '#C1C7CC',
            300: '#A4ABB3',
            400: '#87909A',
            500: '#6A7581',
            600: '#4E5B68',
            700: '#32414F',
            800: '#152736',
            900: '#000000', // Almost black
          }
        }
      },
      fontFamily: {
        // Bosch typically uses "Bosch Sans", but we will use standard sans fallback 
        // that looks clean and professional.
        sans: ['"Bosch Sans"', 'Helvetica Neue', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
