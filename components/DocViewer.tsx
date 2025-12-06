import React from 'react';
import { GeneratedDoc, VerificationStatus } from '../types';

interface DocViewerProps {
  doc: GeneratedDoc | null;
  isLoading: boolean;
  onVerify: () => void;
  isVerifying: boolean;
}

export const DocViewer: React.FC<DocViewerProps> = ({ doc, isLoading, onVerify, isVerifying }) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="animate-pulse">Analyzing code structure & generating docs...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <p>Select a file to view auto-generated documentation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0c0c0e]">
      {/* Header */}
      <div className="p-8 pb-4 border-b border-zinc-800/50">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h1 className="text-2xl font-bold text-white mb-2 font-mono">{doc.filePath}</h1>
                <p className="text-zinc-400 leading-relaxed max-w-2xl">{doc.summary}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                 <span className="text-[10px] text-zinc-600 font-mono">
                    LAST SYNC: {new Date(doc.lastUpdated).toLocaleTimeString()}
                </span>
                 <div className={`
                    px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2
                    ${doc.verification.status === VerificationStatus.SUCCESS ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400' : 
                      doc.verification.status === VerificationStatus.FAILED ? 'bg-red-900/30 border-red-700/50 text-red-400' :
                      'bg-zinc-800 border-zinc-700 text-zinc-400'}
                 `}>
                    <span className={`w-2 h-2 rounded-full ${
                        doc.verification.status === VerificationStatus.SUCCESS ? 'bg-emerald-500' :
                        doc.verification.status === VerificationStatus.FAILED ? 'bg-red-500' :
                        'bg-zinc-500'
                    }`}></span>
                    {doc.verification.status === VerificationStatus.SUCCESS ? 'VERIFIED WORKING' :
                     doc.verification.status === VerificationStatus.FAILED ? 'VERIFICATION FAILED' :
                     'UNVERIFIED'}
                 </div>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 space-y-12">
        {doc.sections.map((section, idx) => (
          <div key={idx} className="group">
            <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <span className="opacity-50 font-mono text-sm">0{idx+1}.</span>
                {section.title}
            </h2>
            <div className="prose prose-invert max-w-none text-zinc-300 mb-6">
              <p>{section.content}</p>
            </div>
            
            {section.codeExample && (
              <div className="mt-4 bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden relative">
                 <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-xs font-mono text-zinc-500">EXAMPLE USAGE</span>
                    {doc.verification.status !== VerificationStatus.SUCCESS && !isVerifying && (
                        <button 
                            onClick={onVerify}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded transition-colors"
                        >
                            Run Verification
                        </button>
                    )}
                    {isVerifying && (
                         <span className="text-xs text-emerald-400 animate-pulse">Running Vibe Check...</span>
                    )}
                 </div>
                 <div className="p-4 overflow-x-auto">
                    <pre className="text-sm font-mono text-zinc-100">
                        {section.codeExample}
                    </pre>
                 </div>
                 
                 {/* Verification Overlay/Result */}
                 {doc.verification.status !== VerificationStatus.IDLE && (
                     <div className={`border-t ${doc.verification.status === VerificationStatus.SUCCESS ? 'border-emerald-900/50 bg-emerald-900/10' : 'border-red-900/50 bg-red-900/10'} p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                             <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                                {doc.verification.status === VerificationStatus.SUCCESS ? 'Console Output' : 'Error Log'}
                             </span>
                        </div>
                        <pre className={`font-mono text-xs ${doc.verification.status === VerificationStatus.SUCCESS ? 'text-zinc-400' : 'text-red-300'}`}>
                            {doc.verification.logs}
                        </pre>
                        {doc.verification.fixedCode && (
                            <div className="mt-4">
                                <span className="text-xs font-bold text-emerald-500 block mb-2">SUGGESTED FIX (AUTO-GENERATED):</span>
                                <pre className="font-mono text-xs text-emerald-200/80 bg-black/20 p-2 rounded">
                                    {doc.verification.fixedCode}
                                </pre>
                            </div>
                        )}
                     </div>
                 )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};