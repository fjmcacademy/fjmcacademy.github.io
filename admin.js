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
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  auth,
  db
} from "./firebase.js";


// =====================================================
// CONFIG
// =====================================================

const ADMIN_EMAIL = "fjmcacademy1008@gmail.com";


// =====================================================
// SECONDARY FIREBASE APP
// Used for creating student accounts without logging
// the admin out.
// =====================================================

const secondaryApp = initializeApp(
  {
    apiKey: "AIzaSyA19k56JFSzdeCvS1DthDcqTNYprtJTw8I",
    authDomain: "fjmcacademy.firebaseapp.com",
    projectId: "fjmcacademy",
    storageBucket: "fjmcacademy.firebasestorage.app",
    messagingSenderId: "474981170098",
    appId: "1:474981170098:web:8ca392cfc54708a09082ab",
    measurementId: "G-45N1FRFSMJ"
  },
  "secondaryAdminApp"
);

const secondaryAuth = initializeAuth(secondaryApp, {
  persistence: browserSessionPersistence
});


// =====================================================
// STATE
// =====================================================

let students = [];
let courses = [];
let results = [];
let tests = [];
let devices = [];

let editingStudentId = null;
let editingCourseId = null;

// Test editor state
let editingTestId = null;
let editingTestLectureId = null;
let editingTestNumber = null;
let testQuestions = [];
let testPdfObjectUrl = null;

let assignedCourseIds = new Set();


// =====================================================
// DOM HELPERS
// =====================================================

const $ = id => document.getElementById(id);

function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

function value(id) {
  return ($(id)?.value || "").trim();
}

function setValue(id, val) {
  if ($(id)) $(id).value = val ?? "";
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lower(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalize(value) {
  return lower(value);
}

function uniqueSorted(arr) {
  return [...new Set(
    arr
      .map(x => String(x ?? "").trim())
      .filter(Boolean)
  )].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function groupKey(...parts) {
  return parts.map(x => normalize(x)).join("|||");
}

function display(value, fallback = "—") {
  const v = String(value ?? "").trim();
  return v || fallback;
}


// =====================================================
// LOGIN MESSAGE
// =====================================================

function loginMessage(message, type = "notice") {
  const box = $("loginMsg");

  if (!box) return;

  box.className = "notice";

  if (type === "error") {
    box.classList.add("error");
  }

  if (type === "success") {
    box.classList.add("success");
  }

  box.textContent = message;
  box.classList.remove("hidden");
}


// =====================================================
// AUTH
// =====================================================

const loginForm = $("adminLoginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async event => {

    event.preventDefault();

    const email = value("adminEmail").toLowerCase();
    const password = $("adminPassword")?.value || "";

    if (!email || !password) {
      loginMessage("Email aur password dono enter karo.", "error");
      return;
    }

    if (email !== ADMIN_EMAIL) {
      loginMessage(
        "Ye email Admin account nahi hai.",
        "error"
      );
      return;
    }

    const button = loginForm.querySelector("button");

    if (button) {
      button.disabled = true;
      button.textContent = "Logging in...";
    }

    loginMessage("Firebase se login ho raha hai...");

    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      loginMessage(
        "Login successful.",
        "success"
      );

    } catch (error) {

      console.error("ADMIN LOGIN ERROR:", error);

      let msg = "Login failed.";

      switch (error.code) {

        case "auth/invalid-credential":
          msg = "Email ya password galat hai.";
          break;

        case "auth/wrong-password":
          msg = "Password galat hai.";
          break;

        case "auth/user-not-found":
          msg = "Ye admin email Firebase Authentication me registered nahi hai.";
          break;

        case "auth/invalid-email":
          msg = "Email address invalid hai.";
          break;

        case "auth/too-many-requests":
          msg = "Bahut baar login attempt hua. Thodi der baad try karo.";
          break;

        case "auth/network-request-failed":
          msg = "Internet connection check karo.";
          break;

        case "auth/user-disabled":
          msg = "Ye Firebase account disabled hai.";
          break;

        default:
          msg = error.message || "Login failed.";
      }

      loginMessage(msg, "error");

    } finally {

      if (button) {
        button.disabled = false;
        button.textContent = "Admin Login";
      }

    }

  });

}


// =====================================================
// AUTH STATE
// =====================================================

onAuthStateChanged(auth, async user => {

  console.log("Auth state:", user?.email || "signed out");

  if (!user) {

    show("loginView");
    hide("app");

    return;
  }


  const email = lower(user.email);

  if (email !== ADMIN_EMAIL) {

    await signOut(auth);

    show("loginView");
    hide("app");

    loginMessage(
      "Access denied. Sirf authorized Admin account allowed hai.",
      "error"
    );

    return;
  }


  // Admin verified

  hide("loginView");
  show("app");

  if ($("adminUser")) {
    $("adminUser").textContent = user.email;
  }

  try {

    await loadAllData();

  } catch (error) {

    console.error("LOAD ERROR:", error);

    alert(
      "Admin login ho gaya, lekin data load nahi hua.\n\n" +
      (error.message || "")
    );

  }

});


// =====================================================
// LOGOUT
// =====================================================

$("logoutBtn")?.addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

  }

});


// =====================================================
// NAVIGATION
// =====================================================

document.querySelectorAll(".side button[data-section]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const section = button.dataset.section;

      document
        .querySelectorAll(".side button")
        .forEach(btn =>
          btn.classList.remove("active")
        );

      button.classList.add("active");

      document
        .querySelectorAll(".section")
        .forEach(sec =>
          sec.classList.remove("active")
        );

      $(section)?.classList.add("active");

    });

  });


// =====================================================
// LOAD ALL DATA
// =====================================================

async function loadAllData() {

  const [
    studentSnap,
    courseSnap,
    resultSnap
  ] = await Promise.all([

    getDocs(collection(db, "students")),

    getDocs(collection(db, "courses")),

    getDocs(collection(db, "testResults"))

  ]);


  let testSnap = { docs: [] };
  try {
    testSnap = await getDocs(collection(db, "tests"));
  } catch (testError) {
    console.warn("TEST COLLECTION LOAD ERROR:", testError);
  }


  students = studentSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));


  courses = courseSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));


  results = resultSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));


  tests = testSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));


  renderEverything();

}


// =====================================================
// RENDER EVERYTHING
// =====================================================

function renderEverything() {

  updateStats();

  renderStudentFilters();

  renderCourseFilters();

  renderResultFilters();

  renderStudents();

  renderCourses();

  renderCourseChecklist();

  // Render the Test Management section and populate
  // Exam / Year / Batch / Subject filters.
  renderTestManager();

  renderResults();

  renderDevices();

}


// =====================================================
// STATS
// =====================================================

function updateStats() {

  if ($("statStudents")) {
    $("statStudents").textContent =
      students.length;
  }

  if ($("statCourses")) {
    $("statCourses").textContent =
      courses.length;
  }

  if ($("statResults")) {
    $("statResults").textContent =
      results.length;
  }

  if ($("statTests")) {

    const ids = new Set();

    courses.forEach(course => {

      if (course.testId) {
        ids.add(course.testId);
      }

      if (course.testID) {
        ids.add(course.testID);
      }

    });

    tests.forEach(test => {

      if (test.id) ids.add(test.id);
      if (test.testId) ids.add(test.testId);

    });

    results.forEach(result => {

      if (result.testId) {
        ids.add(result.testId);
      }

      if (result.testID) {
        ids.add(result.testID);
      }

      if (result.test) {
        ids.add(result.test);
      }

    });

    $("statTests").textContent =
      ids.size;

  }

}


// =====================================================
// STUDENT FILTERS
// =====================================================

function fillSelect(id, values, firstLabel) {

  const select = $(id);

  if (!select) return;

  const old = select.value;

  select.innerHTML =
    `<option value="">${esc(firstLabel)}</option>`;

  uniqueSorted(values).forEach(item => {

    const option = document.createElement("option");

    option.value = item;
    option.textContent = item;

    select.appendChild(option);

  });

  if (
    [...select.options]
      .some(option => option.value === old)
  ) {
    select.value = old;
  }

}


function renderStudentFilters() {

  fillSelect(
    "studentExamFilter",
    students.map(s => s.exam),
    "All Exams"
  );

  fillSelect(
    "studentBatchFilter",
    students.map(s => s.batch),
    "All Batches"
  );

  fillSelect(
    "studentYearFilter",
    students.map(s => s.year),
    "All Years"
  );

}


// =====================================================
// COURSE FILTERS
// =====================================================

