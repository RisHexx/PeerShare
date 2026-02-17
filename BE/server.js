/**
 * ============================================================================
 * WEBRTC SIGNALING SERVER
 * ============================================================================
 * 
 * WHAT IS SIGNALING?
 * ------------------
 * Signaling is the process of coordinating communication between two peers
 * who want to establish a WebRTC connection. Think of it like a matchmaking
 * service - it helps two strangers find each other, but once they're connected,
 * they communicate directly without the matchmaker.
 * 
 * WHY DO WE NEED WEBSOCKETS FOR WEBRTC?
 * -------------------------------------
 * WebRTC itself doesn't define how peers discover each other. Before two
 * browsers can talk directly, they need to exchange:
 *   1. Session Description Protocol (SDP) - describes what media/data they want to send
 *   2. ICE Candidates - possible network paths to reach each other
 * 
 * WebSocket provides a real-time, bidirectional channel perfect for this
 * exchange. HTTP wouldn't work well because we need instant message delivery.
 * 
 * HOW PEERS FIND EACH OTHER (Our Approach):
 * -----------------------------------------
 * 1. Sender connects and gets a 4-digit code
 * 2. Receiver enters the same code
 * 3. Server matches them and relays signaling messages
 * 4. Once WebRTC connection is established, server is no longer needed
 * 
 * IMPORTANT: No file data ever passes through this server!
 * Files go directly peer-to-peer via WebRTC DataChannel.
 */

// Import the WebSocket library
// 'ws' is a lightweight, fast WebSocket implementation for Node.js
const WebSocket = require('ws');

// Create HTTP server on port 8080
// In production, you'd use environment variables for the port
const PORT = 8080;

// Create WebSocket server
// This listens for incoming WebSocket connections from browsers
const wss = new WebSocket.Server({ port: PORT });

/**
 * ROOMS DATA STRUCTURE
 * --------------------
 * We use a Map to store active "rooms" (connection sessions).
 * Key: 4-digit code (string)
 * Value: Object containing sender and receiver WebSocket connections
 * 
 * Why a Map? 
 * - O(1) lookup time for finding rooms by code
 * - Easy to add/delete rooms
 * - Keys can be any type (though we use strings)
 */
const rooms = new Map();

/**
 * Generates a random 4-digit code for room identification.
 * 
 * WHAT: Creates a random number between 1000-9999
 * WHY: 4 digits is easy to type/share verbally, yet provides 9000 possible codes
 * HOW: Math.random() gives 0-1, multiply by 9000, add 1000, floor to integer
 * 
 * @returns {string} A 4-digit code as a string (e.g., "1234")
 */
