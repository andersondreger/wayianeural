
// Add explicit React import for React.ReactNode usage
import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WayFlow Neural v3.1 | Engine Imparável",
  description: "Enterprise-grade AI scalability platform",
};

export default function RootLayout({
  children,
}: {
  // Fix: React namespace error resolved by importing React
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;400;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --neon-orange: #ff7300;
            --bg-black: #050505;
          }
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-black);
            color: white;
            margin: 0;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
          }
          .grid-engine {
            background-image: linear-gradient(rgba(255, 115, 0, 0.05) 1px, transparent 1px), 
                              linear-gradient(90deg, rgba(255, 115, 0, 0.05) 1px, transparent 1px);
            background-size: 50px 50px;
          }
          .bg-rajado {
            background: linear-gradient(
                45deg, 
                #ea580c 25%, #f97316 25%, #f97316 50%, 
                #ea580c 50%, #ea580c 75%, #f97316 75%, #f97316 100%
            );
            background-size: 40px 40px;
            animation: move-stripes 3s linear infinite;
          }
          @keyframes move-stripes {
            0% { background-position: 0 0; }
            100% { background-position: 40px 0; }
          }
          .neon-pulse {
            animation: neon-pulse-anim 3s infinite ease-in-out;
          }
          @keyframes neon-pulse-anim {
            0%, 100% { text-shadow: 0 0 15px rgba(255, 115, 0, 0.2); color: #fb923c; }
            50% { text-shadow: 0 0 40px rgba(255, 115, 0, 0.6); color: #ff7300; }
          }
          .glass {
            background: rgba(255, 255, 255, 0.015);
            backdrop-filter: blur(28px);
            border: 1px solid rgba(255, 255, 255, 0.04);
          }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ff7300; }

          @keyframes marquee-ltr {
              0% { transform: translateX(-50%); }
              100% { transform: translateX(0%); }
          }
          .animate-marquee {
              display: flex;
              width: max-content;
              animation: marquee-ltr 30s linear infinite;
          }
          [data-rbd-droppable-id] {
              min-height: 200px;
          }
        `}</style>
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