function renderCourseFilters() {

  fillSelect(
    "courseExamFilter",
    courses.map(c => c.exam),
    "All Exams"
  );

  fillSelect(
    "courseBatchFilter",
    courses.map(c => c.batch),
    "All Batches"
  );

  fillSelect(
    "courseYearFilter",
    courses.map(c => c.year),
    "All Years"
  );


  fillSelect(
    "courseAssignExamFilter",
    courses.map(c => c.exam),
    "All Exams"
  );

  fillSelect(
    "courseAssignBatchFilter",
    courses.map(c => c.batch),
    "All Batches"
  );

  fillSelect(
    "courseAssignYearFilter",
    courses.map(c => c.year),
    "All Years"
  );

}


// =====================================================
// STUDENT SEARCH
// =====================================================

function filteredStudents() {

  const search =
    normalize(value("studentSearch"));

  const exam =
    normalize(value("studentExamFilter"));

  const batch =
    normalize(value("studentBatchFilter"));

  const year =
    normalize(value("studentYearFilter"));


  return students.filter(student => {

    const haystack = [
      student.name,
      student.email,
      student.exam,
      student.batch,
      student.year
    ]
      .map(normalize)
      .join(" ");


    return (
      (!search || haystack.includes(search)) &&
      (!exam || normalize(student.exam) === exam) &&
      (!batch || normalize(student.batch) === batch) &&
      (!year || normalize(student.year) === year)
    );

  });

}


// =====================================================
// STUDENT GROUPING
// EXAM → BATCH → YEAR → STUDENTS
// =====================================================

function renderStudents() {

  const container = $("studentsTable");

  if (!container) return;


  const list = filteredStudents();

  if (!list.length) {

    container.innerHTML =
      `<div class="no-results">No students found.</div>`;

    return;
  }


  const examGroups = new Map();


  list.forEach(student => {

    const exam = display(student.exam);
    const batch = display(student.batch);
    const year = display(student.year);

    if (!examGroups.has(exam)) {
      examGroups.set(exam, new Map());
    }

    const batchMap = examGroups.get(exam);

    if (!batchMap.has(batch)) {
      batchMap.set(batch, new Map());
    }

    const yearMap = batchMap.get(batch);

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }

    yearMap.get(year).push(student);

  });


  let html = "";


  for (const [exam, batchMap] of examGroups) {

    html += `
      <div class="group-card">

        <div class="group-header">
          <div class="group-title">
            📘 Exam: ${esc(exam)}
          </div>

          <div class="group-count">
            ${[...batchMap.values()]
              .flatMap(x => [...x.values()])
              .reduce((a,b) => a + b.length, 0)}
          </div>
        </div>
    `;


    for (const [batch, yearMap] of batchMap) {

      html += `
        <div style="padding:12px 15px 0;font-weight:800">
          📦 Batch: ${esc(batch)}
        </div>
      `;


      for (const [year, studentList] of yearMap) {

        html += `
          <div style="padding:10px 15px 0;color:#60a5fa;font-weight:800">
            📅 Year: ${esc(year)}
          </div>

          <div class="table-wrap">
            <table class="table">

              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Courses</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
        `;


        studentList.forEach(student => {

          const studentCourses =
            Array.isArray(student.courses)
              ? student.courses
              : [];

          html += `
            <tr>

              <td>
                <strong>${esc(display(student.name))}</strong>
              </td>

              <td>
                ${esc(display(student.email))}
              </td>

              <td>
                ${
                  studentCourses.length
                    ? studentCourses.map(id =>
                        `<span class="pill">${esc(id)}</span>`
                      ).join("")
                    : `<span class="pill gray">No courses</span>`
                }
              </td>

              <td>

                <button
                  class="btn muted"
                  onclick="window.editStudent('${esc(student.id)}')"
                >
                  Edit
                </button>

                <button
                  class="btn danger"
                  onclick="window.deleteStudent('${esc(student.id)}')"
                >
                  Delete
                </button>

              </td>

            </tr>
          `;

        });


        html += `
              </tbody>
            </table>
          </div>
        `;

      }

    }


    html += `</div>`;

  }


  container.innerHTML = html;

}


// =====================================================
// COURSE FILTERING
// =====================================================

function filteredCourses() {

  const search =
    normalize(value("courseSearch"));

  const exam =
    normalize(value("courseExamFilter"));

  const batch =
    normalize(value("courseBatchFilter"));

  const year =
    normalize(value("courseYearFilter"));


  return courses.filter(course => {

    const haystack = [
      course.id,
      course.courseId,
      course.title,
      course.subject,
      course.description,
      course.exam,
      course.batch,
      course.year,
      course.testId
    ]
      .map(normalize)
      .join(" ");


    return (
      (!search || haystack.includes(search)) &&
      (!exam || normalize(course.exam) === exam) &&
      (!batch || normalize(course.batch) === batch) &&
      (!year || normalize(course.year) === year)
    );

  });

}


// =====================================================
// COURSE GROUPING
// EXAM → BATCH → YEAR → COURSE
// =====================================================

function renderCourses() {

  const container = $("coursesTable");

  if (!container) return;


  const list = filteredCourses();

  if (!list.length) {

    container.innerHTML =
      `<div class="no-results">No courses found.</div>`;

    return;
  }


  const examGroups = new Map();


  list.forEach(course => {

    const exam = display(course.exam);
    const batch = display(course.batch);
    const year = display(course.year);

    if (!examGroups.has(exam)) {
      examGroups.set(exam, new Map());
    }

    const batchMap = examGroups.get(exam);

    if (!batchMap.has(batch)) {
      batchMap.set(batch, new Map());
    }

    const yearMap = batchMap.get(batch);

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }

    yearMap.get(year).push(course);

  });


  let html = "";


  for (const [exam, batchMap] of examGroups) {

    html += `
      <div class="group-card">

        <div class="group-header">
          <div class="group-title">
            📘 Exam: ${esc(exam)}
          </div>

          <div class="group-count">
            ${[...batchMap.values()]
              .flatMap(x => [...x.values()])
              .reduce((a,b) => a + b.length, 0)}
          </div>
        </div>
    `;


    for (const [batch, yearMap] of batchMap) {

      html += `
        <div style="padding:12px 15px 0;font-weight:800">
          📦 Batch: ${esc(batch)}
        </div>
      `;


      for (const [year, courseList] of yearMap) {

        html += `
          <div style="padding:10px 15px 0;color:#60a5fa;font-weight:800">
            📅 Year: ${esc(year)}
          </div>

          <div class="table-wrap">
            <table class="table">

              <thead>
                <tr>
                  <th>Course</th>
                  <th>Subject</th>
                  <th>Test</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
        `;


        courseList.forEach(course => {

          const id =
            course.id ||
            course.courseId ||
            "";


          html += `
            <tr>

              <td>
                <strong>
                  ${esc(display(course.title, id))}
                </strong>

                <div class="small">
                  ${esc(id)}
                </div>
              </td>

              <td>
                ${esc(display(course.subject))}
              </td>

              <td>
                ${esc(
                  display(
                    course.testId ||
                    course.testID ||
                    course.test
                  )
                )}
              </td>

              <td>
                ${esc(
                  display(
                    course.description,
                    ""
                  )
                )}
              </td>

              <td>

                <button
                  class="btn muted"
                  onclick="window.editCourse('${esc(id)}')"
                >
                  Edit
                </button>

                <button
                  class="btn danger"
                  onclick="window.deleteCourse('${esc(id)}')"
                >
                  Delete
                </button>

              </td>

            </tr>
          `;

        });


        html += `
              </tbody>
            </table>
          </div>
        `;

      }

    }


    html += `</div>`;

  }


  container.innerHTML = html;

}


// =====================================================
// COURSE ASSIGNMENT
// =====================================================

function filteredAssignmentCourses() {

  const search =
    normalize(value("courseAssignSearch"));

  const exam =
    normalize(value("courseAssignExamFilter"));

  const batch =
    normalize(value("courseAssignBatchFilter"));

  const year =
    normalize(value("courseAssignYearFilter"));


  return courses.filter(course => {

    const haystack = [
      course.id,
      course.courseId,
      course.title,
      course.subject,
      course.exam,
      course.batch,
      course.year
    ]
      .map(normalize)
      .join(" ");


    return (
      (!search || haystack.includes(search)) &&
      (!exam || normalize(course.exam) === exam) &&
      (!batch || normalize(course.batch) === batch) &&
      (!year || normalize(course.year) === year)
    );

  });

}


