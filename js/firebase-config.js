/*
  ============================================================
  FIREBASE CONFIG — Realtime Database (No billing needed!)
  ============================================================

  Your config is already filled in below.
  The only thing you need to add is the databaseURL.

  HOW TO FIND YOUR DATABASE URL:
  1. Go to Firebase Console → your project
  2. Left sidebar → Realtime Database
  3. You will see a URL like:
     https://ajamali-blog-default-rtdb.firebaseio.com/
  4. Copy that URL and paste it as the databaseURL below

  SECURITY RULES FOR REALTIME DATABASE:
  In Firebase → Realtime Database → Rules tab, paste this:

  {
    "rules": {
      "certificates": {
        ".read": true,
        ".write": "auth != null"
      },
      "certificate_pdfs": {
        ".read": true,
        ".write": "auth != null"
      },
      "profile": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }

  Then click "Publish".
  ============================================================
*/

const firebaseConfig = {
  apiKey:            "AIzaSyCk5la31a5j_tVFw6NWyfZh8-FRlgcmT6c",
  authDomain:        "ajamali-blog.firebaseapp.com",
  projectId:         "ajamali-blog",
  storageBucket:     "ajamali-blog.firebasestorage.app",
  messagingSenderId: "921628431361",
  appId:             "1:921628431361:web:221490e32796183c595c00",
  databaseURL:       "https://ajamali-blog-default-rtdb.firebaseio.com"
};

// Initialize Firebase (only once)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
