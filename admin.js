import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  auth,
  db,
  app
} from "./firebase.js";

import {
  DEFAULT_STUDENTS,
  DEFAULT_COURSES
} from "./admin-default-data.js";


/* =========================================================
   ADMIN
========================================================= */

const ADMIN_EMAILS = [
  "fjmcacademy1008@gmail.com"
];


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

let currentUser = null;

let students = {};
let courses = {};
let tests = {};
let results = [];

let editingStudentId = null;
let editingCourseId = null;

let assignedCourseIds = new Set();


function normalize(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function esc(value = "") {

  return String(value ?? "")
    .replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));

}


function studentDocId(email) {

  return email
    .trim()
    .toLowerCase()
    .replaceAll("/", "_");

}


function groupKey(exam, batch, year) {

  return [
    normalize(exam) || "unknown exam",
    normalize(batch) || "unknown batch",
    normalize(year) || "unknown year"
  ].join("|||");

}


function groupLabel(exam, batch, year) {

  return `${exam || "Exam not set"} • ${batch || "Batch not set"} • ${year || "Year not set"}`;

}


function showMsg(text, ok = false) {

  const el = $("loginMsg");

  el.textContent = text;

  el.className =
    "notice " +
    (ok ? "success" : "error");

}


function isAdmin(user) {

  return user &&
    ADMIN_EMAILS.includes(
      (user.email || "").toLowerCase()
    );

}


function uniqueSorted(values) {

  return [...new Set(
    values
      .filter(v => String(v ?? "").trim() !== "")
      .map(v => String(v))
  )].sort((a,b) =>
    a.localeCompare(b, undefined, {
      numeric:true,
      sensitivity:"base"
    })
  );

}


/* =========================================================
   SECONDARY AUTH
========================================================= */

const secondaryApp =
  initializeApp(
    app.options,
    "fjmcStudentCreator"
  );

const secondaryAuth =
  getAuth(secondaryApp);


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async user => {

  if (!user) {

    $("loginView").classList.remove("hidden");
    $("app").classList.add("hidden");

    return;
  }


  if (!isAdmin(user)) {

    showMsg(
      "This Firebase account is not authorized as admin."
    );

    await signOut(auth);

    return;
  }


  currentUser = user;

  $("loginView").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("adminUser").textContent =
    user.email;

  await refreshAll();

});


$("adminLoginForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    const email =
      $("adminEmail")
        .value
        .trim()
        .toLowerCase();

    const password =
      $("adminPassword").value;

    showMsg(
      "Signing in...",
      true
    );

    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    } catch(err) {

      console.error(
        "Admin Firebase login error:",
        err
      );

      const code =
        err?.code || "";

      if(
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {

        showMsg(
          "Incorrect admin email or password."
        );

      }
      else if(
        code === "auth/user-not-found"
      ) {

        showMsg(
          "This Firebase Authentication account does not exist."
        );

      }
      else if(
        code === "auth/invalid-email"
      ) {

        showMsg(
          "Please enter a valid email address."
        );

      }
      else if(
        code === "auth/too-many-requests"
      ) {

        showMsg(
          "Too many attempts. Please try again later."
        );

      }
      else {

        showMsg(
          "Admin login failed: " +
          (err?.message || "Unknown Firebase error")
        );

      }

    }

  }
);


$("logoutBtn").onclick =
  () => signOut(auth);


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(".side button")
  .forEach(btn => {

    btn.onclick = () => {

      document
        .querySelectorAll(".side button")
        .forEach(b =>
          b.classList.remove("active")
        );

      btn.classList.add("active");

      document
        .querySelectorAll(".section")
        .forEach(s =>
          s.classList.remove("active")
        );

      $(btn.dataset.section)
        .classList.add("active");


      if(
        btn.dataset.section === "devices"
      ) {

        loadDevices();

      }


      if(
        btn.dataset.section === "results"
      ) {

        refreshResults();

      }

    };

  });


/* =========================================================
   LOAD FIRESTORE DATA
========================================================= */

async function loadData() {

  students = {};
  courses = {};
  tests = {};

  const [
    studentSnap,
    courseSnap,
    testSnap
  ] = await Promise.all([

    getDocs(
      collection(db, "students")
    ),

    getDocs(
      collection(db, "courses")
    ),

    getDocs(
      collection(db, "tests")
    )

  ]);


  studentSnap.forEach(d => {

    students[d.id] =
      d.data();

  });


  courseSnap.forEach(d => {

    courses[d.id] =
      d.data();

  });


  testSnap.forEach(d => {

    tests[d.id] =
      d.data();

  });


  $("statStudents").textContent =
    Object.keys(students).length;

  $("statCourses").textContent =
    Object.keys(courses).length;

  $("statTests").textContent =
    Object.keys(tests).length;

}


/* =========================================================
   REFRESH ALL
========================================================= */

async function refreshAll() {

  await loadData();

  renderStudentFilters();
  renderCourseFilters();

  renderStudents();
  renderCourses();

  renderCourseChecklist();

  await refreshResults();

}


/* =========================================================
   STUDENT FILTERS
========================================================= */

function renderStudentFilters() {

  const exams =
    uniqueSorted(
      Object.values(students)
        .map(s => s.exam)
    );

  const batches =
    uniqueSorted(
      Object.values(students)
        .map(s => s.batch)
    );

  const years =
    uniqueSorted(
      Object.values(students)
        .map(s => s.year)
    );


  fillSelect(
    $("studentExamFilter"),
    exams,
    "All Exams"
  );

  fillSelect(
    $("studentBatchFilter"),
    batches,
    "All Batches"
  );

  fillSelect(
    $("studentYearFilter"),
    years,
    "All Years"
  );

}


function fillSelect(
  select,
  values,
  firstLabel
) {

  const old =
    select.value;

  select.innerHTML =
    `<option value="">${esc(firstLabel)}</option>` +
    values.map(v =>
      `<option value="${esc(v)}">${esc(v)}</option>`
    ).join("");

  if(
    values.includes(old)
  ) {

    select.value = old;

  }

}


