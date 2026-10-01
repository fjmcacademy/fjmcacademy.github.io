import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    initializeAuth,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getDocs,
    getDoc,
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   ADMIN
   ========================================================= */

const ADMIN_EMAIL =
    "fjmcacademy1008@gmail.com";


/* =========================================================
   STATE
   ========================================================= */

let students = [];
let courses = [];
let results = [];
let tests = [];
let devices = [];

let editingStudentId = null;
let editingCourseId = null;
let editingTestId = null;

let assignedCourseIds = new Set();


/* =========================================================
   SECONDARY AUTH
   ========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyA19k56JFSzdeCvS1DthDcqTNYprtJTw8I",

    authDomain:
        "fjmcacademy.firebaseapp.com",

    projectId:
        "fjmcacademy",

    storageBucket:
        "fjmcacademy.firebasestorage.app",

    messagingSenderId:
        "474981170098",

    appId:
        "1:474981170098:web:8ca392cfc54708a09082ab",

    measurementId:
        "G-45N1FRFSMJ"

};


const secondaryAdminApp =
    initializeApp(
        firebaseConfig,
        "secondaryAdminApp"
    );


const secondaryAuth =
    initializeAuth(
        secondaryAdminApp,
        {
            persistence:
                browserSessionPersistence
        }
    );


/* =========================================================
   HELPERS
   ========================================================= */

function esc(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function val(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";

}


function setVal(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.value =
            value ?? "";

    }

}


function showLoginMessage(
    message,
    type = "notice"
) {

    const box =
        document.getElementById(
            "loginMsg"
        );

    if (!box) return;

    box.textContent =
        message;

    box.className =
        "notice " +
        (
            type === "error"
                ? "error"
                : type === "success"
                    ? "success"
                    : ""
        );

}


function isAdminUser(user) {

    return (
        user &&
        (
            user.email || ""
        ).toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
    );

}


/* =========================================================
   LOGIN
   ========================================================= */

const loginForm =
    document.getElementById(
        "adminLoginForm"
    );


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const email =
                val("adminEmail");

            const password =
                document.getElementById(
                    "adminPassword"
                ).value;


            if (
                email.toLowerCase() !==
                ADMIN_EMAIL.toLowerCase()
            ) {

                showLoginMessage(
                    "Sirf admin account login kar sakta hai.",
                    "error"
                );

                return;

            }


            try {

                showLoginMessage(
                    "Login ho raha hai..."
                );


                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


                showLoginMessage(
                    "Login successful.",
                    "success"
                );


            } catch (error) {

                console.error(
                    error
                );


                showLoginMessage(
                    error.message ||
                    "Login failed.",
                    "error"
                );

            }

        }
    );

}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
    auth,
    async function(user) {

        const loginView =
            document.getElementById(
                "loginView"
            );

        const app =
            document.getElementById(
                "app"
            );


        if (!user) {

            loginView?.classList.remove(
                "hidden"
            );

            app?.classList.add(
                "hidden"
            );

            return;

        }


        if (!isAdminUser(user)) {

            await signOut(auth);

            loginView?.classList.remove(
                "hidden"
            );

            app?.classList.add(
                "hidden"
            );

            showLoginMessage(
                "Ye account admin nahi hai.",
                "error"
            );

            return;

        }


        loginView?.classList.add(
            "hidden"
        );

        app?.classList.remove(
            "hidden"
        );


        const adminUser =
            document.getElementById(
                "adminUser"
            );


        if (adminUser) {

            adminUser.textContent =
                user.email || "";

        }


        await loadAllData();

    }
);


/* =========================================================
   LOGOUT
   ========================================================= */

document
    .getElementById("logoutBtn")
    ?.addEventListener(
        "click",
        async function() {

            await signOut(auth);

        }
    );


/* =========================================================
   NAVIGATION
   ========================================================= */

document
    .querySelectorAll(
        "[data-section]"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    const sectionId =
                        button.dataset.section;


                    document
                        .querySelectorAll(
                            ".section"
                        )
                        .forEach(
                            section => {

                                section.classList.toggle(
                                    "active",
                                    section.id ===
                                    sectionId
                                );

                            }
                        );


                    document
                        .querySelectorAll(
                            "[data-section]"
                        )
                        .forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );

                }
            );

        }
    );


/* =========================================================
   LOAD ALL DATA
   ========================================================= */

async function loadAllData() {

    try {

        const [
            studentSnap,
            courseSnap,
            resultSnap,
            testSnap
        ] = await Promise.all([

            getDocs(
                collection(
                    db,
                    "students"
                )
            ),

            getDocs(
                collection(
                    db,
                    "courses"
                )
            ),

            getDocs(
                collection(
                    db,
                    "testResults"
                )
            ),

            getDocs(
                collection(
                    db,
                    "tests"
                )
            )

        ]);


        students =
            studentSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        courses =
            courseSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        results =
            resultSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        tests =
            testSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        renderEverything();


    } catch (error) {

        console.error(
            "Load error:",
            error
        );

        alert(
            "Data load error:\n" +
            error.message
        );

    }

}


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function renderEverything() {

    renderStats();

    fillAllFilters();

    renderStudents();

    renderCourses();

    renderCourseChecklist();

    renderTests();

    renderResults();

    renderDevices();

}


/* =========================================================
   STATS
   ========================================================= */

function renderStats() {

    document.getElementById(
        "statStudents"
    ).textContent =
        students.length;


    document.getElementById(
        "statCourses"
    ).textContent =
        courses.length;


    document.getElementById(
        "statResults"
    ).textContent =
        results.length;


    document.getElementById(
        "statTests"
    ).textContent =
        tests.length;

}


/* =========================================================
   UNIQUE VALUES
   ========================================================= */

