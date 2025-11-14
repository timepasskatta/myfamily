// 1. Go to your Firebase project console: https://console.firebase.google.com/
// 2. In your project, go to Project Settings (click the gear icon).
// 3. In the "General" tab, scroll down to "Your apps".
// 4. Click on the "Web" icon (</>) to create a new web app or select your existing one.
// 5. You will find your firebaseConfig object there. Copy and paste it below.

// FIX: The error indicates that `initializeApp` cannot be imported as a named export from `firebase/app`.
// This is likely due to a dependency version mismatch or a build tool configuration issue.
// Switching to the Firebase v9 compat library for initialization provides a compatible `app` object
// that works with the rest of the application's modular v9 code.
import firebase from "firebase/compat/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// User's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3u6Hs5GW80ThskrMZcs7lkMVpxEffjBY",
  authDomain: "finaltkapp.firebaseapp.com",
  projectId: "finaltkapp",
  storageBucket: "finaltkapp.firebasestorage.app",
  messagingSenderId: "623724926387",
  appId: "1:623724926387:web:205147d622f683c7fe67c6",
  measurementId: "G-G8XHTVK9W5"
};


// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
