
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
  link?: string;
  bgFull?: boolean;
}

interface SolutionsCarouselProps {
  products: Product[];
  onAction?: () => void;
}

const AUTOPLAY_MS = 9000;
const SLIDE_TRANSITION = { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const };

export function SolutionsCarousel({ products, onAction }: SolutionsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const count = products.length;

  const goTo = useCallback((i: number) => {
    setIndex(((i % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1 || isPaused) return;
    const t = setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [index, count, isPaused, goTo]);

  const getOffset = (i: number) => {
    let diff = i - index;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  };

  const handleAction = (p: Product) => {
    if (p.link) {
      window.open(p.link, '_blank', 'noopener,noreferrer');
    } else {
      onAction?.();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative h-[560px] flex items-center justify-center [perspective:1600px]">
        <div className="absolute w-[420px] h-[420px] rounded-full bg-orange-600/10 blur-[110px] pointer-events-none animate-pulse" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent pointer-events-none" />

        {products.map((p, i) => {
          const offset = getOffset(i);
          const isActive = offset === 0;
          const isHovered = hovered === i;
          const abs = Math.abs(offset);
          if (abs > 2) return null;

          const baseScale = isActive ? 1 : 0.76 - (abs - 1) * 0.1;

          return (
            <motion.div
              key={i}
              className="absolute w-[300px] md:w-[420px] h-[440px]"
              style={{ zIndex: count - abs + (isHovered ? 10 : 0), cursor: isActive ? 'default' : 'pointer' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              animate={{
                x: offset * 270,
                scale: isHovered ? baseScale + 0.05 : baseScale,
                opacity: abs > 1 ? 0 : isActive ? 1 : 0.35,
                rotateY: offset * -28,
                filter: isActive ? 'blur(0px)' : 'blur(2px)',
              }}
              transition={SLIDE_TRANSITION}
              onClick={() => !isActive && goTo(i)}
            >
              <div
                className={`h-full flex flex-col justify-between glass rounded-3xl border p-10 relative overflow-hidden transition-all duration-500 ${
                  isActive || isHovered
                    ? 'border-orange-500/50 shadow-[0_0_70px_rgba(255,115,0,0.2)]'
                    : 'border-white/5'
                }`}
              >
                {p.bgFull ? (
                  <>
                    <div className="absolute inset-0 pointer-events-none">
                      <img src={p.icon} className="w-full h-full object-cover object-left" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/30 pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute -top-4 -right-8 w-56 h-56 opacity-20 pointer-events-none">
                    <img src={p.icon} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="relative z-10 space-y-5">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${p.color}`}>{p.tag}</div>
                  <h3
                    className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter ${
                      p.bgFull ? 'text-white [text-shadow:0_0_10px_rgba(255,115,0,0.35)]' : ''
                    }`}
                  >
                    {p.title}
                  </h3>
                  <p
                    className={`text-xs md:text-sm font-bold uppercase leading-relaxed tracking-tight ${
                      p.bgFull
                        ? 'text-white [text-shadow:0_0_8px_rgba(255,115,0,0.3)]'
                        : 'text-gray-500'
                    }`}
                  >
                    {p.desc}
                  </p>
                </div>
                <div className="relative z-10">
                  {isActive && (
                    <GlassButton
                      onClick={() => handleAction(p)}
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