[
  "studentSearch",
  "studentExamFilter",
  "studentBatchFilter",
  "studentYearFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderStudents
  );

  $(id).addEventListener(
    "change",
    renderStudents
  );

});


/* =========================================================
   STUDENTS
========================================================= */

function getFilteredStudents() {

  const search =
    normalize(
      $("studentSearch").value
    );

  const exam =
    normalize(
      $("studentExamFilter").value
    );

  const batch =
    normalize(
      $("studentBatchFilter").value
    );

  const year =
    normalize(
      $("studentYearFilter").value
    );


  return Object.entries(students)
    .filter(([id, s]) => {

      const text = [

        id,
        s.email,
        s.name,
        s.exam,
        s.batch,
        s.year

      ].map(normalize).join(" ");


      if(
        search &&
        !text.includes(search)
      ) {

        return false;

      }


      if(
        exam &&
        normalize(s.exam) !== exam
      ) {

        return false;

      }


      if(
        batch &&
        normalize(s.batch) !== batch
      ) {

        return false;

      }


      if(
        year &&
        normalize(s.year) !== year
      ) {

        return false;

      }


      return true;

    });

}


function renderStudents() {

  const entries =
    getFilteredStudents();


  if(!entries.length) {

    $("studentsTable").innerHTML =
      `<div class="no-results">
        No matching students found.
      </div>`;

    return;

  }


  const groups = {};


  entries.forEach(([id, s]) => {

    const key =
      groupKey(
        s.exam,
        s.batch,
        s.year
      );


    if(!groups[key]) {

      groups[key] = {
        exam:s.exam || "",
        batch:s.batch || "",
        year:s.year || "",
        students:[]
      };

    }


    groups[key].students.push({
      id,
      data:s
    });

  });


  const html =
    Object.values(groups)
      .sort((a,b) =>
        groupLabel(
          a.exam,
          a.batch,
          a.year
        ).localeCompare(
          groupLabel(
            b.exam,
            b.batch,
            b.year
          )
        )
      )
      .map(group => {

        group.students.sort(
          (a,b) =>
            String(a.data.name || "")
              .localeCompare(
                String(b.data.name || ""),
                undefined,
                {sensitivity:"base"}
              )
        );


        return `
          <div class="group-card">

            <div class="group-header">

              <div class="group-title">
                ${esc(
                  groupLabel(
                    group.exam,
                    group.batch,
                    group.year
                  )
                )}
              </div>

              <span class="group-count">
                ${group.students.length} Students
              </span>

            </div>

            <div class="group-body">

              <table class="table">

                <tr>
                  <th>Student</th>
                  <th>Exam / Batch / Year</th>
                  <th>Courses</th>
                  <th>Actions</th>
                </tr>

                ${group.students.map(
                  ({id,s}) => {

                    const coursePills =
                      (s.courses || [])
                        .map(courseId => {

                          const c =
                            courses[courseId];

                          return `
                            <span class="pill">
                              ${esc(
                                c?.title ||
                                courseId
                              )}
                            </span>
                          `;

                        })
                        .join("");


                    return `
                      <tr>

                        <td>
                          <b>
                            ${esc(s.name || "Unnamed")}
                          </b>
                          <br>
                          <span class="small">
                            ${esc(s.email || id)}
                          </span>
                        </td>

                        <td>
                          ${esc(s.exam || "")}
                          <br>
                          ${esc(s.batch || "")}
                          •
                          ${esc(s.year || "")}
                        </td>

                        <td>
                          ${coursePills ||
                            '<span class="small">No courses</span>'}
                        </td>

                        <td>

                          <button
                            class="btn muted"
                            data-edit-student="${esc(id)}"
                          >
                            Edit
                          </button>

                          <button
                            class="btn danger"
                            data-delete-student="${esc(id)}"
                          >
                            Delete
                          </button>

                        </td>

                      </tr>
                    `;

                  }
                ).join("")}

              </table>

            </div>

          </div>
        `;

      })
      .join("");


  $("studentsTable").innerHTML =
    html;


  document
    .querySelectorAll(
      "[data-edit-student]"
    )
    .forEach(button => {

      button.onclick =
        () => editStudent(
          button.dataset.editStudent
        );

    });


  document
    .querySelectorAll(
      "[data-delete-student]"
    )
    .forEach(button => {

      button.onclick =
        () => deleteStudent(
          button.dataset.deleteStudent
        );

    });

}


/* =========================================================
   ASSIGN COURSE CHECKLIST
========================================================= */

function getFilteredAssignCourses() {

  const search =
    normalize(
      $("courseAssignSearch").value
    );

  const exam =
    normalize(
      $("courseAssignExamFilter").value
    );

  const batch =
    normalize(
      $("courseAssignBatchFilter").value
    );

  const year =
    normalize(
      $("courseAssignYearFilter").value
    );


  return Object.entries(courses)
    .filter(([id,c]) => {

      const text = [

        id,
        c.title,
        c.subject,
        c.exam,
        c.batch,
        c.year,
        c.testId,
        c.description

      ].map(normalize).join(" ");


      if(
        search &&
        !text.includes(search)
      ) {

        return false;

      }


      if(
        exam &&
        normalize(c.exam) !== exam
      ) {

        return false;

      }


      if(
        batch &&
        normalize(c.batch) !== batch
      ) {

        return false;

      }


      if(
        year &&
        normalize(c.year) !== year
      ) {

        return false;

      }


      return true;

    });

}


function renderAssignCourseFilters() {

  const exams =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.exam)
    );

  const batches =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.batch)
    );

  const years =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.year)
    );


  fillSelect(
    $("courseAssignExamFilter"),
    exams,
    "All Exams"
  );

  fillSelect(
    $("courseAssignBatchFilter"),
    batches,
    "All Batches"
  );

  fillSelect(
    $("courseAssignYearFilter"),
    years,
    "All Years"
  );

}


