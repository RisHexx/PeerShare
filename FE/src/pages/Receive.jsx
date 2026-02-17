/**
 * ============================================================================
 * RECEIVE.JSX - Receive File Page Component
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * Handles the entire "receiver" flow:
 * 1. User enters 4-digit code from sender
 * 2. Connects to signaling server and joins the room
 * 3. Receives WebRTC offer from sender
 * 4. Creates answer and completes WebRTC connection
 * 5. Receives file chunks through DataChannel
 * 6. Reassembles file and triggers download
 * 
 * WHY THIS PAGE EXISTS:
 * ---------------------
 * The receiver is the "responder" in our WebRTC flow:
 * - Joins an existing room (signaling)
 * - Receives the offer from sender
 * - Creates and sends an answer
 * - Receives the file
 * 
 * COMPARISON WITH SENDER:
 * -----------------------
 * Sender:
 * - Creates room, creates offer, creates DataChannel, SENDS file
 * 
 * Receiver:
 * - Joins room, answers offer, receives DataChannel, RECEIVES file
 * 
 * The receiver doesn't create the DataChannel - it's created by the sender.
 * The receiver listens for it via peerConnection.ondatachannel.
 * 
 * STATE MANAGEMENT:
 * -----------------
 * Similar to Send.jsx but with:
 * - inputCode: User-entered room code
 * - fileMetadata: Info about incoming file
 * - receivedFile: The complete received file
 */

import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Import reusable components
import ProgressBar from '../components/ProgressBar';

