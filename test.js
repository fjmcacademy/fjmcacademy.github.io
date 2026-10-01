/* =========================================================
   FJMC ACADEMY
   DYNAMIC FIRESTORE TEST SYSTEM
   ========================================================= */

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   VARIABLES
   ========================================================= */

let currentUser = null;
let currentStudent = null;
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

const params = new URLSearchParams(
    window.location.search
);

courseId = params.get("course");
lectureId = params.get("lecture");
testNumber = params.get("test");


/* =========================================================
   STUDENT DOCUMENT ID
   ========================================================= */

function studentDocId(email) {

    return String(email || "")
        .trim()
        .toLowerCase()
        .replaceAll("/", "_");

}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async function(user) {

        if (!user) {

            window.location.href = "login.html";
            return;

        }

        currentUser = user;

        const emailElement =
            document.getElementById("studentEmail");

        if (emailElement) {

            emailElement.textContent =
                user.email || "";

        }


        try {

            await loadStudent();

            /*
             * If no lecture/test is supplied,
             * show available tests.
             */

            if (!lectureId || !testNumber) {

                await showAvailableTests();
                return;

            }


            await loadTest();

        } catch (error) {

            console.error(
                "Test loading error:",
                error
            );

            showMessage(
                "Test load nahi ho saka. " +
                error.message
            );

        }

    }
);


/* =========================================================
   LOAD STUDENT
   ========================================================= */

async function loadStudent() {

    const email = currentUser.email;

    if (!email) {

        throw new Error(
            "Student email available nahi hai."
        );

    }


    const studentRef = doc(
        db,
        "students",
        studentDocId(email)
    );

    const studentSnap =
        await getDoc(studentRef);


    if (!studentSnap.exists()) {

        throw new Error(
            "Student profile nahi mila."
        );

    }


    currentStudent = {

        id: studentSnap.id,

        ...studentSnap.data()

    };


    try {

        sessionStorage.setItem(
            "loggedInStudent",
            JSON.stringify(currentStudent)
        );

    } catch (error) {

        console.log(
            "Session save error:",
            error
        );

    }

}


/* =========================================================
   CHECK COURSE ACCESS
   ========================================================= */

function studentHasCourse(courseIdToCheck) {

    if (!currentStudent) {

        return false;

    }


    const courses =
        currentStudent.courses || [];


    return courses.some(
        function(course) {

            if (
                typeof course === "string"
            ) {

                return course ===
                    courseIdToCheck;

            }


            if (
                typeof course === "object" &&
                course !== null
            ) {

                return (
                    course.id ===
                    courseIdToCheck ||

                    course.courseId ===
                    courseIdToCheck
                );

            }


            return false;

        }
    );

}


/* =========================================================
   LOAD TEST FROM FIRESTORE
   ========================================================= */

async function loadTest() {

    /*
     * Course access check
     */

    if (!studentHasCourse(courseId)) {

        showMessage(
            "Aapko is course ka access nahi hai."
        );

        return;

    }


    /*
     * Test ID formats supported:
     *
     * 1. Admin-created direct test ID
     * 2. Old course-lecture-test format
     */

    const possibleIds = [

        testNumber,

        courseId +
        "-lecture-" +
        lectureId +
        "-test-" +
        testNumber,

        courseId +
        "_lecture-" +
        lectureId +
        "_test-" +
        testNumber

    ];


    let testData = null;
    let foundTestId = null;


    for (
        const testId of possibleIds
    ) {

        if (!testId) continue;


        const testRef = doc(
            db,
            "tests",
            testId
        );

        const testSnap =
            await getDoc(testRef);


        if (testSnap.exists()) {

            testData =
                testSnap.data();

            foundTestId =
                testSnap.id;

            break;

        }

    }


    /*
     * If direct ID not found,
     * search by course/lecture/testNumber.
     */

    if (!testData) {

        const testsRef =
            collection(db, "tests");


        const testQuery =
            query(
                testsRef,
                where(
                    "courseId",
                    "==",
                    courseId
                )
            );


        const snapshot =
            await getDocs(testQuery);


        snapshot.forEach(
            function(testDoc) {

                if (testData) {
                    return;
                }


                const data =
                    testDoc.data();


                const sameLecture =
                    String(
                        data.lecture || ""
                    ) ===
                    String(
                        lectureId || ""
                    );


                const sameTest =
                    String(
                        data.testNumber || ""
                    ) ===
                    String(
                        testNumber || ""
                    );


                if (
                    sameLecture &&
                    sameTest
                ) {

                    testData = data;

                    foundTestId =
                        testDoc.id;

                }

            }
        );

    }


    if (!testData) {

        showMessage(
            "Test available nahi hai."
        );

        return;

    }


    currentTest = {

        id: foundTestId,

        ...testData

    };


    /*
     * Normalize questions
     */

    currentTest.questions =
        normalizeQuestions(
            currentTest.questions
        );


    /*
     * Page title
     */

    const titleElement =
        document.getElementById(
            "testTitle"
        );


    if (titleElement) {

        titleElement.textContent =
            currentTest.title ||
            "FJMC Academy Test";

    }


    const loading =
        document.getElementById(
            "loading"
        );


    if (loading) {

        loading.remove();

    }


    /*
     * No questions
     */

    if (
        !currentTest.questions.length
    ) {

        showMessage(
            "Is test mein abhi questions add nahi kiye gaye hain."
        );

        return;

    }


    renderTest();

    startTimer();

}


