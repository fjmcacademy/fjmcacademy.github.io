/* =========================================================
   FJMC ACADEMY - STUDENT DASHBOARD
   1 MOBILE + 1 DESKTOP/LAPTOP
   FIXED 3-DAY DEVICE RESERVATION
   LOGOUT DOES NOT FREE DEVICE SLOT
========================================================= */

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   STUDENT DATA

   FORMAT:

   email: {
       name: "Student Name",

       exam: "Exam Name",
       batch: "Batch 1",
       year: "2026",

       courses: [
           "course-id"
       ]
   }

   IMPORTANT:
   Different batch/year can have completely
   different courses and materials.
========================================================= */

const STUDENTS = {

    /* =====================================================
       TEST STUDENT 1
       CSIR NET - Batch 1 - 2026
    ===================================================== */

    "fjmcacademy1008@gmail.com": {

        name: "Rahul",

        exam: "CSIR NET",

        batch: "Batch 1",

        year: "2026",

        courses: [
            "csir-net-2026-batch1-linear-algebra",
            "csir-net-2026-batch1-real-analysis"
        ]

    },


    /* =====================================================
       TEST STUDENT 2
       CSIR NET - Batch 2 - 2026
    ===================================================== */

    "amit@gmail.com": {

        name: "Amit",

        exam: "CSIR NET",

        batch: "Batch 2",

        year: "2026",

        courses: [
            "csir-net-2026-batch2-linear-algebra",
            "csir-net-2026-batch2-calculus"
        ]

    },


    /* =====================================================
       TEST STUDENT 3
       IIT JAM - Batch 1 - 2026
    ===================================================== */

    "fogatjagmohan@gmail.com": {

        name: "Neha",

        exam: "IIT JAM",

        batch: "Batch 1",

        year: "2026",

        courses: [
            "iit-jam-2026-batch1-linear-algebra",
            "iit-jam-2026-batch1-calculus"
        ]

    }

};


/* =========================================================
   COURSE DATA

   IMPORTANT:

   Course ID contains:

   EXAM + YEAR + BATCH + SUBJECT

   Therefore:

   CSIR Batch 1 Linear Algebra
   and
   CSIR Batch 2 Linear Algebra

   are completely separate courses.

   Their videos/PDF/live links can be different.
========================================================= */