function renderCourseChecklist() {

  renderAssignCourseFilters();


  const entries =
    getFilteredAssignCourses();


  if(!entries.length) {

    $("courseChecklist").innerHTML =
      `<div class="empty">
        No matching courses found.
      </div>`;

    return;

  }


  const groups = {};


  entries.forEach(([id,c]) => {

    const key =
      groupKey(
        c.exam,
        c.batch,
        c.year
      );


    if(!groups[key]) {

      groups[key] = {
        exam:c.exam || "",
        batch:c.batch || "",
        year:c.year || "",
        courses:[]
      };

    }


    groups[key].courses.push({
      id,
      data:c
    });

  });


  $("courseChecklist").innerHTML =

    Object.values(groups)
      .sort((a,b) =>
        groupLabel(
          a.exam,
          a.batch,
          a.year
        ).localeCompare(
          groupLabel(
            b.exam,
            b.batch,
            b.year
          )
        )
      )
      .map(group => {

        group.courses.sort(
          (a,b) =>
            String(
              a.data.title ||
              a.id
            ).localeCompare(
              String(
                b.data.title ||
                b.id
              ),
              undefined,
              {sensitivity:"base"}
            )
        );


        return `
          <div class="assign-group">

            <div class="assign-group-header">
              ${esc(
                groupLabel(
                  group.exam,
                  group.batch,
                  group.year
                )
              )}
            </div>

            ${group.courses.map(
              ({id,c}) => {

                const checked =
                  assignedCourseIds.has(id)
                    ? "checked"
                    : "";


                return `
                  <label class="check">

                    <input
                      type="checkbox"
                      value="${esc(id)}"
                      ${checked}
                    >

                    <div class="check-info">

                      <b>
                        ${esc(
                          c.title || id
                        )}
                      </b>

                      <br>

                      <span class="small">
                        ${esc(c.subject || "")}
                        ${c.testId
                          ? " • Test: " +
                            esc(c.testId)
                          : ""}
                      </span>

                    </div>

                  </label>
                `;

              }
            ).join("")}

          </div>
        `;

      })
      .join("");


  document
    .querySelectorAll(
      "#courseChecklist input[type=checkbox]"
    )
    .forEach(input => {

      input.addEventListener(
        "change",
        () => {

          if(input.checked) {

            assignedCourseIds.add(
              input.value
            );

          } else {

            assignedCourseIds.delete(
              input.value
            );

          }

        }
      );

    });

}


/* Assign course search */

[
  "courseAssignSearch",
  "courseAssignExamFilter",
  "courseAssignBatchFilter",
  "courseAssignYearFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderCourseChecklist
  );

  $(id).addEventListener(
    "change",
    renderCourseChecklist
  );

});


$("selectVisibleCoursesBtn").onclick =
  () => {

    const visible =
      getFilteredAssignCourses();


    visible.forEach(
      ([id]) =>
        assignedCourseIds.add(id)
    );


    renderCourseChecklist();

  };


/* =========================================================
   EDIT STUDENT
========================================================= */

function editStudent(id) {

  const s =
    students[id];

  if(!s) return;

  editingStudentId =
    id;


  $("sEmail").value =
    s.email || id;

  $("sName").value =
    s.name || "";

  $("sExam").value =
    s.exam || "";

  $("sBatch").value =
    s.batch || "";

  $("sYear").value =
    s.year || "";

  $("sPassword").value =
    "";


  assignedCourseIds =
    new Set(
      s.courses || []
    );


  renderCourseChecklist();


  document
    .querySelector(
      '[data-section="students"]'
    )
    ?.click();


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


/* =========================================================
   CLEAR STUDENT
========================================================= */

function clearStudent() {

  editingStudentId = null;

  assignedCourseIds =
    new Set();


  $("studentForm").reset();

  renderCourseChecklist();

}


$("newStudentBtn").onclick =
  clearStudent;


/* =========================================================
   SAVE STUDENT
========================================================= */

$("studentForm").onsubmit =
  async e => {

    e.preventDefault();


    const email =
      $("sEmail")
        .value
        .trim()
        .toLowerCase();

    const password =
      $("sPassword")
        .value || "";


    const id =
      studentDocId(email);


    const selected =
      [...assignedCourseIds];


    const wasEditing =
      !!editingStudentId;


    try {

      /* Create Firebase Auth account */

      if(
        !wasEditing &&
        password
      ) {

        if(password.length < 6) {

          throw new Error(
            "Student password must be at least 6 characters."
          );

        }


        try {

          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );

        }
        catch(authErr) {

          if(
            authErr.code !==
            "auth/email-already-in-use"
          ) {

            throw authErr;

          }

        }

      }


      await setDoc(
        doc(db,"students",id),
        {

          email,

          name:
            $("sName")
              .value
              .trim(),

          exam:
            $("sExam")
              .value
              .trim(),

          batch:
            $("sBatch")
              .value
              .trim(),

          year:
            $("sYear")
              .value
              .trim(),

          courses:selected,

          updatedAt:
            serverTimestamp()

        },
        {
          merge:true
        }
      );


      await loadData();

      renderStudentFilters();
      renderCourseFilters();

      renderStudents();
      renderCourses();
      renderCourseChecklist();

      clearStudent();


      alert(
        wasEditing
          ? "Student profile updated."
          : "Student saved successfully."
      );


    }
    catch(err) {

      console.error(err);

      alert(
        "Could not save student: " +
        (
          err.message ||
          err.code ||
          "Unknown error"
        )
      );

    }

  };


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(id) {

  if(
    !confirm(
      "Delete this student profile? Firebase Authentication account will NOT be deleted."
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(db,"students",id)
    );


    await loadData();

    renderStudentFilters();
    renderStudents();
    renderCourseChecklist();

  }
  catch(err) {

    alert(
      "Could not delete student: " +
      err.message
    );

  }

}


/* =========================================================
   COURSE CONTENT
========================================================= */

