import { useEffect, useRef } from 'react';

interface TrailPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface RocketParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface ActiveRocket {
  x: number;
  y: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  angle: number;
  trail: { x: number; y: number; life: number }[];
}

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -100, y: -100, targetX: -100, targetY: -100 });
  const pointsRef = useRef<TrailPoint[]>([]);
  const rocketsRef = useRef<ActiveRocket[]>([]);
  const rocketParticlesRef = useRef<RocketParticle[]>([]);
  const isHoveringClickableRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Skip on mobile or reduced motion
    if (window.innerWidth < 768) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Track mouse
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;

      // Emit trail points
      for (let i = 0; i < 2; i++) {
        pointsRef.current.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1,
          maxLife: 1,
          size: Math.random() * 2 + 1,
        });
      }
      if (pointsRef.current.length > 60) {
        pointsRef.current = pointsRef.current.slice(-50);
      }
    };

    // Check if hovering a clickable element
    const checkHover = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const isClickable = !!el.closest('a, button, [role="button"], .card, .btn, .post-card, .tag');
      if (isClickable !== isHoveringClickableRef.current) {
        isHoveringClickableRef.current = isClickable;
        if (isClickable) {
          // Launch a rocket!
          launchRocket(e.clientX, e.clientY);
        }
      }
    };

    const launchRocket = (x: number, y: number) => {
      // Random angle between -60 and 60 degrees from vertical
      const angleDeg = (Math.random() - 0.5) * 120;
      const angle = (angleDeg - 90) * (Math.PI / 180); // -90 makes it upward
      const speed = 4 + Math.random() * 3;

      rocketsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        angle,
        trail: [],
      });

      // Limit concurrent rockets
      if (rocketsRef.current.length > 5) {
        rocketsRef.current.shift();
      }
    };

    const onClick = (e: MouseEvent) => {
      // On click, spawn explosion particles
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        rocketParticlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          size: Math.random() * 3 + 1,
          hue: Math.random() > 0.5 ? 190 : 145, // cyan or green
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousemove', checkHover);
    window.addEventListener('click', onClick);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Smooth follow
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.35;
      m.y += (m.targetY - m.y) * 0.35;
      const mx = m.x;
      const my = m.y;

      // ─── Draw trail points ───
      const pts = pointsRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.life -= 0.025;
        if (p.life <= 0) {
          pts.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;

        const alpha = p.life * 0.7;
        const size = p.size * p.life;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
        ctx.fill();
      }

      // Connect trail points
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < Math.min(pts.length, 12); i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ─── Draw cursor ───
      const isHovering = isHoveringClickableRef.current;

      if (isHovering) {
        // Big glowing target ring on clickable
        const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(mx, my, 28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 136, ${0.5 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mx, my, 22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Corner brackets (sci-fi targeting reticle)
        const bracketSize = 12;
        const bracketDist = 20;
        ctx.strokeStyle = `rgba(0, 255, 136, ${0.8 * pulse})`;
        ctx.lineWidth = 2;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(mx - bracketDist, my - bracketDist + bracketSize);
        ctx.lineTo(mx - bracketDist, my - bracketDist);
        ctx.lineTo(mx - bracketDist + bracketSize, my - bracketDist);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(mx + bracketDist - bracketSize, my - bracketDist);
        ctx.lineTo(mx + bracketDist, my - bracketDist);
        ctx.lineTo(mx + bracketDist, my - bracketDist + bracketSize);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(mx - bracketDist, my + bracketDist - bracketSize);
        ctx.lineTo(mx - bracketDist, my + bracketDist);
        ctx.lineTo(mx - bracketDist + bracketSize, my + bracketDist);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(mx + bracketDist - bracketSize, my + bracketDist);
        ctx.lineTo(mx + bracketDist, my + bracketDist);
        ctx.lineTo(mx + bracketDist, my + bracketDist - bracketSize);
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
      } else {
        // Default cursor: glowing ring + dot
        // Outer soft glow
        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 22);
        gradient.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(mx - 22, my - 22, 44, 44);

        // Outer ring
        ctx.beginPath();
        ctx.arc(mx, my, 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Middle ring (subtle)
        ctx.beginPath();
        ctx.arc(mx, my, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner solid dot
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();

        // White center
        ctx.beginPath();
        ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // ─── Draw rockets ───
      for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
        const r = rocketsRef.current[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy -= 0.04; // slight gravity / upward acceleration
        r.vx *= 0.99;
        r.life -= 0.012;

        // Add trail
        r.trail.push({ x: r.x, y: r.y, life: 1 });
        if (r.trail.length > 25) r.trail.shift();
        r.trail.forEach(t => t.life -= 0.04);

        if (r.life <= 0) {
          rocketsRef.current.splice(i, 1);
          continue;
        }

        // Draw trail
        for (let j = r.trail.length - 1; j >= 0; j--) {
          const t = r.trail[j];
          if (t.life <= 0) continue;
          const alpha = t.life * 0.6;
          const size = (j / r.trail.length) * 3;
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.5})`;
          ctx.fill();
        }

        // Draw rocket body (small triangle pointing in direction of motion)
        const angle = Math.atan2(r.vy, r.vx);
        const size = 5.6;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(angle + Math.PI / 2);
        // Body
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.lineTo(size * 0.6, size * 0.5);
        ctx.closePath();
        ctx.fillStyle = `rgba(0, 229, 255, ${r.life})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 255, 136, ${r.life})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Flame at tail
        ctx.beginPath();
        ctx.moveTo(-size * 0.3, size * 0.5);
        ctx.lineTo(0, size + 3);
        ctx.lineTo(size * 0.3, size * 0.5);
        ctx.closePath();
        const flameGrad = ctx.createLinearGradient(0, size * 0.5, 0, size + 3);
        flameGrad.addColorStop(0, `rgba(0, 255, 136, ${r.life})`);
        flameGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
        ctx.fillStyle = flameGrad;
        ctx.fill();
        ctx.restore();
      }

      // ─── Draw click explosion particles ───
      for (let i = rocketParticlesRef.current.length - 1; i >= 0; i--) {
        const p = rocketParticlesRef.current[i];
        p.life -= 0.015;
        if (p.life <= 0) {
          rocketParticlesRef.current.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;

        const alpha = p.life;
        const size = p.size * p.life;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousemove', checkHover);
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
}
