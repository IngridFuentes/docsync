import React from 'react';
import { FileNode } from '../types';

interface FileTreeProps {
  files: FileNode[];
  onSelectFile: (file: FileNode) => void;
  selectedFile: FileNode | null;
  currentPath: string;
  onNavigateUp: () => void;
}

const FileItem: React.FC<{ file: FileNode; onSelect: (f: FileNode) => void; isSelected: boolean }> = ({ file, onSelect, isSelected }) => {
  const getIcon = (type: string, name: string) => {
    if (type === 'dir') return '📁';
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TS';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'JS';
    if (name.endsWith('.json')) return '{}';
    if (name.endsWith('.md')) return 'MD';
    if (name.endsWith('.css')) return '#';
    return '📄';
  };

  return (
    <div 
      onClick={() => onSelect(file)}
      className={`
        flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-mono border-l-2 transition-colors select-none
        ${isSelected 
          ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
          : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}
      `}
    >
      <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded ${file.type === 'dir' ? '' : 'bg-zinc-800'}`}>
        {getIcon(file.type, file.name)}
      </span>
      <span className="truncate">{file.name}</span>
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ files, onSelectFile, selectedFile, currentPath, onNavigateUp }) => {
  return (
    <div className="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Explorer</h3>
        <p className="text-[10px] text-zinc-600 truncate font-mono">
            /{currentPath}
        </p>
      </div>
      <div className="overflow-y-auto flex-1 py-2">
        {currentPath !== '' && (
            <div 
                onClick={onNavigateUp}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-mono border-l-2 border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 mb-2"
            >
                <span className="w-5 h-5 flex items-center justify-center text-lg">🔙</span>
                <span>..</span>
            </div>
        )}
        
        {files.length === 0 && (
            <div className="p-4 text-center text-zinc-600 text-xs">
                Empty directory
            </div>
        )}
        {files.map((file) => (
          <FileItem 
            key={file.path} 
            file={file} 
            onSelect={onSelectFile} 
            isSelected={selectedFile?.path === file.path}
          />
        ))}
      </div>
    </div>
  );
};