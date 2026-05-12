import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  getDocFromServer
} from "firebase/firestore";
// Define the structure of our expected config object
interface FirebaseAppletConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

// Access environment variables using Vite's way. 
// We cast through unknown/any to avoid TS errors in VS Code if vite/client types aren't loaded.
const ENV = (import.meta as any).env || {};

// Use Vite's glob import to optionally load the config file if it exists.
// This is the key to letting the app build on Vercel even when the file is missing.
const localConfigs = (import.meta as any).glob("../firebase-applet-config.json", { eager: true, import: "default" });
const localConfig = (localConfigs["../firebase-applet-config.json"] || {}) as FirebaseAppletConfig;

// Priority: 1. Environment Variables (Vercel) -> 2. Local JSON (AI Studio) -> 3. Defaults
const firebaseConfig = {
  apiKey: ENV.VITE_FIREBASE_API_KEY || localConfig.apiKey,
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
  projectId: ENV.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
  storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
  messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
  appId: ENV.VITE_FIREBASE_APP_ID || localConfig.appId,
  measurementId: ENV.VITE_FIREBASE_MEASUREMENT_ID || localConfig.measurementId,
  firestoreDatabaseId: ENV.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || "(default)"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Test connection as required by constraints
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
