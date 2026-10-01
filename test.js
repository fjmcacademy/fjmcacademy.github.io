import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   OLD / FALLBACK TEST DATA
   =========================================================
   IMPORTANT:
   Apna existing TESTS object yahan same rakho.

   Agar tumhare current test.js me already bahut saare tests
   hain, to neeche diye TESTS object ke andar apna existing
   complete TESTS object paste kar dena.
   ========================================================= */

const TESTS = {
  "real-analysis": {
    title: "Real Analysis",

    lectures: {
      "1": {
        title: "Lecture 1",

        tests: {
          "1": {
            title: "Real Analysis - Lecture 1 Test - 1",
            duration: 15,

            questions: [
              {
                question: "Which of the following is a rational number?",
                options: [
                  {
                    text: "√2",
                    correct: false,
                    solution: "√2 is irrational."
                  },
                  {
                    text: "π",
                    correct: false,
                    solution: "π is irrational."
                  },
                  {
                    text: "1/2",
                    correct: true,
                    solution: "1/2 can be written as p/q, so it is rational."
                  },
                  {
                    text: "√3",
                    correct: false,
                    solution: "√3 is irrational."
                  }
                ]
              }
            ]
          }
        }
      }
    }
  },

  "calculus": {
    title: "Calculus",

    lectures: {
      "1": {
        title: "Lecture 1",

        tests: {
          "1": {
            title: "Calculus - Lecture 1 Test - 1",
            duration: 15,

            questions: [
              {
                question: "What is the derivative of x²?",
                options: [
                  {
                    text: "x",
                    correct: false,
                    solution: "The derivative of x² is 2x."
                  },
                  {
                    text: "2x",
                    correct: true,
                    solution: "Using the power rule, d(x²)/dx = 2x."
                  },
                  {
                    text: "x²",
                    correct: false,
                    solution: "x² is the original function."
                  },
                  {
                    text: "2",
                    correct: false,
                    solution: "The derivative is 2x, not 2."
                  }
                ]
              }
            ]
          }
        }
      }
    }
  }
};


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentTest = null;

let currentCourseId = "";
let currentLectureId = "";
let currentTestNumber = "";

let timerInterval = null;
let remainingSeconds = 0;

let selectedAnswers = {};

let firestoreTests = [];


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function safeText(value) {
  return value == null ? "" : String(value);
}

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  const emailEl = $("studentEmail");

  if (emailEl) {
    emailEl.textContent = user.email || "";
  }

  try {
    await loadFirestoreTests();

    await startFromUrl();

  } catch (error) {

    console.error("Test initialization error:", error);

    await startFromUrl();
  }
});


/* =========================================================
   LOAD TESTS FROM FIRESTORE
   ========================================================= */

async function loadFirestoreTests() {

  firestoreTests = [];

  try {

    const snapshot = await getDocs(
      collection(db, "tests")
    );

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      firestoreTests.push({
        id: docSnap.id,
        ...data
      });

    });

    console.log(
      "Firestore tests loaded:",
      firestoreTests.length
    );

  } catch (error) {

    console.warn(
      "Could not load Firestore tests:",
      error
    );

    firestoreTests = [];
  }
}


/* =========================================================
   URL PARAMS
   ========================================================= */

async function startFromUrl() {

  const params = new URLSearchParams(
    window.location.search
  );

  const courseId =
    params.get("course");

  const lectureId =
    params.get("lecture");

  const testNumber =
    params.get("test");

  currentCourseId = courseId || "";
  currentLectureId = lectureId || "";
  currentTestNumber = testNumber || "";

  if (!courseId) {

    await showCourseSelection();

    return;
  }

  if (!lectureId) {

    await showLectureSelection(
      courseId
    );

    return;
  }

  if (!testNumber) {

    await showTestSelection(
      courseId,
      lectureId
    );

    return;
  }

  await openSpecificTest(
    courseId,
    lectureId,
    testNumber
  );
}


/* =========================================================
   FIRESTORE TEST ID
   ========================================================= */

function makeTestId(
  courseId,
  lectureId,
  testNumber
) {

  return (
    courseId +
    "-lecture-" +
    lectureId +
    "-test-" +
    testNumber
  );
}


/* =========================================================
   GET FIRESTORE TEST
   ========================================================= */

