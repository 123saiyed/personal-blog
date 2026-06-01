/* ============================================================
   app.js — Public pages (Realtime Database version)
   ============================================================ */
'use strict';

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatMonth(str) {
  if (!str) return '';
  const [y, m] = str.split('-');
  return new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function getDB() { return firebase.database(); }

function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function ensureUrl(url) {
  if (!url) return '#';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
}

function openPdfBlob(base64data) {
  try {
    const b64 = base64data.includes(',') ? base64data.split(',')[1] : base64data;
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (e) {
    alert('Could not open PDF. Please try again.');
  }
}

/* ---------- cert card ---------- */
function createCertCard(cert) {
  const card = document.createElement('div');
  card.className = 'cert-card';

  const hasImage  = !!cert.imageURL;
  const hasPdf    = !!cert.hasPdf;
  const hasPdfUrl = !!cert.pdfURL && !hasPdf;

  // Media — never put base64 in innerHTML
  if (hasImage) {
    const img = document.createElement('img');
    img.alt     = cert.title || 'Certificate';
    img.loading = 'lazy';
    img.onerror = function () { this.style.background = '#F3F4F6'; this.removeAttribute('src'); };
    img.src     = cert.imageURL;
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'cert-pdf-placeholder';
    ph.innerHTML = '<span>&#128196;</span><p>PDF Certificate</p>';
    card.appendChild(ph);
  }

  // Body: title only
  const body = document.createElement('div');
  body.className = 'cert-card-body';
  const h3 = document.createElement('h3');
  h3.textContent = cert.title || 'Certificate';
  body.appendChild(h3);

  // PDF button — lazy-loads from Firebase only when clicked
  if (hasPdf) {
    const btn = document.createElement('button');
    btn.className   = 'cert-pdf-btn';
    btn.textContent = 'Open PDF ↗';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.textContent = 'Loading…';
      btn.disabled    = true;
      getDB().ref('certificate_pdfs/' + cert.id).once('value')
        .then(snap => {
          if (snap.val()) return openPdfBlob(snap.val());
          // Fallback: old inline format still in cert node
          return getDB().ref('certificates/' + cert.id + '/pdfData').once('value')
            .then(s2 => { if (s2.val()) openPdfBlob(s2.val()); else alert('PDF not found.'); });
        })
        .catch(() => alert('Could not load PDF.'))
        .finally(() => { btn.textContent = 'Open PDF ↗'; btn.disabled = false; });
    });
    body.appendChild(btn);
  } else if (hasPdfUrl) {
    const a = document.createElement('a');
    a.className   = 'cert-pdf-btn';
    a.href        = ensureUrl(cert.pdfURL);
    a.target      = '_blank';
    a.rel         = 'noopener';
    a.textContent = 'View PDF ↗';
    a.addEventListener('click', e => e.stopPropagation());
    body.appendChild(a);
  }

  card.appendChild(body);

  // Card click handler
  if (hasImage) {
    card.addEventListener('click', () => openLightbox(cert));
  } else if (hasPdf) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => body.querySelector('.cert-pdf-btn')?.click());
  } else if (hasPdfUrl) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => window.open(ensureUrl(cert.pdfURL), '_blank'));
  }

  return card;
}

