/**
 * Firebase: app, Firestore with an offline cache, and email/password sign-in.
 * The SDK is vendored in vendor/firebase (same origin) so the service worker caches it for offline use.
 */
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from '../vendor/firebase/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from '../vendor/firebase/firebase-auth.js';

const app = initializeApp({
  apiKey: 'AIzaSyCO1oXH0PFBISeO2ITyZq6N3ctDtTwDFmI',
  authDomain: 'plate-calc-app.firebaseapp.com',
  projectId: 'plate-calc-app',
  storageBucket: 'plate-calc-app.firebasestorage.app',
  messagingSenderId: '649914753822',
  appId: '1:649914753822:web:badc1138fe22be59279f0f',
});

// Every read and write works against the local cache; the SDK syncs with the server when online
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);

/** Signed-in user (restored from the device even offline), or null */
export async function currentUser() {
  await auth.authStateReady();
  return auth.currentUser;
}

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export function resetPassword(email, language) {
  auth.languageCode = language;
  return sendPasswordResetEmail(auth, email);
}
export const logOut = () => signOut(auth);
