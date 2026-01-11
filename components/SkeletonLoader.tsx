import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="w-full space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 rounded-full bg-brand animate-pulse"></div>
        <span className="text-sm font-medium text-brand animate-pulse">Analizando audio y transcribiendo...</span>
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full rounded skeleton-loader"></div>
        <div className="h-4 w-[95%] rounded skeleton-loader"></div>
        <div className="h-4 w-[90%] rounded skeleton-loader"></div>
        <div className="h-4 w-[80%] rounded skeleton-loader"></div>
      </div>
    </div>
  );
};
