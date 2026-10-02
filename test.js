/* =========================================================
   FJMC ACADEMY
   LECTURE WISE TEST SYSTEM
   ========================================================= */

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   TEST DATA
   =========================================================
   
   IMPORTANT:
   Course
      ↓
   Lecture
      ↓
   Test 1 / Test 2 / Test 3 / ...
      ↓
   Questions

   Jitne chahe TEST add kar sakte ho.
   ========================================================= */

let TESTS = {};
/* =========================================================
   VARIABLES
   ========================================================= */

let currentUser = null;
let currentTest = null;

let courseId = null;
let lectureId = null;
let testNumber = null;

let timerInterval = null;
let remainingSeconds = 0;

let testSubmitted = false;


/* =========================================================
   URL PARAMETERS
   ========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

courseId =
    params.get("course");

lectureId =
    params.get("lecture");

testNumber =
    params.get("test");


/* =========================================================
   PAGE SAVE / PRINT PROTECTION
   ========================================================= */

function protectPage() {

    document.documentElement.setAttribute(
        "data-test-page",
        "true"
    );

}


/* =========================================================
   AUTH
   ========================================================= */

async function loadTestsFromFirestore() {
    const snapshot = await getDocs(collection(db, "tests"));
    TESTS = {};

    snapshot.forEach(function(testDoc) {
        const data = testDoc.data();
        const cid = data.courseId;
        if (!cid) return;

        if (!TESTS[cid]) {
            TESTS[cid] = {
                title: data.courseTitle || cid,
                lectures: {}
            };
        }

        if (!TESTS[cid].lectures[data.lectureId]) {
            TESTS[cid].lectures[data.lectureId] = {
                title: data.lectureTitle || ("Lecture " + data.lectureId),
                tests: {}
            };
        }

        TESTS[cid].lectures[data.lectureId].tests[data.testNumber] = {
            title: data.title || ("Test " + data.testNumber),
            duration: Number(data.duration) || 30,
            questions: Array.isArray(data.questions) ? data.questions : []
        };
    });

    // Get the course title from the student's assigned course document.
    if (courseId) {
        try {
            const courseSnap = await getDoc(doc(db, "courses", courseId));
            if (courseSnap.exists()) {
                TESTS[courseId] = TESTS[courseId] || {
                    title: courseSnap.data().title || courseId,
                    lectures: {}
                };
                TESTS[courseId].title =
                    courseSnap.data().title || TESTS[courseId].title || courseId;
            }
        } catch (e) {
            console.warn("Course title load failed:", e);
        }
    }
}

onAuthStateChanged(
    auth,
    async function(user) {

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;

        const emailElement = document.getElementById("studentEmail");
        if (emailElement) {
            emailElement.textContent = user.email || "";
        }

        try {
            await loadTestsFromFirestore();
        } catch (error) {
            console.error("Test data load error:", error);
            showMessage("Test data could not be loaded. Please try again.");
            return;
        }

        const course = TESTS[courseId];

        if (!course) {
            showMessage("No tests are assigned/available for this course.");
            return;
        }

        if (!lectureId || !testNumber) {
            showTestSelection();
            return;
        }

        currentTest =
            course.lectures?.[lectureId]?.tests?.[testNumber];

        if (!currentTest) {
            showMessage("This lecture/test is not available.");
            return;
        }

        const titleElement = document.getElementById("testTitle");
        if (titleElement) {
            titleElement.textContent = currentTest.title;
        }

        const loading = document.getElementById("loading");
        if (loading) {
            loading.remove();
        }

        renderTest();
        startTimer();
    }
);

/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(message) {

    const loading =
        document.getElementById(
            "loading"
        );

    const area =
        document.getElementById(
            "testArea"
        );


    if (loading) {

        loading.innerHTML = `
            <h3>${message}</h3>
        `;

        return;

    }


    if (area) {

        area.innerHTML = `
            <div class="test-info">
                <h3>${message}</h3>
            </div>
        `;

    }

}


/* =========================================================
   TEST SELECTION
   ========================================================= */

