import { Link } from 'react-router-dom';

function Home() {
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
        <div 
          className="absolute w-20 h-20 rounded-full opacity-[0.03] animate-float"
          style={{ backgroundColor: '#9A3E3E', top: '20%', right: '15%' }}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full border border-gray-100 relative z-10">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-6">
          {/**
            * Logo with Text
            * Logo image with PeerShare branding
            */}
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/Logo.png" 
              alt="Peer Share Logo" 
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-2xl font-semibold">
              <span style={{ color: '#9A3E3E' }}>Peer</span>
              <span className="text-gray-900">Share</span>
            </h1>
          </div>
          
          {/* Subtitle */}
          <p className="text-gray-500 text-sm font-semibold">
            P2P file transfer using <span className="font-bold" style={{ color: '#9A3E3E' }}>WebRTC</span>
          </p>
        </div>
        <div className="space-y-3">
          <Link
            to="/send"
            className="w-full flex items-center justify-center gap-3 py-3 px-5 
                       text-white font-medium rounded-lg transition-colors duration-150
                       hover:opacity-90"
            style={{ backgroundColor: '#9A3E3E' }}>
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
            <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
              />
            </svg>
            <span>Send File</span>
          </Link>

          
          <Link
            to="/receive"
            className="w-full flex items-center justify-center gap-3 py-3 px-5 
                       font-medium rounded-lg border-2 transition-colors duration-150
                       hover:bg-gray-50"
            style={{ borderColor: '#9A3E3E', color: '#9A3E3E' }}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
              />
            </svg>
            <span>Receive File</span>
          </Link>


        </div>
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-center text-gray-600 text-xs font-medium mb-3">How it works</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="text-center flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-white text-xs font-medium" style={{ backgroundColor: '#9A3E3E' }}>1</div>
              <span>Get code</span>
            </div>
            <div className="text-gray-300">→</div>
            <div className="text-center flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-white text-xs font-medium" style={{ backgroundColor: '#9A3E3E' }}>2</div>
              <span>Share code</span>
            </div>
            <div className="text-gray-300">→</div>
            <div className="text-center flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-white text-xs font-medium" style={{ backgroundColor: '#9A3E3E' }}>3</div>
              <span>Transfer</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center gap-3">
            <span className="text-gray-400 text-xs">Built by Rishabh Kanojiya</span>
            <div className="flex items-center gap-2">
              <a 
                href="https://github.com/rishexx" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="GitHub"
              >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a 
                href="https://linkedin.com/in/rishabhhkanojiya" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="LinkedIn"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