function generateCode() {
    // Generate random 4-digit number (1000-9999)
    // We avoid codes starting with 0 for simplicity
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generates a unique code that isn't already in use.
 * 
 * WHAT: Keeps generating codes until it finds one not already taken
 * WHY: Prevents two senders from getting the same code (collision)
 * HOW: Loop with generateCode() until rooms.has(code) is false
 * 
 * NOTE: With 9000 possible codes, collisions are rare for small user counts.
 * In production, you'd want a smarter approach for high traffic.
 * 
 * @returns {string} A unique 4-digit code
 */
function generateUniqueCode() {
    let code;
    // Keep generating until we find an unused code
    // This prevents room code collisions
    do {
        code = generateCode();
    } while (rooms.has(code));
    return code;
}

/**
 * Sends a JSON message to a WebSocket client.
 * 
 * WHAT: Converts an object to JSON and sends it through WebSocket
 * WHY: WebSocket only sends strings/buffers, so we serialize objects to JSON
 * HOW: JSON.stringify converts object to string, then ws.send() transmits it
 * 
 * @param {WebSocket} ws - The WebSocket connection to send to
 * @param {Object} message - The message object to send
 */
function sendMessage(ws, message) {
    // Only send if connection is open (readyState 1 = OPEN)
    // This prevents errors when trying to send to closed connections
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * Handles cleanup when a peer disconnects.
 * 
 * WHAT: Removes the room and notifies the other peer
 * WHY: Prevents memory leaks and informs the remaining peer
 * HOW: Finds room by code, notifies other peer, deletes room from Map
 * 
 * @param {string} code - The room code
 * @param {string} role - Either 'sender' or 'receiver'
 */
function handleDisconnect(code, role) {
    if (!code || !rooms.has(code)) return;
    
    const room = rooms.get(code);
    
    // Notify the other peer that their partner disconnected
    const otherPeer = role === 'sender' ? room.receiver : room.sender;
    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
        sendMessage(otherPeer, {
            type: 'peer-disconnected',
            message: `The ${role} has disconnected`
        });
    }
    
    // Clean up the room to free memory
    rooms.delete(code);
    console.log(`Room ${code} closed - ${role} disconnected`);
}

/**
 * MAIN WEBSOCKET CONNECTION HANDLER
 * ---------------------------------
 * This fires every time a new browser connects to our WebSocket server.
 * Each connection represents one peer (either sender or receiver).
 */
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Track which room this connection belongs to
    // We store this so we can clean up when they disconnect
    let currentCode = null;
    let currentRole = null;
    
    /**
     * MESSAGE HANDLER
     * ---------------
     * All communication happens through messages.
     * We parse JSON and route based on message 'type'.
     * 
     * Message Types:
     * - create-room: Sender wants a new room/code
     * - join-room: Receiver wants to join with a code
     * - offer: WebRTC session description from sender
     * - answer: WebRTC session description from receiver
     * - ice-candidate: Network path information from either peer
     */
    ws.on('message', (data) => {
        let message;
        
        // Parse the incoming JSON message
        // Wrap in try-catch because malformed JSON would crash the server
        try {
            message = JSON.parse(data);
        } catch (e) {
            console.error('Invalid JSON received:', e);
            sendMessage(ws, { type: 'error', message: 'Invalid message format' });
            return;
        }
        
        console.log('Received:', message.type);
        
        // Route message to appropriate handler based on type
        switch (message.type) {
            
            /**
             * CREATE-ROOM HANDLER
             * -------------------
             * When sender clicks "Send File", frontend sends this message.
             * We create a room, generate a unique code, and wait for receiver.
             */
            case 'create-room':
                // Generate a unique 4-digit code
                const code = generateUniqueCode();
                
                // Create the room with this sender
                rooms.set(code, {
                    sender: ws,      // The WebSocket connection of the sender
                    receiver: null   // Receiver hasn't joined yet
                });
                
                // Remember this connection's room info for cleanup
                currentCode = code;
                currentRole = 'sender';
                
                // Send code back to sender so they can display it
                sendMessage(ws, {
                    type: 'room-created',
                    code: code
                });
                
                console.log(`Room created with code: ${code}`);
                break;
            
            /**
             * JOIN-ROOM HANDLER
             * -----------------
             * When receiver enters a code and clicks "Connect",
             * we check if that room exists and connect them.
             */
            case 'join-room':
                const joinCode = message.code;
                
                // Check if room exists
                if (!rooms.has(joinCode)) {
                    sendMessage(ws, {
                        type: 'error',
                        message: 'Invalid code. No room found.'
                    });
                    return;
                }
                
                const room = rooms.get(joinCode);
                
                // Check if room already has a receiver
                if (room.receiver) {
                    sendMessage(ws, {
                        type: 'error',
                        message: 'Room is full. Someone already joined.'
                    });
                    return;
                }
                
                // Add receiver to the room
                room.receiver = ws;
                currentCode = joinCode;
                currentRole = 'receiver';
                
                // Notify receiver they joined successfully
                sendMessage(ws, {
                    type: 'room-joined',
                    code: joinCode
                });
                
                // IMPORTANT: Notify sender that receiver is ready
                // This triggers the sender to create and send a WebRTC offer
                sendMessage(room.sender, {
                    type: 'peer-joined'
                });
                
                console.log(`Receiver joined room: ${joinCode}`);
                break;
            
            /**
             * WEBRTC OFFER HANDLER
             * --------------------
             * The sender creates an "offer" (SDP) describing what data channel
             * they want to establish. We relay this to the receiver.
             * 
             * SDP (Session Description Protocol) contains:
             * - Media types (we use data channel, not audio/video)
             * - Codecs supported
             * - Network information
             */
            case 'offer':
                if (currentCode && rooms.has(currentCode)) {
                    const offerRoom = rooms.get(currentCode);
                    if (offerRoom.receiver) {
                        // Relay the offer to the receiver
                        sendMessage(offerRoom.receiver, {
                            type: 'offer',
                            offer: message.offer
                        });
                        console.log('Relayed offer to receiver');
                    }
                }
                break;
            
            /**
             * WEBRTC ANSWER HANDLER
             * ---------------------
             * The receiver responds to the offer with an "answer" (also SDP).
             * This confirms they accept the connection parameters.
             */
            case 'answer':
                if (currentCode && rooms.has(currentCode)) {
                    const answerRoom = rooms.get(currentCode);
                    if (answerRoom.sender) {
                        // Relay the answer to the sender
                        sendMessage(answerRoom.sender, {
                            type: 'answer',
                            answer: message.answer
                        });
                        console.log('Relayed answer to sender');
                    }
                }
                break;
            
            /**
             * ICE CANDIDATE HANDLER
             * ---------------------
             * ICE (Interactive Connectivity Establishment) candidates are
             * possible network paths between the two peers.
             * 
             * Each peer discovers multiple ways they might be reachable:
             * - Local IP addresses
             * - Public IP (via STUN server)
             * - Relay address (via TURN server, if configured)
             * 
             * We relay these to the other peer so they can try to connect.
             */
            case 'ice-candidate':
                if (currentCode && rooms.has(currentCode)) {
                    const iceRoom = rooms.get(currentCode);
                    
                    // Figure out who to send this candidate to
                    // (the other peer in the room)
                    const targetPeer = currentRole === 'sender' 
                        ? iceRoom.receiver 
                        : iceRoom.sender;
                    
                    if (targetPeer) {
                        sendMessage(targetPeer, {
                            type: 'ice-candidate',
                            candidate: message.candidate
                        });
                        console.log(`Relayed ICE candidate from ${currentRole}`);
                    }
                }
                break;
            
            /**
             * FILE METADATA HANDLER
             * ---------------------
             * Before sending the actual file, sender tells receiver about:
             * - File name
             * - File size
             * - File type (MIME type)
             * 
             * This helps receiver prepare for incoming data.
             */
            case 'file-meta':
                if (currentCode && rooms.has(currentCode)) {
                    const metaRoom = rooms.get(currentCode);
                    if (metaRoom.receiver) {
                        sendMessage(metaRoom.receiver, {
                            type: 'file-meta',
                            fileName: message.fileName,
                            fileSize: message.fileSize,
                            fileType: message.fileType
                        });
                        console.log(`Relayed file metadata: ${message.fileName}`);
                    }
                }
                break;
            
            /**
             * SESSION-ENDED HANDLER
             * ---------------------
             * When receiver clicks "Go to home" after transfer,
             * notify the sender so they can also navigate home.
             */
            case 'session-ended':
                if (currentCode && rooms.has(currentCode)) {
                    const sessionRoom = rooms.get(currentCode);
                    const otherPeer = currentRole === 'sender' ? sessionRoom.receiver : sessionRoom.sender;
                    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
                        sendMessage(otherPeer, {
                            type: 'session-ended',
                            message: `The ${currentRole} has ended the session`
                        });
                        console.log(`Session ended by ${currentRole}`);
                    }
                }
                break;
            
            default:
                console.log('Unknown message type:', message.type);
        }
    });
    
    /**
     * DISCONNECT HANDLER
     * ------------------
     * When a peer closes their browser or loses connection,
     * we clean up their room and notify the other peer.
     */
    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(currentCode, currentRole);
    });
    
    /**
     * ERROR HANDLER
     * -------------
     * Log WebSocket errors for debugging.
     */
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Log server startup
console.log(`
============================================
  WebRTC Signaling Server Started
============================================
  Port: ${PORT}
`);