function showTestSelection() {

    const loading =
        document.getElementById(
            "loading"
        );

    if (loading) {

        loading.remove();

    }


    const area =
        document.getElementById(
            "testArea"
        );


    if (!area) {

        return;

    }


    const course =
        TESTS[courseId];


    let html = `

        <div class="test-info">

            <h1>
                ${course.title}
            </h1>

            <p>
                Select Lecture and Test
            </p>

        </div>

    `;


    Object.keys(
        course.lectures
    ).forEach(
        function(lectureKey) {

            const lecture =
                course.lectures[
                    lectureKey
                ];


            html += `

                <div class="question">

                    <h2>
                        📚 ${lecture.title}
                    </h2>

                    <div
                        style="
                            display:grid;
                            gap:10px;
                        "
                    >

            `;


            Object.keys(
                lecture.tests
            ).forEach(
                function(testKey) {

                    const test =
                        lecture.tests[
                            testKey
                        ];


                    html += `

                        <button
                            type="button"
                            class="submit-btn"
                            style="
                                background:#2563eb;
                                cursor:pointer;
                            "
                            onclick="
                                openTest(
                                    '${escapeAttribute(lectureKey)}',
                                    '${escapeAttribute(testKey)}'
                                )
                            "
                        >

                            📝 Test ${testKey}

                            <span
                                style="
                                    font-size:14px;
                                    opacity:.9;
                                "
                            >
                                (${test.duration} min)
                            </span>

                        </button>

                    `;

                }
            );


            html += `

                    </div>

                </div>

            `;

        }
    );


    area.innerHTML =
        html;

}


/* =========================================================
   ESCAPE ATTRIBUTE
   ========================================================= */

function escapeAttribute(value) {

    return String(value)
        .replace(
            /'/g,
            "\\'"
        );

}


/* =========================================================
   OPEN TEST
   ========================================================= */

window.openTest =
    function(
        lecture,
        test
    ) {

        window.location.href =
            "test.html?course=" +
            encodeURIComponent(
                courseId
            ) +
            "&lecture=" +
            encodeURIComponent(
                lecture
            ) +
            "&test=" +
            encodeURIComponent(
                test
            );

    };


/* =========================================================
   STUDENT NAME
   ========================================================= */

function getStudentName() {

    if (
        currentUser &&
        currentUser.displayName
    ) {

        return currentUser.displayName;

    }


    try {

        const stored =
            sessionStorage.getItem(
                "loggedInStudent"
            );


        if (stored) {

            const student =
                JSON.parse(
                    stored
                );


            if (
                student &&
                student.name
            ) {

                return student.name;

            }

        }

    } catch (error) {

        console.log(
            "Student name error:",
            error
        );

    }


    if (
        currentUser &&
        currentUser.email
    ) {

        return currentUser.email
            .split("@")[0];

    }


    return "Student";

}


/* =========================================================
   RENDER TEST
   ========================================================= */

function renderTest() {

    const area =
        document.getElementById(
            "testArea"
        );


    if (!area) {

        return;

    }


    let html = `

        <div class="test-info">

            <h2>
                ${currentTest.title}
            </h2>

            <p>
                Lecture:
                ${lectureId}
            </p>

            <p>
                Test:
                ${testNumber}
            </p>

            <p>
                Total Questions:
                ${currentTest.questions.length}
            </p>

            <p>
                Each correct answer = 1 mark
            </p>

            <div
                id="timerBox"
                class="timer-box"
            >

                Time Left:

                <strong id="timer">
                    00:00
                </strong>

            </div>

        </div>

        <form id="testForm">

    `;


    currentTest.questions.forEach(
        function(
            question,
            index
        ) {

            html += `

                <div class="question">

                    <h3>
                        Q${index + 1}.
                        ${question.question}
                    </h3>

            `;


            question.options.forEach(
                function(
                    option,
                    optionIndex
                ) {

                    html += `

                        <label
                            class="option"
                        >

                            <input
                                type="radio"
                                name="q${index}"
                                value="${optionIndex}"
                            >

                            ${option.text}

                        </label>

                    `;

                }
            );


            html += `

                </div>

            `;

        }
    );


    html += `

        <button
            type="submit"
            class="submit-btn"
            id="submitBtn"
        >
            Submit Test
        </button>

        </form>

    `;


    area.innerHTML =
        html;


    const form =
        document.getElementById(
            "testForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            submitTest
        );

    }

}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

    if (
        !currentTest ||
        !currentTest.duration
    ) {

        return;

    }


    remainingSeconds =
        Number(
            currentTest.duration
        ) * 60;


    updateTimer();


    timerInterval =
        setInterval(
            function() {

                if (testSubmitted) {

                    clearInterval(
                        timerInterval
                    );

                    return;

                }


                remainingSeconds--;


                updateTimer();


                if (
                    remainingSeconds <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );


                    alert(
                        "Time is over. Test will be submitted automatically."
                    );


                    submitTest(
                        new Event(
                            "submit"
                        )
                    );

                }

            },
            1000
        );

}


/* =========================================================
   UPDATE TIMER
   ========================================================= */

function updateTimer() {

    const timer =
        document.getElementById(
            "timer"
        );


    if (!timer) {

        return;

    }


    const minutes =
        Math.floor(
            remainingSeconds / 60
        );


    const seconds =
        remainingSeconds % 60;


    timer.textContent =
        String(minutes)
            .padStart(2, "0") +
        ":" +
        String(seconds)
            .padStart(2, "0");

}


/* =========================================================
   SUBMIT TEST
   ========================================================= */