function renderCourseChecklist() {

  const container = $("courseChecklist");

  if (!container) return;


  const list = filteredAssignmentCourses();


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">No courses found.</div>`;

    return;
  }


  const groups = new Map();


  list.forEach(course => {

    const exam = display(course.exam);
    const batch = display(course.batch);
    const year = display(course.year);

    const key = groupKey(
      exam,
      batch,
      year
    );

    if (!groups.has(key)) {

      groups.set(key, {
        exam,
        batch,
        year,
        courses: []
      });

    }

    groups.get(key).courses.push(course);

  });


  let html = "";


  for (const group of groups.values()) {

    html += `
      <div class="assign-group">

        <div class="assign-group-header">
          📘 ${esc(group.exam)}
          →
          📦 ${esc(group.batch)}
          →
          📅 ${esc(group.year)}
        </div>
    `;


    group.courses.forEach(course => {

      const id =
        course.id ||
        course.courseId ||
        "";

      const checked =
        assignedCourseIds.has(id)
          ? "checked"
          : "";


      html += `
        <label class="check">

          <input
            type="checkbox"
            class="course-check"
            value="${esc(id)}"
            ${checked}
          >

          <div class="check-info">

            <strong>
              ${esc(
                display(
                  course.title,
                  id
                )
              )}
            </strong>

            <div class="small">
              ${esc(display(course.subject))}
              ${course.testId
                ? " • Test: " + esc(course.testId)
                : ""}
            </div>

          </div>

        </label>
      `;

    });


    html += `</div>`;

  }


  container.innerHTML = html;


  container
    .querySelectorAll(".course-check")
    .forEach(check => {

      check.addEventListener("change", () => {

        const id = check.value;

        if (check.checked) {
          assignedCourseIds.add(id);
        } else {
          assignedCourseIds.delete(id);
        }

      });

    });

}


// =====================================================
// STUDENT FORM
// =====================================================

$("studentForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const email =
      value("sEmail").toLowerCase();

    const password =
      $("sPassword")?.value || "";

    const name =
      value("sName");

    const exam =
      value("sExam");

    const batch =
      value("sBatch");

    const year =
      value("sYear");


    if (!email || !name || !exam || !batch || !year) {

      alert(
        "Email, Name, Exam, Batch aur Year required hain."
      );

      return;
    }


    const button =
      $("studentForm")
        .querySelector("button[type='submit']");

    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }


    try {

      let studentId = editingStudentId;


      // ---------------------------------------------
      // CREATE NEW AUTH USER
      // ---------------------------------------------

      if (!studentId) {

        if (!password || password.length < 6) {

          alert(
            "New student ke liye password minimum 6 characters ka hona chahiye."
          );

          return;
        }


        const credential =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );


        studentId =
          credential.user.uid;


        await signOut(secondaryAuth);

      }


      const studentData = {

        email,

        name,

        exam,

        batch,

        year,

        courses: [...assignedCourseIds],

        updatedAt: new Date().toISOString()

      };


      if (!editingStudentId) {
        studentData.createdAt =
          new Date().toISOString();
      }


      await setDoc(
        doc(db, "students", studentId),
        studentData,
        { merge: true }
      );


      alert(
        editingStudentId
          ? "Student updated successfully."
          : "Student created successfully."
      );


      clearStudentForm();

      await loadAllData();


    } catch (error) {

      console.error(
        "STUDENT SAVE ERROR:",
        error
      );


      let message =
        error.message ||
        "Student save failed.";


      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        message =
          "Ye email Firebase Authentication me already registered hai.";
      }


      alert(message);


    } finally {

      if (button) {

        button.disabled = false;
        button.textContent =
          "Save Student";

      }

    }

  }
);


// =====================================================
// CLEAR STUDENT
// =====================================================

function clearStudentForm() {

  editingStudentId = null;

  assignedCourseIds =
    new Set();


  setValue("sEmail", "");
  setValue("sPassword", "");
  setValue("sName", "");
  setValue("sExam", "");
  setValue("sBatch", "");
  setValue("sYear", "");


  renderCourseChecklist();

}


$("newStudentBtn")?.addEventListener(
  "click",
  clearStudentForm
);


// =====================================================
// EDIT STUDENT
// =====================================================

window.editStudent = function(id) {

  const student =
    students.find(s => s.id === id);

  if (!student) return;


  editingStudentId = id;


  setValue(
    "sEmail",
    student.email
  );

  setValue(
    "sName",
    student.name
  );

  setValue(
    "sExam",
    student.exam
  );

  setValue(
    "sBatch",
    student.batch
  );

  setValue(
    "sYear",
    student.year
  );

  setValue(
    "sPassword",
    ""
  );


  assignedCourseIds =
    new Set(
      Array.isArray(student.courses)
        ? student.courses
        : []
    );


  renderCourseChecklist();


  document
    .querySelector('[data-section="students"]')
    ?.click();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};


// =====================================================
// DELETE STUDENT
// =====================================================

window.deleteStudent = async function(id) {

  const student =
    students.find(s => s.id === id);

  if (!student) return;


  const ok =
    confirm(
      `Student "${student.name || student.email}" ko delete karna hai?`
    );


  if (!ok) return;


  try {

    await deleteDoc(
      doc(db, "students", id)
    );


    alert("Student profile deleted.");

    await loadAllData();


  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "Student delete failed."
    );

  }

};


// =====================================================
// SELECT VISIBLE COURSES
// =====================================================

$("selectVisibleCoursesBtn")
  ?.addEventListener("click", () => {

    filteredAssignmentCourses()
      .forEach(course => {

        const id =
          course.id ||
          course.courseId;

        if (id) {
          assignedCourseIds.add(id);
        }

      });


    renderCourseChecklist();

  });


// =====================================================
// COURSE SEARCH / FILTER EVENTS
// =====================================================

[
  "courseAssignSearch",
  "courseAssignExamFilter",
  "courseAssignBatchFilter",
  "courseAssignYearFilter"
].forEach(id => {

  $(id)?.addEventListener(
    "input",
    renderCourseChecklist
  );

  $(id)?.addEventListener(
    "change",
    renderCourseChecklist
  );

});


[
  "studentSearch",
  "studentExamFilter",
  "studentBatchFilter",
  "studentYearFilter"
].forEach(id => {

  $(id)?.addEventListener(
    "input",
    renderStudents
  );

  $(id)?.addEventListener(
    "change",
    renderStudents
  );

});


[
  "courseSearch",
  "courseExamFilter",
  "courseBatchFilter",
  "courseYearFilter"
].forEach(id => {

  $(id)?.addEventListener(
    "input",
    renderCourses
  );

  $(id)?.addEventListener(
    "change",
    renderCourses
  );

});


// =====================================================
// COURSE CONTENT EDITOR
// =====================================================

let contentRows = [];


function renderContentEditor() {

  const container =
    $("contentsEditor");

  if (!container) return;


  if (!contentRows.length) {

    container.innerHTML =
      `<div class="empty">
        No content added.
      </div>`;

    return;
  }


  container.innerHTML =
    contentRows.map((item, index) => `

      <div class="content-row">

        <input
          class="content-type"
          data-index="${index}"
          placeholder="video/pdf"
          value="${esc(item.type || "")}"
        >

        <input
          class="content-title"
          data-index="${index}"
          placeholder="Title"
          value="${esc(item.title || "")}"
        >

        <input
          class="content-url"
          data-index="${index}"
          placeholder="URL"
          value="${esc(item.url || "")}"
        >

        <button
          type="button"
          class="btn danger remove-content"
          data-index="${index}"
        >
          Delete
        </button>

      </div>

    `).join("");


  container
    .querySelectorAll(
      ".content-type,.content-title,.content-url"
    )
    .forEach(input => {

      input.addEventListener("input", () => {

        const i =
          Number(input.dataset.index);

        const row =
          contentRows[i];

        if (!row) return;


        if (
          input.classList.contains(
            "content-type"
          )
        ) {
          row.type = input.value;
        }

        if (
          input.classList.contains(
            "content-title"
          )
        ) {
          row.title = input.value;
        }

        if (
          input.classList.contains(
            "content-url"
          )
        ) {
          row.url = input.value;
        }

      });

    });


  container
    .querySelectorAll(".remove-content")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(button.dataset.index);

          contentRows.splice(
            index,
            1
          );

          renderContentEditor();

        }
      );

    });

}


$("addContentBtn")
  ?.addEventListener("click", () => {

    contentRows.push({
      type: "",
      title: "",
      url: ""
    });

    renderContentEditor();

  });


