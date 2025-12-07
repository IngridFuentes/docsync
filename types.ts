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
  sourceSha: string;
  summary: string;
  sections: DocSection[];
  verification: VerificationResult;
  lastUpdated: string;
  language?: string; // Track the language of the doc
}

export type ProcessingState = 'IDLE' | 'FETCHING' | 'ANALYZING' | 'VERIFYING' | 'TRANSLATING' | 'COMPLETE' | 'ERROR';