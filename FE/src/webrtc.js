export const CHUNK_SIZE = 16 * 1024; // 16KB

// WebSocket Signaling Server URL

export const SIGNALING_SERVER_URL = 'ws://localhost:8080';

/**
 * ICE Server Configuration
 * 
 * STUN servers help discover public IP addresses.
 * We use Google's free STUN servers.
 * 
 * For production, consider:
 * - Multiple STUN servers for redundancy
 * - TURN servers for users behind strict firewalls
 */
export const ICE_SERVERS = {
  iceServers: [
    // Google's free STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ============================================================================
// WEBSOCKET SIGNALING
// ============================================================================


// Creates a WebSocket connection to the signaling server.

export function createSignalingConnection() {
  return new Promise((resolve, reject) => {
    // Create WebSocket connection
    const ws = new WebSocket(SIGNALING_SERVER_URL);
    

    ws.onopen = () => {
      console.log('[Signaling] Connected to signaling server');
      resolve(ws);     // Resolve promise when connection opens
    };
    

    ws.onerror = (error) => {
      console.error('[Signaling] Connection error:', error);
      reject(new Error('Failed to connect to signaling server'));     // Reject promise on error
    };
  });
}


/**
 * Sends a JSON message through the WebSocket.
 * 
 * WHAT: Serializes object to JSON and sends via WebSocket
 * WHY: WebSocket only sends strings/buffers, we use JSON for structure
 * HOW: JSON.stringify the object, then ws.send()
 * 
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} message - Object to send
 */


export function sendSignalingMessage(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    console.log('[Signaling] Sent:', message.type);
  } else {
    console.warn('[Signaling] Cannot send - WebSocket not open');
  }
}

// ============================================================================
// WEBRTC PEER CONNECTION
// ============================================================================

/**
 * Creates and configures an RTCPeerConnection.
 * 
 * WHAT: Creates the main WebRTC connection object
 * WHY: RTCPeerConnection manages the entire peer-to-peer connection
 * HOW: Instantiates RTCPeerConnection with ICE server configuration
 * 
 * RTCPeerConnection handles:
 * - ICE candidate gathering and negotiation
 * - DTLS encryption setup
 * - DataChannel management
 * - Connection state monitoring
 * 
 * @returns {RTCPeerConnection} Configured peer connection
 */
export function createPeerConnection() {
  // Create peer connection with ICE servers
  const peerConnection = new RTCPeerConnection(ICE_SERVERS);
  
  //(useful for debugging)

  // Log connection state changes 
  peerConnection.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', peerConnection.connectionState);
  };
  
  // Log ICE connection state
  peerConnection.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ICE state:', peerConnection.iceConnectionState);
  };
  
  // Log ICE gathering state
  peerConnection.onicegatheringstatechange = () => {
    console.log('[WebRTC] ICE gathering:', peerConnection.iceGatheringState);
  };
  
  return peerConnection;
}

/**
 * Sets up ICE candidate handling for a peer connection.
 * 
 * WHAT: Configures how ICE candidates are sent to the remote peer
 * WHY: ICE candidates are potential network paths; both peers need them all
 * HOW: listens to onicecandidate and sends each via signaling server
 * 
 * ICE CANDIDATES EXPLAINED:
 * -------------------------
 * As the browser discovers ways to reach this peer, it fires events.
 * Each candidate represents a possible network path:
 * - Host candidates: Local IP addresses
 * - Server reflexive: Public IP via STUN
 * - Relay: TURN server relay (if configured)
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {WebSocket} ws - Signaling WebSocket to send candidates through
 */
export function setupIceCandidateHandling(peerConnection, ws) {
  // when it discover the candiate its send it to peer
  peerConnection.onicecandidate = (event) => {
    // event.candidate is null when gathering is complete
    if (event.candidate) {
      console.log('[WebRTC] New ICE candidate found');
      
      // Send candidate to remote peer via signaling server
      sendSignalingMessage(ws, {
        type: 'ice-candidate',
        candidate: event.candidate,
      });
    } else {
      console.log('[WebRTC] ICE gathering complete');
    }
  };
}

