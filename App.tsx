
import React, { useState, useRef, useEffect } from 'react';
import { Recorder } from './components/Recorder';
import { TextImprover } from './components/TextImprover';
import { Logo } from './components/Logo';
import { SkeletonLoader } from './components/SkeletonLoader';
import { Message, AppState, ImprovementOptions, ImprovementResult } from './types';
import { blobToBase64, pcmToAudioBuffer, pcmToWavBlob } from './utils/audioUtils';
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
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, { url: string, blob: Blob }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
      // setHasApiKey(true);
    }
  }, [apiKey]);

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
        const selected = await aiStudio.hasSelectedApiKey();
        // setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        // setHasApiKey(true);
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
      const result = await transcribeAndPolishAudio(base64Audio, audioBlob.type, apiKey);
      setSegments([{ ...tempSegment, content: result.raw, polishedVersion: result.polished }]);
    } catch (error: any) {
      console.error("Detalle del error:", error);
      const errorMsg = error.message?.includes("429")
        ? "Límite de cuota excedido (429). Espera un momento y reintenta."
        : `Error: ${error.message || "Ocurrió un problema inesperado."} Verifica tu clave de API.`;

      setSegments([{ ...tempSegment, polishedVersion: errorMsg }]);
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const handleImproveText = async (options: ImprovementOptions) => {
    if (!segments[0]?.polishedVersion) return;
    setAppState(AppState.IMPROVING);
    try {
      const result = await improveText(segments[0].polishedVersion, options, apiKey);
      setImprovedResult(result);
    } catch (error: any) {
      console.error("Error al mejorar:", error);
      alert(error.message?.includes("429") ? "Límite de cuota excedido. Por favor espera." : `Error: ${error.message}`);
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const playTTS = async (text: string, id: string) => {
    if (!text) return;

    // Si ya está reproduciendo ESTE mismo audio, pausar/reanudar
    if (playingId === id && ttsAudio) {
      if (ttsStatus === 'paused') {
        const playPromise = ttsAudio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setTtsStatus('playing'))
            .catch(e => {
              console.error("Error al reanudar reproducción:", e);
              alert("No se pudo reproducir el audio. Intenta dar clic de nuevo.");
            });
        }
        return;
      }
      if (ttsStatus === 'playing') {
        ttsAudio.pause();
        setTtsStatus('paused');
        return;
      }
    }

    // Si hay otro audio sonando, detenerlo
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      setTtsAudio(null);
    }

    try {
      setPlayingId(id);

      let audioUrl = '';
      let audioBlob: Blob | null = null;

      // 1. Verificar si ya lo tenemos en cache
      if (audioCache[id] && audioCache[id].url) {
        console.log("✅ Audio encontrado en caché para ID:", id);
        audioUrl = audioCache[id].url;
      } else {
        console.log("🔄 Generando nuevo audio TTS para ID:", id);
        console.log("📝 Texto a sintetizar:", text);
        setTtsStatus('loading');
        setAppState(AppState.PLAYING_TTS);

        const result = await speakText(text, apiKey);
        console.log("📦 Resultado TTS recibido. MimeType:", result.mimeType, "Tamaño:", result.data.byteLength, "bytes");

        // Si el formato es PCM crudo, lo envolvemos en un WAV
        if (result.mimeType.includes('pcm')) {
          const rateMatch = result.mimeType.match(/rate=(\d+)/);
          const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
          console.log("🔧 Convirtiendo PCM a WAV con sample rate:", sampleRate);
          audioBlob = pcmToWavBlob(result.data, sampleRate);
        } else {
          console.log("✅ Audio ya está en formato reproducible:", result.mimeType);
          audioBlob = new Blob([result.data], { type: result.mimeType });
        }

        audioUrl = URL.createObjectURL(audioBlob);
        console.log("🔗 Blob URL creado:", audioUrl);
        setAudioCache(prev => ({ ...prev, [id]: { url: audioUrl, blob: audioBlob! } }));
      }

      const audio = new Audio(audioUrl);

      // Configuración del audio element
      audio.preload = 'auto';
      audio.volume = 1.0;

      setTtsAudio(audio);

      audio.onloadedmetadata = () => {
        console.log("📊 Audio metadata cargada. Duración:", audio.duration, "segundos");
      };

      audio.oncanplay = () => {
        console.log("✅ Audio listo para reproducir");
      };

      audio.onplay = () => {
        console.log("▶️ Audio iniciando reproducción");
        setTtsStatus('playing');
      };

      audio.onpause = () => {
        console.log("⏸️ Audio pausado");
        setTtsStatus('paused');
      };

      audio.onended = () => {
        console.log("⏹️ Audio terminó");
        setTtsStatus('idle');
        setAppState(AppState.IDLE);
        setPlayingId(null);
      };

      audio.onerror = (e) => {
        console.error("❌ Error en reproducción de audio:", e);
        console.error("Audio element error details:", {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState
        });
        setTtsStatus('idle');
        setAppState(AppState.IDLE);
        alert("Error al reproducir el audio. Verifica la consola para más detalles.");
      };

      // Intentar reproducir
      console.log("🎵 Intentando reproducir audio...");
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Reproducción iniciada exitosamente");
          })
          .catch(e => {
            console.error("❌ Error al iniciar reproducción:", e);
            setTtsStatus('idle');
            setAppState(AppState.IDLE);

            // Si es un error de autoplay policy, informar al usuario
            if (e.name === 'NotAllowedError') {
              alert("El navegador bloqueó la reproducción automática. Haz clic de nuevo en el botón 'Escuchar'.");
            } else {
              alert(`Error al reproducir audio: ${e.message}`);
            }
          });
      }

    } catch (e: any) {
      console.error("❌ Error al procesar TTS:", e);
      if (e.message === 'KEY_REQUIRED' || e.message === 'API_KEY_INVALID') {
        handleOpenKeyDialog();
      } else {
        alert(`Error al generar audio: ${e.message || 'Error desconocido'}`);
      }
      setTtsStatus('idle');
      setAppState(AppState.IDLE);
      setPlayingId(null);
    }
  };

  const downloadAudio = (id: string, prefix: string = 'audio') => {
    const cached = audioCache[id];
    if (!cached) return;

    const link = document.createElement('a');
    link.href = cached.url;

    // Determinar extensión desde el blob
    const type = cached.blob.type;
    let extension = '.wav';
    if (type.includes('mpeg') || type.includes('mp3')) extension = '.mp3';
    else if (type.includes('aac')) extension = '.aac';
    else if (type.includes('wav')) extension = '.wav';

    link.download = `${prefix}_${id}_${new Date().toISOString().split('T')[0]}${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);

      // Feedback Visual
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }

      // Feedback Auditivo (Short beep)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);

    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#202123] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
      <header className="flex-none bg-white/80 dark:bg-[#343541]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 py-3 px-6 shadow-sm z-30 flex justify-between items-center sticky top-0">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {showApiKeyInput ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Pega tu API Key aquí"
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 w-48 outline-none focus:ring-1 focus:ring-brand"
                />
                <button onClick={() => setShowApiKeyInput(false)} className="text-xs font-bold text-gray-500 hover:text-brand">Cerrar</button>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-2 ${apiKey ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}
              >
                {apiKey ? '✓ API Key Lista' : 'Configurar API Key'}
              </button>
            )}
          </div>
          <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all active:scale-95">
            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
          </button>
        </div>
      </header>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#343541] relative scroll-smooth">
        <div className="max-w-3xl mx-auto min-h-full p-4 md:p-8 pb-40 space-y-6">

          {/* Welcome Screen */}
          {segments.length === 0 && appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in opacity-80 select-none">
              <Logo className="w-24 h-24 mb-6 opacity-80" withText={false} />
              <h2 className="text-2xl font-bold mb-2 text-gray-700 dark:text-gray-200">Transcribo Pro</h2>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
                Graba tu voz o escribe texto. <br />
                <span className="text-sm opacity-70">Gemini 3 Flash se encargará del resto.</span>
              </p>
            </div>
          )}

          {/* Transcriptions List */}
          {segments.map((msg) => (
            <div key={msg.id} className="bg-white dark:bg-[#444654] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 overflow-hidden animate-slide-up group">

              {/* Audio Original Playback Section */}
              {msg.audioUrl && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 p-4 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600 dark:text-blue-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                      </svg>
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">🎤 Audio Original Grabado</span>
                    </div>
                  </div>
                  <audio
                    controls
                    src={msg.audioUrl}
                    className="w-full mt-2 h-8 rounded-lg"
                    style={{ accentColor: '#10a37f' }}
                  />
                </div>
              )}

              <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand"></span>
                    Transcripción
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>

                {appState === AppState.PROCESSING && !msg.polishedVersion ? <SkeletonLoader /> : (
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">{msg.polishedVersion || "Procesando..."}</p>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              {msg.polishedVersion && (
                <div className="bg-gray-50/50 dark:bg-gray-800/30 px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 flex gap-2">
                  <button
                    onClick={() => playTTS(msg.polishedVersion || '', msg.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${playingId === msg.id && ttsStatus === 'playing' ? 'bg-brand text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'}`}
                  >
                    {playingId === msg.id && ttsStatus === 'loading' ? '●●●' : playingId === msg.id && ttsStatus === 'playing' ? '⏸' : playingId === msg.id && ttsStatus === 'paused' ? '▶' : '🔊 Escuchar'}
                  </button>
                  <div className="relative">
                    {copiedId === msg.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-2xl animate-bounce-subtle flex items-center gap-2 whitespace-nowrap z-50">
                        <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-2 h-2 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        Copiado
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(msg.polishedVersion || '', msg.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none ${copiedId === msg.id ? 'bg-green-500 text-white border-green-500 scale-105 shadow-lg shadow-green-500/20' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'}`}
                    >
                      {copiedId === msg.id ? '✓' : 'Copiar'}
                    </button>
                  </div>
                  {audioCache[msg.id] && (
                    <button onClick={() => downloadAudio(msg.id, 'transcripcion')} className="px-3 py-1.5 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors ml-auto flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Descargar Audio
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Text Improver Section */}
          {segments.length > 0 && appState !== AppState.PROCESSING && (
            <div className="animate-slide-up bg-white/50 dark:bg-[#444654]/50 rounded-2xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/30 backdrop-blur-sm">
              <TextImprover onImprove={handleImproveText} isProcessing={appState === AppState.IMPROVING} />
            </div>
          )}

          {/* Improvement Result */}
          {improvedResult && (
            <div ref={resultRef} className="bg-white dark:bg-[#444654] rounded-2xl shadow-xl border-l-4 border-brand p-6 md:p-8 animate-slide-up">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-brand">✨</span> Versión Mejorada
              </h3>
              {improvedResult.subject && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Asunto</span>
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 text-sm font-semibold">{improvedResult.subject}</div>
                </div>
              )}
              <div className="mb-6">
                <div className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">{improvedResult.body}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm max-sm:justify-end">
                <button onClick={() => playTTS(improvedResult.body, 'improved')} className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">
                  {playingId === 'improved' && ttsStatus === 'loading' ? '●●●' : playingId === 'improved' && ttsStatus === 'playing' ? '⏸' : playingId === 'improved' && ttsStatus === 'paused' ? '▶' : '🔊 Escuchar'}
                </button>
                <div className="relative flex-1 sm:flex-none">
                  {copiedId === 'improved' && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold px-4 py-2 rounded-xl shadow-2xl animate-bounce-subtle flex items-center gap-2 whitespace-nowrap z-50">
                      <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-2.5 h-2.5 text-white">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      ¡Copiado con éxito!
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[10px] border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                    </div>
                  )}
                  <button
                    onClick={() => copyToClipboard(improvedResult.body, 'improved')}
                    className={`w-full px-4 py-2 rounded-lg font-bold transition-all shadow-lg outline-none ${copiedId === 'improved' ? 'bg-green-500 text-white shadow-green-500/30 ring-2 ring-green-200 dark:ring-green-900/50' : 'bg-brand text-white shadow-brand/20 hover:bg-brandDark'}`}
                  >
                    {copiedId === 'improved' ? '✓ ¡Listo!' : 'Copiar Todo'}
                  </button>
                </div>
                {audioCache['improved'] && (
                  <button onClick={() => downloadAudio('improved', 'mejorado')} className="flex-1 sm:flex-none px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-all animate-fade-in flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Descargar
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Bottom Input Zone - Fixed */}
      <div className="flex-none bg-white dark:bg-[#343541] border-t border-gray-200 dark:border-gray-700/50 p-2 md:p-4 z-40 transition-all duration-300">
        <div className="max-w-3xl mx-auto">
          {/* Input Mode Tabs -- moved to top of bar for cleanliness */}
          <div className="flex gap-4 mb-3 px-2">
            <button
              onClick={() => setInputMode('voice')}
              className={`text-xs font-bold uppercase tracking-wider transition-colors ${inputMode === 'voice' ? 'text-brand' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              🎙️ Voz
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`text-xs font-bold uppercase tracking-wider transition-colors ${inputMode === 'text' ? 'text-brand' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              📝 Texto
            </button>
          </div>

          <div className="animate-fade-in relative">
            {inputMode === 'voice' ? (
              <Recorder onRecordingComplete={handleRecordingComplete} isProcessing={appState === AppState.PROCESSING} />
            ) : (
              <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Escribe o pega tu texto aquí..."
                  className="w-full max-h-32 min-h-[44px] p-2 bg-transparent resize-none outline-none text-base text-gray-800 dark:text-gray-200 placeholder-gray-400"
                  rows={1}
                  onInput={(e) => {
                    // Auto-grow
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
                <button
                  disabled={!manualText.trim()}
                  onClick={() => {
                    if (!manualText.trim()) return;
                    setSegments([{ id: Date.now().toString(), role: 'model', content: manualText, polishedVersion: manualText, timestamp: Date.now() }]);
                    setImprovedResult(null);
                    setManualText('');
                  }}
                  className="p-2.5 bg-brand text-white rounded-lg hover:bg-brandDark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
