import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedDoc, VerificationStatus, VerificationResult } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Using gemini-3-pro-preview for complex coding tasks as per guidelines
const MODEL_NAME = 'gemini-3-pro-preview';

export const generateDocumentation = async (fileName: string, fileContent: string): Promise<Omit<GeneratedDoc, 'verification' | 'lastUpdated'>> => {
  const prompt = `
    You are DocSync, an elite technical documentation generator.
    Analyze the following source code from file "${fileName}".
    
    Generate structured documentation including:
    1. A concise summary of what the file does.
    2. Key sections (Functions, Classes, Exports).
    3. A REALISTIC code example showing how to use the main functionality.
    
    Source Code:
    \`\`\`
    ${fileContent.slice(0, 20000)} // Limit context to avoid overflow
    \`\`\`
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: "You are a senior developer documentation expert. Be concise, technical, and accurate.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING },
          summary: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                codeExample: { type: Type.STRING, description: "A standalone executable example code snippet" }
              }
            }
          }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  throw new Error("Failed to generate documentation");
};

export const verifyCodeExample = async (
  fileName: string, 
  sourceCode: string, 
  exampleCode: string
): Promise<VerificationResult> => {
  
  const prompt = `
    Act as a strict Compiler and Runtime Environment.
    
    Task: Verify if the provided "Example Code" is valid and runnable given the "Source Code".
    
    Rules:
    1. Check for import errors (assume the source file is available as a module).
    2. Check for type mismatches, missing arguments, or wrong function signatures.
    3. Simulate the execution logic steps.
    
    Source Code ("${fileName}"):
    \`\`\`
    ${sourceCode.slice(0, 15000)}
    \`\`\`
    
    Example Code to Verify:
    \`\`\`
    ${exampleCode}
    \`\`\`
    
    Output JSON with:
    - status: "SUCCESS" or "FAILED"
    - logs: Simulated console output or error trace.
    - fixedCode: If failed, provide the corrected working code. If success, leave empty or repeat code.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
        // Thinking budget to allow deeper analysis of code logic
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                status: { type: Type.STRING, enum: ["SUCCESS", "FAILED"] },
                logs: { type: Type.STRING },
                fixedCode: { type: Type.STRING }
            }
        }
    }
  });

  if (response.text) {
    const data = JSON.parse(response.text);
    return {
        status: data.status === 'SUCCESS' ? VerificationStatus.SUCCESS : VerificationStatus.FAILED,
        logs: data.logs,
        fixedCode: data.fixedCode
    };
  }

  return {
    status: VerificationStatus.FAILED,
    logs: "Verification process failed to return a valid response.",
  };
};