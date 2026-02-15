const WebSocket = require('ws');

const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();

function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateUniqueCode() {
    let code;
    do {
        code = generateCode();
    } while (rooms.has(code));
    return code;
}

function sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function handleDisconnect(code, role) {
    if (!code || !rooms.has(code)) return;
    
    const room = rooms.get(code);
    
    const otherPeer = role === 'sender' ? room.receiver : room.sender;
    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
        sendMessage(otherPeer, {
            type: 'peer-disconnected',
            message: `The ${role} has disconnected`
        });
    }
    
    rooms.delete(code);
    console.log(`Room ${code} closed - ${role} disconnected`);
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    let currentCode = null;
    let currentRole = null;
    
    ws.on('message', (data) => {
        let message;
        
        try {
            message = JSON.parse(data);
        } catch (e) {
            console.error('Invalid JSON received:', e);
            sendMessage(ws, { type: 'error', message: 'Invalid message format' });
            return;
        }
        
        console.log('Received:', message.type);
        
        switch (message.type) {
            
            case 'create-room':
                const code = generateUniqueCode();
                
                rooms.set(code, {
                    sender: ws,
                    receiver: null
                });
                
                currentCode = code;
                currentRole = 'sender';
                
                sendMessage(ws, {
                    type: 'room-created',
                    code: code
                });
                
                console.log(`Room created with code: ${code}`);
                break;
            
            case 'join-room':
                const joinCode = message.code;
                
                if (!rooms.has(joinCode)) {
                    sendMessage(ws, {
                        type: 'error',
                        message: 'Invalid code. No room found.'
                    });
                    return;
                }
                
                const room = rooms.get(joinCode);
                
                if (room.receiver) {
                    sendMessage(ws, {
                        type: 'error',
                        message: 'Room is full. Someone already joined.'
                    });
                    return;
                }
                
                room.receiver = ws;
                currentCode = joinCode;
                currentRole = 'receiver';
                
                sendMessage(ws, {
                    type: 'room-joined',
                    code: joinCode
                });
                
                sendMessage(room.sender, {
                    type: 'peer-joined'
                });
                
                console.log(`Receiver joined room: ${joinCode}`);
                break;
            
            case 'offer':
                if (currentCode && rooms.has(currentCode)) {
                    const offerRoom = rooms.get(currentCode);
                    if (offerRoom.receiver) {
                        sendMessage(offerRoom.receiver, {
                            type: 'offer',
                            offer: message.offer
                        });
                        console.log('Relayed offer to receiver');
                    }
                }
                break;
            
            case 'answer':
                if (currentCode && rooms.has(currentCode)) {
                    const answerRoom = rooms.get(currentCode);
                    if (answerRoom.sender) {
                        sendMessage(answerRoom.sender, {
                            type: 'answer',
                            answer: message.answer
                        });
                        console.log('Relayed answer to sender');
                    }
                }
                break;
            
            case 'ice-candidate':
                if (currentCode && rooms.has(currentCode)) {
                    const iceRoom = rooms.get(currentCode);
                    
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
            
            default:
                console.log('Unknown message type:', message.type);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(currentCode, currentRole);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

console.log(`
============================================
  WebRTC Signaling Server Started
============================================
  Port: ${PORT}
`);
