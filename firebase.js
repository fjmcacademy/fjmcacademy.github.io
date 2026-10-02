// =========================================================
// FJMC ACADEMY - FIREBASE CONFIG
// =========================================================


import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


import {
    getAuth
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    getFirestore
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";




const firebaseConfig = {


    apiKey: "AIzaSyA19k56JFSzdeCvS1DthDcqTNYprtJTw8I",


    authDomain: "fjmcacademy.firebaseapp.com",


    projectId: "fjmcacademy",


    storageBucket: "fjmcacademy.firebasestorage.app",


    messagingSenderId: "474981170098",


    appId: "1:474981170098:web:8ca392cfc54708a09082ab",


    measurementId: "G-45N1FRFSMJ"


};




// Initialize Firebase


const app = initializeApp(firebaseConfig);




// Firebase Authentication


const auth = getAuth(app);




// Firestore


const db = getFirestore(app);




export {
    app,
    auth,
    db
};
