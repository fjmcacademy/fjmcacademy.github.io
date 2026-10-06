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
    query,
    where,
    setDoc,
    updateDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   STUDENT DATA
========================================================= */

let STUDENTS = {};
let COURSES = {};

function studentDocId(email) {
    return email.trim().toLowerCase().replaceAll("/", "_");
}

async function loadDashboardData(email, uid) {

    const normalizedEmail =
        String(email || "").trim().toLowerCase();

    if (!normalizedEmail) return null;

    const emailId =
        studentDocId(normalizedEmail);

    let studentSnap =
        await getDoc(
            doc(
                db,
                "students",
                emailId
            )
        );

    if (!studentSnap.exists() && uid) {

        const legacySnap =
            await getDoc(
                doc(
                    db,
                    "students",
                    uid
                )
            );

        if (legacySnap.exists()) {
            studentSnap = legacySnap;
        }
    }

    if (!studentSnap.exists()) {

        const emailQuery =
            query(
                collection(
                    db,
                    "students"
                ),
                where(
                    "email",
                    "==",
                    normalizedEmail
                )
            );

        const result =
            await getDocs(
                emailQuery
            );

        if (!result.empty) {
            studentSnap =
                result.docs[0];
        }
    }

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
                async courseId => {

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
            ([id, course]) => {
                COURSES[id] =
                    course;
            }
        );

    STUDENTS = {
        [normalizedEmail]: student
    };

    return student;
}


