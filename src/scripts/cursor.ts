/**
 * Cold Tech Cursor Trail — Vanilla JS, theme-aware
 * - Smooth cursor with hover state
 * - Rocket launch on clickable hover (nose separates, body falls, water splash)
 * - Wrapped in try-catch to never break the page
 */

interface TrailPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface RocketPart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  mass: number;   // affects drag deceleration: a_drag = k*v/m
  life: number;   // 1.0 → 0.0, for fade-out (nose only)
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: 'smoke' | 'spark';
}

interface WaterDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface ActiveRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  stage: 'launch' | 'separate' | 'fall' | 'splash';
  stageTime: number;
  launchTime: number;   // elapsed time in launch stage
  launchY: number;      // original Y position
  waterY: number;       // Y position of water surface (= launch Y)
  ceilingY: number;     // Y position of header bottom (rocket stops here)
  travelDist: number;   // total upward distance to travel
  trail: SmokePuff[];
  nose: RocketPart | null;
  body: RocketPart | null;
  splash: {
    x: number;
    radius: number;
    life: number;
    drops: WaterDrop[];
  } | null;
  smokeTick: number;
}

interface LaunchSequence {
  phase: 'walk' | 'countdown' | 'ignition' | 'launch' | 'separate' | 'fall' | 'splash';
  phaseTime: number;
  totalTime: number;
  startX: number;          // avatar center X (astronaut start)
  startY: number;          // avatar center Y (ground level)
  rocketX: number;         // rocket position X
  rocketY: number;         // rocket center Y (changes during launch)
  ceilingY: number;        // header bottom
  waterY: number;          // water surface = startY
  vy: number;
  vx: number;
  launchTime: number;
  nose: RocketPart | null;
  body: RocketPart | null;
  splash: { x: number; radius: number; life: number; drops: WaterDrop[] } | null;
  trail: SmokePuff[];
  smokeTick: number;
  scale: number;           // big rocket scale = 2.0
}

let initialized = false;

