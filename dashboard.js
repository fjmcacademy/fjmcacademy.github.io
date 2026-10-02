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

/* =========================================================
   STUDENT / COURSE DATA

   Managed from admin.html -> Firestore.
   Dashboard is read-only for assignments/content.
========================================================= */

let STUDENTS = {};
let COURSES = {};

function studentDocId(email) {
    return email.trim().toLowerCase().replaceAll("/", "_");
}

async function loadDashboardData(email) {
    const studentSnap = await getDoc(
        doc(db, "students", studentDocId(email))
    );

    if (!studentSnap.exists()) {
        return null;
    }

    const student = studentSnap.data();
    const courseIds = Array.isArray(student.courses) ? student.courses : [];

    const courseEntries = await Promise.all(
        courseIds.map(async courseId => {
            const snap = await getDoc(doc(db, "courses", courseId));
            return snap.exists() ? [courseId, snap.data()] : null;
        })
    );

    COURSES = {};
    courseEntries.filter(Boolean).forEach(([id, course]) => {
        COURSES[id] = course;
    });

    STUDENTS = { [email]: student };
    return student;
}


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

const testSeriesBtn =
    document.getElementById("testSeriesBtn");

if (testSeriesBtn) {
    testSeriesBtn.addEventListener("click", function () {
        window.location.href = "test-series.html";
    });
}


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
                await loadDashboardData(email);


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

/* =========================================================
   SHOW STUDENT COURSES
   IMPORTANT: Existing Exam / Batch / Year information stays.

   Flow:
   Course button
      -> Video / PDF / Test
      -> Lecture-wise list
========================================================= */

function showStudentCourses(student) {

    if (!coursesContainer) {
        console.error("coursesContainer not found");
        hidePageLoading();
        return;
    }

    coursesContainer.innerHTML = "";

    if (!student.courses || student.courses.length === 0) {
        coursesContainer.innerHTML = `
            <div class="no-course">
                <h3>No Course Assigned</h3>
                <p>Please contact FJMC Academy.</p>
            </div>
        `;
        hidePageLoading();
        return;
    }

    /* Keep existing Exam / Batch / Year information exactly visible. */
    const studentInfo = document.createElement("div");
    studentInfo.className = "student-course-info";
    studentInfo.innerHTML = `
        <div style="
            margin-bottom:20px;
            padding:18px;
            border-radius:12px;
            background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.12);
        ">
            <h3 style="margin:0 0 12px 0;">${escapeDashboardHTML(student.exam || "")}</h3>
            <p style="margin:5px 0;"><strong>Batch:</strong> ${escapeDashboardHTML(student.batch || "")}</p>
            <p style="margin:5px 0;"><strong>Year:</strong> ${escapeDashboardHTML(student.year || "")}</p>
        </div>
    `;
    coursesContainer.appendChild(studentInfo);

    student.courses.forEach(function(courseId) {
        const course = COURSES[courseId];
        if (!course) {
            console.warn("Course not found:", courseId);
            return;
        }

        const courseCard = document.createElement("div");
        courseCard.className = "course-card fjmc-course-card-new";

        const contents = Array.isArray(course.contents) ? course.contents : [];
        const groups = groupCourseContentsByLecture(contents);

        courseCard.innerHTML = `
            <div class="course-title fjmc-course-main-button" role="button" tabindex="0">
                <div style="margin-bottom:10px;font-size:13px;opacity:.85;">
                    ${escapeDashboardHTML(course.exam || student.exam || "")}
                    &nbsp;•&nbsp;
                    ${escapeDashboardHTML(course.batch || student.batch || "")}
                    &nbsp;•&nbsp;
                    ${escapeDashboardHTML(course.year || student.year || "")}
                </div>
                <h3>${escapeDashboardHTML(course.title || course.subject || courseId)}</h3>
                <p>${escapeDashboardHTML(course.description || "")}</p>
                <div class="fjmc-course-click-hint">Open Course ›</div>
            </div>

            <div class="fjmc-course-menu" hidden>
                <button class="fjmc-category-button" data-category="video">🎥 Video / Lecture</button>
                <button class="fjmc-category-button" data-category="pdf">📄 PDF / Notes</button>
                <button class="fjmc-category-button" data-category="test">📝 Test</button>
                ${groups.live.length ? '<button class="fjmc-category-button" data-category="live">🔴 Live Class</button>' : ''}
                <div class="fjmc-lecture-panel" hidden></div>
            </div>
        `;

        coursesContainer.appendChild(courseCard);

        const mainButton = courseCard.querySelector(".fjmc-course-main-button");
        const menu = courseCard.querySelector(".fjmc-course-menu");
        const lecturePanel = courseCard.querySelector(".fjmc-lecture-panel");

        const toggleCourse = function() {
            const willOpen = menu.hidden;
            menu.hidden = !willOpen;
            if (!willOpen) {
                lecturePanel.hidden = true;
                lecturePanel.innerHTML = "";
            }
        };

        mainButton.addEventListener("click", toggleCourse);
        mainButton.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCourse();
            }
        });

        courseCard.querySelectorAll(".fjmc-category-button").forEach(function(button) {
            button.addEventListener("click", async function() {
                const category = button.dataset.category;
                await openCourseCategory(course, courseId, category, lecturePanel);
            });
        });
    });
}

