/**
 * ============================================================================
 * MAIN.JSX - React Application Entry Point
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * --------------------
 * This is the entry point where React mounts to the DOM.
 * It's referenced in index.html and processed by Vite.
 * 
 * WHAT HAPPENS HERE:
 * ------------------
 * 1. Import React and ReactDOM
 * 2. Import global CSS (Tailwind)
 * 3. Import root App component
 * 4. Mount React to the #root DOM element
 * 
 * WHY StrictMode?
 * ---------------
 * React.StrictMode is a development tool that:
 * - Detects unsafe lifecycle methods
 * - Warns about deprecated APIs
 * - Identifies potential problems
 * - Double-invokes certain functions to detect side effects
 * 
 * Note: StrictMode only runs in development, not production!
 * 
 * WHY createRoot (React 18+)?
 * ---------------------------
 * createRoot enables:
 * - Concurrent rendering features
 * - Automatic batching of state updates
 * - Better Suspense support
 * - Improved performance through transitions
 * 
 * This replaces the deprecated ReactDOM.render() from React 17.
 */

// React core library - provides hooks, components, context, etc.
import React from 'react';

// ReactDOM for web - provides methods to render React to the DOM
import ReactDOM from 'react-dom/client';

// Global CSS including Tailwind - must be imported to be processed
import './index.css';

// Root App component - contains the entire application
import App from './App';

/**
 * APPLICATION BOOTSTRAP
 * ---------------------
 * 
 * document.getElementById('root')
 *   - Finds the <div id="root"> in index.html
 *   - This is where React will mount
 * 
 * ReactDOM.createRoot(...)
 *   - Creates a React root for concurrent features
 *   - Returns an object with a render() method
 * 
 * .render(<App />)
 *   - Renders the App component into the root
 *   - React takes over managing the DOM from here
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode wrapper for development checks
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log startup message for debugging
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  WebRTC File Share - React Frontend                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Built with:                                                   ║
║  • React 18 + React Router                                     ║
║  • Vite (build tool)                                           ║
║  • Tailwind CSS (styling)                                      ║
║  • WebRTC (peer-to-peer transfer)                              ║
╚═══════════════════════════════════════════════════════════════╝
`);