// =====================================================
// COURSE SAVE
// =====================================================

$("courseForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      value("cId");

    const exam =
      value("cExam");

    const batch =
      value("cBatch");

    const year =
      value("cYear");

    const subject =
      value("cSubject");

    const title =
      value("cTitle");

    const description =
      value("cDescription");

    const testId =
      value("cTestId");


    if (
      !id ||
      !exam ||
      !batch ||
      !year ||
      !subject ||
      !title
    ) {

      alert(
        "Course ID, Exam, Batch, Year, Subject aur Title required hain."
      );

      return;
    }


    try {

      await setDoc(
        doc(db, "courses", id),
        {

          courseId: id,

          exam,
          batch,
          year,

          subject,
          title,

          description,

          testId,

          contents: contentRows,

          updatedAt:
            new Date().toISOString()

        },
        { merge: true }
      );


      alert(
        editingCourseId
          ? "Course updated successfully."
          : "Course saved successfully."
      );


      clearCourseForm();

      await loadAllData();


    } catch (error) {

      console.error(
        "COURSE SAVE ERROR:",
        error
      );

      alert(
        error.message ||
        "Course save failed."
      );

    }

  }
);


// =====================================================
// CLEAR COURSE
// =====================================================

function clearCourseForm() {

  editingCourseId = null;

  setValue("cId", "");
  setValue("cExam", "");
  setValue("cBatch", "");
  setValue("cYear", "");
  setValue("cSubject", "");
  setValue("cTitle", "");
  setValue("cDescription", "");
  setValue("cTestId", "");

  contentRows = [];

  renderContentEditor();

}


$("newCourseBtn")
  ?.addEventListener(
    "click",
    clearCourseForm
  );


// =====================================================
// EDIT COURSE
// =====================================================

window.editCourse = function(id) {

  const course =
    courses.find(c =>
      c.id === id ||
      c.courseId === id
    );

  if (!course) return;


  editingCourseId = id;


  setValue(
    "cId",
    course.id || course.courseId
  );

  setValue(
    "cExam",
    course.exam
  );

  setValue(
    "cBatch",
    course.batch
  );

  setValue(
    "cYear",
    course.year
  );

  setValue(
    "cSubject",
    course.subject
  );

  setValue(
    "cTitle",
    course.title
  );

  setValue(
    "cDescription",
    course.description
  );

  setValue(
    "cTestId",
    course.testId ||
    course.testID ||
    ""
  );


  contentRows =
    Array.isArray(course.contents)
      ? JSON.parse(
          JSON.stringify(course.contents)
        )
      : [];


  renderContentEditor();


  document
    .querySelector('[data-section="courses"]')
    ?.click();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};


// =====================================================
// DELETE COURSE
// =====================================================

window.deleteCourse = async function(id) {

  const course =
    courses.find(c =>
      c.id === id ||
      c.courseId === id
    );

  if (!course) return;


  const ok =
    confirm(
      `Course "${course.title || id}" delete karna hai?`
    );


  if (!ok) return;


  try {

    await deleteDoc(
      doc(db, "courses", id)
    );


    alert("Course deleted.");

    await loadAllData();


  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "Course delete failed."
    );

  }

};


// =====================================================
// RESULT HELPERS
// =====================================================

function resultStudent(result) {

  const id =
    result.studentId ||
    result.studentID ||
    result.userId ||
    result.uid;


  if (id) {

    const found =
      students.find(
        student => student.id === id
      );

    if (found) return found;

  }


  const email =
    lower(
      result.studentEmail ||
      result.email
    );


  if (email) {

    const found =
      students.find(
        student =>
          lower(student.email) === email
      );

    if (found) return found;

  }


  return null;

}


function resultCourse(result) {

  const id =
    result.courseId ||
    result.courseID ||
    result.course;


  if (id) {

    const found =
      courses.find(course =>
        course.id === id ||
        course.courseId === id
      );

    if (found) return found;

  }


  return null;

}


function resultExam(result) {

  const student =
    resultStudent(result);

  const course =
    resultCourse(result);


  return display(
    result.exam ||
    course?.exam ||
    student?.exam
  );

}


function resultBatch(result) {

  const student =
    resultStudent(result);

  const course =
    resultCourse(result);


  return display(
    result.batch ||
    course?.batch ||
    student?.batch
  );

}


function resultCourseName(result) {

  const course =
    resultCourse(result);


  return display(
    result.courseTitle ||
    result.courseName ||
    course?.title ||
    result.courseId ||
    result.courseID ||
    result.course
  );

}


function resultSubject(result) {

  const course =
    resultCourse(result);


  return display(
    result.subject ||
    course?.subject
  );

}


function resultTest(result) {

  const course =
    resultCourse(result);


  return display(
    result.testName ||
    result.testTitle ||
    result.testId ||
    result.testID ||
    result.test ||
    course?.testId
  );

}


function resultStudentName(result) {

  const student =
    resultStudent(result);


  return display(
    result.studentName ||
    result.name ||
    student?.name
  );

}


function resultStudentEmail(result) {

  const student =
    resultStudent(result);


  return display(
    result.studentEmail ||
    result.email ||
    student?.email
  );

}


function resultScore(result) {

  if (
    result.score !== undefined &&
    result.score !== null
  ) {
    return result.score;
  }

  if (
    result.marks !== undefined &&
    result.marks !== null
  ) {
    return result.marks;
  }

  return "—";

}


function isEnrolled(result) {

  const student =
    resultStudent(result);


  if (!student) {
    return false;
  }


  const courseId =
    result.courseId ||
    result.courseID ||
    result.course;


  if (!courseId) {

    return true;

  }


  const assigned =
    Array.isArray(student.courses)
      ? student.courses
      : [];


  return assigned.includes(courseId);

}


// =====================================================
// TEST MANAGEMENT
// =====================================================

function clearTestForm() {
  editingTestId = null;
  editingTestLectureId = null;
  editingTestNumber = null;
  setValue("tTestId", "");
  setValue("tTestTitle", "");
  setValue("tLectureId", "1");
  setValue("tLectureTitle", "Lecture 1");
  setValue("tTestNumber", "1");
  setValue("tTitle", "");
  setValue("tDuration", "30");
  testQuestions = [];
  renderTestQuestionsEditor();
}

function renderTestQuestionsEditor() {
  const container = $("testQuestionsEditor");
  if (!container) return;

  if (!testQuestions.length) {
    container.innerHTML = `<div class="small">No questions. Click + Add Question.</div>`;
    return;
  }

  container.innerHTML = testQuestions.map((q, qi) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const four = [0,1,2,3].map(i => opts[i] || {text:"", correct:false, solution:""});
    const correctIndex = four.findIndex(o => o.correct);

    return `
      <div class="card" style="background:#0b1220;margin:12px 0;padding:14px">
        <div class="actions" style="justify-content:space-between;align-items:center;margin-top:0">
          <strong>Question ${qi + 1}</strong>
          <button type="button" class="btn danger remove-test-question" data-index="${qi}">Remove</button>
        </div>
        <label style="display:block;margin-top:10px">
          Question
          <textarea data-q-index="${qi}" data-field="question">${esc(q.question || "")}</textarea>
        </label>
        <div class="grid">
          ${four.map((o, oi) => `
            <div>
              <label>Option ${String.fromCharCode(65 + oi)}</label>
              <input data-q-index="${qi}" data-option-index="${oi}" data-option-field="text" value="${esc(o.text || "")}">
              <label style="display:block;margin-top:6px">
                <input type="radio" name="correct_${qi}" data-q-index="${qi}" data-option-index="${oi}" data-option-field="correct" ${correctIndex === oi ? "checked" : ""}>
                Correct option
              </label>
              <label style="display:block;margin-top:6px">
                Solution / Explanation
                <textarea data-q-index="${qi}" data-option-index="${oi}" data-option-field="solution">${esc(o.solution || "")}</textarea>
              </label>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-q-index]").forEach(el => {
    el.addEventListener("input", updateTestQuestionFromDOM);
    el.addEventListener("change", updateTestQuestionFromDOM);
  });

  container.querySelectorAll(".remove-test-question").forEach(btn => {
    btn.addEventListener("click", () => {
      testQuestions.splice(Number(btn.dataset.index), 1);
      renderTestQuestionsEditor();
    });
  });
}

