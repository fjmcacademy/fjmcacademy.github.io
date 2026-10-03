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
    serverTimestamp,
    runTransaction
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

    try {

        const cleanEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        if (!cleanEmail) {
            console.error("Dashboard: email missing.");
            return null;
        }

        console.log(
            "Dashboard: loading student:",
            cleanEmail
        );


        /* =====================================================
           1. EMAIL DOCUMENT ID
        ===================================================== */

        const emailDocId =
            studentDocId(cleanEmail);

        let studentSnap =
            await getDoc(
                doc(
                    db,
                    "students",
                    emailDocId
                )
            );


        /* =====================================================
           2. UID DOCUMENT ID FALLBACK
        ===================================================== */

        if (
            !studentSnap.exists() &&
            auth.currentUser &&
            auth.currentUser.uid
        ) {

            const uid =
                auth.currentUser.uid;

            console.log(
                "Dashboard: email document not found. Trying UID:",
                uid
            );

            studentSnap =
                await getDoc(
                    doc(
                        db,
                        "students",
                        uid
                    )
                );
        }


        /* =====================================================
           3. STUDENT NOT FOUND
        ===================================================== */

        if (!studentSnap.exists()) {

            console.error(
                "Dashboard: student document not found.",
                {
                    email: cleanEmail,
                    emailDocId: emailDocId,
                    uid: auth.currentUser
                        ? auth.currentUser.uid
                        : null
                }
            );

            return null;
        }


        /* =====================================================
           4. STUDENT DATA
        ===================================================== */

        const student =
            studentSnap.data() || {};


        console.log(
            "Dashboard: student loaded:",
            studentSnap.id
        );


        /* =====================================================
           5. COURSES
        ===================================================== */

        const courseIds =
            Array.isArray(student.courses)
                ? student.courses
                : [];


        console.log(
            "Dashboard: assigned courses:",
            courseIds
        );


        const courseEntries =
            await Promise.all(

                courseIds.map(
                    async function (courseId) {

                        try {

                            if (!courseId) {
                                return null;
                            }

                            const snap =
                                await getDoc(
                                    doc(
                                        db,
                                        "courses",
                                        String(courseId)
                                    )
                                );


                            if (!snap.exists()) {

                                console.warn(
                                    "Dashboard: course not found:",
                                    courseId
                                );

                                return null;
                            }


                            return [
                                String(courseId),
                                snap.data()
                            ];


                        } catch (error) {

                            console.error(
                                "Dashboard: course load error:",
                                courseId,
                                error
                            );

                            return null;
                        }

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


        console.log(
            "Dashboard: courses loaded:",
            COURSES
        );


        /* =====================================================
           6. TESTS

           Test loading failure will NOT stop dashboard.
        ===================================================== */

        window.FJMC_TESTS = [];


        try {

            const testSnap =
                await getDocs(
                    collection(
                        db,
                        "tests"
                    )
                );


            testSnap.forEach(
                function (d) {

                    const t =
                        d.data();

                    if (
                        t &&
                        courseIds.includes(
                            t.courseId
                        )
                    ) {

                        window.FJMC_TESTS.push({
                            id: d.id,
                            ...t
                        });

                    }

                }
            );


            console.log(
                "Dashboard: tests loaded:",
                window.FJMC_TESTS
            );


        } catch (testError) {

            console.warn(
                "Dashboard: test list load failed:",
                testError
            );

            window.FJMC_TESTS = [];

        }


        /* =====================================================
           7. SAVE STUDENT DATA
        ===================================================== */

        STUDENTS = {
            [cleanEmail]: student
        };


        console.log(
            "Dashboard: data loaded successfully."
        );


        return student;


    } catch (error) {

        console.error(
            "Dashboard: loadDashboardData FAILED:",
            error
        );

        throw error;

    }

}
/* =========================================================
   DEVICE SETTINGS
   EVERYTHING BELOW THIS POINT IS YOUR EXISTING SYSTEM
========================================================= */

const MAX_DEVICES = 2;
// Exactly two category slots: one mobile/tablet + one laptop/desktop.

const DEVICE_TIMEOUT =
    3 * 24 * 60 * 60 * 1000; // 3 days


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

    // iPhone/iPad/Android phones/tablets all share ONE mobile/tablet slot.
    // Windows/macOS/Linux laptops/desktops share ONE laptop/desktop slot.


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
        const now = Date.now();
        const deviceRef = doc(db, "users", user.uid, "devices", deviceId);
        const slotRef = doc(db, "users", user.uid, "deviceSlots", currentDeviceType);

        // IMPORTANT: Firestore transactions can read document references, not a Query.
        // We therefore reserve one deterministic slot for each category:
        //   mobile = mobile/tablet slot
        //   desktop = laptop/desktop slot
        // This prevents two phones/tablets or two computers from being accepted
        // at the same time, including a login race between two devices.
        const allowed = await runTransaction(db, async (tx) => {
            const currentSnap = await tx.get(deviceRef);
            const slotSnap = await tx.get(slotRef);

            let currentData = currentSnap.exists() ? (currentSnap.data() || {}) : {};
            let slotData = slotSnap.exists() ? (slotSnap.data() || {}) : {};

            // Existing reservation on this exact device remains valid until its
            // original 3-day expiry. Logout never releases it.
            const currentExpiry = Number(currentData.expiresAt || 0);
            if (currentSnap.exists() && currentExpiry > now) {
                if ((currentData.deviceType || currentDeviceType) !== currentDeviceType) {
                    return false;
                }

                if (!slotSnap.exists() || Number(slotData.expiresAt || 0) <= now || slotData.deviceId === deviceId) {
                    tx.set(slotRef, {
                        deviceId,
                        deviceType: currentDeviceType,
                        expiresAt: currentExpiry,
                        active: true,
                        updatedAt: now
                    }, { merge: true });
                }

                tx.set(deviceRef, {
                    email: user.email || "",
                    active: true,
                    deviceType: currentDeviceType,
                    lastSeen: now,
                    expiresAt: currentExpiry
                }, { merge: true });
                return true;
            }

            // If this category slot is still reserved by another device, reject.
            const slotExpiry = Number(slotData.expiresAt || 0);
            if (slotSnap.exists() && slotExpiry > now && slotData.deviceId && slotData.deviceId !== deviceId) {
                return false;
            }

            // Slot is free/expired. Reserve it for exactly 3 days.
            const expiresAt = now + DEVICE_TIMEOUT;
            tx.set(slotRef, {
                deviceId,
                deviceType: currentDeviceType,
                expiresAt,
                active: true,
                createdAt: serverTimestamp(),
                updatedAt: now
            }, { merge: true });

            tx.set(deviceRef, {
                email: user.email || "",
                active: true,
                deviceType: currentDeviceType,
                lastSeen: now,
                expiresAt,
                createdAt: currentSnap.exists() ? (currentData.createdAt || serverTimestamp()) : serverTimestamp()
            }, { merge: true });

            return true;
        });

        if (!allowed) {
            showDeviceLimitMessage();
            return false;
        }

        console.log("Device reservation accepted:", currentDeviceType);
        return true;
    } catch (error) {
        console.error("Device registration error:", error);
        showDeviceLimitMessage();
        return false;
    }
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

function showStudentCourses(student) {
    if (!coursesContainer) { console.error("coursesContainer not found"); hidePageLoading(); return; }
    coursesContainer.innerHTML = "";
    if (!student.courses || student.courses.length === 0) {
        coursesContainer.innerHTML = `<div class="no-course"><h3>No Course Assigned</h3><p>Please contact FJMC Academy.</p></div>`;
        hidePageLoading(); return;
    }
    const studentInfo = document.createElement("div");
    studentInfo.innerHTML = `<div style="margin-bottom:20px;padding:18px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)"><h3 style="margin:0 0 8px">${student.exam||""}</h3><p style="margin:4px 0"><strong>Batch:</strong> ${student.batch||""}</p><p style="margin:4px 0"><strong>Year:</strong> ${student.year||""}</p></div>`;
    coursesContainer.appendChild(studentInfo);

    student.courses.forEach(function(courseId) {
        const course = COURSES[courseId];
        if (!course) return;
        const card = document.createElement("div");
        card.className = "course-card";
        card.style.marginBottom = "18px";
        const contents = Array.isArray(course.contents) ? course.contents : [];
        const byLecture = {};
        contents.forEach(c => { const lid=String(c.lectureId||"1"); (byLecture[lid] ||= []).push(c); });
        const testLectureIds = (window.FJMC_TESTS||[]).filter(t=>t.courseId===courseId).map(t=>String(t.lectureId||"1"));
        const lectureIds = [...new Set([...Object.keys(byLecture), ...testLectureIds])].sort((x,y)=>Number(x)-Number(y));
        card.innerHTML = `<div class="course-title"><div style="font-size:13px;opacity:.85">${course.exam||student.exam||""} • ${course.batch||student.batch||""} • ${course.year||student.year||""}</div><h3>${course.title||course.subject||courseId}</h3><p>${course.description||""}</p></div>
        <div class="course-menu" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px">
          <button class="course-menu-btn" data-cat="video">🎥 Video</button>
          <button class="course-menu-btn" data-cat="pdf">📄 PDF</button>
          <button class="course-menu-btn" data-cat="test">📝 Test</button>
          <button class="course-menu-btn" data-cat="live">🔴 Live Class</button>
        </div>
        <div class="course-panel" style="display:none;margin-top:15px"></div>`;
        coursesContainer.appendChild(card);
        const panel=card.querySelector(".course-panel");
        card.querySelectorAll(".course-menu-btn").forEach(btn=>btn.addEventListener("click",()=>{
            const cat=btn.dataset.cat;
            panel.style.display="block";
            panel.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><strong>${cat==='test'?'Lecture-wise Tests':cat==='video'?'Lecture-wise Videos':cat==='pdf'?'Lecture-wise PDFs':'Lecture-wise Live Classes'}</strong><button class="close-course-panel" style="border:0;background:none;color:inherit;font-size:20px">×</button></div>`;
            const wrap=document.createElement("div"); panel.appendChild(wrap);
            const lids=lectureIds.length?lectureIds:["1"];
            lids.forEach(lid=>{
                const box=document.createElement("div"); box.style.cssText="padding:12px;margin:8px 0;border:1px solid rgba(255,255,255,.15);border-radius:10px";
                const lectureContents=byLecture[lid]||[];
                let items=[];
                if(cat==='test'){
                    // Tests are loaded from Firestore below; filter by lecture after getDocs.
                    items=(window.FJMC_TESTS||[]).filter(t=>t.courseId===courseId && String(t.lectureId)===lid).sort((a,b)=>Number(a.testNumber||0)-Number(b.testNumber||0));
                } else {
                    const types=cat==='video'?['video','local-video']:cat==='pdf'?['pdf']:['live'];
                    items=lectureContents.filter(x=>types.includes(x.type));
                }
                box.innerHTML=`<h4 style="margin:0 0 8px">📖 Lecture ${lid}</h4>`;
                if(!items.length){ box.innerHTML+=`<div style="opacity:.7">No ${cat==='test'?'test':cat==='live'?'live class':cat} available for this lecture.</div>`; }
                items.forEach(item=>{
                    const ib=document.createElement("button"); ib.className="content-button"; ib.style.cssText="display:block;width:100%;text-align:left;margin:6px 0;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit";
                    if(cat==='test'){
                        ib.textContent=`📝 Test ${item.testNumber||""} — ${item.title||"Test"}`;
                        ib.onclick=()=>window.location.href=`test.html?course=${encodeURIComponent(courseId)}&lecture=${encodeURIComponent(lid)}&test=${encodeURIComponent(item.testNumber)}`;
                    } else {
                        ib.textContent=(cat==='video'?'🎥 ':cat==='pdf'?'📄 ':'🔴 ')+(item.title||"Open");
                        ib.onclick=()=>{ if(item.type==='video') openYouTubeVideo(item.url,item.title); else if(item.type==='local-video') openLocalVideo(item.url,item.title); else if(item.type==='pdf') openPDFViewer(item.url,item.title); else if(item.type==='live') window.open(item.url,'_blank','noopener,noreferrer'); };
                    }
                    box.appendChild(ib);
                });
                wrap.appendChild(box);
            });
            panel.querySelector(".close-course-panel").onclick=()=>panel.style.display="none";
        }));
    });
    hidePageLoading();
}

function openMaterial(url,title){
    if(!url || url==="#"){ alert("Material link is not available yet."); return; }
    if(/^https?:\/\//i.test(url)) window.open(url,"_blank","noopener,noreferrer");
    else openPDFViewer(url,title||"Material");
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
