/* =========================================================
   FJMC ACADEMY - STUDENT DASHBOARD
   DEVICE SYSTEM:
   1 MOBILE SLOT + 1 DESKTOP SLOT
   PHONE + TABLET = SAME MOBILE SLOT
   SLOT RESERVATION = 3 DAYS
   LOGOUT DOES NOT FREE SLOT
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

import { TESTS } from "./test-default-data.js";


/* =========================================================
   STUDENT / COURSE DATA
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

    const courseIds =
        Array.isArray(student.courses)
            ? student.courses
            : [];

    const courseEntries = await Promise.all(
        courseIds.map(async courseId => {

            const snap =
                await getDoc(
                    doc(db, "courses", courseId)
                );

            return snap.exists()
                ? [courseId, snap.data()]
                : null;
        })
    );

    COURSES = {};

    courseEntries
        .filter(Boolean)
        .forEach(([id, course]) => {
            COURSES[id] = course;
        });

    STUDENTS = {
        [email]: student
    };

    return student;
}


/* =========================================================
   DEVICE SETTINGS
========================================================= */

const DEVICE_TIMEOUT =
    3 * 24 * 60 * 60 * 1000;


/* =========================================================
   DEVICE TYPE
   PHONE + TABLET = MOBILE
   LAPTOP + DESKTOP = DESKTOP
========================================================= */

function getDeviceType() {

    const ua =
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        "";

    /*
       iPhone / iPad / Android phone / Android tablet
       are ALL treated as mobile.
    */

    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i
            .test(ua);

    if (isMobile) {
        return "mobile";
    }

    return "desktop";
}


const currentDeviceType =
    getDeviceType();


console.log(
    "FJMC DEVICE TYPE:",
    currentDeviceType
);


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let deviceHeartbeat = null;


/* =========================================================
   PAGE LOADING
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

    selectors.forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {

                element.style.display = "none";
                element.style.visibility = "hidden";
                element.style.opacity = "0";
                element.style.pointerEvents = "none";

            });

    });


    document
        .querySelectorAll(
            "[id*='loading'], [id*='Loading'], [class*='loading'], [class*='Loading']"
        )
        .forEach(element => {

            const text =
                (element.textContent || "")
                    .trim()
                    .toLowerCase();

            if (
                text.includes("page loading") ||
                text === "loading..." ||
                text === "loading"
            ) {

                element.style.display = "none";
                element.style.visibility = "hidden";
                element.style.opacity = "0";
                element.style.pointerEvents = "none";

            }

        });

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
    async function(user) {

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
                await loadDashboardData(
                    email
                );


            if (!student) {

                hidePageLoading();

                await signOut(auth);

                window.location.href =
                    "login.html";

                return;
            }


            /* =========================================
               SESSION
            ========================================= */

            sessionStorage.setItem(
                "loggedInStudent",
                email
            );

            sessionStorage.setItem(
                "firebaseUID",
                user.uid
            );


            /* =========================================
               STUDENT NAME
            ========================================= */

            if (studentName) {

                studentName.textContent =
                    "Welcome, " +
                    student.name;

            }


            /* =========================================
               DEVICE SLOT CHECK
            ========================================= */

            const allowed =
                await registerDeviceSlot(user);


            console.log(
                "DEVICE SLOT ALLOWED:",
                allowed
            );


            if (!allowed) {

                hidePageLoading();

                try {
                    await signOut(auth);
                } catch (e) {
                    console.error(e);
                }

                return;
            }


            /* =========================================
               SHOW COURSES
            ========================================= */

            await showStudentCourses(
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
                await signOut(auth);
            } catch (e) {
                console.error(e);
            }

            window.location.href =
                "login.html";
        }

    }
);


/* =========================================================
   DEVICE SLOT DOCUMENT
=========================================================

   users/{uid}/deviceSlots/mobile
   users/{uid}/deviceSlots/desktop

========================================================= */

function deviceSlotRef(user) {

    return doc(
        db,
        "users",
        user.uid,
        "deviceSlots",
        currentDeviceType
    );

}


/* =========================================================
   REGISTER DEVICE SLOT
========================================================= */

