# Personal Blog Portal — Setup & Deployment Guide

## 1. Fill in Your Details

Search for `[YOUR NAME]`, `[YOUR JOB TITLE]`, and `[INITIALS]` in all `.html` files and replace them with your real information.

Files to update:
- `index.html`
- `blog.html`
- `certificates.html`
- `job-form.html`
- `admin/dashboard.html`
- `admin/add-post.html`

---

## 2. Set Up Firebase (15 minutes)

Full step-by-step instructions are inside `js/firebase-config.js` (open it and read the comments at the top).

**Short version:**
1. Create a project at https://console.firebase.google.com/
2. Register a Web app → copy the config values
3. Enable **Firestore Database** (test mode)
4. Enable **Authentication** → Email/Password → add yourself as a user
5. Paste your config values into `js/firebase-config.js`
6. Add the security rules from the comment in `firebase-config.js`

---

## 3. Test Locally

Just open `index.html` in your browser — no server needed.

To test the admin dashboard, open `admin/dashboard.html`.

---

## 4. Deploy to Netlify (2 minutes)

### Option A — Drag & Drop (fastest)
1. Go to https://app.netlify.com/drop
2. Drag your entire `personal/` folder onto the page
3. Your site is live instantly — you get a free `.netlify.app` URL

### Option B — Git + Auto Deploy
1. Push this folder to a GitHub repository
2. Go to https://app.netlify.com → "Add new site" → "Import from Git"
3. Connect your GitHub repo → click "Deploy site"
4. Every `git push` auto-deploys your site

### Custom Domain (optional)
1. In Netlify: Site settings → Domain management → Add custom domain
2. Update your domain's DNS to point to Netlify's nameservers
3. Netlify provides a free SSL certificate automatically

---

## 5. Using the Admin Dashboard

1. Open `https://YOUR-SITE.netlify.app/admin/dashboard.html`
2. Log in with the email + password you created in Firebase
3. Use the dashboard to:
   - **Write posts** → Admin → New Post → fill title + content → toggle "Published" → Save
   - **Add certificates** → Dashboard → "+ Add Certificate" → paste image URL → Save
   - **View inquiries** → Dashboard → scroll to "Job Inquiries" section

---

## File Structure

```
personal/
├── index.html              ← Home / profile page
├── blog.html               ← Blog posts list + search
├── certificates.html       ← Certificates gallery
├── job-form.html           ← Job inquiry form
├── admin/
│   ├── dashboard.html      ← Admin control center
│   ├── add-post.html       ← Write / edit posts
│   └── admin.js            ← Admin CRUD logic
├── css/
│   └── style.css           ← All styles
└── js/
    ├── firebase-config.js  ← Your Firebase keys + setup guide
    └── app.js              ← Public JS (posts, certs, form)
```

---

## Replacing Placeholder Text

| Placeholder | Replace With |
|-------------|-------------|
| `[YOUR NAME]` | Your full name (e.g. `Ahmad Jamali`) |
| `[YOUR JOB TITLE]` | Your title (e.g. `Full Stack Developer`) |
| `[INITIALS]` | Your initials (e.g. `AJ`) |
| `YOUR-DOMAIN.com` | Your actual domain or Netlify URL |