async function getFirestoreTest(
  courseId,
  lectureId,
  testNumber
) {

  const testId =
    makeTestId(
      courseId,
      lectureId,
      testNumber
    );

  try {

    const testRef =
      doc(db, "tests", testId);

    const testSnap =
      await getDoc(testRef);

    if (!testSnap.exists()) {
      return null;
    }

    return {
      id: testSnap.id,
      ...testSnap.data()
    };

  } catch (error) {

    console.warn(
      "Could not read Firestore test:",
      error
    );

    return null;
  }
}


/* =========================================================
   GET FALLBACK TEST
   ========================================================= */

function getHardcodedTest(
  courseId,
  lectureId,
  testNumber
) {

  const course =
    TESTS[courseId];

  if (!course) {
    return null;
  }

  const lecture =
    course.lectures?.[lectureId];

  if (!lecture) {
    return null;
  }

  const test =
    lecture.tests?.[testNumber];

  if (!test) {
    return null;
  }

  return {
    ...test,

    courseId,
    lectureId,
    testNumber,

    testId:
      makeTestId(
        courseId,
        lectureId,
        testNumber
      )
  };
}


/* =========================================================
   GET FINAL TEST
   ========================================================= */

async function getTest(
  courseId,
  lectureId,
  testNumber
) {

  const firestoreTest =
    await getFirestoreTest(
      courseId,
      lectureId,
      testNumber
    );

  /*
    Firestore test has priority.

    This allows Admin Panel to control tests.
  */

  if (firestoreTest) {

    return {
      ...firestoreTest,

      courseId:
        firestoreTest.courseId ||
        courseId,

      lectureId:
        String(
          firestoreTest.lectureId ??
          lectureId
        ),

      testNumber:
        String(
          firestoreTest.testNumber ??
          testNumber
        ),

      testId:
        firestoreTest.testId ||
        makeTestId(
          courseId,
          lectureId,
          testNumber
        )
    };
  }


  /*
    If Firestore test does not exist,
    use old TESTS object.
  */

  return getHardcodedTest(
    courseId,
    lectureId,
    testNumber
  );
}


/* =========================================================
   OPEN SPECIFIC TEST
   ========================================================= */

async function openSpecificTest(
  courseId,
  lectureId,
  testNumber
) {

  showLoading();

  const test =
    await getTest(
      courseId,
      lectureId,
      testNumber
    );

  if (!test) {

    showMessage(
      "Test not found."
    );

    return;
  }


  /*
    Admin can disable a test.
  */

  if (test.active === false) {

    showMessage(
      "This test is currently disabled."
    );

    return;
  }


  currentCourseId =
    courseId;

  currentLectureId =
    String(lectureId);

  currentTestNumber =
    String(testNumber);

  currentTest = normalizeTest(test);

  selectedAnswers = {};

  renderTest();
}


/* =========================================================
   NORMALIZE TEST
   ========================================================= */