function updateTestQuestionFromDOM(event) {
  const el = event.target;
  const qi = Number(el.dataset.qIndex);
  const oi = el.dataset.optionIndex === undefined ? null : Number(el.dataset.optionIndex);
  if (!testQuestions[qi]) return;

  if (oi === null) {
    testQuestions[qi].question = el.value;
    return;
  }

  if (!Array.isArray(testQuestions[qi].options)) testQuestions[qi].options = [];
  while (testQuestions[qi].options.length < 4) {
    testQuestions[qi].options.push({ text: "", correct: false, solution: "" });
  }

  if (el.dataset.optionField === "correct") {
    testQuestions[qi].options.forEach((o, index) => o.correct = index === oi);
  } else {
    testQuestions[qi].options[oi][el.dataset.optionField] = el.value;
  }
}

function metadataFromCourseId(courseId) {
  const raw = String(courseId || "").trim();
  const m = raw.match(/^(.+?)-(\d{4})-batch(\d+)-(.+)$/i);
  if (!m) return null;

  const examKey = m[1].toLowerCase();
  const examMap = {
    "csir-net": "CSIR NET",
    "iit-jam": "IIT JAM",
    "gate": "GATE"
  };

  return {
    id: raw,
    exam: examMap[examKey] || m[1].replace(/-/g, " ").replace(/\b\w/g, x => x.toUpperCase()),
    year: m[2],
    batch: `Batch ${m[3]}`,
    subject: m[4].replace(/-/g, " ").replace(/\b\w/g, x => x.toUpperCase()),
    title: m[4].replace(/-/g, " ").replace(/\b\w/g, x => x.toUpperCase()),
    testId: ""
  };
}

function testMetaFor(test) {
  const testId = test?.testId || test?.id || test?.courseId || "";
  const linkedCourses = courses.filter(course => {
    const cid = course?.testId || course?.testID || course?.test || course?.id;
    return cid && String(cid) === String(testId);
  });

  if (linkedCourses.length) return linkedCourses;

  const fromId = metadataFromCourseId(test?.courseId || test?.courseID || test?.course || test?.id || "");
  if (fromId) {
    fromId.testId = testId;
    return [{ ...fromId, title: test?.title || fromId.title }];
  }

  return [{
    id: "",
    exam: test?.exam || "",
    year: test?.year || "",
    batch: test?.batch || "",
    subject: test?.subject || test?.title || testId,
    title: test?.title || testId,
    testId
  }];
}

function getTestRows() {
  const rows = [];

  tests.forEach(test => {
    const lectures = test.lectures || {};
    const metas = testMetaFor(test);

    metas.forEach(course => {
      Object.entries(lectures).forEach(([lectureId, lecture]) => {
        Object.entries(lecture?.tests || {}).forEach(([testNumber, item]) => {
          rows.push({
            test,
            course,
            lectureId,
            lecture,
            testNumber,
            item
          });
        });
      });
    });
  });

  return rows;
}

function orderedUnique(values, preferred = []) {
  const clean = [];
  const seen = new Set();

  [...preferred, ...values].forEach(v => {
    const text = String(v ?? "").trim();
    if (!text) return;
    const key = lower(text);
    if (seen.has(key)) return;
    seen.add(key);
    clean.push(text);
  });

  return clean;
}

