// ============================================================
// FIREBASE CONFIGURATION
// Bu yerga o'z Firebase loyihangiz ma'lumotlarini kiriting!
// Qanday olish: https://console.firebase.google.com
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBxT9LvusDVijUpDqu29xP7AkiRRa8sKCQ",
  authDomain: "summer-challange.firebaseapp.com",
  projectId: "summer-challange",
  storageBucket: "summer-challange.firebasestorage.app",
  messagingSenderId: "396874594694",
  appId: "1:396874594694:web:da31d21a841766f7b05407",
  };

// ============================================================
// Firebase ni ishga tushirish
// ============================================================
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

// Firestore document yo'li (har bir foydalanuvchi o'z ma'lumotiga ega)
function getUserDocRef() {
  const user = auth.currentUser;
  if (!user) return null;
  return db.collection("users").doc(user.uid).collection("data").doc("reading_state");
}