// Import WebRTC utilities
import {
  createSignalingConnection,
  sendSignalingMessage,
  createPeerConnection,
  setupIceCandidateHandling,
  handleOfferAndSendAnswer,
  handleIceCandidate,
  setupDataChannelReceiver,
  createFileReceiver,
  downloadFile,
  formatBytes,
} from '../webrtc';

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS = {
  IDLE: 'idle',                  // Initial state, waiting for code input
  CONNECTING: 'connecting',      // Connecting to signaling server
  JOINING: 'joining',            // Attempting to join room
  WAITING_OFFER: 'waiting-offer',// In room, waiting for sender's offer
  CONNECTING_RTC: 'connecting-rtc', // Setting up WebRTC
  CONNECTED: 'connected',        // WebRTC connection established
  RECEIVING: 'receiving',        // File transfer in progress
  COMPLETE: 'complete',          // Transfer completed
  ERROR: 'error',                // Something went wrong
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Receive Component
 * 
 * WHAT: Main component for the receiver experience
 * WHY: Handles joining rooms, answering offers, receiving files
 * HOW: Manages state for code input, connection, and file reception
 * 
 * @returns {JSX.Element} The receive page
 */
function Receive() {
  // ========================================================================
  // STATE
  // ========================================================================
  
  // User-entered 4-digit code
  const [inputCode, setInputCode] = useState('');
  
  // Current status for UI feedback
  const [status, setStatus] = useState(STATUS.IDLE);
  
  // Incoming file metadata: {name, size, mimeType}
  const [fileMetadata, setFileMetadata] = useState(null);
  
  // Transfer progress: {received, total, percent}
  const [progress, setProgress] = useState({ received: 0, total: 0, percent: 0 });
  
  // The completed file (Blob/File object)
  const [receivedFile, setReceivedFile] = useState(null);
  
  // Error message if something goes wrong
  const [error, setError] = useState(null);
  
  // ========================================================================
  // REFS
  // ========================================================================
  
  // WebSocket connection to signaling server
  const wsRef = useRef(null);
  
  // RTCPeerConnection for WebRTC
  const pcRef = useRef(null);
  
  // ========================================================================
  // FILE RECEPTION CALLBACKS
  // ========================================================================
  
  /**
   * Called when file metadata is received
   */
  const onFileMetadata = useCallback((metadata) => {
    console.log('[Receive] File metadata:', metadata);
    setFileMetadata(metadata);
    setProgress({ received: 0, total: metadata.size, percent: 0 });
    setStatus(STATUS.RECEIVING);
  }, []);
  
  /**
   * Called for progress updates during file reception
   */
  const onFileProgress = useCallback((progressData) => {
    setProgress(progressData);
  }, []);
  
  /**
   * Called when file reception is complete
   */
  const onFileComplete = useCallback((file) => {
    console.log('[Receive] File complete:', file.name);
    setReceivedFile(file);
    setStatus(STATUS.COMPLETE);
    
    // Auto-download the file
    downloadFile(file, file.name);
  }, []);
  
  // ========================================================================
  // SIGNALING MESSAGE HANDLER
  // ========================================================================
  
  /**
   * Handles incoming signaling messages
   */
  const handleSignalingMessage = useCallback(async (event) => {
    const message = JSON.parse(event.data);
    console.log('[Receive] Received signaling message:', message.type);
    
    switch (message.type) {
      /**
       * ROOM-JOINED
       * Successfully joined the sender's room
       */
      case 'room-joined':
        setStatus(STATUS.WAITING_OFFER);
        console.log('[Receive] Joined room:', message.code);
        break;
      
      /**
       * OFFER
       * Received the sender's WebRTC offer
       * Now we create our peer connection and answer
       */
      case 'offer':
        setStatus(STATUS.CONNECTING_RTC);
        console.log('[Receive] Received offer, creating answer...');
        
        // Create RTCPeerConnection
        const pc = createPeerConnection();
        pcRef.current = pc;
        
        // Set up ICE candidate handling
        setupIceCandidateHandling(pc, wsRef.current);
        
        /**
         * Set up DataChannel receiver
         * The sender creates the DataChannel, we just listen for it.
         */
        setupDataChannelReceiver(
          pc,
          // onChannelOpen callback
          (channel) => {
            setStatus(STATUS.CONNECTED);
            console.log('[Receive] DataChannel opened!');
            
            // Set up file receiver
            const fileHandler = createFileReceiver(
              onFileMetadata,
              onFileProgress,
              onFileComplete
            );
            
            // Make sure we're receiving binary data correctly
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (e) => fileHandler(e.data);
          },
          // onMessage callback (fallback, channel.onmessage is set above)
          () => {}
        );
        
        // Handle the offer and send answer
        await handleOfferAndSendAnswer(pc, message.offer, wsRef.current);
        break;
      
      /**
       * ICE-CANDIDATE
       * Sender sent us a potential network path
       */
      case 'ice-candidate':
        if (pcRef.current) {
          await handleIceCandidate(pcRef.current, message.candidate);
        }
        break;
      
      /**
       * ERROR
       * Something went wrong (e.g., invalid room code)
       */
      case 'error':
        setError(message.message);
        setStatus(STATUS.ERROR);
        break;
      
      /**
       * PEER-DISCONNECTED
       * The sender disconnected
       */
      case 'peer-disconnected':
        if (status !== STATUS.COMPLETE) {
          setError('Sender disconnected');
          setStatus(STATUS.ERROR);
        }
        break;
      
      default:
        console.log('[Receive] Unknown message type:', message.type);
    }
  }, [status, onFileMetadata, onFileProgress, onFileComplete]);
  
  // ========================================================================
  // CONNECTION FUNCTION
  // ========================================================================
  
  /**
   * Connects to signaling server and joins the room
   * 
   * WHAT: Initiates connection when user clicks "Connect"
   * WHY: User must actively choose to join (enter code + click connect)
   * HOW: Creates WebSocket, sets up handlers, sends join-room message
   */
  const handleConnect = useCallback(async () => {
    // Validate code
    if (inputCode.length !== 4 || !/^\d{4}$/.test(inputCode)) {
      setError('Please enter a valid 4-digit code');
      return;
    }
    
    setStatus(STATUS.CONNECTING);
    setError(null);
    
    try {
      // Connect to signaling server
      const ws = await createSignalingConnection();
      wsRef.current = ws;
      
      // Set up message handler
      ws.onmessage = handleSignalingMessage;
      
      // Handle connection close
      ws.onclose = () => {
        if (status !== STATUS.COMPLETE) {
          setError('Connection to server lost');
          setStatus(STATUS.ERROR);
        }
      };
      
      // Join the room with the entered code
      setStatus(STATUS.JOINING);
      sendSignalingMessage(ws, { type: 'join-room', code: inputCode });
      
    } catch (err) {
      setError(err.message);
      setStatus(STATUS.ERROR);
    }
  }, [inputCode, handleSignalingMessage, status]);
  
  // ========================================================================
  // INPUT HANDLER
  // ========================================================================
  
  /**
   * Handles code input changes
   * Only allows numeric input, max 4 characters
   */
  const handleCodeChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setInputCode(value);
    
    // Clear error when user starts typing
    if (error) setError(null);
  }, [error]);
  
  /**
   * Handles Enter key press to submit
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && inputCode.length === 4) {
      handleConnect();
    }
  }, [inputCode, handleConnect]);
  
  /**
   * Triggers manual download of received file
   */
  const handleDownload = useCallback(() => {
    if (receivedFile) {
      downloadFile(receivedFile, receivedFile.name);
    }
  }, [receivedFile]);
  
  /**
   * Resets state to wait for another file from the same sender
   */
  const handleReceiveAnotherFile = useCallback(() => {
    setFileMetadata(null);
    setProgress({ received: 0, total: 0, percent: 0 });
    setReceivedFile(null);
    setStatus(STATUS.CONNECTED);
    console.log('[Receive] Ready to receive another file');
  }, []);

  /**
   * Resets state for trying again
   */
  const handleRetry = useCallback(() => {
    setStatus(STATUS.IDLE);
    setInputCode('');
    setError(null);
    setFileMetadata(null);
    setProgress({ received: 0, total: 0, percent: 0 });
    setReceivedFile(null);
    
    // Clean up connections
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  
  const getStatusColor = () => {
    switch (status) {
      case STATUS.CONNECTED:
      case STATUS.COMPLETE:
        return 'bg-green-500';
      case STATUS.ERROR:
        return 'bg-red-500';
      case STATUS.RECEIVING:
        return 'bg-indigo-500';
      default:
        return 'bg-yellow-500 animate-pulse';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case STATUS.IDLE:
        return 'Enter the code from the sender';
      case STATUS.CONNECTING:
        return 'Connecting to server...';
      case STATUS.JOINING:
        return 'Joining room...';
      case STATUS.WAITING_OFFER:
        return 'Connected! Waiting for sender...';
      case STATUS.CONNECTING_RTC:
        return 'Setting up connection...';
      case STATUS.CONNECTED:
        return 'Connected! Waiting for file...';
      case STATUS.RECEIVING:
        return 'Receiving file...';
      case STATUS.COMPLETE:
        return 'File received!';
      case STATUS.ERROR:
        return error || 'An error occurred';
      default:
        return 'Unknown status';
    }
  };
  
  const isConnecting = [STATUS.CONNECTING, STATUS.JOINING, STATUS.WAITING_OFFER, STATUS.CONNECTING_RTC].includes(status);
  
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
          <h1 className="text-lg font-semibold text-gray-900">Receive File</h1>
          <div className="w-24"></div>
        </div>
        
        {/* CODE INPUT SECTION - Only show in IDLE state */}
        {status === STATUS.IDLE && (
          <div className="mb-6">
            <label className="block text-gray-500 text-sm mb-3 text-center">
              Enter the 4-digit code from the sender:
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              maxLength={4}
              placeholder="0000"
              autoFocus
              className="w-full text-4xl font-mono font-bold tracking-[0.3em] text-center 
                         text-gray-800 rounded-lg py-4 px-6 
                         border border-gray-200 focus:border-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-gray-200
                         placeholder:text-gray-300 transition-all duration-200"
              style={{ backgroundColor: '#F8F9FB' }}
            />
            
            {/* Error message */}
            {error && (
              <p className="text-red-600 text-sm text-center mt-2">{error}</p>
            )}
            
            <button
              onClick={handleConnect}
              disabled={inputCode.length !== 4}
              className="w-full mt-4 py-3 px-6 text-white font-medium rounded-lg 
                         transition-opacity duration-150
                         disabled:bg-gray-300 disabled:cursor-not-allowed"
              style={{ backgroundColor: inputCode.length === 4 ? '#9A3E3E' : undefined }}
            >
              {inputCode.length === 4 ? 'Connect' : 'Enter 4-digit code'}
            </button>
          </div>
        )}
        
        {/* CONNECTION STATUS - Show when connecting or connected */}
        {status !== STATUS.IDLE && status !== STATUS.COMPLETE && status !== STATUS.ERROR && (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
              <span className="text-gray-700 font-medium">{getStatusText()}</span>
            </div>
            
            {/* Show file info if we have metadata */}
            {fileMetadata && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-gray-800 font-medium truncate">
                      {fileMetadata.name}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {formatBytes(fileMetadata.size)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Progress bar during receiving */}
            {status === STATUS.RECEIVING && (
              <ProgressBar
                percent={progress.percent}
                label="Receiving..."
                detail={`${formatBytes(progress.received)} / ${formatBytes(progress.total)}`}
              />
            )}
          </div>
        )}
        
        {/* SUCCESS MESSAGE */}
        {status === STATUS.COMPLETE && (
          <div className="text-center py-6">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-900 font-medium">File received!</p>
            <p className="text-gray-500 text-sm mt-1">
              {fileMetadata?.name} has been downloaded
            </p>
            
            <button
              onClick={handleDownload}
              className="mt-4 px-5 py-2 text-white font-medium rounded-lg 
                         transition-opacity hover:opacity-90
                         flex items-center gap-2 mx-auto"
              style={{ backgroundColor: '#9A3E3E' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Again</span>
            </button>
            
<button
              onClick={() => {
                // Notify sender that session has ended
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'session-ended' }));
                }
                window.location.href = '/';
              }}
              className="block mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Go to home page
            </button>
          </div>
        )}
        
        {/* ERROR MESSAGE */}
        {status === STATUS.ERROR && (
          <div className="text-center py-6">
            <svg className="w-12 h-12 mx-auto mb-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-900 font-medium">Connection failed</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-4 px-5 py-2 bg-gray-100 hover:bg-gray-200 
                         text-gray-700 rounded-lg transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        )}
        
        {/* HELPFUL TIP */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-center text-gray-400 text-xs">
            Both you and the sender must stay on this page during the transfer.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Receive;
