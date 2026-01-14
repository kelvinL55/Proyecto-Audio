
import { GoogleGenAI, Modality } from "@google/genai";
import { ImprovementOptions, ImprovementResult } from "../types";

export interface TranscriptionResult {
  raw: string;
  polished: string;
}

const getApiKey = (apiKey?: string) => {
  return apiKey || (import.meta as any).env.VITE_API_KEY || (process.env as any).GEMINI_API_KEY;
};

// El modelo más actual a enero de 2026 es gemini-3-flash (para lógica y texto)
const LATEST_FLASH_MODEL = 'gemini-3-flash-preview';

// Modelo especializado en generación de audio (TTS)
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Transcribe y pule el audio usando Gemini 3 Flash.
 */
export const transcribeAndPolishAudio = async (base64Audio: string, mimeType: string, apiKey: string): Promise<TranscriptionResult> => {
  const client = new GoogleGenAI({ apiKey: getApiKey(apiKey) });
  try {
    const cleanMimeType = mimeType.split(';')[0];
    const prompt = `Actúa como un transcriptor y editor experto en español. 1. Transcribe exactamente el audio. 2. Genera una versión "polished" con gramática y puntuación perfectas.`;

    const response = await client.models.generateContent({
      model: LATEST_FLASH_MODEL,
      contents: [{ parts: [{ inlineData: { mimeType: cleanMimeType, data: base64Audio } }, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            raw: { type: "string" },
            polished: { type: "string" }
          },
          required: ["raw", "polished"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Error en transcripción:", error);
    if (error.message?.includes("API key not valid") || error.status === 401) {
      throw new Error("API_KEY_INVALID");
    }
    throw error;
  }
};

export interface AudioResult {
  data: ArrayBuffer;
  mimeType: string;
}

/**
 * Convierte texto a voz usando Gemini 2.5 Flash Preview TTS.
 */
export const speakText = async (text: string, apiKey: string): Promise<AudioResult> => {
  const client = new GoogleGenAI({ apiKey: getApiKey(apiKey) });
  try {
    const response = await client.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }
          }
        },
      } as any,
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No se pudo generar el audio. El modelo no devolvió datos de audio.");
    }

    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      data: bytes.buffer,
      mimeType: 'audio/pcm'
    };
  } catch (error: any) {
    console.error("Error en TTS:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("KEY_REQUIRED");
    }
    throw error;
  }
};

/**
 * Mejora el texto usando Gemini 3 Flash.
 */
export const improveText = async (originalText: string, options: ImprovementOptions, apiKey: string): Promise<ImprovementResult> => {
  const client = new GoogleGenAI({ apiKey: getApiKey(apiKey) });
  try {
    const humanize = options.isHumanized ? "MODO HUMANIZADO: Evita sonar como IA, usa lenguaje fluido y natural." : "";
    let promptInstructions = "";

    if (options.type === 'email') {
      promptInstructions = `
        Reescribe como EMAIL. Tono: ${options.emailTone}. ${humanize}
        
        REGLAS DE ESTRUCTURA OBLIGATORIAS:
        1. SALUDO: Debe empezar exactamente con "Estimados todos, buenos días," o "Estimados todos, buenas tardes," según parezca más apropiado.
        2. CUERPO: El contenido debe estar muy bien estructurado y profesional.
        3. DESPEDIDA: Debe terminar exactamente con: 
           Saludos,
           Kelvin
      `;
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

    const response = await client.models.generateContent({
      model: LATEST_FLASH_MODEL,
      contents: [{ parts: [{ text: `${promptInstructions}\n\nTexto original: "${originalText}"` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            subject: { type: "string", nullable: true },
            body: { type: "string" }
          },
          required: ["body"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Error en mejora de texto:", error);
    throw error;
  }
};
