
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeneratedContent } from "../types";
import { constructPrompt } from "../utils/promptTemplates";
import { fileToBase64, pcmToWav, extractAudioBlob } from "../utils/audioHelpers";

export const validateGeminiConnection = async (apiKey: string, modelName: string): Promise<boolean> => {
  if (!apiKey) return false;
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Simple verification call
    await ai.models.generateContent({
        model: modelName,
        contents: "Test connection.",
    });
    return true;
  } catch (e) {
    console.error("API Key Validation Failed:", e);
    return false;
  }
};

// Helper to convert seconds to SRT timestamp format (00:00:00,000)
const formatSRTTimestamp = (seconds: number): string => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString();
  // ISO is YYYY-MM-DDTHH:mm:ss.sssZ
  // We need HH:mm:ss,sss
  const timePart = iso.substr(11, 12).replace('.', ',');
  return timePart;
};

export const generateSRT = async (
  mediaFile: File | Blob,
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // OPTIMIZATION: If input is a video, extract the audio track first.
  // Sending pure Audio (WAV) to Gemini significantly improves timestamp accuracy compared to processing video frames.
  let fileToProcess = mediaFile;
  let mimeType = mediaFile.type;

  if (mediaFile.type.startsWith('video/')) {
    try {
        console.log("Extracting audio from video for better transcription accuracy...");
        const audioBlob = await extractAudioBlob(mediaFile as File);
        fileToProcess = audioBlob;
        mimeType = 'audio/wav';
    } catch (e) {
        console.warn("Audio extraction failed, falling back to video processing.", e);
    }
  }

  const base64Data = await fileToBase64(fileToProcess);
  
  // Use Flash for speed and multimodal capability
  const model = 'gemini-2.5-flash'; 

  // Define a strict schema for subtitles to prevent formatting hallucinations
  const subtitleSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.NUMBER, description: "Start time in seconds (e.g. 1.5). Must be precise." },
        end: { type: Type.NUMBER, description: "End time in seconds (e.g. 3.0). Must be precise." },
        text: { type: Type.STRING, description: "The spoken text" }
      },
      required: ["start", "end", "text"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3',
              data: base64Data
            }
          },
          {
            text: `You are a professional captioning assistant. 
            Extract the transcript from this audio with EXTREME TIMING PRECISION.
            
            CRITICAL RULES:
            1. Timestamps must align perfectly with the audio waveform. 
            2. Break text into naturally spoken short chunks (max 3-5 words per chunk).
            3. Do NOT hallucinate. Only transcribe what is clearly spoken.
            4. If there is silence, do not create segments.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema
      }
    });

    const segments = JSON.parse(response.text || "[]");
    
    // Convert JSON segments to SRT String
    let srtOutput = "";
    segments.forEach((seg: any, index: number) => {
       const id = index + 1;
       const startTime = formatSRTTimestamp(seg.start);
       const endTime = formatSRTTimestamp(seg.end);
       const text = seg.text.trim();
       
       srtOutput += `${id}\n${startTime} --> ${endTime}\n${text}\n\n`;
    });

    return srtOutput.trim();
  } catch (error: any) {
    console.error("SRT Generation Error:", error);
    // Propagate the actual error message from the API so the UI can display "Payload too large" etc.
    throw new Error(error.message || "Failed to auto-generate subtitles.");
  }
};

export const generateTTS = async (
  text: string,
  voice: 'male' | 'female',
  apiKey: string
): Promise<Blob> => {
  const ai = new GoogleGenAI({ apiKey });
  // Correct model for TTS
  const model = 'gemini-2.5-flash-preview-tts'; 

  // Map to Gemini Voices
  // Female: Kore, Male: Charon
  const voiceName = voice === 'female' ? 'Kore' : 'Charon';

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    // Convert Base64 to Uint8Array (PCM Data)
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Wrap raw PCM in WAV header so browsers can play/download it
    return pcmToWav(bytes, 24000); 
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    throw new Error(`Failed to generate speech: ${error.message || "Unknown error"}`);
  }
};

export const generateReelContent = async (
  srtText: string,
  topicContext: string,
  apiKey: string,
  modelName: string,
  existingHtml?: string,
  existingLayout?: any,
  isAudioOnly: boolean = false
): Promise<GeneratedContent> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please enter it in the settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a world-class Motion Graphics Designer and Creative Technologist for high-retention social media video (Reels/TikTok).
    Your goal is to generate or refine a visual composition that transforms a raw transcript into an immersive, "edutainment" style video experience.

    ### DESIGN SYSTEM & AESTHETIC
    You must output high-fidelity, polished UI/UX animation.
    1. **Color Palette**: Use CSS variables. Dark background (#050505), Neon accents.
       - \`:root { --bg-deep: #050505; --primary: #00f3ff; --success: #00ff9d; --warning: #ffd700; --danger: #ff0055; --white: #ffffff; }\`
    2. **Typography**: Mix 'Oswald' (Headers) and 'JetBrains Mono' (Data/Code).
    3. **Animation Style (GSAP)**: No static slides. Things must pulse, float, or glow.

    ### JAVASCRIPT ROBUSTNESS RULES (CRITICAL)
    To prevent "Uncaught TypeError" and "SyntaxError" loops, you MUST strictly follow these patterns:

    1. **NEVER use \`element.children\` or \`document.getElementsBy...\` for looping.**
       These return HTMLCollections which crash on \`.forEach\`.
       
    2. **ALWAYS use \`gsap.utils.toArray(selector)\` for selection.**
       - ❌ WRONG: \`document.querySelectorAll('.box').forEach(...)\`
       - ✅ CORRECT: \`gsap.utils.toArray('.box').forEach(...)\`
       
    3. **NEVER use unquoted values in GSAP objects.**
       - ❌ WRONG: \`{ width: 100% }\` (Crash)
       - ❌ WRONG: \`{ duration: 0.5s }\` (Crash)
       - ✅ CORRECT: \`{ width: '100%', duration: 0.5 }\`

    4. **Use the injected \`ReelHelper\` if needed:**
       - The environment has a helper: \`ReelHelper.createGrid(container, items)\`.

    ### OUTPUT DELIVERABLES
    1. **HTML5 Animation**: A single, self-contained string (HTML/CSS/JS).
    2. **Layout Timeline**: A JSON array defining how the screen is split.

    ### HTML/ANIMATION REQUIREMENTS
    - **Library**: YOU MUST USE **GSAP (GreenSock)**. Include: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>.
    - **Structure**: Create multiple "Scenes" (#s1, #s2, #s3).
    - **Synchronization**: The JS **MUST** control the timeline via 'message' event.
      - \`window.addEventListener('message', (e) => { if(e.data.type==='timeupdate') tl.seek(e.data.time); ... });\`
    
    ### CODING RULES
    - **NO SINGLE-LINE COMMENTS**: Use \`/* */\` block comments only.
    - **USE TEMPLATE LITERALS**: Backticks (\`) for all strings.
    - try not to clip out or overlap elements, design elements and animsation utilising the split ratio's html part screen realesate 
    ### LAYOUT CONFIG REQUIREMENTS
    - 'layoutMode': 'split', 'full-video', 'full-html'.
    - 'splitRatio': e.g., 0.60 (HTML takes top 60%).
    
    ${isAudioOnly ? `
    ### AUDIO ONLY MODE
    - FORCE 'layoutMode': 'full-html' FOR ALL SCENES.
    - The visuals must be continuously active.
    ` : ''}
  `;

  let prompt = constructPrompt(topicContext, srtText);

  if (existingHtml && existingLayout) {
      prompt = `
      I have an existing HTML animation and Layout Config that I want to REFINE.
      
      *** CRITICAL FIX INSTRUCTIONS ***
      1. FIX: "Uncaught SyntaxError: identifier starts immediately after numeric literal" (Quote your CSS units!)
      2. FIX: "TypeError: x.forEach is not a function" (Use gsap.utils.toArray)
      
      *** CURRENT HTML ***
      ${existingHtml}

      *** CURRENT LAYOUT JSON ***
      ${JSON.stringify(existingLayout)}

      *** REFINEMENT INSTRUCTIONS ***
      ${topicContext || "Fix syntax errors and improve smooth animation."}

      *** TRANSCRIPT CONTEXT ***
      ${srtText}

      TASK: Return the FULLY UPDATED HTML and Layout JSON.
      `;
  }

  const layoutStepSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      startTime: { type: Type.NUMBER },
      endTime: { type: Type.NUMBER },
      layoutMode: { type: Type.STRING, enum: ['split', 'full-video', 'full-html', 'pip-html'] },
      splitRatio: { type: Type.NUMBER },
      captionPosition: { type: Type.STRING, enum: ['top', 'bottom', 'center', 'hidden'] },
      note: { type: Type.STRING }
    },
    required: ["startTime", "endTime", "layoutMode", "splitRatio", "captionPosition"]
  };

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      html: { type: Type.STRING },
      layoutConfig: { type: Type.ARRAY, items: layoutStepSchema },
      reasoning: { type: Type.STRING }
    },
    required: ["html", "layoutConfig"]
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName, 
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");

    // --- REEL HELPER API INJECTION ---
    // Instead of just a shim, we inject a robust helper library to prevent common AI mistakes.
    if (result.html) {
        const reelHelperScript = `<script>
            /* REEL COMPOSER STANDARD LIBRARY */
            (function() {
                // 1. Polyfill Collection Methods (Shim)
                if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
                    HTMLCollection.prototype.forEach = Array.prototype.forEach;
                }
                if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
                    NodeList.prototype.forEach = Array.prototype.forEach;
                }

                // 2. Global Helper Object (ReelHelper)
                window.ReelHelper = {
                    // Safe selection that always returns an Array (never null, never HTMLCollection)
                    select: function(selector, context) {
                        if (!window.gsap) return [];
                        return gsap.utils.toArray(selector, context);
                    },
                    // Safe cleanup
                    clear: function(element) {
                        if(element) element.innerHTML = '';
                    }
                };
                
                console.log("Reel Composer: Standard Library Loaded");
            })();
        </script>`;
        
        // Inject immediately after <head> for earliest execution
        result.html = result.html.replace('<head>', '<head>' + reelHelperScript);
    }
    // -----------------------------

    return result as GeneratedContent;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    let message = "Failed to generate content.";
    if (error.message?.includes("404")) message = "Model not found. Please check API availability.";
    else if (error.message?.includes("400")) message = "Bad Request. The prompt might be too long.";
    else if (error.message?.includes("429")) message = "Too many requests. Please wait a moment.";
    else if (error.message?.includes("API key")) message = "Invalid API Key.";
    throw new Error(message);
  }
};