function uniqueValues(
    array,
    key
) {

    return [
        ...new Set(
            array
                .map(
                    item =>
                        String(
                            item[key] ?? ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ].sort(
        (a,b) =>
            a.localeCompare(
                b
            )
    );

}


/* =========================================================
   FILL SELECT
   ========================================================= */

function fillSelect(
    id,
    values,
    firstText
) {

    const select =
        document.getElementById(id);

    if (!select) return;


    const oldValue =
        select.value;


    select.innerHTML =
        `<option value="">${firstText}</option>`;


    values.forEach(
        value => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                value;

            select.appendChild(
                option
            );

        }
    );


    if (
        values.includes(
            oldValue
        )
    ) {

        select.value =
            oldValue;

    }

}


/* =========================================================
   ALL FILTERS
   ========================================================= */

function fillAllFilters() {

    const allItems =
        [
            ...students,
            ...courses,
            ...tests
        ];


    const exams =
        uniqueValues(
            allItems,
            "exam"
        );


    const batches =
        uniqueValues(
            allItems,
            "batch"
        );


    const years =
        uniqueValues(
            allItems,
            "year"
        );


    fillSelect(
        "studentExamFilter",
        exams,
        "All Exams"
    );

    fillSelect(
        "studentBatchFilter",
        batches,
        "All Batches"
    );

    fillSelect(
        "studentYearFilter",
        years,
        "All Years"
    );


    fillSelect(
        "courseExamFilter",
        exams,
        "All Exams"
    );

    fillSelect(
        "courseBatchFilter",
        batches,
        "All Batches"
    );

    fillSelect(
        "courseYearFilter",
        years,
        "All Years"
    );


    fillSelect(
        "courseAssignExamFilter",
        uniqueValues(
            courses,
            "exam"
        ),
        "All Exams"
    );

    fillSelect(
        "courseAssignBatchFilter",
        uniqueValues(
            courses,
            "batch"
        ),
        "All Batches"
    );

    fillSelect(
        "courseAssignYearFilter",
        uniqueValues(
            courses,
            "year"
        ),
        "All Years"
    );


    fillSelect(
        "testExamFilter",
        uniqueValues(
            tests,
            "exam"
        ),
        "All Exams"
    );

    fillSelect(
        "testBatchFilter",
        uniqueValues(
            tests,
            "batch"
        ),
        "All Batches"
    );

    fillSelect(
        "testYearFilter",
        uniqueValues(
            tests,
            "year"
        ),
        "All Years"
    );


    const courseIds =
        [
            ...new Set(
                tests
                    .map(
                        t =>
                            t.courseId
                    )
                    .filter(Boolean)
            )
        ];


    fillSelect(
        "testCourseFilter",
        courseIds,
        "All Courses"
    );

}


/* =========================================================
   STUDENT FORM
   ========================================================= */

document
    .getElementById("studentForm")
    ?.addEventListener(
        "submit",
        saveStudent
    );


async function saveStudent(event) {

    event.preventDefault();


    const email =
        val("sEmail");

    const password =
        document.getElementById(
            "sPassword"
        ).value;

    const name =
        val("sName");

    const exam =
        val("sExam");

    const batch =
        val("sBatch");

    const year =
        val("sYear");


    const selectedCourses =
        [
            ...document.querySelectorAll(
                "#courseChecklist input[type=checkbox]:checked"
            )
        ]
        .map(
            input =>
                input.value
        );


    try {

        /* =========================================
           EDIT EXISTING
           ========================================= */

        if (editingStudentId) {

            await updateDoc(
                doc(
                    db,
                    "students",
                    editingStudentId
                ),
                {

                    email,
                    name,
                    exam,
                    batch,
                    year,

                    courses:
                        selectedCourses,

                    updatedAt:
                        Date.now()

                }
            );


            alert(
                "Student updated successfully."
            );

        }

        /* =========================================
           NEW STUDENT
           ========================================= */

        else {

            if (!password) {

                alert(
                    "New student ke liye password required hai."
                );

                return;

            }


            const credential =
                await createUserWithEmailAndPassword(
                    secondaryAuth,
                    email,
                    password
                );


            const uid =
                credential.user.uid;


            await setDoc(
                doc(
                    db,
                    "students",
                    uid
                ),
                {

                    email,
                    name,
                    exam,
                    batch,
                    year,

                    courses:
                        selectedCourses,

                    createdAt:
                        Date.now(),

                    updatedAt:
                        Date.now()

                }
            );


            alert(
                "Student created successfully."
            );

        }


        clearStudentForm();

        await loadAllData();


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Student save error:\n" +
            error.message
        );

    }

}


/* =========================================================
   CLEAR STUDENT
   ========================================================= */

function clearStudentForm() {

    editingStudentId =
        null;

    document
        .getElementById(
            "studentForm"
        )
        ?.reset();

    assignedCourseIds =
        new Set();

    renderCourseChecklist();

}


document
    .getElementById(
        "newStudentBtn"
    )
    ?.addEventListener(
        "click",
        clearStudentForm
    );


/* =========================================================
   STUDENT FILTER EVENTS
   ========================================================= */

[
    "studentSearch",
    "studentExamFilter",
    "studentBatchFilter",
    "studentYearFilter"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                renderStudents
            );

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderStudents
            );

    }
);


/* =========================================================
   RENDER STUDENTS
   ========================================================= */

