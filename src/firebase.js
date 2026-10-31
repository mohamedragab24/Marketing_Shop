import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

// إعدادات تطبيق الويب عامة بطبيعتها. الحماية الفعلية تكون عبر Firebase Security Rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDAidSZCkIjK00jNkZ6abQwbSJ4cpZEYEo',
  authDomain: 'studio-1284053768-822ae.firebaseapp.com',
  projectId: 'studio-1284053768-822ae',
  storageBucket: 'studio-1284053768-822ae.firebasestorage.app',
  messagingSenderId: '658254623770',
  appId: '1:658254623770:web:d503b9196ce42f1c9c8da3',
};

const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfigured && auth && db);
}

export async function syncReadingProgress(completedSections) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase غير مهيأ. يمكنك الاحتفاظ بالتقدم على هذا الجهاز.');
  }

  const credential = await signInAnonymously(auth);
  const userId = credential.user.uid;
  await setDoc(
    doc(db, 'studyProgress', userId),
    {
      sections: [...new Set(completedSections)].slice(0, 20),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