function fillTestFilters(rows) {
  // IMPORTANT: Filters must be populated from course/student metadata,
  // not only from test rows. Otherwise an empty/mismatched tests collection
  // leaves only the "All ..." option and the dropdown appears broken.
  const metadata = [
    ...courses,
    ...students,
    ...rows.map(r => r.course || {}),
    ...tests.map(t => ({
      exam: t.exam,
      year: t.year,
      batch: t.batch,
      subject: t.subject
    }))
  ];

  // Also derive Exam / Year / Batch / Subject from the course IDs used by
  // the existing student assignments, e.g.
  // csir-net-2026-batch1-real-analysis. This keeps the dropdowns populated
  // even when Firestore's courses collection is empty or older documents do
  // not yet contain the metadata fields.
  const assignedIds = students.flatMap(s => Array.isArray(s.courses) ? s.courses : []);
  assignedIds.forEach(id => {
    const meta = metadataFromCourseId(id);
    if (meta) metadata.push(meta);
  });

  courses.forEach(c => {
    const meta = metadataFromCourseId(c.id || c.courseId);
    if (meta) metadata.push({ ...meta, ...c });
  });

  const examValues = metadata.map(c => c.exam);
  const yearValues = metadata.map(c => c.year);
  const batchValues = metadata.map(c => c.batch);
  const subjectValues = metadata.map(c => c.subject);

  const fields = [
    ["testExamFilter", orderedUnique(examValues, ["CSIR NET", "IIT JAM", "GATE"]), "All Exams"],
    ["testYearFilter", orderedUnique(yearValues), "All Years"],
    ["testBatchFilter", orderedUnique(batchValues), "All Batches"],
    ["testSubjectFilter", orderedUnique(subjectValues), "All Subjects"]
  ];

  fields.forEach(([id, values, label]) => {
    const el = $(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = `<option value="">${label}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if ([...el.options].some(o => o.value === current)) el.value = current;
  });
}

function renderTestManager() {
  const container = $("testsTable");
  if (!container) return;

  const allRows = getTestRows();
  fillTestFilters(allRows);

  const exam = lower($("testExamFilter")?.value);
  const year = lower($("testYearFilter")?.value);
  const batch = lower($("testBatchFilter")?.value);
  const subject = lower($("testSubjectFilter")?.value);

  const rows = allRows.filter(r =>
    (!exam || lower(r.course.exam) === exam) &&
    (!year || lower(r.course.year) === year) &&
    (!batch || lower(r.course.batch) === batch) &&
    (!subject || lower(r.course.subject) === subject)
  );

  const uniqueTestDocs = new Set(rows.map(r => r.test.id));
  const uniqueCourseIds = new Set(rows.map(r => r.course.id).filter(Boolean));

  const summary = $("testSummary");
  if (summary) {
    summary.innerHTML = `
      <div class="card" style="margin:0;padding:12px;">
        <strong>${uniqueTestDocs.size}</strong><br><span class="small">Test Sets</span>
      </div>
      <div class="card" style="margin:0;padding:12px;">
        <strong>${uniqueCourseIds.size}</strong><br><span class="small">Courses / Subjects</span>
      </div>
      <div class="card" style="margin:0;padding:12px;">
        <strong>${rows.length}</strong><br><span class="small">Total Test Entries</span>
      </div>`;
  }

  if (!rows.length) {
    container.innerHTML = `<div class="no-results">No tests found for the selected Exam / Year / Batch / Subject.</div>`;
    return;
  }

  // Group exactly as requested: Exam → Year → Batch → Subject.
  const groups = new Map();
  rows.forEach(row => {
    const key = groupKey(row.course.exam, row.course.year, row.course.batch, row.course.subject);
    if (!groups.has(key)) {
      groups.set(key, {
        exam: display(row.course.exam),
        year: display(row.course.year),
        batch: display(row.course.batch),
        subject: display(row.course.subject),
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  });

  let html = "";
  for (const group of groups.values()) {
    const uniqueEntries = new Map();
    group.rows.forEach(r => {
      const key = `${r.test.id}|||${r.lectureId}|||${r.testNumber}`;
      if (!uniqueEntries.has(key)) uniqueEntries.set(key, r);
    });

    html += `
      <div class="card" style="margin-bottom:14px;border-left:4px solid #2563eb;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
          <h3 style="margin:0;">📚 ${esc(group.subject)}</h3>
          <div>
            <span class="pill">${esc(group.exam)}</span>
            <span class="pill">${esc(group.year)}</span>
            <span class="pill">${esc(group.batch)}</span>
            <span class="pill green">${uniqueEntries.size} Tests</span>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:10px;">
          <table class="table">
            <thead><tr>
              <th>Test ID</th><th>Lecture</th><th>Test No.</th><th>Test Title</th><th>Questions</th><th>Duration</th><th>Actions</th>
            </tr></thead><tbody>`;

    uniqueEntries.forEach(r => {
      html += `
        <tr>
          <td>${esc(r.test.testId || r.test.id)}</td>
          <td>${esc(r.lecture.title || r.lectureId)}</td>
          <td>${esc(r.testNumber)}</td>
          <td>${esc(r.item.title || r.testNumber)}</td>
          <td>${Array.isArray(r.item.questions) ? r.item.questions.length : 0}</td>
          <td>${esc(r.item.duration || 0)} min</td>
          <td>
            <div class="actions">
              <button class="btn primary edit-test-btn" data-test-id="${esc(r.test.id)}" data-lecture-id="${esc(r.lectureId)}" data-test-number="${esc(r.testNumber)}">Edit</button>
              <button class="btn muted preview-test-pdf-btn" data-test-id="${esc(r.test.id)}" data-lecture-id="${esc(r.lectureId)}" data-test-number="${esc(r.testNumber)}">Questions PDF</button>
              <button class="btn danger delete-test-btn" data-test-id="${esc(r.test.id)}" data-lecture-id="${esc(r.lectureId)}" data-test-number="${esc(r.testNumber)}">Delete</button>
            </div>
          </td>
        </tr>`;
    });

    html += `</tbody></table></div></div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll(".edit-test-btn").forEach(btn => {
    btn.addEventListener("click", () => editManagedTest(btn.dataset.testId, btn.dataset.lectureId, btn.dataset.testNumber));
  });

  container.querySelectorAll(".delete-test-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteManagedTest(btn.dataset.testId, btn.dataset.lectureId, btn.dataset.testNumber));
  });

  container.querySelectorAll(".preview-test-pdf-btn").forEach(btn => {
    btn.addEventListener("click", () => openTestQuestionsPDF(
      btn.dataset.testId,
      btn.dataset.lectureId,
      btn.dataset.testNumber
    ));
  });
}

["testExamFilter", "testYearFilter", "testBatchFilter", "testSubjectFilter"].forEach(id => {
  $(id)?.addEventListener("change", renderTestManager);
});

function openTestQuestionsPDF(testId, lectureId, testNumber) {
  const root = tests.find(t => String(t.id) === String(testId));
  const item = root?.lectures?.[lectureId]?.tests?.[testNumber];
  if (!root || !item) {
    alert("Test data nahi mila.");
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("PDF viewer library load nahi hui. Page refresh karke dobara try karo.");
    return;
  }

  const questions = Array.isArray(item.questions) ? item.questions : [];
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 16;

  const addWrapped = (text, x, fontSize = 10, gap = 5) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(String(text ?? ""), pageWidth - x - margin);
    const needed = lines.length * gap;
    if (y + needed > pageHeight - 14) {
      pdf.addPage();
      y = 16;
    }
    pdf.text(lines, x, y);
    y += needed + 2;
  };

  pdf.setFontSize(16);
  pdf.text("FJMC Academy - Test Questions", margin, y);
  y += 8;
  pdf.setFontSize(10);
  pdf.text(`Test: ${item.title || testNumber}`, margin, y); y += 5;
  pdf.text(`Lecture: ${root.lectures?.[lectureId]?.title || lectureId}    Duration: ${item.duration || 0} min`, margin, y); y += 8;

  if (!questions.length) {
    addWrapped("No questions added to this test.", margin);
  } else {
    questions.forEach((q, qi) => {
      if (y > pageHeight - 30) { pdf.addPage(); y = 16; }
      pdf.setFont(undefined, "bold");
      addWrapped(`Q${qi + 1}. ${q.question || "(Question text missing)"}`, margin, 11, 5);
      pdf.setFont(undefined, "normal");
      const opts = Array.isArray(q.options) ? q.options : [];
      [0,1,2,3].forEach(i => {
        const o = opts[i] || {};
        const mark = o.correct ? " [CORRECT]" : "";
        addWrapped(`${String.fromCharCode(65+i)}. ${o.text || ""}${mark}`, margin + 5, 10, 4.5);
      });
      const solution = opts.find(o => o?.correct)?.solution || q.solution || "";
      if (solution) addWrapped(`Solution / Explanation: ${solution}`, margin + 5, 9, 4);
      y += 4;
    });
  }

  const blob = pdf.output("blob");
  if (testPdfObjectUrl) URL.revokeObjectURL(testPdfObjectUrl);
  testPdfObjectUrl = URL.createObjectURL(blob);

  const iframe = $("testQuestionsPdfFrame");
  const title = $("testQuestionsPdfTitle");
  if (iframe) iframe.src = testPdfObjectUrl;
  if (title) title.textContent = `${item.title || testNumber} — Questions PDF`;
  show("testQuestionsPdfModal");
}

function closeTestQuestionsPDF() {
  hide("testQuestionsPdfModal");
  const iframe = $("testQuestionsPdfFrame");
  if (iframe) iframe.src = "about:blank";
  if (testPdfObjectUrl) {
    URL.revokeObjectURL(testPdfObjectUrl);
    testPdfObjectUrl = null;
  }
}

function editManagedTest(testId, lectureId, testNumber) {
  const root = tests.find(t => t.id === testId);
  const lecture = root?.lectures?.[lectureId];
  const item = lecture?.tests?.[testNumber];
  if (!root || !lecture || !item) return;

  editingTestId = testId;
  editingTestLectureId = lectureId;
  editingTestNumber = testNumber;

  setValue("tTestId", root.testId || testId);
  setValue("tTestTitle", root.title || "");
  setValue("tLectureId", lectureId);
  setValue("tLectureTitle", lecture.title || "");
  setValue("tTestNumber", testNumber);
  setValue("tTitle", item.title || "");
  setValue("tDuration", item.duration || 30);
  testQuestions = JSON.parse(JSON.stringify(item.questions || []));
  renderTestQuestionsEditor();
  document.querySelector('[data-section="tests"]')?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveManagedTest(event) {
  event.preventDefault();

  const testId = value("tTestId");
  const testTitle = value("tTestTitle");
  const lectureId = value("tLectureId");
  const lectureTitle = value("tLectureTitle");
  const testNumber = value("tTestNumber");
  const testTitle2 = value("tTitle");
  const duration = Number(value("tDuration"));

  if (!testId || !testTitle || !lectureId || !lectureTitle || !testNumber || !testTitle2 || !duration) {
    alert("Test ID, Test title, Lecture, Test number, title aur duration required hain.");
    return;
  }

  const existing = tests.find(t => t.id === testId || t.testId === testId);
  const root = existing ? JSON.parse(JSON.stringify(existing)) : {
    testId,
    title: testTitle,
    lectures: {}
  };

  root.testId = testId;
  root.title = testTitle;
  if (!root.lectures) root.lectures = {};
  if (!root.lectures[lectureId]) root.lectures[lectureId] = { title: lectureTitle, tests: {} };
  root.lectures[lectureId].title = lectureTitle;
  if (!root.lectures[lectureId].tests) root.lectures[lectureId].tests = {};

  root.lectures[lectureId].tests[testNumber] = {
    title: testTitle2,
    duration,
    questions: JSON.parse(JSON.stringify(testQuestions))
  };

  try {
    await setDoc(doc(db, "tests", testId), root);
    alert("Test saved successfully.");
    clearTestForm();
    await loadAllData();
  } catch (error) {
    console.error("TEST SAVE ERROR:", error);
    alert(error.message || "Test save failed.");
  }
}

async function deleteManagedTest(testId, lectureId, testNumber) {
  if (!confirm("Is test ko delete karna hai? Existing student results delete nahi honge.")) return;
  const root = tests.find(t => t.id === testId);
  if (!root) return;

  const copy = JSON.parse(JSON.stringify(root));
  delete copy.lectures?.[lectureId]?.tests?.[testNumber];
  if (copy.lectures?.[lectureId]?.tests && Object.keys(copy.lectures[lectureId].tests).length === 0) {
    delete copy.lectures[lectureId];
  }

  try {
    if (!Object.keys(copy.lectures || {}).length) {
      await deleteDoc(doc(db, "tests", testId));
    } else {
      await setDoc(doc(db, "tests", testId), copy);
    }
    await loadAllData();
  } catch (error) {
    console.error(error);
    alert(error.message || "Test delete failed.");
  }
}

async function importDefaultTests() {
  const ids = Object.keys(DEFAULT_TESTS);
  if (!ids.length) return;
  if (!confirm(`${ids.length} existing test set(s) Firestore me import karne hain? Existing saved tests overwrite nahi honge.`)) return;

  try {
    let imported = 0;
    for (const id of ids) {
      const ref = doc(db, "tests", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const importedTest = JSON.parse(JSON.stringify(DEFAULT_TESTS[id]));
        importedTest.testId = id;
        await setDoc(ref, importedTest);
        imported++;
      }
    }
    alert(`${imported} test set(s) imported. Existing Firestore tests were kept unchanged.`);
    await loadAllData();
  } catch (error) {
    console.error("TEST IMPORT ERROR:", error);
    alert(error.message || "Test import failed.");
  }
}

$("testForm")?.addEventListener("submit", saveManagedTest);
$("addTestQuestionBtn")?.addEventListener("click", () => {
  testQuestions.push({
    question: "",
    options: [0,1,2,3].map(() => ({ text: "", correct: false, solution: "" }))
  });
  renderTestQuestionsEditor();
});
$("clearTestFormBtn")?.addEventListener("click", clearTestForm);
$("newTestBtn")?.addEventListener("click", clearTestForm);
$("importDefaultTestsBtn")?.addEventListener("click", importDefaultTests);
$("closeTestQuestionsPdfBtn")?.addEventListener("click", closeTestQuestionsPDF);
$("testQuestionsPdfModal")?.addEventListener("click", event => {
  if (event.target.id === "testQuestionsPdfModal") closeTestQuestionsPDF();
});


// =====================================================
// RESULT FILTERS
// =====================================================

function renderResultFilters() {

  fillSelect(
    "resultExamFilter",
    results.map(resultExam),
    "All Exams"
  );

  fillSelect(
    "resultBatchFilter",
    results.map(resultBatch),
    "All Batches"
  );

  fillSelect(
    "resultCourseFilter",
    results.map(resultCourseName),
    "All Courses"
  );

  fillSelect(
    "resultSubjectFilter",
    results.map(resultSubject),
    "All Subjects"
  );

  fillSelect(
    "resultTestFilter",
    results.map(resultTest),
    "Select Test"
  );

}


function filteredResults() {

  const search =
    normalize(value("resultSearch"));

  const exam =
    normalize(value("resultExamFilter"));

  const batch =
    normalize(value("resultBatchFilter"));

  const course =
    normalize(value("resultCourseFilter"));

  const subject =
    normalize(value("resultSubjectFilter"));

  const test =
    normalize(value("resultTestFilter"));


  return results.filter(result => {

    const haystack = [

      resultStudentName(result),

      resultStudentEmail(result),

      resultExam(result),

      resultBatch(result),

      resultCourseName(result),

      resultSubject(result),

      resultTest(result)

    ]
      .map(normalize)
      .join(" ");


    return (

      (!search ||
        haystack.includes(search))

      &&

      (!exam ||
        normalize(resultExam(result)) === exam)

      &&

      (!batch ||
        normalize(resultBatch(result)) === batch)

      &&

      (!course ||
        normalize(resultCourseName(result)) === course)

      &&

      (!subject ||
        normalize(resultSubject(result)) === subject)

      &&

      (!test ||
        normalize(resultTest(result)) === test)

    );

  });

}


// =====================================================
// RESULT GROUPING
// EXAM → BATCH → COURSE → SUBJECT → TEST
// =====================================================

function renderResults() {

  const container =
    $("resultsTable");

  if (!container) return;


  const list =
    filteredResults();


  let enrolledCount = 0;
  let notEnrolledCount = 0;


  list.forEach(result => {

    if (isEnrolled(result)) {
      enrolledCount++;
    } else {
      notEnrolledCount++;
    }

  });


  if ($("resultSummary")) {

    $("resultSummary").innerHTML = `

      <span class="pill">
        Total: ${list.length}
      </span>

      <span class="pill green">
        Enrolled: ${enrolledCount}
      </span>

      <span class="pill red">
        Not Enrolled: ${notEnrolledCount}
      </span>

    `;

  }


  if (!list.length) {

    container.innerHTML =
      `<div class="no-results">
        No test results found.
      </div>`;

    return;

  }


  const examGroups = new Map();


  list.forEach(result => {

    const exam =
      resultExam(result);

    const batch =
      resultBatch(result);

    const course =
      resultCourseName(result);

    const subject =
      resultSubject(result);

    const test =
      resultTest(result);


    if (!examGroups.has(exam)) {

      examGroups.set(
        exam,
        new Map()
      );

    }


    const batchMap =
      examGroups.get(exam);


    if (!batchMap.has(batch)) {

      batchMap.set(
        batch,
        new Map()
      );

    }


    const courseMap =
      batchMap.get(batch);


    if (!courseMap.has(course)) {

      courseMap.set(
        course,
        new Map()
      );

    }


    const subjectMap =
      courseMap.get(course);


    if (!subjectMap.has(subject)) {

      subjectMap.set(
        subject,
        new Map()
      );

    }


    const testMap =
      subjectMap.get(subject);


    if (!testMap.has(test)) {

      testMap.set(
        test,
        []
      );

    }


    testMap.get(test).push(result);

  });


  let html = "";


  for (const [
    exam,
    batchMap
  ] of examGroups) {


    html += `
      <div class="result-group">

        <div class="result-group-title">
          📘 Exam: ${esc(exam)}
        </div>
    `;


    for (const [
      batch,
      courseMap
    ] of batchMap) {


      html += `
        <div style="
          padding:10px;
          background:#111827;
          border:1px solid #334155;
          border-top:0;
          font-weight:800;
        ">
          📦 Batch: ${esc(batch)}
        </div>
      `;


      for (const [
        course,
        subjectMap
      ] of courseMap) {


        html += `
          <div style="
            padding:10px;
            background:#0f172a;
            border:1px solid #334155;
            border-top:0;
            color:#60a5fa;
            font-weight:800;
          ">
            📚 Course: ${esc(course)}
          </div>
        `;


        for (const [
          subject,
          testMap
        ] of subjectMap) {


          html += `
            <div style="
              padding:9px 12px;
              background:#0b1220;
              border:1px solid #334155;
              border-top:0;
              font-weight:700;
            ">
              📖 Subject: ${esc(subject)}
            </div>
          `;


          for (const [
            test,
            resultList
          ] of testMap) {


            html += `
              <div style="
                padding:9px 12px;
                background:#172033;
                border:1px solid #334155;
                border-top:0;
                font-weight:800;
              ">
                📝 Test: ${esc(test)}
                <span class="group-count">
                  ${resultList.length}
                </span>
              </div>
            `;


            resultList.forEach(result => {

              const enrolled =
                isEnrolled(result);


              const status =
                enrolled
                  ? "ENROLLED"
                  : "NOT ENROLLED";


              const statusClass =
                enrolled
                  ? "status-enrolled"
                  : "status-not-enrolled";


              html += `

                <div class="result-item">

                  <div class="result-main">

                    <div>
                      <strong>
                        ${esc(
                          resultStudentName(result)
                        )}
                      </strong>

                      <div class="small">
                        ${esc(
                          resultStudentEmail(result)
                        )}
                      </div>
                    </div>


                    <div>
                      <span class="${statusClass}">
                        ${status}
                      </span>
                    </div>


                    <div>
                      Score:
                      <span class="score">
                        ${esc(
                          resultScore(result)
                        )}
                      </span>
                    </div>


                    <div>
                      ${
                        result.totalMarks ??
                        result.maxMarks ??
                        result.total ??
                        "—"
                      }
                    </div>


                    <div class="small">
                      ${esc(
                        result.id
                      )}
                    </div>


                    <div class="actions">

                      <button
                        class="btn primary"
                        onclick="window.downloadResultPDF('${esc(result.id)}')"
                      >
                        PDF
                      </button>

                      <button
                        class="btn danger"
                        onclick="window.deleteResult('${esc(result.id)}')"
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </div>

              `;

            });

          }

        }

      }

    }


    html += `</div>`;

  }


  container.innerHTML = html;

}


// =====================================================
// RESULT EVENTS
// =====================================================

[
  "resultSearch",
  "resultExamFilter",
  "resultBatchFilter",
  "resultCourseFilter",
  "resultSubjectFilter",
  "resultTestFilter"
].forEach(id => {

  $(id)?.addEventListener(
    "input",
    renderResults
  );

  $(id)?.addEventListener(
    "change",
    renderResults
  );

});


$("refreshResultsBtn")
  ?.addEventListener(
    "click",
    loadAllData
  );


// =====================================================
// TEST-WISE ALL STUDENT RESULT PDF
// =====================================================

$("downloadTestResultsPDFBtn")?.addEventListener("click", () => {
  const selectedTest = value("resultTestFilter");
  if (!selectedTest) {
    alert("Pehle Test select karo.");
    return;
  }

  const list = filteredResults().filter(r => normalize(resultTest(r)) === normalize(selectedTest));
  if (!list.length) {
    alert("Selected test ke liye koi result nahi mila.");
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("PDF library load nahi hui. Internet connection check karo.");
    return;
  }

  const docPdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const first = list[0];

  docPdf.setFontSize(18);
  docPdf.text("FJMC Academy - Test Wise Result", 14, 15);
  docPdf.setFontSize(10);
  docPdf.text(`Exam: ${resultExam(first)}   Batch: ${resultBatch(first)}   Course: ${resultCourseName(first)}   Subject: ${resultSubject(first)}`, 14, 22);
  docPdf.text(`Test: ${selectedTest}   Students: ${list.length}`, 14, 28);

  const rows = list.map((r, i) => [
    i + 1,
    resultStudentName(r),
    resultStudentEmail(r),
    resultScore(r),
    r.totalMarks ?? r.maxMarks ?? r.total ?? "—",
    r.percentage != null ? `${r.percentage}%` : "—",
    resultBatch(r),
    resultExam(r)
  ]);

  if (typeof docPdf.autoTable === "function") {
    docPdf.autoTable({
      startY: 34,
      head: [["#", "Student", "Email", "Score", "Total", "%", "Batch", "Exam"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fontSize: 8 },
      margin: { left: 10, right: 10 }
    });
  } else {
    let y = 36;
    rows.forEach(row => {
      docPdf.text(row.join(" | "), 10, y);
      y += 6;
      if (y > 195) { docPdf.addPage(); y = 15; }
    });
  }

  docPdf.save(`FJMC-${selectedTest.replace(/[^a-z0-9_-]+/gi, "-")}-results.pdf`);
});


// =====================================================
// DELETE RESULT
// =====================================================

window.deleteResult = async function(id) {

  const ok =
    confirm(
      "Ye test result permanently delete karna hai?"
    );


  if (!ok) return;


  try {

    await deleteDoc(
      doc(db, "testResults", id)
    );


    await loadAllData();


  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "Result delete failed."
    );

  }

};


// =====================================================
// DELETE ALL RESULTS
// =====================================================

$("clearResultsBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (!results.length) {

        alert("Delete karne ke liye koi result nahi hai.");

        return;
      }


      const first =
        confirm(
          `Kya tum ${results.length} test results delete karna chahte ho?`
        );


      if (!first) return;


      const second =
        confirm(
          "WARNING: Ye action undo nahi ho sakta. Continue?"
        );


      if (!second) return;


      try {

        for (const result of results) {

          await deleteDoc(
            doc(
              db,
              "testResults",
              result.id
            )
          );

        }


        alert("All test results deleted.");

        await loadAllData();


      } catch (error) {

        console.error(error);

        alert(
          error.message ||
          "Delete all failed."
        );

      }

    }
  );


