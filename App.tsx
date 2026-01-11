
import React, { useState, useRef, useEffect } from 'react';
import { Recorder } from './components/Recorder';
import { TextImprover } from './components/TextImprover';
import { Logo } from './components/Logo';
import { SkeletonLoader } from './components/SkeletonLoader';
import { Message, AppState, ImprovementOptions, ImprovementResult } from './types';
import { blobToBase64, pcmToAudioBuffer } from './utils/audioUtils';
import { transcribeAndPolishAudio, speakText, improveText } from './services/geminiService';

type Theme = 'light' | 'dark' | 'system';
type InputMode = 'voice' | 'text';

const App: React.FC = () => {
  const [segments, setSegments] = useState<Message[]>([]); 
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [theme, setTheme] = useState<Theme>('system');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [manualText, setManualText] = useState<string>('');
  const [improvedResult, setImprovedResult] = useState<ImprovementResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
        const selected = await aiStudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("No se pudo abrir el selector de claves");
      }
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setSegments([]); 
    setImprovedResult(null); 
    setAppState(AppState.PROCESSING);
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const tempId = Date.now().toString();
    const tempSegment: Message = { id: tempId, role: 'model', content: '', polishedVersion: '', timestamp: Date.now(), audioUrl: audioUrl };
    setSegments([tempSegment]);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const result = await transcribeAndPolishAudio(base64Audio, audioBlob.type);
      setSegments([{ ...tempSegment, content: result.raw, polishedVersion: result.polished }]);
    } catch (error: any) {
      if (error.message === 'KEY_REQUIRED') {
        setHasApiKey(false);
        await handleOpenKeyDialog();
      }
      setSegments([{ ...tempSegment, polishedVersion: "Error al procesar con Gemini Flash. Verifica tu clave de API." }]);
    } finally { 
      setAppState(AppState.IDLE); 
    }
  };

  const handleImproveText = async (options: ImprovementOptions) => {
    if (!segments[0]?.polishedVersion) return;
    setAppState(AppState.IMPROVING);
    try {
      const result = await improveText(segments[0].polishedVersion, options);
      setImprovedResult(result);
    } catch (error: any) {
      if (error.message === 'KEY_REQUIRED') {
        setHasApiKey(false);
        handleOpenKeyDialog();
      } else {
        alert("Error de procesamiento. Asegúrate de que la clave de API sea válida.");
      }
    } finally { 
      setAppState(AppState.IDLE); 
    }
  };

  const playTTS = async (text: string) => {
    if (appState === AppState.PLAYING_TTS || !text) return;
    try {
      setAppState(AppState.PLAYING_TTS);
      const rawPcmBuffer = await speakText(text);
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = pcmToAudioBuffer(rawPcmBuffer, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setAppState(AppState.IDLE);
      source.start(0);
    } catch (e: any) {
      if (e.message === 'KEY_REQUIRED') {
        setHasApiKey(false);
        handleOpenKeyDialog();
      }
      setAppState(AppState.IDLE);
    }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch (err) { console.error('Error al copiar:', err); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#202123] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
      <header className="flex-none bg-white/80 dark:bg-[#343541]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 py-3 px-6 shadow-sm z-30 flex justify-between items-center sticky top-0">
        <Logo />
        <div className="flex items-center gap-4">
          {!hasApiKey && (
            <button 
              onClick={handleOpenKeyDialog}
              className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-200 transition-colors flex items-center gap-2"
            >
              Configurar API Key
            </button>
          )}
          <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all active:scale-95">
             {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
          </button>
        </div>
      </header>

      <div className="flex-none bg-white dark:bg-[#2A2B32] border-b border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-md z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
             <button onClick={() => setInputMode('voice')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'voice' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Micrófono
             </button>
             <button onClick={() => setInputMode('text')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'text' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Pegar Texto
             </button>
          </div>
          
          <div className="animate-fade-in">
             {inputMode === 'voice' ? (
               <Recorder onRecordingComplete={handleRecordingComplete} isProcessing={appState === AppState.PROCESSING} />
             ) : (
                <div className="flex flex-col gap-4">
                   <textarea 
                    value={manualText} 
                    onChange={(e) => setManualText(e.target.value)} 
                    placeholder="Pega tu texto aquí..." 
                    className="w-full h-32 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 resize-none outline-none focus:ring-2 focus:ring-brand" 
                   />
                   <button 
                    onClick={() => {
                      if (!manualText.trim()) return;
                      setSegments([{ id: Date.now().toString(), role: 'model', content: manualText, polishedVersion: manualText, timestamp: Date.now() }]);
                      setImprovedResult(null);
                    }} 
                    className="w-fit px-8 py-3 bg-brand text-white rounded-xl font-bold hover:bg-brandDark transition-colors"
                   >
                    CARGAR TEXTO
                   </button>
                </div>
             )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#343541] p-4 md:p-8 relative">
        <div className="max-w-4xl mx-auto min-h-full pb-32 space-y-8">
          {segments.length === 0 && appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in opacity-60">
              <Logo className="w-20 h-20 mb-6" withText={false} />
              <h2 className="text-2xl font-bold mb-2">Listo para transcribir</h2>
              <p className="text-gray-500 dark:text-gray-400 text-center">Impulsado por Gemini 3 Flash para una velocidad máxima.</p>
            </div>
          )}

          {segments.map((msg) => (
            <div key={msg.id} className="bg-white dark:bg-[#444654] rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50 overflow-hidden animate-slide-up p-6">
               <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transcripción Flash</span>
                  {msg.audioUrl && <audio src={msg.audioUrl} controls className="h-8 w-40 opacity-50" />}
               </div>
               
               {appState === AppState.PROCESSING ? <SkeletonLoader /> : (
                 <>
                   <p className="text-lg leading-relaxed whitespace-pre-wrap mb-6">{msg.polishedVersion || "Procesando..."}</p>
                   <div className="flex gap-2">
                      <button onClick={() => playTTS(msg.polishedVersion || '')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        {appState === AppState.PLAYING_TTS ? "Escuchando..." : "Escuchar"}
                      </button>
                      <button onClick={() => copyToClipboard(msg.polishedVersion || '')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Copiar
                      </button>
                   </div>
                 </>
               )}
            </div>
          ))}

          {segments.length > 0 && appState !== AppState.PROCESSING && (
            <div className="animate-slide-up">
              <TextImprover onImprove={handleImproveText} isProcessing={appState === AppState.IMPROVING} />
            </div>
          )}

          {improvedResult && (
             <div ref={resultRef} className="bg-white dark:bg-[#444654] rounded-2xl shadow-xl border-t-4 border-brand p-8 animate-slide-up">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-brand">✨</span> Mejora con Flash
                </h3>
                {improvedResult.subject && (
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Asunto Sugerido</span>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-bold">{improvedResult.subject}</div>
                  </div>
                )}
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Contenido</span>
                  <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-pre-wrap leading-relaxed">{improvedResult.body}</div>
                </div>
                <div className="flex justify-end gap-3">
                   <button onClick={() => playTTS(improvedResult.body)} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold">Escuchar</button>
                   <button onClick={() => copyToClipboard(improvedResult.body)} className="px-6 py-2 bg-brand text-white rounded-lg font-bold">Copiar Todo</button>
                </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