function normalizeTest(test) {

  const normalized = {
    ...test
  };

  normalized.title =
    test.title ||
    `Test ${test.testNumber || ""}`;

  normalized.duration =
    Number(test.duration) > 0
      ? Number(test.duration)
      : 15;

  normalized.questions =
    Array.isArray(test.questions)
      ? test.questions
      : [];

  normalized.questions =
    normalized.questions.map(
      (question) => {

        const options =
          Array.isArray(question.options)
            ? question.options
            : [];

        return {
          question:
            question.question || "",

          options:
            options.map(
              (option) => ({
                text:
                  option.text || "",

                correct:
                  option.correct === true,

                solution:
                  option.solution || ""
              })
            )
        };
      }
    );

  return normalized;
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {

  const loading =
    $("loading");

  const testArea =
    $("testArea");

  if (loading) {
    loading.style.display = "block";
    loading.textContent =
      "Loading test...";
  }

  if (testArea) {
    testArea.style.display = "none";
  }
}


/* =========================================================
   SHOW MESSAGE
   ========================================================= */

function showMessage(message) {

  const loading =
    $("loading");

  const testArea =
    $("testArea");

  if (loading) {
    loading.style.display = "block";
    loading.textContent = message;
  }

  if (testArea) {
    testArea.style.display = "none";
  }
}


/* =========================================================
   COURSE SELECTION
   ========================================================= */

async function showCourseSelection() {

  const courses = [];

  /*
    First take Firestore tests.
  */

  firestoreTests.forEach(
    (test) => {

      if (
        test.active === false
      ) {
        return;
      }

      const courseId =
        test.courseId;

      if (!courseId) {
        return;
      }

      if (
        !courses.some(
          (course) =>
            course.id === courseId
        )
      ) {

        courses.push({
          id: courseId,

          title:
            test.courseTitle ||
            courseId
        });
      }
    }
  );


  /*
    Then add hardcoded courses.
  */

  Object.entries(TESTS)
    .forEach(
      ([id, course]) => {

        if (
          !courses.some(
            (item) =>
              item.id === id
          )
        ) {

          courses.push({
            id,

            title:
              course.title || id
          });
        }
      }
    );


  renderSelectionPage(
    "Select Course",
    courses.map(
      (course) => `

        <button
          class="selection-btn"
          onclick="location.href='test.html?course=${encodeURIComponent(course.id)}'"
        >
          ${escapeHtml(course.title)}
        </button>

      `
    ).join("")
  );
}


/* =========================================================
   LECTURE SELECTION
   ========================================================= */

async function showLectureSelection(
  courseId
) {

  const lectures = [];


  /*
    Firestore lectures
  */

  firestoreTests.forEach(
    (test) => {

      if (
        test.active === false
      ) {
        return;
      }

      if (
        test.courseId !== courseId
      ) {
        return;
      }

      const lectureId =
        String(
          test.lectureId ?? ""
        );

      if (!lectureId) {
        return;
      }

      if (
        !lectures.some(
          (lecture) =>
            lecture.id === lectureId
        )
      ) {

        lectures.push({
          id: lectureId,

          title:
            test.lectureTitle ||
            `Lecture ${lectureId}`
        });
      }
    }
  );


  /*
    Hardcoded lectures
  */

  const course =
    TESTS[courseId];

  if (course?.lectures) {

    Object.entries(
      course.lectures
    ).forEach(
      ([id, lecture]) => {

        if (
          !lectures.some(
            (item) =>
              item.id === id
          )
        ) {

          lectures.push({
            id,

            title:
              lecture.title ||
              `Lecture ${id}`
          });
        }
      }
    );
  }


  lectures.sort(
    (a, b) =>
      Number(a.id) -
      Number(b.id)
  );


  renderSelectionPage(
    "Select Lecture",
    lectures.map(
      (lecture) => `

        <button
          class="selection-btn"
          onclick="location.href='test.html?course=${encodeURIComponent(courseId)}&lecture=${encodeURIComponent(lecture.id)}'"
        >
          ${escapeHtml(lecture.title)}
        </button>

      `
    ).join("")
  );
}


/* =========================================================
   TEST SELECTION
   ========================================================= */

async function showTestSelection(
  courseId,
  lectureId
) {

  const tests = [];


  /*
    Firestore tests
  */

  firestoreTests.forEach(
    (test) => {

      if (
        test.active === false
      ) {
        return;
      }

      if (
        test.courseId !== courseId
      ) {
        return;
      }

      if (
        String(
          test.lectureId
        ) !== String(lectureId)
      ) {
        return;
      }

      const number =
        String(
          test.testNumber
        );

      if (!number) {
        return;
      }

      if (
        !tests.some(
          (item) =>
            item.number === number
        )
      ) {

        tests.push({
          number,

          title:
            test.title ||
            `Test ${number}`,

          duration:
            test.duration || 15
        });
      }
    }
  );


  /*
    Hardcoded tests
  */

  const course =
    TESTS[courseId];

  const lecture =
    course?.lectures?.[lectureId];

  if (lecture?.tests) {

    Object.entries(
      lecture.tests
    ).forEach(
      ([number, test]) => {

        if (
          !tests.some(
            (item) =>
              item.number === number
          )
        ) {

          tests.push({
            number,

            title:
              test.title ||
              `Test ${number}`,

            duration:
              test.duration || 15
          });
        }
      }
    );
  }


  tests.sort(
    (a, b) =>
      Number(a.number) -
      Number(b.number)
  );


  renderSelectionPage(
    "Select Test",
    tests.map(
      (test) => `

        <button
          class="selection-btn"
          onclick="location.href='test.html?course=${encodeURIComponent(courseId)}&lecture=${encodeURIComponent(lectureId)}&test=${encodeURIComponent(test.number)}'"
        >

          ${escapeHtml(test.title)}

          <small>
            ${escapeHtml(test.duration)} minutes
          </small>

        </button>

      `
    ).join("")
  );
}


/* =========================================================
   GENERIC SELECTION PAGE
   ========================================================= */

function renderSelectionPage(
  title,
  content
) {

  const loading =
    $("loading");

  const testArea =
    $("testArea");

  if (loading) {
    loading.style.display = "none";
  }

  if (!testArea) {
    return;
  }

  testArea.style.display = "block";

  testArea.innerHTML = `

    <div class="selection-page">

      <h1>
        ${escapeHtml(title)}
      </h1>

      <div class="selection-list">

        ${
          content ||
          `
            <p>
              No tests available.
            </p>
          `
        }

      </div>

    </div>

  `;
}


/* =========================================================
   RENDER TEST
   ========================================================= */

function renderTest() {

  stopTimer();

  const loading =
    $("loading");

  const testArea =
    $("testArea");

  if (loading) {
    loading.style.display = "none";
  }

  if (!testArea) {
    return;
  }

  testArea.style.display =
    "block";


  const questions =
    currentTest.questions || [];


  testArea.innerHTML = `

    <div class="test-header">

      <div>

        <h1>
          ${escapeHtml(
            currentTest.title
          )}
        </h1>

        <p>
          ${
            escapeHtml(
              getCourseTitle(
                currentCourseId
              )
            )
          }

          • Lecture
          ${escapeHtml(
            currentLectureId
          )}

          • Test
          ${escapeHtml(
            currentTestNumber
          )}
        </p>

      </div>

      <div class="test-info">

        <span>
          Questions:
          ${questions.length}
        </span>

        <span>
          Each correct answer = 1 mark
        </span>

      </div>

    </div>


    <div class="timer-box">

      <span>
        Time Remaining
      </span>

      <strong id="timer">
        ${formatTime(
          Number(currentTest.duration) * 60
        )}
      </strong>

    </div>


    <form
      id="testForm"
      class="questions-container"
    >

      ${
        questions
          .map(
            (question, index) =>
              renderQuestion(
                question,
                index
              )
          )
          .join("")
      }


      <button
        type="submit"
        class="submit-test-btn"
        id="submitTestBtn"
      >
        Submit Test
      </button>

    </form>

  `;


  const form =
    $("testForm");

  if (form) {

    form.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await submitTest(false);
      }
    );
  }


  startTimer();
}