function renderStudents() {

    const area =
        document.getElementById(
            "studentsTable"
        );

    if (!area) return;


    const search =
        val("studentSearch")
            .toLowerCase();

    const exam =
        val("studentExamFilter");

    const batch =
        val("studentBatchFilter");

    const year =
        val("studentYearFilter");


    const filtered =
        students.filter(
            student => {

                const text =
                    [
                        student.name,
                        student.email,
                        student.exam,
                        student.batch,
                        student.year
                    ]
                    .join(" ")
                    .toLowerCase();


                return (

                    (!search ||
                        text.includes(
                            search
                        )
                    )

                    &&

                    (!exam ||
                        student.exam ===
                        exam
                    )

                    &&

                    (!batch ||
                        student.batch ===
                        batch
                    )

                    &&

                    (!year ||
                        String(
                            student.year
                        ) ===
                        String(year)
                    )

                );

            }
        );


    if (!filtered.length) {

        area.innerHTML =
            `<div class="empty">No students found.</div>`;

        return;

    }


    let html = `

        <table class="table">

            <thead>

                <tr>

                    <th>Name</th>
                    <th>Email</th>
                    <th>Exam</th>
                    <th>Batch</th>
                    <th>Year</th>
                    <th>Courses</th>
                    <th>Actions</th>

                </tr>

            </thead>

            <tbody>

    `;


    filtered.forEach(
        student => {

            const courseCount =
                Array.isArray(
                    student.courses
                )
                    ? student.courses.length
                    : 0;


            html += `

                <tr>

                    <td>
                        ${esc(
                            student.name
                        )}
                    </td>

                    <td>
                        ${esc(
                            student.email
                        )}
                    </td>

                    <td>
                        ${esc(
                            student.exam
                        )}
                    </td>

                    <td>
                        ${esc(
                            student.batch
                        )}
                    </td>

                    <td>
                        ${esc(
                            student.year
                        )}
                    </td>

                    <td>
                        <span class="pill">
                            ${courseCount}
                        </span>
                    </td>

                    <td>

                        <button
                            class="btn muted"
                            data-edit-student="${esc(student.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn danger"
                            data-delete-student="${esc(student.id)}"
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `;

        }
    );


    html += `
            </tbody>
        </table>
    `;


    area.innerHTML =
        html;


    area
        .querySelectorAll(
            "[data-edit-student]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        editStudent(
                            button.dataset.editStudent
                        )
                );

            }
        );


    area
        .querySelectorAll(
            "[data-delete-student]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        deleteStudent(
                            button.dataset.deleteStudent
                        )
                );

            }
        );

}


/* =========================================================
   EDIT STUDENT
   ========================================================= */

function editStudent(id) {

    const student =
        students.find(
            s => s.id === id
        );

    if (!student) return;


    editingStudentId =
        id;


    setVal(
        "sEmail",
        student.email
    );

    setVal(
        "sName",
        student.name
    );

    setVal(
        "sExam",
        student.exam
    );

    setVal(
        "sBatch",
        student.batch
    );

    setVal(
        "sYear",
        student.year
    );


    setVal(
        "sPassword",
        ""
    );


    assignedCourseIds =
        new Set(
            Array.isArray(
                student.courses
            )
                ? student.courses
                : []
        );


    renderCourseChecklist();


    document
        .getElementById(
            "students"
        )
        ?.scrollIntoView({
            behavior:"smooth"
        });

}


/* =========================================================
   DELETE STUDENT
   ========================================================= */

async function deleteStudent(id) {

    if (
        !confirm(
            "Student Firestore record delete karna hai?"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                "students",
                id
            )
        );


        await loadAllData();


    } catch (error) {

        alert(
            "Delete error:\n" +
            error.message
        );

    }

}


/* =========================================================
   COURSE CHECKLIST
   ========================================================= */

[
    "courseAssignSearch",
    "courseAssignExamFilter",
    "courseAssignBatchFilter",
    "courseAssignYearFilter"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                renderCourseChecklist
            );

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderCourseChecklist
            );

    }
);


