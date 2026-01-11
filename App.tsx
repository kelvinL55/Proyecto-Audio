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
  const bottomRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => { if (theme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
    if (theme === 'dark') return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>;
  };

  useEffect(() => {
    if (improvedResult && resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (appState === AppState.IDLE && segments.length > 0 && !improvedResult) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments.length, appState, improvedResult]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setSegments([]); setImprovedResult(null); setAppState(AppState.PROCESSING);
    const audioUrl = URL.createObjectURL(audioBlob);
    const tempId = Date.now().toString();
    const tempSegment: Message = { id: tempId, role: 'model', content: '', polishedVersion: '', timestamp: Date.now(), audioUrl: audioUrl };
    setSegments([tempSegment]);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const result = await transcribeAndPolishAudio(base64Audio, audioBlob.type);
      setSegments([{ ...tempSegment, content: result.raw, polishedVersion: result.polished }]);
    } catch (error: any) {
      setSegments([{ ...tempSegment, polishedVersion: "Error: No se pudo transcribir el audio." }]);
    } finally { setAppState(AppState.IDLE); }
  };

  const handleProcessManualText = () => {
    if (!manualText.trim()) return;
    setSegments([]); setImprovedResult(null); setAppState(AppState.PROCESSING);
    setTimeout(() => {
      setSegments([{ id: Date.now().toString(), role: 'model', content: manualText, polishedVersion: manualText, timestamp: Date.now() }]);
      setAppState(AppState.IDLE);
    }, 500);
  };

  const handleImproveText = async (options: ImprovementOptions) => {
    if (!segments[0]?.polishedVersion) return;
    setAppState(AppState.IMPROVING);
    try {
      const result = await improveText(segments[0].polishedVersion, options);
      setImprovedResult(result);
    } catch (error) {
      alert("No se pudo mejorar el texto. Intenta de nuevo.");
    } finally { setAppState(AppState.IDLE); }
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
    } catch (e) {
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
        <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all active:scale-95">
          {getThemeIcon()}
        </button>
      </header>

      <div className="flex-none bg-white dark:bg-[#2A2B32] border-b border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-md z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
             <button onClick={() => setInputMode('voice')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'voice' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
                Micrófono
             </button>
             <button onClick={() => setInputMode('text')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'text' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                Pegar Texto
             </button>
          </div>
          <div className="animate-fade-in">
             {inputMode === 'voice' ? <Recorder onRecordingComplete={handleRecordingComplete} isProcessing={appState === AppState.PROCESSING} /> : 
                <div className="flex flex-col gap-4">
                   <div className="relative group">
                      <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Pega aquí el texto que deseas que la IA transforme..." className="w-full h-40 p-5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all outline-none font-serif text-lg shadow-inner" />
                      {manualText && <button onClick={() => setManualText('')} className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg></button>}
                   </div>
                   <button onClick={handleProcessManualText} disabled={!manualText.trim() || appState === AppState.PROCESSING} className={`w-full md:w-fit px-10 py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 ${!manualText.trim() || appState === AppState.PROCESSING ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-300 dark:border-gray-600 shadow-none' : 'bg-brand hover:bg-brandDark text-white shadow-brand/20'}`}>
                      {appState === AppState.PROCESSING ? 'PROCESANDO...' : 'CARGAR TEXTO'}
                   </button>
                </div>
             }
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#343541] p-4 md:p-8 relative">
        <div className="max-w-4xl mx-auto min-h-full pb-32 space-y-8">
          {segments.length === 0 && appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in select-none opacity-60">
              <div className="w-24 h-24 mb-6"><Logo className="w-full h-full" withText={false} /></div>
              <h2 className="text-3xl font-bold mb-2">Transcribe <span className="text-brand">&</span> Mejora</h2>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Graba tu voz o pega un texto para obtener una redacción profesional instantánea.</p>
            </div>
          )}

          {segments.length > 0 && (
            <div className="bg-white dark:bg-[#444654] rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50 overflow-hidden animate-slide-up">
               <div className="bg-gray-50/80 dark:bg-[#343541]/50 p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{segments[0].audioUrl ? "Grabación Original" : "Texto Base"}</span>
                  {segments[0].audioUrl && <audio src={segments[0].audioUrl} controls className="h-8 w-48 opacity-80" />}
               </div>
               <div className="p-6 md:p-8">
                  {appState === AppState.PROCESSING ? <SkeletonLoader /> : 
                    <div className="animate-fade-in">
                       <p className="text-lg leading-relaxed whitespace-pre-wrap font-serif">{segments[0].polishedVersion}</p>
                       <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                          <button onClick={() => playTTS(segments[0].polishedVersion || '')} disabled={appState === AppState.PLAYING_TTS} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border transition-all ${appState === AppState.PLAYING_TTS ? 'bg-brand/10 text-brand border-brand/30 cursor-not-allowed' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm'}`}>
                            {appState === AppState.PLAYING_TTS ? <><span className="animate-ping h-2 w-2 rounded-full bg-brand"></span> Reproduciendo...</> : <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" /></svg> Escuchar</>}
                          </button>
                          <button onClick={() => copyToClipboard(segments[0].polishedVersion || '')} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm transition-all">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                             Copiar
                          </button>
                       </div>
                    </div>
                  }
               </div>
            </div>
          )}

          {segments.length > 0 && appState !== AppState.PROCESSING && <div className="animate-slide-up" style={{animationDelay: '0.1s'}}><TextImprover onImprove={handleImproveText} isProcessing={appState === AppState.IMPROVING} /></div>}

          {improvedResult && (
             <div ref={resultRef} className="bg-white dark:bg-[#444654] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand to-emerald-400"></div>
                <div className="p-6 md:p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="p-2 bg-brand/10 rounded-lg"><svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg></div> Versión Mejorada</h3>
                  {improvedResult.subject && <div className="mb-6"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Asunto</span><div className="p-3 bg-gray-50 dark:bg-[#343541] rounded-lg border border-gray-200 dark:border-gray-600 font-medium">{improvedResult.subject}</div></div>}
                  <div className="mb-8"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Mensaje</span><div className="p-5 bg-gray-50 dark:bg-[#343541] rounded-xl border border-gray-200 dark:border-gray-600 whitespace-pre-wrap text-base leading-relaxed">{improvedResult.body}</div></div>
                  <div className="flex flex-col md:flex-row justify-end gap-3">
                     <button onClick={() => playTTS(`${improvedResult.subject ? 'Asunto: ' + improvedResult.subject + '. ' : ''} ${improvedResult.body}`)} disabled={appState === AppState.PLAYING_TTS} className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${appState === AppState.PLAYING_TTS ? 'bg-brand/10 text-brand border border-brand/20 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'}`}>
                        {appState === AppState.PLAYING_TTS ? <><span className="h-2 w-2 rounded-full bg-brand animate-ping"></span> Reproduciendo...</> : <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" /></svg> Escuchar Resultado</>}
                     </button>
                    <button onClick={() => copyToClipboard(`${improvedResult.subject ? 'Asunto: ' + improvedResult.subject + '\n\n' : ''}${improvedResult.body}`)} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold transition-all active:scale-95">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                       Copiar Todo
                    </button>
                  </div>
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