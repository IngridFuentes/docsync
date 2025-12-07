import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GeneratedDoc, VerificationStatus, VerificationResult } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// CONFIGURATION
// We use the large model for generating high-quality documentation
const DOCS_MODEL = 'gemini-3-pro-preview';
// We use the flash model for verification and translation because it requires low latency
const VERIFY_MODEL = 'gemini-2.5-flash';

// DISABLE SAFETY FILTERS
// Code analysis often triggers false positives (e.g., 'killProcess', 'execute', 'sanitize', 'parent/child')
const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper to reliably extract JSON from potential markdown or conversational text
const cleanJson = (text: string): string => {
  // Regex to match a JSON object, handling potential newlines and spaces
  // This looks for the first '{' and the last '}' across multiple lines
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
      return match[0];
  }
  return text.trim();
};

// Attempt to repair truncated JSON
const repairAndParseJson = (jsonString: string): any => {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Simple repair: Check if it looks truncated
        // 1. Try closing quotes if the last char isn't a closer
        let repaired = jsonString.trim();
        
        // Very naive repair for common truncation:
        // If it ends with a comma, remove it
        if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);
        
        // Count brackets
        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        const quotes = (repaired.match(/"/g) || []).length;

        // If odd quotes, close the string
        if (quotes % 2 !== 0) repaired += '"';
        
        // Close arrays/objects
        if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);
        if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);

        try {
            return JSON.parse(repaired);
        } catch (e2) {
            return null; // Repair failed
        }
    }
}

