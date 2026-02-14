/**
 * ============================================================================
 * PROGRESSBAR.JSX - Reusable Progress Bar Component
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * Displays a progress bar with percentage and optional details.
 * Used for showing file transfer progress.
 * 
 * WHY A SEPARATE COMPONENT?
 * -------------------------
 * - Reusable across Send and Receive pages
 * - Single source of truth for progress bar styling
 * - Easy to modify/enhance in one place
 * - Follows React component composition pattern
 * 
 * PROPS:
 * ------
 * - percent: Number 0-100, the progress percentage
 * - label: String, label text (e.g., "Sending...")
 * - detail: String, detail text (e.g., "5.2 MB / 10.4 MB")
 * 
 * TAILWIND CLASSES EXPLAINED:
 * ---------------------------
 * The progress bar uses these techniques:
 * - bg-gray-700: Dark background track
 * - overflow-hidden: Clips the inner bar within rounded container
 * - transition-all: Smooth width changes
 * - bg-gradient-to-r: Gradient fill for visual appeal
 */

/**
 * ProgressBar Component
 * 
 * WHAT: Renders a progress bar with label and percentage
 * WHY: Provides visual feedback during file transfer
 * HOW: Uses Tailwind utilities for styling, inline style for width
 * 
 * @param {Object} props - Component props
 * @param {number} props.percent - Progress percentage (0-100)
 * @param {string} [props.label] - Optional label text
 * @param {string} [props.detail] - Optional detail text (e.g., bytes transferred)
 * @returns {JSX.Element} The progress bar
 */
function ProgressBar({ percent = 0, label = '', detail = '' }) {
  // Ensure percent is within valid range
  const clampedPercent = Math.min(100, Math.max(0, percent));
  
  return (
    <div className="w-full">
      {/**
        * HEADER ROW
        * ----------
        * Shows label on left, percentage on right
        * flex justify-between: Space them apart
        */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium" style={{ color: '#9A3E3E' }}>{clampedPercent}%</span>
      </div>
      
      {/**
        * PROGRESS BAR TRACK
        * ------------------
        * The background that the fill sits on.
        * 
        * - bg-gray-200: Light track color
        * - rounded-full: Pill shape
        * - h-2: Height of the bar
        * - overflow-hidden: Clips the fill to rounded corners
        */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        {/**
          * PROGRESS BAR FILL
          * -----------------
          * The colored portion showing progress.
          * 
          * - h-full: Takes full height of parent
          * - No gradient - solid color for minimal look
          * - rounded-full: Rounded ends
          * - transition-all duration-300: Smooth width animation
          * - ease-out: Easing function for natural feel
          * 
          * Width is set via inline style because it's dynamic.
          * Tailwind doesn't have classes for arbitrary percentages.
          */}
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedPercent}%`, backgroundColor: '#9A3E3E' }}
        />
      </div>
      
      {/**
        * DETAIL TEXT
        * -----------
        * Shows additional info like "5.2 MB / 10.4 MB"
        * Only renders if detail prop is provided
        */}
      {detail && (
        <div className="text-center mt-2 text-gray-500 text-sm">
          {detail}
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
