/* =========================================================
   SHOW STUDENT COURSES
   IMPORTANT: Existing Exam / Batch / Year information stays.

   Flow:
   Course button
      -> Video / PDF / Test
      -> Lecture-wise list
========================================================= */

function showStudentCourses(student) {

    if (!coursesContainer) {
        console.error("coursesContainer not found");
        hidePageLoading();
        return;
    }

    coursesContainer.innerHTML = "";

    if (!student.courses || student.courses.length === 0) {
        coursesContainer.innerHTML = `
            <div class="no-course">
                <h3>No Course Assigned</h3>
                <p>Please contact FJMC Academy.</p>
            </div>
        `;
        hidePageLoading();
        return;
    }

    /* Keep existing Exam / Batch / Year information exactly visible. */
    const studentInfo = document.createElement("div");
    studentInfo.className = "student-course-info";
    studentInfo.innerHTML = `
        <div style="
            margin-bottom:20px;
            padding:18px;
            border-radius:12px;
            background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.12);
        ">
            <h3 style="margin:0 0 12px 0;">${escapeDashboardHTML(student.exam || "")}</h3>
            <p style="margin:5px 0;"><strong>Batch:</strong> ${escapeDashboardHTML(student.batch || "")}</p>
            <p style="margin:5px 0;"><strong>Year:</strong> ${escapeDashboardHTML(student.year || "")}</p>
        </div>
    `;
    coursesContainer.appendChild(studentInfo);

    student.courses.forEach(function(courseId) {
        const course = COURSES[courseId];
        if (!course) {
            console.warn("Course not found:", courseId);
            return;
        }

        const courseCard = document.createElement("div");
        courseCard.className = "course-card fjmc-course-card-new";

        const contents = Array.isArray(course.contents) ? course.contents : [];
        const groups = groupCourseContentsByLecture(contents);

        courseCard.innerHTML = `
            <div class="course-title fjmc-course-main-button" role="button" tabindex="0">
                <div style="margin-bottom:10px;font-size:13px;opacity:.85;">
                    ${escapeDashboardHTML(course.exam || student.exam || "")}
                    &nbsp;•&nbsp;
                    ${escapeDashboardHTML(course.batch || student.batch || "")}
                    &nbsp;•&nbsp;
                    ${escapeDashboardHTML(course.year || student.year || "")}
                </div>
                <h3>${escapeDashboardHTML(course.title || course.subject || courseId)}</h3>
                <p>${escapeDashboardHTML(course.description || "")}</p>
                <div class="fjmc-course-click-hint">Open Course ›</div>
            </div>

            <div class="fjmc-course-menu" hidden>
                <button class="fjmc-category-button" data-category="video">🎥 Video / Lecture</button>
                <button class="fjmc-category-button" data-category="pdf">📄 PDF / Notes</button>
                <button class="fjmc-category-button" data-category="test">📝 Test</button>
                ${groups.live.length ? '<button class="fjmc-category-button" data-category="live">🔴 Live Class</button>' : ''}
                <div class="fjmc-lecture-panel" hidden></div>
            </div>
        `;

        coursesContainer.appendChild(courseCard);

        const mainButton = courseCard.querySelector(".fjmc-course-main-button");
        const menu = courseCard.querySelector(".fjmc-course-menu");
        const lecturePanel = courseCard.querySelector(".fjmc-lecture-panel");

        const toggleCourse = function() {
            const willOpen = menu.hidden;
            menu.hidden = !willOpen;
            if (!willOpen) {
                lecturePanel.hidden = true;
                lecturePanel.innerHTML = "";
            }
        };

        mainButton.addEventListener("click", toggleCourse);
        mainButton.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCourse();
            }
        });

        courseCard.querySelectorAll(".fjmc-category-button").forEach(function(button) {
            button.addEventListener("click", async function() {
                const category = button.dataset.category;
                await openCourseCategory(course, courseId, category, lecturePanel);
            });
        });
    });
}