/* =========================================================
   DEVICE SETTINGS
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

    const userAgent = String(
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        ""
    );

    const isAndroid =
        /Android/i.test(userAgent);

    const isAndroidPhone =
        isAndroid &&
        /Mobile/i.test(userAgent);

    const isAndroidTablet =
        isAndroid &&
        !isAndroidPhone;

    const isIPhoneOrIPod =
        /iPhone|iPod/i.test(userAgent);

    const isIPadUA =
        /iPad/i.test(userAgent);

    const isTouchMac =
        /Macintosh/i.test(userAgent) &&
        typeof navigator.maxTouchPoints === "number" &&
        navigator.maxTouchPoints > 1;

    const maxTouchPoints =
        Number(
            navigator.maxTouchPoints || 0
        );

    const screenWidth =
        Number(
            window.screen &&
            window.screen.width || 0
        );

    const screenHeight =
        Number(
            window.screen &&
            window.screen.height || 0
        );

    const shortSide =
        Math.min(
            screenWidth || 99999,
            screenHeight || 99999
        );

    const hasMultiTouch =
        maxTouchPoints >= 2;

    const tabletSizedTouchScreen =
        hasMultiTouch &&
        shortSide > 0 &&
        shortSide <= 1200;

    if (
        isAndroidPhone ||
        isAndroidTablet ||
        isIPhoneOrIPod ||
        isIPadUA ||
        isTouchMac ||
        tabletSizedTouchScreen ||
        /Tablet|Mobile/i.test(userAgent)
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
                await loadDashboardData(
                    email,
                    user.uid
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

function deviceSlotRef(
    user,
    type
) {

    return doc(
        db,
        "users",
        user.uid,
        "deviceSlots",
        type
    );

}

function deviceSlotName(
    type
) {

    return type === "mobile"
        ? "mobile"
        : "desktop";

}

async function registerDevice(
    user
) {

    try {

        const now =
            Date.now();

        const type =
            deviceSlotName(
                currentDeviceType
            );

        const slotRef =
            deviceSlotRef(
                user,
                type
            );

        const result =
            await runTransaction(
                db,
                async (
                    transaction
                ) => {

                    const slotSnap =
                        await transaction.get(
                            slotRef
                        );

                    if (
                        slotSnap.exists()
                    ) {

                        const data =
                            slotSnap.data() || {};

                        const reservedUntil =
                            Number(
                                data.reservedUntil || 0
                            );

                        const reservedDeviceId =
                            String(
                                data.deviceId || ""
                            );

                        if (
                            reservedDeviceId ===
                                deviceId &&
                            reservedUntil > now
                        ) {

                            transaction.set(
                                slotRef,
                                {
                                    lastSeen: now,
                                    email:
                                        user.email || "",
                                    deviceType:
                                        type
                                },
                                {
                                    merge: true
                                }
                            );

                            return {
                                allowed: true
                            };
                        }

                        if (
                            reservedUntil > now
                        ) {

                            return {
                                allowed: false,
                                reason:
                                    "reserved"
                            };
                        }
                    }

                    transaction.set(
                        slotRef,
                        {
                            email:
                                user.email || "",
                            deviceId:
                                deviceId,
                            deviceType:
                                type,
                            reservedAt:
                                now,
                            reservedUntil:
                                now +
                                DEVICE_TIMEOUT,
                            lastSeen:
                                now,
                            active:
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
            );

        if (!result.allowed) {

            showDeviceLimitMessage();

            return false;
        }

        const deviceRef =
            doc(
                db,
                "users",
                user.uid,
                "devices",
                deviceId
            );

        const existing =
            await getDoc(
                deviceRef
            );

        const existingData =
            existing.exists()
                ? existing.data()
                : {};

        const existingExpiry =
            Number(
                existingData.expiresAt || 0
            );

        await setDoc(
            deviceRef,
            {
                email:
                    user.email || "",
                active:
                    true,
                deviceType:
                    currentDeviceType,
                lastSeen:
                    now,
                expiresAt:
                    existingExpiry > now
                        ? existingExpiry
                        : now +
                          DEVICE_TIMEOUT,
                reserved:
                    true
            },
            {
                merge: true
            }
        );

        console.log(
            "Fixed 3-day device reservation registered:",
            currentDeviceType,
            deviceId
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

        const now =
            Date.now();

        const type =
            deviceSlotName(
                currentDeviceType
            );

        const slotRef =
            deviceSlotRef(
                currentUser,
                type
            );

        const slotSnap =
            await getDoc(
                slotRef
            );

        if (!slotSnap.exists()) {

            console.warn(
                "Device reservation slot missing."
            );

            return;
        }

        const data =
            slotSnap.data() || {};

        const reservedDeviceId =
            String(
                data.deviceId || ""
            );

        const reservedUntil =
            Number(
                data.reservedUntil || 0
            );

        if (
            reservedDeviceId !==
            deviceId
        ) {

            if (deviceHeartbeat) {

                clearInterval(
                    deviceHeartbeat
                );

                deviceHeartbeat =
                    null;
            }

            alert(
                "This device is no longer reserved for this account. Please login again."
            );

            await signOut(
                auth
            );

            window.location.href =
                "login.html";

            return;
        }

        if (
            reservedUntil > 0 &&
            reservedUntil <= now
        ) {

            if (deviceHeartbeat) {

                clearInterval(
                    deviceHeartbeat
                );

                deviceHeartbeat =
                    null;
            }

            alert(
                "Your 3-day device reservation has expired. Please login again."
            );

            await signOut(
                auth
            );

            window.location.href =
                "login.html";

            return;
        }

        await updateDoc(
            slotRef,
            {
                lastSeen:
                    now
            }
        );

        const deviceRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "devices",
                deviceId
            );

        await updateDoc(
            deviceRef,
            {
                lastSeen:
                    now,
                active:
                    true
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
        !Array.isArray(
            student.courses
        ) ||
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
        <div style="
            margin-bottom:20px;
            padding:18px;
            border-radius:12px;
            background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.12);
        ">
            <h3 style="margin:0 0 12px 0;">
                ${student.exam || ""}
            </h3>

            <p style="margin:5px 0;">
                <strong>Batch:</strong>
                ${student.batch || ""}
            </p>

            <p style="margin:5px 0;">
                <strong>Year:</strong>
                ${student.year || ""}
            </p>
        </div>
    `;

    coursesContainer.appendChild(
        studentInfo
    );

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
                "course-card";

            let contentHTML =
                "";

            const contents =
                Array.isArray(
                    course.contents
                )
                    ? course.contents
                    : [];

            contents.forEach(
                function(content) {

                    if (
                        content.type ===
                        "video"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button video-button"
                                data-type="youtube"
                                data-url="${encodeURIComponent(content.url || "")}"
                                data-title="${encodeURIComponent(content.title || "Lecture")}"
                            >
                                ▶ ${content.title || "Video"}
                            </button>
                        `;

                    } else if (
                        content.type ===
                        "local-video"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button video-button"
                                data-type="local"
                                data-url="${encodeURIComponent(content.url || "")}"
                                data-title="${encodeURIComponent(content.title || "Lecture")}"
                            >
                                ▶ ${content.title || "Video"}
                            </button>
                        `;

                    } else if (
                        content.type ===
                        "pdf"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button pdf-button"
                                data-type="pdf"
                                data-url="${encodeURIComponent(content.url || "")}"
                                data-title="${encodeURIComponent(content.title || "PDF")}"
                            >
                                📄 ${content.title || "PDF"}
                            </button>
                        `;

                    } else if (
                        content.type ===
                        "live"
                    ) {

                        contentHTML += `
                            <button
                                class="content-button live-button"
                                data-type="live"
                                data-url="${encodeURIComponent(content.url || "")}"
                            >
                                🔴 ${content.title || "Live Class"}
                            </button>
                        `;

                    }

                }
            );

            courseCard.innerHTML = `
                <button
                    type="button"
                    class="course-toggle"
                    aria-expanded="false"
                >

                    <div class="course-title">

                        <div style="
                            margin-bottom:10px;
                            font-size:13px;
                            opacity:.85;
                        ">
                            ${course.exam || student.exam || ""}
                            &nbsp;•&nbsp;
                            ${course.batch || student.batch || ""}
                            &nbsp;•&nbsp;
                            ${course.year || student.year || ""}
                        </div>

                        <h3>
                            ${course.title || courseId}
                        </h3>

                        <p>
                            ${course.description || ""}
                        </p>

                        <span class="course-open-hint">
                            Tap / Click to open course
                        </span>

                    </div>

                </button>

                <div
                    class="course-content"
                    hidden
                >

                    ${
                        contentHTML ||
                        `
                        <div class="no-course">
                            <p>No material added yet.</p>
                        </div>
                        `
                    }

                    <div style="
                        margin-top:15px;
                        padding-top:15px;
                        border-top:1px solid rgba(0,0,0,.12);
                    ">

                        <button
                            type="button"
                            class="fjmc-test-button"
                            data-test-course="${course.testId || courseId}"
                        >
                            📝 ${course.title || "Course"} Test
                        </button>

                    </div>

                </div>
            `;

            coursesContainer.appendChild(
                courseCard
            );

        }
    );

    coursesContainer
        .querySelectorAll(
            ".course-toggle"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const card =
                            button.closest(
                                ".course-card"
                            );

                        const content =
                            card?.querySelector(
                                ".course-content"
                            );

                        if (!content) {
                            return;
                        }

                        const isOpen =
                            !content.hidden;

                        content.hidden =
                            isOpen;

                        button.setAttribute(
                            "aria-expanded",
                            String(
                                !isOpen
                            )
                        );

                        card.classList.toggle(
                            "course-open",
                            !isOpen
                        );

                    }
                );

            }
        );

    coursesContainer
        .querySelectorAll(
            ".fjmc-test-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function(event) {

                        event.stopPropagation();

                        const courseId =
                            button.dataset
                                .testCourse;

                        window.location.href =
                            "test.html?course=" +
                            encodeURIComponent(
                                courseId
                            );

                    }
                );

            }
        );

    coursesContainer
        .querySelectorAll(
            ".content-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function(event) {

                        event.stopPropagation();

                        const type =
                            button.dataset.type;

                        const url =
                            decodeURIComponent(
                                button.dataset.url || ""
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

                        } else if (
                            type ===
                            "local"
                        ) {

                            openLocalVideo(
                                url,
                                title
                            );

                        } else if (
                            type ===
                            "pdf"
                        ) {

                            openPDFViewer(
                                url,
                                title
                            );

                        } else if (
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
            function(event) {

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
   VIDEO WATERMARK SYSTEM
   MOVING POSITIONS
========================================================= */

