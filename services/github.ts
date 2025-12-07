import { FileNode } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

// Helper to clean URL
export const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const urlObj = new URL(url);
    // Remove .git suffix if present
    const cleanPath = urlObj.pathname.replace(/\.git$/, '');
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch (e) {
    return null;
  }
};

const handleGitHubError = async (response: Response) => {
  let errorMessage = `GitHub API Error: ${response.status} ${response.statusText}`;
  
  // Check headers for rate limit first as it's definitive
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
     throw new Error("GitHub API Rate Limit Exceeded. Please add a Token to increase limits (60 -> 5000 req/hr).");
  }

  try {
    const errorData = await response.json();
    if (errorData.message) {
      errorMessage = errorData.message;
      
      const lowerMsg = errorData.message.toLowerCase();
      if (response.status === 403 && (lowerMsg.includes('rate limit') || lowerMsg.includes('secondary rate limit'))) {
        errorMessage = "GitHub API Rate Limit Exceeded. Please add a Token to increase limits (60 -> 5000 req/hr).";
      } else if (response.status === 404) {
        errorMessage = "Repository or file not found. Please check the URL and ensure the repository is public.";
      } else if (response.status === 401) {
        errorMessage = "Unauthorized. Please check your GitHub Token permissions.";
      }
    }
  } catch (e) {
    // If we can't parse JSON, keep the default status text error
  }
  throw new Error(errorMessage);
};

const getHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
};

// New: Fetch Repository Details to get default branch
export const fetchRepoDetails = async (owner: string, repo: string, token?: string) => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
        headers: getHeaders(token)
    });
    if (!response.ok) await handleGitHubError(response);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch repo details:", error);
    throw error;
  }
}

// New: Fetch Recursive Tree (1 API Call for whole repo)
export const fetchRepoTree = async (owner: string, repo: string, branch: string, token?: string): Promise<FileNode[]> => {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
            headers: getHeaders(token)
        });
        if (!response.ok) await handleGitHubError(response);
        
        const data = await response.json();
        
        if (data.tree && Array.isArray(data.tree)) {
            return data.tree.map((item: any) => ({
                name: item.path.split('/').pop() || item.path, // Get just the filename from path
                path: item.path, // Full path
                type: item.type === 'blob' ? 'file' : 'dir',
                sha: item.sha,
                content: undefined
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch git tree:", error);
        throw error;
    }
}

// Legacy method kept for fallback or specific single-dir fetches if needed
export const fetchRepoContents = async (owner: string, repo: string, path: string = '', token?: string): Promise<FileNode[]> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
      headers: getHeaders(token)
    });
    
    if (!response.ok) {
      await handleGitHubError(response);
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

export const fetchFileContent = async (owner: string, repo: string, path: string, token?: string): Promise<string> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
      headers: getHeaders(token)
    });
    
    if (!response.ok) {
      await handleGitHubError(response);
    }
    const data = await response.json();
    // GitHub API returns content as base64
    if (data.content && data.encoding === 'base64') {
      // Decode base64, handling newlines properly
      const binaryString = atob(data.content.replace(/\n/g, ''));
      // Handle UTF-8 characters correctly
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    }
    throw new Error("Could not decode file content: Encoding not supported or content missing");
  } catch (error) {
    console.error("Failed to fetch file content:", error);
    throw error;
  }
};