const COURSES = {


    /* =====================================================
       CSIR NET
       2026
       BATCH 1
       LINEAR ALGEBRA
    ===================================================== */

    "csir-net-2026-batch1-linear-algebra": {

        exam: "CSIR NET",

        batch: "Batch 1",

        year: "2026",

        subject: "Linear Algebra",

        title: "Linear Algebra",

        description:
            "CSIR NET 2026 - Batch 1 - Complete Linear Algebra Course",

        /*
           Existing Test 1 system can still use
           the old test ID.
        */

        testId: "linear-algebra",

        contents: [

            {
                type: "video",
                title: "Lecture 1",
                url:
                    "https://res.cloudinary.com/l2fd7dwa/video/upload/v1790603659/file_example_MP4_640_3MG.mp4"
            },

            {
                type: "video",
                title: "Lecture 2",
                url:
                    "poster/You"
            },

            {
                type: "pdf",
                title: "Linear Algebra Notes",
                url:
                    "pdf/linear-algebra-notes.pdf"
            },

            {
                type: "pdf",
                title: "Lecture 2 PDF",
                url:
                    "ch03.pdf"
            },

            {
                type: "live",
                title: "Live Class",
                url: "#"
            }

        ]

    },


    /* =====================================================
       CSIR NET
       2026
       BATCH 1
       REAL ANALYSIS
    ===================================================== */

    "csir-net-2026-batch1-real-analysis": {

        exam: "CSIR NET",

        batch: "Batch 1",

        year: "2026",

        subject: "Real Analysis",

        title: "Real Analysis",

        description:
            "CSIR NET 2026 - Batch 1 - Complete Real Analysis Course",

        testId: "real-analysis",

        contents: [

            {
                type: "video",
                title: "Lecture 1",
                url:
                    "https://www.youtube.com/embed/EnLKN-6ocsE"
            },

            {
                type: "video",
                title: "Lecture 2",
                url:
                    "https://www.youtube.com/embed/vE8g1ARMtJU?rel=0&modestbranding=1"
            },

            {
                type: "local-video",
                title: "Lecture 3",
                url:
                    "real-analysis-lecture-3.mp4"
            },

            {
                type: "pdf",
                title: "Lecture 1 PDF",
                url:
                    "7. Strings.pdf"
            },

            {
                type: "pdf",
                title: "Lecture 2 PDF",
                url:
                    "pdf/JAILOR.pdf"
            },

            {
                type: "pdf",
                title: "Lecture 3 PDF",
                url:
                    "3.pdf"
            },

            {
                type: "live",
                title: "Live Class",
                url: "#"
            }

        ]

    },


    /* =====================================================
       CSIR NET
       2026
       BATCH 2
       LINEAR ALGEBRA

       SAME SUBJECT
       BUT DIFFERENT BATCH

       Therefore material can be completely different.
    ===================================================== */

    "csir-net-2026-batch2-linear-algebra": {

        exam: "CSIR NET",

        batch: "Batch 2",

        year: "2026",

        subject: "Linear Algebra",

        title: "Linear Algebra",

        description:
            "CSIR NET 2026 - Batch 2 - Complete Linear Algebra Course",

        testId: "linear-algebra",

        contents: [

            {
                type: "video",
                title: "Batch 2 - Lecture 1",
                url:
                    "https://www.youtube.com/embed/EnLKN-6ocsE"
            },

            {
                type: "video",
                title: "Batch 2 - Lecture 2",
                url:
                    "https://www.youtube.com/embed/EnLKN-6ocsE"
            },

            {
                type: "pdf",
                title: "Batch 2 Linear Algebra Notes",
                url:
                    "pdf/linear-algebra-notes.pdf"
            },

            {
                type: "pdf",
                title: "Batch 2 Lecture Notes",
                url:
                    "ch03.pdf"
            },

            {
                type: "live",
                title: "Batch 2 Live Class",
                url: "#"
            }

        ]

    },


    /* =====================================================
       CSIR NET
       2026
       BATCH 2
       CALCULUS
    ===================================================== */

    "csir-net-2026-batch2-calculus": {

        exam: "CSIR NET",

        batch: "Batch 2",

        year: "2026",

        subject: "Calculus",

        title: "Calculus",

        description:
            "CSIR NET 2026 - Batch 2 - Complete Calculus Course",

        testId: "calculus",

        contents: [

            {
                type: "video",
                title: "Batch 2 - Lecture 1",
                url:
                    "https://www.youtube.com/embed/hhjuLjGMxgw"
            },

            {
                type: "local-video",
                title: "Batch 2 - Lecture 2",
                url:
                    "./videos/calculus-lecture-2.mp4"
            },

            {
                type: "pdf",
                title: "Batch 2 Chapter 3 PDF",
                url:
                    "7. Strings.pdf"
            },

            {
                type: "live",
                title: "Batch 2 Live Class",
                url: "#"
            }

        ]

    },


    /* =====================================================
       IIT JAM
       2026
       BATCH 1
       LINEAR ALGEBRA
    ===================================================== */

    "iit-jam-2026-batch1-linear-algebra": {

        exam: "IIT JAM",

        batch: "Batch 1",

        year: "2026",

        subject: "Linear Algebra",

        title: "Linear Algebra",

        description:
            "IIT JAM 2026 - Batch 1 - Complete Linear Algebra Course",

        testId: "linear-algebra",

        contents: [

            {
                type: "video",
                title: "IIT JAM Lecture 1",
                url:
                    "https://www.youtube.com/embed/EnLKN-6ocsE"
            },

            {
                type: "pdf",
                title: "IIT JAM Linear Algebra Notes",
                url:
                    "pdf/linear-algebra-notes.pdf"
            },

            {
                type: "live",
                title: "IIT JAM Live Class",
                url: "#"
            }

        ]

    },


    /* =====================================================
       IIT JAM
       2026
       BATCH 1
       CALCULUS
    ===================================================== */

    "iit-jam-2026-batch1-calculus": {

        exam: "IIT JAM",

        batch: "Batch 1",

        year: "2026",

        subject: "Calculus",

        title: "Calculus",

        description:
            "IIT JAM 2026 - Batch 1 - Complete Calculus Course",

        testId: "calculus",

        contents: [

            {
                type: "video",
                title: "IIT JAM Calculus Lecture 1",
                url:
                    "https://www.youtube.com/embed/dQw4w9WgXcQ"
            },

            {
                type: "local-video",
                title: "IIT JAM Calculus Lecture 2",
                url:
                    "./videos/calculus-lecture-2.mp4"
            },

            {
                type: "pdf",
                title: "IIT JAM Calculus Notes",
                url:
                    "ch03.pdf"
            },

            {
                type: "live",
                title: "IIT JAM Live Class",
                url: "#"
            }

        ]

    }

};


