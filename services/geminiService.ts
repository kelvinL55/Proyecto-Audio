
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ImprovementOptions, ImprovementResult } from "../types";

export interface TranscriptionResult {
  raw: string;
  polished: string;
}

/**
 * Transcribe y pule el audio usando Gemini 3 Flash.
 */
export const transcribeAndPolishAudio = async (base64Audio: string, mimeType: string): Promise<TranscriptionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const modelId = 'gemini-3-flash-preview';
    const cleanMimeType = mimeType.split(';')[0];
    const prompt = `Actúa como un transcriptor y editor experto en español. 1. Transcribe exactamente el audio. 2. Genera una versión "polished" con gramática y puntuación perfectas.`;
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ inlineData: { mimeType: cleanMimeType, data: base64Audio } }, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { 
            raw: { type: Type.STRING }, 
            polished: { type: Type.STRING } 
          },
          required: ["raw", "polished"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Error en transcripción:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("KEY_REQUIRED");
    }
    throw error;
  }
};

/**
 * Convierte texto a voz usando Gemini 2.5 Flash Preview TTS.
 */
export const speakText = async (text: string): Promise<ArrayBuffer> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No se pudo generar el audio.");
    
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error: any) {
    console.error("Error en TTS:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("KEY_REQUIRED");
    }
    throw error;
  }
};

/**
 * Mejora el texto usando Gemini 3 Flash (Optimizado para rapidez y pruebas).
 */
export const improveText = async (originalText: string, options: ImprovementOptions): Promise<ImprovementResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // CAMBIO: Ahora usamos Flash en lugar de Pro
    const modelId = 'gemini-3-flash-preview';
    const humanize = options.isHumanized ? "MODO HUMANIZADO: Evita sonar como IA, usa lenguaje fluido y natural." : "";
    let promptInstructions = "";

    if (options.type === 'email') {
      promptInstructions = `Reescribe como EMAIL. Tono: ${options.emailTone}. ${humanize}`;
    } else if (options.type === 'chat') {
      promptInstructions = `Reescribe como CHAT. Tono: ${options.chatTone}. Emojis: ${options.useEmojis}. ${humanize}`;
    } else if (options.type === 'instructions') {
      promptInstructions = `Reescribe como INSTRUCCIONES paso a paso, directas y claras. ${humanize}`;
    } else if (options.type === 'prompt_improver') {
      const imagination = options.imaginationLevel || 3;
      const category = options.promptCategory || 'general';
      
      promptInstructions = `
        ACTÚA COMO UN EXPERTO INGENIERO DE PROMPTS.
        TU MISIÓN: Convertir el texto del usuario en un PROMPT ESTRUCTURADO Y PROFESIONAL.
        NIVEL DE IMAGINACIÓN: ${imagination}/5.
        CATEGORÍA: ${category.toUpperCase()}.
        
        REGLAS PARA '${category}':
        ${category === 'code' ? `
        - El prompt debe pedir CÓDIGO MODULAR.
        - REQUISITO: Manejo de errores robusto y comentarios en ESPAÑOL.
        ` : ''}
        ${category === 'image' ? `- El prompt debe ser una descripción artística detallada (iluminación, lente, estilo).` : ''}
        
        ESTRUCTURA DEL RESULTADO: Contexto, Tarea, Restricciones.
      `;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: `${promptInstructions}\n\nTexto original: "${originalText}"` }] },
      config: {
        // Flash también soporta Thinking Budget, ajustado para ser eficiente
        thinkingConfig: { 
          thinkingBudget: (options.type === 'prompt_improver' && (options.imaginationLevel || 0) >= 4) ? 1000 : 0 
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, nullable: true },
            body: { type: Type.STRING }
          },
          required: ["body"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Error en mejora de texto:", error);
    if (error.message?.includes("Requested entity was not found") || error.status === 404) {
      throw new Error("KEY_REQUIRED");
    }
    throw error;
  }
};
