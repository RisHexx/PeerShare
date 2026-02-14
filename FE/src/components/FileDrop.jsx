/**
 * ============================================================================
 * FILEDROP.JSX - Drag and Drop File Selection Component
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * Provides a zone for file selection via:
 * - Drag and drop
 * - Click to open file picker
 * 
 * WHY A SEPARATE COMPONENT?
 * -------------------------
 * - Complex interaction logic deserves encapsulation
 * - Could be reused in other file-related features
 * - Keeps Send.jsx cleaner and more focused
 * - Easy to test in isolation
 * 
 * PROPS:
 * ------
 * - onFileSelect: Callback function called with selected File
 * - selectedFile: Currently selected file (for display)
 * - disabled: Whether the component is disabled
 * 
 * HOW DRAG AND DROP WORKS:
 * ------------------------
 * HTML5 Drag and Drop API events:
 * 1. dragenter: Mouse enters drop zone
 * 2. dragover: Mouse is over drop zone (must preventDefault!)
 * 3. dragleave: Mouse leaves drop zone
 * 4. drop: File is dropped
 * 
 * The key is calling event.preventDefault() on dragover,
 * otherwise the browser will try to open the file.
 * 
 * REACT PATTERNS USED:
 * --------------------
 * - useRef: For hidden file input reference
 * - useState: For drag-over visual state
 * - useCallback: Memoized event handlers
 */

import { useState, useRef, useCallback } from 'react';
import { formatBytes } from '../webrtc';

/**
 * FileDrop Component
 * 
 * WHAT: Renders a drag-and-drop zone for file selection
 * WHY: Provides intuitive file selection UX
 * HOW: Uses HTML5 Drag and Drop API + hidden file input
 * 
 * @param {Object} props - Component props
 * @param {function} props.onFileSelect - Called with File when selected
 * @param {File} [props.selectedFile] - Currently selected file
 * @param {boolean} [props.disabled] - Whether input is disabled
 * @returns {JSX.Element} The file drop zone
 */
function FileDrop({ onFileSelect, selectedFile = null, disabled = false }) {
  // ========================================================================
  // STATE
  // ========================================================================
  
  /**
   * isDragging: True when a file is being dragged over the drop zone.
   * Used for visual feedback (highlighting the drop zone).
   */
  const [isDragging, setIsDragging] = useState(false);
  
  // ========================================================================
  // REFS
  // ========================================================================
  
  /**
   * Reference to the hidden file input element.
   * We click this programmatically when user clicks the drop zone.
   */
  const fileInputRef = useRef(null);
  
  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  /**
   * Handles drag enter event
   * 
   * WHAT: Called when dragged item enters the drop zone
   * WHY: To show visual feedback that dropping is possible here
   * HOW: Sets isDragging state to true
   */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);
  
  /**
   * Handles drag over event
   * 
   * WHAT: Called continuously while dragging over the zone
   * WHY: MUST call preventDefault() to allow dropping!
   * HOW: Prevents default browser behavior (opening file)
   * 
   * Without this, the browser would navigate to the file.
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  /**
   * Handles drag leave event
   * 
   * WHAT: Called when dragged item leaves the drop zone
   * WHY: To remove visual feedback
   * HOW: Sets isDragging state to false
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  /**
   * Handles drop event
   * 
   * WHAT: Called when a file is dropped on the zone
   * WHY: To capture the dropped file
   * HOW: Gets file from event.dataTransfer.files
   * 
   * dataTransfer contains the dragged data - in this case, files.
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled) return;
    
    // Get files from the drop event
    const files = e.dataTransfer?.files;
    
    if (files && files.length > 0) {
      // We only support single file transfer, take the first one
      const file = files[0];
      console.log('[FileDrop] File dropped:', file.name);
      onFileSelect(file);
    }
  }, [disabled, onFileSelect]);
  
  /**
   * Handles click on the drop zone
   * 
   * WHAT: Opens the file picker dialog
   * WHY: Alternative to drag & drop for accessibility
   * HOW: Clicks the hidden file input
   */
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);
  
  /**
   * Handles file selection from the file input
   * 
   * WHAT: Called when user selects a file from the picker
   * WHY: To capture the selected file
   * HOW: Gets file from input.files
   */
  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    
    if (files && files.length > 0) {
      const file = files[0];
      console.log('[FileDrop] File selected:', file.name);
      onFileSelect(file);
    }
    
    // Reset the input so same file can be selected again
    e.target.value = '';
  }, [onFileSelect]);
  
  /**
   * Handles "Change file" button click
   * 
   * WHAT: Allows changing the selected file
   * WHY: User might want to select a different file
   * HOW: Triggers the file input click
   */
  const handleChangeFile = useCallback((e) => {
    e.stopPropagation(); // Don't trigger the main click handler
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    /**
     * DROP ZONE CONTAINER
     * -------------------
     * The main interactive area.
     * 
     * Tailwind classes:
     * - border-2 border-dashed: Dashed border for drop zone affordance
     * - cursor-pointer: Shows clickability
     * - transition-all: Smooth state changes
     * 
     * Conditional classes based on state:
     * - isDragging: Highlight border when dragging over
     * - disabled: Gray out when disabled
     */
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging 
          ? 'border-gray-400 bg-gray-50' 
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : ''
        }
      `}
    >
      {/**
        * EMPTY STATE (No file selected)
        * ------------------------------
        * Shows when no file has been selected yet.
        */}
      {!selectedFile && (
        <div>
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-700 font-medium mb-1">
            Drag & drop a file here
          </p>
          <p className="text-gray-500 text-sm">
            or click to browse
          </p>
        </div>
      )}
      
      {/**
        * FILE SELECTED STATE
        * -------------------
        * Shows when a file has been selected.
        * Displays file name, size, and option to change.
        */}
      {selectedFile && (
        <div>
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-800 font-medium mb-1 truncate max-w-xs mx-auto">
            {selectedFile.name}
          </p>
          <p className="text-gray-500 text-sm mb-3">
            {formatBytes(selectedFile.size)}
          </p>
          <button
            onClick={handleChangeFile}
            disabled={disabled}
            className="text-sm underline disabled:opacity-50 disabled:cursor-not-allowed
                       hover:opacity-80 transition-opacity"
            style={{ color: '#9A3E3E' }}
          >
            Change file
          </button>
        </div>
      )}
      
      {/**
        * HIDDEN FILE INPUT
        * -----------------
        * Actual input element, hidden from view.
        * Triggered programmatically when drop zone is clicked.
        * 
        * Why hidden?
        * - File inputs are ugly and hard to style
        * - We create our own visual representation
        * - Still use native input for file picker functionality
        */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}

export default FileDrop;
