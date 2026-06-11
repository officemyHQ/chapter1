// Firebase v9 compat SDK — loaded via CDN on each page
// REPLACE the firebaseConfig object below with your actual config from Firebase console
// Project Settings → Your apps → Web app → Config

const firebaseConfig = {
  apiKey: "AIzaSyAoeUYe4Y-eIo7Ts6O-xQUaI29wUBE-Ypw",
  authDomain: "myhq-td-fcf03.firebaseapp.com",
  projectId: "myhq-td-fcf03",
  storageBucket: "myhq-td-fcf03.firebasestorage.app",
  messagingSenderId: "83409357059",
  appId: "1:83409357059:web:5fbcf0053792ddcf248136"
};

firebase.initializeApp(firebaseConfig);

window.firebaseAuth = firebase.auth();
window.firebaseDB   = firebase.firestore();

const MASTER_ADMIN_EMAIL = 'rohit.bagga@myhq.in';

window.firebaseAuth.onAuthStateChanged(async function(user) {
  if (!user) return;

  if (!user.email.endsWith('@myhq.in')) {
    window.firebaseAuth.signOut();
    return;
  }

  const uid  = user.uid;
  const ref  = window.firebaseDB.collection('users').doc(uid);
  const snap = await ref.get();

  if (user.email === MASTER_ADMIN_EMAIL && (!snap.exists || !snap.data().masterAdmin)) {
    await ref.set({ masterAdmin: true }, { merge: true });
  }

  const upsert = {
    name:      user.displayName ? user.displayName.split(' ')[0] : '',
    email:     user.email,
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(upsert, { merge: true });
});
