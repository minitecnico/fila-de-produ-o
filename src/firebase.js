import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAg7rO_UbHs0ThEA749SU1ALsAJeTgOYW4",
  authDomain: "sistema-suporte-8ddde.firebaseapp.com",
  projectId: "sistema-suporte-8ddde",
  storageBucket: "sistema-suporte-8ddde.firebasestorage.app",
  messagingSenderId: "11630079012",
  appId: "1:11630079012:web:0ff708c9f6950dc333bcb1",
  measurementId: "G-5XN7RBSJB5"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// AQUI ESTÁ O SEGREDO: A palavra 'export' tem que estar aqui!
export const db = getFirestore(app);