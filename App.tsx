import React, { useState, useEffect } from 'react';
import { RepoInput } from './components/RepoInput';
import { FileTree } from './components/FileTree';
import { DocViewer } from './components/DocViewer';
import { TokenModal } from './components/TokenModal';
import { fetchRepoDetails, fetchRepoTree, fetchFileContent, parseRepoUrl } from './services/github';
import { generateDocumentation, verifyCodeExample, translateDocumentation } from './services/gemini';
import { FileNode, ProcessingState, GeneratedDoc, VerificationStatus } from './types';

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [allFiles, setAllFiles] = useState<FileNode[]>([]); // Store ALL files here
  const [visibleFiles, setVisibleFiles] = useState<FileNode[]>([]); // Store current view
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  
  // Doc State: Stores the English/Original versions primarily
  const [docState, setDocState] = useState<Record<string, GeneratedDoc>>({});
  
  // Translation Cache: Stores translated versions to avoid re-fetching
  // Key format: "filePath:langCode" (e.g., "src/utils.ts:es")
  const [translationCache, setTranslationCache] = useState<Record<string, GeneratedDoc>>({});

  const [status, setStatus] = useState<ProcessingState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{owner: string, repo: string} | null>(null);
  
  // Token Modal State
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  // Auto-open modal on rate limit if we are already viewing files
  useEffect(() => {
    if (errorMsg && errorMsg.includes('Rate Limit') && allFiles.length > 0) {
        setIsTokenModalOpen(true);
    }
  }, [errorMsg, allFiles.length]);

  // Helper to filter the flat file list for the current folder view
  const updateVisibleFiles = (fullList: FileNode[], path: string) => {
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.css', '.html', '.json', '.md'];
    
    // Logic:
    // 1. Must start with path
    // 2. Remove path prefix
    // 3. If remaining string has no '/', it's a direct child
    
    const filtered = fullList.filter(file => {
        if (!file.path.startsWith(path ? path + '/' : '')) {
            // Special handling for root files when path is empty string
            if (path === '' && !file.path.includes('/')) return true;
            return false;
        }
        
        const relativePath = path ? file.path.slice(path.length + 1) : file.path;
        return !relativePath.includes('/');
    }).filter(f => 
        // Show all dirs, but filter files by extension
        f.type === 'dir' || validExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
    );

    // Sort: Directories first, then files
    filtered.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
    });

    setVisibleFiles(filtered);
    setCurrentPath(path);
  };

  const handleRepoSubmit = async (url: string, token: string) => {
    const parsed = parseRepoUrl(url);
    if (!parsed) {
      setErrorMsg("Invalid GitHub URL");
      setStatus('ERROR');
      return;
    }
    
    // Reset state for new repo
    setRepoInfo(parsed);
    setRepoUrl(url);
    setGithubToken(token);
    setAllFiles([]);
    setVisibleFiles([]);
    setDocState({});
    setTranslationCache({});
    setSelectedFile(null);
    setCurrentPath('');
    setErrorMsg(null);
    setStatus('FETCHING');
    
    try {
        // 1. Get default branch
        const details = await fetchRepoDetails(parsed.owner, parsed.repo, token);
        const defaultBranch = details.default_branch || 'main';

        // 2. Get recursive tree (One Call!)
        const treeFiles = await fetchRepoTree(parsed.owner, parsed.repo, defaultBranch, token);
        
        if (treeFiles.length === 0) {
            setErrorMsg("Repository is empty or not found.");
            setStatus('IDLE');
            return;
        }

        setAllFiles(treeFiles);
        
        // 3. Show root
        updateVisibleFiles(treeFiles, '');
        setStatus('IDLE');
        
    } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "Failed to load repository");
        setStatus('ERROR');
    }
  };

  const handleNavigateUp = () => {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      updateVisibleFiles(allFiles, parentPath);
  };

  const handleFileSelect = async (file: FileNode) => {
    if (file.type === 'dir') {
        updateVisibleFiles(allFiles, file.path);
        return;
    }

    setSelectedFile(file);
    
    // Check if doc exists AND if SHA matches (Auto-detect code change)
    // We always start with the base (English) doc logic here
    const existingDoc = docState[file.path];
    if (!existingDoc || existingDoc.sourceSha !== file.sha) {
      await processFile(file);
    }
  };

  const processFile = async (file: FileNode) => {
    if (!repoInfo) return;

    setStatus('ANALYZING');
    try {
      const content = await fetchFileContent(repoInfo.owner, repoInfo.repo, file.path, githubToken);
      
      const generated = await generateDocumentation(file.name, content);
      
      const newDoc: GeneratedDoc = {
        ...generated,
        sourceSha: file.sha,
        verification: { status: VerificationStatus.IDLE, logs: '' },
        lastUpdated: new Date().toISOString()
      };

      setDocState(prev => ({ ...prev, [file.path]: newDoc }));
      // Clear old translations for this file as they are now stale
      setTranslationCache(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
              if (key.startsWith(file.path + ':')) delete next[key];
          });
          return next;
      });
      setStatus('IDLE');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Failed to generate docs: ${e.message}`);
      setStatus('ERROR');
    }
  };

  const handleVerify = async () => {
    if (!selectedFile || !repoInfo) return;
    
    // Always verify against the CURRENT view (whether translated or not)
    // But conceptually, verification code example is language-agnostic.
    // However, we want to update the `docState` (master) and potentially the cache.
    // For simplicity: Verification updates the BASE doc.
    
    const currentDoc = getCurrentDoc(); // Helper to get what's on screen
    if (!currentDoc) return;

    const exampleSection = currentDoc.sections?.find(s => s.codeExample);
    if (!exampleSection || !exampleSection.codeExample) return;

    setStatus('VERIFYING');
    
    try {
        const sourceCode = await fetchFileContent(repoInfo.owner, repoInfo.repo, selectedFile.path, githubToken);
        const result = await verifyCodeExample(selectedFile.name, sourceCode, exampleSection.codeExample);
        
        // Update Base Doc State
        setDocState(prev => ({
            ...prev,
            [selectedFile.path]: {
                ...prev[selectedFile.path],
                verification: result
            }
        }));

        // Also update any cached translations for this file so they reflect the new verification status
        setTranslationCache(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                if (key.startsWith(selectedFile.path + ':')) {
                    next[key] = { ...next[key], verification: result };
                }
            });
            return next;
        });

    } catch (e) {
        console.error(e);
        setErrorMsg("Verification failed: " + (e as any).message);
    } finally {
        setStatus('IDLE');
    }
  };

  const handleTranslate = async (targetLang: string) => {
      if (!selectedFile || !docState[selectedFile.path]) return;
      
      // If asking for English, just ensure we aren't showing a cached translation?
      // Actually, since docState holds the English/Base, we just need to ensure UI picks it up.
      // But we can just use the generic cache logic. 'en' maps to docState basically.
      if (targetLang === 'en') {
          // No op, just force re-render via state logic
          return;
      }

      const cacheKey = `${selectedFile.path}:${targetLang}`;
      if (translationCache[cacheKey]) {
          return; // Already have it, View will pick it up
      }

      setStatus('TRANSLATING');
      try {
          // Use the base doc to translate from
          const baseDoc = docState[selectedFile.path];
          const translated = await translateDocumentation(baseDoc, targetLang);
          
          setTranslationCache(prev => ({
              ...prev,
              [cacheKey]: translated
          }));
      } catch (e) {
          console.error(e);
          setErrorMsg("Translation failed");
      } finally {
          setStatus('IDLE');
      }
  };

  // Logic to determine which doc object to pass to the viewer
  // We need local state for "Selected Language" to know which cache entry to read.
  // Actually, let's keep it simple: We need to know what lang the user WANTS to see.
  // We can lift the 'currentLang' state to App, or simply pass the *active* doc to Viewer.
  // Let's create a temporary state for `viewLanguage`
  const [viewLanguage, setViewLanguage] = useState('en');

  // Reset language to EN when file changes
  useEffect(() => {
      setViewLanguage('en');
  }, [selectedFile?.path]);

  const getCurrentDoc = () => {
      if (!selectedFile) return null;
      if (viewLanguage === 'en') return docState[selectedFile.path];
      
      const cacheKey = `${selectedFile.path}:${viewLanguage}`;
      return translationCache[cacheKey] || docState[selectedFile.path]; // Fallback to base if translation missing (loading)
  };

  const handleApplyFix = (fixedCode: string) => {
    if (!selectedFile || !docState[selectedFile.path]) return;
    
    // Update BASE doc
    setDocState(prev => {
        const doc = prev[selectedFile.path];
        const newSections = (doc.sections || []).map(section => {
            if (section.codeExample) {
                return { ...section, codeExample: fixedCode };
            }
            return section;
        });

        const updatedDoc = {
            ...doc,
            sections: newSections,
            verification: {
                status: VerificationStatus.IDLE,
                logs: 'Fix applied. Ready for re-verification.',
                fixedCode: undefined
            }
        };

        return { ...prev, [selectedFile.path]: updatedDoc };
    });

    // Clear translations cache because the code example changed (Wait, code example is shared?)
    // Actually, we want to update the code example in all translations too.
    // Easiest is to wipe cache so they re-generate with new code.
    setTranslationCache(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
            if (key.startsWith(selectedFile.path + ':')) delete next[key];
        });
        return next;
    });
  };

  const handleUpdateToken = (newToken: string) => {
      setGithubToken(newToken);
      setIsTokenModalOpen(false);
      setErrorMsg(null);
  };

  const dismissError = () => setErrorMsg(null);

  const currentDoc = getCurrentDoc();

  // Helper wrapper for translation that also updates local view state
  const onTranslateRequest = (lang: string) => {
      setViewLanguage(lang);
      handleTranslate(lang);
  }

  return (
    <div className="h-screen w-screen bg-[#09090b] text-white overflow-hidden flex flex-col relative">
      
      <TokenModal 
        isOpen={isTokenModalOpen} 
        onClose={() => setIsTokenModalOpen(false)} 
        onSubmit={handleUpdateToken}
        isRateLimited={!!errorMsg && errorMsg.includes('Rate Limit')}
      />

      {/* Navbar */}
      <header className="h-16 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-900/50 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">DocSync</h1>
            <p className="text-[10px] text-emerald-500 font-mono tracking-wider">VIBE DEBUGGING ENGINE</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-400">
           <span>{status === 'IDLE' ? 'Ready' : status}</span>
           <div className={`w-2 h-2 rounded-full ${status === 'IDLE' || status === 'COMPLETE' ? 'bg-zinc-600' : 'bg-emerald-500 animate-pulse'}`}></div>
           
           <button 
             onClick={() => setIsTokenModalOpen(true)}
             className="ml-4 p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
             title="GitHub Token Settings"
           >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
           </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {errorMsg && (
         <div className="absolute top-16 left-0 right-0 bg-red-900/90 border-b border-red-700 text-white px-6 py-2 z-50 flex justify-between items-center backdrop-blur">
             <span className="text-sm font-mono flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {errorMsg}
             </span>
             <button onClick={dismissError} className="text-red-200 hover:text-white">✕</button>
         </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {allFiles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
             <div className="z-10 w-full max-w-2xl text-center">
                <h2 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                    Documentation that <br/> <span className="text-emerald-500">proves itself</span>.
                </h2>
                <p className="text-zinc-400 mb-12 text-lg">
                    Point DocSync at any GitHub repo. It generates documentation and runs verification loops to ensure every code example actually works.
                </p>
                <RepoInput 
                    onSubmit={handleRepoSubmit} 
                    isLoading={status === 'FETCHING'} 
                    autoExpandToken={!!errorMsg && (errorMsg.includes('Rate Limit') || errorMsg.includes('Unauthorized'))}
                />
             </div>
          </div>
        ) : (
          <>
            <FileTree 
              files={visibleFiles} 
              selectedFile={selectedFile} 
              onSelectFile={handleFileSelect} 
              currentPath={currentPath}
              onNavigateUp={handleNavigateUp}
            />
            <DocViewer 
              doc={currentDoc} 
              isLoading={status === 'ANALYZING'}
              onVerify={handleVerify}
              onApplyFix={handleApplyFix}
              onTranslate={onTranslateRequest}
              isVerifying={status === 'VERIFYING'}
              isTranslating={status === 'TRANSLATING'}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;