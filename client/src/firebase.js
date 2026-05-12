import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDeDZ2kWUF1VgmjBuj_a3oc2KmXyqJnI0A",
  authDomain: "projectalertic.firebaseapp.com",
  projectId: "projectalertic",
  storageBucket: "projectalertic.firebasestorage.app",
  messagingSenderId: "288466689632",
  appId: "1:288466689632:web:4dda97ee7e49a1d9f9ed05"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

export default app;