function renderCourseChecklist() {

    const area =
        document.getElementById(
            "courseChecklist"
        );

    if (!area) return;


    const search =
        val(
            "courseAssignSearch"
        )
        .toLowerCase();

    const exam =
        val(
            "courseAssignExamFilter"
        );

    const batch =
        val(
            "courseAssignBatchFilter"
        );

    const year =
        val(
            "courseAssignYearFilter"
        );


    const filtered =
        courses.filter(
            course => {

                const text =
                    [
                        course.id,
                        course.courseId,
                        course.title,
                        course.subject,
                        course.exam,
                        course.batch,
                        course.year
                    ]
                    .join(" ")
                    .toLowerCase();


                return (

                    (!search ||
                        text.includes(
                            search
                        )
                    )

                    &&

                    (!exam ||
                        course.exam === exam
                    )

                    &&

                    (!batch ||
                        course.batch === batch
                    )

                    &&

                    (!year ||
                        String(
                            course.year
                        ) ===
                        String(year)
                    )

                );

            }
        );


    if (!filtered.length) {

        area.innerHTML =
            `<div class="empty">No courses found.</div>`;

        return;

    }


    let html = "";


    filtered.forEach(
        course => {

            const id =
                course.id ||
                course.courseId;


            const checked =
                assignedCourseIds.has(
                    id
                )
                    ? "checked"
                    : "";


            html += `

                <label class="check">

                    <input
                        type="checkbox"
                        value="${esc(id)}"
                        ${checked}
                    >

                    <div class="check-info">

                        <strong>
                            ${esc(
                                course.title ||
                                id
                            )}
                        </strong>

                        <div class="small">

                            ${esc(
                                course.subject || ""
                            )}

                            ·

                            ${esc(
                                course.exam || ""
                            )}

                            ·

                            ${esc(
                                course.batch || ""
                            )}

                            ·

                            ${esc(
                                course.year || ""
                            )}

                        </div>

                    </div>

                </label>

            `;

        }
    );


    area.innerHTML =
        html;


    area
        .querySelectorAll(
            "input[type=checkbox]"
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    function() {

                        if (
                            checkbox.checked
                        ) {

                            assignedCourseIds.add(
                                checkbox.value
                            );

                        } else {

                            assignedCourseIds.delete(
                                checkbox.value
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   SELECT VISIBLE COURSES
   ========================================================= */

document
    .getElementById(
        "selectVisibleCoursesBtn"
    )
    ?.addEventListener(
        "click",
        function() {

            document
                .querySelectorAll(
                    "#courseChecklist input[type=checkbox]"
                )
                .forEach(
                    checkbox => {

                        checkbox.checked =
                            true;

                        assignedCourseIds.add(
                            checkbox.value
                        );

                    }
                );

        }
    );


/* =========================================================
   COURSE FORM
   ========================================================= */

document
    .getElementById("courseForm")
    ?.addEventListener(
        "submit",
        saveCourse
    );


async function saveCourse(event) {

    event.preventDefault();


    const courseId =
        val("cId");


    const data = {

        courseId,

        exam:
            val("cExam"),

        batch:
            val("cBatch"),

        year:
            val("cYear"),

        subject:
            val("cSubject"),

        title:
            val("cTitle"),

        description:
            val("cDescription"),

        testId:
            val("cTestId"),

        contents:
            readContents(),

        updatedAt:
            Date.now()

    };


    try {

        const id =
            editingCourseId ||
            courseId;


        await setDoc(
            doc(
                db,
                "courses",
                id
            ),
            data,
            {
                merge:true
            }
        );


        alert(
            "Course saved successfully."
        );


        clearCourseForm();

        await loadAllData();


    } catch (error) {

        alert(
            "Course save error:\n" +
            error.message
        );

    }

}


/* =========================================================
   CONTENT EDITOR
   ========================================================= */

function readContents() {

    return [
        ...document.querySelectorAll(
            "#contentsEditor .content-row"
        )
    ]
    .map(
        row => {

            const inputs =
                row.querySelectorAll(
                    "input,select"
                );


            return {

                type:
                    inputs[0]?.value || "",

                title:
                    inputs[1]?.value || "",

                url:
                    inputs[2]?.value || ""

            };

        }
    );

}


function addContentRow(
    content = {}
) {

    const editor =
        document.getElementById(
            "contentsEditor"
        );

    if (!editor) return;


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "content-row";


    row.innerHTML = `

        <select>

            <option value="video">
                Video
            </option>

            <option value="pdf">
                PDF
            </option>

            <option value="link">
                Link
            </option>

            <option value="notes">
                Notes
            </option>

        </select>

        <input
            placeholder="Content title"
            value="${esc(
                content.title || ""
            )}"
        >

        <input
            placeholder="URL"
            value="${esc(
                content.url || ""
            )}"
        >

        <button
            type="button"
            class="btn danger"
        >
            Remove
        </button>

    `;


    const select =
        row.querySelector(
            "select"
        );


    if (content.type) {

        select.value =
            content.type;

    }


    row
        .querySelector(
            "button"
        )
        .addEventListener(
            "click",
            () =>
                row.remove()
        );


    editor.appendChild(
        row
    );

}


document
    .getElementById(
        "addContentBtn"
    )
    ?.addEventListener(
        "click",
        () =>
            addContentRow()
    );


function clearCourseForm() {

    editingCourseId =
        null;

    document
        .getElementById(
            "courseForm"
        )
        ?.reset();

    document
        .getElementById(
            "contentsEditor"
        ).innerHTML =
        "";

}


document
    .getElementById(
        "newCourseBtn"
    )
    ?.addEventListener(
        "click",
        clearCourseForm
    );


/* =========================================================
   COURSE FILTERS
   ========================================================= */

[
    "courseSearch",
    "courseExamFilter",
    "courseBatchFilter",
    "courseYearFilter"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                renderCourses
            );

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderCourses
            );

    }
);


/* =========================================================
   RENDER COURSES
   ========================================================= */

function renderCourses() {

    const area =
        document.getElementById(
            "coursesTable"
        );

    if (!area) return;


    const search =
        val("courseSearch")
            .toLowerCase();

    const exam =
        val("courseExamFilter");

    const batch =
        val("courseBatchFilter");

    const year =
        val("courseYearFilter");


    const filtered =
        courses.filter(
            course => {

                const text =
                    [
                        course.id,
                        course.courseId,
                        course.title,
                        course.subject,
                        course.exam,
                        course.batch,
                        course.year
                    ]
                    .join(" ")
                    .toLowerCase();


                return (

                    (!search ||
                        text.includes(
                            search
                        )
                    )

                    &&

                    (!exam ||
                        course.exam === exam
                    )

                    &&

                    (!batch ||
                        course.batch === batch
                    )

                    &&

                    (!year ||
                        String(
                            course.year
                        ) ===
                        String(year)
                    )

                );

            }
        );


    if (!filtered.length) {

        area.innerHTML =
            `<div class="empty">No courses found.</div>`;

        return;

    }


    let html = `

        <table class="table">

            <thead>

                <tr>

                    <th>Course</th>
                    <th>Exam</th>
                    <th>Batch</th>
                    <th>Year</th>
                    <th>Subject</th>
                    <th>Content</th>
                    <th>Actions</th>

                </tr>

            </thead>

            <tbody>

    `;


    filtered.forEach(
        course => {

            html += `

                <tr>

                    <td>
                        <strong>
                            ${esc(
                                course.title ||
                                course.id
                            )}
                        </strong>

                        <div class="small">
                            ${esc(
                                course.id
                            )}
                        </div>
                    </td>

                    <td>
                        ${esc(
                            course.exam
                        )}
                    </td>

                    <td>
                        ${esc(
                            course.batch
                        )}
                    </td>

                    <td>
                        ${esc(
                            course.year
                        )}
                    </td>

                    <td>
                        ${esc(
                            course.subject
                        )}
                    </td>

                    <td>
                        ${
                            Array.isArray(
                                course.contents
                            )
                                ? course.contents.length
                                : 0
                        }
                    </td>

                    <td>

                        <button
                            class="btn muted"
                            data-edit-course="${esc(course.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn danger"
                            data-delete-course="${esc(course.id)}"
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `;

        }
    );


    html += `
            </tbody>
        </table>
    `;


    area.innerHTML =
        html;


    area
        .querySelectorAll(
            "[data-edit-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        editCourse(
                            button.dataset.editCourse
                        )
                );

            }
        );


    area
        .querySelectorAll(
            "[data-delete-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        deleteCourse(
                            button.dataset.deleteCourse
                        )
                );

            }
        );

}