function addContentRow(
  item = {
    type:"video",
    title:"",
    url:""
  }
) {

  const row =
    document.createElement("div");

  row.className =
    "content-row";


  row.innerHTML = `

    <label>
      Type

      <select class="ct-type">

        <option value="video">
          YouTube / Video
        </option>

        <option value="local-video">
          Local Video
        </option>

        <option value="pdf">
          PDF
        </option>

        <option value="live">
          Live
        </option>

      </select>

    </label>


    <label>
      Title
      <input class="ct-title">
    </label>


    <label>
      URL
      <input class="ct-url">
    </label>


    <button
      type="button"
      class="btn danger remove-content"
    >
      ×
    </button>

  `;


  row.querySelector(
    ".ct-type"
  ).value =
    item.type || "video";


  row.querySelector(
    ".ct-title"
  ).value =
    item.title || "";


  row.querySelector(
    ".ct-url"
  ).value =
    item.url || "";


  row.querySelector(
    ".remove-content"
  ).onclick =
    () => row.remove();


  $("contentsEditor")
    .appendChild(row);

}


$("addContentBtn").onclick =
  () => addContentRow();


/* =========================================================
   CLEAR COURSE
========================================================= */

function clearCourse() {

  editingCourseId = null;

  $("courseForm").reset();

  $("contentsEditor").innerHTML = "";

  addContentRow();

}


$("newCourseBtn").onclick =
  clearCourse;


/* =========================================================
   EDIT COURSE
========================================================= */

function editCourse(id) {

  const c =
    courses[id];

  if(!c) return;


  editingCourseId =
    id;


  $("cId").value =
    id;

  $("cExam").value =
    c.exam || "";

  $("cBatch").value =
    c.batch || "";

  $("cYear").value =
    c.year || "";

  $("cSubject").value =
    c.subject || "";

  $("cTitle").value =
    c.title || "";

  $("cDescription").value =
    c.description || "";

  $("cTestId").value =
    c.testId || "";


  $("contentsEditor").innerHTML = "";


  (c.contents || [])
    .forEach(addContentRow);


  if(
    !(c.contents || []).length
  ) {

    addContentRow();

  }


  document
    .querySelector(
      '[data-section="courses"]'
    )
    ?.click();


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


/* =========================================================
   COURSE FILTERS
========================================================= */

function renderCourseFilters() {

  const exams =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.exam)
    );

  const batches =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.batch)
    );

  const years =
    uniqueSorted(
      Object.values(courses)
        .map(c => c.year)
    );


  fillSelect(
    $("courseExamFilter"),
    exams,
    "All Exams"
  );

  fillSelect(
    $("courseBatchFilter"),
    batches,
    "All Batches"
  );

  fillSelect(
    $("courseYearFilter"),
    years,
    "All Years"
  );

}


[
  "courseSearch",
  "courseExamFilter",
  "courseBatchFilter",
  "courseYearFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderCourses
  );

  $(id).addEventListener(
    "change",
    renderCourses
  );

});


/* =========================================================
   FILTER COURSES
========================================================= */

function getFilteredCourses() {

  const search =
    normalize(
      $("courseSearch").value
    );

  const exam =
    normalize(
      $("courseExamFilter").value
    );

  const batch =
    normalize(
      $("courseBatchFilter").value
    );

  const year =
    normalize(
      $("courseYearFilter").value
    );


  return Object.entries(courses)
    .filter(([id,c]) => {

      const text = [

        id,
        c.title,
        c.subject,
        c.exam,
        c.batch,
        c.year,
        c.testId,
        c.description

      ].map(normalize).join(" ");


      if(
        search &&
        !text.includes(search)
      ) {

        return false;

      }


      if(
        exam &&
        normalize(c.exam) !== exam
      ) {

        return false;

      }


      if(
        batch &&
        normalize(c.batch) !== batch
      ) {

        return false;

      }


      if(
        year &&
        normalize(c.year) !== year
      ) {

        return false;

      }


      return true;

    });

}


/* =========================================================
   RENDER COURSES
========================================================= */

function renderCourses() {

  $("statCourses").textContent =
    Object.keys(courses).length;


  const entries =
    getFilteredCourses();


  if(!entries.length) {

    $("coursesTable").innerHTML =
      `<div class="no-results">
        No matching courses found.
      </div>`;

    return;

  }


  const groups = {};


  entries.forEach(([id,c]) => {

    const key =
      groupKey(
        c.exam,
        c.batch,
        c.year
      );


    if(!groups[key]) {

      groups[key] = {

        exam:c.exam || "",
        batch:c.batch || "",
        year:c.year || "",

        courses:[]

      };

    }


    groups[key].courses.push({
      id,
      data:c
    });

  });


  $("coursesTable").innerHTML =

    Object.values(groups)
      .sort((a,b) =>
        groupLabel(
          a.exam,
          a.batch,
          a.year
        ).localeCompare(
          groupLabel(
            b.exam,
            b.batch,
            b.year
          )
        )
      )
      .map(group => {

        group.courses.sort(
          (a,b) =>
            String(
              a.data.title ||
              a.id
            ).localeCompare(
              String(
                b.data.title ||
                b.id
              ),
              undefined,
              {sensitivity:"base"}
            )
        );


        return `

          <div class="group-card">

            <div class="group-header">

              <div class="group-title">
                ${esc(
                  groupLabel(
                    group.exam,
                    group.batch,
                    group.year
                  )
                )}
              </div>

              <span class="group-count">
                ${group.courses.length} Courses
              </span>

            </div>


            <table class="table">

              <tr>
                <th>Course</th>
                <th>Exam / Batch / Year</th>
                <th>Subject</th>
                <th>Test</th>
                <th>Content</th>
                <th>Actions</th>
              </tr>


              ${group.courses.map(
                ({id,c}) => `

                  <tr>

                    <td>
                      <b>
                        ${esc(
                          c.title || id
                        )}
                      </b>

                      <br>

                      <span class="small">
                        ${esc(id)}
                      </span>
                    </td>


                    <td>
                      ${esc(c.exam || "")}
                      <br>
                      ${esc(c.batch || "")}
                      •
                      ${esc(c.year || "")}
                    </td>


                    <td>
                      ${esc(
                        c.subject || ""
                      )}
                    </td>


                    <td>
                      ${esc(
                        c.testId || "-"
                      )}
                    </td>


                    <td>
                      ${(c.contents || []).length}
                      items
                    </td>


                    <td>

                      <button
                        class="btn muted"
                        data-edit-course="${esc(id)}"
                      >
                        Edit
                      </button>

                      <button
                        class="btn danger"
                        data-delete-course="${esc(id)}"
                      >
                        Delete
                      </button>

                    </td>

                  </tr>

                `
              ).join("")}

            </table>

          </div>

        `;

      })
      .join("");


  document
    .querySelectorAll(
      "[data-edit-course]"
    )
    .forEach(button => {

      button.onclick =
        () => editCourse(
          button.dataset.editCourse
        );

    });


  document
    .querySelectorAll(
      "[data-delete-course]"
    )
    .forEach(button => {

      button.onclick =
        () => deleteCourse(
          button.dataset.deleteCourse
        );

    });

}


