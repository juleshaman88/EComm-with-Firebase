import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQdcgMai778iwiWN2Gyjj-JJ67RfOcRLc",
  authDomain: "e-comm-with-firebase-9d7df.firebaseapp.com",
  projectId: "e-comm-with-firebase-9d7df",
  storageBucket: "e-comm-with-firebase-9d7df.firebasestorage.app",
  messagingSenderId: "655290903809",
  appId: "1:655290903809:web:5c3de7e316faf9ed283f00"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, auth, db };