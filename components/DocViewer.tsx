import React, { useState } from 'react';
import { GeneratedDoc, VerificationStatus } from '../types';

interface DocViewerProps {
  doc: GeneratedDoc | null;
  isLoading: boolean;
  onVerify: () => void;
  onApplyFix: (fixedCode: string) => void;
  onTranslate: (lang: string) => void;
  isVerifying: boolean;
  isTranslating: boolean;
}

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
];

export const DocViewer: React.FC<DocViewerProps> = ({ doc, isLoading, onVerify, onApplyFix, onTranslate, isVerifying, isTranslating }) => {
  const [showLangMenu, setShowLangMenu] = useState(false);

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

  // Double safety check
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const currentLang = LANGUAGES.find(l => l.code === (doc.language || 'en')) || LANGUAGES[0];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0c0c0e]">
      {/* Header */}
      <div className="p-8 pb-4 border-b border-zinc-800/50">
        <div className="flex justify-between items-start mb-4">
            <div className="flex-1 pr-4">
                <h1 className="text-2xl font-bold text-white mb-2 font-mono break-all">{doc.filePath}</h1>
                <div className="relative">
                     {isTranslating ? (
                         <div className="h-6 w-full max-w-xl bg-zinc-800 rounded animate-pulse"></div>
                     ) : (
                         <p className="text-zinc-400 leading-relaxed max-w-2xl">{doc.summary}</p>
                     )}
                </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
                 <div className="flex items-center gap-2">
                     {/* Language Selector */}
                     <div className="relative">
                        <button 
                            onClick={() => setShowLangMenu(!showLangMenu)}
                            disabled={isTranslating}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs border border-zinc-700 transition-colors disabled:opacity-50"
                        >
                            <span className="text-sm">{isTranslating ? '⏳' : currentLang.flag}</span>
                            <span>{currentLang.name}</span>
                            <svg className="w-3 h-3 ml-1 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        
                        {showLangMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded shadow-xl z-20 py-1">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => {
                                                setShowLangMenu(false);
                                                onTranslate(lang.code);
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3"
                                        >
                                            <span className="text-base">{lang.flag}</span>
                                            {lang.name}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                     </div>

                     <span className="text-[10px] text-zinc-600 font-mono hidden xl:block">
                        SHA: {doc.sourceSha ? doc.sourceSha.substring(0, 7) : 'N/A'}
                    </span>
                 </div>
                 
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
        {sections.length === 0 && (
            <div className="text-zinc-500 italic">No structured sections generated for this file.</div>
        )}
        {sections.map((section, idx) => (
          <div key={idx} className="group">
            <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <span className="opacity-50 font-mono text-sm">0{idx+1}.</span>
                {isTranslating ? <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse"></div> : section.title}
            </h2>
            <div className="prose prose-invert max-w-none text-zinc-300 mb-6">
               {isTranslating ? (
                   <div className="space-y-2">
                       <div className="h-3 w-full bg-zinc-800 rounded animate-pulse"></div>
                       <div className="h-3 w-3/4 bg-zinc-800 rounded animate-pulse"></div>
                   </div>
               ) : (
                   <p>{section.content}</p>
               )}
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
                        <div className="flex items-center gap-2 mb-2 justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                                    {doc.verification.status === VerificationStatus.SUCCESS ? 'Console Output' : 'Verification Issues'}
                                </span>
                             </div>
                             {doc.verification.status === VerificationStatus.FAILED && doc.verification.fixedCode && (
                                 <button 
                                    onClick={() => doc.verification.fixedCode && onApplyFix(doc.verification.fixedCode)}
                                    className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2 py-1 rounded border border-emerald-500/30 transition-colors"
                                 >
                                    Apply AI Fix
                                 </button>
                             )}
                        </div>
                        <pre className={`font-mono text-xs ${doc.verification.status === VerificationStatus.SUCCESS ? 'text-zinc-400' : 'text-red-300'}`}>
                            {doc.verification.logs}
                        </pre>
                        {doc.verification.fixedCode && doc.verification.status === VerificationStatus.FAILED && (
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