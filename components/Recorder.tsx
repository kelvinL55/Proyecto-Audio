import React, { useState, useRef, useEffect } from 'react';
import { visualizeAudio } from '../utils/audioUtils';

interface RecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isProcessing: boolean;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [micGain, setMicGain] = useState(2.0); // Factor de amplificación
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cargar lista de micrófonos y seleccionar automáticamente
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = deviceList
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Micrófono ${device.deviceId.slice(0, 5)}...`
          }));
        
        setDevices(audioInputs);
        
        // Lógica de selección automática: Priorizar 'default'
        const defaultDevice = audioInputs.find(d => d.deviceId === 'default');
        
        if (defaultDevice) {
           setSelectedDeviceId('default');
        } else if (audioInputs.length > 0) {
           // Si no hay default explícito, tomamos el primero
           setSelectedDeviceId(audioInputs[0].deviceId);
        }

      } catch (err) {
        console.error("Error al obtener dispositivos:", err);
      }
    };

    getDevices();
    
    // Escuchar cambios de dispositivos (conectar/desconectar audífonos)
    const handleDeviceChange = () => {
       getDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micGain;
    }
  }, [micGain]);

  const startRecording = async () => {
    try {
      const constraints = { 
        audio: { 
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false 
        } 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = micGain;
      gainNodeRef.current = gainNode;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const destination = audioCtx.createMediaStreamDestination();

      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(destination);

      if (canvasRef.current && analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        visualizeAudio(canvasRef.current, analyser, dataArray, true);
      }

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob);
        if (canvasRef.current && analyserRef.current) {
           visualizeAudio(canvasRef.current, analyserRef.current, new Uint8Array(0), false);
        }
        stopCleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("No se pudo acceder al micrófono seleccionado.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopCleanup = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      
      {/* Controles Superiores: Selección de Micrófono */}
      <div className="flex items-center gap-3 bg-white dark:bg-[#343541] px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600/50 shadow-sm transition-colors duration-200 hover:border-gray-300 dark:hover:border-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500 dark:text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        <div className="relative w-full">
          <select 
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={isRecording}
            className="w-full bg-transparent text-sm font-medium text-gray-800 dark:text-gray-200 outline-none cursor-pointer disabled:opacity-50 appearance-none"
          >
            {devices.length === 0 && <option>Detectando micrófonos...</option>}
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId} className="bg-white dark:bg-[#343541]">
                {device.label}
              </option>
            ))}
          </select>
          {/* Custom Chevron for select */}
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-4 w-full">
        {/* Visualizador */}
        <div className={`flex-1 h-24 md:h-auto min-h-[100px] bg-white dark:bg-[#343541] rounded-2xl border ${isRecording ? 'border-brand shadow-[0_0_15px_rgba(16,163,127,0.15)]' : 'border-gray-200 dark:border-gray-600/50'} overflow-hidden relative transition-all duration-300`}>
          <canvas ref={canvasRef} width={500} height={100} className="w-full h-full" />
          
          {!isRecording && !isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 pointer-events-none">
               <span className="text-xs font-bold uppercase tracking-widest opacity-70">Visualizador de Audio</span>
            </div>
          )}
          
          {isRecording && (
            <div className="absolute top-3 right-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md border border-red-100 dark:border-red-900/30">
               <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Grabando</span>
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="flex flex-col gap-3 w-full md:w-56 shrink-0">
          {/* Ganancia */}
          <div className="bg-white dark:bg-[#343541] px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600/50 transition-colors duration-200">
             <div className="flex justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                <span>Amplificación</span>
                <span className="text-brand font-mono">{Math.round(micGain * 100)}%</span>
             </div>
             <input 
                type="range" min="1" max="5" step="0.1" 
                value={micGain} 
                onChange={(e) => setMicGain(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand"
             />
          </div>

          {/* Botón Acción */}
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 flex justify-center items-center gap-2 transform active:scale-[0.98] ${
                isProcessing 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-300 dark:border-gray-600'
                  : 'bg-brand hover:bg-brandDark text-white shadow-lg shadow-brand/20 hover:shadow-brand/40'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-gray-500">PROCESANDO...</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-white border-2 border-brandDark/20"></div>
                  <span>GRABAR</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full py-3.5 bg-white dark:bg-[#343541] border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl font-bold text-sm shadow-md transition-all duration-200 flex justify-center items-center gap-2 active:scale-[0.98]"
            >
              <div className="w-3 h-3 rounded bg-red-500 animate-pulse"></div>
              DETENER
            </button>
          )}
        </div>
      </div>
    </div>
  );
};