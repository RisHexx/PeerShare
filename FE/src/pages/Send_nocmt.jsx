import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import ProgressBar from '../components/ProgressBar';
import FileDrop from '../components/FileDrop';

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

const STATUS = {
  CONNECTING: 'connecting',
  WAITING: 'waiting',
  PEER_JOINED: 'peer-joined',
  CONNECTED: 'connected',
  SENDING: 'sending',
  COMPLETE: 'complete',
  ERROR: 'error',
};


function Send_nocmt() {
 
  const [connectionCode, setConnectionCode] = useState(null);
  const [status, setStatus] = useState(STATUS.CONNECTING);
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState({ sent: 0, total: 0, percent: 0 });
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  
  const handleSignalingMessage = useCallback(async (event) => {
    const message = JSON.parse(event.data);
    console.log('[Send] Received signaling message:', message.type);
    
    switch (message.type) {
      case 'room-created':
        setConnectionCode(message.code);
        setStatus(STATUS.WAITING);
        console.log('[Send] Room created with code:', message.code);
        break;
      
      case 'peer-joined':
        setStatus(STATUS.PEER_JOINED);
        console.log('[Send] Peer joined! Setting up WebRTC...');
        
        const pc = createPeerConnection();
        pcRef.current = pc;
        
        setupIceCandidateHandling(pc, wsRef.current);
        
        const dc = createDataChannel(pc);
        dcRef.current = dc;
        
        dc.onopen = () => {
          setStatus(STATUS.CONNECTED);
          console.log('[Send] DataChannel opened - ready to send!');
        };
        
        await createAndSendOffer(pc, wsRef.current);
        break;
      
      case 'answer':
        if (pcRef.current) {
          await handleAnswer(pcRef.current, message.answer);
          console.log('[Send] Received and set answer');
        }
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
        setError('Receiver disconnected');
        setStatus(STATUS.ERROR);
        break;
      
      default:
        console.log('[Send] Unknown message type:', message.type);
    }
  }, []);
  
  useEffect(() => {
    let mounted = true;
    
    async function setup() {
      try {
        const ws = await createSignalingConnection();
        
        if (!mounted) {
          ws.close();
          return;
        }
        
        wsRef.current = ws;
        
        ws.onmessage = handleSignalingMessage;
        
        ws.onclose = () => {
          if (mounted && status !== STATUS.COMPLETE) {
            setError('Connection to server lost');
            setStatus(STATUS.ERROR);
          }
        };
        
        sendSignalingMessage(ws, { type: 'create-room' });
        
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setStatus(STATUS.ERROR);
        }
      }
    }
    
    setup();
    
    return () => {
      mounted = false;
      
      if (dcRef.current) {
        dcRef.current.close();
      }
      
      if (pcRef.current) {
        pcRef.current.close();
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      console.log('[Send] Cleaned up connections');
    };
  }, [handleSignalingMessage]);
  
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    console.log('[Send] File selected:', file.name, formatBytes(file.size));
  }, []);
  
  const handleSendAnotherFile = useCallback(() => {
    setSelectedFile(null);
    setProgress({ sent: 0, total: 0, percent: 0 });
    setStatus(STATUS.CONNECTED);
    console.log('[Send] Ready to send another file');
  }, []);

  const handleSend = useCallback(async () => {
    if (!dcRef.current || !selectedFile) {
      console.error('[Send] Cannot send - no DataChannel or file');
      return;
    }
    
    if (dcRef.current.readyState !== 'open') {
      setError('Connection not ready. Please wait.');
      return;
    }
    
    setStatus(STATUS.SENDING);
    setProgress({ sent: 0, total: selectedFile.size, percent: 0 });
    
    try {
      await sendFile(dcRef.current, selectedFile, (progressData) => {
        setProgress(progressData);
        
        if (progressData.percent >= 100) {
          setStatus(STATUS.COMPLETE);
        }
      });
    } catch (err) {
      setError('Failed to send file: ' + err.message);
      setStatus(STATUS.ERROR);
    }
  }, [selectedFile]);
  
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
  
  const canSend = status === STATUS.CONNECTED && selectedFile && dcRef.current?.readyState === 'open';
  
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
          <h1 className="text-lg font-semibold text-gray-900">Send File</h1>
          <div className="w-24"></div>
        </div>
        
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
          
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            <span className={`font-medium ${status === STATUS.ERROR ? 'text-red-600' : 'text-gray-700'}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
        
        {status !== STATUS.ERROR && status !== STATUS.COMPLETE && (
          <div className="mb-6">
            <FileDrop
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              disabled={status === STATUS.SENDING}
            />
          </div>
        )}
        
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
        
        {status === STATUS.SENDING && (
          <div className="mt-6">
            <ProgressBar
              percent={progress.percent}
              label="Sending..."
              detail={`${formatBytes(progress.sent)} / ${formatBytes(progress.total)}`}
            />
          </div>
        )}
        
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
        
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-center text-gray-400 text-xs">
            Both you and the receiver must stay on this page during the transfer.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Send_nocmt;
