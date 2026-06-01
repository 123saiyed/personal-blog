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

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

  const path = location.pathname.split('/').pop();
  if (path === 'add-post.html') initPostEditor();
  else                          initDashboard();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function initDashboard() {
  const db = getDB();
  loadStats(db);
  loadPostsTable(db);
  loadCertsTable(db);
  bindCertModal(db);
  bindProfileModal(db);
}

/* --- Stats --- */
function loadStats(db) {
  db.ref('posts').once('value').then(snap => {
    let pub = 0, draft = 0;
    snap.forEach(c => c.val().published ? pub++ : draft++);
    const sp = $('#stat-posts'), sd = $('#stat-drafts');
    if (sp) sp.textContent = pub;
    if (sd) sd.textContent = draft;
  });
  db.ref('certificates').once('value').then(snap => {
    const el = $('#stat-certs');
    if (el) el.textContent = snap.numChildren();
  });
}

/* --- Posts table --- */
function loadPostsTable(db) {
  const tbody = $('#posts-tbody');
  if (!tbody) return;

  db.ref('posts').orderByChild('dateTimestamp').once('value').then(snap => {
    tbody.innerHTML = '';
    if (!snap.exists()) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No posts yet. <a href="add-post.html">Write your first post &rarr;</a></td></tr>';
      return;
    }
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...child.val() }));
    rows.reverse().forEach(p => tbody.appendChild(buildPostRow(p, db)));
  });
}

