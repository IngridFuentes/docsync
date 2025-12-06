import React, { useState, useEffect } from 'react';
import { RepoInput } from './components/RepoInput';
import { FileTree } from './components/FileTree';
import { DocViewer } from './components/DocViewer';
import { fetchRepoContents, fetchFileContent, parseRepoUrl } from './services/github';
import { generateDocumentation, verifyCodeExample } from './services/gemini';
import { FileNode, ProcessingState, GeneratedDoc, VerificationStatus } from './types';

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [docState, setDocState] = useState<Record<string, GeneratedDoc>>({});
  const [status, setStatus] = useState<ProcessingState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{owner: string, repo: string} | null>(null);

  const handleRepoSubmit = async (url: string) => {
    setStatus('FETCHING');
    setErrorMsg(null);
    setRepoUrl(url);
    const parsed = parseRepoUrl(url);
    
    if (!parsed) {
      setErrorMsg("Invalid GitHub URL");
      setStatus('ERROR');
      return;
    }

    setRepoInfo(parsed);

    try {
      const rootFiles = await fetchRepoContents(parsed.owner, parsed.repo);
      // Filter for code files only for the demo to keep it clean
      const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
      const filteredFiles = rootFiles.filter(f => 
        f.type === 'file' && validExtensions.some(ext => f.name.endsWith(ext))
      );
      
      setFiles(filteredFiles);
      setStatus('IDLE');
      
      if (filteredFiles.length === 0) {
        setErrorMsg("No supported code files found in root directory.");
      }

    } catch (e: any) {
      setErrorMsg(e.message || "Failed to fetch repo");
      setStatus('ERROR');
    }
  };

  const handleFileSelect = async (file: FileNode) => {
    setSelectedFile(file);
    if (!docState[file.path]) {
      // Generate doc if not exists
      await processFile(file);
    }
  };

  const processFile = async (file: FileNode) => {
    if (!repoInfo) return;

    setStatus('ANALYZING');
    try {
      const content = await fetchFileContent(repoInfo.owner, repoInfo.repo, file.path);
      
      const generated = await generateDocumentation(file.name, content);
      
      const newDoc: GeneratedDoc = {
        ...generated,
        verification: { status: VerificationStatus.IDLE, logs: '' },
        lastUpdated: new Date().toISOString()
      };

      setDocState(prev => ({ ...prev, [file.path]: newDoc }));
      setStatus('IDLE');

      // Auto-trigger verification for better UX? 
      // Let's let user trigger it manually to see the "Vibe Debugging" loop action
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Failed to generate docs for ${file.name}`);
      setStatus('ERROR');
    }
  };

  const handleVerify = async () => {
    if (!selectedFile || !repoInfo || !docState[selectedFile.path]) return;
    
    const doc = docState[selectedFile.path];
    // Find the first section with code example
    const exampleSection = doc.sections.find(s => s.codeExample);
    if (!exampleSection || !exampleSection.codeExample) return;

    setStatus('VERIFYING');
    
    try {
        const sourceCode = await fetchFileContent(repoInfo.owner, repoInfo.repo, selectedFile.path);
        const result = await verifyCodeExample(selectedFile.name, sourceCode, exampleSection.codeExample);
        
        setDocState(prev => ({
            ...prev,
            [selectedFile.path]: {
                ...prev[selectedFile.path],
                verification: result
            }
        }));
    } catch (e) {
        console.error(e);
    } finally {
        setStatus('IDLE');
    }
  };

  return (
    <div className="h-screen w-screen bg-[#09090b] text-white overflow-hidden flex flex-col">
      {/* Navbar */}
      <header className="h-16 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-900/50 backdrop-blur-sm z-10">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
             <div className="z-10 w-full max-w-2xl text-center">
                <h2 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                    Documentation that <br/> <span className="text-emerald-500">proves itself</span>.
                </h2>
                <p className="text-zinc-400 mb-12 text-lg">
                    Point DocSync at any GitHub repo. It generates documentation and runs verification loops to ensure every code example actually works.
                </p>
                <RepoInput onSubmit={handleRepoSubmit} isLoading={status === 'FETCHING'} />
                {errorMsg && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm animate-fade-in">
                        Error: {errorMsg}
                    </div>
                )}
             </div>
          </div>
        ) : (
          <>
            <FileTree 
              files={files} 
              selectedFile={selectedFile} 
              onSelectFile={handleFileSelect} 
            />
            <DocViewer 
              doc={selectedFile ? docState[selectedFile.path] : null} 
              isLoading={status === 'ANALYZING'}
              onVerify={handleVerify}
              isVerifying={status === 'VERIFYING'}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;