const fjmcVideoWatermarkPositions = [

    [12, 18, 0],

    [82, 24, 0],

    [68, 78, 0],

    [18, 72, 0],

    [50, 48, 0]

];


let fjmcVideoWatermarkTimer = null;


/* =========================================================
   GET STUDENT WATERMARK TEXT
========================================================= */

function fjmcGetVideoWatermarkText() {

    const name =
        (
            currentUser?.displayName ||
            studentName?.textContent ||
            "FJMC Student"
        )
            .replace(
                /^Welcome,\s*/i,
                ""
            )
            .trim();

    const email =
        (
            currentUser?.email ||
            sessionStorage.getItem(
                "loggedInStudent"
            ) ||
            ""
        )
            .trim()
            .toLowerCase();

    return (
        (name || "Student") +
        "\n" +
        (email || "Account")
    );

}


/* =========================================================
   CREATE MOVING VIDEO WATERMARK
========================================================= */

function fjmcCreateVideoWatermark() {

    const watermark =
        document.createElement(
            "div"
        );

    watermark.className =
        "fjmc-video-watermark";

    watermark.setAttribute(
        "aria-hidden",
        "true"
    );

    watermark.textContent =
        fjmcGetVideoWatermarkText();

    watermark.style.cssText = `
        position:absolute;

        left:50%;
        top:50%;

        transform:
            translate(-50%, -50%)
            rotate(0deg);

        width:90%;

        text-align:center;

        color:rgba(255,0,0,0.55);

        text-shadow:
            0 1px 3px rgba(0,0,0,0.8);

        font-size:
            clamp(5px, .6vw, 11px);

        font-weight:800;

        letter-spacing:0.5px;

        line-height:1.2;

        white-space:pre-line;

        word-break:break-word;

        pointer-events:none;

        user-select:none;
        -webkit-user-select:none;
        -webkit-touch-callout:none;

        z-index:999999;

        transition:
            left 1.2s ease,
            top 1.2s ease,
            transform 1.2s ease;
    `;

    return watermark;

}


