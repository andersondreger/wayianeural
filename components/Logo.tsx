import React from 'react';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg', className?: string, onClick?: () => void }> = ({ size = 'md', className = '', onClick }) => {
  const sizes = {
    sm: 'h-10 md:h-12',
    md: 'h-16 md:h-20',
    lg: 'h-28 md:h-36'
  };

  return (
    <div className={`flex items-center cursor-pointer select-none ${className}`} onClick={onClick}>
      <img
        src="/images/wayia-logo.png"
        alt="WayFlow Neural"
        className={`${sizes[size]} object-contain brightness-110 contrast-125 transition-transform hover:scale-105`}
      />
    </div>
  );
};