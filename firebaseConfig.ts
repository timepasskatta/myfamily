import { initializeApp } from "firebase/app";
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
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