function escapeDashboardHTML(value) {
    return String(value == null ? "" : value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function lectureNumberFromTitle(title, fallback) {
    const match = String(title || "").match(/(?:lecture|lec|lesson)\s*[-_ ]*([0-9]+)/i);
    return match ? String(Number(match[1])) : String(fallback);
}

function groupCourseContentsByLecture(contents) {
    const result = { video: {}, pdf: {}, live: [] };
    let videoIndex = 1;
    let pdfIndex = 1;

    contents.forEach(function(content) {
        if (!content) return;
        if (content.type === "video" || content.type === "local-video") {
            const no = lectureNumberFromTitle(content.title, videoIndex++);
            (result.video[no] ||= []).push(content);
        } else if (content.type === "pdf") {
            const no = lectureNumberFromTitle(content.title, pdfIndex++);
            (result.pdf[no] ||= []).push(content);
        } else if (content.type === "live") {
            result.live.push(content);
        }
    });

    return result;
}

async function loadManagedTestForCourse(course) {
    const testId = course.testId || course.id || course.subject || course.title;
    try {
        const snap = await getDoc(doc(db, "tests", testId));
        if (snap.exists()) return snap.data();
    } catch (error) {
        console.warn("Could not load managed test:", error);
    }

    try {
        const module = await import("./test-default-data.js");
        return module.TESTS[testId] || null;
    } catch (error) {
        console.warn("Could not load default test data:", error);
        return null;
    }
}

function lectureEntriesForTest(testData) {
    if (!testData || !testData.lectures) return [];
    return Object.entries(testData.lectures).sort(function(a, b) {
        return Number(a[0]) - Number(b[0]);
    });
}

async function openCourseCategory(course, courseId, category, panel) {
    panel.hidden = false;
    panel.innerHTML = `<div class="fjmc-lecture-loading">Loading...</div>`;

    const contents = Array.isArray(course.contents) ? course.contents : [];
    const groups = groupCourseContentsByLecture(contents);

    if (category === "live") {
        panel.innerHTML = "";
        groups.live.forEach(function(content) {
            const button = document.createElement("button");
            button.className = "fjmc-lecture-button live-button";
            button.textContent = "🔴 " + (content.title || "Live Class");
            button.addEventListener("click", function() {
                const url = content.url || "#";
                if (url && url !== "#") window.open(url, "_blank", "noopener");
                else alert("Live class link is not available yet.");
            });
            panel.appendChild(button);
        });
        return;
    }

    if (category === "video" || category === "pdf") {
        const map = groups[category];
        const lectureNumbers = Object.keys(map).sort((a, b) => Number(a) - Number(b));
        panel.innerHTML = "";

        if (!lectureNumbers.length) {
            panel.innerHTML = `<div class="fjmc-empty">No ${category === "video" ? "video lectures" : "PDF notes"} available.</div>`;
            return;
        }

        lectureNumbers.forEach(function(no) {
            const lectureButton = document.createElement("button");
            lectureButton.className = "fjmc-lecture-button";
            lectureButton.textContent = `Lecture ${no}`;
            lectureButton.addEventListener("click", function() {
                const items = map[no] || [];
                if (!items.length) return;
                const content = items[0];
                const title = content.title || `Lecture ${no}`;
                const url = content.url || "";
                if (category === "video") {
                    if (content.type === "local-video") openLocalVideo(url, title);
                    else openYouTubeVideo(url, title);
                } else {
                    openPDFViewer(url, title);
                }
            });
            panel.appendChild(lectureButton);

            /* If multiple files share the same lecture, show each item underneath. */
            if (map[no].length > 1) {
                map[no].slice(1).forEach(function(content) {
                    const extra = document.createElement("button");
                    extra.className = "fjmc-lecture-subbutton";
                    extra.textContent = content.title || `Lecture ${no}`;
                    extra.addEventListener("click", function() {
                        if (category === "video") {
                            if (content.type === "local-video") openLocalVideo(content.url, content.title);
                            else openYouTubeVideo(content.url, content.title);
                        } else {
                            openPDFViewer(content.url, content.title);
                        }
                    });
                    panel.appendChild(extra);
                });
            }
        });
        return;
    }

    if (category === "test") {
        const testData = await loadManagedTestForCourse(course);
        const lectures = lectureEntriesForTest(testData);
        panel.innerHTML = "";

        if (!lectures.length) {
            /* Preserve the old single-course test as a fallback. */
            const fallback = document.createElement("button");
            fallback.className = "fjmc-lecture-button";
            fallback.textContent = "📝 Open Test";
            fallback.addEventListener("click", function() {
                window.location.href = "test.html?course=" + encodeURIComponent(course.testId || courseId);
            });
            panel.appendChild(fallback);
            return;
        }

        lectures.forEach(function([lectureId, lecture]) {
            const lectureButton = document.createElement("button");
            lectureButton.className = "fjmc-lecture-button";
            lectureButton.textContent = `Lecture ${lectureId}`;
            lectureButton.addEventListener("click", function() {
                const tests = lecture && lecture.tests ? lecture.tests : {};
                const testNumbers = Object.keys(tests).sort((a, b) => Number(a) - Number(b));
                const current = panel.querySelector(`.fjmc-test-list[data-lecture="${lectureId}"]`);
                if (current) {
                    current.remove();
                    return;
                }
                const list = document.createElement("div");
                list.className = "fjmc-test-list";
                list.dataset.lecture = lectureId;
                if (!testNumbers.length) {
                    list.innerHTML = `<div class="fjmc-empty">No tests in this lecture.</div>`;
                } else {
                    testNumbers.forEach(function(testNumber) {
                        const test = tests[testNumber] || {};
                        const testButton = document.createElement("button");
                        testButton.className = "fjmc-test-item";
                        testButton.textContent = `📝 Test ${testNumber}${test.title ? " — " + test.title : ""}`;
                        testButton.addEventListener("click", function() {
                            window.location.href = "test.html?course=" + encodeURIComponent(course.testId || courseId) +
                                "&lecture=" + encodeURIComponent(lectureId) +
                                "&test=" + encodeURIComponent(testNumber);
                        });
                        list.appendChild(testButton);
                    });
                }
                lectureButton.insertAdjacentElement("afterend", list);
            });
            panel.appendChild(lectureButton);
        });
    }
}
