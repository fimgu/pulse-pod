// Pulse Pod promo: rendered product photography + one scroll-scrubbed explode sequence. No WebGL.
const $ = (s) => document.querySelector(s);

// nav state
const nav = $('.nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

// reveal on scroll
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
document.querySelectorAll('.copy, .card, .timeline li, .cta > *, .stat, .vs-card, .qa details, .shot, .block > h2, .block > .sub, .block > .eyebrow')
  .forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) return; el.classList.add('reveal'); io.observe(el); });

// app mockup: fill the recovery ring when it scrolls into view
const appIo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); appIo.unobserve(e.target); } }), { threshold: 0.3 });
document.querySelectorAll('.app').forEach((el) => appIo.observe(el));

// hero parallax (subtle)
const heroImg = $('.hero-img img');
addEventListener('scroll', () => { const y = Math.min(scrollY, innerHeight); heroImg.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(${1 + y / innerHeight * 0.06})`; }, { passive: true });

// scroll-scrubbed explode: eased target, smoothed playhead, crossfade between neighbouring frames
const N = 48;
const cv = $('#explode'), ctx = cv.getContext('2d');
const frames = Array.from({ length: N }, (_, i) => { const im = new Image(); im.decoding = 'async'; im.src = `img/seq/e${String(i).padStart(2, '0')}.jpg`; return im; });
const scrub = $('.scrub'), layers = document.querySelectorAll('#layers li');
const ok = (im) => im.complete && im.naturalWidth > 0;
let target = N - 1, head = N - 1, drawn = -1, raf = 0;
function paint(f) {
  const i = Math.floor(f), j = Math.min(N - 1, i + 1), w = f - i;
  const a = frames[i], b = frames[j];
  if (!ok(a)) return false;
  if (cv.width !== a.naturalWidth) { cv.width = a.naturalWidth; cv.height = a.naturalHeight; }
  ctx.globalAlpha = 1; ctx.drawImage(a, 0, 0);
  if (w > 0.001 && ok(b)) { ctx.globalAlpha = w; ctx.drawImage(b, 0, 0); ctx.globalAlpha = 1; }
  drawn = f; return true;
}
function loop() {
  head += (target - head) * 0.18;
  if (Math.abs(target - head) < 0.002) head = target;
  if (Math.abs(head - drawn) > 0.001) paint(head);
  raf = head !== target ? requestAnimationFrame(loop) : 0;
}
function onScrub() {
  const r = scrub.getBoundingClientRect();
  const t = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  // reversed: starts exploded (parts on show), holds while the list lights up, then assembles into the disc
  const u = Math.min(1, Math.max(0, (t - 0.38) / 0.55));
  const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;   // ease in-out
  target = (1 - e) * (N - 1);
  if (!raf) raf = requestAnimationFrame(loop);
  layers.forEach((li, k) => li.classList.toggle('on', t > 0.04 + k * 0.065));
}
frames[N - 1].onload = () => { if (drawn < 0) onScrub(); };
frames.forEach((im) => im.addEventListener('load', () => { drawn = -1; onScrub(); }));
addEventListener('scroll', onScrub, { passive: true }); addEventListener('resize', onScrub);

// live pulse trace
const path = $('#ecgPath'), bpmEl = $('#bpm');
let ph = 0, last = performance.now();
const ppg = (x) => { const b = ((x % 1) + 1) % 1; return Math.exp(-((b - 0.12) ** 2) / 0.002) + 0.35 * Math.exp(-((b - 0.34) ** 2) / 0.006) - 0.08 * Math.sin(b * Math.PI * 2); };
(function tick(now) {
  ph += (now - last) / 1000 * 1.13; last = now;
  let d = '';
  for (let i = 0; i <= 120; i++) { const x = i / 120; d += (i ? 'L' : 'M') + (x * 400).toFixed(1) + ' ' + (48 - ppg(ph - (1 - x) * 3) * 36).toFixed(1); }
  path.setAttribute('d', d);
  if (Math.floor(ph) !== Math.floor(ph - 0.02)) bpmEl.textContent = String(66 + Math.round(3 * Math.sin(ph * 0.21)));
  requestAnimationFrame(tick);
})(last);

// signup -> Google Form (responses land in the form's linked Google Sheet).
// Fill these two from the form's pre-filled link: .../d/e/<FORM_ID>/viewform?usp=pp_url&entry.<ENTRY>=x
const GFORM_ID = '1FAIpQLSfXWw_ZyfyZxPKL6ft2wE6PD2vzVEh6TJHZS9rDLTCEPTG7uw';
const GFORM_ENTRY = '1166445954';
$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#email').value.trim(); if (!v) return;
  if (GFORM_ID && GFORM_ENTRY) {
    const body = new URLSearchParams({ [`entry.${GFORM_ENTRY}`]: v });
    // no-cors: Google doesn't send CORS headers, so the response is opaque, but the row is recorded
    fetch(`https://docs.google.com/forms/d/e/${GFORM_ID}/formResponse`, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  }
  try { const l = JSON.parse(localStorage.getItem('pp_join') || '[]'); l.push({ v, t: Date.now() }); localStorage.setItem('pp_join', JSON.stringify(l)); } catch {}
  $('#joinMsg').textContent = "Thanks. You're on the list."; $('#email').value = '';
});
