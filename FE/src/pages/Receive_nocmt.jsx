import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

import ProgressBar from '../components/ProgressBar';

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

const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  JOINING: 'joining',
  WAITING_OFFER: 'waiting-offer',
  CONNECTING_RTC: 'connecting-rtc',
  CONNECTED: 'connected',
  RECEIVING: 'receiving',
  COMPLETE: 'complete',
  ERROR: 'error',
};

function Receive_nocmt() {
  
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [fileMetadata, setFileMetadata] = useState(null);
  const [progress, setProgress] = useState({ received: 0, total: 0, percent: 0 });
  const [receivedFile, setReceivedFile] = useState(null);
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  
  const onFileMetadata = useCallback((metadata) => {
    console.log('[Receive] File metadata:', metadata);
    setFileMetadata(metadata);
    setProgress({ received: 0, total: metadata.size, percent: 0 });
    setStatus(STATUS.RECEIVING);
  }, []);
  
  const onFileProgress = useCallback((progressData) => {
    setProgress(progressData);
  }, []);
  
  const onFileComplete = useCallback((file) => {
    console.log('[Receive] File complete:', file.name);
    setReceivedFile(file);
    setStatus(STATUS.COMPLETE);
    
    downloadFile(file, file.name);
  }, []);
  
  const handleSignalingMessage = useCallback(async (event) => {
    const message = JSON.parse(event.data);
    console.log('[Receive] Received signaling message:', message.type);
    
    switch (message.type) {
      case 'room-joined':
        setStatus(STATUS.WAITING_OFFER);
        console.log('[Receive] Joined room:', message.code);
        break;
      
      case 'offer':
        setStatus(STATUS.CONNECTING_RTC);
        console.log('[Receive] Received offer, creating answer...');
        
        const pc = createPeerConnection();
        pcRef.current = pc;
        
        setupIceCandidateHandling(pc, wsRef.current);
        
        setupDataChannelReceiver(
          pc,
          (channel) => {
            setStatus(STATUS.CONNECTED);
            console.log('[Receive] DataChannel opened!');
            
            const fileHandler = createFileReceiver(
              onFileMetadata,
              onFileProgress,
              onFileComplete
            );
            
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (e) => fileHandler(e.data);
          },
          () => {}
        );
        
        await handleOfferAndSendAnswer(pc, message.offer, wsRef.current);
        break;
      
      case 'ice-candidate':
        if (pcRef.current) {
          await handleIceCandidate(pcRef.current, message.candidate);
        }
        break;
      
      case 'error':
        setError(message.message);
        setStatus(STATUS.ERROR);
        break;
      
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
  
  const handleConnect = useCallback(async () => {
    if (inputCode.length !== 4 || !/^\d{4}$/.test(inputCode)) {
      setError('Please enter a valid 4-digit code');
      return;
    }
    
    setStatus(STATUS.CONNECTING);
    setError(null);
    
    try {
      const ws = await createSignalingConnection();
      wsRef.current = ws;
      
      ws.onmessage = handleSignalingMessage;
      
      ws.onclose = () => {
        if (status !== STATUS.COMPLETE) {
          setError('Connection to server lost');
          setStatus(STATUS.ERROR);
        }
      };
      
      setStatus(STATUS.JOINING);
      sendSignalingMessage(ws, { type: 'join-room', code: inputCode });
      
    } catch (err) {
      setError(err.message);
      setStatus(STATUS.ERROR);
    }
  }, [inputCode, handleSignalingMessage, status]);
  
  const handleCodeChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setInputCode(value);
    
    if (error) setError(null);
  }, [error]);
  
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && inputCode.length === 4) {
      handleConnect();
    }
  }, [inputCode, handleConnect]);
  
  const handleDownload = useCallback(() => {
    if (receivedFile) {
      downloadFile(receivedFile, receivedFile.name);
    }
  }, [receivedFile]);
  
  const handleReceiveAnotherFile = useCallback(() => {
    setFileMetadata(null);
    setProgress({ received: 0, total: 0, percent: 0 });
    setReceivedFile(null);
    setStatus(STATUS.CONNECTED);
    console.log('[Receive] Ready to receive another file');
  }, []);

  const handleRetry = useCallback(() => {
    setStatus(STATUS.IDLE);
    setInputCode('');
    setError(null);
    setFileMetadata(null);
    setProgress({ received: 0, total: 0, percent: 0 });
    setReceivedFile(null);
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
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
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: '#F8F9FB' }}
    >
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
        
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img 
              src="/Logo.png" 
              alt="Peer Share Logo" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-semibold">
              <span style={{ color: '#9A3E3E' }}>Peer</span>
              <span className="text-gray-900">Share</span>
            </span>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Receive File</h1>
          <div className="w-24"></div>
        </div>
        
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
        
        {status !== STATUS.IDLE && status !== STATUS.COMPLETE && status !== STATUS.ERROR && (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
              <span className="text-gray-700 font-medium">{getStatusText()}</span>
            </div>
            
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
            
            {status === STATUS.RECEIVING && (
              <ProgressBar
                percent={progress.percent}
                label="Receiving..."
                detail={`${formatBytes(progress.received)} / ${formatBytes(progress.total)}`}
              />
            )}
          </div>
        )}
        
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
            
            <Link
              to="/"
              className="block mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Go to home page
            </Link>
          </div>
        )}
        
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
        
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-center text-gray-400 text-xs">
            Both you and the sender must stay on this page during the transfer.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Receive_nocmt;
