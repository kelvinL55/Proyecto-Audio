import React from 'react';
import { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
  onPlayTTS: (text: string) => void;
  isPlaying: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onPlayTTS, isPlaying }) => {
  const isUser = message.role === 'user';
  // Simple check if this specific message content is likely being played if isPlaying is true, 
  // but for simplicity we just disable all buttons when any audio plays.

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
      <div 
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 ${
          isUser 
            ? 'bg-[#10a37f] text-white' 
            : 'bg-[#444654] text-[#ECECF1] border border-gray-700/50' 
        }`}
      >
        <div className="flex flex-col gap-2">
          {isUser && message.audioUrl && (
            <div className="mb-2">
              <audio controls src={message.audioUrl} className="h-8 w-full max-w-[200px] opacity-80" />
              <p className="text-xs text-white/70 mt-1 italic">Audio grabado (Amplificado)</p>
            </div>
          )}

          {!isUser && (
            <div className="flex justify-between items-start mb-2 border-b border-gray-600 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transcribo Pro</span>
              <button 
                onClick={() => onPlayTTS(message.polishedVersion || message.content)}
                disabled={isPlaying}
                className={`transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${isPlaying ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title="Leer en voz alta"
              >
                {isPlaying ? (
                  <>
                    <span className="animate-pulse">Reproduciendo...</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 animate-spin">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.118 15.011 9.009 9.009 0 0 1 3.392 5.57c.78-.329 1.55-.492 2.158-.492h.933Z" />
                    </svg>
                  </>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.118 15.011 9.009 9.009 0 0 1 3.392 5.57c.78-.329 1.55-.492 2.158-.492h.933Z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {isUser ? (
             <p>{message.content}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Transcripción Mejorada (Gramática y Puntuación):</p>
                <p className="text-base leading-relaxed whitespace-pre-wrap">{message.polishedVersion}</p>
              </div>
              
              {message.originalTranscription && message.originalTranscription !== message.polishedVersion && (
                <div className="pt-3 border-t border-gray-600/50">
                  <p className="text-xs text-gray-500 mb-1">Transcripción Literal (Raw):</p>
                  <p className="text-sm text-gray-400 italic">{message.originalTranscription}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};