/* =========================================================
   START WATERMARK MOVEMENT
========================================================= */

function fjmcStartVideoWatermark(
    stage
) {

    fjmcStopVideoWatermark();

    if (!stage) {
        return;
    }

    const watermark =
        stage.querySelector(
            ".fjmc-video-watermark"
        );

    if (!watermark) {
        return;
    }

    let positionIndex = 0;

    function moveWatermark() {

        const position =
            fjmcVideoWatermarkPositions[
                positionIndex
            ];

        if (!position) {
            return;
        }

        const left =
            position[0];

        const top =
            position[1];

        const rotation =
            position[2];

        watermark.style.left =
            left + "%";

        watermark.style.top =
            top + "%";

        watermark.style.transform =
            `
            translate(-50%, -50%)
            rotate(${rotation}deg)
            `;

        positionIndex =
            (
                positionIndex + 1
            ) %
            fjmcVideoWatermarkPositions.length;

    }

    moveWatermark();

    fjmcVideoWatermarkTimer =
        setInterval(
            moveWatermark,
            5000
        );

}


/* =========================================================
   STOP WATERMARK MOVEMENT
========================================================= */

function fjmcStopVideoWatermark() {

    if (
        fjmcVideoWatermarkTimer
    ) {

        clearInterval(
            fjmcVideoWatermarkTimer
        );

        fjmcVideoWatermarkTimer =
            null;
    }

}


/* =========================================================
   FULLSCREEN SUPPORT
   FULLSCREEN THE STAGE, NOT THE VIDEO
========================================================= */

async function fjmcToggleVideoFullscreen(
    stage
) {

    if (!stage) {
        return;
    }

    try {

        if (
            document.fullscreenElement
        ) {

            await document.exitFullscreen();

            return;
        }

        if (
            stage.requestFullscreen
        ) {

            await stage.requestFullscreen();

        } else if (
            stage.webkitRequestFullscreen
        ) {

            stage.webkitRequestFullscreen();

        }

    } catch (error) {

        console.error(
            "Fullscreen error:",
            error
        );

    }

}


/* =========================================================
   ADD CUSTOM FULLSCREEN BUTTON
========================================================= */

