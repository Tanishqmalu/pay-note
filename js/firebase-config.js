// ============================================================
//  Firebase configuration
// ============================================================
// 1. Go to https://console.firebase.google.com/
// 2. Create a project (or open an existing one).
// 3. Add a "Web app" (</> icon) to the project.
// 4. Copy the firebaseConfig values it shows you and paste
//    them below, replacing every "YOUR_..." placeholder.
//
// NOTE: These keys are meant to be public in web apps.
// Your data is protected by Firestore Security Rules
// (see firestore.rules), NOT by hiding these values.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDx4_ecJMZbpmKigX-WPtG1DDBRlUbiFc8",
  authDomain: "moneymanger-bb18b.firebaseapp.com",
  projectId: "moneymanger-bb18b",
  storageBucket: "moneymanger-bb18b.firebasestorage.app",
  messagingSenderId: "666365228627",
  appId: "1:666365228627:web:08397fe9bde67c3025f8a6",
  measurementId: "G-ET5SRBH7QP"
};

// Default currency for the whole app.
export const CURRENCY = "INR";
export const LOCALE = "en-IN";
