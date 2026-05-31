// ============================================================
// FIREBASE CONFIGURATION
// Bu yerga o'z Firebase loyihangiz ma'lumotlarini kiriting!
// Qanday olish: https://console.firebase.google.com
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ============================================================
// Firebase ni ishga tushirish
// ============================================================
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();
