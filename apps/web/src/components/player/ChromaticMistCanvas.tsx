import React, { useEffect, useRef } from 'react';
import { extractPaletteFromImage, ExtractedAlbumColors } from '../../theme/dynamicTheme';

interface ChromaticMistCanvasProps {
  artworkUrl?: string | null;
  enabled?: boolean;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Cloud {
  color: string;
  baseX: number;
  baseY: number;
  radiusFactor: number;
  phase: number;
  speed: number;
  alpha: number;
}

export const ChromaticMistCanvas: React.FC<ChromaticMistCanvasProps> = ({
  artworkUrl,
  enabled = true,
  opacity = 0.55,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef<ExtractedAlbumColors>({
    dominant: '#23477c',
    secondary: '#3f4759',
    accent: '#a8c7fa',
    tertiary: '#573e5e',
    surface: '#111318'
  });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!artworkUrl) return;
    let isCurrent = true;

    extractPaletteFromImage(artworkUrl).then((colors) => {
      if (isCurrent) {
        colorsRef.current = colors;
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [artworkUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const clouds: Cloud[] = [
      { color: 'dominant', baseX: 0.22, baseY: 0.18, radiusFactor: 0.85, phase: 0, speed: 0.00045, alpha: 0.65 },
      { color: 'secondary', baseX: 0.82, baseY: 0.82, radiusFactor: 0.8, phase: Math.PI * 0.5, speed: 0.00035, alpha: 0.55 },
      { color: 'accent', baseX: 0.75, baseY: 0.28, radiusFactor: 0.7, phase: Math.PI, speed: 0.0005, alpha: 0.45 },
      { color: 'tertiary', baseX: 0.18, baseY: 0.72, radiusFactor: 0.65, phase: Math.PI * 1.5, speed: 0.0004, alpha: 0.4 }
    ];

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      // Deep dark base
      ctx.fillStyle = colorsRef.current.surface || '#111318';
      ctx.fillRect(0, 0, width, height);

      // Draw each drifting chromatic cloud
      for (const cloud of clouds) {
        const hex = colorsRef.current[cloud.color as keyof ExtractedAlbumColors] || '#23477c';
        const t = elapsed * cloud.speed + cloud.phase;
        const cx = cloud.baseX * width + Math.cos(t) * (width * 0.14);
        const cy = cloud.baseY * height + Math.sin(t * 0.85) * (height * 0.14);
        const radius = Math.max(width, height) * cloud.radiusFactor;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, hexToRgba(hex, cloud.alpha * opacity));
        grad.addColorStop(0.5, hexToRgba(hex, cloud.alpha * opacity * 0.4));
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [enabled, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        filter: 'blur(60px)',
        transform: 'scale(1.15)', // Prevent edge clipping from blur
        zIndex: 0,
        ...style
      }}
    />
  );
};

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(35, 71, 124, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
