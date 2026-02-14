/**
 * ============================================================================
 * TAILWIND CSS CONFIGURATION
 * ============================================================================
 * 
 * WHAT IS TAILWIND CSS?
 * ---------------------
 * Tailwind is a "utility-first" CSS framework. Instead of writing custom CSS
 * classes like `.my-button { padding: 1rem; color: blue; }`, you compose
 * designs using small utility classes directly in your JSX.
 * 
 * Example: <button className="px-4 py-2 bg-blue-500 text-white rounded">
 * 
 * WHY UTILITY-FIRST CSS FOR REACT?
 * ---------------------------------
 * 1. Component-scoped styling - styles are co-located with components
 * 2. No CSS naming conventions needed - no BEM, CSS Modules, etc.
 * 3. Smaller production CSS - unused styles are automatically removed
 * 4. Consistent design system - spacing, colors, typography all standardized
 * 5. Responsive design is trivial - just add md:, lg:, xl: prefixes
 * 6. No context switching - style directly in JSX, no separate CSS files
 * 
 * WHY USE IT FOR THIS PROJECT?
 * ----------------------------
 * - React components become self-contained styling units
 * - Rapid prototyping without writing custom CSS
 * - Easy to maintain and modify
 * - Great for learning - you see exactly what styles are applied
 * 
 * HOW THIS CONFIG WORKS:
 * ----------------------
 * - 'content' tells Tailwind which files to scan for class names
 * - 'theme.extend' lets you customize or add to the default design system
 * - Tailwind only generates CSS for classes you actually use (tree-shaking)
 */

/** @type {import('tailwindcss').Config} */
export default {
  // CONTENT: Files Tailwind should scan for class names
  // CRITICAL: If a file isn't listed here, its Tailwind classes won't work!
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",  // All JS/JSX files in src folder
  ],
  
  // THEME: Customize Tailwind's default design system
  theme: {
    extend: {
      // Add Inter font family
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      
      // Add custom animations for UI feedback
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      
      // Custom colors can be added here
      // colors: {
      //   'brand': '#6366f1',
      // },
    },
  },
  
  // PLUGINS: Third-party Tailwind plugins
  // Examples: @tailwindcss/forms, @tailwindcss/typography
  plugins: [],
}