/* =========================================================
   RENDER QUESTION
   ========================================================= */

function renderQuestion(
  question,
  index
) {

  const options =
    Array.isArray(question.options)
      ? question.options
      : [];

  return `

    <div
      class="question-card"
      data-question="${index}"
    >

      <div class="question-number">

        Question ${index + 1}

      </div>

      <div class="question-text">

        ${escapeHtml(
          question.question
        )}

      </div>


      <div class="options">

        ${
          options
            .map(
              (option, optionIndex) => `

                <label
                  class="option-label"
                >

                  <input
                    type="radio"
                    name="question-${index}"
                    value="${optionIndex}"
                    onchange="window.selectAnswer(${index}, ${optionIndex})"
                  />

                  <span>
                    ${escapeHtml(
                      option.text
                    )}
                  </span>

                </label>

              `
            )
            .join("")
        }

      </div>

    </div>

  `;
}


/* =========================================================
   SELECT ANSWER
   ========================================================= */

window.selectAnswer =
function (
  questionIndex,
  optionIndex
) {

  selectedAnswers[
    questionIndex
  ] = optionIndex;
};


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

  stopTimer();

  remainingSeconds =
    Number(currentTest.duration) *
    60;

  updateTimer();

  timerInterval =
    setInterval(
      () => {

        remainingSeconds--;

        updateTimer();

        if (
          remainingSeconds <= 0
        ) {

          stopTimer();

          autoSubmitTest();
        }

      },
      1000
    );
}


/* =========================================================
   STOP TIMER
   ========================================================= */

function stopTimer() {

  if (timerInterval) {

    clearInterval(
      timerInterval
    );

    timerInterval = null;
  }
}


/* =========================================================
   UPDATE TIMER
   ========================================================= */