/**
 * Handles an incoming ICE candidate from the remote peer.
 * 
 * WHAT: Adds a remote ICE candidate to our peer connection
 * WHY: We need to know all the ways to reach the remote peer
 * HOW: Calls peerConnection.addIceCandidate()
 */
export async function handleIceCandidate(peerConnection, candidate) {
  try {
    // adding ice caandidate of remote peer
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('[WebRTC] Added remote ICE candidate');
  } catch (error) {
    console.error('[WebRTC] Error adding ICE candidate:', error);
  }
}

// ============================================================================
// OFFER/ANSWER SIGNALING
// ============================================================================

/**
 * Creates an SDP offer (SENDER side).
 * 
 * WHAT: Creates a session description to send to the receiver
 * WHY: The offer describes how we want to communicate (codecs, etc.)
 * HOW: Calls createOffer(), then setLocalDescription()
 * 
 * SDP (Session Description Protocol) contains:
 * - Media descriptions (we use data channel)
 * - Network information
 * - Security parameters
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {WebSocket} ws - Signaling WebSocket to send offer through
 */
export async function createAndSendOffer(peerConnection, ws) {
  try {
    // Create the offer
    const offer = await peerConnection.createOffer();
    console.log('[WebRTC] Created offer');
    
    // Set it as our local description
    // This starts ICE candidate gathering
    await peerConnection.setLocalDescription(offer);
    console.log('[WebRTC] Set local description (offer)');
    
    // Send offer to remote peer via signaling
    sendSignalingMessage(ws, {
      type: 'offer',
      offer: offer,
    });
  } catch (error) {
    console.error('[WebRTC] Error creating offer:', error);
    throw error;
  }
}

/**
 * Handles an incoming offer (RECEIVER side).
 * 
 * WHAT: Processes the sender's offer and creates an answer
 * WHY: The receiver must respond to establish the connection
 * HOW: Sets remote description, creates answer, sends answer back
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {RTCSessionDescriptionInit} offer - The offer from the sender
 * @param {WebSocket} ws - Signaling WebSocket to send answer through
 */
export async function handleOfferAndSendAnswer(peerConnection, offer, ws) {
  try {
    // Set the offer as our remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('[WebRTC] Set remote description (offer)');
    
    // Create our answer
    const answer = await peerConnection.createAnswer();
    console.log('[WebRTC] Created answer');
    
    // Set it as our local description
    await peerConnection.setLocalDescription(answer);
    console.log('[WebRTC] Set local description (answer)');
    
    // Send answer back to sender
    sendSignalingMessage(ws, {
      type: 'answer',
      answer: answer,
    });
  } catch (error) {
    console.error('[WebRTC] Error handling offer:', error);
    throw error;
  }
}

/**
 * Handles an incoming answer (SENDER side).
 * 
 * WHAT: Processes the receiver's answer to complete connection setup
 * WHY: Both peers now have each other's session descriptions
 * HOW: Sets the answer as our remote description
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {RTCSessionDescriptionInit} answer - The answer from the receiver
 */
export async function handleAnswer(peerConnection, answer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('[WebRTC] Set remote description (answer)');
  } catch (error) {
    console.error('[WebRTC] Error handling answer:', error);
    throw error;
  }
}


// ============================================================================
// DATA CHANNEL - FILE TRANSFER
// ============================================================================

/**
 * Creates a DataChannel for file transfer (SENDER side).
 * 
 * WHAT: Creates a bidirectional channel for sending data
 * WHY: DataChannels are the WebRTC mechanism for arbitrary data transfer
 * HOW: Calls peerConnection.createDataChannel() with options
 * 
 * DATACHANNEL OPTIONS:
 * --------------------
 * - ordered: true = messages arrive in order (important for files!)
 * - maxRetransmits: null = reliable delivery (retries until success)
 * 
 * The 'fileTransfer' name is just a label - both peers will see it.
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @returns {RTCDataChannel} The created data channel
 */