/* =========================================================
   SAVE COURSE
========================================================= */

$("courseForm").onsubmit =
  async e => {

    e.preventDefault();


    const id =
      $("cId")
        .value
        .trim();


    if(!id) {

      alert("Course ID is required.");

      return;

    }


    const contents =
      [
        ...document.querySelectorAll(
          "#contentsEditor .content-row"
        )
      ]
      .map(row => ({

        type:
          row.querySelector(
            ".ct-type"
          ).value,

        title:
          row.querySelector(
            ".ct-title"
          ).value
          .trim(),

        url:
          row.querySelector(
            ".ct-url"
          ).value
          .trim()

      }))
      .filter(
        x => x.title || x.url
      );


    try {

      await setDoc(
        doc(db,"courses",id),
        {

          exam:
            $("cExam")
              .value
              .trim(),

          batch:
            $("cBatch")
              .value
              .trim(),

          year:
            $("cYear")
              .value
              .trim(),

          subject:
            $("cSubject")
              .value
              .trim(),

          title:
            $("cTitle")
              .value
              .trim(),

          description:
            $("cDescription")
              .value
              .trim(),

          testId:
            $("cTestId")
              .value
              .trim() || id,

          contents,

          updatedAt:
            serverTimestamp()

        },
        {
          merge:true
        }
      );


      await loadData();

      renderCourseFilters();
      renderCourses();
      renderCourseChecklist();


      clearCourse();


      alert(
        "Course saved successfully."
      );


    }
    catch(err) {

      console.error(err);

      alert(
        "Could not save course: " +
        err.message
      );

    }

  };


/* =========================================================
   DELETE COURSE
========================================================= */

async function deleteCourse(id) {

  if(
    !confirm(
      "Delete this course? Student assignments containing this ID will remain until you edit them."
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(db,"courses",id)
    );


    await loadData();

    renderCourseFilters();
    renderCourses();
    renderCourseChecklist();

  }
  catch(err) {

    alert(
      "Could not delete course: " +
      err.message
    );

  }

}


/* =========================================================
   RESULTS
========================================================= */

async function loadResults() {

  const snap =
    await getDocs(
      collection(db,"testResults")
    );


  results = [];


  snap.forEach(d => {

    results.push({

      id:d.id,
      data:d.data()

    });

  });


  $("statResults").textContent =
    results.length;

}


/* =========================================================
   RESULT HELPERS
========================================================= */

function getResultCourse(x) {

  const courseId =
    x.courseId ||
    x.course ||
    "";


  return courses[courseId] || null;

}


function getResultStudent(x) {

  const email =
    normalize(x.email);


  if(!email) return null;


  const found =
    Object.values(students)
      .find(
        s =>
          normalize(s.email) === email
      );


  return found || null;

}


function getResultTest(x) {

  const testId =
    x.testId ||
    x.test ||
    "";


  return tests[testId] || null;

}


function getResultExam(x) {

  const course =
    getResultCourse(x);

  const student =
    getResultStudent(x);

  const test =
    getResultTest(x);


  return (
    x.exam ||
    course?.exam ||
    student?.exam ||
    test?.exam ||
    ""
  );

}


function getResultBatch(x) {

  const course =
    getResultCourse(x);

  const student =
    getResultStudent(x);

  const test =
    getResultTest(x);


  return (
    x.batch ||
    course?.batch ||
    student?.batch ||
    test?.batch ||
    ""
  );

}


function getResultCourseName(x) {

  const course =
    getResultCourse(x);


  return (
    x.courseName ||
    course?.title ||
    x.course ||
    x.courseId ||
    "-"
  );

}


function getResultSubject(x) {

  const course =
    getResultCourse(x);


  const test =
    getResultTest(x);


  return (
    x.subject ||
    course?.subject ||
    test?.subject ||
    "-"
  );

}


function getResultTestName(x) {

  const test =
    getResultTest(x);


  return (
    x.testName ||
    x.title ||
    test?.title ||
    x.testId ||
    "-"
  );

}


function getResultStudentName(x) {

  const student =
    getResultStudent(x);


  return (
    x.name ||
    student?.name ||
    "-"
  );

}


function getResultStudentEmail(x) {

  return (
    x.email ||
    "-"
  );

}


function isStudentEnrolled(x) {

  const student =
    getResultStudent(x);

  if(!student) {

    return false;

  }


  const courseId =
    x.courseId ||
    x.course ||
    "";


  if(
    !courseId
  ) {

    return true;

  }


  return (
    Array.isArray(student.courses) &&
    student.courses.includes(courseId)
  );

}


/* =========================================================
   RESULT FILTERS
========================================================= */

