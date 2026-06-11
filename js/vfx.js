/* ============================================================
   vfx.js — Full-site 3D effects layer (public pages only)
   Full-page particle field, 3D section reveal, card tilt,
   scroll parallax. Zero dependencies. Degrades gracefully.
   ============================================================ */
'use strict';

(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover       = window.matchMedia('(hover: none)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('vfx-on');
    if (!reducedMotion) initParticleField();
    if (!reducedMotion) initParallax();
    if (!reducedMotion && !noHover) initTilt();
    initReveal();
  });

  /* ============================================================
     FULL-PAGE 3D PARTICLE FIELD — behind all content
     ============================================================ */
  function initParticleField() {
    const canvas = document.getElementById('vfx-canvas');
    if (!canvas) return;

    const ctx    = canvas.getContext('2d');
    const FOV    = 420;
    const DEPTH  = 700;
    const mobile = window.innerWidth <= 768;
    const COUNT  = mobile ? 55 : 130;
    const LINK   = mobile ? 110 : 150;

    let W = 0, H = 0, CX = 0, CY = 0;
    let running = true;
    let mouseX = 0, mouseY = 0;       // -1..1 parallax target
    let rotX = 0, rotY = 0;           // smoothed rotation
    let scrollRot = 0;                // extra rotation from scrolling

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      CX = W / 2; CY = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particles in 3D space centred on viewport
    const parts = [];
    for (let i = 0; i < COUNT; i++) {
      parts.push({
        x: (Math.random() - 0.5) * W * 1.5,
        y: (Math.random() - 0.5) * H * 1.5,
        z: Math.random() * DEPTH - DEPTH / 2,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        vz: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8,
      });
    }

    if (!noHover) {
      window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / W - 0.5) * 2;
        mouseY = (e.clientY / H - 0.5) * 2;
      });
    }

    // Scrolling slowly rotates the whole 3D field — depth feeling
    window.addEventListener('scroll', () => {
      scrollRot = window.scrollY * 0.00035;
    }, { passive: true });

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });

    const proj = new Array(COUNT);

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      // Smooth parallax rotation toward mouse + scroll
      rotY += (mouseX * 0.18 + scrollRot - rotY) * 0.05;
      rotX += (mouseY * 0.12 + scrollRot * 0.6 - rotX) * 0.05;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Move + project
      for (let i = 0; i < COUNT; i++) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.z += p.vz;

        // Wrap inside bounds
        const BX = W * 0.8, BY = H * 0.8, BZ = DEPTH / 2;
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
            const alpha = (1 - d / LINK) * 0.26 * Math.min(a.s, b.s);
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
        const alpha = 0.22 + p.s * 0.45;
        ctx.fillStyle = 'rgba(37, 99, 235, ' + Math.min(alpha, 0.75).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(p.r, 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     SCROLL PARALLAX — blobs drift at different speeds
     ============================================================ */
  function initParallax() {
    const blob1 = document.querySelector('.vfx-blob-1');
    const blob2 = document.querySelector('.vfx-blob-2');
    if (!blob1 && !blob2) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (blob1) blob1.style.setProperty('--scroll-shift', (y * 0.12).toFixed(1) + 'px');
        if (blob2) blob2.style.setProperty('--scroll-shift', (y * -0.08).toFixed(1) + 'px');
        ticking = false;
      });
    }, { passive: true });
  }

  /* ============================================================
     3D TILT — cards follow the cursor
     ============================================================ */
  function initTilt() {
    const MAX = 10; // degrees
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
          ' rotateY(' + (px * MAX).toFixed(2) + 'deg) translateY(-5px) scale(1.02)';
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
     3D SCROLL REVEAL — sections rotate up from depth
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
      el.style.transitionDelay = (Math.min(i % 6, 4) * 70) + 'ms';
      io.observe(el);
    });
  }
})();