function updateTimer() {

  const timer =
    $("timer");

  if (!timer) {
    return;
  }

  timer.textContent =
    formatTime(
      remainingSeconds
    );


  if (
    remainingSeconds <= 60
  ) {

    timer.classList.add(
      "danger"
    );

  } else if (
    remainingSeconds <= 300
  ) {

    timer.classList.add(
      "warning"
    );
  }
}


/* =========================================================
   FORMAT TIME
   ========================================================= */

function formatTime(
  seconds
) {

  seconds =
    Math.max(
      0,
      Number(seconds) || 0
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const secs =
    seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0")
  );
}


/* =========================================================
   AUTO SUBMIT
   ========================================================= */

async function autoSubmitTest() {

  alert(
    "Time is over. Your test will be submitted automatically."
  );

  await submitTest(true);
}


/* =========================================================
   SUBMIT TEST
   ========================================================= */

async function submitTest(
  autoSubmitted = false
) {

  if (!currentUser) {
    return;
  }

  const submitButton =
    $("submitTestBtn");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "Submitting...";
  }


  stopTimer();


  const questions =
    currentTest.questions || [];


  /*
    Collect answers from radio buttons
    too, so that data remains correct
    even if selectedAnswers was not updated.
  */

  questions.forEach(
    (_, index) => {

      const selected =
        document.querySelector(
          `input[name="question-${index}"]:checked`
        );

      if (selected) {

        selectedAnswers[index] =
          Number(
            selected.value
          );
      }
    }
  );


  let score = 0;

  const answers = [];


  questions.forEach(
    (question, index) => {

      const selectedIndex =
        selectedAnswers[index];

      const selectedOption =
        Number.isInteger(
          selectedIndex
        )
          ? question.options[
              selectedIndex
            ]
          : null;


      const correctIndex =
        question.options.findIndex(
          (option) =>
            option.correct === true
        );


      const isCorrect =
        Number.isInteger(
          selectedIndex
        ) &&
        selectedIndex ===
          correctIndex;


      if (isCorrect) {
        score++;
      }


      answers.push({

        questionIndex:
          index,

        selectedIndex:
          Number.isInteger(
            selectedIndex
          )
            ? selectedIndex
            : null,

        selectedText:
          selectedOption
            ? selectedOption.text
            : "",

        correctIndex,

        correctText:
          correctIndex >= 0
            ? question.options[
                correctIndex
              ].text
            : "",

        correct:
          isCorrect

      });

    }
  );


  const total =
    questions.length;

  const percentage =
    total > 0
      ? Math.round(
          (score / total) * 100
        )
      : 0;


  /*
    IMPORTANT
    Keep this exact testId format.

    Leaderboard depends on this.
  */

  const testId =
    makeTestId(
      currentCourseId,
      currentLectureId,
      currentTestNumber
    );


  /*
    IMPORTANT
    Existing result ID format is kept.
  */

  const safeEmail =
    (currentUser.email || "")
      .replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );


  const resultId =
    testId +
    "_" +
    safeEmail;


  try {

    const resultRef =
      doc(
        db,
        "testResults",
        resultId
      );


    const existingResult =
      await getDoc(
        resultRef
      );


    /*
      FIRST ATTEMPT ONLY

      If result already exists,
      do not overwrite it.
    */

    if (
      existingResult.exists()
    ) {

      const oldResult =
        existingResult.data();

      showAlreadySubmitted(
        oldResult
      );

      return;
    }


    const resultData = {

      name:
        currentUser.displayName ||
        currentUser.email ||
        "Student",

      email:
        currentUser.email || "",

      uid:
        currentUser.uid,

      course:
        currentCourseId,

      lecture:
        currentLectureId,

      testNumber:
        currentTestNumber,

      testId,

      score,

      total,

      percentage,

      answers,

      submittedAt:
        Date.now()

    };


    await setDoc(
      resultRef,
      resultData
    );


    await showResult(
      resultData,
      autoSubmitted
    );


  } catch (error) {

    console.error(
      "Submit test error:",
      error
    );

    alert(
      "Unable to submit test. Please try again."
    );

    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.textContent =
        "Submit Test";
    }

    startTimer();
  }
}


/* =========================================================
   ALREADY SUBMITTED
   ========================================================= */

