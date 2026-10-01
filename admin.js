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
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { auth, db, app } from "./firebase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  DEFAULT_STUDENTS,
  DEFAULT_COURSES
} from "./admin-default-data.js";


// ======================================================
// ADMIN EMAIL
// ======================================================

const ADMIN_EMAILS = [
  "fjmcacademy1008@gmail.com"
];


// ======================================================
// VARIABLES
// ======================================================

const $ = id => document.getElementById(id);

let currentUser = null;

let students = {};
let courses = {};

let editingStudentId = null;
let editingCourseId = null;


// ======================================================
// SECONDARY FIREBASE AUTH
// Student account create karne ke liye
// ======================================================

const secondaryApp =
  initializeApp(app.options, "fjmcStudentCreator");

const secondaryAuth =
  getAuth(secondaryApp);


// ======================================================
// HELPERS
// ======================================================

function studentDocId(email){
  return email
    .trim()
    .toLowerCase()
    .replaceAll("/", "_");
}


function showMsg(text, ok=false){

  const el = $("loginMsg");

  el.textContent = text;

  el.className =
    "notice " + (ok ? "success" : "error");
}


function isAdmin(user){

  return user &&
    ADMIN_EMAILS.includes(
      (user.email || "").toLowerCase()
    );
}


function esc(v=""){

  return String(v).replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "\"":"&quot;",
      "'":"&#39;"
    }[c])
  );
}


// ======================================================
// LOGIN
// ======================================================