/* =========================================================
   NORMALIZE QUESTIONS
   ========================================================= */

function normalizeQuestions(questions) {

    if (!Array.isArray(questions)) {

        return [];

    }


    return questions.map(
        function(question, index) {

            let options =
                Array.isArray(
                    question.options
                )
                    ? question.options
                    : [];


            options =
                options.map(
                    function(option) {

                        if (
                            typeof option ===
                            "string"
                        ) {

                            return {

                                text: option,

                                correct: false,

                                solution: ""

                            };

                        }


                        return {

                            text:
                                option.text ||
                                "",

                            correct:
                                option.correct === true,

                            solution:
                                option.solution ||
                                option.explanation ||
                                ""

                        };

                    }
                );


            /*
             * Support new format:
             * correctAnswer: 0
             */

            if (
                typeof question.correctAnswer ===
                "number"
            ) {

                options =
                    options.map(
                        function(
                            option,
                            optionIndex
                        ) {

                            return {

                                ...option,

                                correct:
                                    optionIndex ===
                                    Number(
                                        question.correctAnswer
                                    )

                            };

                        }
                    );

            }


            /*
             * Support correctAnswer:
             * "A", "B", "C", "D"
             */

            if (
                typeof question.correctAnswer ===
                "string"
            ) {

                const answer =
                    question.correctAnswer
                        .trim()
                        .toUpperCase();


                const answerIndex =
                    ["A", "B", "C", "D"]
                        .indexOf(answer);


                if (answerIndex >= 0) {

                    options =
                        options.map(
                            function(
                                option,
                                optionIndex
                            ) {

                                return {

                                    ...option,

                                    correct:
                                        optionIndex ===
                                        answerIndex

                                };

                            }
                        );

                }

            }


            return {

                id:
                    question.id ||
                    "q-" + index,

                question:
                    question.question ||
                    question.text ||
                    "",

                options:
                    options

            };

        }
    );

}


/* =========================================================
   SHOW MESSAGE
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
            <div class="test-info">
                <h3>${escapeHTML(message)}</h3>
            </div>
        `;

        return;

    }


    if (area) {

        area.innerHTML = `
            <div class="test-info">
                <h3>${escapeHTML(message)}</h3>
            </div>
        `;

    }

}


/* =========================================================
   AVAILABLE TESTS
   ========================================================= */