async function registerDeviceSlot(user) {

    try {

        const slotRef =
            deviceSlotRef(user);


        const now =
            Date.now();


        const snapshot =
            await getDoc(slotRef);


        /* =========================================
           SLOT DOES NOT EXIST
        ========================================= */

        if (!snapshot.exists()) {

            await setDoc(
                slotRef,
                {
                    uid: user.uid,

                    email:
                        user.email || "",

                    deviceType:
                        currentDeviceType,

                    active: true,

                    createdAt:
                        serverTimestamp(),

                    registeredAt:
                        now,

                    lastSeen:
                        now,

                    expiresAt:
                        now +
                        DEVICE_TIMEOUT
                }
            );


            console.log(
                "NEW DEVICE SLOT CREATED:",
                currentDeviceType
            );


            return true;
        }


        /* =========================================
           SLOT EXISTS
        ========================================= */

        const data =
            snapshot.data();


        const expiresAt =
            Number(
                data.expiresAt || 0
            );


        /* =========================================
           EXISTING SLOT STILL ACTIVE
        ========================================= */

        if (
            data.active === true &&
            expiresAt > now
        ) {

            /*
               IMPORTANT:

               We DO NOT replace the slot with
               another phone/tablet/laptop.

               Therefore:

               Phone -> Tablet = BLOCKED
               Tablet -> Phone = BLOCKED
               Laptop -> Desktop = BLOCKED
            */

            await updateDoc(
                slotRef,
                {
                    lastSeen: now
                }
            );


            /*
               Same physical browser/device can continue.
               But another device of same category cannot
               take this slot.
            */

            const savedDeviceId =
                data.deviceId || "";


            const localDeviceId =
                getStableDeviceId();


            /*
               First version of old system may not have
               deviceId. If absent, attach current device.
            */

            if (!savedDeviceId) {

                await updateDoc(
                    slotRef,
                    {
                        deviceId:
                            localDeviceId
                    }
                );

                return true;
            }


            if (
                savedDeviceId ===
                localDeviceId
            ) {

                return true;
            }


            showDeviceLimitMessage(
                currentDeviceType
            );

            return false;
        }


        /* =========================================
           3-DAY SLOT EXPIRED
           NEW DEVICE CAN TAKE SLOT
        ========================================= */

        await setDoc(
            slotRef,
            {
                uid: user.uid,

                email:
                    user.email || "",

                deviceType:
                    currentDeviceType,

                deviceId:
                    getStableDeviceId(),

                active: true,

                registeredAt:
                    now,

                lastSeen:
                    now,

                expiresAt:
                    now +
                    DEVICE_TIMEOUT,

                renewedAt:
                    serverTimestamp()
            }
        );


        console.log(
            "EXPIRED SLOT RENEWED:",
            currentDeviceType
        );


        return true;


    } catch (error) {

        console.error(
            "Device slot error:",
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
   STABLE DEVICE ID
========================================================= */

function getStableDeviceId() {

    let id =
        localStorage.getItem(
            "fjmcStableDeviceId"
        );


    if (!id) {

        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {

            id =
                "fjmc-" +
                crypto.randomUUID();

        } else {

            id =
                "fjmc-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2);
        }


        localStorage.setItem(
            "fjmcStableDeviceId",
            id
        );
    }


    return id;
}


/* =========================================================
   DEVICE LIMIT MESSAGE
========================================================= */

function showDeviceLimitMessage(type) {

    const message =
        document.getElementById(
            "deviceLimitMessage"
        );


    let text = "";


    if (type === "mobile") {

        text =
            "Mobile slot already active.\n\n" +
            "One phone OR one tablet can be used at a time.\n\n" +
            "The existing mobile device remains reserved for 3 days.\n" +
            "Logout does not free this slot.";

    } else {

        text =
            "Desktop/Laptop slot already active.\n\n" +
            "Only one laptop or desktop can be used at a time.\n\n" +
            "The existing desktop slot remains reserved for 3 days.\n" +
            "Logout does not free this slot.";
    }


    if (message) {

        message.textContent =
            text;

        message.style.display =
            "block";

        return;
    }


    alert(text);
}


/* =========================================================
   HEARTBEAT
========================================================= */

function startDeviceHeartbeat() {

    if (deviceHeartbeat) {

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
   UPDATE HEARTBEAT
========================================================= */

async function updateDeviceHeartbeat() {

    if (!currentUser) {
        return;
    }


    try {

        const slotRef =
            deviceSlotRef(
                currentUser
            );


        const snapshot =
            await getDoc(slotRef);


        if (!snapshot.exists()) {

            console.error(
                "Device slot missing."
            );

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


        /* =========================================
           SLOT EXPIRED
        ========================================= */

        if (
            expiresAt > 0 &&
            expiresAt <= now
        ) {

            if (deviceHeartbeat) {

                clearInterval(
                    deviceHeartbeat
                );

                deviceHeartbeat =
                    null;
            }


            await setDoc(
                slotRef,
                {
                    active: false,
                    lastSeen: now
                },
                {
                    merge: true
                }
            );


            hidePageLoading();


            alert(
                "Your 3-day device access has expired. Please login again."
            );


            await signOut(auth);


            window.location.href =
                "login.html";


            return;
        }


        /* =========================================
           VERIFY DEVICE ID
        ========================================= */

        const savedDeviceId =
            data.deviceId || "";


        const localDeviceId =
            getStableDeviceId();


        if (
            savedDeviceId &&
            savedDeviceId !== localDeviceId
        ) {

            if (deviceHeartbeat) {

                clearInterval(
                    deviceHeartbeat
                );

                deviceHeartbeat =
                    null;
            }


            alert(
                "This device is not the registered device for this slot."
            );


            await signOut(auth);


            window.location.href =
                "login.html";


            return;
        }


        /* =========================================
           KEEP SLOT ALIVE
        ========================================= */

        await updateDoc(
            slotRef,
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
========================================================= */

async function showStudentCourses(student) {

    if (!coursesContainer) {

        console.error(
            "coursesContainer not found"
        );

        hidePageLoading();

        return;
    }


    coursesContainer.innerHTML = "";


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


    /* =========================================
       STUDENT INFO
    ========================================= */

    const studentInfo =
        document.createElement("div");


    studentInfo.className =
        "student-course-info";


    studentInfo.innerHTML = `
        <div>
            <h3>
                ${dashboardEsc(student.exam || "")}
            </h3>

            <p>
                <strong>Batch:</strong>
                ${dashboardEsc(student.batch || "")}
            </p>

            <p>
                <strong>Year:</strong>
                ${dashboardEsc(student.year || "")}
            </p>
        </div>
    `;


    coursesContainer.appendChild(
        studentInfo
    );


    /* =========================================
       LOAD TESTS
    ========================================= */

    const managedTests = {};


    try {

        const snap =
            await getDocs(
                collection(db, "tests")
            );


        snap.forEach(docSnap => {

            const data =
                docSnap.data() || {};

            managedTests[docSnap.id] =
                data;

            if (data.testId) {

                managedTests[data.testId] =
                    data;
            }

        });

    } catch (error) {

        console.warn(
            "Could not load managed tests:",
            error
        );
    }


    /* =========================================
       COURSES
    ========================================= */

    student.courses.forEach(
        function(courseId) {

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
                "course-card fjmc-course-collapsed";


            const courseTestId =
                course.testId ||
                courseId;


            const testData =
                managedTests[courseTestId] ||
                TESTS[courseTestId] ||
                null;


            const contents =
                Array.isArray(course.contents)
                    ? course.contents
                    : [];


            const videos =
                contents.filter(
                    c =>
                        c.type === "video" ||
                        c.type === "local-video"
                );


            const pdfs =
                contents.filter(
                    c =>
                        c.type === "pdf"
                );


            const liveClasses =
                contents.filter(
                    c =>
                        c.type === "live"
                );


            courseCard.innerHTML = `
                <button
                    class="course-main-button"
                    type="button"
                    aria-expanded="false"
                >

                    <div class="course-main-info">

                        <div class="course-meta">

                            <span>
                                <strong>Exam:</strong>
                                ${dashboardEsc(
                                    course.exam ||
                                    student.exam ||
                                    ""
                                )}
                            </span>

                            <span>
                                <strong>Batch:</strong>
                                ${dashboardEsc(
                                    course.batch ||
                                    student.batch ||
                                    ""
                                )}
                            </span>

                            <span>
                                <strong>Year:</strong>
                                ${dashboardEsc(
                                    course.year ||
                                    student.year ||
                                    ""
                                )}
                            </span>

                        </div>


                        <h3>
                            ${dashboardEsc(
                                course.title ||
                                course.subject ||
                                courseId
                            )}
                        </h3>


                        <p>
                            ${dashboardEsc(
                                course.description ||
                                ""
                            )}
                        </p>

                    </div>


                    <span
                        class="course-open-icon"
                    >
                        ＋
                    </span>

                </button>


                <div
                    class="course-details"
                    hidden
                >

                    <div
                        class="course-category-grid"
                    >

                        <button
                            class="course-category-btn"
                            type="button"
                            data-category="video"
                        >
                            🎥
                            <span>
                                Video / Lecture
                            </span>
                            <small>
                                ${videos.length}
                                Lecture${videos.length === 1 ? "" : "s"}
                            </small>
                        </button>


                        <button
                            class="course-category-btn"
                            type="button"
                            data-category="pdf"
                        >
                            📄
                            <span>
                                PDF / Notes
                            </span>
                            <small>
                                ${pdfs.length}
                                Lecture${pdfs.length === 1 ? "" : "s"}
                            </small>
                        </button>


                        <button
                            class="course-category-btn"
                            type="button"
                            data-category="test"
                        >
                            📝
                            <span>
                                Test
                            </span>
                            <small>
                                Lecture wise
                            </small>
                        </button>


                        ${
                            liveClasses.length
                            ? `
                                <button
                                    class="course-category-btn"
                                    type="button"
                                    data-category="live"
                                >
                                    🔴
                                    <span>
                                        Live Class
                                    </span>
                                    <small>
                                        ${liveClasses.length}
                                    </small>
                                </button>
                              `
                            : ""
                        }

                    </div>


                    <div
                        class="course-category-panel"
                        hidden
                    ></div>

                </div>
            `;


            coursesContainer.appendChild(
                courseCard
            );


            const mainButton =
                courseCard.querySelector(
                    ".course-main-button"
                );


            const details =
                courseCard.querySelector(
                    ".course-details"
                );


            const icon =
                courseCard.querySelector(
                    ".course-open-icon"
                );


            const categoryButtons =
                courseCard.querySelectorAll(
                    ".course-category-btn"
                );


            const panel =
                courseCard.querySelector(
                    ".course-category-panel"
                );


            mainButton.addEventListener(
                "click",
                () => {

                    const opening =
                        details.hidden;


                    details.hidden =
                        !opening;


                    mainButton.setAttribute(
                        "aria-expanded",
                        String(opening)
                    );


                    courseCard.classList.toggle(
                        "fjmc-course-expanded",
                        opening
                    );


                    icon.textContent =
                        opening
                            ? "−"
                            : "＋";


                    if (!opening) {

                        panel.hidden =
                            true;
                    }

                }
            );


            categoryButtons.forEach(
                btn => {

                    btn.addEventListener(
                        "click",
                        () => {

                            const category =
                                btn.dataset.category;


                            categoryButtons.forEach(
                                b =>
                                    b.classList.remove(
                                        "active"
                                    )
                            );


                            btn.classList.add(
                                "active"
                            );


                            panel.hidden =
                                false;


                            renderCourseCategoryPanel(
                                panel,
                                category,
                                {
                                    videos,
                                    pdfs,
                                    liveClasses,
                                    testData,
                                    courseTestId,
                                    courseId
                                }
                            );

                        }
                    );

                }
            );

        }
    );


    hidePageLoading();
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function dashboardEsc(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   CATEGORY PANEL
========================================================= */

function renderCourseCategoryPanel(
    panel,
    category,
    data
) {

    let items = [];


    /* =========================================
       VIDEO
    ========================================= */

    if (category === "video") {

        items =
            data.videos.map(
                (content, index) => ({

                    label:
                        content.title ||
                        `Lecture ${index + 1}`,

                    type:
                        content.type,

                    url:
                        content.url,

                    title:
                        content.title ||
                        `Lecture ${index + 1}`
                })
            );


        panel.innerHTML =
            courseLectureListHTML(
                items,
                "video"
            );


        bindCourseLectureButtons(
            panel
        );


        return;
    }


    /* =========================================
       PDF
    ========================================= */

    if (category === "pdf") {

        items =
            data.pdfs.map(
                (content, index) => ({

                    label:
                        content.title ||
                        `Lecture ${index + 1} PDF`,

                    type:
                        "pdf",

                    url:
                        content.url,

                    title:
                        content.title ||
                        `Lecture ${index + 1} PDF`
                })
            );


        panel.innerHTML =
            courseLectureListHTML(
                items,
                "pdf"
            );


        bindCourseLectureButtons(
            panel
        );


        return;
    }


    /* =========================================
       LIVE
    ========================================= */

    if (category === "live") {

        items =
            data.liveClasses.map(
                (content, index) => ({

                    label:
                        content.title ||
                        `Live Class ${index + 1}`,

                    type:
                        "live",

                    url:
                        content.url,

                    title:
                        content.title ||
                        `Live Class ${index + 1}`
                })
            );


        panel.innerHTML =
            courseLectureListHTML(
                items,
                "live"
            );


        bindCourseLectureButtons(
            panel
        );


        return;
    }


    /* =========================================
       TEST
    ========================================= */

    const lectures =
        data.testData?.lectures || {};


    const lectureEntries =
        Object.entries(lectures);


    if (!lectureEntries.length) {

        panel.innerHTML =
            `
            <div class="course-empty-message">
                No tests available for this course.
            </div>
            `;

        return;
    }


    panel.innerHTML = `
        <div class="lecture-wise-heading">
            📝 Select Lecture
        </div>

        <div class="lecture-wise-list">

            ${
                lectureEntries
                    .map(
                        ([lectureId, lecture], index) => `
                            <button
                                class="lecture-select-btn"
                                type="button"
                                data-lecture-id="${dashboardEsc(
                                    lectureId
                                )}"
                            >

                                <span>
                                    📚
                                    ${dashboardEsc(
                                        lecture.title ||
                                        `Lecture ${index + 1}`
                                    )}
                                </span>

                                <span>
                                    ›
                                </span>

                            </button>
                        `
                    )
                    .join("")
            }

        </div>

        <div
            class="test-wise-list"
            hidden
        ></div>
    `;


    const testList =
        panel.querySelector(
            ".test-wise-list"
        );


    panel
        .querySelectorAll(
            ".lecture-select-btn"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    const lectureId =
                        btn.dataset.lectureId;


                    const lecture =
                        lectures[lectureId];


                    const tests =
                        lecture?.tests || {};


                    const entries =
                        Object.entries(
                            tests
                        );


                    if (!entries.length) {

                        testList.hidden =
                            false;

                        testList.innerHTML =
                            `
                            <div class="course-empty-message">
                                No test available in this lecture.
                            </div>
                            `;

                        return;
                    }


                    testList.hidden =
                        false;


                    testList.innerHTML = `

                        <div
                            class="lecture-wise-heading"
                        >
                            Tests in
                            ${dashboardEsc(
                                lecture.title ||
                                lectureId
                            )}
                        </div>


                        ${
                            entries
                                .map(
                                    ([testNumber, test]) => `

                                        <button
                                            class="test-select-btn"
                                            type="button"

                                            data-course="${dashboardEsc(
                                                data.courseTestId
                                            )}"

                                            data-lecture="${dashboardEsc(
                                                lectureId
                                            )}"

                                            data-test="${dashboardEsc(
                                                testNumber
                                            )}"
                                        >

                                            <span>
                                                📝
                                                ${dashboardEsc(
                                                    test.title ||
                                                    `Test ${testNumber}`
                                                )}
                                            </span>

                                            <small>
                                                ${Number(
                                                    test.duration ||
                                                    30
                                                )}
                                                min •
                                                ${
                                                    Array.isArray(
                                                        test.questions
                                                    )
                                                        ? test.questions.length
                                                        : 0
                                                }
                                                Questions
                                            </small>

                                        </button>

                                    `
                                )
                                .join("")
                        }

                    `;


                    testList
                        .querySelectorAll(
                            ".test-select-btn"
                        )
                        .forEach(
                            testBtn => {

                                testBtn.addEventListener(
                                    "click",
                                    () => {

                                        window.location.href =
                                            "test.html?course=" +
                                            encodeURIComponent(
                                                testBtn.dataset.course
                                            ) +
                                            "&lecture=" +
                                            encodeURIComponent(
                                                testBtn.dataset.lecture
                                            ) +
                                            "&test=" +
                                            encodeURIComponent(
                                                testBtn.dataset.test
                                            );

                                    }
                                );

                            }
                        );

                }
            );

        });
}