/* =========================================================
   DEVICE SETTINGS
   EVERYTHING BELOW THIS POINT IS YOUR EXISTING SYSTEM
========================================================= */

const MAX_DEVICES = 2;

const DEVICE_TIMEOUT =
    3 * 24 * 60 * 60 * 1000;


/* =========================================================
   DEVICE ID
========================================================= */

function getDeviceId() {

    let id =
        localStorage.getItem(
            "fjmcDeviceId"
        );


    if (!id) {

        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {

            id =
                "device-" +
                crypto.randomUUID();

        } else {

            id =
                "device-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2);
        }


        localStorage.setItem(
            "fjmcDeviceId",
            id
        );
    }


    return id;
}


const deviceId =
    getDeviceId();


/* =========================================================
   DEVICE TYPE
========================================================= */

function getDeviceType() {

    const userAgent =
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        "";


    const mobilePattern =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;


    if (
        mobilePattern.test(userAgent)
    ) {

        return "mobile";

    }


    return "desktop";
}


const currentDeviceType =
    getDeviceType();


console.log(
    "Current device type:",
    currentDeviceType
);


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let deviceHeartbeat = null;


/* =========================================================
   PAGE LOADING CONTROL
========================================================= */

function hidePageLoading() {

    const selectors = [

        "#pageLoading",
        "#loadingScreen",
        "#pageLoader",
        "#loadingOverlay",
        "#loader",
        ".page-loading",
        ".loading-screen",
        ".loading-overlay",
        ".page-loader",
        ".loader-overlay"

    ];


    selectors.forEach(
        function (selector) {

            const elements =
                document.querySelectorAll(
                    selector
                );


            elements.forEach(
                function (element) {

                    element.style.display =
                        "none";

                    element.style.visibility =
                        "hidden";

                    element.style.opacity =
                        "0";

                    element.style.pointerEvents =
                        "none";

                }
            );

        }
    );


    const possibleLoaders =
        document.querySelectorAll(
            "[id*='loading'], [id*='Loading'], [class*='loading'], [class*='Loading']"
        );


    possibleLoaders.forEach(
        function (element) {

            const text =
                (element.textContent || "")
                    .trim()
                    .toLowerCase();


            if (
                text.includes("page loading") ||
                text === "loading..." ||
                text === "loading"
            ) {

                element.style.display =
                    "none";

                element.style.visibility =
                    "hidden";

                element.style.opacity =
                    "0";

                element.style.pointerEvents =
                    "none";

            }

        }
    );

}


/* =========================================================
   HTML ELEMENTS
========================================================= */

const coursesContainer =
    document.getElementById(
        "coursesContainer"
    );


const studentName =
    document.getElementById(
        "studentName"
    );


const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    async function (user) {

        try {

            if (!user) {

                hidePageLoading();

                window.location.href =
                    "login.html";

                return;
            }


            currentUser =
                user;


            const email =
                (user.email || "")
                    .trim()
                    .toLowerCase();


            console.log(
                "Logged in:",
                email
            );


            const student =
                STUDENTS[email];


            if (!student) {

                console.error(
                    "Student not found:",
                    email
                );


                hidePageLoading();


                await signOut(
                    auth
                );


                window.location.href =
                    "login.html";


                return;
            }


            /* =============================================
               SESSION
            ============================================= */

            sessionStorage.setItem(
                "loggedInStudent",
                email
            );


            sessionStorage.setItem(
                "firebaseUID",
                user.uid
            );


            /* =============================================
               STUDENT NAME
            ============================================= */

            if (studentName) {

                studentName.textContent =
                    "Welcome, " +
                    student.name;

            }


            /* =============================================
               DEVICE CHECK
            ============================================= */

            const allowed =
                await registerDevice(
                    user
                );


            console.log(
                "Device allowed:",
                allowed
            );


            if (!allowed) {

                hidePageLoading();

                await signOut(
                    auth
                );

                return;
            }


            /* =============================================
               SHOW COURSES
            ============================================= */

            showStudentCourses(
                student
            );


            hidePageLoading();


            startDeviceHeartbeat();


        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );


            hidePageLoading();


            alert(
                "Dashboard could not be loaded. Please login again."
            );


            try {

                await signOut(
                    auth
                );

            } catch (signOutError) {

                console.error(
                    "Sign out error:",
                    signOutError
                );

            }


            window.location.href =
                "login.html";

        }

    }
);