async function showAvailableTests() {

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


    const courses =
        currentStudent.courses || [];


    if (!courses.length) {

        area.innerHTML = `
            <div class="test-info">
                <h2>No course assigned</h2>
                <p>
                    Admin ne abhi aapko koi course assign nahi kiya hai.
                </p>
            </div>
        `;

        return;

    }


    let html = `

        <div class="test-info">

            <h1>
                FJMC Academy Tests
            </h1>

            <p>
                Apna course select karein.
            </p>

        </div>

    `;


    for (
        const courseItem of courses
    ) {

        const id =
            typeof courseItem === "string"
                ? courseItem
                : (
                    courseItem.courseId ||
                    courseItem.id
                );


        if (!id) continue;


        const courseRef =
            doc(
                db,
                "courses",
                id
            );


        const courseSnap =
            await getDoc(courseRef);


        if (!courseSnap.exists()) {

            continue;

        }


        const course =
            courseSnap.data();


        html += `

            <div class="question">

                <h2>
                    📚
                    ${escapeHTML(
                        course.title ||
                        id
                    )}
                </h2>

                <p>
                    ${escapeHTML(
                        course.description ||
                        ""
                    )}
                </p>

                <button
                    type="button"
                    class="submit-btn"
                    onclick="
                        window.location.href =
                        'test.html?course=' +
                        encodeURIComponent('${escapeAttribute(id)}')
                    "
                >
                    📝 Open Tests
                </button>

            </div>

        `;

    }


    area.innerHTML =
        html;

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
                ${escapeHTML(
                    currentTest.title ||
                    "FJMC Academy Test"
                )}
            </h2>

            ${
                currentTest.exam
                    ? `
                        <p>
                            <strong>Exam:</strong>
                            ${escapeHTML(
                                currentTest.exam
                            )}
                        </p>
                    `
                    : ""
            }

            ${
                currentTest.batch
                    ? `
                        <p>
                            <strong>Batch:</strong>
                            ${escapeHTML(
                                currentTest.batch
                            )}
                        </p>
                    `
                    : ""
            }

            ${
                lectureId
                    ? `
                        <p>
                            <strong>Lecture:</strong>
                            ${escapeHTML(
                                lectureId
                            )}
                        </p>
                    `
                    : ""
            }

            <p>
                <strong>Total Questions:</strong>
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
                        ${escapeHTML(
                            question.question
                        )}
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

                            ${escapeHTML(
                                option.text
                            )}

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
                        "Time is over. Test automatically submit ho raha hai."
                    );


                    submitTest(
                        new Event("submit")
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
   STUDENT NAME
   ========================================================= */

function getStudentName() {

    if (
        currentStudent &&
        currentStudent.name
    ) {

        return currentStudent.name;

    }


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
                            option.correct === true
                        );

                    }
                );


            const isCorrect =
                selectedIndex ===
                correctIndex;


            if (isCorrect) {

                score++;

            }


            answers.push({

                questionId:
                    question.id ||
                    "q-" + index,

                question:
                    question.question,

                selectedIndex:
                    selectedIndex,

                selectedAnswer:
                    selectedIndex >= 0
                        ? (
                            question.options[
                                selectedIndex
                            ]?.text || ""
                        )
                        : "Not Attempted",

                correctIndex:
                    correctIndex,

                correctAnswer:
                    correctIndex >= 0
                        ? (
                            question.options[
                                correctIndex
                            ]?.text || ""
                        )
                        : "",

                explanation:
                    correctIndex >= 0
                        ? (
                            question.options[
                                correctIndex
                            ]?.solution || ""
                        )
                        : "",

                isCorrect:
                    isCorrect

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


    /*
     * First attempt result ID
     */

    const safeEmail =
        (
            currentUser.email || ""
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                "_"
            );


    const resultTestId =
        currentTest.id ||
        (
            courseId +
            "-lecture-" +
            lectureId +
            "-test-" +
            testNumber
        );


    const resultId =
        resultTestId +
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
         * FIRST ATTEMPT ONLY
         */

        if (
            !existingResult.exists()
        ) {

            await setDoc(
                resultRef,
                {

                    studentId:
                        currentStudent?.studentId ||
                        "",

                    name:
                        getStudentName(),

                    email:
                        currentUser.email,

                    uid:
                        currentUser.uid,

                    exam:
                        currentStudent?.exam ||
                        currentTest.exam ||
                        "",

                    batch:
                        currentStudent?.batch ||
                        currentTest.batch ||
                        "",

                    year:
                        currentStudent?.year ||
                        "",

                    course:
                        courseId,

                    lecture:
                        lectureId || "",

                    testNumber:
                        testNumber || "",

                    testId:
                        resultTestId,

                    testTitle:
                        currentTest.title ||
                        "",

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


        <div class="leaderboard">

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
                        ${escapeHTML(
                            question.question
                        )}
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


                    let statusText =
                        "○ Option";


                    if (isCorrect) {

                        statusText =
                            "✅ Correct Answer";

                    }


                    if (
                        isSelected &&
                        !isCorrect
                    ) {

                        statusText =
                            "❌ Your Answer";

                    }


                    html += `

                        <div
                            class="${className}"
                        >

                            <strong>
                                ${escapeHTML(
                                    option.text
                                )}
                            </strong>

                            <p>
                                ${statusText}
                            </p>

                            ${
                                option.solution
                                    ? `
                                        <p>
                                            <strong>
                                                Explanation:
                                            </strong>
                                            ${escapeHTML(
                                                option.solution
                                            )}
                                        </p>
                                    `
                                    : ""
                            }

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
            currentTest.id ||
            (
                courseId +
                "-lecture-" +
                lectureId +
                "-test-" +
                testNumber
            );


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
                    (index + 1);


                if (index === 0) {

                    rankText =
                        "🥇 #1";

                } else if (
                    index === 1
                ) {

                    rankText =
                        "🥈 #2";

                } else if (
                    index === 2
                ) {

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
                            ${escapeHTML(name)}

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
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   ATTRIBUTE ESCAPE
   ========================================================= */

function escapeAttribute(value) {

    return String(value ?? "")
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'");

}


/* =========================================================
   COPY / CONTEXT PROTECTION
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


        if (
            key === "f12"
        ) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }


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
