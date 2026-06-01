/* ============================================================
   app.js — Public pages (Realtime Database version)
   ============================================================ */
'use strict';

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
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

  const hasPdfData = !!cert.pdfData;
  const hasPdfUrl  = !!cert.pdfURL;
  const hasImage   = !!cert.imageURL;

  const imgHtml = hasImage
    ? `<img src="${safe(cert.imageURL)}" alt="${safe(cert.title) || 'Certificate'}" loading="lazy"
           onerror="this.style.background='#F3F4F6';this.removeAttribute('src')" />`
    : `<div class="cert-pdf-placeholder"><span>&#128196;</span><p>PDF Certificate</p></div>`;

  // PDF button: direct upload takes priority over Drive link
  let pdfBtn = '';
  if (hasPdfData) {
    pdfBtn = `<button class="cert-pdf-btn open-pdf-btn" onclick="event.stopPropagation()">Open PDF &#8599;</button>`;
  } else if (hasPdfUrl) {
    pdfBtn = `<a href="${safe(ensureUrl(cert.pdfURL))}" target="_blank" rel="noopener" class="cert-pdf-btn" onclick="event.stopPropagation()">View PDF &#8599;</a>`;
  }

  card.innerHTML = `
    ${imgHtml}
    <div class="cert-card-body">
      <h3>${safe(cert.title) || 'Certificate'}</h3>
      <p>${safe(cert.description)}</p>
      ${cert.date ? `<span class="badge">${safe(formatMonth(cert.date))}</span>` : ''}
      ${pdfBtn}
    </div>`;

  if (hasPdfData) {
    card.querySelector('.open-pdf-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openPdfBlob(cert.pdfData);
    });
  }

  if (hasImage) {
    card.addEventListener('click', () => openLightbox(cert));
  } else if (hasPdfData) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openPdfBlob(cert.pdfData));
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
  $('#lightbox-img').src           = cert.imageURL || '';
  $('#lightbox-title').textContent = cert.title || '';
  $('#lightbox-desc').textContent  = cert.description || '';
  $('#lightbox-date').textContent  = cert.date ? formatMonth(cert.date) : '';
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
        snap.forEach(child => items.push({ id: child.key, ...child.val() }));
        items.reverse().forEach(c => {
          if (c.imageURL) {
            const img = document.createElement('img');
            img.className = 'cert-thumb';
            img.src = c.imageURL;
            img.alt = c.title || 'Certificate';
            img.loading = 'lazy';
            img.addEventListener('click', () => openLightbox(c));
            certsEl.appendChild(img);
          } else if (c.pdfData) {
            const box = document.createElement('div');
            box.className = 'cert-thumb cert-thumb-pdf';
            box.title = c.title || 'Certificate';
            box.innerHTML = '<span>&#128196;</span>';
            box.addEventListener('click', () => openPdfBlob(c.pdfData));
            certsEl.appendChild(box);
          } else if (c.pdfURL) {
            const box = document.createElement('div');
            box.className = 'cert-thumb cert-thumb-pdf';
            box.title = c.title || 'Certificate';
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
      if (!snap.exists()) { $('#certs-empty')?.classList.remove('hidden'); return; }
      const items = [];
      snap.forEach(child => items.push({ id: child.key, ...child.val() }));
      items.reverse().forEach(c => container.appendChild(createCertCard(c)));
    })
    .catch(() => { container.innerHTML = '<p style="color:var(--text-muted);padding:32px 0">Could not load certificates.</p>'; });
}