/* ---------- lightbox ---------- */
function openLightbox(cert) {
  const lb = $('#lightbox');
  if (!lb) return;
  const imgEl = $('#lightbox-img');
  if (imgEl) imgEl.src = cert.imageURL || '';
  const titleEl = $('#lightbox-title');
  if (titleEl) titleEl.textContent = cert.title || '';
  lb.classList.remove('hidden');
  $('#lightbox-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  $('#lightbox')?.classList.add('hidden');
  $('#lightbox-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---------- wait for Firebase ---------- */
function waitForFirebase(cb, tries = 0) {
  if (typeof firebase !== 'undefined' && firebase.apps?.length) cb();
  else if (tries < 30) setTimeout(() => waitForFirebase(cb, tries + 1), 200);
  else console.warn('Firebase not ready.');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#lightbox-close')?.addEventListener('click', closeLightbox);
  $('#lightbox-overlay')?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  const navToggle = $('.nav-toggle');
  const navLinks  = $('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
  }

  const path = location.pathname.split('/').pop();
  if (!path || path === 'index.html')    waitForFirebase(initHome);
  else if (path === 'certificates.html') waitForFirebase(initCerts);
});

/* ============================================================
   HOME
   ============================================================ */
function initHome() {
  const db = getDB();

  db.ref('profile').once('value').then(snap => {
    const p = snap.val() || {};

    // Profile photo
    if (p.photoURL) {
      const img      = $('#avatar-img');
      const initials = $('#avatar-initials');
      if (img) {
        img.src = p.photoURL;
        img.style.display = 'block';
        img.onerror = () => { img.style.display = 'none'; if (initials) initials.style.display = 'block'; };
        if (initials) initials.style.display = 'none';
      }
    }

    // Badge
    const badgeEl = $('#hero-badge');
    if (badgeEl && p.badge) badgeEl.textContent = p.badge;

    // Job title
    const titleEl = $('#hero-title');
    if (titleEl && p.jobTitle) titleEl.textContent = p.jobTitle;

    // Bio
    const bioEl = $('#hero-bio');
    if (bioEl && p.bio) bioEl.textContent = p.bio;

    // Resume button
    const resumeBtn = $('#resume-btn');
    if (resumeBtn && p.resumeURL) {
      resumeBtn.href = ensureUrl(p.resumeURL);
      resumeBtn.style.display = 'inline-flex';
    }

    // Skills
    if (p.skills) {
      const tags = p.skills.split(',').map(s => s.trim()).filter(Boolean);
      const wrap = $('#skills-wrap');
      if (wrap && tags.length) {
        wrap.innerHTML = tags.map(s => `<span class="skill-tag">${safe(s)}</span>`).join('');
        $('#skills-section')?.classList.remove('hidden');
      }
    }

    // Contact
    const emailLink = $('#contact-email-link');
    const emailVal  = $('#contact-email-val');
    const linkedIn  = $('#contact-linkedin-link');
    let hasContact  = false;

    if (p.email && emailLink) {
      emailLink.href = 'mailto:' + p.email;
      if (emailVal) emailVal.textContent = p.email;
      emailLink.style.display = 'flex';
      hasContact = true;
    }
    if (p.linkedin && linkedIn) {
      linkedIn.href = ensureUrl(p.linkedin);
      linkedIn.style.display = 'flex';
      hasContact = true;
    }
    if (hasContact) $('#contact-section')?.classList.remove('hidden');

    // About cards
    setAboutCard('#about-card-1', p.about1Icon, p.about1Title, p.about1Text);
    setAboutCard('#about-card-2', p.about2Icon, p.about2Title, p.about2Text);
    setAboutCard('#about-card-3', p.about3Icon, p.about3Title, p.about3Text);

  }).catch(() => {});

  // Certificates teaser
  const certsEl = $('#home-certs');
  if (certsEl) {
    db.ref('certificates').limitToLast(4).once('value')
      .then(snap => {
        certsEl.innerHTML = '';
        if (!snap.exists()) { certsEl.style.display = 'none'; return; }
        const items = [];
        snap.forEach(child => {
          const v = child.val() || {};
          items.push({
            id:       child.key,
            title:    v.title    || '',
            imageURL: v.imageURL || '',
            pdfURL:   v.pdfURL   || '',
            hasPdf:   !!(v.hasPdf || v.pdfData || v.pdfURL),
          });
        });
        items.reverse().forEach(c => {
          if (c.imageURL) {
            const img = document.createElement('img');
            img.className = 'cert-thumb';
            img.src       = c.imageURL;
            img.alt       = c.title || 'Certificate';
            img.loading   = 'lazy';
            img.addEventListener('click', () => openLightbox(c));
            certsEl.appendChild(img);
          } else if (c.hasPdf) {
            const box = document.createElement('div');
            box.className = 'cert-thumb cert-thumb-pdf';
            box.title     = c.title || 'Certificate';
            box.innerHTML = '<span>&#128196;</span>';
            box.addEventListener('click', () => {
              getDB().ref('certificate_pdfs/' + c.id).once('value')
                .then(snap => {
                  if (snap.val()) return openPdfBlob(snap.val());
                  return getDB().ref('certificates/' + c.id + '/pdfData').once('value')
                    .then(s2 => { if (s2.val()) openPdfBlob(s2.val()); });
                }).catch(() => {});
            });
            certsEl.appendChild(box);
          } else if (c.pdfURL) {
            const box = document.createElement('div');
            box.className = 'cert-thumb cert-thumb-pdf';
            box.title     = c.title || 'Certificate';
            box.innerHTML = '<span>&#128196;</span>';
            box.addEventListener('click', () => window.open(ensureUrl(c.pdfURL), '_blank'));
            certsEl.appendChild(box);
          }
        });
      })
      .catch(() => { if (certsEl) certsEl.innerHTML = ''; });
  }
}

function setAboutCard(selector, icon, title, text) {
  const card = $(selector);
  if (!card) return;
  if (icon)  { const el = card.querySelector('.about-icon'); if (el) el.textContent = icon; }
  if (title) { const el = card.querySelector('h3');          if (el) el.textContent = title; }
  if (text)  { const el = card.querySelector('p');           if (el) el.textContent = text; }
}

/* ============================================================
   CERTIFICATES
   ============================================================ */
function initCerts() {
  const container = $('#certs-grid');
  if (!container) return;

  getDB().ref('certificates').once('value')
    .then(snap => {
      container.innerHTML = '';
      if (!snap.exists() || snap.numChildren() === 0) {
        $('#certs-empty')?.classList.remove('hidden');
        return;
      }
      const items = [];
      snap.forEach(child => {
        const v = child.val() || {};
        // Only keep display fields — pdfData is fetched on-demand, not loaded here
        items.push({
          id:       child.key,
          title:    v.title    || '',
          imageURL: v.imageURL || '',
          pdfURL:   v.pdfURL   || '',
          hasPdf:   !!(v.hasPdf || v.pdfData || v.pdfURL),
        });
      });
      items.reverse().forEach(c => {
        try {
          container.appendChild(createCertCard(c));
        } catch (err) {
          console.error('Cert render error:', c.id, err);
        }
      });
      if (container.children.length === 0) {
        $('#certs-empty')?.classList.remove('hidden');
      }
    })
    .catch(err => {
      console.error('Certs load error:', err);
      container.innerHTML = '<p style="color:var(--text-muted);padding:40px 0;text-align:center">Could not load certificates. Please refresh the page.</p>';
    });
}