async function submitTest(event) {

    if (event) {

        event.preventDefault();

    }


    if (testSubmitted) {

        return;

    }


    testSubmitted = true;


    if (timerInterval) {

        clearInterval(
            timerInterval
        );

    }


    const submitBtn =
        document.getElementById(
            "submitBtn"
        );


    if (submitBtn) {

        submitBtn.disabled =
            true;

    }


    let score = 0;

    const answers = [];


    currentTest.questions.forEach(
        function(
            question,
            index
        ) {

            const selected =
                document.querySelector(
                    `input[name="q${index}"]:checked`
                );


            const selectedIndex =
                selected
                    ? Number(
                        selected.value
                    )
                    : -1;


            const correctIndex =
                question.options.findIndex(
                    function(option) {

                        return (
                            option.correct ===
                            true
                        );

                    }
                );


            if (
                selectedIndex ===
                correctIndex
            ) {

                score++;

            }


            answers.push({

                questionIndex:
                    index,

                selectedIndex:
                    selectedIndex,

                correctIndex:
                    correctIndex

            });

        }
    );


    const total =
        currentTest.questions.length;


    const percentage =
        total > 0
            ? (
                score /
                total *
                100
            ).toFixed(2)
            : "0.00";


    /* =====================================================
       RESULT ID
       ===================================================== */

    const safeEmail =
        (
            currentUser.email || ""
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                "_"
            );


    const resultId =
        courseId +
        "_lecture-" +
        lectureId +
        "_test-" +
        testNumber +
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


        /* ==============================================
           FIRST ATTEMPT ONLY
           ============================================== */

        // FIRST ATTEMPT ONLY: if this exact student/test result already exists,
        // a retake must never overwrite the original score, answers, or timestamp.
        if (!existingResult.exists()) {

            await setDoc(
                resultRef,
                {

                    name:
                        getStudentName(),

                    email:
                        currentUser.email,

                    uid:
                        currentUser.uid,

                    course:
                        courseId,

                    lecture:
                        lectureId,

                    testNumber:
                        testNumber,

                    testId:
                        courseId +
                        "-lecture-" +
                        lectureId +
                        "-test-" +
                        testNumber,

                    score:
                        score,

                    total:
                        total,

                    percentage:
                        Number(
                            percentage
                        ),

                    answers:
                        answers,

                    submittedAt:
                        Date.now()

                }
            );

        }


        showResult(
            score,
            total,
            percentage,
            answers
        );

    } catch (error) {

        console.error(
            "Result save error:",
            error
        );


        alert(
            "Result save nahi ho saka.\n" +
            error.message
        );


        if (submitBtn) {

            submitBtn.disabled =
                false;

        }


        testSubmitted =
            false;

    }

}


/* =========================================================
   SHOW RESULT
   ========================================================= */

async function showResult(
    score,
    total,
    percentage,
    answers
) {

    const area =
        document.getElementById(
            "testArea"
        );


    let html = `

        <div class="result">

            <h2>
                Test Completed
            </h2>

            <h1>
                ${score} / ${total}
            </h1>

            <p>
                Percentage:
                ${percentage}%
            </p>

            <div
                class="rank-box"
                id="rankBox"
            >
                Calculating Rank...
            </div>

        </div>


        <div
            class="leaderboard"
        >

            <h2>
                🏆 First Attempt Leaderboard
            </h2>

            <div
                id="leaderboardList"
            >
                Loading...
            </div>

        </div>

        <h2>
            Solutions & Explanations
        </h2>

    `;


    currentTest.questions.forEach(
        function(
            question,
            qIndex
        ) {

            const answer =
                answers[qIndex];


            html += `

                <div class="question">

                    <h3>
                        Q${qIndex + 1}.
                        ${question.question}
                    </h3>

            `;


            question.options.forEach(
                function(
                    option,
                    optionIndex
                ) {

                    const isCorrect =
                        option.correct === true;


                    const isSelected =
                        answer.selectedIndex ===
                        optionIndex;


                    let className =
                        isCorrect
                            ? "solution correct"
                            : "solution";


                    if (
                        isSelected &&
                        !isCorrect
                    ) {

                        className =
                            "solution wrong";

                    }


                    html += `

                        <div
                            class="${className}"
                        >

                            <strong>
                                ${option.text}
                            </strong>

                            <p>

                                ${
                                    isCorrect
                                        ? "✅ Correct Answer"
                                        : isSelected
                                            ? "❌ Your Answer"
                                            : "○ Option"
                                }

                            </p>

                            <p>

                                <strong>
                                    Explanation:
                                </strong>

                                ${option.solution}

                            </p>

                        </div>

                    `;

                }
            );


            html += `

                </div>

            `;

        }
    );


    area.innerHTML =
        html;


    await calculateRank();

}