/* =========================================================
   EDIT COURSE
   ========================================================= */

function editCourse(id) {

    const course =
        courses.find(
            c => c.id === id
        );

    if (!course) return;


    editingCourseId =
        id;


    setVal(
        "cId",
        course.courseId ||
        id
    );

    setVal(
        "cExam",
        course.exam
    );

    setVal(
        "cBatch",
        course.batch
    );

    setVal(
        "cYear",
        course.year
    );

    setVal(
        "cSubject",
        course.subject
    );

    setVal(
        "cTitle",
        course.title
    );

    setVal(
        "cDescription",
        course.description
    );

    setVal(
        "cTestId",
        course.testId
    );


    const editor =
        document.getElementById(
            "contentsEditor"
        );


    editor.innerHTML =
        "";


    (
        course.contents || []
    )
    .forEach(
        content =>
            addContentRow(
                content
            )
    );


    document
        .getElementById(
            "courses"
        )
        ?.scrollIntoView({
            behavior:"smooth"
        });

}


/* =========================================================
   DELETE COURSE
   ========================================================= */

async function deleteCourse(id) {

    if (
        !confirm(
            "Course delete karna hai?"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                "courses",
                id
            )
        );


        await loadAllData();


    } catch (error) {

        alert(
            "Delete error:\n" +
            error.message
        );

    }

}


/* =========================================================
   ================= TEST MANAGEMENT =======================
   ========================================================= */


/* =========================================================
   TEST FORM
   ========================================================= */

document
    .getElementById(
        "testForm"
    )
    ?.addEventListener(
        "submit",
        saveTest
    );


async function saveTest(event) {

    event.preventDefault();


    const testId =
        val("tId");


    const questions =
        readQuestions();


    if (!questions.length) {

        alert(
            "At least 1 question add karo."
        );

        return;

    }


    const hasCorrect =
        questions.every(
            question =>
                question.options.some(
                    option =>
                        option.correct === true
                )
        );


    if (!hasCorrect) {

        alert(
            "Har question me correct answer select karo."
        );

        return;

    }


    const data = {

        testId,

        exam:
            val("tExam"),

        batch:
            val("tBatch"),

        year:
            val("tYear"),

        courseId:
            val("tCourseId"),

        lectureId:
            val("tLectureId"),

        lectureTitle:
            val("tLectureTitle"),

        testNumber:
            Number(
                val("tTestNumber")
            ),

        title:
            val("tTitle"),

        duration:
            Number(
                val("tDuration")
            ),

        active:
            document.getElementById(
                "tActive"
            ).checked,

        questions,

        updatedAt:
            Date.now()

    };


    try {

        const id =
            editingTestId ||
            testId;


        await setDoc(
            doc(
                db,
                "tests",
                id
            ),
            data,
            {
                merge:true
            }
        );


        alert(
            "Test saved successfully."
        );


        clearTestForm();

        await loadAllData();


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Test save error:\n" +
            error.message
        );

    }

}


/* =========================================================
   QUESTIONS
   ========================================================= */

function addQuestion(
    question = {}
) {

    const editor =
        document.getElementById(
            "questionsEditor"
        );

    if (!editor) return;


    const index =
        editor.children.length;


    const options =
        Array.isArray(
            question.options
        )
            ? question.options
            : [];


    const optionData = [];


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        optionData.push(
            options[i] || {

                text:"",
                correct:false,
                solution:""

            }
        );

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "question-editor";


    wrapper.innerHTML = `

        <div class="question-header">

            <div class="question-number">
                Question ${index + 1}
            </div>

            <button
                type="button"
                class="btn danger remove-question"
            >
                Remove
            </button>

        </div>


        <label>

            Question

            <textarea
                class="q-text"
                placeholder="Enter question"
                required
            >${esc(
                question.question || ""
            )}</textarea>

        </label>


        <div class="q-options"></div>

    `;


    const optionsArea =
        wrapper.querySelector(
            ".q-options"
        );


    optionData.forEach(
        function(
            option,
            optionIndex
        ) {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "option-editor";


            row.innerHTML = `

                <input
                    type="radio"
                    name="correct-${Date.now()}-${Math.random()}"
                    class="correct-option"
                    ${option.correct ? "checked" : ""}
                    title="Correct answer"
                >

                <input
                    class="option-text"
                    placeholder="Option ${optionIndex + 1}"
                    value="${esc(
                        option.text || ""
                    )}"
                >

                <input
                    class="option-solution"
                    placeholder="Explanation / solution"
                    value="${esc(
                        option.solution || ""
                    )}"
                >

                <span class="small">
                    Correct
                </span>

            `;


            optionsArea.appendChild(
                row
            );

        }
    );


    wrapper
        .querySelector(
            ".remove-question"
        )
        .addEventListener(
            "click",
            function() {

                wrapper.remove();

                renumberQuestions();

            }
        );


    editor.appendChild(
        wrapper
    );


    renumberQuestions();

}


function renumberQuestions() {

    document
        .querySelectorAll(
            "#questionsEditor .question-editor"
        )
        .forEach(
            function(wrapper,index) {

                const title =
                    wrapper.querySelector(
                        ".question-number"
                    );

                if (title) {

                    title.textContent =
                        "Question " +
                        (
                            index + 1
                        );

                }

            }
        );

}