/* =========================================================
   DEVICES COLLECTION
========================================================= */

function devicesCollection(user) {

    return collection(
        db,
        "users",
        user.uid,
        "devices"
    );

}


/* =========================================================
   COUNT ACTIVE DEVICE OF SPECIFIC TYPE
========================================================= */

async function countActiveDeviceType(
    user,
    type,
    now,
    excludeDeviceId = null
) {

    const devices =
        await getDocs(
            devicesCollection(user)
        );


    let count = 0;


    devices.forEach(
        function (deviceDoc) {

            if (
                excludeDeviceId &&
                deviceDoc.id ===
                excludeDeviceId
            ) {

                return;
            }


            const data =
                deviceDoc.data();


            const expiry =
                Number(
                    data.expiresAt || 0
                );


            const deviceType =
                data.deviceType ||
                "";


            if (
                data.active === true &&
                expiry > now &&
                deviceType === type
            ) {

                count++;

            }

        }
    );


    return count;

}


/* =========================================================
   COUNT ALL ACTIVE DEVICES
========================================================= */

async function countAllActiveDevices(
    user,
    now,
    excludeDeviceId = null
) {

    const devices =
        await getDocs(
            devicesCollection(user)
        );


    let count = 0;


    devices.forEach(
        function (deviceDoc) {

            if (
                excludeDeviceId &&
                deviceDoc.id ===
                excludeDeviceId
            ) {

                return;
            }


            const data =
                deviceDoc.data();


            const expiry =
                Number(
                    data.expiresAt || 0
                );


            if (
                data.active === true &&
                expiry > now
            ) {

                count++;

            }

        }
    );


    return count;

}


/* =========================================================
   REGISTER / CHECK DEVICE
========================================================= */

async function registerDevice(user) {

    try {

        const deviceRef =
            doc(
                db,
                "users",
                user.uid,
                "devices",
                deviceId
            );


        const now =
            Date.now();


        const currentDevice =
            await getDoc(
                deviceRef
            );


        if (
            currentDevice.exists()
        ) {

            const data =
                currentDevice.data();


            const expiresAt =
                Number(
                    data.expiresAt || 0
                );


            const savedDeviceType =
                data.deviceType ||
                currentDeviceType;


            if (
                expiresAt > now
            ) {

                await setDoc(
                    deviceRef,
                    {
                        email: user.email,
                        active: true,
                        lastSeen: now,
                        deviceType:
                            savedDeviceType
                    },
                    {
                        merge: true
                    }
                );


                return true;
            }


            const sameTypeDevices =
                await countActiveDeviceType(
                    user,
                    currentDeviceType,
                    now,
                    deviceId
                );


            if (
                sameTypeDevices >= 1
            ) {

                showDeviceLimitMessage();

                return false;
            }


            const allActiveDevices =
                await countAllActiveDevices(
                    user,
                    now,
                    deviceId
                );


            if (
                allActiveDevices >=
                MAX_DEVICES
            ) {

                showDeviceLimitMessage();

                return false;
            }


            await setDoc(
                deviceRef,
                {
                    email: user.email,

                    active: true,

                    deviceType:
                        currentDeviceType,

                    lastSeen: now,

                    expiresAt:
                        now +
                        DEVICE_TIMEOUT,

                    renewedAt:
                        serverTimestamp()
                },
                {
                    merge: true
                }
            );


            return true;
        }


        const sameTypeDevices =
            await countActiveDeviceType(
                user,
                currentDeviceType,
                now
            );


        if (
            sameTypeDevices >= 1
        ) {

            showDeviceLimitMessage();

            return false;
        }


        const allActiveDevices =
            await countAllActiveDevices(
                user,
                now
            );


        if (
            allActiveDevices >=
            MAX_DEVICES
        ) {

            showDeviceLimitMessage();

            return false;
        }


        await setDoc(
            deviceRef,
            {
                email: user.email,

                active: true,

                deviceType:
                    currentDeviceType,

                lastSeen: now,

                expiresAt:
                    now +
                    DEVICE_TIMEOUT,

                createdAt:
                    serverTimestamp()
            }
        );


        console.log(
            "New device registered:",
            currentDeviceType
        );


        return true;


    } catch (error) {

        console.error(
            "Device registration error:",
            error
        );


        hidePageLoading();


        alert(
            "Device verification failed.\n\n" +
            "Please check your internet connection and try again."
        );


        return false;
    }

}