function renderResultFilters() {

  const exams =
    uniqueSorted(
      results.map(
        r => getResultExam(r.data)
      )
    );


  const batches =
    uniqueSorted(
      results.map(
        r => getResultBatch(r.data)
      )
    );


  const coursesList =
    uniqueSorted(
      results.map(
        r => getResultCourseName(r.data)
      )
    );


  const subjects =
    uniqueSorted(
      results.map(
        r => getResultSubject(r.data)
      )
    );


  fillSelect(
    $("resultExamFilter"),
    exams,
    "All Exams"
  );

  fillSelect(
    $("resultBatchFilter"),
    batches,
    "All Batches"
  );

  fillSelect(
    $("resultCourseFilter"),
    coursesList,
    "All Courses"
  );

  fillSelect(
    $("resultSubjectFilter"),
    subjects,
    "All Subjects"
  );

}


[
  "resultSearch",
  "resultExamFilter",
  "resultBatchFilter",
  "resultCourseFilter",
  "resultSubjectFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderResults
  );

  $(id).addEventListener(
    "change",
    renderResults
  );

});


/* =========================================================
   FILTER RESULTS
========================================================= */

function getFilteredResults() {

  const search =
    normalize(
      $("resultSearch").value
    );


  const exam =
    normalize(
      $("resultExamFilter").value
    );


  const batch =
    normalize(
      $("resultBatchFilter").value
    );


  const course =
    normalize(
      $("resultCourseFilter").value
    );


  const subject =
    normalize(
      $("resultSubjectFilter").value
    );


  return results.filter(
    r => {

      const x =
        r.data;


      const searchText = [

        r.id,

        x.name,

        x.email,

        x.course,

        x.courseId,

        x.courseName,

        x.subject,

        x.testId,

        x.testName,

        x.title,

        getResultExam(x),

        getResultBatch(x)

      ].map(normalize).join(" ");


      if(
        search &&
        !searchText.includes(search)
      ) {

        return false;

      }


      if(
        exam &&
        normalize(
          getResultExam(x)
        ) !== exam
      ) {

        return false;

      }


      if(
        batch &&
        normalize(
          getResultBatch(x)
        ) !== batch
      ) {

        return false;

      }


      if(
        course &&
        normalize(
          getResultCourseName(x)
        ) !== course
      ) {

        return false;

      }


      if(
        subject &&
        normalize(
          getResultSubject(x)
        ) !== subject
      ) {

        return false;

      }


      return true;

    }
  );

}


/* =========================================================
   RESULT DATE
========================================================= */

function getResultDate(value) {

  if(
    value?.toDate
  ) {

    return value
      .toDate()
      .toLocaleString();

  }


  if(
    typeof value === "number"
  ) {

    return new Date(value)
      .toLocaleString();

  }


  return String(
    value || "-"
  );

}


/* =========================================================
   RESULT SCORE
========================================================= */

function getScore(x) {

  const score =
    Number(
      x.score ??
      x.marks ??
      0
    );


  const total =
    Number(
      x.total ??
      x.totalMarks ??
      0
    );


  return {
    score,
    total
  };

}


function getPercentage(x) {

  const {
    score,
    total
  } = getScore(x);


  if(!total) return 0;


  return (
    score / total * 100
  );

}


/* =========================================================
   RESULT PDF
========================================================= */

