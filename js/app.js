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

// Sanitize any text before injecting into HTML — prevents XSS
function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ---------- card builders ---------- */
function createPostCard(post, id) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.id       = id;
  card.dataset.category = post.category || 'update';
  card.dataset.title    = (post.title || '').toLowerCase();
  const imgHTML = post.imageURL
    ? `<div class="post-card-img"><img src="${safe(post.imageURL)}" alt="${safe(post.title)}" loading="lazy" onerror="this.parentElement.style.display='none'" /></div>`
    : '';
  card.innerHTML = `
    ${imgHTML}
    <span class="post-category">${safe(post.category) || 'Update'}</span>
    <h3 class="post-title">${safe(post.title) || 'Untitled'}</h3>
    <p class="post-excerpt">${safe(post.excerpt)}</p>
    <div class="post-meta">
      <span class="post-date">${formatDate(post.dateTimestamp)}</span>
      <span class="post-read-more">Read more &rarr;</span>
    </div>`;
  card.addEventListener('click', () => {
    location.href = 'post.html?id=' + encodeURIComponent(id);
  });
  return card;
}

function createCertCard(cert, id) {
  const card = document.createElement('div');
  card.className = 'cert-card';
  card.innerHTML = `
    <img src="${safe(cert.imageURL)}" alt="${safe(cert.title) || 'Certificate'}" loading="lazy"
         onerror="this.style.background='#F3F4F6';this.removeAttribute('src')" />
    <div class="cert-card-body">
      <h3>${safe(cert.title) || 'Certificate'}</h3>
      <p>${safe(cert.description)}</p>
      ${cert.date ? `<span class="badge">${safe(formatMonth(cert.date))}</span>` : ''}
    </div>`;
  card.addEventListener('click', () => openLightbox(cert));
  return card;
}

/* ---------- lightbox ---------- */
function openLightbox(cert) {
  const lb = $('#lightbox');
  if (!lb) return;
  $('#lightbox-img').src              = cert.imageURL || '';
  $('#lightbox-title').textContent    = cert.title || '';
  $('#lightbox-desc').textContent     = cert.description || '';
  $('#lightbox-date').textContent     = cert.date ? formatMonth(cert.date) : '';
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
  if (typeof firebase !== 'undefined' && firebase.apps?.length) {
    cb();
  } else if (tries < 30) {
    setTimeout(() => waitForFirebase(cb, tries + 1), 200);
  } else {
    console.warn('Firebase not ready. Check firebase-config.js.');
  }
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#lightbox-close')?.addEventListener('click', closeLightbox);
  $('#lightbox-overlay')?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // Mobile nav toggle
  const navToggle = $('.nav-toggle');
  const navLinks  = $('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    // Close nav when a link is clicked
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
  }

  const path = location.pathname.split('/').pop();
  if (!path || path === 'index.html')    waitForFirebase(initHome);
  else if (path === 'blog.html')         waitForFirebase(initBlog);
  else if (path === 'certificates.html') waitForFirebase(initCerts);
  else if (path === 'post.html')         waitForFirebase(initPost);
});

/* ============================================================
   HOME
   ============================================================ */
function initHome() {
  const db = getDB();

  // Load profile photo
  db.ref('profile/photoURL').once('value').then(snap => {
    if (snap.exists() && snap.val()) {
      const img = $('#avatar-img');
      const initials = $('#avatar-initials');
      if (img) {
        img.src = snap.val();
        img.style.display = 'block';
        img.onerror = () => { img.style.display = 'none'; if (initials) initials.style.display = 'block'; };
        if (initials) initials.style.display = 'none';
      }
    }
  }).catch(() => {});

  // Latest 3 published posts
  const postsEl = $('#home-posts');
  if (postsEl) {
    db.ref('posts').orderByChild('dateTimestamp').limitToLast(3).once('value')
      .then(snap => {
        postsEl.innerHTML = '';
        if (!snap.exists()) {
          postsEl.innerHTML = '<p style="color:var(--text-muted)">No posts yet — check back soon!</p>';
          return;
        }
        const posts = [];
        snap.forEach(child => posts.push({ id: child.key, ...child.val() }));
        posts.reverse().filter(p => p.published).forEach(p => postsEl.appendChild(createPostCard(p, p.id)));
        if (!postsEl.querySelector('.post-card')) {
          postsEl.innerHTML = '<p style="color:var(--text-muted)">No posts yet — check back soon!</p>';
        }
      })
      .catch(() => { if (postsEl) postsEl.innerHTML = '<p style="color:var(--text-muted)">Could not load posts.</p>'; });
  }

  // Latest 4 certs
  const certsEl = $('#home-certs');
  if (certsEl) {
    db.ref('certificates').limitToLast(4).once('value')
      .then(snap => {
        certsEl.innerHTML = '';
        if (!snap.exists()) {
          certsEl.style.display = 'none';
          return;
        }
        const items = [];
        snap.forEach(child => items.push({ id: child.key, ...child.val() }));
        items.reverse().forEach(c => {
          const img = document.createElement('img');
          img.className = 'cert-thumb';
          img.src = c.imageURL || '';
          img.alt = c.title || 'Certificate';
          img.loading = 'lazy';
          img.addEventListener('click', () => openLightbox(c));
          certsEl.appendChild(img);
        });
      })
      .catch(() => { if (certsEl) certsEl.innerHTML = ''; });
  }
}

