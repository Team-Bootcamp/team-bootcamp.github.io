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

function titleize(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

function getRepoInfo() {
  const host = window.location.hostname;
  const owner = host.split('.')[0] || '';
  const repo = owner ? `${owner}.github.io` : '';
  return {owner, repo, branch: 'main'};
}

function setupRailWheelScroll() {
  const rail = document.getElementById('appRail');
  if (!rail) return;
  rail.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      rail.scrollLeft += e.deltaY;
    },
    {passive: true},
  );
}

function createAppCard({name, href}) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = href;
  a.setAttribute('role', 'listitem');

  const top = document.createElement('div');
  top.className = 'card__top';
  const title = document.createElement('div');
  title.className = 'card__title';
  title.textContent = name;
  const badge = document.createElement('span');
  badge.className = 'badge badge--ok';
  badge.textContent = 'Open';
  top.append(title, badge);

  const body = document.createElement('div');
  body.className = 'card__body';
  body.textContent = 'Open build';

  const foot = document.createElement('div');
  foot.className = 'card__footer';
  const hint = document.createElement('span');
  hint.className = 'card__hint';
  hint.textContent = href.replace('./', '');
  const arrow = document.createElement('span');
  arrow.className = 'card__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  foot.append(hint, arrow);

  a.append(top, body, foot);
  return a;
}

async function checkHref(href) {
  try {
    const res = await fetch(`${href}index.html`, {method: 'HEAD', cache: 'no-store'});
    return res.ok;
  } catch {
    try {
      const res = await fetch(`${href}index.html`, {cache: 'no-store'});
      return res.ok;
    } catch {
      return false;
    }
  }
}

async function loadApps() {
  const rail = document.getElementById('appRail');
  const loading = document.getElementById('appsLoading');
  if (!rail) return;

  try {
    const {owner, repo, branch} = getRepoInfo();
    if (!owner || !repo) throw new Error('Could not derive repo info from hostname.');

    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/builds?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(api, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

    const items = await res.json();
    const dirs = Array.isArray(items) ? items.filter((i) => i?.type === 'dir') : [];
    const slugs = dirs
      .map((d) => (typeof d?.name === 'string' ? d.name : ''))
      .filter((n) => n && n !== 'assets' && !n.startsWith('.'))
      .sort((a, b) => a.localeCompare(b));

    loading?.remove();
    if (slugs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card card--coming';
      empty.setAttribute('role', 'listitem');
      empty.innerHTML =
        '<div class="card__top"><div class="card__title">No builds found</div><span class="badge badge--dim">Empty</span></div>' +
        '<div class="card__body">Add a folder under <code>builds/</code> (with an <code>index.html</code>) and commit it.</div>' +
        '<div class="card__footer"><span class="card__hint">Example: <code>builds/algolia-search/index.html</code></span></div>';
      rail.appendChild(empty);
      return;
    }

    const cards = slugs.map((slug) => {
      const href = `./${slug}/`;
      const card = createAppCard({name: titleize(slug), href});
      return {slug, href, card};
    });

    for (const c of cards) rail.appendChild(c.card);

    await Promise.all(
      cards.map(async ({href, card}) => {
        const badge = card.querySelector('.badge');
        if (!badge) return;
        const ok = await checkHref(href);
        badge.textContent = ok ? 'Open' : 'Missing';
        badge.classList.toggle('badge--ok', ok);
        badge.classList.toggle('badge--warn', !ok);
      }),
    );
  } catch (e) {
    if (loading) {
      const badge = loading.querySelector('.badge');
      if (badge) {
        badge.textContent = 'Error';
        badge.classList.add('badge--warn');
      }
      const body = loading.querySelector('.card__body');
      if (body) body.textContent = 'Could not list builds/ from GitHub.';
    }
    console.warn(e);
  }
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

    const baseY = h - 36;
    const barCount = 64;
    const step = Math.floor(data.length / barCount);
    const gap = 6;
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
      const barH = Math.max(6, Math.floor(amp * (h - 78)));

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
setupRailWheelScroll();
loadApps();
setupMicVisualizer();
