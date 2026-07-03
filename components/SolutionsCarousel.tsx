
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { GlassButton } from './Buttons';

interface Product {
  title: string;
  desc: string;
  icon: string;
  color: string;
  tag: string;
}

interface SolutionsCarouselProps {
  products: Product[];
  onAction?: () => void;
}

export function SolutionsCarousel({ products, onAction }: SolutionsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = products.length;

  const goTo = useCallback((i: number) => {
    setIndex(((i % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1 || isPaused) return;
    const t = setInterval(() => goTo(index + 1), 5000);
    return () => clearInterval(t);
  }, [index, count, isPaused, goTo]);

  const getOffset = (i: number) => {
    let diff = i - index;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative h-[540px] flex items-center justify-center [perspective:1600px]">
        <div className="absolute w-[420px] h-[420px] rounded-full bg-orange-600/10 blur-[110px] pointer-events-none animate-pulse" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent pointer-events-none" />

        {products.map((p, i) => {
          const offset = getOffset(i);
          const isActive = offset === 0;
          const abs = Math.abs(offset);
          if (abs > 2) return null;

          return (
            <motion.div
              key={i}
              className="absolute w-[300px] md:w-[420px]"
              style={{ zIndex: count - abs, cursor: isActive ? 'default' : 'pointer' }}
              animate={{
                x: offset * 270,
                scale: isActive ? 1 : 0.76 - (abs - 1) * 0.1,
                opacity: abs > 1 ? 0 : isActive ? 1 : 0.35,
                rotateY: offset * -28,
                filter: isActive ? 'blur(0px)' : 'blur(2px)',
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onClick={() => !isActive && goTo(i)}
            >
              <div
                className={`glass rounded-3xl border p-10 relative overflow-hidden transition-colors duration-500 ${
                  isActive
                    ? 'border-orange-500/40 shadow-[0_0_60px_rgba(255,115,0,0.15)]'
                    : 'border-white/5'
                }`}
              >
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <img src={p.icon} className="w-28 h-28 object-contain" />
                </div>
                <div className="relative z-10 space-y-5">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${p.color}`}>{p.tag}</div>
                  <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">{p.title}</h3>
                  <p className="text-gray-500 text-xs md:text-sm font-bold uppercase leading-relaxed tracking-tight min-h-[80px]">
                    {p.desc}
                  </p>
                  {isActive && (
                    <GlassButton
                      onClick={onAction}
                      className="!px-8 !py-4 !text-[10px] hover:bg-orange-500 hover:text-white transition-all"
                    >
                      Ativar Licença <ArrowUpRight size={14} className="inline ml-2" />
                    </GlassButton>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-8 mt-6">
        <button
          onClick={() => goTo(index - 1)}
          className="w-12 h-12 rounded-full glass border border-white/10 flex items-center justify-center hover:border-orange-500/40 hover:text-orange-500 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex gap-3">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index ? 'w-8 bg-orange-500' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(index + 1)}
          className="w-12 h-12 rounded-full glass border border-white/10 flex items-center justify-center hover:border-orange-500/40 hover:text-orange-500 transition-all"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