function downloadResultPDF(resultId) {

  const result =
    results.find(
      r => r.id === resultId
    );


  if(!result) {

    alert("Result not found.");

    return;

  }


  const x =
    result.data;


  const course =
    getResultCourse(x);

  const student =
    getResultStudent(x);

  const test =
    getResultTest(x);


  const {
    score,
    total
  } =
    getScore(x);


  const percentage =
    getPercentage(x);


  const enrolled =
    isStudentEnrolled(x);


  const studentName =
    getResultStudentName(x);


  const email =
    getResultStudentEmail(x);


  const exam =
    getResultExam(x);


  const batch =
    getResultBatch(x);


  const courseName =
    getResultCourseName(x);


  const subject =
    getResultSubject(x);


  const testName =
    getResultTestName(x);


  const submittedAt =
    getResultDate(
      x.submittedAt
    );


  /*
    We create a printable HTML document.
    Browser's print dialog allows
    "Save as PDF".
  */

  const answers =
    Array.isArray(x.answers)
      ? x.answers
      : Array.isArray(x.details)
        ? x.details
        : [];


  const answerRows =
    answers.map(
      (a,index) => {

        const question =
          a.question ||
          a.questionText ||
          `Question ${index + 1}`;

        const selected =
          a.selectedAnswer ??
          a.selected ??
          a.answer ??
          "-";

        const correct =
          a.correctAnswer ??
          a.correct ??
          "-";

        const isCorrect =
          a.isCorrect ??
          (
            normalize(selected) ===
            normalize(correct)
          );


        const solution =
          a.solution ||
          a.explanation ||
          "";


        return `

          <div class="question">

            <h3>
              Q${index + 1}. ${esc(question)}
            </h3>

            <p>
              <b>Your Answer:</b>
              ${esc(selected)}
            </p>

            <p>
              <b>Correct Answer:</b>
              ${esc(correct)}
            </p>

            <p>
              <b>Status:</b>
              <span class="${isCorrect ? "correct" : "wrong"}">
                ${isCorrect ? "Correct" : "Incorrect"}
              </span>
            </p>

            ${
              solution
                ? `
                  <p>
                    <b>Solution:</b>
                    ${esc(solution)}
                  </p>
                `
                : ""
            }

          </div>

        `;

      }
    ).join("");


  const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>FJMC Academy Result</title>

<style>

body{
  font-family:Arial,sans-serif;
  padding:35px;
  color:#111;
  line-height:1.5;
}

h1{
  margin-bottom:5px;
}

.header{
  text-align:center;
  border-bottom:2px solid #111;
  padding-bottom:15px;
  margin-bottom:25px;
}

.info{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-bottom:20px;
}

.info div{
  padding:8px;
  border:1px solid #ddd;
}

.score-box{
  border:2px solid #111;
  padding:15px;
  margin:20px 0;
  text-align:center;
}

.score{
  font-size:28px;
  font-weight:bold;
}

.question{
  border:1px solid #ddd;
  padding:15px;
  margin:12px 0;
  page-break-inside:avoid;
}

.correct{
  color:green;
  font-weight:bold;
}

.wrong{
  color:red;
  font-weight:bold;
}

.footer{
  margin-top:30px;
  border-top:1px solid #ddd;
  padding-top:10px;
  font-size:12px;
}

@media print{

  body{
    padding:10px;
  }

}

</style>

</head>


<body>

<div class="header">

  <h1>FJMC Academy</h1>

  <div>
    Test Result
  </div>

</div>


<div class="info">

  <div>
    <b>Student</b><br>
    ${esc(studentName)}
  </div>

  <div>
    <b>Email</b><br>
    ${esc(email)}
  </div>

  <div>
    <b>Exam</b><br>
    ${esc(exam || "-")}
  </div>

  <div>
    <b>Batch</b><br>
    ${esc(batch || "-")}
  </div>

  <div>
    <b>Course</b><br>
    ${esc(courseName)}
  </div>

  <div>
    <b>Subject</b><br>
    ${esc(subject)}
  </div>

  <div>
    <b>Test</b><br>
    ${esc(testName)}
  </div>

  <div>
    <b>Submitted</b><br>
    ${esc(submittedAt)}
  </div>

</div>


<div class="score-box">

  <div class="score">
    ${score} / ${total}
  </div>

  <div>
    Percentage:
    ${percentage.toFixed(2)}%
  </div>

  <div>
    Enrollment:
    ${enrolled
      ? "Enrolled"
      : "Not Enrolled"}
  </div>

</div>


<h2>Question Details</h2>

${
  answerRows ||
  "<p>No detailed answer data was saved with this result.</p>"
}


<div class="footer">

  Result ID:
  ${esc(resultId)}

  <br>

  Generated by FJMC Academy Admin Panel

</div>


<script>

window.onload = function(){

  setTimeout(function(){

    window.print();

  },300);

};

</script>


</body>

</html>
`;


  const blob =
    new Blob(
      [html],
      {
        type:"text/html"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const a =
    document.createElement("a");


  a.href = url;

  a.target = "_blank";

  a.rel = "noopener";


  /*
    Open printable result.
    User can select "Save as PDF".
  */

  const win =
    window.open(
      url,
      "_blank"
    );


  if(!win) {

    a.click();

  }


  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    60000
  );

}


/* =========================================================
   RENDER RESULTS
========================================================= */

function renderResults() {

  const filtered =
    getFilteredResults();


  const enrolledCount =
    filtered.filter(
      r => isStudentEnrolled(r.data)
    ).length;


  const notEnrolledCount =
    filtered.length -
    enrolledCount;


  $("resultSummary").innerHTML = `

    <span class="pill">
      Total: ${filtered.length}
    </span>

    <span class="pill green">
      Enrolled: ${enrolledCount}
    </span>

    <span class="pill red">
      Not Enrolled: ${notEnrolledCount}
    </span>

  `;


  if(!filtered.length) {

    $("resultsTable").innerHTML =
      `<div class="no-results">
        No matching test results found.
      </div>`;

    return;

  }


  /*
    GROUP:
    Exam → Batch → Course → Subject → Test
  */

  const groups = {};


  filtered.forEach(result => {

    const x =
      result.data;


    const key = [

      normalize(
        getResultExam(x)
      ),

      normalize(
        getResultBatch(x)
      ),

      normalize(
        getResultCourseName(x)
      ),

      normalize(
        getResultSubject(x)
      ),

      normalize(
        getResultTestName(x)
      )

    ].join("|||");


    if(!groups[key]) {

      groups[key] = {

        exam:
          getResultExam(x),

        batch:
          getResultBatch(x),

        course:
          getResultCourseName(x),

        subject:
          getResultSubject(x),

        test:
          getResultTestName(x),

        results:[]

      };

    }


    groups[key]
      .results
      .push(result);

  });


  const html =

    Object.values(groups)
      .sort((a,b) => {

        const aa = [
          a.exam,
          a.batch,
          a.course,
          a.subject,
          a.test
        ].join(" ");

        const bb = [
          b.exam,
          b.batch,
          b.course,
          b.subject,
          b.test
        ].join(" ");

        return aa.localeCompare(
          bb,
          undefined,
          {
            numeric:true,
            sensitivity:"base"
          }
        );

      })
      .map(group => {

        group.results.sort(
          (a,b) =>
            getResultStudentName(
              a.data
            ).localeCompare(
              getResultStudentName(
                b.data
              )
            )
        );


        return `

          <div class="result-group">

            <div class="result-group-title">

              ${esc(group.exam || "Exam not set")}
              →
              ${esc(group.batch || "Batch not set")}
              →
              ${esc(group.course)}
              →
              ${esc(group.subject)}
              →
              ${esc(group.test)}

            </div>


            ${group.results.map(
              result => {

                const x =
                  result.data;


                const {
                  score,
                  total
                } =
                  getScore(x);


                const percentage =
                  getPercentage(x);


                const enrolled =
                  isStudentEnrolled(x);


                return `

                  <div class="result-item">

                    <div class="result-main">

                      <div>

                        <b>
                          ${esc(
                            getResultStudentName(x)
                          )}
                        </b>

                        <br>

                        <span class="small">
                          ${esc(
                            getResultStudentEmail(x)
                          )}
                        </span>

                      </div>


                      <div>

                        <b>
                          ${esc(
                            getResultCourseName(x)
                          )}
                        </b>

                        <br>

                        <span class="small">
                          ${esc(
                            getResultSubject(x)
                          )}
                        </span>

                      </div>


                      <div>

                        <span class="score">
                          ${esc(score)}
                          /
                          ${esc(total)}
                        </span>

                        <br>

                        <span class="small">
                          ${percentage.toFixed(2)}%
                        </span>

                      </div>


                      <div>

                        <span class="${
                          enrolled
                            ? "status-enrolled"
                            : "status-not-enrolled"
                        }">

                          ${
                            enrolled
                              ? "ENROLLED"
                              : "NOT ENROLLED"
                          }

                        </span>

                      </div>


                      <div>

                        <span class="small">

                          ${esc(
                            getResultDate(
                              x.submittedAt
                            )
                          )}

                        </span>

                      </div>


                      <div>

                        <button
                          class="btn primary"
                          data-download-result="${esc(
                            result.id
                          )}"
                        >
                          📄 PDF
                        </button>

                        <button
                          class="btn danger"
                          data-delete-result="${esc(
                            result.id
                          )}"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </div>

                `;

              }
            ).join("")}

          </div>

        `;

      })
      .join("");


  $("resultsTable").innerHTML =
    html;


  document
    .querySelectorAll(
      "[data-download-result]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          downloadResultPDF(
            button.dataset.downloadResult
          );

    });


  document
    .querySelectorAll(
      "[data-delete-result]"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          if(
            !confirm(
              "Delete this result?"
            )
          ) {

            return;

          }


          try {

            await deleteDoc(
              doc(
                db,
                "testResults",
                button.dataset.deleteResult
              )
            );


            await refreshResults();

          }
          catch(err) {

            alert(
              "Could not delete result: " +
              err.message
            );

          }

        };

    });

}


/* =========================================================
   REFRESH RESULTS
========================================================= */

async function refreshResults() {

  try {

    await loadResults();

    renderResultFilters();

    renderResults();

  }
  catch(err) {

    console.error(err);

    $("resultsTable").innerHTML =
      `<div class="no-results">
        Could not load results.
        Check Firestore rules.
      </div>`;

  }

}


$("refreshResultsBtn").onclick =
  refreshResults;


/* =========================================================
   DELETE ALL RESULTS
========================================================= */

$("clearResultsBtn").onclick =
  async () => {

    if(
      !confirm(
        "Delete ALL testResults documents? This cannot be undone."
      )
    ) {

      return;

    }


    try {

      const snap =
        await getDocs(
          collection(
            db,
            "testResults"
          )
        );


      for(
        const d of snap.docs
      ) {

        await deleteDoc(
          d.ref
        );

      }


      await refreshResults();


      alert(
        "All test results deleted."
      );

    }
    catch(err) {

      alert(
        "Could not delete all results: " +
        err.message
      );

    }

  };


/* =========================================================
   DEVICES
========================================================= */

async function loadDevices() {

  const host =
    $("deviceStudents");


  host.innerHTML =
    "Loading...";


  let html = "";


  try {

    const usersSnap =
      await getDocs(
        collection(db,"users")
      );


    for(
      const ud of usersSnap.docs
    ) {

      const u =
        ud.data();


      if(!u.email) continue;


      const devicesSnap =
        await getDocs(
          collection(
            db,
            "users",
            ud.id,
            "devices"
          )
        );


      html += `

        <div class="card">

          <b>
            ${esc(u.email)}
          </b>

      `;


      if(
        devicesSnap.empty
      ) {

        html +=
          `<p class="small">
            No reserved devices.
          </p>`;

      }


      for(
        const dd of devicesSnap.docs
      ) {

        const x =
          dd.data();


        html += `

          <div class="device">

            <button
              class="btn danger"
              data-release-device="${esc(
                ud.id
              )}|${esc(dd.id)}"
            >
              Release
            </button>


            <b>
              ${esc(
                x.deviceType ||
                "unknown"
              )}
            </b>

            <br>

            <span class="small">

              Device:
              ${esc(dd.id)}

              |

              Expires:
              ${esc(
                x.expiresAt
                  ? new Date(
                      Number(
                        x.expiresAt
                      )
                    ).toLocaleString()
                  : "-"
              )}

            </span>

          </div>

        `;

      }


      html +=
        `</div>`;

    }


    host.innerHTML =
      html ||
      `<p class="small">
        No users/devices found.
        Device documents are created when students log in.
      </p>`;


    document
      .querySelectorAll(
        "[data-release-device]"
      )
      .forEach(button => {

        button.onclick =
          async () => {

            if(
              !confirm(
                "Release this device reservation?"
              )
            ) {

              return;

            }


            const [
              uid,
              did
            ] =
              button
                .dataset
                .releaseDevice
                .split("|");


            try {

              await deleteDoc(
                doc(
                  db,
                  "users",
                  uid,
                  "devices",
                  did
                )
              );


              loadDevices();

            }
            catch(err) {

              alert(
                "Could not release device: " +
                err.message
              );

            }

          };

      });

  }
  catch(err) {

    console.error(err);

    host.innerHTML =
      `<p class="small">
        Could not load devices.
        Check Firestore rules.
      </p>`;

  }

}


/* =========================================================
   IMPORT DEFAULT DATA
========================================================= */

$("seedBtn").onclick =
  async () => {

    if(
      !confirm(
        "Import the existing dashboard students and courses into Firestore? Existing documents with the same IDs will be overwritten."
      )
    ) {

      return;

    }


    try {

      for(
        const [
          email,
          s
        ] of Object.entries(
          DEFAULT_STUDENTS
        )
      ) {

        if(
          ADMIN_EMAILS.includes(
            email.toLowerCase()
          )
        ) {

          continue;

        }


        await setDoc(
          doc(
            db,
            "students",
            studentDocId(email)
          ),
          {

            ...s,

            email,

            updatedAt:
              serverTimestamp()

          }
        );

      }


      for(
        const [
          id,
          c
        ] of Object.entries(
          DEFAULT_COURSES
        )
      ) {

        await setDoc(
          doc(
            db,
            "courses",
            id
          ),
          {

            ...c,

            updatedAt:
              serverTimestamp()

          }
        );

      }


      await refreshAll();


      alert(
        "Existing dashboard data imported successfully."
      );

    }
    catch(err) {

      console.error(err);

      alert(
        "Import failed: " +
        err.message
      );

    }

  };


/* =========================================================
   INITIAL COURSE FORM
========================================================= */

clearCourse();
