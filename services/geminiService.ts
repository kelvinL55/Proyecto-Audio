import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ImprovementOptions, ImprovementResult } from "../types";

// Ensure API key is present
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export interface TranscriptionResult {
  raw: string;
  polished: string;
}

/**
 * Transcribe y pule el audio usando Gemini 3 Flash.
 * Línea 25: Configuración del modelo de transcripción.
 */
export const transcribeAndPolishAudio = async (base64Audio: string, mimeType: string): Promise<TranscriptionResult> => {
  try {
    const modelId = 'gemini-3-flash-preview'; // <-- LÍNEA 25
    
    const cleanMimeType = mimeType.split(';')[0];

    const prompt = `
      Actúa como un transcriptor y editor experto.
      1. Transcribe el audio proporcionado exactamente como se escucha.
      2. Genera una versión "polished" con ortografía, puntuación y gramática corregida en español.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio
            }
          },
          { text: prompt }
        ]
      },
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

    let text = response.text || "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim()) as TranscriptionResult;
    return result;

  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

/**
 * Convierte texto a voz usando Gemini 2.5 Flash Preview TTS.
 * Línea 83: Configuración del modelo de voz.
 */
export const speakText = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", // <-- LÍNEA 83
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
};

/**
 * Mejora el texto usando Gemini 3 Pro para resultados de alta calidad.
 * Línea 116: Configuración del modelo de mejora de texto.
 */
export const improveText = async (originalText: string, options: ImprovementOptions): Promise<ImprovementResult> => {
  try {
    const modelId = 'gemini-3-pro-preview'; // <-- LÍNEA 116
    
    const humanizeInstruction = options.isHumanized
      ? "MODO HUMANIZADO: Suena fluido, empático y natural. Evita sonar como una IA."
      : "";

    let promptInstructions = "";

    if (options.type === 'email') {
      promptInstructions = `
        Reescribe para EMAIL. Tono: ${options.emailTone}.
        ${humanizeInstruction}
        Usa 1ra persona, estructura con saludo, párrafos claros, frase de cierre y firma "Saludos, Kelvin".
      `;
    } else if (options.type === 'chat') {
      promptInstructions = `
        Reescribe para CHAT (WhatsApp/Teams). Tono: ${options.chatTone}.
        Emojis: ${options.useEmojis ? 'SÍ' : 'NO'}.
        ${humanizeInstruction}
        Debe ser directo, moderno y breve.
      `;
    } else if (options.type === 'instructions') {
      promptInstructions = `
        Reescribe como INSTRUCCIONES paso a paso. Tono: ${options.instructionTone}.
        REGLAS:
        - Estructura el texto en una lista numerada o con viñetas clara.
        - Sé extremadamente conciso y directo (resumido).
        - Usa un lenguaje fácil de entender pero profesional.
        - Elimina cualquier redundancia del texto original.
        ${humanizeInstruction}
      `;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: `${promptInstructions}\n\nTexto original a transformar: "${originalText}"` }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, nullable: true, description: "Solo para correos electrónicos" },
            body: { type: Type.STRING, description: "El texto transformado final" }
          },
          required: ["body"]
        }
      }
    });

    let text = response.text || "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim()) as ImprovementResult;
    return result;

  } catch (error) {
    console.error("Improve text error:", error);
    throw error;
  }
};