// Fallback: Scavenge for data using Regex if JSON.parse fails (Vibe Parsing)
const resilientParse = (text: string, fileName: string): any => {
  try {
    // 1. Try to find the summary
    let summary = "Analysis completed";
    const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/); // Simple match
    if (summaryMatch) summary = summaryMatch[1];

    // 2. Try to find sections manually by splitting the string
    // This is a "dirty" parser that scans for objects resembling section structure
    const sections: any[] = [];
    
    // Regex that looks for title/content pairs, non-global first to test
    // We iterate manually to handle nesting issues better
    const parts = text.split(/"title"\s*:\s*"/);
    
    // Skip the first part (header garbage)
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        
        // Extract title (everything until the next quote)
        const titleEnd = part.indexOf('"');
        if (titleEnd === -1) continue;
        const title = part.substring(0, titleEnd);
        
        // Find content
        let content = "Content missing";
        const contentMatch = part.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (contentMatch) {
            content = contentMatch[1];
        }

        // Find code example
        let codeExample = undefined;
        const codeMatch = part.match(/"codeExample"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (codeMatch) {
            codeExample = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        
        sections.push({
            title: title,
            content: content,
            codeExample: codeExample
        });
    }

    if (sections.length > 0) {
        return {
            filePath: fileName,
            summary: summary,
            sections: sections
        };
    }
  } catch (e) {
      console.error("Resilient parse error", e);
  }
  return null;
};

// Last Resort: Just return the raw text wrapped in a doc structure
const fallbackRaw = (text: string, fileName: string): any => {
    // Clean up JSON artifacts to make it readable
    const cleanText = text.replace(/[{"}]/g, '').replace(/summary:/g, '').trim();
    return {
        filePath: fileName,
        summary: "Raw Analysis Output (JSON Parse Failed)",
        sections: [{
            title: "Analysis",
            content: cleanText.slice(0, 1000) + (cleanText.length > 1000 ? "..." : ""),
            codeExample: "// Code example unavailable due to formatting error"
        }]
    };
};

export const generateDocumentation = async (fileName: string, fileContent: string): Promise<Omit<GeneratedDoc, 'verification' | 'lastUpdated' | 'sourceSha'>> => {
  // 1. Minified Code Detection
  if (fileContent.split('\n').some(line => line.length > 1000)) {
       return {
           filePath: fileName,
           summary: "Skipped: File appears to be minified or generated code.",
           sections: [
               {
                   title: "Analysis Skipped",
                   content: "This file contains extremely long lines (1000+ chars), suggesting it is minified or machine-generated.",
                   codeExample: "// No example available"
               }
           ],
           language: 'en'
       };
  }

  // 2. Reduce input context to prevent token overflow.
  const trimmedContent = fileContent.slice(0, 10000);
  
  const prompt = `
    You are DocSync, an expert Senior Technical Writer and Software Engineer.
    Analyze the following source code and generate clear, human-readable documentation.

    Target Audience: Other developers who need to understand this file quickly.

    Source Code (Truncated):
    \`\`\`
    ${trimmedContent} 
    \`\`\`

    INSTRUCTIONS:
    1. **Summary**: Provide a high-level overview of what this file does in 1-2 clear sentences.
    2. **Sections**: Identify the main logical components (e.g., "Main Functions", "Configuration", "Types", "Logic").
    3. **Content**: Explain *why* this code exists and *how* it works. Avoid line-by-line translation of code to text. Use professional, natural English.
    4. **Code Example**: Create a *realistic* and *syntactically correct* usage example.
    5. **Style**: Be concise but complete. Avoid robot-speak. Use proper punctuation.

    OUTPUT FORMAT:
    Return strictly valid JSON matching this schema:
    {
      "filePath": "${fileName}",
      "summary": "String...",
      "sections": [
        {
          "title": "String...",
          "content": "String...",
          "codeExample": "String..." // Optional, max 10 lines
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
        model: DOCS_MODEL,
        contents: prompt,
        config: {
        systemInstruction: "You are a Senior Technical Writer. You value clarity, accuracy, and human-readable explanations. Output strictly valid JSON.",
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.2, // Low temperature to prevent hallucinations/gibberish
        safetySettings: SAFETY_SETTINGS, 
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
                    codeExample: { 
                        type: Type.STRING, 
                        description: "Short usage example (max 10 lines)." 
                    }
                }
                }
            }
            }
        }
        }
    });

    if (response.text) {
        const cleanedText = cleanJson(response.text);
        
        // Strategy 1: Strict Parse & Repair
        const parsed = repairAndParseJson(cleanedText);
        if (parsed) {
             return {
                ...parsed,
                sections: Array.isArray(parsed.sections) ? parsed.sections : [],
                language: 'en'
            };
        }

        console.warn("JSON Parse Failed, attempting resilient parsing...");

        // Strategy 2: Resilient Regex Extraction
        const recovered = resilientParse(response.text, fileName);
        if (recovered) {
            console.log("Resilient parsing successful");
            return { ...recovered, language: 'en' };
        }

        // Strategy 3: Raw Fallback
        const fallback = fallbackRaw(response.text, fileName);
        return { ...fallback, language: 'en' };

    } else {
        return {
             filePath: fileName,
             summary: "Analysis Blocked: AI returned no content.",
             sections: [
                 {
                     title: "Safety/Filter Block",
                     content: "The AI model refused to generate content for this file.",
                     codeExample: "// No content generated"
                 }
             ],
             language: 'en'
        };
    }
  } catch (err) {
      console.error("Gemini API Error:", err);
       return {
            filePath: fileName,
            summary: "Service Error: Unable to contact AI.",
            sections: [
                {
                    title: "API Error",
                    content: "Failed to connect to the Gemini API.",
                    codeExample: ""
                }
            ],
            language: 'en'
        };
  }
};

export const translateDocumentation = async (doc: GeneratedDoc, targetLanguage: string): Promise<GeneratedDoc> => {
    // If it's already the target language, just return it
    if (doc.language === targetLanguage) return doc;

    const prompt = `
      You are a professional translator. 
      Translate the text content of this JSON documentation into ${targetLanguage}.
      
      RULES:
      1. Translate 'summary', 'title', and 'content' values.
      2. **DO NOT** translate 'codeExample' or 'verification' logs. Code must remain English/Code.
      3. Keep the JSON structure exactly identical.
      
      Input JSON:
      ${JSON.stringify({ 
          summary: doc.summary, 
          sections: doc.sections.map(s => ({ title: s.title, content: s.content })) 
      })}
    `;

    try {
        const response = await ai.models.generateContent({
            model: VERIFY_MODEL, // Use Flash for speed
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                safetySettings: SAFETY_SETTINGS, // Disable filters
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (response.text) {
            const cleaned = cleanJson(response.text);
            const parsed = repairAndParseJson(cleaned);
            
            if (parsed) {
                // Merge translated text back with original doc to preserve code/verification
                return {
                    ...doc,
                    summary: parsed.summary,
                    sections: doc.sections.map((section, idx) => ({
                        ...section,
                        title: parsed.sections?.[idx]?.title || section.title,
                        content: parsed.sections?.[idx]?.content || section.content
                        // Keep original codeExample
                    })),
                    language: targetLanguage
                };
            }
        }
        throw new Error("Failed to parse translation");
    } catch (e) {
        console.error("Translation failed", e);
        return doc; // Return original if failure
    }
};

export const verifyCodeExample = async (
  fileName: string, 
  sourceCode: string, 
  exampleCode: string
): Promise<VerificationResult> => {
  
  const prompt = `
    Act as a strict Compiler and Runtime Environment.
    
    Task: Verify if the "Example Code" works with the "Source Code".
    
    Rules:
    1. Check for type mismatches or missing arguments.
    2. Simulate execution flow.
    3. IMPORTANT: Assume the file "${fileName}" exists and exports the code provided. Do NOT fail on "Module not found" for imports referring to "${fileName}".
    
    Source Code ("${fileName}"):
    \`\`\`
    ${sourceCode.slice(0, 10000)}
    \`\`\`
    
    Example Code:
    \`\`\`
    ${exampleCode}
    \`\`\`
    
    Output JSON:
    - status: "SUCCESS" | "FAILED"
    - logs: string (simulation output)
    - fixedCode: string (only if FAILED)
  `;

  try {
      const response = await ai.models.generateContent({
        model: VERIFY_MODEL, // Using Flash for speed as requested
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            safetySettings: SAFETY_SETTINGS, // Disable filters
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
        try {
            const cleanedText = cleanJson(response.text);
            const data = JSON.parse(cleanedText);
            return {
                status: data.status === 'SUCCESS' ? VerificationStatus.SUCCESS : VerificationStatus.FAILED,
                logs: data.logs,
                fixedCode: data.fixedCode
            };
        } catch (e) {
            return {
                status: VerificationStatus.FAILED,
                logs: "Verification failed: Invalid JSON response from AI.",
            };
        }
      }

      return {
        status: VerificationStatus.FAILED,
        logs: "Verification process failed to return a valid response.",
      };
  } catch (error: any) {
      return {
          status: VerificationStatus.FAILED,
          logs: `System Error: ${error.message || 'Unknown error during verification'}`
      };
  }
};