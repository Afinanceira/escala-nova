import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtxvlcx4BPrTO-jBgxJFC6qsRq07zhKXg",
  authDomain: "escala-nova-d596e.firebaseapp.com",
  projectId: "escala-nova-d596e",
  storageBucket: "escala-nova-d596e.firebasestorage.app",
  messagingSenderId: "612241634323",
  appId: "1:612241634323:web:729a8ac37184eb92b47be6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);