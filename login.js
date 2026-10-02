// =========================================================
// FJMC ACADEMY - STUDENT LOGIN
// Firebase Authentication Version
// =========================================================

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth
} from "./firebase.js";



// =========================================================
// LOGIN ELEMENTS
// =========================================================

const loginForm =
    document.getElementById("loginForm");

const message =
    document.getElementById("loginMessage");


// =========================================================
// LOGIN
// =========================================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();


    const email =
        document
            .getElementById("email")
            .value
            .trim()
            .toLowerCase();


    const password =
        document.getElementById("password").value;


    // Clear previous message

    message.textContent = "";


    try {

        // Firebase Authentication

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        // Save Firebase UID

        sessionStorage.setItem(
            "firebaseUID",
            user.uid
        );


        // Save email

        sessionStorage.setItem(
            "loggedInStudent",
            user.email
        );


        // Return to the requested page after login; otherwise dashboard.
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        window.location.href = redirect || "dashboard.html";


    } catch (error) {

        console.error(
            "Firebase Login Error:",
            error
        );


        if (
            error.code ===
            "auth/invalid-credential"
        ) {

            message.textContent =
                "Incorrect email or password.";

        }

        else if (
            error.code ===
            "auth/user-not-found"
        ) {

            message.textContent =
                "Account not found.";

        }

        else if (
            error.code ===
            "auth/wrong-password"
        ) {

            message.textContent =
                "Incorrect password.";

        }

        else if (
            error.code ===
            "auth/too-many-requests"
        ) {

            message.textContent =
                "Too many login attempts. Please try again later.";

        }

        else {

            message.textContent =
                "Login failed. Please try again.";

        }

    }

});
