/**

 * ============================================================================
 * SEND.JSX - Send File Page Component
 * ============================================================================



 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * Handles the entire "sender" flow:
 * 1. Connects to signaling server
 * 2. Creates a room and displays the 4-digit code
 * 3. Waits for a receiver to join
 * 4. Allows file selection (drag & drop or click)
 * 5. Establishes WebRTC connection when receiver joins
 * 6. Sends file chunks and shows progress



 * WHY THIS PAGE EXISTS:
 * ---------------------
 * The sender is the "initiator" in our WebRTC flow:
 * - Creates the room (signaling)
 * - Creates the RTCPeerConnection
 * - Creates the DataChannel
 * - Sends the offer
 * - Sends the file


 * STATE MANAGEMENT:
 * -----------------
 * Uses React useState for:
 * - connectionCode: The 4-digit room code
 * - connectionStatus: Current state (connecting, waiting, connected, etc.)
 * - selectedFile: The file chosen for transfer
 * - transferProgress: {sent, total, percent}
 * - error: Any error messages
 * 
 * Uses useRef for:
 * - WebSocket connection (persists across renders)
 * - RTCPeerConnection (persists across renders)
 * - DataChannel (for sending data)
 * 
 * WHY useRef vs useState?
 * ----------------------
 * - useState: For values that should cause re-renders when changed
 * - useRef: For values that persist but don't need re-renders
 * 
 * WebSocket and RTCPeerConnection don't need to trigger re-renders
 * when they change - only their status does.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Import reusable components
import ProgressBar from '../components/ProgressBar';
import FileDrop from '../components/FileDrop';

// Import WebRTC utilities
import {
  createSignalingConnection,
  sendSignalingMessage,
  createPeerConnection,
  setupIceCandidateHandling,
  createAndSendOffer,
  handleAnswer,
  handleIceCandidate,
  createDataChannel,
  sendFile,
  formatBytes,
} from '../webrtc';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Connection status values
 * Using constants prevents typos and enables autocomplete
 */
const STATUS = {
  CONNECTING: 'connecting',      // Connecting to signaling server at start
  WAITING: 'waiting',            // Waiting for receiver to join
  PEER_JOINED: 'peer-joined',    // Receiver joined, setting up WebRTC
  CONNECTED: 'connected',        // WebRTC connection established
  SENDING: 'sending',            // File transfer in progress
  COMPLETE: 'complete',          // Transfer completed successfully
  ERROR: 'error',                // Something went wrong
};


