export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
  sha: string;
}

export enum VerificationStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface DocSection {
  title: string;
  content: string;
  codeExample?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  logs: string;
  fixedCode?: string;
}

export interface GeneratedDoc {
  filePath: string;
  summary: string;
  sections: DocSection[];
  verification: VerificationResult;
  lastUpdated: string;
}

export type ProcessingState = 'IDLE' | 'FETCHING' | 'ANALYZING' | 'VERIFYING' | 'COMPLETE' | 'ERROR';