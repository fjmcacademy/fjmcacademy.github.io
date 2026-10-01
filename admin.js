import {
  getAuth,
  onAuthStateChanged,
  signOut,
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

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { app, auth, db } from "./firebase.js";


/* =========================================================
   ADMIN
========================================================= */

const ADMIN_EMAILS = [
  "fjmcacademy1008@gmail.com"
];

const secondaryApp = initializeApp(
  app.options,
  "fjmcStudentCreator"
);

const secondaryAuth = getAuth(secondaryApp);


/* =========================================================
   GLOBAL DATA
========================================================= */

let students = [];
let courses = [];
let tests = [];
let results = [];

let questionCounter = 0;


/* =========================================================
   HELPERS
========================================================= */

function $(id){
  return document.getElementById(id);
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function studentDocId(email){
  return email
    .trim()
    .toLowerCase()
    .replaceAll("/","_");
}

function safeId(value){
  return String(value || "")
    .trim()
    .replace(/\s+/g,"-")
    .replace(/[^a-zA-Z0-9_-]/g,"")
    .toLowerCase();
}

function formatDate(value){

  if(!value) return "-";

  try{

    if(value.toDate){
      return value.toDate().toLocaleString();
    }

    return new Date(value).toLocaleString();

  }catch{
    return "-";
  }
}


/* =========================================================
   AUTH CHECK
========================================================= */

onAuthStateChanged(auth, async(user)=>{

  if(!user){

    location.href = "login.html";
    return;

  }

  const email = (user.email || "").toLowerCase();

  if(!ADMIN_EMAILS.includes(email)){

    alert("Admin access denied.");

    await signOut(auth);

    location.href = "login.html";

    return;
  }

  await loadAll();

});


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll(){

  try{

    await Promise.all([
      loadStudents(),
      loadCourses(),
      loadTests(),
      loadResults()
    ]);

    renderAll();

  }catch(error){

    console.error(error);

    alert(
      "Data load error: " +
      error.message
    );

  }

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents(){

  const snap = await getDocs(
    collection(db,"students")
  );

  students = snap.docs.map(d=>({
    docId:d.id,
    ...d.data()
  }));

}

function renderStudents(){

  const search =
    ($("studentSearch")?.value || "")
      .toLowerCase()
      .trim();

  const tbody = $("studentsTable");

  if(!tbody) return;

  const filtered = students.filter(s=>{

    const text = [

      s.studentId,
      s.name,
      s.email,
      s.exam,
      s.batch,
      s.year

    ].join(" ").toLowerCase();

    return text.includes(search);

  });

  tbody.innerHTML = filtered.map(s=>{

    const courseList =
      Array.isArray(s.courses)
        ? s.courses
        : [];

    return `
      <tr>

        <td>
          <b>${escapeHTML(s.studentId || "-")}</b>
        </td>

        <td>${escapeHTML(s.name || "-")}</td>

        <td>${escapeHTML(s.email || "-")}</td>

        <td>
          <span class="badge">
            ${escapeHTML(s.exam || "-")}
          </span>
        </td>

        <td>
          <span class="badge">
            ${escapeHTML(s.batch || "-")}
          </span>
        </td>

        <td>${escapeHTML(s.year || "-")}</td>

        <td>
          ${courseList.map(c=>{

            const id =
              typeof c === "string"
                ? c
                : (c.id || c.courseId || "");

            return `
              <span class="badge">
                ${escapeHTML(id)}
              </span>
            `;

          }).join("")}
        </td>

        <td>

          <button
            class="btn"
            onclick="editStudent('${escapeHTML(s.docId)}')">
            Edit
          </button>

          <button
            class="btn red"
            onclick="removeStudent('${escapeHTML(s.docId)}')">
            Delete
          </button>

        </td>

      </tr>
    `;

  }).join("");

}


/* =========================================================
   COURSE CHECKBOXES FOR STUDENTS
========================================================= */

function renderCourseCheckboxes(){

  const box = $("studentCourses");

  if(!box) return;

  if(!courses.length){

    box.innerHTML =
      `<p class="small">No courses found.</p>`;

    return;
  }

  box.innerHTML = courses.map(c=>{

    return `
      <label style="
        display:block;
        padding:8px;
        background:#0f172a;
        border-radius:6px;
        margin-bottom:5px;
      ">

        <input
          type="checkbox"
          class="student-course"
          value="${escapeHTML(c.docId)}"
          style="width:auto"
        >

        ${escapeHTML(c.title || c.docId)}
        —
        ${escapeHTML(c.exam || "")}
        —
        ${escapeHTML(c.batch || "")}

      </label>
    `;

  }).join("");

}


/* =========================================================
   SAVE STUDENT
========================================================= */

$("saveStudentBtn")?.addEventListener(
  "click",
  saveStudent
);

async function saveStudent(){

  try{

    const editingDoc =
      $("studentDocId").value.trim();

    const studentId =
      $("studentId").value.trim();

    const name =
      $("studentName").value.trim();

    const email =
      $("studentEmail").value.trim().toLowerCase();

    const password =
      $("studentPassword").value;

    const exam =
      $("studentExam").value.trim();

    const batch =
      $("studentBatch").value.trim();

    const year =
      $("studentYear").value.trim();

    if(!studentId){
      alert("Student ID डालो.");
      return;
    }

    if(!name){
      alert("Student name डालो.");
      return;
    }

    if(!email){
      alert("Gmail डालो.");
      return;
    }

    let docId =
      editingDoc || studentDocId(email);


    /* -----------------------------------------
       CREATE AUTH ACCOUNT FOR NEW STUDENT
    ----------------------------------------- */

    if(!editingDoc && password){

      try{

        const credential =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );

        console.log(
          "Student Auth created:",
          credential.user.uid
        );

      }catch(error){

        if(error.code !== "auth/email-already-in-use"){

          throw error;

        }

      }

    }


    /* -----------------------------------------
       SELECT COURSES
    ----------------------------------------- */

    const selectedCourses =
      [...document.querySelectorAll(
        ".student-course:checked"
      )].map(el=>el.value);


    /* -----------------------------------------
       SAVE FIRESTORE
    ----------------------------------------- */

    await setDoc(
      doc(db,"students",docId),
      {

        studentId,

        name,

        email,

        exam,

        batch,

        year,

        courses:selectedCourses,

        updatedAt:serverTimestamp()

      },
      {merge:true}
    );


    alert("Student saved successfully.");

    clearStudentForm();

    await loadStudents();

    renderStudents();

    updateCounts();

  }catch(error){

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

window.editStudent = function(docId){

  const s =
    students.find(x=>x.docId === docId);

  if(!s) return;

  $("studentDocId").value =
    s.docId || "";

  $("studentId").value =
    s.studentId || "";

  $("studentName").value =
    s.name || "";

  $("studentEmail").value =
    s.email || "";

  $("studentPassword").value = "";

  $("studentExam").value =
    s.exam || "";

  $("studentBatch").value =
    s.batch || "";

  $("studentYear").value =
    s.year || "";


  const assigned =
    Array.isArray(s.courses)
      ? s.courses
      : [];


  document.querySelectorAll(
    ".student-course"
  ).forEach(cb=>{

    cb.checked =
      assigned.includes(cb.value);

  });


  showSection("students");

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

};


/* =========================================================
   DELETE STUDENT
========================================================= */

window.removeStudent = async function(docId){

  if(!confirm(
    "Delete this student Firestore record?"
  )) return;

  try{

    await deleteDoc(
      doc(db,"students",docId)
    );

    await loadStudents();

    renderStudents();

    updateCounts();

  }catch(error){

    alert(error.message);

  }

};


/* =========================================================
   CLEAR STUDENT
========================================================= */

function clearStudentForm(){

  $("studentDocId").value = "";

  $("studentId").value = "";

  $("studentName").value = "";

  $("studentEmail").value = "";

  $("studentPassword").value = "";

  $("studentExam").value = "";

  $("studentBatch").value = "";

  $("studentYear").value = "";

  document.querySelectorAll(
    ".student-course"
  ).forEach(cb=>cb.checked=false);

}

$("clearStudentBtn")?.addEventListener(
  "click",
  clearStudentForm
);


/* =========================================================
   COURSES
========================================================= */

async function loadCourses(){

  const snap = await getDocs(
    collection(db,"courses")
  );

  courses = snap.docs.map(d=>({

    docId:d.id,

    ...d.data()

  }));

}


function renderCourses(){

  const search =
    ($("courseSearch")?.value || "")
      .toLowerCase()
      .trim();

  const tbody = $("coursesTable");

  if(!tbody) return;

  const filtered =
    courses.filter(c=>{

      const text = [

        c.docId,
        c.exam,
        c.batch,
        c.year,
        c.subject,
        c.title,
        c.testId

      ].join(" ").toLowerCase();

      return text.includes(search);

    });


  tbody.innerHTML =
    filtered.map(c=>{

      return `
        <tr>

          <td>
            <b>${escapeHTML(c.docId)}</b>
          </td>

          <td>${escapeHTML(c.exam || "-")}</td>

          <td>${escapeHTML(c.batch || "-")}</td>

          <td>${escapeHTML(c.subject || "-")}</td>

          <td>${escapeHTML(c.title || "-")}</td>

          <td>
            ${escapeHTML(c.testId || "-")}
          </td>

          <td>

            <button
              class="btn"
              onclick="editCourse('${escapeHTML(c.docId)}')">
              Edit
            </button>

            <button
              class="btn red"
              onclick="removeCourse('${escapeHTML(c.docId)}')">
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


/* =========================================================
   SAVE COURSE
========================================================= */

$("saveCourseBtn")?.addEventListener(
  "click",
  saveCourse
);

async function saveCourse(){

  try{

    const courseId =
      safeId($("courseId").value);

    if(!courseId){

      alert("Course ID डालो.");

      return;
    }

    await setDoc(
      doc(db,"courses",courseId),
      {

        exam:
          $("courseExam").value.trim(),

        batch:
          $("courseBatch").value.trim(),

        year:
          $("courseYear").value.trim(),

        subject:
          $("courseSubject").value.trim(),

        title:
          $("courseTitle").value.trim(),

        description:
          $("courseDescription").value.trim(),

        testId:
          $("courseTestId").value.trim(),

        updatedAt:
          serverTimestamp()

      },
      {merge:true}
    );


    alert("Course saved.");

    clearCourseForm();

    await loadCourses();

    renderCourses();

    renderCourseCheckboxes();

    updateCounts();

  }catch(error){

    console.error(error);

    alert(error.message);

  }

}


window.editCourse = function(courseId){

  const c =
    courses.find(x=>x.docId === courseId);

  if(!c) return;

  $("courseEditingId").value =
    c.docId;

  $("courseId").value =
    c.docId;

  $("courseExam").value =
    c.exam || "";

  $("courseBatch").value =
    c.batch || "";

  $("courseYear").value =
    c.year || "";

  $("courseSubject").value =
    c.subject || "";

  $("courseTitle").value =
    c.title || "";

  $("courseTestId").value =
    c.testId || "";

  $("courseDescription").value =
    c.description || "";

  showSection("courses");

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

};


window.removeCourse = async function(courseId){

  if(!confirm(
    "Delete this course?"
  )) return;

  await deleteDoc(
    doc(db,"courses",courseId)
  );

  await loadCourses();

  renderCourses();

  renderCourseCheckboxes();

  updateCounts();

};


function clearCourseForm(){

  $("courseEditingId").value = "";

  $("courseId").value = "";

  $("courseExam").value = "";

  $("courseBatch").value = "";

  $("courseYear").value = "";

  $("courseSubject").value = "";

  $("courseTitle").value = "";

  $("courseTestId").value = "";

  $("courseDescription").value = "";

}

$("clearCourseBtn")?.addEventListener(
  "click",
  clearCourseForm
);


/* =========================================================
   TESTS
========================================================= */

async function loadTests(){

  const snap = await getDocs(
    collection(db,"tests")
  );

  tests = snap.docs.map(d=>({

    docId:d.id,

    ...d.data()

  }));

}


function renderTests(){

  const search =
    ($("testSearch")?.value || "")
      .toLowerCase()
      .trim();

  const tbody = $("testsTable");

  if(!tbody) return;


  const filtered =
    tests.filter(t=>{

      const text = [

        t.docId,
        t.title,
        t.exam,
        t.batch,
        t.courseId,
        t.lecture,
        t.testNumber

      ].join(" ").toLowerCase();

      return text.includes(search);

    });


  tbody.innerHTML =
    filtered.map(t=>{

      const questions =
        Array.isArray(t.questions)
          ? t.questions.length
          : 0;


      return `
        <tr>

          <td>
            <b>${escapeHTML(t.docId)}</b>
          </td>

          <td>${escapeHTML(t.title || "-")}</td>

          <td>${escapeHTML(t.exam || "-")}</td>

          <td>${escapeHTML(t.batch || "-")}</td>

          <td>${escapeHTML(t.courseId || "-")}</td>

          <td>${escapeHTML(t.lecture || "-")}</td>

          <td>${questions}</td>

          <td>

            <button
              class="btn"
              onclick="editTest('${escapeHTML(t.docId)}')">
              Edit
            </button>

            <button
              class="btn red"
              onclick="removeTest('${escapeHTML(t.docId)}')">
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


/* =========================================================
   QUESTION UI
========================================================= */

function addQuestion(data=null){

  questionCounter++;

  const index =
    questionCounter;

  const box =
    document.createElement("div");

  box.className =
    "question-box";

  box.dataset.index =
    index;


  const options =
    data?.options || [
      {},
      {},
      {},
      {}
    ];


  box.innerHTML = `

    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
    ">

      <h4>
        Question ${index}
      </h4>

      <button
        type="button"
        class="btn red remove-question">
        Remove
      </button>

    </div>


    <label>Question</label>

    <textarea
      class="q-text"
      placeholder="Enter question..."
    >${escapeHTML(data?.question || "")}</textarea>


    <div class="option-row">
      <b>A</b>
      <input
        class="q-option"
        data-option="0"
        placeholder="Option A"
        value="${escapeHTML(options[0]?.text || "")}"
      >
    </div>


    <div class="option-row">
      <b>B</b>
      <input
        class="q-option"
        data-option="1"
        placeholder="Option B"
        value="${escapeHTML(options[1]?.text || "")}"
      >
    </div>


    <div class="option-row">
      <b>C</b>
      <input
        class="q-option"
        data-option="2"
        placeholder="Option C"
        value="${escapeHTML(options[2]?.text || "")}"
      >
    </div>


    <div class="option-row">
      <b>D</b>
      <input
        class="q-option"
        data-option="3"
        placeholder="Option D"
        value="${escapeHTML(options[3]?.text || "")}"
      >
    </div>


    <div class="correct-row">

      <label style="margin:0">
        Correct Answer
      </label>

      <select class="q-correct">

        <option value="0">A</option>
        <option value="1">B</option>
        <option value="2">C</option>
        <option value="3">D</option>

      </select>

    </div>


    <br>

    <label>Explanation / Solution</label>

    <textarea
      class="q-explanation"
      placeholder="Explain why this answer is correct..."
    >${escapeHTML(
      data?.explanation ||
      options.find(o=>o?.correct)?.solution ||
      ""
    )}</textarea>

  `;


  const correct =
    data?.correctAnswer;


  if(
    correct !== undefined &&
    correct !== null
  ){

    let correctIndex =
      Number(correct);

    if(
      Number.isNaN(correctIndex)
    ){

      correctIndex =
        {
          A:0,
          B:1,
          C:2,
          D:3
        }[
          String(correct).toUpperCase()
        ];

    }

    if(
      [0,1,2,3].includes(correctIndex)
    ){

      box.querySelector(
        ".q-correct"
      ).value =
        String(correctIndex);

    }

  }


  box.querySelector(
    ".remove-question"
  ).addEventListener(
    "click",
    ()=>{
      box.remove();
      renumberQuestions();
    }
  );


  $("questionsContainer")
    .appendChild(box);

}


function renumberQuestions(){

  document.querySelectorAll(
    ".question-box"
  ).forEach((box,i)=>{

    const heading =
      box.querySelector("h4");

    if(heading){
      heading.textContent =
        `Question ${i+1}`;
    }

  });

}


$("addQuestionBtn")?.addEventListener(
  "click",
  ()=>{
    addQuestion();
  }
);


/* =========================================================
   GET QUESTIONS
========================================================= */

function collectQuestions(){

  const boxes =
    document.querySelectorAll(
      ".question-box"
    );

  const questions = [];


  boxes.forEach((box,index)=>{

    const question =
      box.querySelector(
        ".q-text"
      ).value.trim();


    const optionInputs =
      box.querySelectorAll(
        ".q-option"
      );


    const options =
      [...optionInputs].map(
        (input,i)=>({

          text:
            input.value.trim(),

          correct:
            Number(
              box.querySelector(
                ".q-correct"
              ).value
            ) === i,

          solution:
            box.querySelector(
              ".q-explanation"
            ).value.trim()

        })
      );


    const correctAnswer =
      Number(
        box.querySelector(
          ".q-correct"
        ).value
      );


    questions.push({

      id:
        `q${index+1}`,

      question,

      options,

      correctAnswer

    });

  });


  return questions;

}


/* =========================================================
   SAVE TEST
========================================================= */

$("saveTestBtn")?.addEventListener(
  "click",
  saveTest
);

async function saveTest(){

  try{

    const testId =
      safeId($("testId").value);

    if(!testId){

      alert("Test ID डालो.");

      return;
    }


    const questions =
      collectQuestions();


    if(!questions.length){

      alert(
        "कम से कम 1 question add करो."
      );

      return;
    }


    for(const q of questions){

      if(!q.question){

        alert(
          "हर question में question text डालो."
        );

        return;
      }

      if(
        q.options.some(
          option=>!option.text
        )
      ){

        alert(
          "हर question के चारों options भरो."
        );

        return;
      }

    }


    const testData = {

      title:
        $("testTitle").value.trim(),

      exam:
        $("testExam").value.trim(),

      batch:
        $("testBatch").value.trim(),

      courseId:
        $("testCourseId").value.trim(),

      lecture:
        $("testLecture").value.trim(),

      testNumber:
        $("testNumber").value.trim(),

      duration:
        Number(
          $("testDuration").value
        ) || 30,

      questions,

      updatedAt:
        serverTimestamp()

    };


    await setDoc(
      doc(db,"tests",testId),
      testData,
      {merge:true}
    );


    alert(
      "Test saved successfully."
    );


    clearTestForm();

    await loadTests();

    renderTests();

    updateCounts();


  }catch(error){

    console.error(error);

    alert(
      "Test save error:\n" +
      error.message
    );

  }

}


/* =========================================================
   EDIT TEST
========================================================= */

window.editTest = function(testId){

  const t =
    tests.find(x=>x.docId === testId);

  if(!t) return;


  $("testEditingId").value =
    t.docId;

  $("testId").value =
    t.docId;

  $("testTitle").value =
    t.title || "";

  $("testExam").value =
    t.exam || "";

  $("testBatch").value =
    t.batch || "";

  $("testCourseId").value =
    t.courseId || "";

  $("testLecture").value =
    t.lecture || "";

  $("testNumber").value =
    t.testNumber || "";

  $("testDuration").value =
    t.duration || 30;


  $("questionsContainer").innerHTML = "";

  questionCounter = 0;


  const questions =
    Array.isArray(t.questions)
      ? t.questions
      : [];


  questions.forEach(q=>{
    addQuestion(q);
  });


  showSection("tests");

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

};


/* =========================================================
   DELETE TEST
========================================================= */

window.removeTest = async function(testId){

  if(!confirm(
    "Delete this test and all its questions?"
  )) return;


  try{

    await deleteDoc(
      doc(db,"tests",testId)
    );

    await loadTests();

    renderTests();

    updateCounts();

  }catch(error){

    alert(error.message);

  }

};


/* =========================================================
   CLEAR TEST
========================================================= */

function clearTestForm(){

  $("testEditingId").value = "";

  $("testId").value = "";

  $("testTitle").value = "";

  $("testExam").value = "";

  $("testBatch").value = "";

  $("testCourseId").value = "";

  $("testLecture").value = "";

  $("testNumber").value = "";

  $("testDuration").value = 30;

  $("questionsContainer").innerHTML = "";

  questionCounter = 0;

}

$("clearTestBtn")?.addEventListener(
  "click",
  clearTestForm
);


/* =========================================================
   RESULTS
========================================================= */

async function loadResults(){

  const snap =
    await getDocs(
      collection(db,"testResults")
    );

  results =
    snap.docs.map(d=>({

      docId:d.id,

      ...d.data()

    }));

}


function renderResults(){

  const search =
    ($("resultSearch")?.value || "")
      .toLowerCase()
      .trim();

  const tbody =
    $("resultsTable");

  if(!tbody) return;


  const filtered =
    results.filter(r=>{

      const text = [

        r.studentId,
        r.name,
        r.email,
        r.course,
        r.testId,
        r.testTitle,
        r.exam,
        r.batch

      ].join(" ").toLowerCase();

      return text.includes(search);

    });


  tbody.innerHTML =
    filtered.map(r=>{

      return `
        <tr>

          <td>${escapeHTML(r.name || "-")}</td>

          <td>${escapeHTML(r.email || "-")}</td>

          <td>${escapeHTML(r.studentId || "-")}</td>

          <td>${escapeHTML(r.course || "-")}</td>

          <td>
            ${escapeHTML(
              r.testTitle ||
              r.testId ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              r.score ?? 0
            )}
            /
            ${escapeHTML(
              r.total ?? 0
            )}
          </td>

          <td>
            ${escapeHTML(
              r.percentage ??
              "-"
            )}%
          </td>

          <td>
            ${formatDate(
              r.submittedAt
            )}
          </td>

          <td>

            <button
              class="btn"
              onclick="viewResult('${escapeHTML(r.docId)}')">
              View
            </button>

            <button
              class="btn red"
              onclick="deleteResult('${escapeHTML(r.docId)}')">
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


/* =========================================================
   RESULT DETAILS
========================================================= */

window.viewResult = function(resultId){

  const r =
    results.find(
      x=>x.docId === resultId
    );

  if(!r) return;


  $("resultDetails").classList.remove(
    "hidden"
  );


  const answers =
    Array.isArray(r.answers)
      ? r.answers
      : [];


  $("resultDetailsContent").innerHTML = `

    <p>
      <b>Student:</b>
      ${escapeHTML(r.name || "-")}
    </p>

    <p>
      <b>Email:</b>
      ${escapeHTML(r.email || "-")}
    </p>

    <p>
      <b>Student ID:</b>
      ${escapeHTML(r.studentId || "-")}
    </p>

    <p>
      <b>Test:</b>
      ${escapeHTML(r.testTitle || r.testId || "-")}
    </p>

    <p>
      <b>Score:</b>
      ${escapeHTML(r.score || 0)}
      /
      ${escapeHTML(r.total || 0)}
    </p>

    <hr>

    ${
      answers.map((a,i)=>`

        <div style="
          padding:12px;
          border:1px solid #334155;
          border-radius:8px;
          margin-bottom:10px;
        ">

          <b>
            Q${i+1}.
            ${escapeHTML(a.question || "")}
          </b>

          <p>
            <b>Student Answer:</b>
            ${escapeHTML(
              a.selectedAnswer ?? "-"
            )}
          </p>

          <p>
            <b>Correct Answer:</b>
            ${escapeHTML(
              a.correctAnswer ?? "-"
            )}
          </p>

          <p>
            <b>Explanation:</b>
            ${escapeHTML(
              a.explanation || "-"
            )}
          </p>

          <span class="badge">
            ${
              a.isCorrect
                ? "Correct"
                : "Wrong"
            }
          </span>

        </div>

      `).join("")
    }

  `;

};


window.deleteResult = async function(resultId){

  if(!confirm(
    "Delete this result?"
  )) return;


  await deleteDoc(
    doc(db,"testResults",resultId)
  );


  $("resultDetails")
    .classList.add("hidden");


  await loadResults();

  renderResults();

  updateCounts();

};


/* =========================================================
   DEVICES
========================================================= */

async function renderDevices(){

  const tbody =
    $("devicesTable");

  if(!tbody) return;


  tbody.innerHTML =
    `<tr>
      <td colspan="5">
        Loading...
      </td>
    </tr>`;


  const rows = [];


  for(const student of students){

    if(!student.email) continue;


    const id =
      student.docId ||
      studentDocId(student.email);


    const userRef =
      collection(
        db,
        "users",
        id,
        "devices"
      );


    try{

      const snap =
        await getDocs(userRef);


      snap.forEach(d=>{

        rows.push({

          student,

          deviceId:d.id,

          data:d.data()

        });

      });

    }catch(error){

      console.warn(
        "Device read error",
        id,
        error
      );

    }

  }


  tbody.innerHTML =
    rows.map(row=>{

      return `
        <tr>

          <td>
            ${escapeHTML(
              row.student.name || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.student.email || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              row.data.type ||
              row.deviceId
            )}
          </td>

          <td>
            ${formatDate(
              row.data.lastSeen ||
              row.data.updatedAt
            )}
          </td>

          <td>

            <button
              class="btn red"
              onclick="deleteDevice(
                '${escapeHTML(
                  row.student.docId
                )}',
                '${escapeHTML(
                  row.deviceId
                )}'
              )">
              Remove
            </button>

          </td>

        </tr>
      `;

    }).join("");


  if(!rows.length){

    tbody.innerHTML =
      `<tr>
        <td colspan="5">
          No devices found.
        </td>
      </tr>`;

  }

}


window.deleteDevice =
  async function(studentDoc,deviceId){

    if(!confirm(
      "Remove this device?"
    )) return;


    await deleteDoc(
      doc(
        db,
        "users",
        studentDoc,
        "devices",
        deviceId
      )
    );


    renderDevices();

  };


$("refreshDevicesBtn")?.addEventListener(
  "click",
  renderDevices
);


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(id){

  document
    .querySelectorAll(".section")
    .forEach(section=>{

      section.classList.toggle(
        "active",
        section.id === id
      );

    });


  document
    .querySelectorAll(".nav-btn")
    .forEach(button=>{

      button.classList.toggle(
        "active",
        button.dataset.section === id
      );

    });


  if(id === "students"){
    renderStudents();
    renderCourseCheckboxes();
  }

  if(id === "courses"){
    renderCourses();
  }

  if(id === "tests"){
    renderTests();
  }

  if(id === "results"){
    renderResults();
  }

  if(id === "devices"){
    renderDevices();
  }

}


document
  .querySelectorAll(".nav-btn")
  .forEach(button=>{

    button.addEventListener(
      "click",
      ()=>{

        showSection(
          button.dataset.section
        );

      }
    );

  });


/* =========================================================
   SEARCH EVENTS
========================================================= */

$("studentSearch")?.addEventListener(
  "input",
  renderStudents
);

$("courseSearch")?.addEventListener(
  "input",
  renderCourses
);

$("testSearch")?.addEventListener(
  "input",
  renderTests
);

$("resultSearch")?.addEventListener(
  "input",
  renderResults
);


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn")?.addEventListener(
  "click",
  async()=>{

    await signOut(auth);

    location.href =
      "login.html";

  }
);


/* =========================================================
   COUNTS
========================================================= */

function updateCounts(){

  $("studentCount").textContent =
    students.length;

  $("courseCount").textContent =
    courses.length;

  $("testCount").textContent =
    tests.length;

  $("resultCount").textContent =
    results.length;

}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll(){

  renderStudents();

  renderCourses();

  renderTests();

  renderResults();

  renderCourseCheckboxes();

  updateCounts();

}


/* =========================================================
   START WITH ONE EMPTY QUESTION
========================================================= */

addQuestion();
