import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * ============================================================================
 * VITE CONFIGURATION FOR REACT
 * ============================================================================
 * 
 * WHAT IS VITE?
 * -------------
 * Vite (French for "fast") is a modern build tool and development server.
 * It's significantly faster than traditional bundlers like Webpack.
 * 
 * WHY VITE FOR REACT?
 * -------------------
 * 1. Instant server start - no bundling in development
 * 2. Lightning-fast HMR (Hot Module Replacement)
 * 3. Out-of-box support for React, TypeScript, CSS, etc.
 * 4. Optimized production builds using Rollup
 * 5. Simple configuration compared to Webpack
 * 
 * HOW IT WORKS:
 * -------------
 * Development Mode (npm run dev):
 *   - Uses native ES modules (no bundling)
 *   - Browser requests modules on-demand
 *   - React Fast Refresh for instant updates
 * 
 * Production Mode (npm run build):
 *   - Bundles everything with Rollup
 *   - Tree-shaking, code-splitting, minification
 *   - Outputs optimized files to 'dist' folder
 */

export default defineConfig({
  // PLUGINS: Vite plugins to extend functionality
  plugins: [
    // React plugin provides:
    // - JSX transformation
    // - Fast Refresh (hot reload that preserves React state)
    // - Automatic JSX runtime (no need to import React in every file)
    react()
  ],
  
  // SERVER: Development server configuration
  server: {
    port: 3000,        // Dev server port
    open: true,        // Auto-open browser
    cors: true,        // Enable CORS for API calls
  },
  
  // BUILD: Production build configuration
  build: {
    outDir: 'dist',    // Output directory
    sourcemap: true,   // Generate source maps for debugging
  },
  
  // RESOLVE: Module resolution options
  resolve: {
    alias: {
      // Create '@' alias for src directory
      // Allows imports like: import Home from '@/pages/Home'
      '@': resolve(__dirname, './src'),
    },
  },
});