function Send() {
 
  // Room code displayed to user (e.g., "1234")
  const [connectionCode, setConnectionCode] = useState(null);
  
  // Current status for UI feedback
  const [status, setStatus] = useState(STATUS.CONNECTING); // initial connecting
  
  // File selected for transfer
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Transfer progress: {sent, total, percent} 
  const [progress, setProgress] = useState({ sent: 0, total: 0, percent: 0 });
  
  // Error message if something goes wrong
  const [error, setError] = useState(null);
  

  // REFS (persist without re-renders)
  //Those are useRefs specifically so they don’t reconnect / reinitialize on every re-render.
  
  // WebSocket connection to signaling server
  const wsRef = useRef(null);
  
  // RTCPeerConnection for WebRTC
  const pcRef = useRef(null);
  
  // DataChannel for sending file data
  const dcRef = useRef(null);
  
  // ========================================================================
  // SIGNALING MESSAGE HANDLER
  // ========================================================================
  
  /**
   * Handles incoming signaling messages from the WebSocket.
   * 
   * WHAT: Processes different message types from signaling server
   * WHY: React to events like room creation, peer joining, answers, etc.
   * HOW: Switch on message type and call appropriate handlers
   * 
   * useCallback: Memoizes the function to prevent recreating on every render
   */
  const handleSignalingMessage = useCallback(async (event) => {
    const message = JSON.parse(event.data);
    console.log('[Send] Received signaling message:', message.type);
    
    switch (message.type) {
      /**
       * ROOM-CREATED
       * Server confirmed our room and gave us a code
       */
      case 'room-created':
        setConnectionCode(message.code);
        setStatus(STATUS.WAITING);
        console.log('[Send] Room created with code:', message.code);
        break;
      
      /**
       * PEER-JOINED
       * Receiver has entered our code and joined the room!
       * Now we initiate the WebRTC connection.
       */
      case 'peer-joined':
        setStatus(STATUS.PEER_JOINED);
        console.log('[Send] Peer joined! Setting up WebRTC...');
        
        // Create RTCPeerConnection
        const pc = createPeerConnection();
        pcRef.current = pc;
        
        // Set up ICE candidate handling
        setupIceCandidateHandling(pc, wsRef.current);
        
        /**
         * Create DataChannel BEFORE creating offer
         * This is important because the offer must include
         * the DataChannel's existence.
         */
        const dc = createDataChannel(pc);
        dcRef.current = dc;
        
        // When DataChannel opens, we're ready to send
        dc.onopen = () => {
          setStatus(STATUS.CONNECTED);
          console.log('[Send] DataChannel opened - ready to send!');
        };
        
        // Create and send offer to receiver
        await createAndSendOffer(pc, wsRef.current);
        break;
      
      /**
       * ANSWER
       * Receiver responded to our offer.
       * Complete the connection setup.
       */
      case 'answer':
        if (pcRef.current) {
          await handleAnswer(pcRef.current, message.answer);
          console.log('[Send] Received and set answer');
        }
        break;
      
      /**
       * ICE-CANDIDATE
       * Receiver sent us a potential network path.
       * Add it to our connection.
       */
      case 'ice-candidate':
        if (pcRef.current) {
          await handleIceCandidate(pcRef.current, message.candidate);
        }
        break;
      
      /**
       * ERROR
       * Something went wrong on the signaling server
       */
      case 'error':
        setError(message.message);
        setStatus(STATUS.ERROR);
        break;
      
      /**
       * PEER-DISCONNECTED
       * The receiver disconnected
       */
      case 'peer-disconnected':
        setError('Receiver disconnected');
        setStatus(STATUS.ERROR);
        break;
      
      /**
       * SESSION-ENDED
       * The receiver clicked "Go to home" after transfer
       */
      case 'session-ended':
        console.log('[Send] Session ended by receiver, navigating to home');
        window.location.href = '/';
        break;
      
      default:
        console.log('[Send] Unknown message type:', message.type);
    }
  }, []);
  
  // ========================================================================
  // INITIALIZATION EFFECT
  // ========================================================================
  
  /**
   * useEffect for initial setup
   * 
   * WHAT: Connects to signaling server and creates a room on mount
   * WHY: We need signaling connection before anything else
   * HOW: Calls async setup function, stores WebSocket in ref
   * 
   * Cleanup: Closes connections when component unmounts (navigating away)
   */
  useEffect(() => {
    let mounted = true; // Prevents state updates after unmount
    
    async function setup() {
      try {
        // Connect to signaling server
        const ws = await createSignalingConnection();
        
        if (!mounted) {
          ws.close();
          return;
        }
        
        wsRef.current = ws;
        
        // Set up message handler
        ws.onmessage = handleSignalingMessage;
        
        // Handle connection close
        ws.onclose = () => {
          if (mounted && status !== STATUS.COMPLETE) {
            setError('Connection to server lost');
            setStatus(STATUS.ERROR);
          }
        };
        
        // Request a room from the server
        sendSignalingMessage(ws, { type: 'create-room' });
        
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setStatus(STATUS.ERROR);
        }
      }
    }
    
    setup();
    
    // CLEANUP FUNCTION
    // Called when component unmounts
    return () => {
      mounted = false;
      
      // Close DataChannel
      if (dcRef.current) {
        dcRef.current.close();
      }
      
      // Close PeerConnection
      if (pcRef.current) {
        pcRef.current.close();
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      console.log('[Send] Cleaned up connections');
    };
  }, [handleSignalingMessage]);
  
  // ========================================================================
  // FILE HANDLING
  // ========================================================================
  
  /**
   * Handles when user selects a file
   * 
   * WHAT: Stores the selected file in state
   * WHY: We need a file before we can send it
   * HOW: Called by FileDrop component with File object
   */
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    console.log('[Send] File selected:', file.name, formatBytes(file.size));
  }, []);
  
  /**
   * Handles sending another file without re-establishing connection
   * 
   * WHAT: Resets state to allow sending another file
   * WHY: User wants to send multiple files to the same receiver
   * HOW: Resets file selection and progress, keeps connection alive
   */
  const handleSendAnotherFile = useCallback(() => {
    setSelectedFile(null);
    setProgress({ sent: 0, total: 0, percent: 0 });
    setStatus(STATUS.CONNECTED);
    console.log('[Send] Ready to send another file');
  }, []);

  /**
   * Handles the "Send" button click
   * 
   * WHAT: Initiates file transfer through the DataChannel
   * WHY: User action to start sending when ready
   * HOW: Calls sendFile utility with progress callback
   */
  const handleSend = useCallback(async () => {
    if (!dcRef.current || !selectedFile) {
      console.error('[Send] Cannot send - no DataChannel or file');
      return;
    }
    
    // Check DataChannel is open
    if (dcRef.current.readyState !== 'open') {
      setError('Connection not ready. Please wait.');
      return;
    }
    
    setStatus(STATUS.SENDING);
    setProgress({ sent: 0, total: selectedFile.size, percent: 0 });
    
    try {
      // Send the file with progress updates
      await sendFile(dcRef.current, selectedFile, (progressData) => {
        setProgress(progressData);
        
        // Check if transfer is complete
        if (progressData.percent >= 100) {
          setStatus(STATUS.COMPLETE);
        }
      });
    } catch (err) {
      setError('Failed to send file: ' + err.message);
      setStatus(STATUS.ERROR);
    }
  }, [selectedFile]);
  
  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  /**
   * Returns the status indicator color based on current status
   */
  const getStatusColor = () => {
    switch (status) {
      case STATUS.CONNECTED:
      case STATUS.COMPLETE:
        return 'bg-green-500';
      case STATUS.ERROR:
        return 'bg-red-500';
      case STATUS.SENDING:
        return 'bg-indigo-500';
      default:
        return 'bg-yellow-500 animate-pulse';
    }
  };
  
  /**
   * Returns the status text based on current status
   */
  const getStatusText = () => {
    switch (status) {
      case STATUS.CONNECTING:
        return 'Connecting to server...';
      case STATUS.WAITING:
        return 'Waiting for receiver...';
      case STATUS.PEER_JOINED:
        return 'Receiver joined! Setting up connection...';
      case STATUS.CONNECTED:
        return 'Connected! Ready to send.';
      case STATUS.SENDING:
        return 'Sending file...';
      case STATUS.COMPLETE:
        return 'File sent successfully!';
      case STATUS.ERROR:
        return error || 'An error occurred';
      default:
        return 'Unknown status';
    }
  };
  
  /**
   * Determines if the send button should be enabled
   */
  const canSend = status === STATUS.CONNECTED && selectedFile && dcRef.current?.readyState === 'open';
  
  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: '#F8F9FB' }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-64 h-64 rounded-full opacity-[0.03] animate-float"
          style={{ backgroundColor: '#9A3E3E', top: '10%', left: '-5%' }}
        />
        <div 
          className="absolute w-48 h-48 rounded-full opacity-[0.03] animate-float-reverse"
          style={{ backgroundColor: '#9A3E3E', top: '60%', right: '-3%' }}
        />
        <div 
          className="absolute w-32 h-32 rounded-full opacity-[0.02] animate-float-slow"
          style={{ backgroundColor: '#9A3E3E', bottom: '20%', left: '10%' }}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-lg w-full border border-gray-100 relative z-10">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Send File</h1>
          <div className="w-24"></div>
        </div>
        
        {/* CONNECTION CODE DISPLAY */}
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-3">Share this code with the receiver:</p>
          <div 
            className="text-4xl font-mono font-bold tracking-[0.3em] py-4 px-6 rounded-lg border"
            style={{ 
              backgroundColor: '#F8F9FB', 
              borderColor: '#E5E7EB',
              color: connectionCode ? '#9A3E3E' : '#9CA3AF'
            }}
          >
            {connectionCode || '----'}
          </div>
          
          {/* Status indicator */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            <span className={`font-medium ${status === STATUS.ERROR ? 'text-red-600' : 'text-gray-700'}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
        
        {/* FILE DROP ZONE - Only show if not in error or complete state */}
        {status !== STATUS.ERROR && status !== STATUS.COMPLETE && (
          <div className="mb-6">
            <FileDrop
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              disabled={status === STATUS.SENDING}
            />
          </div>
        )}
        
        {/* SEND BUTTON - Show when connected and file selected */}
        {status !== STATUS.SENDING && status !== STATUS.COMPLETE && status !== STATUS.ERROR && (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full py-3 px-6 text-white font-medium rounded-lg 
                       transition-opacity duration-150
                       disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={{ backgroundColor: canSend ? '#9A3E3E' : undefined }}
          >
            {!selectedFile 
              ? 'Select a file to send'
              : status !== STATUS.CONNECTED
                ? 'Waiting for connection...'
                : `Send ${selectedFile.name}`
            }
          </button>
        )}
        
        {/* PROGRESS BAR - Show during sending */}
        {status === STATUS.SENDING && (
          <div className="mt-6">
            <ProgressBar
              percent={progress.percent}
              label="Sending..."
              detail={`${formatBytes(progress.sent)} / ${formatBytes(progress.total)}`}
            />
          </div>
        )}
        
        {/* SUCCESS MESSAGE */}
        {status === STATUS.COMPLETE && (
          <div className="text-center py-6">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-900 font-medium">File sent successfully!</p>
            <p className="text-gray-500 text-sm mt-1">The receiver has your file.</p>
            <button
              onClick={handleSendAnotherFile}
              className="mt-4 px-5 py-2 text-white font-medium rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#9A3E3E' }}
            >
              Send another file
            </button>
            <Link
              to="/"
              className="block mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Go to home page
            </Link>
          </div>
        )}
        
        {/* ERROR MESSAGE */}
        {status === STATUS.ERROR && (
          <div className="text-center py-6">
            <svg className="w-12 h-12 mx-auto mb-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-900 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <Link
              to="/"
              className="inline-block mt-4 px-5 py-2 bg-gray-100 hover:bg-gray-200 
                         text-gray-700 rounded-lg transition-colors text-sm"
            >
              Try again
            </Link>
          </div>
        )}
        
        {/* HELPFUL TIP */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-center text-gray-400 text-xs">
            Both you and the receiver must stay on this page during the transfer.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Send;
