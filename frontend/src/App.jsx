import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 flex flex-col font-sans">
      
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between p-6 bg-slate-900/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            VITE + TAILWIND
          </span>
        </div>
        <div className="flex gap-6 text-sm font-medium text-slate-300">
          <a href="#" className="hover:text-cyan-400 transition-colors">Home</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Features</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Docs</a>
        </div>
      </nav>

      {/* Hero / Main Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          Empower Your React Apps with <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500">
            Utility-First Styling
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl">
          This template is fully configured using React state hooks and utility classes. 
          Edit <code className="bg-slate-800 text-cyan-300 px-2 py-1 rounded text-sm font-mono border border-slate-700">src/App.jsx</code> to build something incredible.
        </p>

        {/* Interactive Interactive Counter Component */}
        <div className="bg-slate-800/40 p-8 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-sm max-w-md w-full mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">State Management Test</p>
          <div className="text-4xl font-bold mb-4 text-cyan-400">{count}</div>
          <button 
            onClick={() => setCount(count + 1)}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-200"
          >
            Increment Counter
          </button>
        </div>

        {/* Feature Grid Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-cyan-500/50 transition-all duration-300">
            <h3 className="text-lg font-bold text-white mb-2">⚡ Lightning Fast</h3>
            <p className="text-sm text-slate-400">Powered by the modern bundlers for instant Hot Module Replacement (HMR).</p>
          </div>
          <div className="p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-teal-500/50 transition-all duration-300">
            <h3 className="text-lg font-bold text-white mb-2">🎨 Custom Designs</h3>
            <p className="text-sm text-slate-400">Build custom architectures seamlessly using inline semantic classes without writing messy CSS.</p>
          </div>
          <div className="p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-blue-500/50 transition-all duration-300">
            <h3 className="text-lg font-bold text-white mb-2">📱 Fully Responsive</h3>
            <p className="text-sm text-slate-400">Mobile-first out of the box with quick break-point modifiers like md: and lg: layouts.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-slate-800 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Your Project. Built with React and Tailwind CSS.
      </footer>

    </div>
  );
}