/* =========================================================
   DEVICE LIMIT MESSAGE
========================================================= */

function showDeviceLimitMessage() {

    const message =
        document.getElementById(
            "deviceLimitMessage"
        );


    const text =
        "Maximum 2 devices are already active for this account.";


    if (message) {

        message.textContent =
            text;


        message.style.display =
            "block";


        return;
    }


    alert(
        text
    );

}


/* =========================================================
   HEARTBEAT
========================================================= */

function startDeviceHeartbeat() {

    if (
        deviceHeartbeat
    ) {

        clearInterval(
            deviceHeartbeat
        );

    }


    updateDeviceHeartbeat();


    deviceHeartbeat =
        setInterval(
            updateDeviceHeartbeat,
            2 * 60 * 1000
        );

}


/* =========================================================
   UPDATE DEVICE HEARTBEAT
========================================================= */

async function updateDeviceHeartbeat() {

    if (!currentUser) {
        return;
    }


    try {

        const deviceRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "devices",
                deviceId
            );


        const snapshot =
            await getDoc(
                deviceRef
            );


        if (
            !snapshot.exists()
        ) {

            return;
        }


        const data =
            snapshot.data();


        const now =
            Date.now();


        const expiresAt =
            Number(
                data.expiresAt || 0
            );


        if (
            expiresAt > 0 &&
            expiresAt <= now
        ) {

            console.log(
                "Device reservation expired."
            );


            if (
                deviceHeartbeat
            ) {

                clearInterval(
                    deviceHeartbeat
                );


                deviceHeartbeat =
                    null;
            }


            hidePageLoading();


            alert(
                "Your device access has expired. Please login again."
            );


            await signOut(
                auth
            );


            window.location.href =
                "login.html";


            return;
        }


        await updateDoc(
            deviceRef,
            {
                lastSeen: now,
                active: true
            }
        );


    } catch (error) {

        console.error(
            "Heartbeat error:",
            error
        );

    }

}


/* =========================================================
   SHOW STUDENT COURSES

   NOW SHOWS:

   Exam
   Batch
   Year
   Subject
   Description
   Course Material
========================================================= */

