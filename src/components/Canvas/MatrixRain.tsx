import { useEffect, useRef } from 'react';

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const fontSize = 14;
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const columns = Math.floor(w() / fontSize);
    const drops: number[] = [];
    const speeds: number[] = [];
    const opacity: number[] = [];

    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * h() / fontSize;
      speeds[i] = Math.random() * 0.4 + 0.1;
      opacity[i] = Math.random() * 0.3 + 0.05;
    }

    // Theme detection
    const isDark = () => document.documentElement.classList.contains('dark');
    const getFadeColor = () => isDark() ? 'rgba(6, 8, 13, 0.06)' : 'rgba(245, 247, 250, 0.06)';
    const getHeadColor = (op: number) => isDark()
      ? `rgba(0, 229, 255, ${op + 0.2})`
      : `rgba(0, 145, 174, ${op + 0.2})`;
    const getTrailColor = (op: number) => isDark()
      ? `rgba(0, 255, 136, ${op * 0.5})`
      : `rgba(0, 168, 107, ${op * 0.5})`;

    const animate = () => {
      // Semi-transparent fade (theme-aware)
      ctx.fillStyle = getFadeColor();
      ctx.fillRect(0, 0, w(), h());

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Head character (brighter)
        ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = getHeadColor(opacity[i]);
        ctx.fillText(char, x, y);

        // Trail characters (dimmer)
        if (Math.random() > 0.7) {
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillStyle = getTrailColor(opacity[i]);
          ctx.fillText(trailChar, x, y - fontSize);
        }

        drops[i] += speeds[i];

        if (drops[i] * fontSize > h() && Math.random() > 0.98) {
          drops[i] = 0;
          speeds[i] = Math.random() * 0.4 + 0.1;
          opacity[i] = Math.random() * 0.3 + 0.05;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.35,
        pointerEvents: 'none',
      }}
    />
  );
}