/* ============================================================
   BLOG
   ============================================================ */
let allPosts = [];

function initBlog() {
  const db = getDB();
  loadAllPosts(db);
  setupSearch();
  setupFilter();
  $('#load-more-btn')?.addEventListener('click', () => {}); // all loaded at once
}

function loadAllPosts(db) {
  const container = $('#blog-posts');
  if (!container) return;

  db.ref('posts').orderByChild('dateTimestamp').once('value')
    .then(snap => {
      container.innerHTML = '';
      allPosts = [];
      if (!snap.exists()) { showEmpty(true); return; }

      snap.forEach(child => allPosts.push({ id: child.key, ...child.val() }));
      allPosts = allPosts.reverse().filter(p => p.published);

      if (!allPosts.length) { showEmpty(true); return; }

      showEmpty(false);
      allPosts.forEach(p => container.appendChild(createPostCard(p, p.id)));
      const lmb = $('#load-more-btn');
      if (lmb) lmb.style.display = 'none';
    })
    .catch(() => {
      container.innerHTML = '<p style="color:var(--text-muted);padding:32px 0">Could not load posts. Firebase may not be configured yet.</p>';
    });
}

function setupSearch() {
  $('#blog-search')?.addEventListener('input', applyFilters);
}
function setupFilter() {
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
}
function applyFilters() {
  const query    = ($('#blog-search')?.value || '').toLowerCase().trim();
  const category = $('.filter-btn.active')?.dataset.category || 'all';
  const container = $('#blog-posts');
  if (!container) return;
  let visible = 0;
  $$('.post-card', container).forEach(card => {
    const matchCat   = category === 'all' || card.dataset.category === category;
    const matchQuery = !query || card.dataset.title.includes(query) ||
                       card.querySelector('.post-excerpt')?.textContent.toLowerCase().includes(query);
    card.style.display = (matchCat && matchQuery) ? '' : 'none';
    if (matchCat && matchQuery) visible++;
  });
  showEmpty(visible === 0);
}
function showEmpty(show) {
  $('#blog-empty')?.classList.toggle('hidden', !show);
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
      items.reverse().forEach(c => container.appendChild(createCertCard(c, c.id)));
    })
    .catch(() => { container.innerHTML = '<p style="color:var(--text-muted);padding:32px 0">Could not load certificates.</p>'; });
}

/* ============================================================
   POST DETAIL PAGE
   ============================================================ */
function initPost() {
  const postId = new URLSearchParams(location.search).get('id');
  if (!postId) { showPostError(); return; }

  getDB().ref('posts/' + postId).once('value')
    .then(snap => {
      if (!snap.exists()) { showPostError(); return; }
      const p = snap.val();
      if (!p.published) { showPostError(); return; }

      // Update page title
      document.title = (p.title || 'Post') + ' — Ajamali Saiyad';

      // Featured image
      if (p.imageURL) {
        const wrap = $('#post-featured-img-wrap');
        const img  = $('#post-featured-img');
        if (img)  { img.src = p.imageURL; img.alt = p.title || ''; }
        if (wrap) wrap.style.display = 'block';
      }

      // Header
      const catEl = $('#post-cat-badge');
      if (catEl) catEl.textContent = p.category || 'Update';
      const titleEl = $('#post-article-title');
      if (titleEl) titleEl.textContent = p.title || 'Untitled';
      const dateEl = $('#post-article-date');
      if (dateEl) dateEl.textContent = formatDate(p.dateTimestamp);

      // Content — rendered as HTML (admin-authored content)
      const contentEl = $('#post-article-content');
      if (contentEl) contentEl.innerHTML = p.content || '';

      // Show article
      $('#post-loading')?.classList.add('hidden');
      $('#post-article')?.classList.remove('hidden');
    })
    .catch(() => showPostError());
}

function showPostError() {
  $('#post-loading')?.classList.add('hidden');
  $('#post-error')?.classList.remove('hidden');
}