function readQuestions() {

    return [
        ...
        document.querySelectorAll(
            "#questionsEditor .question-editor"
        )
    ]
    .map(
        wrapper => {

            const question =
                wrapper
                    .querySelector(
                        ".q-text"
                    )
                    .value
                    .trim();


            const optionRows =
                wrapper.querySelectorAll(
                    ".option-editor"
                );


            const options =
                [
                    ...optionRows
                ]
                .map(
                    row => {

                        return {

                            text:
                                row
                                    .querySelector(
                                        ".option-text"
                                    )
                                    .value
                                    .trim(),

                            correct:
                                row
                                    .querySelector(
                                        ".correct-option"
                                    )
                                    .checked,

                            solution:
                                row
                                    .querySelector(
                                        ".option-solution"
                                    )
                                    .value
                                    .trim()

                        };

                    }
                );


            return {

                question,
                options

            };

        }
    );

}


/* =========================================================
   ADD QUESTION
   ========================================================= */

document
    .getElementById(
        "addQuestionBtn"
    )
    ?.addEventListener(
        "click",
        () =>
            addQuestion()
    );


/* =========================================================
   NEW TEST
   ========================================================= */

function clearTestForm() {

    editingTestId =
        null;


    document
        .getElementById(
            "testForm"
        )
        ?.reset();


    document
        .getElementById(
            "questionsEditor"
        ).innerHTML =
        "";


    document.getElementById(
        "tActive"
    ).checked =
        true;


    setVal(
        "tDuration",
        "30"
    );

    setVal(
        "tTestNumber",
        "1"
    );

}


document
    .getElementById(
        "newTestBtn"
    )
    ?.addEventListener(
        "click",
        clearTestForm
    );


/* =========================================================
   TEST FILTERS
   ========================================================= */

[
    "testSearch",
    "testExamFilter",
    "testBatchFilter",
    "testYearFilter",
    "testCourseFilter"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                renderTests
            );

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderTests
            );

    }
);


/* =========================================================
   RENDER TESTS
   ========================================================= */

function renderTests() {

    const area =
        document.getElementById(
            "testsList"
        );

    if (!area) return;


    const search =
        val("testSearch")
            .toLowerCase();

    const exam =
        val("testExamFilter");

    const batch =
        val("testBatchFilter");

    const year =
        val("testYearFilter");

    const course =
        val("testCourseFilter");


    const filtered =
        tests.filter(
            test => {

                const text =
                    [
                        test.id,
                        test.testId,
                        test.title,
                        test.exam,
                        test.batch,
                        test.year,
                        test.courseId,
                        test.lectureId
                    ]
                    .join(" ")
                    .toLowerCase();


                return (

                    (!search ||
                        text.includes(
                            search
                        )
                    )

                    &&

                    (!exam ||
                        test.exam === exam
                    )

                    &&

                    (!batch ||
                        test.batch === batch
                    )

                    &&

                    (!year ||
                        String(
                            test.year
                        ) ===
                        String(year)
                    )

                    &&

                    (!course ||
                        test.courseId ===
                        course
                    )

                );

            }
        );


    if (!filtered.length) {

        area.innerHTML =
            `<div class="empty">No tests found.</div>`;

        return;

    }


    filtered.sort(
        (a,b) =>
            String(
                a.courseId || ""
            )
            .localeCompare(
                String(
                    b.courseId || ""
                )
            )
    );


    let html = "";


    filtered.forEach(
        test => {

            const questionCount =
                Array.isArray(
                    test.questions
                )
                    ? test.questions.length
                    : 0;


            const active =
                test.active !== false;


            html += `

                <div class="test-list-card">

                    <div class="test-list-top">

                        <div>

                            <strong>
                                ${esc(
                                    test.title ||
                                    test.id
                                )}
                            </strong>

                            <div class="small">
                                ${esc(
                                    test.id
                                )}
                            </div>

                        </div>


                        <div>

                            ${
                                active
                                    ? `
                                        <span class="pill green">
                                            Active
                                        </span>
                                      `
                                    : `
                                        <span class="pill red">
                                            Disabled
                                        </span>
                                      `
                            }

                        </div>

                    </div>


                    <div class="test-meta">

                        <span class="pill">
                            Exam: ${esc(
                                test.exam
                            )}
                        </span>

                        <span class="pill">
                            Batch: ${esc(
                                test.batch
                            )}
                        </span>

                        <span class="pill">
                            Year: ${esc(
                                test.year
                            )}
                        </span>

                        <span class="pill">
                            Course: ${esc(
                                test.courseId
                            )}
                        </span>

                        <span class="pill">
                            Lecture: ${esc(
                                test.lectureId
                            )}
                        </span>

                        <span class="pill">
                            Test: ${esc(
                                test.testNumber
                            )}
                        </span>

                        <span class="pill">
                            ${esc(
                                test.duration
                            )} min
                        </span>

                        <span class="pill">
                            ${questionCount} questions
                        </span>

                    </div>


                    <div class="test-actions"
                         style="margin-top:12px">

                        <button
                            class="btn muted"
                            data-edit-test="${esc(test.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn ${active ? "danger" : "green-btn"}"
                            data-toggle-test="${esc(test.id)}"
                        >
                            ${
                                active
                                    ? "Disable"
                                    : "Enable"
                            }
                        </button>

                        <button
                            class="btn danger"
                            data-delete-test="${esc(test.id)}"
                        >
                            Delete
                        </button>

                    </div>

                </div>

            `;

        }
    );


    area.innerHTML =
        html;


    area
        .querySelectorAll(
            "[data-edit-test]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        editTest(
                            button.dataset.editTest
                        )
                );

            }
        );


    area
        .querySelectorAll(
            "[data-toggle-test]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        toggleTest(
                            button.dataset.toggleTest
                        )
                );

            }
        );


    area
        .querySelectorAll(
            "[data-delete-test]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        deleteTest(
                            button.dataset.deleteTest
                        )
                );

            }
        );

}


