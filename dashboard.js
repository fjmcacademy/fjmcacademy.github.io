/* =========================================================
   FJMC ACADEMY - STUDENT DASHBOARD
   FINAL DEVICE SYSTEM

   DEVICE POLICY
   ---------------------------------------------------------
   1 MOBILE SLOT + 1 DESKTOP/LAPTOP SLOT

   PHONE + TABLET = SAME MOBILE SLOT

   MOBILE:
      Android phone
      Android tablet
      iPhone
      iPad
      iPadOS desktop-mode Safari
      other tablet devices

   DESKTOP:
      Windows desktop/laptop
      macOS desktop/laptop
      Linux desktop/laptop

   RESERVATION:
      3 DAYS

   LOGOUT:
      DOES NOT FREE DEVICE SLOT

   DEVICE SLOT DOCUMENT:
      users/{uid}/deviceSlots/main

   Existing course / PDF / video / live / test system retained.
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
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {
    auth,
    db
} from "./firebase.js";


import {
    TESTS
} from "./test-default-data.js";


/* =========================================================
   STUDENT / COURSE DATA
========================================================= */

let STUDENTS = {};
let COURSES = {};


function studentDocId(email) {

    return email
        .trim()
        .toLowerCase()
        .replaceAll("/", "_");

}


async function loadDashboardData(email) {

    const studentSnap =
        await getDoc(
            doc(
                db,
                "students",
                studentDocId(email)
            )
        );


    if (!studentSnap.exists()) {
        return null;
    }


    const student =
        studentSnap.data();


    const courseIds =
        Array.isArray(student.courses)
            ? student.courses
            : [];


    const courseEntries =
        await Promise.all(

            courseIds.map(
                async function (courseId) {

                    const snap =
                        await getDoc(
                            doc(
                                db,
                                "courses",
                                courseId
                            )
                        );


                    return snap.exists()
                        ? [courseId, snap.data()]
                        : null;

                }
            )

        );


    COURSES = {};


    courseEntries
        .filter(Boolean)
        .forEach(
            function ([id, course]) {

                COURSES[id] =
                    course;

            }
        );


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
   FINAL DEVICE TYPE DETECTION
=========================================================

   IMPORTANT:

   Android tablet:
      Android + no "Mobile"
      => mobile

   Android phone:
      Android + Mobile
      => mobile

   iPad:
      => mobile

   New iPadOS can report itself as Macintosh.
   Therefore:
      Macintosh + touch points
      => mobile

   Desktop:
      normal Windows/Mac/Linux desktop
      => desktop
========================================================= */

function getDeviceType() {

    const ua =
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        "";


    const platform =
        navigator.platform || "";


    const uaDataPlatform =
        navigator.userAgentData?.platform || "";


    const uaDataMobile =
        navigator.userAgentData?.mobile === true;


    const maxTouchPoints =
        Number(
            navigator.maxTouchPoints || 0
        );


    const width =
        Math.max(
            window.screen?.width || 0,
            window.screen?.height || 0
        );


    const height =
        Math.min(
            window.screen?.width || 0,
            window.screen?.height || 0
        );


    /* -----------------------------------------
       iPhone / iPad / iPod
    ----------------------------------------- */

    if (
        /iPhone|iPad|iPod/i.test(ua)
    ) {

        return "mobile";

    }


    /* -----------------------------------------
       iPadOS desktop-mode

       iPad may appear as Macintosh.
       Touch points identify it.
    ----------------------------------------- */

    if (
        /Macintosh/i.test(ua) &&
        maxTouchPoints > 1
    ) {

        return "mobile";

    }


    /* -----------------------------------------
       Android / Android tablet / Android desktop mode

       Android tablets can remove "Mobile" when
       Chrome Desktop Site is enabled. We therefore
       check the UA, UA-CH platform and mobile flag.
    ----------------------------------------- */

    if (
        /Android/i.test(ua) ||
        /Android/i.test(uaDataPlatform) ||
        uaDataMobile === true
    ) {

        return "mobile";

    }


    /* -----------------------------------------
       Other known mobile/tablet UAs
    ----------------------------------------- */

    if (
        /Tablet|Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Kindle|Silk/i.test(ua)
    ) {

        return "mobile";

    }


    /* -----------------------------------------
       Touch-screen fallback

       Used mainly for tablets whose UA is
       unusual.

       Avoid classifying ordinary Windows
       touch laptops as mobile by requiring
       tablet-like screen dimensions.
    ----------------------------------------- */

    if (
        maxTouchPoints > 1 &&
        width <= 1600 &&
        height <= 1200 &&
        !/Windows NT/i.test(ua)
    ) {

        return "mobile";

    }


    /* -----------------------------------------
       Everything else = desktop/laptop
    ----------------------------------------- */

    return "desktop";

}


const currentDeviceType =
    getDeviceType();


console.log(
    "FJMC device type:",
    currentDeviceType
);

console.log(
    "FJMC device ID:",
    deviceId
);

console.log(
    "Touch points:",
    navigator.maxTouchPoints || 0
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

            document
                .querySelectorAll(selector)
                .forEach(
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
   DEVICE SLOT DOCUMENT
========================================================= */

function deviceSlotsRef(user) {

    return doc(
        db,
        "users",
        user.uid,
        "deviceSlots",
        "main"
    );

}


/* =========================================================
   REGISTER DEVICE
=========================================================

   THIS IS THE IMPORTANT PART.

   A single document stores:

      mobileDeviceId
      mobileExpiresAt

      desktopDeviceId
      desktopExpiresAt

   Therefore phone + tablet both compete
   for the SAME mobileDeviceId field.

   Transaction prevents simultaneous login
   from taking the same slot.
========================================================= */

async function registerDevice(user) {

    try {

        const slotRef =
            deviceSlotsRef(user);


        const now =
            Date.now();


        const result =
            await runTransaction(
                db,
                async function (transaction) {

                    const snapshot =
                        await transaction.get(
                            slotRef
                        );


                    const data =
                        snapshot.exists()
                            ? snapshot.data()
                            : {};


                    const mobileDeviceId =
                        data.mobileDeviceId || null;


                    const mobileExpiresAt =
                        Number(
                            data.mobileExpiresAt || 0
                        );


                    const desktopDeviceId =
                        data.desktopDeviceId || null;


                    const desktopExpiresAt =
                        Number(
                            data.desktopExpiresAt || 0
                        );


                    /* =====================================
                       MOBILE SLOT
                    ===================================== */

                    if (
                        currentDeviceType === "mobile"
                    ) {

                        /* Same device already reserved */

                        if (
                            mobileDeviceId === deviceId &&
                            mobileExpiresAt > now
                        ) {

                            transaction.set(
                                slotRef,
                                {
                                    mobileLastSeen:
                                        now,

                                    mobileActive:
                                        true
                                },
                                {
                                    merge: true
                                }
                            );


                            return {
                                allowed: true
                            };

                        }


                        /* Another mobile device exists */

                        if (
                            mobileDeviceId &&
                            mobileExpiresAt > now &&
                            mobileDeviceId !== deviceId
                        ) {

                            return {
                                allowed: false,
                                reason: "mobile"
                            };

                        }


                        /* Mobile slot expired/free */

                        transaction.set(
                            slotRef,
                            {
                                mobileDeviceId:
                                    deviceId,

                                mobileExpiresAt:
                                    now +
                                    DEVICE_TIMEOUT,

                                mobileLastSeen:
                                    now,

                                mobileActive:
                                    true,

                                mobileEmail:
                                    user.email || "",

                                updatedAt:
                                    serverTimestamp()
                            },
                            {
                                merge: true
                            }
                        );


                        return {
                            allowed: true
                        };

                    }


                    /* =====================================
                       DESKTOP SLOT
                    ===================================== */

                    if (
                        currentDeviceType === "desktop"
                    ) {

                        /* Same desktop already reserved */

                        if (
                            desktopDeviceId === deviceId &&
                            desktopExpiresAt > now
                        ) {

                            transaction.set(
                                slotRef,
                                {
                                    desktopLastSeen:
                                        now,

                                    desktopActive:
                                        true
                                },
                                {
                                    merge: true
                                }
                            );


                            return {
                                allowed: true
                            };

                        }


                        /* Another desktop exists */

                        if (
                            desktopDeviceId &&
                            desktopExpiresAt > now &&
                            desktopDeviceId !== deviceId
                        ) {

                            return {
                                allowed: false,
                                reason: "desktop"
                            };

                        }


                        /* Desktop slot expired/free */

                        transaction.set(
                            slotRef,
                            {
                                desktopDeviceId:
                                    deviceId,

                                desktopExpiresAt:
                                    now +
                                    DEVICE_TIMEOUT,

                                desktopLastSeen:
                                    now,

                                desktopActive:
                                    true,

                                desktopEmail:
                                    user.email || "",

                                updatedAt:
                                    serverTimestamp()
                            },
                            {
                                merge: true
                            }
                        );


                        return {
                            allowed: true
                        };

                    }


                    return {
                        allowed: false,
                        reason: "unknown"
                    };

                }
            );


        console.log(
            "Device registration result:",
            result
        );


        if (!result.allowed) {

            showDeviceLimitMessage(
                result.reason
            );


            return false;

        }


        return true;


    } catch (error) {

        console.error(
            "Device registration error:",
            error
        );


        hidePageLoading();


        console.error(
            "Device registration code:",
            error?.code
        );

        console.error(
            "Device registration message:",
            error?.message
        );

        alert(
            "Device verification failed.\n\n" +
            (error?.message || "Please try again.")
        );


        return false;

    }

}


/* =========================================================
   DEVICE LIMIT MESSAGE
========================================================= */

function showDeviceLimitMessage(
    reason
) {

    let text;


    if (
        reason === "mobile"
    ) {

        text =
            "This account already has a mobile/tablet device reserved.\n\n" +
            "Phone and tablet share the same MOBILE slot.\n\n" +
            "The reservation remains active for 3 days.";

    } else if (
        reason === "desktop"
    ) {

        text =
            "This account already has a laptop/desktop device reserved.\n\n" +
            "Another laptop/desktop cannot use the same slot until the 3-day reservation expires.";

    } else {

        text =
            "Maximum device access has already been reached.";

    }


    const message =
        document.getElementById(
            "deviceLimitMessage"
        );


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
   HEARTBEAT UPDATE
========================================================= */

async function updateDeviceHeartbeat() {

    if (!currentUser) {
        return;
    }


    try {

        const slotRef =
            deviceSlotsRef(
                currentUser
            );


        const snapshot =
            await getDoc(
                slotRef
            );


        if (!snapshot.exists()) {

            return;

        }


        const data =
            snapshot.data();


        const now =
            Date.now();


        if (
            currentDeviceType === "mobile"
        ) {

            const expiresAt =
                Number(
                    data.mobileExpiresAt || 0
                );


            const savedDeviceId =
                data.mobileDeviceId || "";


            /* Another device has replaced slot */

            if (
                savedDeviceId !== deviceId
            ) {

                stopHeartbeatAndLogout(
                    "This mobile/tablet slot is being used by another device."
                );

                return;

            }


            /* Reservation expired */

            if (
                expiresAt <= now
            ) {

                stopHeartbeatAndLogout(
                    "Your mobile/tablet device reservation has expired. Please login again."
                );

                return;

            }


            await updateDoc(
                slotRef,
                {
                    mobileLastSeen:
                        now,

                    mobileActive:
                        true
                }
            );


            return;

        }


        if (
            currentDeviceType === "desktop"
        ) {

            const expiresAt =
                Number(
                    data.desktopExpiresAt || 0
                );


            const savedDeviceId =
                data.desktopDeviceId || "";


            if (
                savedDeviceId !== deviceId
            ) {

                stopHeartbeatAndLogout(
                    "This laptop/desktop slot is being used by another device."
                );

                return;

            }


            if (
                expiresAt <= now
            ) {

                stopHeartbeatAndLogout(
                    "Your laptop/desktop device reservation has expired. Please login again."
                );

                return;

            }


            await updateDoc(
                slotRef,
                {
                    desktopLastSeen:
                        now,

                    desktopActive:
                        true
                }
            );

        }


    } catch (error) {

        console.error(
            "Heartbeat error:",
            error
        );

    }

}


/* =========================================================
   STOP HEARTBEAT + LOGOUT
========================================================= */

async function stopHeartbeatAndLogout(
    message
) {

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


    alert(message);


    try {

        await signOut(
            auth
        );

    } catch (error) {

        console.error(
            "Sign out error:",
            error
        );

    }


    window.location.href =
        "login.html";

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


            console.log(
                "Device type:",
                currentDeviceType
            );


            const student =
                await loadDashboardData(
                    email
                );


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


            sessionStorage.setItem(
                "loggedInStudent",
                email
            );


            sessionStorage.setItem(
                "firebaseUID",
                user.uid
            );


            if (studentName) {

                studentName.textContent =
                    "Welcome, " +
                    student.name;

            }


            /* =========================================
               DEVICE CHECK
            ========================================= */

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
   SHOW STUDENT COURSES
========================================================= */

async function showStudentCourses(
    student
) {

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


    const studentInfo =
        document.createElement(
            "div"
        );


    studentInfo.className =
        "student-course-info";


    studentInfo.innerHTML = `
        <div>
            <h3>${dashboardEsc(student.exam || "")}</h3>
            <p><strong>Batch:</strong> ${dashboardEsc(student.batch || "")}</p>
            <p><strong>Year:</strong> ${dashboardEsc(student.year || "")}</p>
        </div>
    `;


    coursesContainer.appendChild(
        studentInfo
    );


    /* =========================================
       LOAD ADMIN MANAGED TESTS
    ========================================= */

    const managedTests = {};


    try {

        const snap =
            await getDocs(
                collection(
                    db,
                    "tests"
                )
            );


        snap.forEach(
            function (docSnap) {

                const data =
                    docSnap.data() || {};


                managedTests[
                    docSnap.id
                ] = data;


                if (data.testId) {

                    managedTests[
                        data.testId
                    ] = data;

                }

            }
        );


    } catch (error) {

        console.warn(
            "Could not load managed tests:",
            error
        );

    }


    /* =========================================
       COURSE CARDS
    ========================================= */

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
                    function (c) {

                        return (
                            c.type === "video" ||
                            c.type === "local-video"
                        );

                    }
                );


            const pdfs =
                contents.filter(
                    function (c) {

                        return c.type === "pdf";

                    }
                );


            const liveClasses =
                contents.filter(
                    function (c) {

                        return c.type === "live";

                    }
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


                    <span class="course-open-icon">
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
                            <span>Video / Lecture</span>
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
                            <span>PDF / Notes</span>
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
                            <span>Test</span>
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
                                    <span>Live Class</span>
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
                function () {

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
                function (btn) {

                    btn.addEventListener(
                        "click",
                        function () {

                            const category =
                                btn.dataset.category;


                            categoryButtons.forEach(
                                function (b) {

                                    b.classList.remove(
                                        "active"
                                    );

                                }
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

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   COURSE CATEGORY PANEL
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

    if (
        category === "video"
    ) {

        items =
            data.videos.map(
                function (content, index) {

                    return {

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

                    };

                }
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

    if (
        category === "pdf"
    ) {

        items =
            data.pdfs.map(
                function (content, index) {

                    return {

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

                    };

                }
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

    if (
        category === "live"
    ) {

        items =
            data.liveClasses.map(
                function (content, index) {

                    return {

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

                    };

                }
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
        Object.entries(
            lectures
        );


    if (
        !lectureEntries.length
    ) {

        panel.innerHTML = `
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
                        function (
                            [lectureId, lecture],
                            index
                        ) {

                            return `

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
                            `;

                        }
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
        .forEach(
            function (btn) {

                btn.addEventListener(
                    "click",
                    function () {

                        const lectureId =
                            btn.dataset.lectureId;


                        const lecture =
                            lectures[
                                lectureId
                            ];


                        const tests =
                            lecture?.tests || {};


                        const entries =
                            Object.entries(
                                tests
                            );


                        if (
                            !entries.length
                        ) {

                            testList.hidden =
                                false;


                            testList.innerHTML = `
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
                                        function (
                                            [testNumber, test]
                                        ) {

                                            return `

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
                                                        min
                                                        •
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
                                            `;

                                        }
                                    )
                                    .join("")
                            }

                        `;


                        testList
                            .querySelectorAll(
                                ".test-select-btn"
                            )
                            .forEach(
                                function (testBtn) {

                                    testBtn.addEventListener(
                                        "click",
                                        function () {

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

            }
        );

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
                        function (
                            item,
                            index
                        ) {

                            return `

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

                            `;

                        }
                    )
                    .join("")
            }

        </div>

    `;

}


/* =========================================================
   CONTENT BUTTONS
========================================================= */

function bindCourseLectureButtons(
    panel
) {

    panel
        .querySelectorAll(
            ".content-lecture-btn"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

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

            }
        );

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
   YOUTUBE
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
                allowfullscreen
            ></iframe>

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
   DO NOT MODIFY DEVICE SLOT.

   Logout only signs out Firebase.
   3-day reservation remains.
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