function showStudentCourses(
    student
) {

    if (!coursesContainer) {

        console.error(
            "coursesContainer not found"
        );

        hidePageLoading();

        return;
    }


    coursesContainer.innerHTML =
        "";


    if (
        !student.courses ||
        student.courses.length === 0
    ) {

        coursesContainer.innerHTML = `
            <div class="no-course">
                <h3>No Course Assigned</h3>
                <p>Please contact FJMC Academy.</p>
            </div>
        `;


        hidePageLoading();

        return;
    }


    /* =====================================================
       STUDENT BATCH / EXAM INFORMATION
    ===================================================== */

    const studentInfo =
        document.createElement(
            "div"
        );


    studentInfo.className =
        "student-course-info";


    studentInfo.innerHTML = `

        <div style="
            margin-bottom:20px;
            padding:18px;
            border-radius:12px;
            background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.12);
        ">

            <h3 style="
                margin:0 0 12px 0;
            ">
                ${student.exam}
            </h3>

            <p style="
                margin:5px 0;
            ">
                <strong>Batch:</strong>
                ${student.batch}
            </p>

            <p style="
                margin:5px 0;
            ">
                <strong>Year:</strong>
                ${student.year}
            </p>

        </div>

    `;


    coursesContainer.appendChild(
        studentInfo
    );


    /* =====================================================
       COURSES
    ===================================================== */

    student.courses.forEach(
        function (courseId) {

            const course =
                COURSES[courseId];


            if (!course) {

                console.warn(
                    "Course not found:",
                    courseId
                );

                return;
            }


            const courseCard =
                document.createElement(
                    "div"
                );


            courseCard.className =
                "course-card";


            let contentHTML =
                "";


            course.contents.forEach(
                function (content) {

                    if (
                        content.type ===
                        "video"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button video-button"
                                data-type="youtube"
                                data-url="${encodeURIComponent(content.url)}"
                                data-title="${encodeURIComponent(content.title)}">
                                ▶ ${content.title}
                            </button>
                        `;
                    }


                    else if (
                        content.type ===
                        "local-video"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button video-button"
                                data-type="local"
                                data-url="${encodeURIComponent(content.url)}"
                                data-title="${encodeURIComponent(content.title)}">
                                ▶ ${content.title}
                            </button>
                        `;
                    }


                    else if (
                        content.type ===
                        "pdf"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button pdf-button"
                                data-type="pdf"
                                data-url="${encodeURIComponent(content.url)}"
                                data-title="${encodeURIComponent(content.title)}">
                                📄 ${content.title}
                            </button>
                        `;
                    }


                    else if (
                        content.type ===
                        "live"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button live-button"
                                data-type="live"
                                data-url="${encodeURIComponent(content.url)}">
                                🔴 ${content.title}
                            </button>
                        `;
                    }

                }
            );


            courseCard.innerHTML = `

                <div class="course-title">

                    <div style="
                        margin-bottom:10px;
                        font-size:13px;
                        opacity:.85;
                    ">

                        ${course.exam}
                        &nbsp;•&nbsp;
                        ${course.batch}
                        &nbsp;•&nbsp;
                        ${course.year}

                    </div>


                    <h3>
                        ${course.title}
                    </h3>


                    <p>
                        ${course.description}
                    </p>

                </div>


                <div class="course-content">

                    ${contentHTML}

                </div>


                <div style="
                    margin-top:15px;
                    padding-top:15px;
                    border-top:1px solid rgba(255,255,255,.15);
                ">

                    <button
                        class="fjmc-test-button"
                        data-test-course="${
                            course.testId || courseId
                        }"
                    >

                        📝 ${course.title} Test

                    </button>

                </div>

            `;


            coursesContainer.appendChild(
                courseCard
            );

        }
    );


    /* =====================================================
       TEST BUTTON
    ===================================================== */

    const testButtons =
        coursesContainer.querySelectorAll(
            ".fjmc-test-button"
        );


    testButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const courseId =
                        button.dataset.testCourse;


                    window.location.href =
                        "test.html?course=" +
                        encodeURIComponent(
                            courseId
                        );

                }
            );

        }
    );


    /* =====================================================
       CONTENT BUTTONS
    ===================================================== */

    const buttons =
        coursesContainer.querySelectorAll(
            ".content-button"
        );


    buttons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const type =
                        button.dataset.type;


                    const url =
                        decodeURIComponent(
                            button.dataset.url
                        );


                    const title =
                        button.dataset.title
                            ? decodeURIComponent(
                                button.dataset.title
                            )
                            : "";


                    if (
                        type ===
                        "youtube"
                    ) {

                        openYouTubeVideo(
                            url,
                            title
                        );
                    }


                    else if (
                        type ===
                        "local"
                    ) {

                        openLocalVideo(
                            url,
                            title
                        );
                    }


                    else if (
                        type ===
                        "pdf"
                    ) {

                        openPDFViewer(
                            url,
                            title
                        );
                    }


                    else if (
                        type ===
                        "live"
                    ) {

                        openLiveClass(
                            url
                        );
                    }

                }
            );

        }
    );


    hidePageLoading();

}


/* =========================================================
   CREATE MODAL
========================================================= */

