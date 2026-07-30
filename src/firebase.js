// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB-wWxGG57FioynrfVzj_HZoQbyzDfP_Uo",
  authDomain: "techgigs-3e0f0.firebaseapp.com",
  projectId: "techgigs-3e0f0",
  storageBucket: "techgigs-3e0f0.firebasestorage.app",
  messagingSenderId: "391447868211",
  appId: "1:391447868211:web:7ea91d6555006ed31dc446",
  measurementId: "G-497CBWMRDX"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app); // Line 25 will work now!
export const storage = getStorage(app);