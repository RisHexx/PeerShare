/**
 * ============================================================================
 * POSTCSS CONFIGURATION
 * ============================================================================
 * 
 * WHAT IS POSTCSS?
 * ----------------
 * PostCSS is a CSS transformer powered by JavaScript plugins.
 * Think of it as a pipeline: CSS goes in → plugins transform it → final CSS out
 * 
 * WHY DO WE NEED IT?
 * ------------------
 * Tailwind CSS is actually a PostCSS plugin! When you write:
 *   @tailwind base;
 *   @tailwind components;
 *   @tailwind utilities;
 * 
 * PostCSS (with Tailwind plugin) transforms these into actual CSS
 * containing all the utility classes your project uses.
 * 
 * PLUGINS IN THIS CONFIG:
 * -----------------------
 * 1. tailwindcss - Generates utility classes from @tailwind directives
 * 2. autoprefixer - Adds browser prefixes for compatibility
 *    Example: 'display: flex' → 'display: -webkit-flex; display: flex;'
 * 
 * HOW IT INTEGRATES WITH VITE:
 * ----------------------------
 * Vite automatically detects this postcss.config.js file and uses it
 * when processing CSS files. Zero additional configuration needed!
 */

export default {
  plugins: {
    // Tailwind CSS - processes @tailwind directives into actual CSS
    tailwindcss: {},
    
    // Autoprefixer - adds vendor prefixes for cross-browser support
    autoprefixer: {},
  },
}