function buildPostRow(p, db) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${safe(p.title) || 'Untitled'}</strong></td>
    <td>${safe(p.category) || '—'}</td>
    <td>${formatDate(p.dateTimestamp)}</td>
    <td>
      <label class="toggle-switch">
        <input type="checkbox" class="publish-toggle" ${p.published ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
      <span class="status-pill ${p.published ? 'published' : 'draft'}">${p.published ? 'Published' : 'Draft'}</span>
    </td>
    <td>
      <button class="action-btn edit-btn">Edit</button>
      <button class="action-btn delete del-btn">Delete</button>
    </td>`;

  tr.querySelector('.publish-toggle').addEventListener('change', e => {
    const pub = e.target.checked;
    db.ref('posts/' + p.id + '/published').set(pub).then(() => {
      const pill = tr.querySelector('.status-pill');
      pill.textContent  = pub ? 'Published' : 'Draft';
      pill.className    = `status-pill ${pub ? 'published' : 'draft'}`;
      loadStats(db);
    });
  });

  tr.querySelector('.edit-btn').addEventListener('click', () => {
    location.href = `add-post.html?id=${p.id}`;
  });

  tr.querySelector('.del-btn').addEventListener('click', () => {
    if (!confirm(`Delete "${p.title || 'this post'}"? Cannot be undone.`)) return;
    db.ref('posts/' + p.id).remove().then(() => { tr.remove(); loadStats(db); });
  });

  return tr;
}

/* --- Certs table --- */
function loadCertsTable(db) {
  const tbody = $('#certs-tbody');
  if (!tbody) return;

  db.ref('certificates').once('value').then(snap => {
    tbody.innerHTML = '';
    if (!snap.exists()) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No certificates yet.</td></tr>';
      return;
    }
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...child.val() }));
    rows.reverse().forEach(c => tbody.appendChild(buildCertRow(c, db)));
  });
}

function buildCertRow(c, db) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${safe(c.title) || 'Untitled'}</strong></td>
    <td>${c.date ? safe(formatMonth(c.date)) : '—'}</td>
    <td><a href="${safe(c.imageURL) || '#'}" target="_blank" class="link-more" style="font-size:.82rem">View Image</a></td>
    <td>
      <button class="action-btn edit-cert-btn">Edit</button>
      <button class="action-btn delete del-cert-btn">Delete</button>
    </td>`;

  tr.querySelector('.edit-cert-btn').addEventListener('click', () => openCertModal(c.id, c));
  tr.querySelector('.del-cert-btn').addEventListener('click', () => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    db.ref('certificates/' + c.id).remove().then(() => { tr.remove(); loadStats(db); });
  });
  return tr;
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

    // Show existing photo if any
    db.ref('profile/photoURL').once('value').then(snap => {
      const url = snap.val() || '';
      if (prev && url) { prev.src = url; prev.style.display = 'block'; }
    });

    $('#profile-modal')?.classList.remove('hidden');
    $('#profile-modal-overlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  // File chosen — resize + preview
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
        // Resize to max 300x300 using canvas
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        selectedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        if (prev) { prev.src = selectedBase64; prev.style.display = 'block'; }
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
    db.ref('profile').set({ photoURL: selectedBase64 })
      .then(() => { closeProfile(); showToast('Profile photo updated!'); })
      .catch(err => { console.error(err); alert('Error saving. Check Firebase rules.'); })
      .finally(() => { btn.disabled = false; btn.textContent = 'Save Photo'; });
  });
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

  // File chosen — resize + preview
  $('#cert-file-input')?.addEventListener('change', e => {
    const file   = e.target.files[0];
    const errEl  = $('#cert-file-error');
    const wrap   = $('#cert-img-preview-wrap');
    const prev   = $('#cert-img-preview');
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
        if (prev)  { prev.src = certBase64; }
        if (wrap)  { wrap.style.display = 'block'; }
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

  const titleEl = $('#cert-modal-title');
  if (titleEl) titleEl.textContent = docId ? 'Edit Certificate' : 'Add Certificate';
  $('#cert-doc-id').value       = docId || '';
  $('#cert-title').value        = data?.title || '';
  $('#cert-date').value         = data?.date || '';
  $('#cert-description').value  = data?.description || '';

  const fileInput = $('#cert-file-input');
  const errEl     = $('#cert-file-error');
  const wrap      = $('#cert-img-preview-wrap');
  const prev      = $('#cert-img-preview');
  if (fileInput) fileInput.value = '';
  if (errEl)     errEl.style.display = 'none';

  // Show existing image when editing
  if (data?.imageURL) {
    if (prev)  prev.src = data.imageURL;
    if (wrap)  wrap.style.display = 'block';
  } else {
    if (wrap)  wrap.style.display = 'none';
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
  const docId = $('#cert-doc-id').value;
  const imageURL = certBase64 || certEditExistingImage;

  if (!$('#cert-title').value.trim()) { alert('Certificate title is required.'); return; }
  if (!imageURL) { alert('Please choose a certificate image.'); return; }

  const data = {
    title:       $('#cert-title').value.trim(),
    imageURL:    imageURL,
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
    loadCertsTable(db);
    loadStats(db);
    showToast('Certificate saved!');
  }).catch(err => {
    console.error(err);
    alert('Error saving. Check Firebase rules.');
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = 'Save Certificate';
  });
}

/* ============================================================
   POST EDITOR
   ============================================================ */
let postImageBase64    = null;
let postImageExisting  = null;

function initPostEditor() {
  const db     = getDB();
  const editId = new URLSearchParams(location.search).get('id');

  if (editId) {
    const h = $('#page-heading');
    if (h) h.textContent = 'Edit Post';

    db.ref('posts/' + editId).once('value').then(snap => {
      if (!snap.exists()) return;
      const p = snap.val();
      const titleEl   = $('#post-title');
      const contentEl = $('#post-content');
      if (titleEl)   titleEl.value       = p.title || '';
      if (contentEl) contentEl.innerHTML = p.content || '';
      const catEl = $('#post-category');
      const pubEl = $('#post-published');
      const excEl = $('#post-excerpt');
      if (catEl) catEl.value   = p.category || 'update';
      if (pubEl) pubEl.checked = !!p.published;
      if (excEl) excEl.value   = p.excerpt || '';
      updatePublishLabel(!!p.published);
      updateExcerptCount();

      // Load existing featured image
      if (p.imageURL) {
        postImageExisting = p.imageURL;
        const prev = $('#post-img-preview');
        const wrap = $('#post-img-preview-wrap');
        const rmBtn = $('#post-img-remove');
        if (prev)  { prev.src = p.imageURL; }
        if (wrap)  { wrap.style.display = 'block'; }
        if (rmBtn) { rmBtn.style.display = 'block'; }
      }
    });
  }

  // File chosen
  $('#post-img-file')?.addEventListener('change', e => {
    const file   = e.target.files[0];
    const errEl  = $('#post-img-error');
    const wrap   = $('#post-img-preview-wrap');
    const prev   = $('#post-img-preview');
    const rmBtn  = $('#post-img-remove');
    if (errEl) errEl.style.display = 'none';
    postImageBase64 = null;

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
        postImageBase64 = canvas.toDataURL('image/jpeg', 0.85);
        if (prev)  { prev.src = postImageBase64; }
        if (wrap)  { wrap.style.display = 'block'; }
        if (rmBtn) { rmBtn.style.display = 'block'; }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Remove image
  $('#post-img-remove')?.addEventListener('click', () => {
    postImageBase64   = null;
    postImageExisting = null;
    const fileInput = $('#post-img-file');
    const wrap      = $('#post-img-preview-wrap');
    const rmBtn     = $('#post-img-remove');
    if (fileInput) fileInput.value = '';
    if (wrap)      wrap.style.display = 'none';
    if (rmBtn)     rmBtn.style.display = 'none';
  });

  $('#post-published')?.addEventListener('change', e => updatePublishLabel(e.target.checked));
  $('#post-excerpt')?.addEventListener('input', updateExcerptCount);

  $$('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (!cmd) return;
      if (cmd === 'createLink') {
        const url = prompt('Enter URL:');
        if (url) document.execCommand(cmd, false, url);
      } else {
        document.execCommand(cmd, false, null);
      }
      $('#post-content')?.focus();
    });
  });

  // Insert image into post body
  const insertImgBtn  = $('#insert-img-btn');
  const insertImgFile = $('#insert-img-file');
  let savedRange = null;

  insertImgBtn?.addEventListener('click', () => {
    // Save cursor position before file dialog opens
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
    insertImgFile.value = '';
    insertImgFile.click();
  });

  insertImgFile?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { alert('Image too large. Please choose under 6 MB.'); return; }

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);

        const editor = $('#post-content');
        editor?.focus();

        // Restore saved cursor position
        if (savedRange) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }

        document.execCommand('insertHTML', false,
          `<img src="${base64}" alt="post image" style="max-width:100%;border-radius:8px;margin:12px 0;display:block;" />`
        );
        savedRange = null;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('#post-form')?.addEventListener('submit', e => { e.preventDefault(); savePost(db, editId); });
}