/* =========================================================
   RANK + LEADERBOARD
   ========================================================= */

async function calculateRank() {

    const rankBox =
        document.getElementById(
            "rankBox"
        );


    const leaderboardList =
        document.getElementById(
            "leaderboardList"
        );


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "testResults"
                )
            );


        const currentTestId =
            courseId +
            "-lecture-" +
            lectureId +
            "-test-" +
            testNumber;


        const results = [];


        snapshot.forEach(
            function(resultDoc) {

                const data =
                    resultDoc.data();


                if (
                    data.testId ===
                    currentTestId
                ) {

                    results.push(
                        data
                    );

                }

            }
        );


        // Leaderboard is calculated ONLY from first-attempt documents for this exact
        // course + lecture + test. Since the result document ID is fixed per student
        // and test, retakes do not create a second leaderboard entry.
        results.sort(
            function(a, b) {

                const difference =
                    Number(b.score) -
                    Number(a.score);


                if (
                    difference !== 0
                ) {

                    return difference;

                }


                return (
                    Number(
                        a.submittedAt || 0
                    ) -
                    Number(
                        b.submittedAt || 0
                    )
                );

            }
        );


        const myIndex =
            results.findIndex(
                function(result) {

                    return (
                        result.uid ===
                        currentUser.uid
                    );

                }
            );


        const rank =
            myIndex >= 0
                ? myIndex + 1
                : "-";


        if (rankBox) {

            rankBox.innerHTML = `

                🏆 Your First Attempt Rank:

                <strong>
                    #${rank}
                </strong>

            `;

        }


        let html = "";


        results.forEach(
            function(
                result,
                index
            ) {

                const name =
                    result.name ||
                    (
                        result.email
                            ? result.email
                                .split("@")[0]
                            : "Student"
                    );


                let rankText =
                    "#" +
                    (
                        index + 1
                    );


                if (index === 0) {

                    rankText =
                        "🥇 #1";

                } else if (index === 1) {

                    rankText =
                        "🥈 #2";

                } else if (index === 2) {

                    rankText =
                        "🥉 #3";

                }


                const isMe =
                    result.uid ===
                    currentUser.uid;


                html += `

                    <div
                        class="
                            leaderboard-row
                            ${
                                isMe
                                    ? "my-rank"
                                    : ""
                            }
                        "
                    >

                        <span
                            class="lb-rank"
                        >
                            ${rankText}
                        </span>

                        <span
                            class="lb-name"
                        >
                            ${name}
                            ${
                                isMe
                                    ? " 👈"
                                    : ""
                            }
                        </span>

                        <span
                            class="lb-score"
                        >
                            ${result.score}/${result.total}
                        </span>

                    </div>

                `;

            }
        );


        if (leaderboardList) {

            leaderboardList.innerHTML =
                html ||
                "<p>No results yet.</p>";

        }


    } catch (error) {

        console.error(
            "Leaderboard error:",
            error
        );


        if (rankBox) {

            rankBox.textContent =
                "Rank unavailable";

        }


        if (leaderboardList) {

            leaderboardList.textContent =
                "Leaderboard unavailable.";

        }

    }

}


/* =========================================================
   BASIC COPY / CONTEXT PROTECTION
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


/* =========================================================
   KEYBOARD PROTECTION
   ========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        const key =
            String(
                event.key
            ).toLowerCase();


        /* Ctrl / CMD */

        if (
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
            (
                key === "p" ||
                key === "s" ||
                key === "c" ||
                key === "u"
            )
        ) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }


        /* F12 */

        if (
            key === "f12"
        ) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }


        /* Ctrl + Shift + I */

        if (
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
            event.shiftKey &&
            key === "i"
        ) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }


        /* Ctrl + Shift + J */

        if (
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
            event.shiftKey &&
            key === "j"
        ) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }

    }
);


/* =========================================================
   PRINT PROTECTION
   ========================================================= */

window.addEventListener(
    "beforeprint",
    function() {

        document.body.setAttribute(
            "data-print-blocked",
            "true"
        );


        document.body.innerHTML = `

            <div
                style="
                    width:100%;
                    height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-family:Arial,sans-serif;
                    text-align:center;
                "
            >

                <div>

                    <h2>
                        Printing is disabled.
                    </h2>

                    <p>
                        Please use the test page normally.
                    </p>

                </div>

            </div>

        `;

    }
);


/* =========================================================
   AFTER PRINT
   ========================================================= */

window.addEventListener(
    "afterprint",
    function() {

        window.location.reload();

    }
);


/* =========================================================
   PAGE PROTECTION
   ========================================================= */

protectPage();


/* =========================================================
   PREVENT DRAGGING
   ========================================================= */

document.addEventListener(
    "dragstart",
    function(event) {

        event.preventDefault();

    }
);