function escapeDashboardHTML(value) {
    return String(value == null ? "" : value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function lectureNumberFromTitle(title, fallback) {
    const match = String(title || "").match(/(?:lecture|lec|lesson)\s*[-_ ]*([0-9]+)/i);
    return match ? String(Number(match[1])) : String(fallback);
}

function groupCourseContentsByLecture(contents) {
    const result = { video: {}, pdf: {}, live: [] };
    let videoIndex = 1;
    let pdfIndex = 1;

    contents.forEach(function(content) {
        if (!content) return;
        if (content.type === "video" || content.type === "local-video") {
            const no = lectureNumberFromTitle(content.title, videoIndex++);
            (result.video[no] ||= []).push(content);
        } else if (content.type === "pdf") {
            const no = lectureNumberFromTitle(content.title, pdfIndex++);
            (result.pdf[no] ||= []).push(content);
        } else if (content.type === "live") {
            result.live.push(content);
        }
    });

    return result;
}

async function loadManagedTestForCourse(course) {
    const testId = course.testId || course.id || course.subject || course.title;
    try {
        const snap = await getDoc(doc(db, "tests", testId));
        if (snap.exists()) return snap.data();
    } catch (error) {
        console.warn("Could not load managed test:", error);
    }

    try {
        const module = await import("./test-default-data.js");
        return module.TESTS[testId] || null;
    } catch (error) {
        console.warn("Could not load default test data:", error);
        return null;
    }
}


function resolveContentUrl(url) {
    const raw = String(url || '').trim();
    if (!raw || raw === '#') return '';
    try {
        return new URL(raw, document.baseURI).href;
    } catch (_) {
        return raw;
    }
}

function youtubeEmbedUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, document.baseURI);
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/embed/')) return u.href;
            const id = u.searchParams.get('v');
            if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
        }
        if (u.hostname === 'youtu.be') {
            const id = u.pathname.slice(1).split('/')[0];
            if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
        }
    } catch (_) {}
    return raw;
}

function lectureEntriesForTest(testData) {
    if (!testData || !testData.lectures) return [];
    return Object.entries(testData.lectures).sort(function(a, b) {
        return Number(a[0]) - Number(b[0]);
    });
}