onAuthStateChanged(auth, async user => {

  if(!user){

    $("loginView").classList.remove("hidden");
    $("app").classList.add("hidden");

    return;
  }


  if(!isAdmin(user)){

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
      $("adminEmail").value.trim().toLowerCase();

    const password =
      $("adminPassword").value;

    showMsg("Signing in...", true);

    try{

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    }catch(err){

      console.error(
        "Admin Firebase login error:",
        err
      );

      const code =
        err?.code || "";

      if(
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ){

        showMsg(
          "Incorrect admin email or password."
        );

      }else if(code === "auth/user-not-found"){

        showMsg(
          "This Firebase Authentication account does not exist."
        );

      }else if(code === "auth/invalid-email"){

        showMsg(
          "Please enter a valid email address."
        );

      }else if(code === "auth/too-many-requests"){

        showMsg(
          "Too many attempts. Please try again later."
        );

      }else{

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


// ======================================================
// SIDEBAR
// ======================================================

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
      ){

        loadDevices();
      }

    };

  });


// ======================================================
// LOAD FIRESTORE DATA
// ======================================================

async function loadData(){

  students = {};
  courses = {};


  const [
    studentSnap,
    courseSnap
  ] = await Promise.all([

    getDocs(
      collection(db, "students")
    ),

    getDocs(
      collection(db, "courses")
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

}


// ======================================================
// REFRESH EVERYTHING
// ======================================================

async function refreshAll(){

  await loadData();

  renderStudents();

  renderCourses();

  renderCourseChecklist();

  await refreshResults();

}


// ======================================================
// COURSE CHECKLIST
// ======================================================

function renderCourseChecklist(){

  $("courseChecklist").innerHTML =

    Object.entries(courses)

      .map(([id,c]) => `

        <label class="check">

          <input
            type="checkbox"
            value="${esc(id)}">

          ${esc(c.title || id)}

          <span class="small">
            (${esc(c.exam || "")}
            •
            ${esc(c.batch || "")}
            •
            ${esc(c.year || "")})
          </span>

        </label>

      `)

      .join("")

      ||

      `<div class="small">
        No courses yet. Create a course first.
      </div>`;
}


// ======================================================
// STUDENT GROUPING
// Exam → Batch → Students
// ======================================================

function groupStudents(){

  const groups = {};


  Object.entries(students)
    .forEach(([id,s]) => {

      const exam =
        (s.exam || "Other").trim() || "Other";

      const batch =
        (s.batch || "No Batch").trim() ||
        "No Batch";


      if(!groups[exam]){
        groups[exam] = {};
      }


      if(!groups[exam][batch]){
        groups[exam][batch] = [];
      }


      groups[exam][batch].push({
        id,
        ...s
      });

    });


  return groups;
}


// ======================================================
// RENDER STUDENTS
// ======================================================

function renderStudents(){

  $("statStudents").textContent =
    Object.keys(students).length;


  const search =
    ($("studentSearch")?.value || "")
      .trim()
      .toLowerCase();


  const filtered =
    Object.entries(students)
      .filter(([id,s]) => {

        const text = [

          id,
          s.email,
          s.name,
          s.exam,
          s.batch,
          s.year

        ].join(" ").toLowerCase();


        return text.includes(search);

      });


  if($("studentSearchCount")){

    $("studentSearchCount").textContent =
      search

        ? `Showing ${filtered.length} of ${Object.keys(students).length} students`

        : `${filtered.length} students`;
  }


  // Temporary filtered object
  const filteredObject = {};


  filtered.forEach(([id,s]) => {

    filteredObject[id] = s;

  });


  const oldStudents =
    students;


  students =
    filteredObject;


  const groups =
    groupStudents();


  students =
    oldStudents;


  let html = "";


  const exams =
    Object.keys(groups).sort();


  exams.forEach(exam => {

    const batches =
      Object.keys(groups[exam]).sort();


    let examTotal = 0;

    batches.forEach(batch => {

      examTotal +=
        groups[exam][batch].length;

    });


    html += `

      <div class="group-card">

        <div class="group-header">

          <h3>
            🎓 ${esc(exam)}
          </h3>

          <span class="pill">
            ${examTotal} Students
          </span>

        </div>
    `;


    batches.forEach(batch => {

      const list =
        groups[exam][batch];


      html += `

        <div class="batch-section">

          <div class="batch-header">
            📌 Batch:
            ${esc(batch)}
            —
            ${list.length} Students
          </div>

          <div class="group-content">

            <table class="table">

              <tr>
                <th>Student</th>
                <th>Email / ID</th>
                <th>Year</th>
                <th>Courses</th>
                <th>Actions</th>
              </tr>
      `;


      list.forEach(s => {

        html += `

          <tr>

            <td>
              <b>
                ${esc(s.name || "")}
              </b>
            </td>

            <td>

              ${esc(s.email || s.id)}

              <br>

              <span class="small">
                ID: ${esc(s.id)}
              </span>

            </td>

            <td>
              ${esc(s.year || "")}
            </td>

            <td>

              ${(s.courses || [])
                .map(x => `

                  <span class="pill">
                    ${esc(
                      courses[x]?.title || x
                    )}
                  </span>

                `)
                .join("")}

            </td>

            <td>

              <button
                class="btn muted"
                data-edit-student="${esc(s.id)}">
                Edit
              </button>

              <button
                class="btn danger"
                data-delete-student="${esc(s.id)}">
                Delete
              </button>

            </td>

          </tr>

        `;

      });


      html += `

            </table>

          </div>

        </div>

      `;

    });


    html += `</div>`;

  });


  if(!html){

    html =
      `<div class="empty">
        No students found.
      </div>`;

  }


  $("studentsTable").innerHTML =
    html;


  document
    .querySelectorAll("[data-edit-student]")
    .forEach(b => {

      b.onclick =
        () => editStudent(
          b.dataset.editStudent
        );

    });


  document
    .querySelectorAll("[data-delete-student]")
    .forEach(b => {

      b.onclick =
        () => deleteStudent(
          b.dataset.deleteStudent
        );

    });

}


// ======================================================
// EDIT STUDENT
// ======================================================

function editStudent(id){

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


  document
    .querySelectorAll(
      "#courseChecklist input"
    )
    .forEach(x => {

      x.checked =
        (s.courses || [])
          .includes(x.value);

    });


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


// ======================================================
// CLEAR STUDENT
// ======================================================

function clearStudent(){

  editingStudentId =
    null;

  $("studentForm").reset();


  document
    .querySelectorAll(
      "#courseChecklist input"
    )
    .forEach(x =>
      x.checked = false
    );

}


$("newStudentBtn").onclick =
  clearStudent;


// ======================================================
// SAVE STUDENT
// ======================================================

$("studentForm").onsubmit =
  async e => {

    e.preventDefault();


    const email =
      $("sEmail")
        .value
        .trim()
        .toLowerCase();


    const password =
      $("sPassword")?.value || "";


    const id =
      studentDocId(email);


    const selected = [

      ...document
        .querySelectorAll(
          "#courseChecklist input:checked"
        )

    ].map(x => x.value);


    const wasEditing =
      !!editingStudentId;


    try{

      // New Firebase Auth account
      if(!wasEditing && password){

        if(password.length < 6){

          throw new Error(
            "Student password must be at least 6 characters."
          );

        }


        try{

          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );

        }catch(authErr){

          if(
            authErr.code !==
            "auth/email-already-in-use"
          ){

            throw authErr;

          }

        }

      }


      await setDoc(

        doc(
          db,
          "students",
          id
        ),

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

          courses:
            selected,

          updatedAt:
            serverTimestamp()

        },

        {
          merge:true
        }

      );


      await loadData();

      renderStudents();

      renderCourseChecklist();

      clearStudent();


      alert(
        wasEditing
          ? "Student profile updated."
          : "Student saved successfully."
      );


    }catch(err){

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


// ======================================================
// DELETE STUDENT
// ======================================================

async function deleteStudent(id){

  if(
    !confirm(
      "Delete this student profile? Firebase Authentication account will NOT be deleted."
    )
  ){

    return;

  }


  await deleteDoc(
    doc(db,"students",id)
  );


  await loadData();

  renderStudents();

  renderCourseChecklist();

}


// ======================================================
// CONTENT EDITOR
// ======================================================

function addContentRow(
  item={
    type:"video",
    title:"",
    url:""
  }
){

  const row =
    document.createElement("div");


  row.className =
    "content-row";


  row.innerHTML = `

    <label>

      Type

      <select class="ct-type">

        <option value="video">
          YouTube/Video
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
      class="btn danger remove-content">
      ×
    </button>

  `;


  row.querySelector(".ct-type").value =
    item.type || "video";

  row.querySelector(".ct-title").value =
    item.title || "";

  row.querySelector(".ct-url").value =
    item.url || "";


  row
    .querySelector(".remove-content")
    .onclick = () => row.remove();


  $("contentsEditor")
    .appendChild(row);

}


$("addContentBtn").onclick =
  () => addContentRow();


// ======================================================
// CLEAR COURSE
// ======================================================

function clearCourse(){

  editingCourseId =
    null;

  $("courseForm").reset();

  $("contentsEditor").innerHTML = "";

  addContentRow();

}


$("newCourseBtn").onclick =
  clearCourse;


// ======================================================
// EDIT COURSE
// ======================================================

function editCourse(id){

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


  $("contentsEditor")
    .innerHTML = "";


  (c.contents || [])
    .forEach(addContentRow);


  if(!(c.contents || []).length){

    addContentRow();

  }


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


// ======================================================
// COURSE GROUPING
// Exam → Batch → Courses
// ======================================================

function groupCourses(){

  const groups = {};


  Object.entries(courses)
    .forEach(([id,c]) => {

      const exam =
        (c.exam || "Other").trim() ||
        "Other";


      const batch =
        (c.batch || "No Batch").trim() ||
        "No Batch";


      if(!groups[exam]){
        groups[exam] = {};
      }


      if(!groups[exam][batch]){
        groups[exam][batch] = [];
      }


      groups[exam][batch].push({
        id,
        ...c
      });

    });


  return groups;

}


// ======================================================
// RENDER COURSES
// ======================================================

function renderCourses(){

  $("statCourses").textContent =
    Object.keys(courses).length;


  const search =
    ($("courseSearch")?.value || "")
      .trim()
      .toLowerCase();


  const filtered =
    Object.entries(courses)
      .filter(([id,c]) => {

        const text = [

          id,
          c.title,
          c.subject,
          c.exam,
          c.batch,
          c.year,
          c.description,
          c.testId

        ].join(" ").toLowerCase();


        return text.includes(search);

      });


  if($("courseSearchCount")){

    $("courseSearchCount").textContent =
      search

        ? `Showing ${filtered.length} of ${Object.keys(courses).length} courses`

        : `${filtered.length} courses`;

  }


  const filteredObject = {};


  filtered.forEach(([id,c]) => {

    filteredObject[id] = c;

  });


  const oldCourses =
    courses;


  courses =
    filteredObject;


  const groups =
    groupCourses();


  courses =
    oldCourses;


  let html = "";


  const exams =
    Object.keys(groups).sort();


  exams.forEach(exam => {

    const batches =
      Object.keys(groups[exam]).sort();


    let examTotal = 0;


    batches.forEach(batch => {

      examTotal +=
        groups[exam][batch].length;

    });


    html += `

      <div class="group-card">

        <div class="group-header">

          <h3>
            📚 ${esc(exam)}
          </h3>

          <span class="pill">
            ${examTotal} Courses
          </span>

        </div>

    `;


    batches.forEach(batch => {

      const list =
        groups[exam][batch];


      html += `

        <div class="batch-section">

          <div class="batch-header">

            📌 Batch:
            ${esc(batch)}
            —
            ${list.length} Courses

          </div>

          <div class="group-content">

            <table class="table">

              <tr>
                <th>Course</th>
                <th>Subject</th>
                <th>Year</th>
                <th>Test ID</th>
                <th>Content</th>
                <th>Actions</th>
              </tr>

      `;


      list.forEach(c => {

        html += `

          <tr>

            <td>

              <b>
                ${esc(c.title || c.id)}
              </b>

              <br>

              <span class="small">
                ID: ${esc(c.id)}
              </span>

            </td>

            <td>
              ${esc(c.subject || "")}
            </td>

            <td>
              ${esc(c.year || "")}
            </td>

            <td>
              ${esc(c.testId || "")}
            </td>

            <td>
              ${(c.contents || []).length}
              items
            </td>

            <td>

              <button
                class="btn muted"
                data-edit-course="${esc(c.id)}">
                Edit
              </button>

              <button
                class="btn danger"
                data-delete-course="${esc(c.id)}">
                Delete
              </button>

            </td>

          </tr>

        `;

      });


      html += `

            </table>

          </div>

        </div>

      `;

    });


    html += `</div>`;

  });


  if(!html){

    html =
      `<div class="empty">
        No courses found.
      </div>`;

  }


  $("coursesTable").innerHTML =
    html;


  document
    .querySelectorAll("[data-edit-course]")
    .forEach(b => {

      b.onclick =
        () => editCourse(
          b.dataset.editCourse
        );

    });


  document
    .querySelectorAll("[data-delete-course]")
    .forEach(b => {

      b.onclick =
        () => deleteCourse(
          b.dataset.deleteCourse
        );

    });

}


// ======================================================
// SAVE COURSE
// ======================================================

$("courseForm").onsubmit =
  async e => {

    e.preventDefault();


    const id =
      $("cId")
        .value
        .trim();


    if(!id){

      alert("Course ID is required.");

      return;

    }


    const contents = [

      ...document
        .querySelectorAll(
          "#contentsEditor .content-row"
        )

    ]

      .map(r => ({

        type:
          r.querySelector(
            ".ct-type"
          ).value,

        title:
          r.querySelector(
            ".ct-title"
          ).value.trim(),

        url:
          r.querySelector(
            ".ct-url"
          ).value.trim()

      }))

      .filter(
        x => x.title || x.url
      );


    try{

      await setDoc(

        doc(
          db,
          "courses",
          id
        ),

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

      renderCourses();

      renderCourseChecklist();

      clearCourse();


      alert("Course saved.");


    }catch(err){

      console.error(err);

      alert(
        "Could not save course: " +
        (
          err.message ||
          err.code ||
          "Unknown error"
        )
      );

    }

  };


// ======================================================
// DELETE COURSE
// ======================================================

async function deleteCourse(id){

  if(
    !confirm(
      "Delete this course? Student assignments containing this ID will remain until you edit them."
    )
  ){

    return;

  }


  await deleteDoc(
    doc(db,"courses",id)
  );


  await loadData();

  renderCourses();

  renderCourseChecklist();

}


// ======================================================
// TEST RESULTS
// ======================================================

async function refreshResults(){

  try{

    const snap =
      await getDocs(
        collection(db,"testResults")
      );


    $("statResults").textContent =
      snap.size;


    let rows = [];


    snap.forEach(d => {

      const x =
        d.data();


      const ts =
        x.submittedAt?.toDate
          ? x.submittedAt
              .toDate()
              .toLocaleString()
          : String(
              x.submittedAt || ""
            );


      rows.push(`

        <div class="result-row">

          <div>

            <b>
              ${esc(x.name || "")}
            </b>

            <br>

            <span class="small">
              ${esc(x.email || "")}
            </span>

          </div>


          <div>

            ${esc(x.course || "")}

            <br>

            <span class="small">
              ${esc(x.testId || "")}
            </span>

          </div>


          <div>
            ${esc(x.score || 0)}
            /
            ${esc(x.total || 0)}
          </div>


          <div>
            ${esc(ts)}
          </div>


          <button
            class="btn danger"
            data-delete-result="${esc(d.id)}">
            Delete
          </button>

        </div>

      `);

    });


    $("resultsTable").innerHTML =
      rows.join("") ||

      `<p class="small">
        No test results.
      </p>`;


    document
      .querySelectorAll(
        "[data-delete-result]"
      )
      .forEach(b => {

        b.onclick =
          async () => {

            if(
              !confirm(
                "Delete this result?"
              )
            ){

              return;

            }


            await deleteDoc(
              doc(
                db,
                "testResults",
                b.dataset.deleteResult
              )
            );


            await refreshResults();

          };

      });


  }catch(e){

    console.error(e);

    $("resultsTable").innerHTML =
      `<p class="small">
        Could not load results.
        Check Firestore rules.
      </p>`;

  }

}


$("refreshResultsBtn").onclick =
  refreshResults;


$("clearResultsBtn").onclick =
  async () => {

    if(
      !confirm(
        "Delete ALL testResults documents? This cannot be undone."
      )
    ){

      return;

    }


    const snap =
      await getDocs(
        collection(db,"testResults")
      );


    for(
      const d of snap.docs
    ){

      await deleteDoc(d.ref);

    }


    await refreshResults();

  };


// ======================================================
// DEVICES
// ======================================================

async function loadDevices(){

  const host =
    $("deviceStudents");


  host.innerHTML =
    "Loading...";


  let html = "";


  try{

    const us =
      await getDocs(
        collection(db,"users")
      );


    for(
      const ud of us.docs
    ){

      const u =
        ud.data();


      if(!u.email) continue;


      const ds =
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


      if(ds.empty){

        html += `
          <p class="small">
            No reserved devices.
          </p>
        `;

      }


      for(
        const dd of ds.docs
      ){

        const x =
          dd.data();


        html += `

          <div class="device">

            <button
              class="btn danger"
              data-release-device="${esc(ud.id)}|${esc(dd.id)}">
              Release
            </button>

            <b>
              ${esc(
                x.deviceType || "unknown"
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
                      Number(x.expiresAt)
                    ).toLocaleString()
                  : "-"
              )}

            </span>

          </div>

        `;

      }


      html += `</div>`;

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
      .forEach(b => {

        b.onclick =
          async () => {

            if(
              !confirm(
                "Release this device reservation?"
              )
            ){

              return;

            }


            const [
              uid,
              did
            ] =
              b.dataset.releaseDevice
                .split("|");


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

          };

      });


  }catch(e){

    console.error(e);

    host.innerHTML =
      `<p class="small">
        Could not load devices.
        Check Firestore rules.
      </p>`;

  }

}


// ======================================================
// IMPORT EXISTING DATA
// ======================================================

$("seedBtn").onclick =
  async () => {

    if(
      !confirm(
        "Import the existing dashboard students and courses into Firestore? Existing documents with the same IDs will be overwritten."
      )
    ){

      return;

    }


    try{

      for(
        const [email,s]
        of Object.entries(
          DEFAULT_STUDENTS
        )
      ){

        if(
          ADMIN_EMAILS.includes(
            email.toLowerCase()
          )
        ){

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
        const [id,c]
        of Object.entries(
          DEFAULT_COURSES
        )
      ){

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


    }catch(err){

      console.error(err);

      alert(
        "Import failed: " +
        (
          err.message ||
          err.code ||
          "Unknown error"
        )
      );

    }

  };


// ======================================================
// SEARCH EVENTS
// ======================================================

$("studentSearch")
  ?.addEventListener(
    "input",
    () => renderStudents()
  );


$("clearStudentSearch")
  ?.addEventListener(
    "click",
    () => {

      $("studentSearch").value = "";

      renderStudents();

    }
  );


$("courseSearch")
  ?.addEventListener(
    "input",
    () => renderCourses()
  );


$("clearCourseSearch")
  ?.addEventListener(
    "click",
    () => {

      $("courseSearch").value = "";

      renderCourses();

    }
  );


// ======================================================
// INITIAL COURSE ROW
// ======================================================

clearCourse();
