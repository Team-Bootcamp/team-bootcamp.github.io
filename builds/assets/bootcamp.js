const THEME_KEY = 'bootcamp:theme';

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const themeLabel = document.getElementById('themeLabel');
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

function setupThemeToggle() {
  setTheme(getInitialTheme());
  const toggle = document.getElementById('themeToggle');
  toggle?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function setupParallax() {
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  const onMove = (event) => {
    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
    targetX = (clientX / window.innerWidth - 0.5) * 2;
    targetY = (clientY / window.innerHeight - 0.5) * 2;
  };

  window.addEventListener('mousemove', onMove, {passive: true});
  window.addEventListener('touchmove', onMove, {passive: true});

  const tick = () => {
    x += (targetX - x) * 0.06;
    y += (targetY - y) * 0.06;
    document.documentElement.style.setProperty('--px', x.toFixed(4));
    document.documentElement.style.setProperty('--py', y.toFixed(4));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupStarPad() {
  const canvas = document.getElementById('starCanvas');
  const clearBtn = document.getElementById('starsClear');
  const burstBtn = document.getElementById('starsBurst');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  const stars = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = Math.max(1, Math.floor(r.width * dpr));
    height = Math.max(1, Math.floor(r.height * dpr));
    canvas.width = width;
    canvas.height = height;
  };

  const addStar = (x, y, power = 1) => {
    const s = {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.9 * power,
      vy: (Math.random() - 0.5) * 0.9 * power,
      r: (1.4 + Math.random() * 2.8) * (0.7 + power * 0.6),
      life: 1,
      decay: 0.010 + Math.random() * 0.016,
      hue: 255 + Math.random() * 20,
    };
    stars.push(s);
  };

  const sprinkle = (clientX, clientY, power = 1) => {
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / Math.max(1, r.width);
    const x = (clientX - r.left) * dpr;
    const y = (clientY - r.top) * dpr;
    for (let i = 0; i < Math.floor(4 + power * 10); i++) addStar(x, y, power);
  };

  let dragging = false;
  const onDown = (e) => {
    dragging = true;
    sprinkle(e.clientX, e.clientY, 1);
  };
  const onMove = (e) => {
    if (!dragging) return;
    sprinkle(e.clientX, e.clientY, 0.6);
  };
  const onUp = () => {
    dragging = false;
  };

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, {passive: true});
  window.addEventListener('pointerup', onUp, {passive: true});

  clearBtn?.addEventListener('click', () => {
    stars.length = 0;
  });
  burstBtn?.addEventListener('click', () => {
    for (let i = 0; i < 9; i++) {
      const x = width * (0.25 + Math.random() * 0.5);
      const y = height * (0.25 + Math.random() * 0.5);
      for (let j = 0; j < 28; j++) addStar(x, y, 1.8);
    }
  });

  const draw = () => {
    const theme = document.documentElement.dataset.theme;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = theme === 'dark' ? 'rgba(224, 230, 255, 0.06)' : 'rgba(47, 48, 55, 0.06)';
    for (let i = 0; i < 34; i++) {
      const x = ((i * 173) % 997) / 997;
      const y = ((i * 379) % 997) / 997;
      ctx.fillRect(Math.floor(x * width), Math.floor(y * height), 1, 1);
    }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.985;
      s.vy *= 0.985;
      s.life -= s.decay;

      const alpha = Math.max(0, s.life);
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.2);
      grad.addColorStop(0, `rgba(255,255,255,${0.92 * alpha})`);
      grad.addColorStop(0.25, `rgba(119,108,254,${0.64 * alpha})`);
      grad.addColorStop(1, `rgba(74,58,200,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (s.life <= 0) stars.splice(i, 1);
    }

    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, {passive: true});
  requestAnimationFrame(draw);
}

function setupMicVisualizer() {
  const enableBtn = document.getElementById('micEnable');
  const disableBtn = document.getElementById('micDisable');
  const note = document.getElementById('micNote');
  const canvas = document.getElementById('vizCanvas');
  if (!enableBtn || !disableBtn || !note || !(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    note.textContent = 'Mic unavailable';
    enableBtn.disabled = true;
    return;
  }

  let audioContext = null;
  let analyser = null;
  let source = null;
  let stream = null;
  let raf = 0;

  const setState = (state) => {
    note.textContent = state;
  };

  const draw = () => {
    if (!analyser) return;
    const w = canvas.width;
    const h = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    ctx.clearRect(0, 0, w, h);

    const baseY = h - 28;
    const barCount = 72;
    const step = Math.floor(data.length / barCount);
    const gap = 5;
    const barWidth = Math.floor((w - gap * (barCount + 1)) / barCount);

    const theme = document.documentElement.dataset.theme;
    const line = theme === 'dark' ? 'rgba(224, 230, 255, 0.16)' : 'rgba(47, 48, 55, 0.10)';
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(14, baseY);
    ctx.lineTo(w - 14, baseY);
    ctx.stroke();

    for (let i = 0; i < barCount; i++) {
      const v = data[i * step] / 255;
      const amp = Math.pow(v, 1.35);
      const barH = Math.max(5, Math.floor(amp * (h - 54)));

      const x = gap + i * (barWidth + gap);
      const y = baseY - barH;

      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, 'rgba(119, 108, 254, 0.95)');
      grad.addColorStop(0.55, 'rgba(107, 96, 229, 0.88)');
      grad.addColorStop(1, 'rgba(74, 58, 200, 0.55)');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barH);
    }

    raf = requestAnimationFrame(draw);
  };

  const stop = async () => {
    cancelAnimationFrame(raf);
    raf = 0;
    try {
      stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    try {
      await audioContext?.close();
    } catch {}
    audioContext = null;
    analyser = null;
    source = null;
    stream = null;
    disableBtn.disabled = true;
    enableBtn.disabled = false;
    setState('Stopped');
  };

  const start = async () => {
    try {
      setState('Requesting mic permission…');
      enableBtn.disabled = true;

      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      disableBtn.disabled = false;
      setState('Listening');
      draw();
    } catch (e) {
      enableBtn.disabled = false;
      setState('Mic blocked or unavailable');
      console.warn(e);
    }
  };

  enableBtn.addEventListener('click', start);
  disableBtn.addEventListener('click', stop);
  window.addEventListener('pagehide', stop);
}

setupThemeToggle();
setupParallax();
setupStarPad();
setupMicVisualizer();