/* =========================================================
   CONTENT LIST
========================================================= */

function courseLectureListHTML(
    items,
    type
) {

    if (!items.length) {

        return `
            <div class="course-empty-message">
                No ${
                    type === "pdf"
                        ? "PDF"
                        : type === "video"
                            ? "video lecture"
                            : "live class"
                } available.
            </div>
        `;
    }


    return `

        <div class="lecture-wise-heading">

            ${
                type === "video"
                    ? "🎥 Video Lectures"
                    : type === "pdf"
                        ? "📄 PDF Lectures"
                        : "🔴 Live Classes"
            }

        </div>


        <div class="lecture-wise-list">

            ${
                items
                    .map(
                        (item, index) => `

                            <button
                                class="content-lecture-btn"
                                type="button"

                                data-type="${dashboardEsc(
                                    item.type
                                )}"

                                data-url="${encodeURIComponent(
                                    item.url || ""
                                )}"

                                data-title="${encodeURIComponent(
                                    item.title ||
                                    item.label ||
                                    `Lecture ${index + 1}`
                                )}"
                            >

                                <span>
                                    ${
                                        type === "video"
                                            ? "▶"
                                            : type === "pdf"
                                                ? "📄"
                                                : "🔴"
                                    }

                                    ${dashboardEsc(
                                        item.label
                                    )}
                                </span>

                                <span>
                                    ›
                                </span>

                            </button>

                        `
                    )
                    .join("")
            }

        </div>
    `;
}


