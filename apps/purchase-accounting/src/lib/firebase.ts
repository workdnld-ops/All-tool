import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyD6aZhiruY_wqBfNPElCsybIQvKByld6_8",
  authDomain: "money-card-6bf98.firebaseapp.com",
  databaseURL: "https://money-card-6bf98-default-rtdb.firebaseio.com",
  projectId: "money-card-6bf98",
  storageBucket: "money-card-6bf98.firebasestorage.app",
  messagingSenderId: "245245451690",
  appId: "1:245245451690:web:e939a519af0009b8d1dfd3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const database = getDatabase(app);

// Fixed user ID for all data
export const getUserId = () => {
  return 'single-user';
};