export function initCursorTrail() {
  if (typeof window === 'undefined') return;
  if (window.innerWidth < 1024) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (initialized) return;
  if (document.getElementById('__cold_tech_cursor_canvas__')) {
    initialized = true;
    return;
  }
  initialized = true;

  const canvas = document.createElement('canvas');
  canvas.id = '__cold_tech_cursor_canvas__';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  function resize() {
    canvas.width = W() * dpr;
    canvas.height = H() * dpr;
    canvas.style.width = W() + 'px';
    canvas.style.height = H() + 'px';
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Theme colors
  let accentRgb = '0, 145, 174';
  let neonRgb = '0, 168, 107';
  let whiteOrDark = '#ffffff';
  function refreshTheme() {
    try {
      const cs = getComputedStyle(document.documentElement);
      accentRgb = cs.getPropertyValue('--cursor-accent-rgb').trim() || accentRgb;
      neonRgb = cs.getPropertyValue('--cursor-neon-rgb').trim() || neonRgb;
      whiteOrDark = cs.getPropertyValue('--cursor-center').trim() || whiteOrDark;
    } catch (e) { /* ignore */ }
  }
  refreshTheme();
  const themeObserver = new MutationObserver(refreshTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // State
  const mouse = { x: -100, y: -100, tx: -100, ty: -100 };
  const points: TrailPoint[] = [];
  const rockets: ActiveRocket[] = [];
  const clickParticles: { x: number; y: number; vx: number; vy: number; life: number; size: number; hue: number }[] = [];
  let isHovering = false;
  let moveCounter = 0;
  let lastTime = performance.now();
  let raf = 0;
  let launchSeq: LaunchSequence | null = null;

  function onMouseMove(e: MouseEvent) {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;

    moveCounter++;
    if (moveCounter % 2 === 0) {
      points.push({
        x: e.clientX + (Math.random() - 0.5) * 6,
        y: e.clientY + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        life: 1,
      });
      if (points.length > 40) points.splice(0, points.length - 30);
    }

    try {
      const el = e.target as HTMLElement;
      if (!el) return;

      // Check for avatar launch trigger
      const avatarEl = el.closest('[data-avatar-launch]');
      if (avatarEl) {
        if (!launchSeq) {
          const rect = avatarEl.getBoundingClientRect();
          startLaunchSequence(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        isHovering = true;
        return;
      }

      // Skip rocket in header — only launch in page body
      const inHeader = !!el.closest('header');

      const clickable = !!el.closest('a, button, [role="button"], .card, .btn, .post-card, .tag');
      if (clickable !== isHovering) {
        isHovering = clickable;
        if (clickable && !launchSeq && !inHeader) launchRocket(e.clientX, e.clientY);
      }
    } catch (e) { /* ignore */ }
  }

  function getHeaderBottom(): number {
    try {
      const header = document.querySelector('header');
      if (header) {
        const rect = header.getBoundingClientRect();
        return rect.bottom;
      }
    } catch (e) { /* ignore */ }
    return 60; // fallback: 3.5rem header + 1px line
  }

  // Physics constants (shared across all stages)
  const G = 280;           // gravitational acceleration (px/s²)
  const THRUST_F = 770;    // constant thrust force (reduced 20%: was 850)
  const DRAG_K = 0.9;      // drag coefficient: F_drag = k * v

  function launchRocket(x: number, y: number) {
    const ceilingY = getHeaderBottom();
    const travelDist = Math.max(20, y - ceilingY);

    // Total rocket mass (fuel + body + nose)
    const M_total = 1.6;
    // Net upward acceleration: a = F/m - g
    const a_net = THRUST_F / M_total - G;  // = 531 - 280 = 251 px/s²

    // Compute launch duration so rocket reaches ceiling at apex:
    //   D = 0.5 * a * t²  →  t = sqrt(2D/a)
    // (We cut thrust at ceiling and separate there)
    const launchDuration = Math.sqrt((2 * travelDist) / a_net);

    rockets.push({
      x, y,
      vx: (Math.random() - 0.5) * 10,
      vy: 0,                    // starts at rest
      life: 1,
      stage: 'launch',
      stageTime: 0,
      launchTime: 0,
      launchY: y,
      waterY: y,
      ceilingY: ceilingY,
      travelDist: travelDist,
      trail: [],
      nose: null,
      body: null,
      splash: null,
      smokeTick: 0,
    });
    if (rockets.length > 3) rockets.shift();
  }

  function startLaunchSequence(avatarX: number, avatarY: number) {
    const ceilingY = getHeaderBottom();
    const rocketX = avatarX + 120;  // rocket stands 120px to the right of avatar
    launchSeq = {
      phase: 'walk',
      phaseTime: 0,
      totalTime: 0,
      startX: avatarX,
      startY: avatarY,
      rocketX: rocketX,
      rocketY: avatarY,
      ceilingY: ceilingY,
      waterY: avatarY,
      vy: 0,
      vx: 0,
      launchTime: 0,
      nose: null,
      body: null,
      splash: null,
      trail: [],
      smokeTick: 0,
      scale: 2.0,  // big rocket
    };
  }

  function onClick(e: MouseEvent) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      clickParticles.push({
        x: e.clientX, y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: Math.random() * 3 + 1,
        hue: Math.random() > 0.5 ? 190 : 145,
      });
    }
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', onClick);

  // Rocket update + draw
  function updateRocket(r: ActiveRocket, dt: number) {
    r.stageTime += dt;

    // Always update trail
    for (let j = r.trail.length - 1; j >= 0; j--) {
      const t = r.trail[j];
      t.life -= dt / t.maxLife;
      if (t.life <= 0) { r.trail.splice(j, 1); continue; }
      if (t.type === 'smoke') {
        t.y -= 6 * dt;
        t.x += (Math.random() - 0.5) * 4 * dt;
      } else {
        t.vy += 80 * dt;
        t.vx *= (1 - 2 * dt);
        t.x += t.vx * dt * 60;
        t.y += t.vy * dt * 60;
      }
    }
    if (r.trail.length > 35) r.trail.splice(0, r.trail.length - 35);

    // LAUNCH: constant acceleration a = F/m - g (Newton's 2nd law)
    if (r.stage === 'launch') {
      const M_total = 1.6;
      const a_net = THRUST_F / M_total - G;  // net upward acceleration (px/s²)

      // Apply constant acceleration (upward = -y in canvas)
      r.vy -= a_net * dt;
      // Horizontal: light drag only
      r.vx *= Math.exp(-0.4 * dt);
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Emit smoke (throttled, time-based)
      r.smokeTick += dt;
      if (r.smokeTick > 0.025) {
        r.smokeTick = 0;
        r.trail.push({
          x: r.x, y: r.y + 10,
          vx: 0, vy: 0,
          life: 1, maxLife: 0.35,
          size: 4 + Math.random() * 3,
          type: 'smoke',
        });
        if (Math.random() < 0.3) {
          r.trail.push({
            x: r.x + (Math.random() - 0.5) * 3,
            y: r.y + 13,
            vx: (Math.random() - 0.5) * 40,
            vy: 50 + Math.random() * 80,
            life: 1, maxLife: 0.25,
            size: 2 + Math.random(),
            type: 'spark',
          });
        }
      }

      r.launchTime += dt;

      // Separation: rocket reached ceiling (header bottom)
      if (r.y <= r.ceilingY || r.launchTime > 2.5) {
        r.y = Math.min(r.y, r.ceilingY);
        r.stage = 'separate';
        r.stageTime = 0;
        // Nose: light piece, carries upward momentum, no gravity (drifts + fades)
        r.nose = {
          x: r.x, y: r.y - 10,
          vx: r.vx * 0.7 + (Math.random() - 0.5) * 8,
          vy: r.vy * 0.5,           // inherits some upward velocity
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 0.6,
          mass: 0.3,                // light
          life: 1.0,                // fades out over time
        };
        // Body: heavy piece, falls with gravity
        r.body = {
          x: r.x, y: r.y + 8,
          vx: r.vx * 0.4,
          vy: 0,                    // starts at rest at apex
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 2.0,
          mass: 1.0,                // heavier
          life: 1.0,
        };
      }
    }

    // SEPARATE: brief transition (0.25s)
    else if (r.stage === 'separate') {
      // Burst of smoke at separation
      if (r.stageTime < 0.05) {
        for (let s = 0; s < 10; s++) {
          const ang = (s / 10) * Math.PI * 2;
          r.trail.push({
            x: r.x, y: r.y,
            vx: Math.cos(ang) * 30,
            vy: Math.sin(ang) * 30 + 20,
            life: 1, maxLife: 0.4,
            size: 3 + Math.random() * 2,
            type: 'smoke',
          });
        }
      }
      // Nose: NO gravity — drifts with drag only, fades
      if (r.nose) {
        // Drag deceleration: a_drag = k*v/m (light mass → more deceleration)
        const dragDecel = DRAG_K / r.nose.mass;
        r.nose.vx *= Math.exp(-dragDecel * dt);
        r.nose.vy *= Math.exp(-dragDecel * dt);
        r.nose.x += r.nose.vx * dt;
        r.nose.y += r.nose.vy * dt;
        r.nose.rotation += r.nose.rotSpeed * dt;
        r.nose.life -= dt / 2.0;  // fades over 2s
      }
      // Body: starts falling with gravity + drag
      if (r.body) {
        // a = g - (k*v)/m  (gravity down, drag opposes motion)
        const a_drag = (DRAG_K * r.body.vy) / r.body.mass;
        const a_net = G - a_drag;
        r.body.vy += a_net * dt;
        r.body.vx *= Math.exp(-(DRAG_K / r.body.mass) * dt);
        r.body.x += r.body.vx * dt;
        r.body.y += r.body.vy * dt;
        r.body.rotation += r.body.rotSpeed * dt;
        if (r.stageTime < 0.4) {
          r.trail.push({
            x: r.body.x + (Math.random() - 0.5) * 3,
            y: r.body.y + 4,
            vx: (Math.random() - 0.5) * 20,
            vy: 10,
            life: 1, maxLife: 0.3,
            size: 2 + Math.random(),
            type: 'smoke',
          });
        }
      }
      if (r.stageTime > 0.25) {
        r.stage = 'fall';
        r.stageTime = 0;
      }
    }

    // FALL: body falls with gravity + drag; nose drifts + fades (no gravity)
    else if (r.stage === 'fall') {
      // Nose: no gravity, just drag + fade
      if (r.nose) {
        const dragDecel = DRAG_K / r.nose.mass;
        r.nose.vx *= Math.exp(-dragDecel * dt);
        r.nose.vy *= Math.exp(-dragDecel * dt);
        r.nose.x += r.nose.vx * dt;
        r.nose.y += r.nose.vy * dt;
        r.nose.rotation += r.nose.rotSpeed * dt;
        r.nose.life -= dt / 2.0;
        if (r.nose.life <= 0) r.nose = null;
      }
      // Body: gravity + mass-based drag
      if (r.body) {
        // a = g - (k*v)/m
        const a_drag = (DRAG_K * r.body.vy) / r.body.mass;
        const a_net = G - a_drag;
        r.body.vy += a_net * dt;
        r.body.vx *= Math.exp(-(DRAG_K / r.body.mass) * dt);
        r.body.x += r.body.vx * dt;
        r.body.y += r.body.vy * dt;
        r.body.rotation += r.body.rotSpeed * dt;
        // Smoke trail while falling
        if (r.body.vy > 0 && Math.random() < 0.3) {
          r.trail.push({
            x: r.body.x + (Math.random() - 0.5) * 4,
            y: r.body.y + 5,
            vx: (Math.random() - 0.5) * 15,
            vy: 5,
            life: 1, maxLife: 0.4,
            size: 2 + Math.random() * 1.5,
            type: 'smoke',
          });
        }
        // Water impact (water surface is at the launch Y coordinate)
        const waterY = r.waterY;
        if (r.body.y >= waterY) {
          r.body.y = waterY;
          r.stage = 'splash';
          r.stageTime = 0;
          r.splash = { x: r.body.x, radius: 0, life: 1, drops: [] };
          for (let d = 0; d < 14; d++) {
            const ang = -Math.PI + (d / 13) * Math.PI;
            const speed = 60 + Math.random() * 120;
            r.splash.drops.push({
              x: r.body.x, y: waterY,
              vx: Math.cos(ang) * speed * 0.8,
              vy: Math.sin(ang) * speed,
              life: 1,
              maxLife: 0.6 + Math.random() * 0.4,
              size: 1.5 + Math.random() * 2,
            });
          }
        }
      } else {
        r.stage = 'splash';
        r.stageTime = 0;
      }
    }

    // SPLASH: water effects; nose still drifts + fades
    else if (r.stage === 'splash') {
      if (r.nose) {
        const dragDecel = DRAG_K / r.nose.mass;
        r.nose.vx *= Math.exp(-dragDecel * dt);
        r.nose.vy *= Math.exp(-dragDecel * dt);
        r.nose.x += r.nose.vx * dt;
        r.nose.y += r.nose.vy * dt;
        r.nose.rotation += r.nose.rotSpeed * dt;
        r.nose.life -= dt / 2.0;
        if (r.nose.life <= 0) r.nose = null;
      }
      if (r.splash) {
        r.splash.life -= dt / 1.2;
        r.splash.radius = 50 * (1 - r.splash.life);
        for (const drop of r.splash.drops) {
          drop.life -= dt / drop.maxLife;
          drop.vy += 500 * dt;
          drop.x += drop.vx * dt;
          drop.y += drop.vy * dt;
        }
        r.splash.drops = r.splash.drops.filter(d => d.life > 0);
        if (r.splash.life <= 0 && r.splash.drops.length === 0) r.splash = null;
      }
    }
  }

  function isRocketDone(r: ActiveRocket): boolean {
    // Done if in splash stage and splash is null and nose is gone (faded or off-screen)
    if (r.stage === 'splash') {
      return r.splash === null && (r.nose === null || r.nose.life <= 0 || r.nose.y > H() + 50);
    }
    return false;
  }

  // Rocket geometry constants (compact, rounded proportions)
  const BODY_W = 8;
  const BODY_H = 16;
  const NOSE_H = 10;
  const FIN_W = 4;
  const FIN_H = 5;
  const PORTHOLE_R = 1.8;
  const CORNER_R = 2.5;  // body corner radius for rounded look

  // Helper: draw a rounded rect path
  function roundedRect(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx!.beginPath();
    ctx!.moveTo(x + rr, y);
    ctx!.arcTo(x + w, y, x + w, y + h, rr);
    ctx!.arcTo(x + w, y + h, x, y + h, rr);
    ctx!.arcTo(x, y + h, x, y, rr);
    ctx!.arcTo(x, y, x + w, y, rr);
    ctx!.closePath();
  }

  // Helper: draw rocket body shape at current transform origin
  function drawBodyShape(withNose: boolean, scale: number) {
    const w = BODY_W * scale, h = BODY_H * scale, noseH = NOSE_H * scale;
    const finW = FIN_W * scale, finH = FIN_H * scale, portR = PORTHOLE_R * scale;
    const cornerR = CORNER_R * scale;

    // Body — rounded rect with gradient
    const bodyGrad = ctx!.createLinearGradient(-w / 2, 0, w / 2, 0);
    bodyGrad.addColorStop(0, `rgba(${accentRgb}, 0.75)`);
    bodyGrad.addColorStop(0.5, `rgba(${accentRgb}, 1)`);
    bodyGrad.addColorStop(1, `rgba(${accentRgb}, 0.75)`);
    ctx!.fillStyle = bodyGrad;
    ctx!.strokeStyle = `rgba(${neonRgb}, 1)`;
    ctx!.lineWidth = 1.2;
    roundedRect(-w / 2, -h / 2, w, h, cornerR);
    ctx!.fill();
    ctx!.stroke();

    // Body band
    ctx!.strokeStyle = `rgba(${neonRgb}, 0.8)`;
    ctx!.lineWidth = 0.8;
    ctx!.beginPath();
    ctx!.moveTo(-w / 2 + cornerR, -h * 0.15);
    ctx!.lineTo(w / 2 - cornerR, -h * 0.15);
    ctx!.stroke();

    // Porthole
    ctx!.fillStyle = `rgba(${neonRgb}, 1)`;
    ctx!.beginPath();
    ctx!.arc(0, -h * 0.3, portR, 0, Math.PI * 2);
    ctx!.fill();

    // Fins — rounded triangles (curved outer edge)
    ctx!.fillStyle = `rgba(${neonRgb}, 0.9)`;
    ctx!.strokeStyle = `rgba(${neonRgb}, 1)`;
    ctx!.lineWidth = 0.8;
    // Left fin
    ctx!.beginPath();
    ctx!.moveTo(-w / 2, h / 2 - finH);
    ctx!.quadraticCurveTo(-w / 2 - finW * 0.7, h / 2, -w / 2 - finW, h / 2 + 1);
    ctx!.lineTo(-w / 2, h / 2 + 1);
    ctx!.closePath();
    ctx!.fill();
    ctx!.stroke();
    // Right fin
    ctx!.beginPath();
    ctx!.moveTo(w / 2, h / 2 - finH);
    ctx!.quadraticCurveTo(w / 2 + finW * 0.7, h / 2, w / 2 + finW, h / 2 + 1);
    ctx!.lineTo(w / 2, h / 2 + 1);
    ctx!.closePath();
    ctx!.fill();
    ctx!.stroke();

    // Nose cone (optional) — rounded curve instead of sharp triangle
    if (withNose) {
      const noseGrad = ctx!.createLinearGradient(0, -h / 2 - noseH, 0, -h / 2);
      noseGrad.addColorStop(0, `rgba(${neonRgb}, 1)`);
      noseGrad.addColorStop(1, `rgba(${accentRgb}, 1)`);
      ctx!.fillStyle = noseGrad;
      ctx!.strokeStyle = `rgba(${neonRgb}, 1)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, -h / 2 - noseH);
      ctx!.quadraticCurveTo(-w / 2 * 0.6, -h / 2 - noseH * 0.3, -w / 2, -h / 2);
      ctx!.lineTo(w / 2, -h / 2);
      ctx!.quadraticCurveTo(w / 2 * 0.6, -h / 2 - noseH * 0.3, 0, -h / 2 - noseH);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();
    }
  }

  // Helper: draw flame at bottom of body
  function drawFlame(scale: number, intensity: number) {
    const h = BODY_H * scale;
    const w = BODY_W * scale;
    const flameLen = 12 + intensity * 20;
    // Outer flame
    const flameGrad = ctx!.createLinearGradient(0, h * 0.5, 0, h * 0.5 + flameLen);
    flameGrad.addColorStop(0, `rgba(${neonRgb}, 1)`);
    flameGrad.addColorStop(0.4, `rgba(${neonRgb}, 0.7)`);
    flameGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
    ctx!.fillStyle = flameGrad;
    ctx!.beginPath();
    ctx!.moveTo(-w * 0.45, h * 0.5);
    ctx!.lineTo(0, h * 0.5 + flameLen);
    ctx!.lineTo(w * 0.45, h * 0.5);
    ctx!.closePath();
    ctx!.fill();
    // Inner white-hot core
    const coreGrad = ctx!.createLinearGradient(0, h * 0.5, 0, h * 0.5 + flameLen * 0.6);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, 1)`);
    coreGrad.addColorStop(0.5, `rgba(${neonRgb}, 0.8)`);
    coreGrad.addColorStop(1, `rgba(${neonRgb}, 0)`);
    ctx!.fillStyle = coreGrad;
    ctx!.beginPath();
    ctx!.moveTo(-w * 0.18, h * 0.5);
    ctx!.lineTo(0, h * 0.5 + flameLen * 0.6);
    ctx!.lineTo(w * 0.18, h * 0.5);
    ctx!.closePath();
    ctx!.fill();
  }

  function drawRocket(r: ActiveRocket) {
    // Reset context state to prevent leaks from previous frame
    ctx!.globalAlpha = 1;

    // Draw trail (smoke + sparks)
    for (const t of r.trail) {
      const alpha = Math.min(1, Math.max(0, t.life / t.maxLife));
      if (t.type === 'smoke') {
        const size = t.size * (1 + (1 - alpha) * 1.5);
        ctx!.beginPath();
        ctx!.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${accentRgb}, ${alpha * 0.18})`;
        ctx!.fill();
      } else {
        ctx!.beginPath();
        ctx!.arc(t.x, t.y, t.size * alpha, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${neonRgb}, ${alpha * 0.7})`;
        ctx!.fill();
      }
    }

    // === Full rocket during LAUNCH ===
    if (r.stage === 'launch') {
      const speed = Math.hypot(r.vx, r.vy);
      const angle = Math.atan2(r.vx, -r.vy) * 0.3;
      const flameIntensity = Math.min(speed / 250, 1.2);
      ctx!.save();
      ctx!.translate(r.x, r.y);
      ctx!.rotate(angle);
      drawFlame(1, flameIntensity);
      drawBodyShape(true, 1);
      ctx!.restore();
    }

    // === Nose piece after separation (drifts + fades, no gravity) ===
    if (r.nose && r.stage !== 'launch') {
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, r.nose.life);
      ctx!.translate(r.nose.x, r.nose.y);
      ctx!.rotate(r.nose.rotation);
      drawBodyShape(true, 0.7);
      // Separation line at bottom
      ctx!.strokeStyle = `rgba(${accentRgb}, 0.4)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(-BODY_W * 0.35, BODY_H * 0.35);
      ctx!.lineTo(BODY_W * 0.35, BODY_H * 0.35);
      ctx!.stroke();
      ctx!.restore();
      ctx!.globalAlpha = 1;
    }

    // === Body piece during separate/fall/splash (no nose) ===
    if ((r.stage === 'separate' || r.stage === 'fall' || r.stage === 'splash') && r.body) {
      ctx!.save();
      ctx!.translate(r.body.x, r.body.y);
      ctx!.rotate(r.body.rotation);
      drawBodyShape(false, 1);
      // Separation line at top
      ctx!.strokeStyle = `rgba(${accentRgb}, 0.4)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(-BODY_W / 2, -BODY_H / 2);
      ctx!.lineTo(BODY_W / 2, -BODY_H / 2);
      ctx!.stroke();
      // Small smoke puff at bottom
      const puffGrad = ctx!.createRadialGradient(0, BODY_H * 0.5, 0, 0, BODY_H * 0.5, 4);
      puffGrad.addColorStop(0, `rgba(${accentRgb}, 0.5)`);
      puffGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
      ctx!.fillStyle = puffGrad;
      ctx!.beginPath();
      ctx!.arc(0, BODY_H * 0.5, 4, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
    }

    // Draw splash
    if (r.splash && r.stage === 'splash') {
      const waterY = r.waterY;
      // Water surface line
      ctx!.beginPath();
      ctx!.moveTo(0, waterY);
      ctx!.lineTo(W(), waterY);
      ctx!.strokeStyle = `rgba(${accentRgb}, 0.06)`;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      // Expanding ring
      ctx!.beginPath();
      ctx!.arc(r.splash.x, waterY, r.splash.radius, Math.PI, 0, false);
      ctx!.strokeStyle = `rgba(${accentRgb}, ${r.splash.life * 0.6})`;
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // Glow
      const glowGrad = ctx!.createRadialGradient(r.splash.x, waterY, 0, r.splash.x, waterY, r.splash.radius * 0.6);
      glowGrad.addColorStop(0, `rgba(${accentRgb}, ${r.splash.life * 0.3})`);
      glowGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
      ctx!.fillStyle = glowGrad;
      ctx!.beginPath();
      ctx!.arc(r.splash.x, waterY, r.splash.radius * 0.6, 0, Math.PI * 2);
      ctx!.fill();

      // Drops
      for (const drop of r.splash.drops) {
        const alpha = Math.max(0, drop.life);
        ctx!.beginPath();
        ctx!.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${accentRgb}, ${alpha * 0.8})`;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(drop.x - drop.size * 0.3, drop.y - drop.size * 0.3, drop.size * 0.3, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx!.fill();
      }
    }
  }

  function drawCursor(mx: number, my: number) {
    if (isHovering) {
      const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
      ctx!.beginPath();
      ctx!.arc(mx, my, 28, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${neonRgb}, ${0.5 * pulse})`;
      ctx!.lineWidth = 2;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(mx, my, 22, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${accentRgb}, ${0.3 * pulse})`;
      ctx!.lineWidth = 1;
      ctx!.stroke();
      const bs = 12, bd = 20;
      ctx!.strokeStyle = `rgba(${neonRgb}, ${0.8 * pulse})`;
      ctx!.lineWidth = 2;
      ctx!.beginPath(); ctx!.moveTo(mx - bd, my - bd + bs); ctx!.lineTo(mx - bd, my - bd); ctx!.lineTo(mx - bd + bs, my - bd); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(mx + bd - bs, my - bd); ctx!.lineTo(mx + bd, my - bd); ctx!.lineTo(mx + bd, my - bd + bs); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(mx - bd, my + bd - bs); ctx!.lineTo(mx - bd, my + bd); ctx!.lineTo(mx - bd + bs, my + bd); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(mx + bd - bs, my + bd); ctx!.lineTo(mx + bd, my + bd); ctx!.lineTo(mx + bd, my + bd - bs); ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(mx, my, 2, 0, Math.PI * 2);
      ctx!.fillStyle = `rgb(${neonRgb})`;
      ctx!.fill();
    } else {
      const grad = ctx!.createRadialGradient(mx, my, 0, mx, my, 22);
      grad.addColorStop(0, `rgba(${accentRgb}, 0.25)`);
      grad.addColorStop(1, `rgba(${accentRgb}, 0)`);
      ctx!.fillStyle = grad;
      ctx!.fillRect(mx - 22, my - 22, 44, 44);
      ctx!.beginPath();
      ctx!.arc(mx, my, 16, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${accentRgb}, 0.5)`;
      ctx!.lineWidth = 1.5;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(mx, my, 10, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${accentRgb}, 0.25)`;
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(mx, my, 4, 0, Math.PI * 2);
      ctx!.fillStyle = `rgb(${accentRgb})`;
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx!.fillStyle = whiteOrDark;
      ctx!.fill();
    }
  }

  // ═══════════════════════════════════════════════════
  // Launch Sequence — avatar trigger, astronaut walk, countdown, big rocket
  // ═══════════════════════════════════════════════════

  function drawAstronaut(x: number, y: number, walkPhase: number, alpha: number) {
    ctx!.globalAlpha = alpha;
    const headR = 3.5;
    const bodyLen = 7;
    const legLen = 5;
    const armLen = 4;
    const swing = Math.sin(walkPhase * Math.PI * 2);
    const bob = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 1.5;

    ctx!.strokeStyle = `rgba(${neonRgb}, 1)`;
    ctx!.fillStyle = `rgba(${accentRgb}, 0.8)`;
    ctx!.lineWidth = 1.2;
    ctx!.lineCap = 'round';

    // Helmet
    ctx!.beginPath();
    ctx!.arc(x, y - bodyLen - headR - bob, headR, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.stroke();
    // Visor
    ctx!.fillStyle = `rgba(${neonRgb}, 0.9)`;
    ctx!.beginPath();
    ctx!.arc(x + 1, y - bodyLen - headR - bob, headR * 0.5, -0.5, 1.5);
    ctx!.fill();

    // Body
    ctx!.strokeStyle = `rgba(${neonRgb}, 1)`;
    ctx!.beginPath();
    ctx!.moveTo(x, y - bodyLen - headR * 2 - bob);
    ctx!.lineTo(x, y - legLen - bob);
    ctx!.stroke();

    // Arms (swing opposite to legs)
    ctx!.beginPath();
    ctx!.moveTo(x, y - bodyLen - headR - bob * 0.5);
    ctx!.lineTo(x - swing * armLen * 0.8, y - bodyLen - headR + armLen * 0.5 - bob * 0.5);
    ctx!.stroke();
    ctx!.beginPath();
    ctx!.moveTo(x, y - bodyLen - headR - bob * 0.5);
    ctx!.lineTo(x + swing * armLen * 0.8, y - bodyLen - headR + armLen * 0.5 - bob * 0.5);
    ctx!.stroke();

    // Legs (alternate stride)
    ctx!.beginPath();
    ctx!.moveTo(x, y - legLen - bob);
    ctx!.lineTo(x + swing * legLen * 0.7, y);
    ctx!.stroke();
    ctx!.beginPath();
    ctx!.moveTo(x, y - legLen - bob);
    ctx!.lineTo(x - swing * legLen * 0.7, y);
    ctx!.stroke();

    ctx!.globalAlpha = 1;
  }

  function drawCountdownText(x: number, y: number, text: string, alpha: number) {
    ctx!.globalAlpha = alpha;
    ctx!.font = 'bold 36px "JetBrains Mono", "Courier New", monospace';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillStyle = `rgba(${neonRgb}, 1)`;
    ctx!.shadowColor = `rgba(${neonRgb}, 0.8)`;
    ctx!.shadowBlur = 15;
    ctx!.fillText(text, x, y);
    ctx!.shadowBlur = 0;
    ctx!.shadowColor = 'transparent';
    ctx!.globalAlpha = 1;
  }

  function updateLaunchSequence(seq: LaunchSequence, dt: number) {
    seq.phaseTime += dt;
    seq.totalTime += dt;

    // Update trail (shared across all phases)
    for (let i = seq.trail.length - 1; i >= 0; i--) {
      const t = seq.trail[i];
      t.life -= dt / t.maxLife;
      if (t.life <= 0) { seq.trail.splice(i, 1); continue; }
      if (t.type === 'smoke') {
        t.y -= 6 * dt;
        t.x += (Math.random() - 0.5) * 4 * dt;
      } else {
        t.vy += 80 * dt;
        t.vx *= 1 - 2 * dt;
        t.x += t.vx * dt * 60;
        t.y += t.vy * dt * 60;
      }
    }
    if (seq.trail.length > 50) seq.trail.splice(0, seq.trail.length - 50);

    // Phase transitions
    if (seq.phase === 'walk') {
      // Astronaut walks for 2s, then enters rocket
      if (seq.phaseTime >= 2.0) {
        seq.phase = 'countdown';
        seq.phaseTime = 0;
      }
    }
    else if (seq.phase === 'countdown') {
      // 3-second countdown: 3 → 2 → 1
      if (seq.phaseTime >= 3.0) {
        seq.phase = 'ignition';
        seq.phaseTime = 0;
      }
    }
    else if (seq.phase === 'ignition') {
      // 0.5s ignition build-up
      // Emit smoke at rocket base
      seq.smokeTick += dt;
      if (seq.smokeTick > 0.03) {
        seq.smokeTick = 0;
        const bottomY = seq.rocketY + BODY_H * seq.scale * 0.5;
        seq.trail.push({
          x: seq.rocketX + (Math.random() - 0.5) * 6,
          y: bottomY,
          vx: (Math.random() - 0.5) * 20,
          vy: 10 + Math.random() * 20,
          life: 1, maxLife: 0.5,
          size: 5 + Math.random() * 4,
          type: 'smoke',
        });
      }
      if (seq.phaseTime >= 0.5) {
        seq.phase = 'launch';
        seq.phaseTime = 0;
        seq.launchTime = 0;
      }
    }
    else if (seq.phase === 'launch') {
      // Big rocket physics: a = F*scale / (m*scale) - g = same a as normal
      const a_net = THRUST_F / 1.6 - G;
      seq.vy -= a_net * dt;
      seq.vx *= Math.exp(-0.4 * dt);
      seq.rocketX += seq.vx * dt;
      seq.rocketY += seq.vy * dt;

      // Emit smoke
      seq.smokeTick += dt;
      if (seq.smokeTick > 0.025) {
        seq.smokeTick = 0;
        const bottomY = seq.rocketY + BODY_H * seq.scale * 0.5;
        seq.trail.push({
          x: seq.rocketX, y: bottomY,
          vx: 0, vy: 0,
          life: 1, maxLife: 0.35,
          size: 5 + Math.random() * 4,
          type: 'smoke',
        });
        if (Math.random() < 0.3) {
          seq.trail.push({
            x: seq.rocketX + (Math.random() - 0.5) * 4,
            y: bottomY + 5,
            vx: (Math.random() - 0.5) * 50,
            vy: 60 + Math.random() * 100,
            life: 1, maxLife: 0.25,
            size: 2.5 + Math.random(),
            type: 'spark',
          });
        }
      }

      seq.launchTime += dt;
      if (seq.rocketY <= seq.ceilingY || seq.launchTime > 3.0) {
        seq.rocketY = Math.min(seq.rocketY, seq.ceilingY);
        seq.phase = 'separate';
        seq.phaseTime = 0;
        seq.nose = {
          x: seq.rocketX, y: seq.rocketY - 12,
          vx: seq.vx * 0.7 + (Math.random() - 0.5) * 8,
          vy: seq.vy * 0.5,
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 0.6,
          mass: 0.5,
          life: 1.0,
        };
        seq.body = {
          x: seq.rocketX, y: seq.rocketY + 10,
          vx: seq.vx * 0.4,
          vy: 0,
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 2,
          mass: 2.0,
          life: 1.0,
        };
      }
    }
    else if (seq.phase === 'separate') {
      // Burst of smoke at separation
      if (seq.phaseTime < 0.05) {
        for (let s = 0; s < 12; s++) {
          const ang = (s / 12) * Math.PI * 2;
          seq.trail.push({
            x: seq.rocketX, y: seq.rocketY,
            vx: Math.cos(ang) * 40,
            vy: Math.sin(ang) * 40 + 20,
            life: 1, maxLife: 0.5,
            size: 4 + Math.random() * 3,
            type: 'smoke',
          });
        }
      }
      // Nose: drifts with drag, no gravity
      if (seq.nose) {
        const dragDecel = DRAG_K / seq.nose.mass;
        seq.nose.vx *= Math.exp(-dragDecel * dt);
        seq.nose.vy *= Math.exp(-dragDecel * dt);
        seq.nose.x += seq.nose.vx * dt;
        seq.nose.y += seq.nose.vy * dt;
        seq.nose.rotation += seq.nose.rotSpeed * dt;
        seq.nose.life -= dt / 2.0;
      }
      // Body: starts falling
      if (seq.body) {
        const a_drag = (DRAG_K * seq.body.vy) / seq.body.mass;
        const a_net = G - a_drag;
        seq.body.vy += a_net * dt;
        seq.body.vx *= Math.exp(-(DRAG_K / seq.body.mass) * dt);
        seq.body.x += seq.body.vx * dt;
        seq.body.y += seq.body.vy * dt;
        seq.body.rotation += seq.body.rotSpeed * dt;
      }
      if (seq.phaseTime > 0.25) {
        seq.phase = 'fall';
        seq.phaseTime = 0;
      }
    }
    else if (seq.phase === 'fall') {
      // Nose: drift + fade
      if (seq.nose) {
        const dragDecel = DRAG_K / seq.nose.mass;
        seq.nose.vx *= Math.exp(-dragDecel * dt);
        seq.nose.vy *= Math.exp(-dragDecel * dt);
        seq.nose.x += seq.nose.vx * dt;
        seq.nose.y += seq.nose.vy * dt;
        seq.nose.rotation += seq.nose.rotSpeed * dt;
        seq.nose.life -= dt / 2.0;
        if (seq.nose.life <= 0) seq.nose = null;
      }
      // Body: gravity + drag
      if (seq.body) {
        const a_drag = (DRAG_K * seq.body.vy) / seq.body.mass;
        const a_net = G - a_drag;
        seq.body.vy += a_net * dt;
        seq.body.vx *= Math.exp(-(DRAG_K / seq.body.mass) * dt);
        seq.body.x += seq.body.vx * dt;
        seq.body.y += seq.body.vy * dt;
        seq.body.rotation += seq.body.rotSpeed * dt;
        // Smoke trail while falling
        if (seq.body.vy > 0 && Math.random() < 0.3) {
          seq.trail.push({
            x: seq.body.x + (Math.random() - 0.5) * 6,
            y: seq.body.y + 8,
            vx: (Math.random() - 0.5) * 20,
            vy: 5,
            life: 1, maxLife: 0.4,
            size: 3 + Math.random() * 2,
            type: 'smoke',
          });
        }
        // Water impact
        if (seq.body.y >= seq.waterY) {
          seq.body.y = seq.waterY;
          seq.phase = 'splash';
          seq.phaseTime = 0;
          seq.splash = { x: seq.body.x, radius: 0, life: 1, drops: [] };
          for (let d = 0; d < 20; d++) {
            const ang = -Math.PI + (d / 19) * Math.PI;
            const speed = 80 + Math.random() * 160;
            seq.splash.drops.push({
              x: seq.body.x, y: seq.waterY,
              vx: Math.cos(ang) * speed * 0.8,
              vy: Math.sin(ang) * speed,
              life: 1,
              maxLife: 0.6 + Math.random() * 0.4,
              size: 2 + Math.random() * 2.5,
            });
          }
        }
      } else {
        seq.phase = 'splash';
        seq.phaseTime = 0;
      }
    }
    else if (seq.phase === 'splash') {
      // Nose continues drifting
      if (seq.nose) {
        const dragDecel = DRAG_K / seq.nose.mass;
        seq.nose.vx *= Math.exp(-dragDecel * dt);
        seq.nose.vy *= Math.exp(-dragDecel * dt);
        seq.nose.x += seq.nose.vx * dt;
        seq.nose.y += seq.nose.vy * dt;
        seq.nose.rotation += seq.nose.rotSpeed * dt;
        seq.nose.life -= dt / 2.0;
        if (seq.nose.life <= 0) seq.nose = null;
      }
      // Splash effects
      if (seq.splash) {
        seq.splash.life -= dt / 1.2;
        seq.splash.radius = 70 * (1 - seq.splash.life);
        for (const drop of seq.splash.drops) {
          drop.life -= dt / drop.maxLife;
          drop.vy += 500 * dt;
          drop.x += drop.vx * dt;
          drop.y += drop.vy * dt;
        }
        seq.splash.drops = seq.splash.drops.filter(d => d.life > 0);
        if (seq.splash.life <= 0 && seq.splash.drops.length === 0) seq.splash = null;
      }
    }
  }

  function drawLaunchSequence(seq: LaunchSequence) {
    ctx!.globalAlpha = 1;

    // Draw trail
    for (const t of seq.trail) {
      const alpha = Math.min(1, Math.max(0, t.life / t.maxLife));
      if (t.type === 'smoke') {
        const size = t.size * (1 + (1 - alpha) * 1.5);
        ctx!.beginPath();
        ctx!.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${accentRgb}, ${alpha * 0.18})`;
        ctx!.fill();
      } else {
        ctx!.beginPath();
        ctx!.arc(t.x, t.y, t.size * alpha, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${neonRgb}, ${alpha * 0.7})`;
        ctx!.fill();
      }
    }

    const s = seq.scale;

    // === WALK phase: astronaut walks, rocket stands ===
    if (seq.phase === 'walk') {
      // Draw rocket standing upright at rocketX
      const shake = 0;
      ctx!.save();
      ctx!.translate(seq.rocketX, seq.rocketY);
      ctx!.rotate(shake);
      drawBodyShape(true, s);
      ctx!.restore();

      // Draw astronaut walking from startX to rocketX - 15
      const progress = Math.min(seq.phaseTime / 2.0, 1.0);
      const easeProgress = 1 - Math.pow(1 - progress, 2);  // ease-out
      const walkEndX = seq.rocketX - BODY_W * s * 0.5 - 10;
      const astronautX = seq.startX + (walkEndX - seq.startX) * easeProgress;
      const astronautY = seq.startY + 2;
      // Fade out in last 0.3s as astronaut enters rocket
      const fadeAlpha = progress > 0.85 ? Math.max(0, 1 - (progress - 0.85) / 0.15) : 1;
      drawAstronaut(astronautX, astronautY, seq.totalTime * 3, fadeAlpha);
    }

    // === COUNTDOWN phase: rocket stands, countdown text ===
    else if (seq.phase === 'countdown') {
      // Slight shake building up
      const shakeIntensity = (seq.phaseTime / 3.0) * 1.5;
      const shake = (Math.random() - 0.5) * shakeIntensity;
      ctx!.save();
      ctx!.translate(seq.rocketX + shake, seq.rocketY);
      drawBodyShape(true, s);
      ctx!.restore();

      // Countdown text: 3 → 2 → 1
      const cdNum = 3 - Math.floor(seq.phaseTime);
      const cdSubPhase = seq.phaseTime % 1.0;  // 0-1 within each second
      // Fade in first 0.2s, hold, fade out last 0.3s
      let cdAlpha = 1;
      if (cdSubPhase < 0.2) cdAlpha = cdSubPhase / 0.2;
      else if (cdSubPhase > 0.7) cdAlpha = (1 - cdSubPhase) / 0.3;
      const cdText = String(cdNum);
      const cdY = seq.rocketY - BODY_H * s * 0.5 - NOSE_H * s - 30;
      drawCountdownText(seq.rocketX, cdY, cdText, Math.min(1, Math.max(0, cdAlpha)));
    }

    // === IGNITION phase: flame builds, rocket shakes ===
    else if (seq.phase === 'ignition') {
      const shake = (Math.random() - 0.5) * 3;
      ctx!.save();
      ctx!.translate(seq.rocketX + shake, seq.rocketY);
      // Growing flame
      const flameIntensity = seq.phaseTime / 0.5;  // 0 → 1
      drawFlame(s, flameIntensity);
      drawBodyShape(true, s);
      ctx!.restore();

      // "点火!" text
      const igniteAlpha = seq.phaseTime < 0.3 ? 1 : Math.max(0, 1 - (seq.phaseTime - 0.3) / 0.2);
      const cdY = seq.rocketY - BODY_H * s * 0.5 - NOSE_H * s - 30;
      drawCountdownText(seq.rocketX, cdY, '点火!', igniteAlpha);
    }

    // === LAUNCH phase: rocket flies up ===
    else if (seq.phase === 'launch') {
      const speed = Math.hypot(seq.vx, seq.vy);
      const angle = Math.atan2(seq.vx, -seq.vy) * 0.3;
      const flameIntensity = Math.min(speed / 250, 1.5);
      ctx!.save();
      ctx!.translate(seq.rocketX, seq.rocketY);
      ctx!.rotate(angle);
      drawFlame(s, flameIntensity);
      drawBodyShape(true, s);
      ctx!.restore();
    }

    // === SEPARATE / FALL / SPLASH: nose drifts, body falls ===
    else {
      // Draw nose piece
      if (seq.nose) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, seq.nose.life);
        ctx!.translate(seq.nose.x, seq.nose.y);
        ctx!.rotate(seq.nose.rotation);
        drawBodyShape(true, s * 0.7);
        // Separation line
        ctx!.strokeStyle = `rgba(${accentRgb}, 0.4)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(-BODY_W * s * 0.35, BODY_H * s * 0.35);
        ctx!.lineTo(BODY_W * s * 0.35, BODY_H * s * 0.35);
        ctx!.stroke();
        ctx!.restore();
        ctx!.globalAlpha = 1;
      }

      // Draw body piece
      if (seq.body && (seq.phase === 'separate' || seq.phase === 'fall' || seq.phase === 'splash')) {
        ctx!.save();
        ctx!.translate(seq.body.x, seq.body.y);
        ctx!.rotate(seq.body.rotation);
        drawBodyShape(false, s);
        // Separation line at top
        ctx!.strokeStyle = `rgba(${accentRgb}, 0.4)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(-BODY_W * s / 2, -BODY_H * s / 2);
        ctx!.lineTo(BODY_W * s / 2, -BODY_H * s / 2);
        ctx!.stroke();
        // Smoke puff at bottom
        const puffGrad = ctx!.createRadialGradient(0, BODY_H * s * 0.5, 0, 0, BODY_H * s * 0.5, 5);
        puffGrad.addColorStop(0, `rgba(${accentRgb}, 0.5)`);
        puffGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
        ctx!.fillStyle = puffGrad;
        ctx!.beginPath();
        ctx!.arc(0, BODY_H * s * 0.5, 5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // Draw splash
      if (seq.splash && seq.phase === 'splash') {
        const waterY = seq.waterY;
        ctx!.beginPath();
        ctx!.moveTo(0, waterY);
        ctx!.lineTo(W(), waterY);
        ctx!.strokeStyle = `rgba(${accentRgb}, 0.06)`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(seq.splash.x, waterY, seq.splash.radius, Math.PI, 0, false);
        ctx!.strokeStyle = `rgba(${accentRgb}, ${seq.splash.life * 0.6})`;
        ctx!.lineWidth = 2;
        ctx!.stroke();

        const glowGrad = ctx!.createRadialGradient(seq.splash.x, waterY, 0, seq.splash.x, waterY, seq.splash.radius * 0.6);
        glowGrad.addColorStop(0, `rgba(${accentRgb}, ${seq.splash.life * 0.3})`);
        glowGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
        ctx!.fillStyle = glowGrad;
        ctx!.beginPath();
        ctx!.arc(seq.splash.x, waterY, seq.splash.radius * 0.6, 0, Math.PI * 2);
        ctx!.fill();

        for (const drop of seq.splash.drops) {
          const alpha = Math.min(1, Math.max(0, drop.life));
          ctx!.beginPath();
          ctx!.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${accentRgb}, ${alpha * 0.8})`;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(drop.x - drop.size * 0.3, drop.y - drop.size * 0.3, drop.size * 0.3, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
          ctx!.fill();
        }
      }
    }
  }

  function isLaunchSeqDone(seq: LaunchSequence): boolean {
    if (seq.phase === 'splash') {
      return seq.splash === null && (seq.nose === null || seq.nose.life <= 0);
    }
    return false;
  }

  function animate(now: number) {
    try {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx!.clearRect(0, 0, W(), H());

      // Smooth cursor follow
      mouse.x += (mouse.tx - mouse.x) * 0.5;
      mouse.y += (mouse.ty - mouse.y) * 0.5;
      const mx = mouse.x, my = mouse.y;

      // Trail points
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        p.life -= 0.025;
        if (p.life <= 0) { points.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, Math.max(0.5, 1.5 * p.life), 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${accentRgb}, ${p.life * 0.7})`;
        ctx!.fill();
      }
      if (points.length > 1) {
        ctx!.beginPath();
        ctx!.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < Math.min(points.length, 12); i++) ctx!.lineTo(points[i].x, points[i].y);
        ctx!.strokeStyle = `rgba(${accentRgb}, 0.12)`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        try {
          updateRocket(r, dt);
        } catch (e) {
          rockets.splice(i, 1);
          continue;
        }
        try {
          drawRocket(r);
        } catch (e) {
          // If drawing fails, skip but keep rocket
        }

        if (isRocketDone(r)) {
          rockets.splice(i, 1);
        }
      }

      // Launch sequence (exclusive — blocks normal rockets)
      if (launchSeq) {
        try {
          updateLaunchSequence(launchSeq, dt);
        } catch (e) {
          launchSeq = null;
        }
        try {
          drawLaunchSequence(launchSeq);
        } catch (e) {
          // If drawing fails, skip but keep sequence
        }
        if (launchSeq && isLaunchSeqDone(launchSeq)) {
          launchSeq = null;
        }
      }

      // Click particles
      for (let i = clickParticles.length - 1; i >= 0; i--) {
        const p = clickParticles[i];
        p.life -= 0.015;
        if (p.life <= 0) { clickParticles.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.life})`;
        ctx!.fill();
      }

      // Cursor (drawn LAST so always on top)
      drawCursor(mx, my);
    } catch (e) {
      // If anything fails, just continue
    }

    raf = requestAnimationFrame(animate);
  }

  raf = requestAnimationFrame(animate);

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(raf);
    themeObserver.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('click', onClick);
    canvas.remove();
  });
}

initCursorTrail();