function updatePublishLabel(pub) {
  const el = $('#publish-label');
  if (el) el.textContent = pub ? 'Published' : 'Draft';
}
function updateExcerptCount() {
  const el = $('#post-excerpt'), ctr = $('#excerpt-count');
  if (el && ctr) ctr.textContent = `${el.value.length} / 250`;
}

function savePost(db, editId) {
  const title   = $('#post-title')?.value.trim();
  const content = $('#post-content')?.innerHTML.trim();
  if (!title)                        { alert('Please add a title.'); return; }
  if (!content || content === '<br>') { alert('Please write some content.'); return; }

  const btn  = $('#save-post-btn');
  const txt  = $('#save-text');
  const spin = $('#save-spinner');
  btn.disabled = true;
  txt.textContent = 'Saving...';
  spin?.classList.remove('hidden');

  const data = {
    title,
    content,
    category:       $('#post-category')?.value || 'update',
    published:      $('#post-published')?.checked || false,
    excerpt:        $('#post-excerpt')?.value.trim() || '',
    imageURL:       postImageBase64 || postImageExisting || '',
    dateTimestamp:  Date.now()
  };

  const op = editId
    ? db.ref('posts/' + editId).update(data)
    : db.ref('posts').push(data);

  op.then(() => {
    showToast(editId ? 'Post updated!' : 'Post saved!');
    if (!editId) {
      $('#post-title').value      = '';
      $('#post-content').innerHTML = '';
      $('#post-excerpt').value    = '';
      updateExcerptCount();
    }
  }).catch(err => {
    console.error(err);
    alert('Error saving post. Check the console.');
  }).finally(() => {
    btn.disabled = false;
    txt.textContent = 'Save Post';
    spin?.classList.add('hidden');
  });
}
