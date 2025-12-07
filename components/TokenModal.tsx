import React, { useState } from 'react';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (token: string) => void;
  isRateLimited: boolean;
}

export const TokenModal: React.FC<TokenModalProps> = ({ isOpen, onClose, onSubmit, isRateLimited }) => {
  const [token, setToken] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
        onSubmit(token.trim());
        setToken('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-6 relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
        >
            ✕
        </button>
        
        <div className="mb-6">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${isRateLimited ? 'text-red-400' : 'text-white'}`}>
               {isRateLimited ? (
                   <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Rate Limit Exceeded
                   </>
               ) : (
                   'GitHub API Settings'
               )}
            </h2>
            <p className="text-sm text-zinc-400 mt-2">
                {isRateLimited 
                    ? "GitHub has temporarily blocked your IP (60 req/hr). Add a free Personal Access Token to continue immediately (5000 req/hr)."
                    : "Add a token to increase your API rate limits from 60 to 5000 requests per hour."}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label className="text-xs font-mono text-zinc-500 mb-1 block">PERSONAL ACCESS TOKEN</label>
                <div className="flex gap-2">
                     <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="flex-1 bg-black/50 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                        autoFocus
                    />
                </div>
            </div>
            
            <div className="flex items-center justify-between">
                <a 
                    href="https://github.com/settings/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                    Get Token (Free) ↗
                </a>
                <button
                    type="submit"
                    disabled={!token}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save & Continue
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};