// =====================================================
// RESULT PDF
// =====================================================

window.downloadResultPDF = function(id) {

  const result =
    results.find(
      r => r.id === id
    );

  if (!result) return;


  const student =
    resultStudent(result);

  const course =
    resultCourse(result);


  const enrolled =
    isEnrolled(result);


  const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>FJMC Academy Test Result</title>

<style>

body{
  font-family:Arial,sans-serif;
  padding:35px;
  color:#111;
}

h1{
  margin-bottom:5px;
}

.box{
  border:1px solid #ccc;
  padding:15px;
  margin:12px 0;
  border-radius:8px;
}

.row{
  margin:7px 0;
}

.label{
  font-weight:bold;
}

.status{
  font-weight:bold;
}

</style>

</head>

<body>

<h1>FJMC Academy</h1>

<p>Test Result</p>

<div class="box">

<div class="row">
<span class="label">Student:</span>
${esc(
  resultStudentName(result)
)}
</div>

<div class="row">
<span class="label">Email:</span>
${esc(
  resultStudentEmail(result)
)}
</div>

<div class="row">
<span class="label">Exam:</span>
${esc(
  resultExam(result)
)}
</div>

<div class="row">
<span class="label">Batch:</span>
${esc(
  resultBatch(result)
)}
</div>

<div class="row">
<span class="label">Course:</span>
${esc(
  resultCourseName(result)
)}
</div>

<div class="row">
<span class="label">Subject:</span>
${esc(
  resultSubject(result)
)}
</div>

<div class="row">
<span class="label">Test:</span>
${esc(
  resultTest(result)
)}
</div>

<div class="row">
<span class="label">Score:</span>
${esc(
  resultScore(result)
)}
</div>

<div class="row">
<span class="label">Enrollment:</span>

<span class="status">
${enrolled
  ? "ENROLLED"
  : "NOT ENROLLED"}
</span>

</div>

</div>

</body>

</html>

`;


  const win =
    window.open(
      "",
      "_blank"
    );


  if (!win) {

    alert(
      "Popup blocked hai. Browser me popup allow karo."
    );

    return;
  }


  win.document.write(html);

  win.document.close();


  setTimeout(() => {

    win.print();

  }, 500);

};


// =====================================================
// DEVICES
// =====================================================

async function renderDevices() {

  const container = $("deviceStudents");

  if (!container) return;

  try {

    const usersSnap = await getDocs(
      collection(db, "users")
    );

    const rows = [];

    for (const userDoc of usersSnap.docs) {

      const userData = userDoc.data() || {};

      let slotData = {};

      try {
        const slotSnap = await getDoc(
          doc(
            db,
            "users",
            userDoc.id,
            "deviceSlots",
            "main"
          )
        );

        if (slotSnap.exists()) {
          slotData = slotSnap.data() || {};
        }
      } catch (slotError) {
        console.warn(
          "DEVICE SLOT LOAD ERROR:",
          userDoc.id,
          slotError
        );
      }

      if (
        Object.keys(slotData).length ||
        userData.email ||
        userData.name
      ) {
        rows.push({
          userId: userDoc.id,
          ...userData,
          ...slotData
        });
      }
    }

    devices = rows;

    if (!devices.length) {
      container.innerHTML = `
        <div class="empty">
          No device reservation found.
        </div>`;
      return;
    }

    const now = Date.now();

    container.innerHTML = devices.map(user => {

      const mobileActive =
        !!user.mobileDeviceId &&
        Number(user.mobileExpiresAt || 0) > now;

      const desktopActive =
        !!user.desktopDeviceId &&
        Number(user.desktopExpiresAt || 0) > now;

      const mobileText = mobileActive
        ? `MOBILE reserved • expires ${new Date(Number(user.mobileExpiresAt)).toLocaleString()}`
        : "MOBILE slot free";

      const desktopText = desktopActive
        ? `DESKTOP/LAPTOP reserved • expires ${new Date(Number(user.desktopExpiresAt)).toLocaleString()}`
        : "DESKTOP/LAPTOP slot free";

      return `
        <div class="device">

          <button
            class="btn danger"
            onclick="window.releaseDevices('${esc(user.userId)}')"
          >
            Release
          </button>

          <strong>
            ${esc(
              display(
                user.name ||
                user.email ||
                user.userId
              )
            )}
          </strong>

          <div class="small">
            ${esc(user.email || "")}
          </div>

          <div class="small">
            ${esc(mobileText)}
          </div>

          <div class="small">
            ${esc(desktopText)}
          </div>

        </div>
      `;

    }).join("");

  } catch (error) {

    console.error(
      "DEVICE LOAD ERROR:",
      error
    );

    container.innerHTML = `
      <div class="empty">
        Device data load nahi hua.<br>
        ${esc(error?.message || "Unknown error")}
      </div>`;
  }
}


// =====================================================
// RELEASE DEVICE SLOTS
// =====================================================

window.releaseDevices = async function(userId) {

  const ok = confirm(
    "Is student ke MOBILE aur DESKTOP/LAPTOP device reservations release karne hain?"
  );

  if (!ok) return;

  try {

    const slotRef = doc(
      db,
      "users",
      userId,
      "deviceSlots",
      "main"
    );

    const slotSnap = await getDoc(slotRef);

    if (!slotSnap.exists()) {
      alert("Is student ke paas device reservation nahi hai.");
      return;
    }

    await updateDoc(slotRef, {
      mobileDeviceId: "",
      mobileExpiresAt: 0,
      mobileLastSeen: 0,
      mobileActive: false,
      desktopDeviceId: "",
      desktopExpiresAt: 0,
      desktopLastSeen: 0,
      desktopActive: false
    });

    alert("Device reservations released.");

    await renderDevices();

  } catch (error) {

    console.error(
      "DEVICE RELEASE ERROR:",
      error
    );

    alert(
      error?.message ||
      "Device release failed."
    );
  }
};


// =====================================================
// SEED BUTTON
// =====================================================

$("seedBtn")
  ?.addEventListener(
    "click",
    async () => {

      alert(
        "Import feature ke liye existing dashboard data source connect karna hoga. Current Firestore data safe hai."
      );

    }
  );


// =====================================================
// INITIAL CONTENT EDITOR
// =====================================================

renderContentEditor();
