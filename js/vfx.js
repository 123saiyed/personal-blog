/* ============================================================
   vfx.js — 3D visual effects layer (public pages only)
   Particle hero, 3D card tilt, scroll reveal.
   Zero dependencies. Degrades gracefully.
   ============================================================ */
'use strict';

(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover       = window.matchMedia('(hover: none)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('vfx-on');
    if (!reducedMotion) initParticleHero();
    if (!reducedMotion && !noHover) initTilt();
    initReveal();
  });

  /* ============================================================
     3D PARTICLE NETWORK — hero background
     ============================================================ */
  function initParticleHero() {
    const canvas = document.getElementById('hero-canvas');
    const hero   = document.querySelector('.hero');
    if (!canvas || !hero) return;

    const ctx    = canvas.getContext('2d');
    const FOV    = 420;
    const DEPTH  = 600;
    const mobile = window.innerWidth <= 768;
    const COUNT  = mobile ? 40 : 90;
    const LINK   = mobile ? 110 : 150;

    let W = 0, H = 0, CX = 0, CY = 0;
    let running = true;
    let mouseX = 0, mouseY = 0;       // -1..1 parallax target
    let rotX = 0, rotY = 0;           // smoothed rotation

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.offsetWidth;
      H = hero.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      CX = W / 2; CY = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particles in 3D space centred on hero
    const parts = [];
    for (let i = 0; i < COUNT; i++) {
      parts.push({
        x: (Math.random() - 0.5) * W * 1.4,
        y: (Math.random() - 0.5) * H * 1.4,
        z: Math.random() * DEPTH - DEPTH / 2,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        vz: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8,
      });
    }

    if (!noHover) {
      hero.addEventListener('mousemove', e => {
        const rect = hero.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
        mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
      });
      hero.addEventListener('mouseleave', () => { mouseX = 0; mouseY = 0; });
    }

    // Pause when hero is off-screen
    new IntersectionObserver(entries => {
      running = entries[0].isIntersecting;
      if (running) requestAnimationFrame(frame);
    }, { threshold: 0 }).observe(hero);

    const proj = new Array(COUNT);

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      // Smooth parallax rotation toward mouse
      rotY += (mouseX * 0.18 - rotY) * 0.05;
      rotX += (mouseY * 0.12 - rotX) * 0.05;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Move + project
      for (let i = 0; i < COUNT; i++) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.z += p.vz;

        // Wrap inside bounds
        const BX = W * 0.7, BY = H * 0.7, BZ = DEPTH / 2;
        if (p.x >  BX) p.x = -BX; if (p.x < -BX) p.x = BX;
        if (p.y >  BY) p.y = -BY; if (p.y < -BY) p.y = BY;
        if (p.z >  BZ) p.z = -BZ; if (p.z < -BZ) p.z = BZ;

        // Rotate around Y then X (parallax)
        let x = p.x * cosY - p.z * sinY;
        let z = p.x * sinY + p.z * cosY;
        let y = p.y * cosX - z * sinX;
        z     = p.y * sinX + z * cosX;

        const s = FOV / (FOV + z + DEPTH / 2);
        proj[i] = { sx: CX + x * s, sy: CY + y * s, s, r: p.r * s };
      }

      // Links
      for (let i = 0; i < COUNT; i++) {
        const a = proj[i];
        for (let j = i + 1; j < COUNT; j++) {
          const b = proj[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            const alpha = (1 - d / LINK) * 0.28 * Math.min(a.s, b.s);
            ctx.strokeStyle = 'rgba(37, 99, 235, ' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Dots
      for (let i = 0; i < COUNT; i++) {
        const p = proj[i];
        const alpha = 0.25 + p.s * 0.5;
        ctx.fillStyle = 'rgba(37, 99, 235, ' + Math.min(alpha, 0.8).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(p.r, 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     3D TILT — cards follow the cursor
     ============================================================ */
  function initTilt() {
    const MAX = 8; // degrees
    const SELECTOR = '.about-card, .cert-card, .contact-card, .stat-card';

    function bindTilt(card) {
      if (card._tiltBound) return;
      card._tiltBound = true;
      card.classList.add('tilt-card');

      card.addEventListener('mousemove', e => {
        const r  = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width  - 0.5;
        const py = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform =
          'perspective(800px) rotateX(' + (-py * MAX).toFixed(2) + 'deg)' +
          ' rotateY(' + (px * MAX).toFixed(2) + 'deg) translateY(-4px) scale(1.015)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
      });
    }

    document.querySelectorAll(SELECTOR).forEach(bindTilt);

    // Certificates are injected by Firebase after load — catch them too
    const grids = document.querySelectorAll('#certs-grid, #home-certs');
    if (grids.length && 'MutationObserver' in window) {
      const mo = new MutationObserver(() => {
        document.querySelectorAll(SELECTOR).forEach(bindTilt);
      });
      grids.forEach(g => mo.observe(g, { childList: true }));
    }
  }

  /* ============================================================
     SCROLL REVEAL — fade-up sections
     ============================================================ */
  function initReveal() {
    const targets = document.querySelectorAll(
      '.section .container > *, .page-header .container > *'
    );
    if (!targets.length) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    targets.forEach((el, i) => {
      el.classList.add('reveal-item');
      el.style.transitionDelay = (Math.min(i % 6, 4) * 60) + 'ms';
      io.observe(el);
    });

    // New elements added later by Firebase (skills, certs) appear instantly
    // — reveal only applies to elements present now.
  }
})();
