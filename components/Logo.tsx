import React from 'react';

interface LogoProps {
  className?: string;
  withText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-8 h-8", withText = true }) => {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className={`${className} text-brand relative`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
           <rect width="40" height="40" rx="10" className="fill-brand/10 dark:fill-brand/20" />
           <path d="M12 20L15 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
           <path d="M19 14V26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
           <path d="M25 10V30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
           <path d="M31 17V23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      {withText && (
        <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
          Transcribo<span className="text-brand">Pro</span>
        </span>
      )}
    </div>
  );
};
