import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// Firebase exposes this through its React Native conditional export at runtime,
// but its default TypeScript declaration targets the browser entrypoint.
// @ts-expect-error React Native conditional export
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
  } else {
    try {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Fast refresh may initialize Auth before this module is evaluated again.
      authInstance = getAuth(app);
    }
  }
  firestoreInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = firestoreInstance;

export function requireFirebase() {
  if (!auth || !db) {
    throw new Error('Firebase chưa được cấu hình. Hãy tạo file .env theo .env.example.');
  }
  return { auth, db };
}
