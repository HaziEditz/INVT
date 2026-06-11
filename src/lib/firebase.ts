import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, get, off, set, update, push, remove } from 'firebase/database';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export function initFirebase(config: FirebaseClientConfig) {
  if (app) return { app, auth: auth!, db: db! };
  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
  return { app, auth, db };
}

export function getDb(): Database {
  if (!db) throw new Error('Firebase not initialized');
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase not initialized');
  return auth;
}

export { ref, onValue, onChildAdded, onChildChanged, onChildRemoved, get, off, set, update, push, remove };

export async function fetchClientConfig(): Promise<{
  firebase: FirebaseClientConfig;
  mapsApiKey: string;
}> {
  const r = await fetch('/api/config/client');
  if (!r.ok) throw new Error('Failed to load client config');
  return r.json();
}
