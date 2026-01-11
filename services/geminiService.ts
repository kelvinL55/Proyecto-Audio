
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  try {
    const modelId = 'gemini-3-flash-preview';
    const cleanMimeType = mimeType.split(';')[0];
    const prompt = `Actúa como un transcriptor y editor experto. 1. Transcribe exactamente el audio. 2. Genera una versión "polished" con gramática y puntuación perfectas en español.`;
    
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
  } catch (error) {
    console.error("Error en transcripción:", error);
    throw error;
  }
};

/**
 * Convierte texto a voz usando Gemini 2.5 Flash Preview TTS.
 */
export const speakText = async (text: string): Promise<ArrayBuffer> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No se generó audio");
    
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  } catch (error) {
    console.error("Error en TTS:", error);
    throw error;
  }
};

/**
 * Mejora el texto usando Gemini 3 Pro para resultados de alta calidad.
 * Se ha optimizado el prompt de ingeniería para cumplir con los estándares solicitados.
 */
export const improveText = async (originalText: string, options: ImprovementOptions): Promise<ImprovementResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  try {
    const modelId = 'gemini-3-pro-preview';
    const humanize = options.isHumanized ? "MODO HUMANIZADO: Suena fluido, natural, empático y evita estructuras robóticas." : "";
    let promptInstructions = "";

    if (options.type === 'email') {
      promptInstructions = `Reescribe para EMAIL. Tono: ${options.emailTone}. ${humanize}`;
    } else if (options.type === 'chat') {
      promptInstructions = `Reescribe para CHAT. Tono: ${options.chatTone}. Emojis: ${options.useEmojis}. ${humanize}`;
    } else if (options.type === 'instructions') {
      promptInstructions = `Reescribe como INSTRUCCIONES paso a paso, con claridad técnica pero lenguaje accesible. ${humanize}`;
    } else if (options.type === 'prompt_improver') {
      const imagination = options.imaginationLevel || 3;
      const category = options.promptCategory || 'general';
      
      promptInstructions = `
        SISTEMA DE INGENIERÍA DE PROMPTS AVANZADO (PROMPT IMPROVER).
        ACTÚA COMO: Un Ingeniero de Prompts de élite y Arquitecto de IA.
        
        TU MISIÓN: Transformar la solicitud del usuario en un prompt magistral, profesional y altamente efectivo.
        NIVEL DE PROFUNDIDAD/INVESTIGACIÓN: ${imagination}/5.
        - Si el nivel es alto (4-5), debes "investigar" mentalmente las mejores prácticas y añadir lógica preventora de errores.
        
        REGLAS ESPECÍFICAS PARA LA CATEGORÍA '${category.toUpperCase()}':
        ${category === 'code' ? `
        - Si la tarea implica programación (VBA, Python, Excel, SQL, etc.), el prompt resultante debe exigir CÓDIGO LIMPIO, MODULAR Y OPTIMIZADO.
        - REQUERIMIENTO OBLIGATORIO: Incluir manejadores de errores robustos (ej: On Error GoTo, Try-Except).
        - REQUERIMIENTO OBLIGATORIO: Todos los comentarios internos del código deben estar en ESPAÑOL.
        - El prompt debe pedir a la IA que explique su lógica antes de generar el código.
        ` : ''}
        ${category === 'image' ? `
        - El prompt debe transformarse en una descripción visual técnica y artística.
        - Incluir: Composición de cámara, iluminación volumétrica, estilo (ej: cinematográfico, fotorrealista, 3D Render), y parámetros técnicos (f/1.8, ISO 100, 8k, Octane Render).
        ` : ''}
        ${category === 'video' ? `
        - El prompt debe definir el "Storytelling" visual.
        - Incluir: Movimientos de cámara (Panning, Dolly, Zoom), transiciones, atmósfera, ritmo y paleta de colores.
        ` : ''}
        ${category === 'general' ? `
        - Añade un toque especial de profesionalismo. 
        - Resuelve ambigüedades asumiendo el escenario más útil para el usuario basándote en el nivel de imaginación ${imagination}.
        ` : ''}

        ESTRUCTURA DEL PROMPT MEJORADO:
        1. Rol Experto: Define quién debe ejecutar la tarea.
        2. Contexto Detallado: Por qué y para qué se hace esto.
        3. Instrucciones de Ejecución: El paso a paso "investigado".
        4. Restricciones y Formato: Qué evitar y cómo entregar el resultado.
        
        IMPORTANTE: No respondas con el código o la imagen, responde con el PROMPT que el usuario debería usar para obtener el mejor resultado posible.
      `;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: `${promptInstructions}\n\nTEXTO ORIGINAL DEL USUARIO: "${originalText}"` }] },
      config: {
        // Habilitamos Thinking Budget para procesos de mejora de prompt de alto nivel
        thinkingConfig: { thinkingBudget: (options.type === 'prompt_improver' && (options.imaginationLevel || 0) >= 4) ? 2000 : 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, description: "Título breve del tipo de prompt o asunto del correo", nullable: true },
            body: { type: Type.STRING, description: "El prompt mejorado o el texto transformado completo" }
          },
          required: ["body"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.error("Error en improveText:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("KEY_REQUIRED");
    }
    throw error;
  }
};
