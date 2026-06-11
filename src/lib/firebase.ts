import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  // Deteksi jika aplikasi dibuka dari HP (termasuk APK Android)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Gunakan Redirect agar login tetap di dalam aplikasi (tidak terlempar ke Chrome)
    return signInWithRedirect(auth, googleProvider);
  } else {
    // Gunakan Popup untuk penggunaan normal di Web/Laptop
    return signInWithPopup(auth, googleProvider);
  }
};

export const logOut = () => signOut(auth);