function fjmcAddFullscreenButton(
    stage
) {

    if (!stage) {
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        "fjmc-video-fullscreen-button";

    button.innerHTML =
        "⛶";

    button.title =
        "Fullscreen";

    button.setAttribute(
        "aria-label",
        "Fullscreen"
    );

    button.style.cssText = `
        position:absolute;

        right:12px;
        bottom:12px;

        width:42px;
        height:38px;

        border:0;
        border-radius:7px;

        background:rgba(0,0,0,.72);

        color:#fff;

        font-size:24px;
        line-height:1;

        cursor:pointer;

        z-index:1000000;

        display:flex;
        align-items:center;
        justify-content:center;

        opacity:.90;
    `;

    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            fjmcToggleVideoFullscreen(
                stage
            );

        }
    );

    stage.appendChild(
        button
    );

}


/* =========================================================
   FULLSCREEN CHANGE
========================================================= */

document.addEventListener(
    "fullscreenchange",
    function() {

        const fullscreenStage =
            document.fullscreenElement;

        if (
            fullscreenStage &&
            fullscreenStage.classList.contains(
                "fjmc-video-stage"
            )
        ) {

            fullscreenStage.style.width =
                "100vw";

            fullscreenStage.style.height =
                "100vh";

            fullscreenStage.style.aspectRatio =
                "auto";

            fullscreenStage.style.background =
                "#000";

        } else {

            const stages =
                document.querySelectorAll(
                    ".fjmc-video-stage"
                );

            stages.forEach(
                function(stage) {

                    stage.style.width =
                        "100%";

                    stage.style.height =
                        "";

                    stage.style.aspectRatio =
                        "16/9";

                }
            );

        }

    }
);


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


    /*
     * Disable YouTube's own fullscreen button.
     * Our custom fullscreen button fullscreen's the
     * complete stage, so watermark remains visible.
     */
    let youtubeUrl =
        url || "";

    try {

        const separator =
            youtubeUrl.includes("?")
                ? "&"
                : "?";

        if (
            !/[?&]fs=/.test(
                youtubeUrl
            )
        ) {

            youtubeUrl +=
                separator +
                "fs=0";

        }

    } catch (error) {

        console.warn(
            "YouTube URL processing:",
            error
        );

    }


    body.innerHTML = `

        <div
            id="fjmcYouTubeVideoStage"
            class="fjmc-video-stage"
            style="
                position:relative;
                width:100%;
                aspect-ratio:16/9;
                background:#000;
                overflow:hidden;
            "
        >

            <iframe
                src="${youtubeUrl}"
                title="${title}"
                style="
                    width:100%;
                    height:100%;
                    border:0;
                    display:block;
                "
                allow="
                    accelerometer;
                    autoplay;
                    encrypted-media;
                    gyroscope;
                    picture-in-picture;
                    fullscreen
                "
                allowfullscreen>
            </iframe>

        </div>
    `;


    const stage =
        document.getElementById(
            "fjmcYouTubeVideoStage"
        );


    if (!stage) {
        return;
    }


    const watermark =
        fjmcCreateVideoWatermark();


    stage.appendChild(
        watermark
    );


    fjmcAddFullscreenButton(
        stage
    );


    fjmcStartVideoWatermark(
        stage
    );

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

        <div
            id="fjmcLocalVideoStage"
            class="fjmc-video-stage"
            style="
                position:relative;
                width:100%;
                aspect-ratio:16/9;
                max-height:80vh;
                background:#000;
                overflow:hidden;
            "
        >

            <video
                controls
                controlsList="nodownload nofullscreen"
                disablePictureInPicture
                playsinline
                style="
                    width:100%;
                    height:100%;
                    display:block;
                    background:#000;
                    object-fit:contain;
                "
            >

                <source
                    src="${url}"
                    type="video/mp4"
                >

                Your browser does not support video.

            </video>

        </div>
    `;


    const stage =
        document.getElementById(
            "fjmcLocalVideoStage"
        );


    if (!stage) {
        return;
    }


    const watermark =
        fjmcCreateVideoWatermark();


    stage.appendChild(
        watermark
    );


    fjmcAddFullscreenButton(
        stage
    );


    fjmcStartVideoWatermark(
        stage
    );

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

                fjmcStopVideoWatermark();

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
    function(event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "copy",
    function(event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "cut",
    function(event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "selectstart",
    function(event) {

        event.preventDefault();

    }
);


document.addEventListener(
    "keydown",
    function(event) {

        const key =
            event.key.toLowerCase();

        if (
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
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