/* =========================================================
   EDIT TEST
   ========================================================= */

function editTest(id) {

    const test =
        tests.find(
            t => t.id === id
        );

    if (!test) return;


    editingTestId =
        id;


    setVal(
        "tId",
        test.testId ||
        id
    );

    setVal(
        "tExam",
        test.exam
    );

    setVal(
        "tBatch",
        test.batch
    );

    setVal(
        "tYear",
        test.year
    );

    setVal(
        "tCourseId",
        test.courseId
    );

    setVal(
        "tLectureId",
        test.lectureId
    );

    setVal(
        "tLectureTitle",
        test.lectureTitle
    );

    setVal(
        "tTestNumber",
        test.testNumber
    );

    setVal(
        "tDuration",
        test.duration
    );

    setVal(
        "tTitle",
        test.title
    );


    document.getElementById(
        "tActive"
    ).checked =
        test.active !== false;


    const editor =
        document.getElementById(
            "questionsEditor"
        );


    editor.innerHTML =
        "";


    (
        test.questions || []
    )
    .forEach(
        question =>
            addQuestion(
                question
            )
    );


    document
        .getElementById(
            "tests"
        )
        ?.scrollIntoView({
            behavior:"smooth"
        });

}


/* =========================================================
   ENABLE / DISABLE
   ========================================================= */

async function toggleTest(id) {

    const test =
        tests.find(
            t => t.id === id
        );

    if (!test) return;


    const newStatus =
        test.active === false;


    try {

        await updateDoc(
            doc(
                db,
                "tests",
                id
            ),
            {

                active:
                    newStatus,

                updatedAt:
                    Date.now()

            }
        );


        await loadAllData();


    } catch (error) {

        alert(
            "Status update error:\n" +
            error.message
        );

    }

}


/* =========================================================
   DELETE TEST
   ========================================================= */

async function deleteTest(id) {

    if (
        !confirm(
            "Test delete karna hai?\n\nExisting student results delete nahi honge."
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                "tests",
                id
            )
        );


        await loadAllData();


    } catch (error) {

        alert(
            "Test delete error:\n" +
            error.message
        );

    }

}


/* =========================================================
   RESULTS
   ========================================================= */

[
    "resultSearch",
    "resultExamFilter",
    "resultBatchFilter",
    "resultCourseFilter",
    "resultSubjectFilter"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                renderResults
            );

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderResults
            );

    }
);


document
    .getElementById(
        "refreshResultsBtn"
    )
    ?.addEventListener(
        "click",
        loadAllData
    );


function resultStudent(result) {

    return students.find(
        student =>
            student.id ===
                result.studentId ||
            student.id ===
                result.uid ||
            student.email ===
                result.email
    );

}


function resultCourse(result) {

    return (
        result.courseId ||
        result.courseID ||
        result.course ||
        ""
    );

}


function resultTest(result) {

    return (
        result.testId ||
        result.testID ||
        result.testName ||
        result.testTitle ||
        result.test ||
        ""
    );

}


function renderResults() {

    const area =
        document.getElementById(
            "resultsTable"
        );

    const summary =
        document.getElementById(
            "resultSummary"
        );


    if (!area) return;


    const search =
        val("resultSearch")
            .toLowerCase();

    const examFilter =
        val("resultExamFilter");

    const batchFilter =
        val("resultBatchFilter");

    const courseFilter =
        val("resultCourseFilter");

    const subjectFilter =
        val("resultSubjectFilter");


    const filtered =
        results.filter(
            result => {

                const student =
                    resultStudent(
                        result
                    );


                const courseId =
                    resultCourse(
                        result
                    );


                const course =
                    courses.find(
                        c =>
                            c.id ===
                            courseId ||
                            c.courseId ===
                            courseId
                    );


                const text =
                    [
                        result.name,
                        result.email,
                        result.course,
                        result.courseId,
                        result.testId,
                        result.testName,
                        result.testTitle,
                        course?.title,
                        course?.subject,
                        course?.exam,
                        course?.batch
                    ]
                    .join(" ")
                    .toLowerCase();


                const exam =
                    course?.exam ||
                    result.exam ||
                    "";


                const batch =
                    course?.batch ||
                    result.batch ||
                    "";


                const subject =
                    course?.subject ||
                    result.subject ||
                    "";


                return (

                    (!search ||
                        text.includes(
                            search
                        )
                    )

                    &&

                    (!examFilter ||
                        exam === examFilter
                    )

                    &&

                    (!batchFilter ||
                        batch === batchFilter
                    )

                    &&

                    (!courseFilter ||
                        courseId === courseFilter
                    )

                    &&

                    (!subjectFilter ||
                        subject === subjectFilter
                    )

                );

            }
        );


    if (summary) {

        summary.innerHTML = `

            <span class="pill">
                Showing: ${filtered.length}
            </span>

            <span class="pill green">
                Total Results: ${results.length}
            </span>

        `;

    }


    if (!filtered.length) {

        area.innerHTML =
            `<div class="no-results">No results found.</div>`;

        return;

    }


    let html = `

        <div class="table-wrap">

        <table class="table">

            <thead>

                <tr>

                    <th>Student</th>
                    <th>Email</th>
                    <th>Course</th>
                    <th>Test</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Submitted</th>
                    <th>Action</th>

                </tr>

            </thead>

            <tbody>

    `;


    filtered.forEach(
        result => {

            const percentage =
                result.percentage ??
                (
                    Number(result.total || 0) > 0
                        ? (
                            Number(result.score || 0) /
                            Number(result.total || 1) *
                            100
                        ).toFixed(2)
                        : "0"
                );


            const date =
                result.submittedAt
                    ? new Date(
                        Number(
                            result.submittedAt
                        )
                    ).toLocaleString()
                    : "-";


            html += `

                <tr>

                    <td>
                        ${esc(
                            result.name ||
                            "Student"
                        )}
                    </td>

                    <td>
                        ${esc(
                            result.email
                        )}
                    </td>

                    <td>
                        ${esc(
                            resultCourse(
                                result
                            )
                        )}
                    </td>

                    <td>
                        ${esc(
                            resultTest(
                                result
                            )
                        )}
                    </td>

                    <td>

                        <span class="score">
                            ${esc(
                                result.score
                            )}
                            /
                            ${esc(
                                result.total
                            )}
                        </span>

                    </td>

                    <td>
                        ${esc(
                            percentage
                        )}%
                    </td>

                    <td>
                        ${esc(
                            date
                        )}
                    </td>

                    <td>

                        <button
                            class="btn danger"
                            data-delete-result="${esc(result.id)}"
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `;

        }
    );


    html += `

            </tbody>

        </table>

        </div>

    `;


    area.innerHTML =
        html;


    area
        .querySelectorAll(
            "[data-delete-result]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        deleteResult(
                            button.dataset.deleteResult
                        )
                );

            }
        );

}


