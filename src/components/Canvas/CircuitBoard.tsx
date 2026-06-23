import { useEffect, useRef } from 'react';

interface CircuitNode {
  x: number;
  y: number;
  connections: number[];
  pulsePhase: number;
  pulseSpeed: number;
}

export default function CircuitBoard() {
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

    // Generate circuit nodes in a grid-like pattern
    const nodes: CircuitNode[] = [];
    const gridW = 60;
    const gridH = 60;
    const cols = Math.floor(w() / gridW);
    const rows = Math.floor(h() / gridH);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.3) continue; // Sparse placement
        const x = c * gridW + (Math.random() - 0.5) * 20 + gridW / 2;
        const y = r * gridH + (Math.random() - 0.5) * 20 + gridH / 2;
        nodes.push({
          x,
          y,
          connections: [],
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
        });
      }
    }

    // Connect nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && Math.random() > 0.5) {
          nodes[i].connections.push(j);
        }
      }
    }

    // Pulse data packets
    const packets: { from: number; to: number; progress: number; speed: number }[] = [];
    const spawnPacket = () => {
      if (nodes.length < 2) return;
      const from = Math.floor(Math.random() * nodes.length);
      if (nodes[from].connections.length === 0) return;
      const to = nodes[from].connections[Math.floor(Math.random() * nodes[from].connections.length)];
      packets.push({ from, to, progress: 0, speed: Math.random() * 0.008 + 0.003 });
    };

    let lastSpawn = 0;

    const animate = (time: number) => {
      ctx.clearRect(0, 0, w(), h());

      // Spawn packets periodically
      if (time - lastSpawn > 800) {
        spawnPacket();
        lastSpawn = time;
      }

      // Draw connections
      for (const node of nodes) {
        for (const ci of node.connections) {
          const target = nodes[ci];
          // Right-angle path (PCB style)
          const midX = (node.x + target.x) / 2;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(midX, node.y);
          ctx.lineTo(midX, target.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw nodes
      const t = time * 0.001;
      for (const node of nodes) {
        const pulse = Math.sin(t * 2 + node.pulsePhase) * 0.3 + 0.5;

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${0.15 * pulse})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${0.5 * pulse + 0.2})`;
        ctx.fill();
      }

      // Draw packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const pkt = packets[i];
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          packets.splice(i, 1);
          continue;
        }

        const from = nodes[pkt.from];
        const to = nodes[pkt.to];
        const midX = (from.x + to.x) / 2;

        // Interpolate along right-angle path
        let px: number, py: number;
        const p = pkt.progress;
        if (p < 0.33) {
          const lp = p / 0.33;
          px = from.x + (midX - from.x) * lp;
          py = from.y;
        } else if (p < 0.66) {
          const lp = (p - 0.33) / 0.33;
          px = midX;
          py = from.y + (to.y - from.y) * lp;
        } else {
          const lp = (p - 0.66) / 0.34;
          px = midX + (to.x - midX) * lp;
          py = to.y;
        }

        // Packet glow
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
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
        pointerEvents: 'none',
      }}
    />
  );
}