/* =========================================================
   CONTENT BUTTONS
========================================================= */

function bindCourseLectureButtons(panel) {

    panel
        .querySelectorAll(
            ".content-lecture-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const type =
                        button.dataset.type;


                    const url =
                        decodeURIComponent(
                            button.dataset.url ||
                            ""
                        );


                    const title =
                        decodeURIComponent(
                            button.dataset.title ||
                            ""
                        );


                    if (
                        type === "youtube" ||
                        type === "video"
                    ) {

                        openYouTubeVideo(
                            url,
                            title
                        );

                    } else if (
                        type === "local-video"
                    ) {

                        openLocalVideo(
                            url,
                            title
                        );

                    } else if (
                        type === "pdf"
                    ) {

                        openPDFViewer(
                            url,
                            title
                        );

                    } else if (
                        type === "live"
                    ) {

                        openLiveClass(
                            url
                        );

                    }

                }
            );

        });
}


/* =========================================================
   MODAL
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
                        id="fjmcModalTitle"
                    ></strong>


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
                ></div>

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
            event => {

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
   YOUTUBE
========================================================= */

function openYouTubeVideo(
    url,
    title
) {

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
                src="${dashboardEsc(url)}"
                title="${dashboardEsc(title)}"
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

    createModal();


    document.getElementById(
        "fjmcModalTitle"
    ).textContent =
        title;


    document.getElementById(
        "fjmcModalBody"
    ).innerHTML = `

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
                src="${dashboardEsc(url)}"
                type="video/mp4"
            >

            Your browser does not support video.

        </video>
    `;
}