export function createDataChannel(peerConnection) {
  // Create the data channel with a descriptive name
  const dataChannel = peerConnection.createDataChannel('fileTransfer', {
    ordered: true, // Ensure chunks arrive in order (critical for files!)
  });
  
  // debug
  // Log channel events
  dataChannel.onopen = () => {
    console.log('[DataChannel] Channel opened');
  };
  
  dataChannel.onclose = () => {
    console.log('[DataChannel] Channel closed');
  };
  
  dataChannel.onerror = (error) => {
    console.error('[DataChannel] Error:', error);
  };
  
  return dataChannel;
}

/**
 * Sets up DataChannel reception (RECEIVER side).
 * 
 * WHAT: Configures handling when a remote peer creates a DataChannel
 * WHY: When sender creates a channel, receiver must be ready to receive it
 * HOW: Sets ondatachannel handler on the peer connection
 * 
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {function} onChannelOpen - Callback when channel opens
 * @param {function} onMessage - Callback for each message received
 */
export function setupDataChannelReceiver(peerConnection, onChannelOpen, onMessage) {

  //reciever gets it from sdp offer
  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;
    console.log('[DataChannel] Received channel:', dataChannel.label);
    
    dataChannel.onopen = () => {
      console.log('[DataChannel] Channel opened');
      onChannelOpen(dataChannel);
    };
    
    // IMPORTANT: Set binary type to arraybuffer for file chunks
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onmessage = (messageEvent) => {
      onMessage(messageEvent.data);
    };
    
    dataChannel.onclose = () => {
      console.log('[DataChannel] Channel closed');
    };
  };
}




// ============================================================================
// FILE CHUNKING AND TRANSFER
// ============================================================================

/**
 * Splits a file into chunks for transfer.
 * 
 * WHAT: Divides a File object into ArrayBuffer chunks
 * WHY: WebRTC DataChannel has message size limits; files must be chunked
 * HOW: Uses FileReader to read file as ArrayBuffer, then slices
 * 
 * @param {File} file - The file to chunk
 * @returns {Promise<ArrayBuffer[]>} Array of file chunks
 */
export async function chunkFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // onload when finish reading
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const chunks = [];
      
      // Slice the buffer into chunks

      for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
        // slice(start, end) - end is exclusive
        const end = Math.min(offset + CHUNK_SIZE, arrayBuffer.byteLength);
        chunks.push(arrayBuffer.slice(offset, end));
      }
      
      console.log(`[File] Split into ${chunks.length} chunks (${CHUNK_SIZE / 1024}KB each)`);
      resolve(chunks);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Read entire file as ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
}




/**
 * Sends a file through the DataChannel.
 * 
 * WHAT: Sends file chunks one by one through the DataChannel
 * WHY: Files must be sent in pieces due to WebRTC message size limits
 * HOW: Chunks file, sends metadata, then sends chunks with flow control
 * 
 * FLOW CONTROL:
 * -------------
 * DataChannel has a send buffer. If we send too fast, buffer overflows.
 * We use bufferedAmountLowThreshold to pause when buffer is full.
 * 
 * @param {RTCDataChannel} dataChannel - The data channel to send through
 * @param {File} file - The file to send
 * @param {function} onProgress - Callback with {sent, total, percent}
 */

