import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from '../config';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);

// Use AsyncStorage for auth persistence on React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

export { auth, db };

// ============================================================
// Auth Functions
// ============================================================

/**
 * Create a new account and user profile in Firestore
 */
export async function signUp(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // Generate a unique invite code for couple pairing
  const inviteCode = generateInviteCode();

  // Create user profile in Firestore
  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: displayName || email.split('@')[0],
    inviteCode,
    partnerUID: null,
    locationLat: null,
    locationLng: null,
    searchRadiusMiles: 5,
    createdAt: serverTimestamp(),
  });

  return {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    inviteCode,
  };
}

/**
 * Sign in with existing credentials
 */
export async function logIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Sign out
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Get the current user's Firestore profile
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    return { uid, ...snap.data() };
  }
  return null;
}

/**
 * Update user profile fields (creates the document if it doesn't exist)
 */
export async function updateUserProfile(uid, updates) {
  await setDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Listen for auth state changes
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ============================================================
// Helpers
// ============================================================

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
