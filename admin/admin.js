/* ============================================================
   admin.js — Admin dashboard (Realtime Database version)
   ============================================================ */
'use strict';

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function getDB()   { return firebase.database(); }
function getAuth() { return firebase.auth(); }

function safe(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function formatMonth(str) {
  if (!str) return '';
  const [y, m] = str.split('-');
  return new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
function showToast(msg) {
  const t = $('#save-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ---------- wait for Firebase ---------- */
function waitForFirebase(cb, tries = 0) {
  if (typeof firebase !== 'undefined' && firebase.apps?.length) cb();
  else if (tries < 30) setTimeout(() => waitForFirebase(cb, tries + 1), 200);
  else console.warn('Firebase not ready.');
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => waitForFirebase(boot));

function boot() {
  getAuth().onAuthStateChanged(user => {
    if (user) showApp(user);
    else      showLogin();
  });
}

/* ============================================================
   LOGIN
   ============================================================ */
function showLogin() {
  $('#login-screen')?.classList.remove('hidden');
  $('#admin-app')?.classList.add('hidden');

  const form = $('#login-form');
  if (!form || form._bound) return;
  form._bound = true;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const pass  = $('#login-password').value;
    const errEl = $('#login-error');
    const btn   = $('#login-btn');
    const txt   = $('#login-text');
    const spin  = $('#login-spinner');

    errEl?.classList.add('hidden');
    btn.disabled = true;
    txt.textContent = 'Signing in...';
    spin?.classList.remove('hidden');

    getAuth().signInWithEmailAndPassword(email, pass)
      .catch(() => {
        errEl?.classList.remove('hidden');
        btn.disabled = false;
        txt.textContent = 'Sign In';
        spin?.classList.add('hidden');
      });
  });
}

/* ============================================================
   APP SHELL
   ============================================================ */
function showApp(user) {
  $('#login-screen')?.classList.add('hidden');
  $('#admin-app')?.classList.remove('hidden');

  const emailEl = $('#admin-user-email');
  if (emailEl) emailEl.textContent = user.email;

  $('#logout-btn')?.addEventListener('click', () => getAuth().signOut());

  bindMobileSidebar();
  initDashboard();
}

function bindMobileSidebar() {
  const sidebar = $('.admin-sidebar');
  const overlay = $('#sidebar-overlay');
  const menuBtn = $('#admin-menu-btn');

  const open  = () => { sidebar?.classList.add('open'); overlay?.classList.add('open'); };
  const close = () => { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); };

  menuBtn?.addEventListener('click', open);
  overlay?.addEventListener('click', close);
  $$('.sidebar-link').forEach(link => link.addEventListener('click', () => {
    if (window.innerWidth <= 768) close();
  }));
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function initDashboard() {
  const db = getDB();
  loadStats(db);
  loadCertsTable(db);
  bindCertModal(db);
  bindProfileModal(db);
  loadHomeSettings(db);
  bindHomeSettings(db);
}

/* --- Stats --- */
function loadStats(db) {
  db.ref('certificates').once('value').then(snap => {
    const el = $('#stat-certs');
    if (el) el.textContent = snap.numChildren();
  });
  db.ref('profile/skills').once('value').then(snap => {
    const el = $('#stat-skills');
    if (el) {
      const val = snap.val() || '';
      el.textContent = val ? val.split(',').filter(s => s.trim()).length : 0;
    }
  });
}

/* ============================================================
   CERTIFICATES TABLE — real-time listener, always in sync
   ============================================================ */
let _certsListenerOff = null;

function loadCertsTable(db) {
  const tbody = $('#certs-tbody');
  if (!tbody) return;

  // Remove any previous listener before attaching a new one
  if (_certsListenerOff) { _certsListenerOff(); _certsListenerOff = null; }

  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading...</td></tr>';

  const ref = db.ref('certificates');
  const handler = snap => {
    tbody.innerHTML = '';
    if (!snap.exists() || snap.numChildren() === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No certificates yet. Click "+ Add Certificate" to add one.</td></tr>';
      return;
    }
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...child.val() }));
    rows.reverse().forEach(c => tbody.appendChild(buildCertRow(c, db)));
  };
  const errHandler = err => {
    console.error('Certs load error:', err);
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading" style="color:#dc2626">Could not load certificates — check Firebase rules.</td></tr>';
  };

  ref.on('value', handler, errHandler);
  _certsListenerOff = () => ref.off('value', handler);
}

