import React, { useState } from 'react';
import { ImprovementOptions, PlatformType, EmailTone, ChatTone, InstructionTone, PromptCategory } from '../types';

interface TextImproverProps {
  onImprove: (options: ImprovementOptions) => void;
  isProcessing: boolean;
}

export const TextImprover: React.FC<TextImproverProps> = ({ onImprove, isProcessing }) => {
  const [platform, setPlatform] = useState<PlatformType>('email');
  const [emailTone, setEmailTone] = useState<EmailTone>('formal');
  const [chatTone, setChatTone] = useState<ChatTone>('friendly');
  const [instructionTone, setInstructionTone] = useState<InstructionTone>('professional');
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('general');
  const [imaginationLevel, setImaginationLevel] = useState<number>(3);
  const [useEmojis, setUseEmojis] = useState<boolean>(true);
  const [isHumanized, setIsHumanized] = useState<boolean>(false);

  const handleSubmit = () => {
    const options: ImprovementOptions = {
      type: platform,
      emailTone: platform === 'email' ? emailTone : undefined,
      chatTone: platform === 'chat' ? chatTone : undefined,
      instructionTone: platform === 'instructions' ? instructionTone : undefined,
      promptCategory: platform === 'prompt_improver' ? promptCategory : undefined,
      imaginationLevel: platform === 'prompt_improver' ? imaginationLevel : undefined,
      useEmojis: platform === 'chat' ? useEmojis : undefined,
      isHumanized: isHumanized,
    };
    onImprove(options);
  };

  return (
    <div className="bg-white dark:bg-[#40414F] border border-gray-200 dark:border-gray-700/50 rounded-lg p-6 mt-8 shadow-sm transition-colors duration-200">
      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex justify-between">
        <span>Mejorar y Adaptar Texto</span>
        {platform === 'prompt_improver' && <span className="text-purple-500 text-[10px] animate-pulse">PRO MODE</span>}
      </h3>

      {/* Selector de Plataforma Principal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {[
          { id: 'email', label: 'Email', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
          { id: 'chat', label: 'Chat', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
          { id: 'instructions', label: 'Instruc.', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
          { id: 'prompt_improver', label: 'Mejorar Prompt', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setPlatform(opt.id as PlatformType)}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 border text-xs font-bold transition-all ${
              platform === opt.id
                ? 'bg-brand/10 border-brand text-brand shadow-sm'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} />
            </svg>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Opciones Específicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">
            {platform === 'prompt_improver' ? 'Tipo de Prompt' : 'Tono del Mensaje'}
          </label>
          <div className="flex flex-wrap gap-2">
            {platform === 'email' && (['formal', 'semi-formal', 'neutral'] as EmailTone[]).map(t => (
              <button key={t} onClick={() => setEmailTone(t)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${emailTone === t ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>{t}</button>
            ))}
            {platform === 'chat' && (['angry', 'serious', 'friendly', 'professional', 'formal'] as ChatTone[]).map(t => (
              <button key={t} onClick={() => setChatTone(t)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${chatTone === t ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-300 dark:border-gray-600'}`}>{t}</button>
            ))}
            {platform === 'instructions' && (['professional', 'semi-formal', 'neutral'] as InstructionTone[]).map(t => (
              <button key={t} onClick={() => setInstructionTone(t)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${instructionTone === t ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>{t}</button>
            ))}
            {platform === 'prompt_improver' && (['general', 'image', 'code', 'video'] as PromptCategory[]).map(c => (
              <button key={c} onClick={() => setPromptCategory(c)} className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1 ${promptCategory === c ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {c === 'image' && '🖼️'} {c === 'code' && '💻'} {c === 'video' && '🎥'} {c === 'general' && '🧠'}
                <span className="capitalize">{c}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
           <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">
              {platform === 'prompt_improver' ? 'Nivel de Imaginación' : 'Opciones Pro'}
            </label>
           {platform === 'prompt_improver' ? (
             <div className="px-2">
               <input type="range" min="1" max="5" value={imaginationLevel} onChange={(e) => setImaginationLevel(parseInt(e.target.value))} className="w-full accent-indigo-600 h-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer" />
               <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-mono">
                  <span>CONSERVADOR</span>
                  <span className="text-indigo-500 font-bold">NIVEL {imaginationLevel}</span>
                  <span>CREATIVO</span>
               </div>
             </div>
           ) : (
             <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                  <input type="checkbox" checked={isHumanized} onChange={(e) => setIsHumanized(e.target.checked)} className="w-4 h-4 accent-brand" />
                  <span className="text-sm">Humanizar Texto 🧬</span>
                </label>
                {platform === 'chat' && (
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                    <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="w-4 h-4 accent-brand" />
                    <span className="text-sm">Usar Emojis ✨</span>
                  </label>
                )}
             </div>
           )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isProcessing}
        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
           isProcessing ? 'bg-gray-400 cursor-not-allowed' : 
           platform === 'prompt_improver' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30' : 'bg-brand hover:bg-brandDark shadow-brand/20'
        }`}
      >
        {isProcessing ? 'Procesando...' : platform === 'prompt_improver' ? 'MEJORAR PROMPT PROFESIONALMENTE' : 'TRANSFORMAR TEXTO'}
      </button>
    </div>
  );
};