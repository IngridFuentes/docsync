import { FileNode } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

// Helper to clean URL
export const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const fetchRepoContents = async (owner: string, repo: string, path: string = ''): Promise<FileNode[]> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`);
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        content: undefined
      }));
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch repo contents:", error);
    throw error;
  }
};

export const fetchFileContent = async (owner: string, repo: string, path: string): Promise<string> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`);
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    const data = await response.json();
    // GitHub API returns content as base64
    if (data.content && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''));
    }
    throw new Error("Could not decode file content");
  } catch (error) {
    console.error("Failed to fetch file content:", error);
    throw error;
  }
};