/* =========================================================
   RESULT FILTER VALUES
   ========================================================= */

function refreshResultFilters() {

    const examValues =
        [
            ...new Set(
                courses
                    .map(
                        c => c.exam
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    const batchValues =
        [
            ...new Set(
                courses
                    .map(
                        c => c.batch
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    const courseValues =
        [
            ...new Set(
                results
                    .map(
                        resultCourse
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    const subjectValues =
        [
            ...new Set(
                courses
                    .map(
                        c => c.subject
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    fillSelect(
        "resultExamFilter",
        examValues,
        "All Exams"
    );

    fillSelect(
        "resultBatchFilter",
        batchValues,
        "All Batches"
    );

    fillSelect(
        "resultCourseFilter",
        courseValues,
        "All Courses"
    );

    fillSelect(
        "resultSubjectFilter",
        subjectValues,
        "All Subjects"
    );

}


async function deleteResult(id) {

    if (
        !confirm(
            "Ye result delete karna hai?"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                "testResults",
                id
            )
        );


        await loadAllData();


    } catch (error) {

        alert(
            "Result delete error:\n" +
            error.message
        );

    }

}


document
    .getElementById(
        "clearResultsBtn"
    )
    ?.addEventListener(
        "click",
        async function() {

            if (
                !confirm(
                    "WARNING:\n\nSaare test results permanently delete honge.\n\nContinue?"
                )
            ) {

                return;

            }


            try {

                for (
                    const result
                    of results
                ) {

                    await deleteDoc(
                        doc(
                            db,
                            "testResults",
                            result.id
                        )
                    );

                }


                await loadAllData();


                alert(
                    "All test results deleted."
                );


            } catch (error) {

                alert(
                    "Delete error:\n" +
                    error.message
                );

            }

        }
    );


/* =========================================================
   DEVICES
   ========================================================= */

async function renderDevices() {

    const area =
        document.getElementById(
            "deviceStudents"
        );

    if (!area) return;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        let html = "";


        snapshot.forEach(
            userDoc => {

                const data =
                    userDoc.data();


                const userDevices =
                    Array.isArray(
                        data.devices
                    )
                        ? data.devices
                        : [];


                if (!userDevices.length) {

                    return;

                }


                html += `

                    <div class="device">

                        <strong>
                            ${esc(
                                data.email ||
                                userDoc.id
                            )}
                        </strong>

                        <div class="small">

                            ${userDevices.length}
                            device(s)

                        </div>

                        <button
                            class="btn danger"
                            data-release-devices="${esc(userDoc.id)}"
                        >
                            Release All
                        </button>

                    </div>

                `;

            }
        );


        area.innerHTML =
            html ||
            `<div class="empty">No reserved devices.</div>`;


        area
            .querySelectorAll(
                "[data-release-devices]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            releaseDevices(
                                button.dataset.releaseDevices
                            )
                    );

                }
            );


    } catch (error) {

        console.error(
            "Device load error:",
            error
        );


        area.innerHTML =
            `<div class="empty">
                Device data load nahi hua.
            </div>`;

    }

}


async function releaseDevices(uid) {

    if (
        !confirm(
            "Student ke saare device reservations release karne hain?"
        )
    ) {

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "users",
                uid
            ),
            {

                devices: []

            }
        );


        await renderDevices();


    } catch (error) {

        alert(
            "Device release error:\n" +
            error.message
        );

    }

}


/* =========================================================
   SEED BUTTON
   ========================================================= */

document
    .getElementById(
        "seedBtn"
    )
    ?.addEventListener(
        "click",
        function() {

            alert(
                "Existing hard-coded tests ko migrate karne ke liye ab Firestore Test Migration use karna hoga. Existing tests student side par fallback ke through chalenge."
            );

        }
    );


/* =========================================================
   INITIAL TEST QUESTION
   ========================================================= */

clearTestForm();


/* =========================================================
   FIX RESULT FILTERS AFTER DATA LOAD
   ========================================================= */

const originalRenderEverything =
    renderEverything;


/* refresh result filters through a safe
   periodic-independent wrapper */
function refreshAfterData() {

    refreshResultFilters();

    renderResults();

}


/* =========================================================
   OVERRIDE LOAD RENDER END
   ========================================================= */

const oldLoadAllData =
    loadAllData;


/* Existing loadAllData already renders
   everything. Result filters are refreshed
   here once after initial execution. */

setTimeout(
    function() {

        refreshResultFilters();

    },
    1000
);
