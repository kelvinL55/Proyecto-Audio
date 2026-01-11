import React, { useState } from 'react';
import { ImprovementOptions, PlatformType, EmailTone, ChatTone, InstructionTone } from '../types';

interface TextImproverProps {
  onImprove: (options: ImprovementOptions) => void;
  isProcessing: boolean;
}

export const TextImprover: React.FC<TextImproverProps> = ({ onImprove, isProcessing }) => {
  const [platform, setPlatform] = useState<PlatformType>('email');
  const [emailTone, setEmailTone] = useState<EmailTone>('formal');
  const [chatTone, setChatTone] = useState<ChatTone>('friendly');
  const [instructionTone, setInstructionTone] = useState<InstructionTone>('professional');
  const [useEmojis, setUseEmojis] = useState<boolean>(true);
  const [isHumanized, setIsHumanized] = useState<boolean>(false);

  const handleSubmit = () => {
    const options: ImprovementOptions = {
      type: platform,
      emailTone: platform === 'email' ? emailTone : undefined,
      chatTone: platform === 'chat' ? chatTone : undefined,
      instructionTone: platform === 'instructions' ? instructionTone : undefined,
      useEmojis: platform === 'chat' ? useEmojis : undefined,
      isHumanized: isHumanized,
    };
    onImprove(options);
  };

  const getChatToneLabel = (tone: ChatTone) => {
    switch (tone) {
      case 'angry': return '😡 Enojado';
      case 'serious': return '😐 Serio';
      case 'friendly': return '😊 Amistoso';
      case 'professional': return '💼 Profesional';
      case 'formal': return '👔 Formal';
      default: return tone;
    }
  };

  const getInstructionToneLabel = (tone: InstructionTone) => {
    switch (tone) {
      case 'professional': return '💼 Profesional';
      case 'semi-formal': return '👔 Semi-formal';
      case 'neutral': return '😐 Neutral';
      default: return tone;
    }
  };

  return (
    <div className="bg-white dark:bg-[#40414F] border border-gray-200 dark:border-gray-700/50 rounded-lg p-6 mt-8 shadow-sm transition-colors duration-200">
      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Mejorar y Adaptar Texto
      </h3>

      {/* Selector de Plataforma */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setPlatform('email')}
          className={`py-3 px-4 rounded-lg flex items-center justify-center gap-2 border transition-all ${
            platform === 'email'
              ? 'bg-[#10a37f]/10 border-[#10a37f] text-[#10a37f] font-semibold shadow-sm'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          Email
        </button>
        <button
          onClick={() => setPlatform('chat')}
          className={`py-3 px-4 rounded-lg flex items-center justify-center gap-2 border transition-all ${
            platform === 'chat'
              ? 'bg-[#10a37f]/10 border-[#10a37f] text-[#10a37f] font-semibold shadow-sm'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          Chat
        </button>
        <button
          onClick={() => setPlatform('instructions')}
          className={`py-3 px-4 rounded-lg flex items-center justify-center gap-2 border transition-all ${
            platform === 'instructions'
              ? 'bg-[#10a37f]/10 border-[#10a37f] text-[#10a37f] font-semibold shadow-sm'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Instrucciones
        </button>
      </div>

      {/* Opciones Específicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* COLUMNA 1: Tono */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-tight">
            Tono del Mensaje
          </label>
          <div className="flex flex-wrap gap-2">
            {platform === 'email' && (
              <>
                {(['formal', 'semi-formal', 'neutral'] as EmailTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEmailTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize border transition-colors ${
                      emailTone === t
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-300 shadow-sm'
                        : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </>
            )}
            {platform === 'chat' && (
              <>
                {(['angry', 'serious', 'friendly', 'professional', 'formal'] as ChatTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChatTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize border transition-colors ${
                      chatTone === t
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-300 shadow-sm'
                        : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {getChatToneLabel(t)}
                  </button>
                ))}
              </>
            )}
            {platform === 'instructions' && (
              <>
                {(['professional', 'semi-formal', 'neutral'] as InstructionTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInstructionTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize border transition-colors ${
                      instructionTone === t
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-600 dark:text-emerald-300 shadow-sm'
                        : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {getInstructionToneLabel(t)}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* COLUMNA 2: Opciones de Estilo */}
        <div>
           <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-tight">
              Opciones de Estilo
            </label>
           <div className="flex flex-col gap-2">
              
              <label className={`flex items-center gap-2 cursor-pointer p-2 rounded transition-colors ${isHumanized ? 'bg-[#10a37f]/10 border border-[#10a37f]/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
                <input 
                  type="checkbox" 
                  checked={isHumanized} 
                  onChange={(e) => setIsHumanized(e.target.checked)}
                  className="w-4 h-4 text-[#10a37f] rounded focus:ring-[#10a37f] border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 accent-[#10a37f]"
                />
                <span className={`text-sm ${isHumanized ? 'text-[#10a37f] font-semibold' : 'text-gray-700 dark:text-gray-200'}`}>Humanizar Texto 🧬</span>
              </label>

              {platform === 'chat' && (
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <input 
                    type="checkbox" 
                    checked={useEmojis} 
                    onChange={(e) => setUseEmojis(e.target.checked)}
                    className="w-4 h-4 text-[#10a37f] rounded focus:ring-[#10a37f] border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 accent-[#10a37f]"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Usar Emojis ✨</span>
                </label>
              )}
           </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isProcessing}
        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
           isProcessing 
           ? 'bg-gray-400 cursor-not-allowed' 
           : 'bg-[#10a37f] hover:bg-[#0d8c6d] shadow-brand/20'
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Procesando Mejora...
          </div>
        ) : 'TRANSFORMAR TEXTO AHORA'}
      </button>
    </div>
  );
};