function showAlreadySubmitted(
  result
) {

  const testArea =
    $("testArea");

  if (!testArea) {
    return;
  }

  testArea.innerHTML = `

    <div class="result-card">

      <h2>
        Test Already Submitted
      </h2>

      <p>
        You have already attempted this test.
      </p>

      <div class="score-box">

        <strong>
          ${escapeHtml(
            result.score
          )}
          /
          ${escapeHtml(
            result.total
          )}
        </strong>

        <span>
          ${escapeHtml(
            result.percentage
          )}%
        </span>

      </div>

      <button
        class="submit-test-btn"
        onclick="location.href='test.html?course=${encodeURIComponent(currentCourseId)}&lecture=${encodeURIComponent(currentLectureId)}&test=${encodeURIComponent(currentTestNumber)}'"
      >
        View Result
      </button>

    </div>

  `;
}


/* =========================================================
   SHOW RESULT
   ========================================================= */

async function showResult(
  result,
  autoSubmitted
) {

  const testArea =
    $("testArea");

  if (!testArea) {
    return;
  }


  const rankData =
    await getLeaderboard(
      result.testId,
      result.uid
    );


  testArea.innerHTML = `

    <div class="result-page">

      <div class="result-card">

        <h1>
          Test Submitted
        </h1>

        ${
          autoSubmitted
            ? `
              <p class="auto-submit-message">
                Time was over, so the test was submitted automatically.
              </p>
            `
            : ""
        }


        <div class="score-box">

          <div>

            <span>
              Score
            </span>

            <strong>
              ${escapeHtml(
                result.score
              )}
              /
              ${escapeHtml(
                result.total
              )}
            </strong>

          </div>


          <div>

            <span>
              Percentage
            </span>

            <strong>
              ${escapeHtml(
                result.percentage
              )}%
            </strong>

          </div>

        </div>


        <div class="rank-box">

          <h3>
            Your Rank
          </h3>

          <strong>
            #${rankData.rank}
          </strong>

          <span>
            out of
            ${rankData.totalStudents}
          </span>

        </div>

      </div>


      <div class="leaderboard-card">

        <h2>
          🏆 Leaderboard
        </h2>

        <div
          id="leaderboard"
        >

          ${renderLeaderboard(
            rankData.rows,
            result.uid
          )}

        </div>

      </div>


      <div class="solutions-card">

        <h2>
          Detailed Solutions
        </h2>

        ${renderSolutions(
          result.answers
        )}

      </div>


      <div class="result-actions">

        <button
          class="submit-test-btn"
          onclick="location.href='test.html?course=${encodeURIComponent(currentCourseId)}&lecture=${encodeURIComponent(currentLectureId)}'"
        >
          Back to Tests
        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   LEADERBOARD
   =========================================================
   IMPORTANT:
   This system is intentionally preserved.
   ========================================================= */

async function getLeaderboard(
  testId,
  currentUid
) {

  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "testResults"
        )
      );


    const results = [];


    snapshot.forEach(
      (docSnap) => {

        const data =
          docSnap.data();


        /*
          Only same test
        */

        if (
          data.testId !== testId
        ) {
          return;
        }


        results.push({

          id:
            docSnap.id,

          ...data

        });

      }
    );


    /*
      Highest score first.

      If score is same,
      earlier submission gets higher rank.
    */

    results.sort(
      (a, b) => {

        const scoreA =
          Number(a.score) || 0;

        const scoreB =
          Number(b.score) || 0;

        if (
          scoreB !== scoreA
        ) {

          return (
            scoreB - scoreA
          );
        }


        const timeA =
          Number(
            a.submittedAt
          ) || 0;

        const timeB =
          Number(
            b.submittedAt
          ) || 0;

        return (
          timeA - timeB
        );
      }
    );


    const currentIndex =
      results.findIndex(
        (item) =>
          item.uid ===
          currentUid
      );


    return {

      rank:
        currentIndex >= 0
          ? currentIndex + 1
          : "-",

      totalStudents:
        results.length,

      rows:
        results

    };


  } catch (error) {

    console.error(
      "Leaderboard error:",
      error
    );

    return {

      rank: "-",

      totalStudents: 0,

      rows: []

    };
  }
}


/* =========================================================
   RENDER LEADERBOARD
   ========================================================= */

function renderLeaderboard(
  rows,
  currentUid
) {

  if (
    !rows ||
    rows.length === 0
  ) {

    return `
      <p>
        No leaderboard data available.
      </p>
    `;
  }


  return `

    <div class="leaderboard-table">

      <div class="leaderboard-row leaderboard-head">

        <div>
          Rank
        </div>

        <div>
          Student
        </div>

        <div>
          Score
        </div>

        <div>
          %
        </div>

      </div>


      ${
        rows
          .map(
            (row, index) => {

              const rank =
                index + 1;

              let medal = "";

              if (rank === 1) {
                medal = "🥇";
              } else if (
                rank === 2
              ) {
                medal = "🥈";
              } else if (
                rank === 3
              ) {
                medal = "🥉";
              }


              const isCurrent =
                row.uid ===
                currentUid;


              return `

                <div
                  class="leaderboard-row ${
                    isCurrent
                      ? "current-user"
                      : ""
                  }"
                >

                  <div>
                    ${medal}
                    #${rank}
                  </div>

                  <div>

                    ${escapeHtml(
                      row.name ||
                      row.email ||
                      "Student"
                    )}

                    ${
                      isCurrent
                        ? `
                          <span class="you-badge">
                            You
                          </span>
                        `
                        : ""
                    }

                  </div>

                  <div>
                    ${escapeHtml(
                      row.score
                    )}
                    /
                    ${escapeHtml(
                      row.total
                    )}
                  </div>

                  <div>
                    ${escapeHtml(
                      row.percentage
                    )}%
                  </div>

                </div>

              `;
            }
          )
          .join("")
      }

    </div>

  `;
}


/* =========================================================
   RENDER SOLUTIONS
   ========================================================= */

function renderSolutions(
  answers
) {

  if (
    !answers ||
    answers.length === 0
  ) {

    return `
      <p>
        No answer details available.
      </p>
    `;
  }


  return answers
    .map(
      (answer, index) => {

        return `

          <div
            class="solution-item ${
              answer.correct
                ? "correct"
                : "incorrect"
            }"
          >

            <h3>
              Question ${index + 1}

              ${
                answer.correct
                  ? "✓"
                  : "✗"
              }

            </h3>


            <p>

              <strong>
                Your answer:
              </strong>

              ${
                escapeHtml(
                  answer.selectedText ||
                  "Not answered"
                )
              }

            </p>


            <p>

              <strong>
                Correct answer:
              </strong>

              ${
                escapeHtml(
                  answer.correctText ||
                  "Not available"
                )
              }

            </p>

          </div>

        `;
      }
    )
    .join("");
}


/* =========================================================
   COURSE TITLE
   ========================================================= */

function getCourseTitle(
  courseId
) {

  /*
    Hardcoded course title
  */

  if (
    TESTS[courseId]?.title
  ) {

    return TESTS[
      courseId
    ].title;
  }


  /*
    Firestore course title
  */

  const firestoreTest =
    firestoreTests.find(
      (test) =>
        test.courseId ===
        courseId
    );


  if (
    firestoreTest?.courseTitle
  ) {

    return firestoreTest.courseTitle;
  }


  return courseId;
}


/* =========================================================
   GLOBAL PROTECTION
   ========================================================= */

document.addEventListener(
  "contextmenu",
  (event) => {
    event.preventDefault();
  }
);


document.addEventListener(
  "selectstart",
  (event) => {
    event.preventDefault();
  }
);


document.addEventListener(
  "dragstart",
  (event) => {
    event.preventDefault();
  }
);


document.addEventListener(
  "keydown",
  (event) => {

    /*
      Print
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "p"
    ) {

      event.preventDefault();
    }


    /*
      Save page
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "s"
    ) {

      event.preventDefault();
    }


    /*
      View source
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "u"
    ) {

      event.preventDefault();
    }


    /*
      Developer tools shortcuts
    */

    if (
      event.key === "F12"
    ) {

      event.preventDefault();
    }


    if (
      event.ctrlKey &&
      event.shiftKey &&
      (
        event.key.toLowerCase() === "i" ||
        event.key.toLowerCase() === "j" ||
        event.key.toLowerCase() === "c"
      )
    ) {

      event.preventDefault();
    }

  }
);


/* =========================================================
   PRINT PROTECTION
   ========================================================= */

window.addEventListener(
  "beforeprint",
  () => {

    document.body.classList.add(
      "printing"
    );

  }
);


window.addEventListener(
  "afterprint",
  () => {

    document.body.classList.remove(
      "printing"
    );

  }
);


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    stopTimer();

  }
);