async function openCourseCategory(course, courseId, category, panel) {
    panel.hidden = false;
    panel.innerHTML = `<div class="fjmc-lecture-loading">Loading...</div>`;

    const contents = Array.isArray(course.contents) ? course.contents : [];
    const groups = groupCourseContentsByLecture(contents);

    if (category === "live") {
        panel.innerHTML = "";
        groups.live.forEach(function(content) {
            const button = document.createElement("button");
            button.className = "fjmc-lecture-button live-button";
            button.textContent = "🔴 " + (content.title || "Live Class");
            button.addEventListener("click", function() {
                const url = content.url || "#";
                if (url && url !== "#") window.open(url, "_blank", "noopener");
                else alert("Live class link is not available yet.");
            });
            panel.appendChild(button);
        });
        return;
    }

    if (category === "video" || category === "pdf") {
        const map = groups[category];
        const lectureNumbers = Object.keys(map).sort((a, b) => Number(a) - Number(b));
        panel.innerHTML = "";

        if (!lectureNumbers.length) {
            panel.innerHTML = `<div class="fjmc-empty">No ${category === "video" ? "video lectures" : "PDF notes"} available.</div>`;
            return;
        }

        lectureNumbers.forEach(function(no) {
            const lectureButton = document.createElement("button");
            lectureButton.className = "fjmc-lecture-button";
            lectureButton.textContent = `Lecture ${no}`;
            lectureButton.addEventListener("click", function() {
                const items = map[no] || [];
                if (!items.length) return;
                const content = items[0];
                const title = content.title || `Lecture ${no}`;
                const url = resolveContentUrl(content.url || "");
                if (category === "video") {
                    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
                    if (content.type === "local-video" || !isYouTube) openLocalVideo(url, title);
                    else openYouTubeVideo(youtubeEmbedUrl(url), title);
                } else {
                    // Open the assigned PDF directly. This avoids PDF.js/CORS issues
                    // with Firebase Storage and external PDF URLs.
                    window.open(url, "_blank", "noopener,noreferrer");
                }
            });
            panel.appendChild(lectureButton);

            /* If multiple files share the same lecture, show each item underneath. */
            if (map[no].length > 1) {
                map[no].slice(1).forEach(function(content) {
                    const extra = document.createElement("button");
                    extra.className = "fjmc-lecture-subbutton";
                    extra.textContent = content.title || `Lecture ${no}`;
                    extra.addEventListener("click", function() {
                        if (category === "video") {
                            const extraUrl = resolveContentUrl(content.url);
                            const isYouTube = /youtube\.com|youtu\.be/i.test(extraUrl);
                            if (content.type === "local-video" || !isYouTube) openLocalVideo(extraUrl, content.title);
                            else openYouTubeVideo(youtubeEmbedUrl(extraUrl), content.title);
                        } else {
                            window.open(resolveContentUrl(content.url), "_blank", "noopener,noreferrer");
                        }
                    });
                    panel.appendChild(extra);
                });
            }
        });
        return;
    }

    if (category === "test") {
        const testData = await loadManagedTestForCourse(course);
        const lectures = lectureEntriesForTest(testData);
        panel.innerHTML = "";

        if (!lectures.length) {
            /* Preserve the old single-course test as a fallback. */
            const fallback = document.createElement("button");
            fallback.className = "fjmc-lecture-button";
            fallback.textContent = "📝 Open Test";
            fallback.addEventListener("click", function() {
                window.location.href = "test.html?course=" + encodeURIComponent(course.testId || courseId);
            });
            panel.appendChild(fallback);
            return;
        }

        lectures.forEach(function([lectureId, lecture]) {
            const lectureButton = document.createElement("button");
            lectureButton.className = "fjmc-lecture-button";
            lectureButton.textContent = `Lecture ${lectureId}`;
            lectureButton.addEventListener("click", function() {
                const tests = lecture && lecture.tests ? lecture.tests : {};
                const testNumbers = Object.keys(tests).sort((a, b) => Number(a) - Number(b));
                const current = panel.querySelector(`.fjmc-test-list[data-lecture="${lectureId}"]`);
                if (current) {
                    current.remove();
                    return;
                }
                const list = document.createElement("div");
                list.className = "fjmc-test-list";
                list.dataset.lecture = lectureId;
                if (!testNumbers.length) {
                    list.innerHTML = `<div class="fjmc-empty">No tests in this lecture.</div>`;
                } else {
                    testNumbers.forEach(function(testNumber) {
                        const test = tests[testNumber] || {};
                        const testButton = document.createElement("button");
                        testButton.className = "fjmc-test-item";
                        testButton.textContent = `📝 Test ${testNumber}${test.title ? " — " + test.title : ""}`;
                        testButton.addEventListener("click", function() {
                            window.location.href = "test.html?course=" + encodeURIComponent(course.testId || courseId) +
                                "&lecture=" + encodeURIComponent(lectureId) +
                                "&test=" + encodeURIComponent(testNumber);
                        });
                        list.appendChild(testButton);
                    });
                }
                lectureButton.insertAdjacentElement("afterend", list);
            });
            panel.appendChild(lectureButton);
        });
    }
}

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

    url = resolveContentUrl(url);
    if (!url) {
        alert("PDF link is not available.");
        return;
    }

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
            "rgba(0, 0, 0, 1.0)";


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
