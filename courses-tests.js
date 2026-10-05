/*
  FJMC ACADEMY
  COURSES & TEST SERIES DATA
  -------------------------------------------------
  Later you can change/add items here without editing HTML.
  Put your real payment/registration URL in buyLink when ready.
*/

const WHATSAPP = "917976753219";

const courses = [
  {
    exam: "CSIR NET",
    category: "Mathematics",
    name: "Real Analysis",
    price: "₹1,999",
    duration: "Complete Course",
    mode: "Online",
    tag: "Popular",
    description: "Concept-focused preparation for Real Analysis.",
    buyLink: ""
  },
  {
    exam: "CSIR NET",
    category: "Mathematics",
    name: "Linear Algebra",
    price: "₹1,999",
    duration: "Complete Course",
    mode: "Online",
    tag: "Subject",
    description: "Structured Linear Algebra preparation for competitive exams.",
    buyLink: ""
  },
   {
    exam: "CSIR NET",
    category: "Mathematics",
    name: "Mathematics Complete Course",
    price: "₹13,999",
    duration: "Full Preparation",
    mode: "Online",
    tag: "Complete",
    description: "Focused Mathematics preparation for CSIR NET.",
    buyLink: ""
   },
  {
    exam: "IIT JAM",
    category: "Mathematics",
    name: "Calculus",
    price: "₹999",
    duration: "Complete Course",
    mode: "Online",
    tag: "Subject",
    description: "Exam-oriented Calculus concepts and practice.",
    buyLink: ""
  },
  {
    exam: "IIT JAM",
    category: "Mathematics",
    name: "Linear Algebra",
    price: "₹999",
    duration: "Complete Course",
    mode: "Online",
    tag: "Subject",
    description: "Core Linear Algebra topics for IIT JAM Mathematics.",
    buyLink: ""
  },
   {
    exam: "IIT JAM",
    category: "Mathematics",
    name: "Mathematics Complete Course",
    price: "₹10,999",
    duration: "Full Preparation",
    mode: "Online",
    tag: "Complete",
    description: "Focused Mathematics preparation for IIT JAM.",
    buyLink: ""
   },
  {
    exam: "GATE",
    category: "Mathematics",
    name: "Mathematics Complete Course",
    price: "₹13,999",
    duration: "Full Preparation",
    mode: "Online",
    tag: "Complete",
    description: "Focused Mathematics preparation for GATE.",
    buyLink: ""
  }
];

const testSeries = [
  {
    exam: "CSIR NET",
    name: "Real Analysis Test Series",
    subjects: "Real Analysis",
    tests: "10 Tests",
    price: "₹199",
    mode: "Online",
    tag: "Practice",
    buyLink: ""
  },
  {
    exam: "CSIR NET",
    name: "Linear Algebra Test Series",
    subjects: "Linear Algebra",
    tests: "10 Tests",
    price: "₹199",
    mode: "Online",
    tag: "Practice",
    buyLink: ""
  },
  {
    exam: "CSIR NET",
    name: "Mathematics Full Test Series",
    subjects: "Multiple Subjects",
    tests: "20 Tests",
    price: "₹1,499",
    mode: "Online",
    tag: "Full Series",
    buyLink: ""
  },
  {
    exam: "IIT JAM",
    name: "IIT JAM Mathematics Test Series",
    subjects: "Mathematics",
    tests: "15 Tests",
    price: "₹1,199",
    mode: "Online",
    tag: "Popular",
    buyLink: ""
  },
  {
    exam: "GATE",
    name: "GATE Mathematics Test Series",
    subjects: "Engineering Mathematics",
    tests: "15 Tests",
    price: "₹1,199",
    mode: "Online",
    tag: "Practice",
    buyLink: ""
  }
];

function waLink(productName) {
  const text = `Hello FJMC Academy, I want information about ${productName}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function createFilters(items, containerId, callback) {
  const container = document.getElementById(containerId);
  const exams = ["All Exams", ...new Set(items.map(x => x.exam))];

  container.innerHTML = exams.map((exam, i) =>
    `<button class="filter-btn ${i === 0 ? "active" : ""}" data-exam="${exam}">${exam}</button>`
  ).join("");

  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      callback(btn.dataset.exam);
    });
  });
}

function renderCourses(filter = "All Exams") {
  const grid = document.getElementById("courseGrid");
  const list = filter === "All Exams" ? courses : courses.filter(x => x.exam === filter);

  if (!list.length) {
    grid.innerHTML = `<div class="empty">No courses available for this exam yet.</div>`;
    return;
  }

  grid.innerHTML = list.map(item => `
    <article class="product-card">
      <div class="card-top">
        <span class="badge">${item.tag}</span>
        <span class="exam">${item.exam}</span>
      </div>
      <h3>${item.name}</h3>
      <div class="subject">${item.category}</div>
      <p style="color:#667085;font-size:14px;margin-top:10px">${item.description}</p>
      <div class="meta">
        <span>⏱ ${item.duration}</span>
        <span>💻 ${item.mode}</span>
        <span>📚 Subject-wise</span>
      </div>
      <div class="price-row">
        <div class="price"><small>Course Fee</small><strong>${item.price}</strong></div>
      </div>
      <div class="card-actions">
        ${item.buyLink
          ? `<a class="view-btn" href="${item.buyLink}" target="_blank" rel="noopener">View / Join</a>`
          : `<a class="view-btn" href="${waLink(item.name)}" target="_blank" rel="noopener">Enquire</a>`}
        <a class="wa-btn" href="${waLink(item.name)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </article>
  `).join("");
}

function renderTests(filter = "All Exams") {
  const grid = document.getElementById("testGrid");
  const list = filter === "All Exams" ? testSeries : testSeries.filter(x => x.exam === filter);

  if (!list.length) {
    grid.innerHTML = `<div class="empty">No test series available for this exam yet.</div>`;
    return;
  }

  grid.innerHTML = list.map(item => `
    <article class="product-card">
      <div class="card-top">
        <span class="badge">${item.tag}</span>
        <span class="exam">${item.exam}</span>
      </div>
      <h3>${item.name}</h3>
      <div class="subject">${item.subjects}</div>
      <div class="meta">
        <span>📝 ${item.tests}</span>
        <span>💻 ${item.mode}</span>
        <span>🏆 Leaderboard</span>
      </div>
      <div class="price-row">
        <div class="price"><small>Test Series Fee</small><strong>${item.price}</strong></div>
      </div>
      <div class="card-actions">
        ${item.buyLink
          ? `<a class="view-btn" href="${item.buyLink}" target="_blank" rel="noopener">View / Join</a>`
          : `<a class="view-btn" href="${waLink(item.name)}" target="_blank" rel="noopener">Enquire</a>`}
        <a class="wa-btn" href="${waLink(item.name)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </article>
  `).join("");
}

createFilters(courses, "courseFilters", renderCourses);
createFilters(testSeries, "testFilters", renderTests);
renderCourses();
renderTests();
