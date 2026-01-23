
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  neonBorder?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', neonBorder = false, onClick, style }) => {
  return (
    <div 
      onClick={onClick}
      style={style}
      className={`glass p-6 rounded-2xl transition-all duration-300 border border-white/5 hover:border-orange-500/40 group ${neonBorder ? 'neon-border' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