/* =========================================================
   LIVE CLASS
========================================================= */

function openLiveClass(url) {

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
   PDF
========================================================= */

async function openPDFViewer(
    url,
    title
) {

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
        ></div>
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
            await pdfjsLib
                .getDocument(url)
                .promise;


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


        Object.assign(
            watermark.style,
            {
                position: "fixed",
                left: "50%",
                top: "50%",
                transform:
                    "translate(-50%, -50%) rotate(-20deg)",
                color: "rgba(0,0,0,1)",
                fontSize: "24px",
                fontWeight: "800",
                letterSpacing: "2px",
                whiteSpace: "nowrap",
                zIndex: "1000000",
                pointerEvents: "none",
                userSelect: "none",
                webkitUserSelect: "none",
                webkitTouchCallout: "none"
            }
        );


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


            Object.assign(
                wrapper.style,
                {
                    position: "relative",
                    display: "inline-block",
                    margin: "0 auto 20px auto",
                    maxWidth: "100%",
                    background: "#ffffff",
                    overflow: "hidden"
                }
            );


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                viewport.width;


            canvas.height =
                viewport.height;


            Object.assign(
                canvas.style,
                {
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                    userSelect: "none",
                    webkitUserSelect: "none"
                }
            );


            wrapper.appendChild(
                canvas
            );


            pages.appendChild(
                wrapper
            );


            const context =
                canvas.getContext("2d");


            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        }


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
                    ${dashboardEsc(
                        error.message || ""
                    )}
                </p>

            </div>
        `;
    }
}


/* =========================================================
   LOGOUT
   IMPORTANT:
   DO NOT DELETE / DISABLE DEVICE SLOT
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function() {

            try {

                if (deviceHeartbeat) {

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


                /*
                   IMPORTANT:
                   Device slot is NOT deleted.
                   3-day reservation remains.
                */

                await signOut(auth);


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
   CONTENT PROTECTION
========================================================= */

document.addEventListener(
    "contextmenu",
    event => event.preventDefault()
);


document.addEventListener(
    "copy",
    event => event.preventDefault()
);


document.addEventListener(
    "cut",
    event => event.preventDefault()
);


document.addEventListener(
    "selectstart",
    event => event.preventDefault()
);


document.addEventListener(
    "keydown",
    event => {

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
    function() {

        setTimeout(
            function() {

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
