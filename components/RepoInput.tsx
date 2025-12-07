import React, { useState, useEffect } from 'react';

interface RepoInputProps {
  onSubmit: (url: string, token: string) => void;
  isLoading: boolean;
  autoExpandToken?: boolean;
}

export const RepoInput: React.FC<RepoInputProps> = ({ onSubmit, isLoading, autoExpandToken }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Automatically expand token field if instructed (e.g. after rate limit error)
  useEffect(() => {
    if (autoExpandToken) {
      setShowToken(true);
    }
  }, [autoExpandToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), token.trim());
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <form onSubmit={handleSubmit} className="relative group flex flex-col gap-4">
        
        {/* Repo URL Input */}
        <div className="relative">
             <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-sky-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
             <div className="relative flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800 focus-within:border-zinc-700 shadow-xl">
                <div className="pl-4 pr-2 text-zinc-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full bg-transparent text-white placeholder-zinc-500 px-3 py-3 outline-none font-mono text-sm"
                disabled={isLoading}
                />
                <button
                type="submit"
                disabled={isLoading || !url}
                className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-300
                    ${isLoading 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/20'
                    }`}
                >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Syncing...
                    </span>
                ) : 'Analyze Repo'}
                </button>
            </div>
        </div>

        {/* Optional Token Input */}
        <div className="flex flex-col items-start gap-1">
            <button 
                type="button" 
                onClick={() => setShowToken(!showToken)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 flex items-center gap-1"
            >
                {showToken ? 'Hide' : 'Add'} GitHub Token (Optional)
                <span className={`text-[10px] px-1 rounded no-underline ${autoExpandToken ? 'bg-red-900/50 text-red-200' : 'bg-zinc-800'}`}>
                    {autoExpandToken ? 'Required for Rate Limits' : 'Avoid Rate Limits'}
                </span>
            </button>
            
            {showToken && (
                <div className="w-full animate-fade-in-down">
                    <div className="flex gap-2">
                         <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            className={`flex-1 bg-zinc-900/50 border rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 ${autoExpandToken ? 'border-red-900/50 focus:border-red-500' : 'border-zinc-800'}`}
                        />
                        <a 
                            href="https://github.com/settings/tokens" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-2 rounded text-xs flex items-center whitespace-nowrap transition-colors"
                        >
                            Get Token ↗
                        </a>
                    </div>
                   
                     <p className="text-[10px] text-zinc-600 mt-1">
                        Token is only used for this session. Select "Public Repo" scope.
                    </p>
                </div>
            )}
        </div>

      </form>
      <div className="flex justify-between mt-6 px-2">
        <p className="text-xs text-zinc-500">Supported: Public GitHub Repositories</p>
        <p className="text-xs text-zinc-500">Powered by Gemini 3.0</p>
      </div>
    </div>
  );
};