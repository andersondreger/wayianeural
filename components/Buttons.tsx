
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export const NeonButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`relative group px-6 py-3 rounded-lg font-bold text-white transition-all transform hover:scale-[1.01] active:scale-95 overflow-hidden shadow-lg shadow-orange-600/20 ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-rajado opacity-90 group-hover:opacity-100 transition-opacity" />
      <span className="relative z-10 flex items-center justify-center gap-2 uppercase tracking-wider text-[10px]">
        {children}
      </span>
    </button>
  );
};

export const GlassButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`px-6 py-3 rounded-lg font-bold text-white transition-all backdrop-blur-md bg-white/5 
      border border-white/10 hover:bg-white/10 active:scale-95 hover:border-orange-500/30 uppercase tracking-wider text-[10px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
