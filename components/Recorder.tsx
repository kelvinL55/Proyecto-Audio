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
    <div className="space-y-3">
      {/* Control de Ganancia del Micrófono */}
      <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/30">
        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          🎚️ Nivel de Ganancia del Micrófono
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-8">0.5x</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={micGain}
            onChange={(e) => setMicGain(parseFloat(e.target.value))}
            disabled={isRecording}
            className="flex-1 accent-brand h-2 rounded-lg bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer disabled:opacity-50"
          />
          <span className="text-xs text-gray-400 w-8">5x</span>
          <span className="text-sm font-bold text-brand bg-brand/10 px-3 py-1 rounded-full min-w-[60px] text-center">
            {micGain.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Controles de Grabación */}
      <div className="flex items-center gap-3 w-full bg-white dark:bg-[#343541] p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Selector de Micrófono (Compacto) */}
        <div className="relative shrink-0">
          <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={isRecording}
            className="pl-8 pr-6 py-2 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg outline-none cursor-pointer disabled:opacity-50 appearance-none hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-32 md:w-48 truncate"
            title="Seleccionar micrófono"
          >
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Visualizador (Flexible) */}
        <div className="flex-1 h-12 bg-gray-50 dark:bg-black/20 rounded-lg overflow-hidden relative border border-gray-100 dark:border-gray-700/50">
          <canvas ref={canvasRef} width={300} height={50} className="w-full h-full opacity-80" />

          {!isRecording && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Listo para Grabar</span>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-1 right-2 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[9px] text-red-500 font-bold">REC</span>
            </div>
          )}
        </div>

        {/* Botón Principal (Circular/Compacto) */}
        <div className="shrink-0 flex gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200 transform active:scale-95 ${isProcessing
                ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                : 'bg-brand hover:bg-brandDark text-white shadow-lg shadow-brand/20'
                }`}
              title="Iniciar Grabación"
            >
              {isProcessing ? (
                <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <div className="w-4 h-4 rounded-full bg-white"></div>
              )}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="h-12 w-12 bg-white dark:bg-[#343541] border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-95"
              title="Detener Grabación"
            >
              <div className="w-4 h-4 rounded bg-red-500 animate-pulse"></div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
