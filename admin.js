import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  initializeApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { auth, db } from "./firebase.js";


/* =========================================================
   ADMIN
========================================================= */

const ADMIN_EMAILS = [
  "fjmcacademy1008@gmail.com"
];

let currentAdmin = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const email = (user.email || "").toLowerCase();

  if (!ADMIN_EMAILS.includes(email)) {
    alert("Access denied.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  currentAdmin = user;

  const adminEmail = document.getElementById("adminEmail");
  if (adminEmail) {
    adminEmail.textContent = user.email;
  }

  await loadAllData();
});


/* =========================================================
   GLOBAL DATA
========================================================= */

let students = [];
let courses = [];
let tests = [];
let results = [];
let devices = [];

let editingStudentId = null;
let editingCourseId = null;

let assignedCourseIds = new Set();


/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueSorted(arr) {
  return [...new Set(
    arr
      .filter(x => String(x ?? "").trim() !== "")
      .map(x => String(x).trim())
  )].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function groupKey(...values) {
  return values
    .map(v => normalize(v) || "unknown")
    .join("|||");
}

function groupLabel(value) {
  return String(value || "Not Set");
}

function studentDocId(email) {
  return normalize(email).replace(/[.#$[\]/]/g, "_");
}

function getStudentName(student) {
  return (
    student?.name ||
    student?.displayName ||
    student?.studentName ||
    student?.email ||
    "Unknown Student"
  );
}

function getCourseId(course) {
  return course?.id || course?.courseId || "";
}

function getCourseTitle(course) {
  return (
    course?.title ||
    course?.name ||
    course?.subject ||
    course?.courseName ||
    getCourseId(course)
  );
}

function getCourseSubject(course) {
  return (
    course?.subject ||
    course?.title ||
    course?.name ||
    ""
  );
}

function getResultStudent(result) {
  const email = normalize(
    result?.email ||
    result?.studentEmail ||
    result?.userEmail
  );

  if (email) {
    return students.find(
      s => normalize(s.email) === email
    ) || null;
  }

  const studentId =
    result?.studentId ||
    result?.uid ||
    result?.userId;

  if (studentId) {
    return students.find(
      s => s.id === studentId
    ) || null;
  }

  return null;
}

function getResultCourse(result) {
  const id =
    result?.courseId ||
    result?.courseID ||
    result?.course ||
    "";

  return courses.find(
    c => normalize(getCourseId(c)) === normalize(id)
  ) || null;
}

function getResultTest(result) {
  const id =
    result?.testId ||
    result?.testID ||
    result?.test ||
    "";

  return tests.find(
    t => normalize(t.id) === normalize(id)
  ) || null;
}


/* =========================================================
   FIREBASE LOAD
========================================================= */

async function loadCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  } catch (error) {
    console.error(`Error loading ${name}:`, error);
    return [];
  }
}

async function loadAllData() {
  try {
    students = await loadCollection("students");
    courses = await loadCollection("courses");
    tests = await loadCollection("tests");
    results = await loadCollection("testResults");
    devices = await loadCollection("devices");

    renderEverything();
  } catch (error) {
    console.error(error);
    alert("Data load error: " + error.message);
  }
}

function renderEverything() {
  updateStats();

  populateStudentFilters();
  populateCourseFilters();
  populateResultFilters();

  renderStudents();
  renderCourses();
  renderAssignCourses();
  renderResults();
  renderDevices();
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {
  const studentCount = document.getElementById("studentCount");
  const courseCount = document.getElementById("courseCount");
  const resultCount = document.getElementById("resultCount");
  const testCount = document.getElementById("testCount");

  if (studentCount) studentCount.textContent = students.length;
  if (courseCount) courseCount.textContent = courses.length;
  if (resultCount) resultCount.textContent = results.length;
  if (testCount) testCount.textContent = tests.length;
}


/* =========================================================
   SELECT HELPER
========================================================= */

function fillSelect(selectId, values, firstText = "All") {
  const select = document.getElementById(selectId);

  if (!select) return;

  const current = select.value;

  select.innerHTML =
    `<option value="">${esc(firstText)}</option>` +
    values.map(v =>
      `<option value="${esc(v)}">${esc(v)}</option>`
    ).join("");

  if (values.includes(current)) {
    select.value = current;
  }
}


/* =========================================================
   STUDENT FILTERS
========================================================= */

function populateStudentFilters() {
  fillSelect(
    "studentExamFilter",
    uniqueSorted(students.map(s => s.exam)),
    "All Exams"
  );

  fillSelect(
    "studentBatchFilter",
    uniqueSorted(students.map(s => s.batch)),
    "All Batches"
  );

  fillSelect(
    "studentYearFilter",
    uniqueSorted(students.map(s => s.year)),
    "All Years"
  );
}


/* =========================================================
   STUDENT RENDER
   EXAM -> BATCH -> YEAR -> STUDENTS
========================================================= */

function renderStudents() {
  const container = document.getElementById("studentList");

  if (!container) return;

  const search =
    normalize(document.getElementById("studentSearch")?.value);

  const exam =
    normalize(document.getElementById("studentExamFilter")?.value);

  const batch =
    normalize(document.getElementById("studentBatchFilter")?.value);

  const year =
    normalize(document.getElementById("studentYearFilter")?.value);

  const filtered = students.filter(student => {

    const searchable = [
      student.name,
      student.email,
      student.exam,
      student.batch,
      student.year
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!exam || normalize(student.exam) === exam) &&
      (!batch || normalize(student.batch) === batch) &&
      (!year || normalize(student.year) === year)
    );
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        No matching students found.
      </div>
    `;
    return;
  }

  /* Group Exam -> Batch -> Year */

  const exams = {};

  filtered.forEach(student => {

    const examName = groupLabel(student.exam);
    const batchName = groupLabel(student.batch);
    const yearName = groupLabel(student.year);

    if (!exams[examName]) {
      exams[examName] = {};
    }

    if (!exams[examName][batchName]) {
      exams[examName][batchName] = {};
    }

    if (!exams[examName][batchName][yearName]) {
      exams[examName][batchName][yearName] = [];
    }

    exams[examName][batchName][yearName].push(student);
  });

  let html = "";

  Object.keys(exams)
    .sort()
    .forEach(examName => {

      html += `
        <div class="group-card">
          <div class="group-title">
            📚 ${esc(examName)}
          </div>
      `;

      Object.keys(exams[examName])
        .sort()
        .forEach(batchName => {

          html += `
            <div class="sub-group">
              <div class="sub-group-title">
                📦 Batch: ${esc(batchName)}
              </div>
          `;

          Object.keys(exams[examName][batchName])
            .sort()
            .forEach(yearName => {

              html += `
                <div class="year-group">
                  <div class="year-title">
                    📅 ${esc(yearName)}
                  </div>
                  <div class="student-items">
              `;

              exams[examName][batchName][yearName]
                .sort((a, b) =>
                  getStudentName(a).localeCompare(
                    getStudentName(b)
                  )
                )
                .forEach(student => {

                  const coursesText =
                    Array.isArray(student.courses)
                      ? student.courses.length
                      : 0;

                  html += `
                    <div class="student-row">

                      <div class="student-main">
                        <strong>
                          👤 ${esc(getStudentName(student))}
                        </strong>

                        <small>
                          ${esc(student.email || "")}
                        </small>
                      </div>

                      <div class="student-meta">
                        ${coursesText} course(s)
                      </div>

                      <div class="student-actions">
                        <button
                          onclick="editStudent('${esc(student.id)}')"
                        >
                          Edit
                        </button>

                        <button
                          class="danger"
                          onclick="deleteStudent('${esc(student.id)}')"
                        >
                          Delete
                        </button>
                      </div>

                    </div>
                  `;
                });

              html += `
                  </div>
                </div>
              `;
            });

          html += `
            </div>
          `;
        });

      html += `
        </div>
      `;
    });

  container.innerHTML = html;
}


/* =========================================================
   STUDENT FORM
========================================================= */

async function saveStudent() {

  const email =
    document.getElementById("studentEmail")?.value.trim();

  const password =
    document.getElementById("studentPassword")?.value.trim();

  const name =
    document.getElementById("studentName")?.value.trim();

  const exam =
    document.getElementById("studentExam")?.value.trim();

  const batch =
    document.getElementById("studentBatch")?.value.trim();

  const year =
    document.getElementById("studentYear")?.value.trim();

  if (!email || !name || !exam || !batch || !year) {
    alert("Please fill all required student fields.");
    return;
  }

  try {

    const data = {
      email,
      name,
      exam,
      batch,
      year,
      courses: [...assignedCourseIds],
      updatedAt: serverTimestamp()
    };

    /* NEW STUDENT */

    if (!editingStudentId) {

      if (!password) {
        alert("New student ke liye password required hai.");
        return;
      }

      /*
       * Secondary Firebase app.
       * Isse admin logout nahi hoga.
       */

      const secondaryApp = initializeApp(
        {
          apiKey: "AIzaSyA19k56JFSzdeCvS1DthDcqTNYprtJTw8I",
          authDomain: "fjmcacademy.firebaseapp.com",
          projectId: "fjmcacademy",
          storageBucket: "fjmcacademy.firebasestorage.app",
          messagingSenderId: "474981170098",
          appId: "1:474981170098:web:8ca392cfc54708a09082ab"
        },
        "studentCreationApp"
      );

      const secondaryAuth = getAuth(secondaryApp);

      try {
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );
      } catch (authError) {

        if (authError.code === "auth/email-already-in-use") {
          alert(
            "Ye email Firebase Authentication mein already registered hai."
          );
        } else {
          throw authError;
        }
      }

      await deleteApp(secondaryApp);

      const id = studentDocId(email);

      await setDoc(
        doc(db, "students", id),
        {
          ...data,
          createdAt: serverTimestamp()
        }
      );

      alert("Student created successfully.");

    } else {

      await updateDoc(
        doc(db, "students", editingStudentId),
        data
      );

      alert("Student updated successfully.");
    }

    clearStudentForm();

    students = await loadCollection("students");

    populateStudentFilters();
    renderStudents();
    renderAssignCourses();
    updateStats();

  } catch (error) {

    console.error(error);

    alert(
      "Student save error:\n" +
      error.message
    );
  }
}


/* =========================================================
   EDIT STUDENT
========================================================= */

window.editStudent = function(id) {

  const student = students.find(
    s => s.id === id
  );

  if (!student) return;

  editingStudentId = id;

  document.getElementById("studentEmail").value =
    student.email || "";

  document.getElementById("studentPassword").value =
    "";

  document.getElementById("studentName").value =
    student.name || "";

  document.getElementById("studentExam").value =
    student.exam || "";

  document.getElementById("studentBatch").value =
    student.batch || "";

  document.getElementById("studentYear").value =
    student.year || "";

  assignedCourseIds = new Set(
    Array.isArray(student.courses)
      ? student.courses
      : []
  );

  renderAssignCourses();

  const saveBtn =
    document.getElementById("saveStudentBtn");

  if (saveBtn) {
    saveBtn.textContent = "Update Student";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};


/* =========================================================
   DELETE STUDENT
========================================================= */

window.deleteStudent = async function(id) {

  const student =
    students.find(s => s.id === id);

  if (!student) return;

  if (
    !confirm(
      `Delete student "${getStudentName(student)}"?`
    )
  ) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "students", id)
    );

    students =
      students.filter(s => s.id !== id);

    renderStudents();
    renderAssignCourses();
    updateStats();

    alert("Student deleted.");

  } catch (error) {

    console.error(error);

    alert(
      "Delete error: " +
      error.message
    );
  }
};


/* =========================================================
   CLEAR STUDENT FORM
========================================================= */

function clearStudentForm() {

  editingStudentId = null;

  const fields = [
    "studentEmail",
    "studentPassword",
    "studentName",
    "studentExam",
    "studentBatch",
    "studentYear"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  assignedCourseIds = new Set();

  renderAssignCourses();

  const saveBtn =
    document.getElementById("saveStudentBtn");

  if (saveBtn) {
    saveBtn.textContent = "Save Student";
  }
}


/* =========================================================
   ASSIGN COURSES FILTERS
========================================================= */

function populateAssignCourseFilters() {

  fillSelect(
    "courseAssignExamFilter",
    uniqueSorted(courses.map(c => c.exam)),
    "All Exams"
  );

  fillSelect(
    "courseAssignBatchFilter",
    uniqueSorted(courses.map(c => c.batch)),
    "All Batches"
  );

  fillSelect(
    "courseAssignYearFilter",
    uniqueSorted(courses.map(c => c.year)),
    "All Years"
  );
}


/* =========================================================
   ASSIGN COURSES
   EXAM -> BATCH -> YEAR -> COURSES
========================================================= */

function renderAssignCourses() {

  const container =
    document.getElementById("courseChecklist");

  if (!container) return;

  populateAssignCourseFilters();

  const search =
    normalize(
      document.getElementById(
        "courseAssignSearch"
      )?.value
    );

  const exam =
    normalize(
      document.getElementById(
        "courseAssignExamFilter"
      )?.value
    );

  const batch =
    normalize(
      document.getElementById(
        "courseAssignBatchFilter"
      )?.value
    );

  const year =
    normalize(
      document.getElementById(
        "courseAssignYearFilter"
      )?.value
    );

  const filtered = courses.filter(course => {

    const searchable = [
      course.id,
      course.courseId,
      course.title,
      course.name,
      course.subject,
      course.exam,
      course.batch,
      course.year
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!exam || normalize(course.exam) === exam) &&
      (!batch || normalize(course.batch) === batch) &&
      (!year || normalize(course.year) === year)
    );
  });

  if (!filtered.length) {
    container.innerHTML =
      `<div class="empty-state">No matching courses found.</div>`;
    return;
  }

  const groups = {};

  filtered.forEach(course => {

    const examName = groupLabel(course.exam);
    const batchName = groupLabel(course.batch);
    const yearName = groupLabel(course.year);

    groups[examName] ??= {};
    groups[examName][batchName] ??= {};
    groups[examName][batchName][yearName] ??= [];

    groups[examName][batchName][yearName].push(course);
  });

  let html = "";

  Object.keys(groups)
    .sort()
    .forEach(examName => {

      html += `
        <div class="assign-group">
          <h4>📚 ${esc(examName)}</h4>
      `;

      Object.keys(groups[examName])
        .sort()
        .forEach(batchName => {

          html += `
            <div class="assign-batch">
              <h5>📦 Batch: ${esc(batchName)}</h5>
          `;

          Object.keys(groups[examName][batchName])
            .sort()
            .forEach(yearName => {

              html += `
                <div class="assign-year">
                  <div class="assign-year-title">
                    📅 ${esc(yearName)}
                  </div>
              `;

              groups[examName][batchName][yearName]
                .sort((a, b) =>
                  getCourseTitle(a).localeCompare(
                    getCourseTitle(b)
                  )
                )
                .forEach(course => {

                  const id = getCourseId(course);

                  const checked =
                    assignedCourseIds.has(id)
                      ? "checked"
                      : "";

                  html += `
                    <label class="course-check-row">

                      <input
                        type="checkbox"
                        value="${esc(id)}"
                        ${checked}
                        onchange="toggleAssignedCourse(
                          '${esc(id)}',
                          this.checked
                        )"
                      >

                      <span>
                        <strong>
                          📘 ${esc(getCourseTitle(course))}
                        </strong>

                        <small>
                          ${esc(
                            course.subject ||
                            ""
                          )}
                        </small>
                      </span>

                    </label>
                  `;
                });

              html += `
                </div>
              `;
            });

          html += `
            </div>
          `;
        });

      html += `
        </div>
      `;
    });

  container.innerHTML = html;
}


/* =========================================================
   COURSE CHECKBOX
========================================================= */

window.toggleAssignedCourse = function(
  courseId,
  checked
) {

  if (checked) {
    assignedCourseIds.add(courseId);
  } else {
    assignedCourseIds.delete(courseId);
  }
};


/* =========================================================
   SELECT VISIBLE COURSES
========================================================= */

function selectVisibleCourses() {

  const search =
    normalize(
      document.getElementById(
        "courseAssignSearch"
      )?.value
    );

  const exam =
    normalize(
      document.getElementById(
        "courseAssignExamFilter"
      )?.value
    );

  const batch =
    normalize(
      document.getElementById(
        "courseAssignBatchFilter"
      )?.value
    );

  const year =
    normalize(
      document.getElementById(
        "courseAssignYearFilter"
      )?.value
    );

  courses.forEach(course => {

    const searchable = [
      course.id,
      course.courseId,
      course.title,
      course.name,
      course.subject,
      course.exam,
      course.batch,
      course.year
    ]
      .join(" ")
      .toLowerCase();

    const visible =
      (!search || searchable.includes(search)) &&
      (!exam || normalize(course.exam) === exam) &&
      (!batch || normalize(course.batch) === batch) &&
      (!year || normalize(course.year) === year);

    if (visible) {
      assignedCourseIds.add(
        getCourseId(course)
      );
    }
  });

  renderAssignCourses();
}


/* =========================================================
   COURSE FILTERS
========================================================= */

function populateCourseFilters() {

  fillSelect(
    "courseExamFilter",
    uniqueSorted(courses.map(c => c.exam)),
    "All Exams"
  );

  fillSelect(
    "courseBatchFilter",
    uniqueSorted(courses.map(c => c.batch)),
    "All Batches"
  );

  fillSelect(
    "courseYearFilter",
    uniqueSorted(courses.map(c => c.year)),
    "All Years"
  );
}


/* =========================================================
   COURSES RENDER
   EXAM -> BATCH -> YEAR -> COURSES
========================================================= */

function renderCourses() {

  const container =
    document.getElementById("courseList");

  if (!container) return;

  const search =
    normalize(
      document.getElementById("courseSearch")?.value
    );

  const exam =
    normalize(
      document.getElementById("courseExamFilter")?.value
    );

  const batch =
    normalize(
      document.getElementById("courseBatchFilter")?.value
    );

  const year =
    normalize(
      document.getElementById("courseYearFilter")?.value
    );

  const filtered =
    courses.filter(course => {

      const searchable = [
        course.id,
        course.courseId,
        course.title,
        course.name,
        course.subject,
        course.description,
        course.exam,
        course.batch,
        course.year
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (!exam || normalize(course.exam) === exam) &&
        (!batch || normalize(course.batch) === batch) &&
        (!year || normalize(course.year) === year)
      );
    });

  if (!filtered.length) {

    container.innerHTML = `
      <div class="empty-state">
        No matching courses found.
      </div>
    `;

    return;
  }

  const groups = {};

  filtered.forEach(course => {

    const examName = groupLabel(course.exam);
    const batchName = groupLabel(course.batch);
    const yearName = groupLabel(course.year);

    groups[examName] ??= {};
    groups[examName][batchName] ??= {};
    groups[examName][batchName][yearName] ??= [];

    groups[examName][batchName][yearName].push(course);
  });

  let html = "";

  Object.keys(groups)
    .sort()
    .forEach(examName => {

      html += `
        <div class="group-card">

          <div class="group-title">
            📚 ${esc(examName)}
          </div>
      `;

      Object.keys(groups[examName])
        .sort()
        .forEach(batchName => {

          html += `
            <div class="sub-group">

              <div class="sub-group-title">
                📦 Batch: ${esc(batchName)}
              </div>
          `;

          Object.keys(groups[examName][batchName])
            .sort()
            .forEach(yearName => {

              html += `
                <div class="year-group">

                  <div class="year-title">
                    📅 ${esc(yearName)}
                  </div>

                  <div class="course-items">
              `;

              groups[examName][batchName][yearName]
                .sort((a, b) =>
                  getCourseTitle(a).localeCompare(
                    getCourseTitle(b)
                  )
                )
                .forEach(course => {

                  const id = getCourseId(course);

                  html += `
                    <div class="course-row">

                      <div class="course-main">

                        <strong>
                          📘 ${esc(
                            getCourseTitle(course)
                          )}
                        </strong>

                        <small>
                          ${esc(
                            course.subject ||
                            ""
                          )}
                        </small>

                        <small>
                          Course ID:
                          ${esc(id)}
                        </small>

                      </div>

                      <div class="course-meta">
                        ${esc(
                          course.testId ||
                          course.testID ||
                          ""
                        )}
                      </div>

                      <div class="course-actions">

                        <button
                          onclick="editCourse('${esc(id)}')"
                        >
                          Edit
                        </button>

                        <button
                          class="danger"
                          onclick="deleteCourse('${esc(id)}')"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                  `;
                });

              html += `
                  </div>
                </div>
              `;
            });

          html += `
            </div>
          `;
        });

      html += `
        </div>
      `;
    });

  container.innerHTML = html;
}


/* =========================================================
   SAVE COURSE
========================================================= */

async function saveCourse() {

  const courseId =
    document.getElementById("courseId")?.value.trim();

  const exam =
    document.getElementById("courseExam")?.value.trim();

  const batch =
    document.getElementById("courseBatch")?.value.trim();

  const year =
    document.getElementById("courseYear")?.value.trim();

  const subject =
    document.getElementById("courseSubject")?.value.trim();

  const title =
    document.getElementById("courseTitle")?.value.trim();

  const description =
    document.getElementById("courseDescription")?.value.trim();

  const testId =
    document.getElementById("courseTestId")?.value.trim();

  if (
    !courseId ||
    !exam ||
    !batch ||
    !year ||
    !title
  ) {
    alert("Please fill required course fields.");
    return;
  }

  try {

    const data = {
      courseId,
      exam,
      batch,
      year,
      subject,
      title,
      description,
      testId,
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, "courses", courseId),
      {
        ...data,
        ...(editingCourseId
          ? {}
          : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );

    alert(
      editingCourseId
        ? "Course updated."
        : "Course created."
    );

    clearCourseForm();

    courses =
      await loadCollection("courses");

    renderCourses();
    renderAssignCourses();

    populateCourseFilters();

    updateStats();

  } catch (error) {

    console.error(error);

    alert(
      "Course save error:\n" +
      error.message
    );
  }
}


/* =========================================================
   EDIT COURSE
========================================================= */

window.editCourse = function(id) {

  const course =
    courses.find(
      c => normalize(getCourseId(c)) === normalize(id)
    );

  if (!course) return;

  editingCourseId = id;

  const values = {
    courseId: getCourseId(course),
    courseExam: course.exam || "",
    courseBatch: course.batch || "",
    courseYear: course.year || "",
    courseSubject: course.subject || "",
    courseTitle: course.title || course.name || "",
    courseDescription: course.description || "",
    courseTestId: course.testId || course.testID || ""
  };

  Object.entries(values).forEach(([key, value]) => {

    const el =
      document.getElementById(key);

    if (el) el.value = value;
  });

  const saveBtn =
    document.getElementById("saveCourseBtn");

  if (saveBtn) {
    saveBtn.textContent = "Update Course";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};


/* =========================================================
   DELETE COURSE
========================================================= */

window.deleteCourse = async function(id) {

  const course =
    courses.find(
      c => normalize(getCourseId(c)) === normalize(id)
    );

  if (!course) return;

  if (
    !confirm(
      `Delete course "${getCourseTitle(course)}"?`
    )
  ) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "courses", id)
    );

    courses =
      courses.filter(
        c => getCourseId(c) !== id
      );

    renderCourses();
    renderAssignCourses();

    populateCourseFilters();

    updateStats();

    alert("Course deleted.");

  } catch (error) {

    console.error(error);

    alert(
      "Delete error: " +
      error.message
    );
  }
};


/* =========================================================
   CLEAR COURSE
========================================================= */

function clearCourseForm() {

  editingCourseId = null;

  [
    "courseId",
    "courseExam",
    "courseBatch",
    "courseYear",
    "courseSubject",
    "courseTitle",
    "courseDescription",
    "courseTestId"
  ].forEach(id => {

    const el =
      document.getElementById(id);

    if (el) el.value = "";
  });

  const saveBtn =
    document.getElementById("saveCourseBtn");

  if (saveBtn) {
    saveBtn.textContent = "Save Course";
  }
}


/* =========================================================
   RESULT FILTERS
========================================================= */

function populateResultFilters() {

  fillSelect(
    "resultExamFilter",
    uniqueSorted(
      results.map(r =>
        r.exam ||
        getResultCourse(r)?.exam
      )
    ),
    "All Exams"
  );

  fillSelect(
    "resultBatchFilter",
    uniqueSorted(
      results.map(r =>
        r.batch ||
        getResultCourse(r)?.batch
      )
    ),
    "All Batches"
  );

  fillSelect(
    "resultCourseFilter",
    uniqueSorted(
      results.map(r =>
        getCourseTitle(
          getResultCourse(r) || {
            title:
              r.courseName ||
              r.courseId ||
              r.course
          }
        )
      )
    ),
    "All Courses"
  );

  fillSelect(
    "resultSubjectFilter",
    uniqueSorted(
      results.map(r =>
        r.subject ||
        getResultCourse(r)?.subject
      )
    ),
    "All Subjects"
  );
}


/* =========================================================
   ENROLLMENT
========================================================= */

function isStudentEnrolled(result) {

  const student =
    getResultStudent(result);

  if (!student) {
    return false;
  }

  const courseId =
    result.courseId ||
    result.courseID ||
    result.course ||
    "";

  /*
   * Agar result mein course ID nahi hai,
   * to old result ko enrolled maan rahe hain.
   */

  if (!courseId) {
    return true;
  }

  return (
    Array.isArray(student.courses) &&
    student.courses.includes(courseId)
  );
}


/* =========================================================
   RESULT RENDER
   EXAM -> BATCH -> COURSE -> SUBJECT -> TEST
========================================================= */

function renderResults() {

  const container =
    document.getElementById("resultList");

  if (!container) return;

  const search =
    normalize(
      document.getElementById("resultSearch")?.value
    );

  const examFilter =
    normalize(
      document.getElementById("resultExamFilter")?.value
    );

  const batchFilter =
    normalize(
      document.getElementById("resultBatchFilter")?.value
    );

  const courseFilter =
    normalize(
      document.getElementById("resultCourseFilter")?.value
    );

  const subjectFilter =
    normalize(
      document.getElementById("resultSubjectFilter")?.value
    );

  const filtered =
    results.filter(result => {

      const course =
        getResultCourse(result);

      const exam =
        result.exam ||
        course?.exam ||
        "";

      const batch =
        result.batch ||
        course?.batch ||
        "";

      const courseName =
        getCourseTitle(
          course || {
            title:
              result.courseName ||
              result.courseId ||
              result.course
          }
        );

      const subject =
        result.subject ||
        course?.subject ||
        "";

      const student =
        getResultStudent(result);

      const studentName =
        getStudentName(student || {
          name:
            result.studentName ||
            result.name,
          email:
            result.email ||
            result.studentEmail
        });

      const searchable = [
        studentName,
        result.email,
        result.studentEmail,
        exam,
        batch,
        courseName,
        subject,
        result.testId,
        result.testName,
        result.test
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (!examFilter ||
          normalize(exam) === examFilter) &&
        (!batchFilter ||
          normalize(batch) === batchFilter) &&
        (!courseFilter ||
          normalize(courseName) === courseFilter) &&
        (!subjectFilter ||
          normalize(subject) === subjectFilter)
      );
    });


  /* Summary */

  const total =
    filtered.length;

  const enrolled =
    filtered.filter(isStudentEnrolled).length;

  const notEnrolled =
    total - enrolled;

  const totalEl =
    document.getElementById("resultTotal");

  const enrolledEl =
    document.getElementById("resultEnrolled");

  const notEnrolledEl =
    document.getElementById("resultNotEnrolled");

  if (totalEl) totalEl.textContent = total;
  if (enrolledEl) enrolledEl.textContent = enrolled;
  if (notEnrolledEl) notEnrolledEl.textContent = notEnrolled;


  if (!filtered.length) {

    container.innerHTML = `
      <div class="empty-state">
        No matching test results found.
      </div>
    `;

    return;
  }


  /* Grouping */

  const groups = {};

  filtered.forEach(result => {

    const course =
      getResultCourse(result);

    const exam =
      groupLabel(
        result.exam ||
        course?.exam
      );

    const batch =
      groupLabel(
        result.batch ||
        course?.batch
      );

    const courseName =
      groupLabel(
        getCourseTitle(
          course || {
            title:
              result.courseName ||
              result.courseId ||
              result.course
          }
        )
      );

    const subject =
      groupLabel(
        result.subject ||
        course?.subject
      );

    const test =
      groupLabel(
        result.testName ||
        getResultTest(result)?.title ||
        result.testId ||
        result.test
      );

    groups[exam] ??= {};
    groups[exam][batch] ??= {};
    groups[exam][batch][courseName] ??= {};
    groups[exam][batch][courseName][subject] ??= {};
    groups[exam][batch][courseName][subject][test] ??= [];

    groups[exam][batch][courseName][subject][test]
      .push(result);
  });


  let html = "";


  Object.keys(groups)
    .sort()
    .forEach(exam => {

      html += `
        <div class="result-group">

          <div class="group-title">
            📚 ${esc(exam)}
          </div>
      `;


      Object.keys(groups[exam])
        .sort()
        .forEach(batch => {

          html += `
            <div class="sub-group">

              <div class="sub-group-title">
                📦 Batch: ${esc(batch)}
              </div>
          `;


          Object.keys(groups[exam][batch])
            .sort()
            .forEach(course => {

              html += `
                <div class="result-course">

                  <div class="course-group-title">
                    📘 ${esc(course)}
                  </div>
              `;


              Object.keys(
                groups[exam][batch][course]
              )
                .sort()
                .forEach(subject => {

                  html += `
                    <div class="result-subject">

                      <div class="subject-title">
                        📖 Subject:
                        ${esc(subject)}
                      </div>
                  `;


                  Object.keys(
                    groups[exam][batch][course][subject]
                  )
                    .sort()
                    .forEach(test => {

                      const testResults =
                        groups[
                          exam
                        ][
                          batch
                        ][
                          course
                        ][
                          subject
                        ][
                          test
                        ];


                      html += `
                        <div class="result-test">

                          <div class="test-title">
                            📝 Test:
                            ${esc(test)}
                          </div>

                          <div class="result-items">
                      `;


                      testResults.forEach(result => {

                        const student =
                          getResultStudent(result);

                        const studentName =
                          getStudentName(
                            student || {
                              name:
                                result.studentName ||
                                result.name,

                              email:
                                result.email ||
                                result.studentEmail
                            }
                          );

                        const email =
                          student?.email ||
                          result.email ||
                          result.studentEmail ||
                          "";

                        const enrolledStatus =
                          isStudentEnrolled(result);

                        const score =
                          result.score ??
                          result.marks ??
                          result.obtainedMarks ??
                          "-";

                        const totalMarks =
                          result.total ??
                          result.totalMarks ??
                          result.maxMarks ??
                          "-";

                        const percentage =
                          result.percentage != null
                            ? `${result.percentage}%`
                            : "-";


                        html += `
                          <div class="result-row">

                            <div class="result-student">

                              <strong>
                                👤 ${esc(studentName)}
                              </strong>

                              <small>
                                ${esc(email)}
                              </small>

                            </div>


                            <div class="enrollment-status
                              ${enrolledStatus
                                ? "enrolled"
                                : "not-enrolled"}">

                              ${
                                enrolledStatus
                                  ? "✅ Enrolled"
                                  : "❌ Not Enrolled"
                              }

                            </div>


                            <div class="result-score">

                              <strong>
                                ${esc(score)}
                                /
                                ${esc(totalMarks)}
                              </strong>

                              <small>
                                ${esc(percentage)}
                              </small>

                            </div>


                            <div class="result-actions">

                              <button
                                onclick="downloadResultPDF('${esc(result.id)}')"
                              >
                                📄 PDF
                              </button>

                              <button
                                class="danger"
                                onclick="deleteResult('${esc(result.id)}')"
                              >
                                Delete
                              </button>

                            </div>

                          </div>
                        `;
                      });


                      html += `
                          </div>
                        </div>
                      `;
                    });


                  html += `
                    </div>
                  `;
                });


              html += `
                </div>
              `;
            });


          html += `
            </div>
          `;
        });


      html += `
        </div>
      `;
    });


  container.innerHTML = html;
}


/* =========================================================
   DELETE RESULT
========================================================= */

window.deleteResult = async function(id) {

  if (!confirm("Delete this test result?")) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "testResults", id)
    );

    results =
      results.filter(r => r.id !== id);

    populateResultFilters();
    renderResults();
    updateStats();

    alert("Result deleted.");

  } catch (error) {

    console.error(error);

    alert(
      "Result delete error: " +
      error.message
    );
  }
};


/* =========================================================
   DELETE ALL RESULTS
========================================================= */

async function deleteAllResults() {

  if (!results.length) {
    alert("No results found.");
    return;
  }

  if (
    !confirm(
      `Delete ALL ${results.length} test results?`
    )
  ) {
    return;
  }

  if (
    !confirm(
      "This action cannot be undone. Continue?"
    )
  ) {
    return;
  }

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

    results = [];

    populateResultFilters();
    renderResults();
    updateStats();

    alert("All results deleted.");

  } catch (error) {

    console.error(error);

    alert(
      "Delete all error: " +
      error.message
    );
  }
}


/* =========================================================
   RESULT PDF
========================================================= */

window.downloadResultPDF = function(id) {

  const result =
    results.find(r => r.id === id);

  if (!result) {
    alert("Result not found.");
    return;
  }

  const student =
    getResultStudent(result);

  const course =
    getResultCourse(result);

  const test =
    getResultTest(result);

  const studentName =
    getStudentName(
      student || {
        name:
          result.studentName ||
          result.name
      }
    );

  const email =
    student?.email ||
    result.email ||
    result.studentEmail ||
    "";

  const exam =
    result.exam ||
    course?.exam ||
    "";

  const batch =
    result.batch ||
    course?.batch ||
    "";

  const courseName =
    getCourseTitle(
      course || {
        title:
          result.courseName ||
          result.courseId ||
          result.course
      }
    );

  const subject =
    result.subject ||
    course?.subject ||
    "";

  const testName =
    result.testName ||
    test?.title ||
    result.testId ||
    result.test ||
    "";

  const score =
    result.score ??
    result.marks ??
    result.obtainedMarks ??
    "-";

  const total =
    result.total ??
    result.totalMarks ??
    result.maxMarks ??
    "-";

  const percentage =
    result.percentage != null
      ? `${result.percentage}%`
      : "-";

  const enrolled =
    isStudentEnrolled(result);


  let answersHTML = "";

  const answers =
    result.answers ||
    result.details ||
    [];

  if (Array.isArray(answers) && answers.length) {

    answersHTML = `
      <h3>Answer Details</h3>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Question</th>
            <th>Answer</th>
            <th>Correct</th>
          </tr>
        </thead>

        <tbody>

          ${answers.map((answer, index) => `

            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${esc(
                  answer.question ||
                  answer.questionText ||
                  ""
                )}
              </td>

              <td>
                ${esc(
                  answer.answer ||
                  answer.selectedAnswer ||
                  ""
                )}
              </td>

              <td>
                ${esc(
                  answer.correctAnswer ||
                  answer.correct ||
                  ""
                )}
              </td>

            </tr>

          `).join("")}

        </tbody>
      </table>
    `;
  }


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=900,height=700"
    );

  if (!printWindow) {
    alert(
      "Popup blocked. Please allow popups for this site."
    );
    return;
  }


  printWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <title>
        FJMC Academy - Test Result
      </title>

      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #111;
        }

        h1 {
          text-align: center;
          margin-bottom: 5px;
        }

        .subtitle {
          text-align: center;
          color: #666;
          margin-bottom: 30px;
        }

        .info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 25px;
        }

        .box {
          border: 1px solid #ddd;
          padding: 12px;
          border-radius: 8px;
        }

        .label {
          color: #666;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .value {
          font-weight: bold;
        }

        .status {
          padding: 10px;
          margin: 20px 0;
          border-radius: 8px;
          font-weight: bold;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        th,
        td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        th {
          background: #f3f4f6;
        }

        .footer {
          margin-top: 40px;
          text-align: center;
          color: #777;
          font-size: 12px;
        }

        @media print {

          body {
            padding: 20px;
          }

        }

      </style>

    </head>

    <body>

      <h1>
        FJMC Academy
      </h1>

      <div class="subtitle">
        Test Result
      </div>


      <div class="info">

        <div class="box">
          <div class="label">
            Student
          </div>
          <div class="value">
            ${esc(studentName)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Email
          </div>
          <div class="value">
            ${esc(email)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Exam
          </div>
          <div class="value">
            ${esc(exam)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Batch
          </div>
          <div class="value">
            ${esc(batch)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Course
          </div>
          <div class="value">
            ${esc(courseName)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Subject
          </div>
          <div class="value">
            ${esc(subject)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Test
          </div>
          <div class="value">
            ${esc(testName)}
          </div>
        </div>

        <div class="box">
          <div class="label">
            Score
          </div>
          <div class="value">
            ${esc(score)} / ${esc(total)}
          </div>
        </div>

      </div>


      <div class="status">

        Enrollment:
        ${
          enrolled
            ? "Enrolled"
            : "Not Enrolled"
        }

        <br>

        Percentage:
        ${esc(percentage)}

      </div>


      ${answersHTML}


      <div class="footer">
        FJMC Academy
      </div>


      <script>

        window.onload = function() {
          window.print();
        };

      <\/script>

    </body>

    </html>
  `);

  printWindow.document.close();
};


/* =========================================================
   DEVICES
========================================================= */

function renderDevices() {

  const container =
    document.getElementById("deviceList");

  if (!container) return;

  if (!devices.length) {

    container.innerHTML = `
      <div class="empty-state">
        No devices found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    devices.map(device => `

      <div class="device-row">

        <div>

          <strong>
            📱 ${esc(
              device.email ||
              device.studentEmail ||
              device.userEmail ||
              "Unknown"
            )}
          </strong>

          <small>
            ${esc(
              device.deviceName ||
              device.device ||
              device.platform ||
              ""
            )}
          </small>

        </div>

        <button
          class="danger"
          onclick="releaseDevice('${esc(device.id)}')"
        >
          Release
        </button>

      </div>

    `).join("");
}


/* =========================================================
   RELEASE DEVICE
========================================================= */

window.releaseDevice = async function(id) {

  if (!confirm("Release this device?")) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "devices", id)
    );

    devices =
      devices.filter(d => d.id !== id);

    renderDevices();

    alert("Device released.");

  } catch (error) {

    console.error(error);

    alert(
      "Device release error: " +
      error.message
    );
  }
};


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

  try {

    await signOut(auth);

    window.location.href =
      "index.html";

  } catch (error) {

    console.error(error);

    alert(
      "Logout error: " +
      error.message
    );
  }
}


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(sectionName) {

  document
    .querySelectorAll(".admin-section")
    .forEach(section => {

      section.style.display =
        section.id === sectionName
          ? "block"
          : "none";

    });

  document
    .querySelectorAll(".sidebar button[data-section]")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.section === sectionName
      );

    });
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* Logout */

  document
    .getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      logoutAdmin
    );


  /* Student */

  document
    .getElementById("saveStudentBtn")
    ?.addEventListener(
      "click",
      saveStudent
    );

  document
    .getElementById("clearStudentBtn")
    ?.addEventListener(
      "click",
      clearStudentForm
    );

  document
    .getElementById("studentSearch")
    ?.addEventListener(
      "input",
      renderStudents
    );

  [
    "studentExamFilter",
    "studentBatchFilter",
    "studentYearFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      ?.addEventListener(
        "change",
        renderStudents
      );

  });


  /* Assign Courses */

  document
    .getElementById("courseAssignSearch")
    ?.addEventListener(
      "input",
      renderAssignCourses
    );

  [
    "courseAssignExamFilter",
    "courseAssignBatchFilter",
    "courseAssignYearFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      ?.addEventListener(
        "change",
        renderAssignCourses
      );

  });


  document
    .getElementById("selectVisibleCoursesBtn")
    ?.addEventListener(
      "click",
      selectVisibleCourses
    );


  /* Courses */

  document
    .getElementById("saveCourseBtn")
    ?.addEventListener(
      "click",
      saveCourse
    );

  document
    .getElementById("clearCourseBtn")
    ?.addEventListener(
      "click",
      clearCourseForm
    );

  document
    .getElementById("courseSearch")
    ?.addEventListener(
      "input",
      renderCourses
    );

  [
    "courseExamFilter",
    "courseBatchFilter",
    "courseYearFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      ?.addEventListener(
        "change",
        renderCourses
      );

  });


  /* Results */

  document
    .getElementById("resultSearch")
    ?.addEventListener(
      "input",
      renderResults
    );

  [
    "resultExamFilter",
    "resultBatchFilter",
    "resultCourseFilter",
    "resultSubjectFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      ?.addEventListener(
        "change",
        renderResults
      );

  });


  document
    .getElementById("deleteAllResultsBtn")
    ?.addEventListener(
      "click",
      deleteAllResults
    );


  document
    .getElementById("refreshResultsBtn")
    ?.addEventListener(
      "click",
      async () => {

        results =
          await loadCollection("testResults");

        populateResultFilters();
        renderResults();
        updateStats();

      }
    );


  /* Sidebar */

  document
    .querySelectorAll(
      ".sidebar button[data-section]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          showSection(
            button.dataset.section
          );
        }
      );

    });


  /* Default section */

  showSection("overview");

});


/* =========================================================
   EXPOSE FUNCTIONS
========================================================= */

window.saveStudent = saveStudent;
window.clearStudentForm = clearStudentForm;

window.saveCourse = saveCourse;
window.clearCourseForm = clearCourseForm;

window.renderStudents = renderStudents;
window.renderCourses = renderCourses;
window.renderAssignCourses = renderAssignCourses;
window.renderResults = renderResults;

window.selectVisibleCourses =
  selectVisibleCourses;

window.deleteAllResults =
  deleteAllResults;

window.logoutAdmin =
  logoutAdmin;