function buildCertRow(c, db) {
  const tr = document.createElement('tr');

  // View cell: image button, PDF link, or dash
  let viewCell;
  if (c.imageURL) {
    viewCell = `<button class="link-more view-img-btn" style="font-size:.82rem;background:none;border:none;padding:0;cursor:pointer">View Image</button>`;
  } else if (c.pdfURL) {
    viewCell = `<a href="${safe(c.pdfURL)}" target="_blank" rel="noopener" class="link-more" style="font-size:.82rem">View PDF ↗</a>`;
  } else {
    viewCell = `<span style="color:var(--text-muted);font-size:.82rem">—</span>`;
  }

  tr.innerHTML = `
    <td><strong>${safe(c.title) || 'Untitled'}</strong></td>
    <td>${c.date ? safe(formatMonth(c.date)) : '—'}</td>
    <td>${viewCell}</td>
    <td>
      <button class="action-btn edit-cert-btn">Edit</button>
      <button class="action-btn delete del-cert-btn">Delete</button>
    </td>`;

  if (c.imageURL) {
    tr.querySelector('.view-img-btn').addEventListener('click', () => {
      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${c.imageURL}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`);
      w.document.close();
    });
  }

  tr.querySelector('.edit-cert-btn').addEventListener('click', () => openCertModal(c.id, c));

  tr.querySelector('.del-cert-btn').addEventListener('click', () => {
    if (!confirm(`Delete "${c.title}"?\nThis cannot be undone.`)) return;
    db.ref('certificates/' + c.id).remove()
      .then(() => loadStats(db))
      .catch(() => alert('Error deleting. Check Firebase rules.'));
  });
  return tr;
}

/* ============================================================
   CERTIFICATE MODAL
   ============================================================ */
let certBase64 = null;
let certEditExistingImage = null;

function bindCertModal(db) {
  $('#add-cert-btn')?.addEventListener('click',  () => openCertModal(null, null));
  $('#add-cert-btn2')?.addEventListener('click', () => openCertModal(null, null));
  $('#cert-modal-close')?.addEventListener('click', closeCertModal);
  $('#cert-cancel-btn')?.addEventListener('click', closeCertModal);
  $('#cert-modal-overlay')?.addEventListener('click', closeCertModal);

  $('#cert-file-input')?.addEventListener('change', e => {
    const file  = e.target.files[0];
    const errEl = $('#cert-file-error');
    const wrap  = $('#cert-img-preview-wrap');
    const prev  = $('#cert-img-preview');
    if (errEl) errEl.style.display = 'none';
    certBase64 = null;
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      if (errEl) { errEl.textContent = 'File too large. Please choose an image under 6 MB.'; errEl.style.display = 'block'; }
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        certBase64 = canvas.toDataURL('image/jpeg', 0.85);
        if (prev) prev.src = certBase64;
        if (wrap) wrap.style.display = 'block';
        const statusEl = $('#cert-img-status');
        if (statusEl) {
          statusEl.textContent = '✓ Image ready — click "Save Certificate" below to save.';
          statusEl.style.color = '#16a34a';
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('#cert-form')?.addEventListener('submit', e => { e.preventDefault(); saveCert(db); });
}

function openCertModal(docId, data) {
  certBase64 = null;
  certEditExistingImage = data?.imageURL || null;
  const isEdit = !!docId;

  // Modal title
  const titleEl = $('#cert-modal-title');
  if (titleEl) titleEl.textContent = isEdit ? 'Edit Certificate' : 'Add Certificate';

  // Image field: different label + hint for edit vs add
  const imgLabel = $('#cert-img-label');
  const imgSmall = $('#cert-img-small');
  const statusEl = $('#cert-img-status');
  if (imgLabel) {
    imgLabel.innerHTML = isEdit
      ? 'Update Image <span style="font-weight:400;color:var(--text-muted);font-size:.8rem">(optional — existing image kept if you do not choose a new one)</span>'
      : 'Certificate Image <span class="required">*</span>';
  }
  if (imgSmall) {
    imgSmall.textContent = isEdit
      ? 'Choose a new image only if you want to replace the current one.'
      : 'Select a JPG or PNG of your certificate. Max 6 MB.';
  }
  if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }

  // Form fields
  $('#cert-doc-id').value      = docId || '';
  $('#cert-title').value       = data?.title || '';
  $('#cert-date').value        = data?.date || '';
  $('#cert-description').value = data?.description || '';
  const pdfEl = $('#cert-pdf-url');
  if (pdfEl) pdfEl.value = data?.pdfURL || '';

  // Reset file input
  const fileInput = $('#cert-file-input');
  const errEl     = $('#cert-file-error');
  const wrap      = $('#cert-img-preview-wrap');
  const prev      = $('#cert-img-preview');
  if (fileInput) fileInput.value = '';
  if (errEl)     errEl.style.display = 'none';

  // Show existing image when editing
  if (isEdit && data?.imageURL) {
    if (prev) prev.src = data.imageURL;
    if (wrap) wrap.style.display = 'block';
  } else {
    if (wrap) wrap.style.display = 'none';
    if (prev) prev.src = '';
  }

  $('#cert-modal')?.classList.remove('hidden');
  $('#cert-modal-overlay')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCertModal() {
  $('#cert-modal')?.classList.add('hidden');
  $('#cert-modal-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
  certBase64 = null;
  certEditExistingImage = null;
}

function saveCert(db) {
  const docId    = $('#cert-doc-id').value;
  const imageURL = certBase64 || certEditExistingImage;
  const pdfURL   = $('#cert-pdf-url')?.value.trim() || '';

  if (!$('#cert-title').value.trim()) { alert('Certificate title is required.'); return; }
  if (!imageURL && !pdfURL) {
    alert('Please upload a certificate image OR paste a PDF link (Google Drive).');
    return;
  }

  const data = {
    title:       $('#cert-title').value.trim(),
    imageURL:    imageURL || '',
    pdfURL:      pdfURL,
    date:        $('#cert-date').value,
    description: $('#cert-description').value.trim()
  };

  const btn = $('#cert-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const op = docId
    ? db.ref('certificates/' + docId).update(data)
    : db.ref('certificates').push(data);

  op.then(() => {
    closeCertModal();
    loadStats(db);
    showToast('Certificate saved!');
    // Table auto-updates via real-time listener — no manual reload needed
  }).catch(err => {
    console.error(err);
    alert('Error saving. Check Firebase rules.');
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = 'Save Certificate';
  });
}

/* ============================================================
   PROFILE PHOTO MODAL
   ============================================================ */
function bindProfileModal(db) {
  let selectedBase64 = null;

  $('#edit-profile-btn')?.addEventListener('click', () => {
    selectedBase64 = null;
    const fileInput = $('#profile-file-input');
    const prev      = $('#profile-preview');
    const saveBtn   = $('#profile-save-btn');
    if (fileInput) fileInput.value = '';
    if (prev)      { prev.src = ''; prev.style.display = 'none'; }
    if (saveBtn)   saveBtn.disabled = true;

    db.ref('profile/photoURL').once('value').then(snap => {
      const url = snap.val() || '';
      if (prev && url) { prev.src = url; prev.style.display = 'block'; }
    });

    $('#profile-modal')?.classList.remove('hidden');
    $('#profile-modal-overlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  $('#profile-file-input')?.addEventListener('change', e => {
    const file    = e.target.files[0];
    const errEl   = $('#profile-file-error');
    const prev    = $('#profile-preview');
    const saveBtn = $('#profile-save-btn');
    if (errEl) errEl.style.display = 'none';
    selectedBase64 = null;
    if (saveBtn) saveBtn.disabled = true;
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      if (errEl) { errEl.textContent = 'File too large. Please choose a photo under 4 MB.'; errEl.style.display = 'block'; }
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        selectedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        if (prev)    { prev.src = selectedBase64; prev.style.display = 'block'; }
        if (saveBtn) saveBtn.disabled = false;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  const closeProfile = () => {
    $('#profile-modal')?.classList.add('hidden');
    $('#profile-modal-overlay')?.classList.add('hidden');
    document.body.style.overflow = '';
    selectedBase64 = null;
  };
  $('#profile-modal-close')?.addEventListener('click', closeProfile);
  $('#profile-cancel-btn')?.addEventListener('click', closeProfile);
  $('#profile-modal-overlay')?.addEventListener('click', closeProfile);

  $('#profile-save-btn')?.addEventListener('click', () => {
    if (!selectedBase64) { alert('Please choose a photo first.'); return; }
    const btn = $('#profile-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    db.ref('profile/photoURL').set(selectedBase64)
      .then(() => { closeProfile(); showToast('Profile photo updated!'); })
      .catch(err => { console.error(err); alert('Error saving. Check Firebase rules.'); })
      .finally(() => { btn.disabled = false; btn.textContent = 'Save Photo'; });
  });
}

/* ============================================================
   HOME PAGE SETTINGS
   ============================================================ */
function loadHomeSettings(db) {
  db.ref('profile').once('value').then(snap => {
    const p = snap.val() || {};
    const set = (id, val) => { const el = $(id); if (el && val) el.value = val; };

    set('#hs-badge',        p.badge);
    set('#hs-jobtitle',     p.jobTitle);
    set('#hs-bio',          p.bio);
    set('#hs-resume',       p.resumeURL);
    set('#hs-skills',       p.skills);
    set('#hs-email',        p.email);
    set('#hs-linkedin',     p.linkedin);
    set('#hs-about1-icon',  p.about1Icon);
    set('#hs-about1-title', p.about1Title);
    set('#hs-about1-text',  p.about1Text);
    set('#hs-about2-icon',  p.about2Icon);
    set('#hs-about2-title', p.about2Title);
    set('#hs-about2-text',  p.about2Text);
    set('#hs-about3-icon',  p.about3Icon);
    set('#hs-about3-title', p.about3Title);
    set('#hs-about3-text',  p.about3Text);
  });
}

function bindHomeSettings(db) {
  $('#save-home-btn')?.addEventListener('click', () => {
    const btn  = $('#save-home-btn');
    const txt  = $('#save-home-text');
    const spin = $('#save-home-spinner');
    btn.disabled = true;
    txt.textContent = 'Saving...';
    spin?.classList.remove('hidden');

    const get = id => $(id)?.value.trim() || '';

    const data = {
      badge:        get('#hs-badge'),
      jobTitle:     get('#hs-jobtitle'),
      bio:          get('#hs-bio'),
      resumeURL:    get('#hs-resume'),
      skills:       get('#hs-skills'),
      email:        get('#hs-email'),
      linkedin:     get('#hs-linkedin'),
      about1Icon:   get('#hs-about1-icon'),
      about1Title:  get('#hs-about1-title'),
      about1Text:   get('#hs-about1-text'),
      about2Icon:   get('#hs-about2-icon'),
      about2Title:  get('#hs-about2-title'),
      about2Text:   get('#hs-about2-text'),
      about3Icon:   get('#hs-about3-icon'),
      about3Title:  get('#hs-about3-title'),
      about3Text:   get('#hs-about3-text'),
    };

    // Preserve existing photoURL — don't overwrite it
    db.ref('profile/photoURL').once('value').then(snap => {
      if (snap.val()) data.photoURL = snap.val();
      return db.ref('profile').set(data);
    }).then(() => {
      showToast('Home page updated!');
      loadStats(db);
    }).catch(err => {
      console.error(err);
      alert('Error saving. Check Firebase rules.');
    }).finally(() => {
      btn.disabled = false;
      txt.textContent = 'Save Changes';
      spin?.classList.add('hidden');
    });
  });
}