function createModal() {

    let modal =
        document.getElementById(
            "fjmcContentModal"
        );


    if (modal) {
        return modal;
    }


    modal =
        document.createElement(
            "div"
        );


    modal.id =
        "fjmcContentModal";


    modal.innerHTML = `

        <div
            id="fjmcModalOverlay"
            style="
                position:fixed;
                inset:0;
                background:rgba(0,0,0,.85);
                z-index:999999;
                display:flex;
                align-items:center;
                justify-content:center;
                padding:15px;
            "
        >

            <div
                style="
                    width:100%;
                    max-width:1100px;
                    max-height:95vh;
                    background:#111;
                    border-radius:12px;
                    overflow:hidden;
                    position:relative;
                    display:flex;
                    flex-direction:column;
                "
            >

                <div
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        padding:10px 15px;
                        background:#182033;
                        color:white;
                    "
                >

                    <strong
                        id="fjmcModalTitle">
                    </strong>


                    <button
                        id="fjmcModalClose"
                        style="
                            border:0;
                            background:#e63946;
                            color:white;
                            width:38px;
                            height:38px;
                            border-radius:50%;
                            font-size:20px;
                            cursor:pointer;
                        "
                    >
                        ×
                    </button>

                </div>


                <div
                    id="fjmcModalBody"
                    style="
                        flex:1;
                        overflow:auto;
                        background:#111;
                    "
                >
                </div>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    document
        .getElementById(
            "fjmcModalClose"
        )
        .addEventListener(
            "click",
            closeModal
        );


    document
        .getElementById(
            "fjmcModalOverlay"
        )
        .addEventListener(
            "click",
            function (event) {

                if (
                    event.target.id ===
                    "fjmcModalOverlay"
                ) {

                    closeModal();

                }

            }
        );


    return modal;

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

    const watermark =
        document.getElementById(
            "fjmcScreenWatermark"
        );


    if (watermark) {

        watermark.remove();

    }


    const modal =
        document.getElementById(
            "fjmcContentModal"
        );


    if (modal) {

        modal.remove();

    }

}


/* =========================================================
   YOUTUBE VIDEO
========================================================= */

function openYouTubeVideo(
    url,
    title
) {

    const modal =
        createModal();


    const modalTitle =
        document.getElementById(
            "fjmcModalTitle"
        );


    const body =
        document.getElementById(
            "fjmcModalBody"
        );


    modalTitle.textContent =
        title;


    body.innerHTML = `

        <div
            style="
                width:100%;
                aspect-ratio:16/9;
                background:#000;
            "
        >

            <iframe
                src="${url}"
                title="${title}"
                style="
                    width:100%;
                    height:100%;
                    border:0;
                "
                allow="
                    accelerometer;
                    autoplay;
                    
                    encrypted-media;
                    gyroscope;
                    picture-in-picture
                    
                "
                allowfullscreen>
            </iframe>

        </div>
    `;

}


/* =========================================================
   LOCAL VIDEO
========================================================= */

function openLocalVideo(
    url,
    title
) {

    const modal =
        createModal();


    const modalTitle =
        document.getElementById(
            "fjmcModalTitle"
        );


    const body =
        document.getElementById(
            "fjmcModalBody"
        );


    modalTitle.textContent =
        title;


    body.innerHTML = `

        <video
            controls
            controlsList="nodownload"
            disablePictureInPicture
            playsinline
            style="
                width:100%;
                max-height:80vh;
                display:block;
                background:#000;
            "
        >

            <source
                src="${url}"
                type="video/mp4"
            >

            Your browser does not support video.

        </video>
    `;

}


/* =========================================================
   LIVE CLASS
========================================================= */

function openLiveClass(
    url
) {

    if (
        !url ||
        url === "#"
    ) {

        alert(
            "Live class link is not available yet."
        );

        return;
    }


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

}


/* =========================================================
   PDF VIEWER
========================================================= */

async function openPDFViewer(
    url,
    title
) {

    const modal =
        createModal();


    const modalTitle =
        document.getElementById(
            "fjmcModalTitle"
        );


    const body =
        document.getElementById(
            "fjmcModalBody"
        );


    modalTitle.textContent =
        title;


    body.innerHTML = `

        <div
            id="pdfLoading"
            style="
                color:white;
                text-align:center;
                padding:30px;
            "
        >
            Loading PDF...
        </div>


        <div
            id="pdfPages"
            style="
                padding:15px;
                text-align:center;
                user-select:none;
                -webkit-user-select:none;
                -webkit-touch-callout:none;
            "
        >
        </div>
    `;


    try {

        if (
            typeof pdfjsLib ===
            "undefined"
        ) {

            throw new Error(
                "PDF.js is not loaded."
            );

        }


        pdfjsLib
            .GlobalWorkerOptions
            .workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


        const pdf =
            await pdfjsLib.getDocument(
                url
            ).promise;


        const pages =
            document.getElementById(
                "pdfPages"
            );


        const loading =
            document.getElementById(
                "pdfLoading"
            );


        if (loading) {
            loading.remove();
        }


        const oldWatermark =
            document.getElementById(
                "fjmcScreenWatermark"
            );


        if (oldWatermark) {

            oldWatermark.remove();

        }


        const watermark =
            document.createElement(
                "div"
            );


        watermark.id =
            "fjmcScreenWatermark";


        watermark.textContent =
            "FJMC ACADEMY";


        watermark.style.position =
            "fixed";


        watermark.style.left =
            "50%";


        watermark.style.top =
            "50%";


        watermark.style.transform =
            "translate(-50%, -50%) rotate(-20deg)";


        watermark.style.color =
            "rgba(0, 0, 0, 0.50)";


        watermark.style.fontSize =
            "24px";


        watermark.style.fontWeight =
            "800";


        watermark.style.letterSpacing =
            "2px";


        watermark.style.whiteSpace =
            "nowrap";


        watermark.style.zIndex =
            "1000000";


        watermark.style.pointerEvents =
            "none";


        watermark.style.userSelect =
            "none";


        watermark.style.webkitUserSelect =
            "none";


        watermark.style.webkitTouchCallout =
            "none";


        document.body.appendChild(
            watermark
        );


        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            const page =
                await pdf.getPage(
                    pageNumber
                );


            const viewport =
                page.getViewport({
                    scale: 1.4
                });


            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.style.position =
                "relative";


            wrapper.style.display =
                "inline-block";


            wrapper.style.margin =
                "0 auto 20px auto";


            wrapper.style.maxWidth =
                "100%";


            wrapper.style.background =
                "#ffffff";


            wrapper.style.overflow =
                "hidden";


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                viewport.width;


            canvas.height =
                viewport.height;


            canvas.style.maxWidth =
                "100%";


            canvas.style.height =
                "auto";


            canvas.style.display =
                "block";


            canvas.style.userSelect =
                "none";


            canvas.style.webkitUserSelect =
                "none";


            wrapper.appendChild(
                canvas
            );


            pages.appendChild(
                wrapper
            );


            const context =
                canvas.getContext(
                    "2d"
                );


            await page.render({

                canvasContext:
                    context,

                viewport:
                    viewport

            }).promise;

        }


        pages.style.userSelect =
            "none";


        pages.style.webkitUserSelect =
            "none";


        pages.style.webkitTouchCallout =
            "none";


    } catch (error) {

        console.error(
            "PDF error:",
            error
        );


        const watermark =
            document.getElementById(
                "fjmcScreenWatermark"
            );


        if (watermark) {

            watermark.remove();

        }


        body.innerHTML = `

            <div
                style="
                    color:white;
                    padding:30px;
                    text-align:center;
                "
            >

                <h3>
                    PDF could not be opened
                </h3>

                <p>
                    ${error.message || ""}
                </p>

            </div>

        `;

    }

}


/* =========================================================
   LOGOUT

   LOGOUT DOES NOT FREE DEVICE SLOT
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            try {

                if (
                    deviceHeartbeat
                ) {

                    clearInterval(
                        deviceHeartbeat
                    );


                    deviceHeartbeat =
                        null;
                }


                sessionStorage.removeItem(
                    "loggedInStudent"
                );


                sessionStorage.removeItem(
                    "firebaseUID"
                );


                await signOut(
                    auth
                );


            } catch (error) {

                console.error(
                    "Sign out:",
                    error
                );

            }


            window.location.href =
                "login.html";

        }
    );

}


/* =========================================================
   BASIC CONTENT PROTECTION
========================================================= */

document.addEventListener(
    "contextmenu",
    function (event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "copy",
    function (event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "cut",
    function (event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "selectstart",
    function (event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "keydown",
    function (event) {

        const key =
            event.key.toLowerCase();


        if (
            (event.ctrlKey ||
                event.metaKey) &&
            (
                key === "s" ||
                key === "p" ||
                key === "u" ||
                key === "c"
            )
        ) {

            event.preventDefault();

        }

    }
);


/* =========================================================
   INITIAL LOADING SAFETY
========================================================= */

window.addEventListener(
    "load",
    function () {

        setTimeout(
            function () {

                if (
                    currentUser &&
                    coursesContainer &&
                    coursesContainer.children.length > 0
                ) {

                    hidePageLoading();

                }

            },
            300
        );

    }
);
