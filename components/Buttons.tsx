
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export const NeonButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`relative group px-8 py-3.5 rounded-full font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 overflow-hidden shadow-2xl shadow-orange-600/10 ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-rajado opacity-90 group-hover:opacity-100 transition-opacity" />
      <span className="relative z-10 flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[10px] font-extrabold">
        {children}
      </span>
    </button>
  );
};

export const GlassButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`px-6 py-3 rounded-full font-bold text-gray-300 transition-all backdrop-blur-md bg-white/5 
      border border-white/10 hover:bg-white/10 hover:text-white active:scale-95 hover:border-orange-500/30 uppercase tracking-[0.2em] text-[9px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