export async function sendFile(dataChannel, file, onProgress) {
  // First, send file metadata as JSON
  const metadata = {
    type: 'file-meta',
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
  dataChannel.send(JSON.stringify(metadata));
  console.log('[File] Sent metadata:', metadata.name, metadata.size);
  
  // Chunk the file
  const chunks = await chunkFile(file);
  
  // Track progress
  let sentChunks = 0;
  let sentBytes = 0;
  
  // BUFFER THRESHOLD: Pause sending if buffer exceeds this
  //“If more than 64KB is waiting to be sent, stop sending.”
  // 64KB is a safe value for most scenarios
  const BUFFER_THRESHOLD = 64 * 1024;
  dataChannel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;
  
  /**
   * Send the next chunk with flow control
   */
  const sendNextChunk = () => {
    // Don't send if buffer is too full
    while (dataChannel.bufferedAmount <= BUFFER_THRESHOLD && sentChunks < chunks.length) {
      const chunk = chunks[sentChunks];
      dataChannel.send(chunk);
      
      sentChunks++;
      sentBytes += chunk.byteLength;
      
      // Report progress
      const percent = Math.round((sentBytes / file.size) * 100);
      onProgress({
        sent: sentBytes,
        total: file.size,
        percent: percent,
      });
    }
    
    // Check if we're done
    if (sentChunks >= chunks.length) {
      // Send end-of-file signal
      dataChannel.send(JSON.stringify({ type: 'file-end' }));
      console.log('[File] Transfer complete');
    }
  };
  
  // When buffer drains, continue sending
  dataChannel.onbufferedamountlow = sendNextChunk;
  
  // Start sending
  sendNextChunk();
}

/**
 * Receives a file through the DataChannel.
 * 
 * WHAT: Collects incoming chunks and reconstructs the file
 * WHY: Files arrive in pieces; we must reassemble them
 * HOW: Collects chunks in array, creates Blob when complete
 * 
 * MESSAGE TYPES:
 * - JSON with type='file-meta': File information
 * - ArrayBuffer: A file chunk
 * - JSON with type='file-end': Transfer complete signal
 * 
 * @param {function} onMetadata - Called with file info {name, size, mimeType}
 * @param {function} onProgress - Called with {received, total, percent}
 * @param {function} onComplete - Called with the final File object
 * @returns {function} Message handler to attach to dataChannel.onmessage
 */
export function createFileReceiver(onMetadata, onProgress, onComplete) {
  // State preserved across message events
  let fileMetadata = null;
  let receivedChunks = [];
  let receivedBytes = 0;
  
  /**
   * Handle each incoming message
   * @param {string|ArrayBuffer} data - The received data
   */
  return function handleMessage(data) {
    // Check if it's a string (JSON) or binary (chunk)
    if (typeof data === 'string') {
      // Parse JSON message
      const message = JSON.parse(data);
      
      if (message.type === 'file-meta') {
        // Store metadata
        fileMetadata = message;
        console.log('[File] Receiving:', message.name, message.size, 'bytes');
        onMetadata(message);
      } else if (message.type === 'file-end') {
        // File transfer complete - reconstruct file
        console.log('[File] Transfer complete, reconstructing...');
        
        // Create Blob from chunks
        const blob = new Blob(receivedChunks, { type: fileMetadata.mimeType });
        
        // Create File object with proper name
        const file = new File([blob], fileMetadata.name, { type: fileMetadata.mimeType });
        
        onComplete(file);
        
        // Reset state for potential next transfer
        receivedChunks = [];
        receivedBytes = 0;
        fileMetadata = null;
      }
    } else {
      // Binary data - it's a file chunk
      receivedChunks.push(data);
      receivedBytes += data.byteLength;
      
      // Report progress
      if (fileMetadata) {
        const percent = Math.round((receivedBytes / fileMetadata.size) * 100);
        onProgress({
          received: receivedBytes,
          total: fileMetadata.size,
          percent: percent,
        });
      }
    }
  };
}

/**
 * Triggers a file download in the browser.
 * 
 * WHAT: Causes the browser to download a File/Blob
 * WHY: After receiving a file, user needs to save it
 * HOW: Creates a temporary URL, clicks invisible link, cleans up
 * 
 * @param {File|Blob} file - The file to download
 * @param {string} filename - Name for the downloaded file
 */
export function downloadFile(file, filename) {
  // Create object URL for the file
  const url = URL.createObjectURL(file);
  
  // Create invisible anchor element
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.style.display = 'none';
  
  // Add to DOM, click, remove
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up object URL to free memory
  URL.revokeObjectURL(url);
  
  console.log('[File] Download triggered:', filename);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats bytes into human-readable format.
 * 
 * WHAT: Converts raw byte count to readable string
 * WHY: "1048576 bytes" is less helpful than "1.00 MB"
 * HOW: Divides by 1024 until appropriate unit is found
 * 
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted string like "1.50 MB"
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return 'Invalid size';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
