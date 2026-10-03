import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth, db, app } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { DEFAULT_STUDENTS, DEFAULT_COURSES } from "./admin-default-data.js";
import { DEFAULT_TESTS } from "./test-default-data.js";

/* =========================================================
   FJMC ADMIN
   - Students / Exam / Batch / Year / Course assignment
   - Course + lecture content
   - Lecture-wise tests + questions CRUD
   - First-attempt results / leaderboard
   - PDF export
   - Device viewer/release only; dashboard device logic untouched
========================================================= */

const ADMIN_EMAILS = ["fjmcacademy1008@gmail.com"];
const $ = id => document.getElementById(id);
let currentUser = null;
let students = {}, courses = {}, tests = {};
let editingStudentId = null, editingCourseId = null, editingTestId = null;

const secondaryApp = initializeApp(app.options, "fjmcStudentCreator");
const secondaryAuth = getAuth(secondaryApp);

function studentDocId(email){ return email.trim().toLowerCase().replaceAll("/","_"); }
function testDocId(courseId, lectureId, testNumber){
  return `${courseId}__lecture-${lectureId}__test-${testNumber}`;
}
function esc(v=""){ return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function isAdmin(user){ return !!user && ADMIN_EMAILS.includes((user.email||"").toLowerCase()); }
function showMsg(text,ok=false){ const el=$("loginMsg"); el.textContent=text; el.className="notice "+(ok?"success":"error"); el.classList.remove("hidden"); }

onAuthStateChanged(auth, async user=>{
  if(!user){ $("loginView").classList.remove("hidden"); $("app").classList.add("hidden"); return; }
  if(!isAdmin(user)){ showMsg("This Firebase account is not authorized as admin."); await signOut(auth); return; }
  currentUser=user; $("loginView").classList.add("hidden"); $("app").classList.remove("hidden");
  try{ await refreshAll(); }catch(e){ console.error(e); alert("Admin data load failed: "+(e.message||e.code)); }
});

$("adminLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  showMsg("Signing in...",true);
  try{ await signInWithEmailAndPassword(auth,$("adminEmail").value.trim().toLowerCase(),$("adminPassword").value); }
  catch(err){
    const c=err?.code||"";
    showMsg(c==="auth/invalid-credential"||c==="auth/wrong-password"?"Incorrect admin email or password.":c==="auth/user-not-found"?"Firebase Authentication account does not exist.":c==="auth/invalid-email"?"Enter a valid email.":c==="auth/too-many-requests"?"Too many attempts. Try later.":"Admin login failed: "+(err?.message||"Unknown error"));
  }
});
$("logoutBtn").onclick=()=>signOut(auth);

document.querySelectorAll(".side button").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".side button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  $(btn.dataset.section).classList.add("active");
  if(btn.dataset.section==="devices") loadDevices();
  if(btn.dataset.section==="tests") renderTestList();
  if(btn.dataset.section==="results") refreshResults();
});

async function loadData(){
  const [ss,cs,ts]=await Promise.all([
    getDocs(collection(db,"students")),
    getDocs(collection(db,"courses")),
    getDocs(collection(db,"tests"))
  ]);
  students={}; courses={}; tests={};
  ss.forEach(d=>students[d.id]=d.data());
  cs.forEach(d=>courses[d.id]=d.data());
  ts.forEach(d=>tests[d.id]=d.data());
}
async function refreshAll(){
  await loadData();
  renderStudentFilters(); renderCourseFilters();
  renderStudents(); renderCourses(); renderCourseChecklist(); renderTestCourseSelect();
  renderTestList(); await refreshResults();
}

/* ================= ADMIN SEARCH / FILTERS ================= */
["studentSearch","studentExamFilter","studentBatchFilter","studentYearFilter"].forEach(id=>{
  const el=$(id); if(el) el.addEventListener(el.tagName==="INPUT"?"input":"change",renderStudents);
});
["courseSearch","courseExamFilter","courseBatchFilter","courseYearFilter"].forEach(id=>{
  const el=$(id); if(el) el.addEventListener(el.tagName==="INPUT"?"input":"change",renderCourses);
});
$("assignCourseSearch")?.addEventListener("input",renderCourseChecklist);
$("clearStudentFilters")?.addEventListener("click",()=>{
  $("studentSearch").value=""; $("studentExamFilter").value=""; $("studentBatchFilter").value=""; $("studentYearFilter").value=""; renderStudents();
});
$("clearCourseFilters")?.addEventListener("click",()=>{
  $("courseSearch").value=""; $("courseExamFilter").value=""; $("courseBatchFilter").value=""; $("courseYearFilter").value=""; renderCourses();
});

/* ================= STUDENTS ================= */
function renderCourseChecklist(){
  const q=($("assignCourseSearch")?.value||"").trim().toLowerCase();
  const checked=new Set([...document.querySelectorAll("#courseChecklist input:checked")].map(x=>x.value));
  const rows=Object.entries(courses).filter(([id,c])=>{
    const hay=[id,c.title,c.subject,c.exam,c.batch,c.year].map(x=>String(x||"").toLowerCase()).join(" ");
    return !q || hay.includes(q);
  });
  $("courseChecklist").innerHTML=rows.map(([id,c])=>`<label class="check"><input type="checkbox" value="${esc(id)}" ${checked.has(id)?"checked":""}> ${esc(c.title||id)} <span class="small">(${esc(c.exam||"")} • ${esc(c.batch||"")} • ${esc(c.year||"")})</span></label>`).join("")||'<div class="small">No matching courses.</div>';
}
function uniqueSorted(values){
  return [...new Set(values.map(v=>String(v??"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));
}
function fillFilter(id, values, allLabel){
  const el=$(id); if(!el) return;
  const old=el.value;
  el.innerHTML=`<option value="">${esc(allLabel)}</option>`+uniqueSorted(values).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if(uniqueSorted(values).includes(old)) el.value=old;
}
function renderStudentFilters(){
  fillFilter("studentExamFilter",Object.values(students).map(s=>s.exam),"All Exams");
  fillFilter("studentBatchFilter",Object.values(students).map(s=>s.batch),"All Batches");
  fillFilter("studentYearFilter",Object.values(students).map(s=>s.year),"All Years");
}
function renderStudents(){
  $("statStudents").textContent=Object.keys(students).length;
  const q=($("studentSearch")?.value||"").trim().toLowerCase();
  const exam=$("studentExamFilter")?.value||"", batch=$("studentBatchFilter")?.value||"", year=$("studentYearFilter")?.value||"";
  const rows=Object.entries(students).filter(([id,s])=>{
    const hay=[id,s.name,s.email,s.exam,s.batch,s.year].map(x=>String(x||"").toLowerCase()).join(" ");
    return (!q||hay.includes(q))&&(!exam||s.exam===exam)&&(!batch||s.batch===batch)&&(!year||String(s.year||"")===String(year));
  });
  $("studentsTable").innerHTML=`<div class="small" style="margin-bottom:8px">Showing ${rows.length} of ${Object.keys(students).length} students</div>`+
    (rows.length?`<table class="table"><tr><th>Student</th><th>Exam / Batch / Year</th><th>Courses</th><th>Actions</th></tr>`+
    rows.map(([id,s])=>`<tr><td><b>${esc(s.name)}</b><br><span class="small">${esc(s.email||id)}</span></td>
    <td>${esc(s.exam||"")}<br>${esc(s.batch||"")} • ${esc(s.year||"")}</td>
    <td>${(s.courses||[]).map(x=>`<span class="pill">${esc(courses[x]?.title||x)}</span>`).join("")}</td>
    <td><button class="btn muted" data-edit-student="${esc(id)}">Edit</button>
    <button class="btn danger" data-delete-student="${esc(id)}">Delete</button></td></tr>`).join("")+`</table>`:'<p class="small">No students match the selected filters.</p>');
  document.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));
  document.querySelectorAll("[data-delete-student]").forEach(b=>b.onclick=()=>deleteStudent(b.dataset.deleteStudent));
}
function editStudent(id){
  const s=students[id]; editingStudentId=id;
  $("sEmail").value=s.email||id; $("sName").value=s.name||""; $("sExam").value=s.exam||"";
  $("sBatch").value=s.batch||""; $("sYear").value=s.year||""; $("sPassword").value="";
  document.querySelectorAll("#courseChecklist input").forEach(x=>x.checked=(s.courses||[]).includes(x.value));
  document.querySelector('[data-section="students"]').click(); window.scrollTo({top:0,behavior:"smooth"});
}
function clearStudent(){ editingStudentId=null; $("studentForm").reset(); document.querySelectorAll("#courseChecklist input").forEach(x=>x.checked=false); }
$("newStudentBtn").onclick=clearStudent;
$("studentForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("sEmail").value.trim().toLowerCase(), password=$("sPassword").value||"", id=studentDocId(email);
  const selected=[...document.querySelectorAll("#courseChecklist input:checked")].map(x=>x.value), wasEditing=!!editingStudentId;
  try{
    if(!wasEditing && password){
      if(password.length<6) throw new Error("Student password must be at least 6 characters.");
      try{ await createUserWithEmailAndPassword(secondaryAuth,email,password); }
      catch(a){ if(a.code!=="auth/email-already-in-use") throw a; }
    }
    await setDoc(doc(db,"students",id),{email,name:$("sName").value.trim(),exam:$("sExam").value.trim(),batch:$("sBatch").value.trim(),year:$("sYear").value.trim(),courses:selected,updatedAt:serverTimestamp()},{merge:true});
    await loadData(); renderStudentFilters(); renderCourseFilters(); renderStudents(); renderCourses(); renderCourseChecklist(); clearStudent();
    alert(wasEditing?"Student profile updated.":"Student saved successfully.");
  }catch(err){ console.error(err); alert("Could not save student: "+(err.message||err.code||"Unknown error")); }
};
async function deleteStudent(id){
  if(!confirm("Delete this student profile? Firebase Authentication account will NOT be deleted.")) return;
  await deleteDoc(doc(db,"students",id)); await loadData(); renderStudentFilters(); renderStudents();
}

/* ================= COURSES ================= */
function addContentRow(item={type:"video",title:"",url:"",lectureId:"1",lectureTitle:"Lecture 1"}){
  const row=document.createElement("div"); row.className="content-row";
  row.style.gridTemplateColumns="90px 150px 1fr 1fr auto";
  row.innerHTML=`<label>Lecture<input class="ct-lecture" type="number" min="1"></label><label>Type<select class="ct-type"><option value="material">Material</option><option value="video">YouTube Video</option><option value="local-video">Local Video</option><option value="pdf">PDF</option><option value="live">Live Class</option></select></label><label>Title<input class="ct-title"></label><label>URL<input class="ct-url"></label><button type="button" class="btn danger remove-content">×</button>`;
  row.querySelector(".ct-lecture").value=item.lectureId||"1"; row.querySelector(".ct-type").value=item.type||"video"; row.querySelector(".ct-title").value=item.title||""; row.querySelector(".ct-url").value=item.url||"";
  row.querySelector(".remove-content").onclick=()=>row.remove(); $("contentsEditor").appendChild(row);
}
$("addContentBtn").onclick=()=>addContentRow();
function clearCourse(){ editingCourseId=null; $("courseForm").reset(); $("contentsEditor").innerHTML=""; addContentRow(); }
$("newCourseBtn").onclick=clearCourse;
function editCourse(id){
  const c=courses[id]; editingCourseId=id; $("cId").value=id; $("cExam").value=c.exam||""; $("cBatch").value=c.batch||"";
  $("cYear").value=c.year||""; $("cSubject").value=c.subject||""; $("cTitle").value=c.title||""; $("cDescription").value=c.description||"";
  $("cTestId").value=c.testId||""; $("contentsEditor").innerHTML=""; (c.contents||[]).forEach(addContentRow); if(!(c.contents||[]).length)addContentRow();
  document.querySelector('[data-section="courses"]').click(); window.scrollTo({top:0,behavior:"smooth"});
}
function renderCourseFilters(){
  fillFilter("courseExamFilter",Object.values(courses).map(c=>c.exam),"All Exams");
  fillFilter("courseBatchFilter",Object.values(courses).map(c=>c.batch),"All Batches");
  fillFilter("courseYearFilter",Object.values(courses).map(c=>c.year),"All Years");
}
function renderCourses(){
  $("statCourses").textContent=Object.keys(courses).length;
  const q=($("courseSearch")?.value||"").trim().toLowerCase();
  const exam=$("courseExamFilter")?.value||"", batch=$("courseBatchFilter")?.value||"", year=$("courseYearFilter")?.value||"";
  const rows=Object.entries(courses).filter(([id,c])=>{
    const hay=[id,c.title,c.subject,c.description,c.exam,c.batch,c.year].map(x=>String(x||"").toLowerCase()).join(" ");
    return (!q||hay.includes(q))&&(!exam||c.exam===exam)&&(!batch||c.batch===batch)&&(!year||String(c.year||"")===String(year));
  });
  $("coursesTable").innerHTML=`<div class="small" style="margin-bottom:8px">Showing ${rows.length} of ${Object.keys(courses).length} courses</div>`+
    (rows.length?`<table class="table"><tr><th>Course</th><th>Exam / Batch / Year</th><th>Content</th><th>Actions</th></tr>`+
    rows.map(([id,c])=>`<tr><td><b>${esc(c.title||id)}</b><br><span class="small">${esc(c.subject||"")} · ${esc(id)}</span></td>
    <td>${esc(c.exam||"")}<br>${esc(c.batch||"")} • ${esc(c.year||"")}</td><td>${(c.contents||[]).length} items</td>
    <td><button class="btn muted" data-edit-course="${esc(id)}">Edit</button> <button class="btn danger" data-delete-course="${esc(id)}">Delete</button></td></tr>`).join("")+`</table>`:'<p class="small">No courses match the selected filters.</p>');
  document.querySelectorAll("[data-edit-course]").forEach(b=>b.onclick=()=>editCourse(b.dataset.editCourse));
  document.querySelectorAll("[data-delete-course]").forEach(b=>b.onclick=()=>deleteCourse(b.dataset.deleteCourse));
}
$("courseForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("cId").value.trim();
  const contents=[...document.querySelectorAll("#contentsEditor .content-row")].map(r=>({lectureId:String(r.querySelector(".ct-lecture")?.value||"1").trim(),type:r.querySelector(".ct-type").value,title:r.querySelector(".ct-title").value.trim(),url:r.querySelector(".ct-url").value.trim()})).filter(x=>x.title||x.url);
  await setDoc(doc(db,"courses",id),{exam:$("cExam").value.trim(),batch:$("cBatch").value.trim(),year:$("cYear").value.trim(),subject:$("cSubject").value.trim(),title:$("cTitle").value.trim(),description:$("cDescription").value.trim(),testId:$("cTestId").value.trim()||id,contents,updatedAt:serverTimestamp()},{merge:true});
  await loadData(); renderStudentFilters(); renderCourseFilters(); renderStudents(); renderCourses(); renderCourseChecklist(); clearCourse(); alert("Course saved.");
};
async function deleteCourse(id){
  if(!confirm("Delete this course? Student assignments containing this ID will remain until edited."))return;
  await deleteDoc(doc(db,"courses",id)); await loadData(); renderStudentFilters(); renderCourseFilters(); renderStudents(); renderCourses(); renderCourseChecklist();
}

/* ================= TEST MANAGEMENT ================= */
function renderTestCourseSelect(){
  const sel=$("tCourse");
  const old=sel.value;
  sel.innerHTML='<option value="">Select course</option>'+Object.entries(courses).map(([id,c])=>
    `<option value="${esc(id)}">${esc(c.exam||"")} • ${esc(c.batch||"")} • ${esc(c.year||"")} • ${esc(c.subject||c.title||id)}</option>`).join("");
  if(old && courses[old]) sel.value=old;
}
function questionRow(q={}, index){
  const opts=Array.isArray(q.options)?q.options:[];
  const row=document.createElement("div"); row.className="question-editor";
  row.innerHTML=`<div class="qhead"><b>Question <span class="qnum"></span></b><button type="button" class="btn danger remove-q">Delete Question</button></div>
  <label>Question<textarea class="q-text"></textarea></label>
  <div class="grid"><label>Option A<input class="q-opt"></label><label>Option B<input class="q-opt"></label><label>Option C<input class="q-opt"></label><label>Option D<input class="q-opt"></label></div>
  <div class="grid"><label>Correct option<select class="q-correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label>
  <label>Explanation / Solution<textarea class="q-solution"></textarea></label></div>`;
  row.querySelector(".q-text").value=q.question||"";
  row.querySelectorAll(".q-opt").forEach((el,i)=>el.value=opts[i]?.text||"");
  const ci=opts.findIndex(o=>o.correct===true); row.querySelector(".q-correct").value=String(ci>=0?ci:0);
  row.querySelector(".q-solution").value=opts[ci>=0?ci:0]?.solution||q.solution||"";
  row.querySelector(".remove-q").onclick=()=>{row.remove(); renumberQuestions();};
  $("questionsEditor").appendChild(row); renumberQuestions();
}
function renumberQuestions(){ document.querySelectorAll(".question-editor").forEach((r,i)=>r.querySelector(".qnum").textContent=i+1); }
$("addQuestionBtn").onclick=()=>questionRow();
function clearTest(){
  editingTestId=null; $("testForm").reset(); $("questionsEditor").innerHTML=""; $("tLecture").value="1"; $("tTestNumber").value="1"; $("tDuration").value="30";
}
function collectQuestions(){
  return [...document.querySelectorAll(".question-editor")].map(r=>{
    const texts=[...r.querySelectorAll(".q-opt")].map(x=>x.value.trim());
    const ci=Number(r.querySelector(".q-correct").value);
    const solution=r.querySelector(".q-solution").value.trim();
    return {question:r.querySelector(".q-text").value.trim(),options:texts.map((text,i)=>({text,correct:i===ci,solution:i===ci?solution:""}))};
  }).filter(q=>q.question || q.options.some(o=>o.text));
}
function editTest(id){
  const t=tests[id]; editingTestId=id;
  $("tCourse").value=t.courseId||""; $("tLecture").value=t.lectureId||"1"; $("tLectureTitle").value=t.lectureTitle||"Lecture "+(t.lectureId||"1");
  $("tTestNumber").value=t.testNumber||"1"; $("tTitle").value=t.title||""; $("tDuration").value=t.duration||30;
  $("questionsEditor").innerHTML=""; (t.questions||[]).forEach(questionRow); if(!(t.questions||[]).length)questionRow();
  document.querySelector('[data-section="tests"]').click(); window.scrollTo({top:0,behavior:"smooth"});
}
function renderTestList(){
  const entries=Object.entries(tests).sort((a,b)=>(a[1].courseId||"").localeCompare(b[1].courseId||"")||Number(a[1].lectureId||0)-Number(b[1].lectureId||0)||Number(a[1].testNumber||0)-Number(b[1].testNumber||0));
  $("testsTable").innerHTML=`<table class="table"><tr><th>Exam / Batch / Course</th><th>Lecture</th><th>Test</th><th>Questions</th><th>Actions</th></tr>`+
  entries.map(([id,t])=>`<tr><td><b>${esc(courses[t.courseId]?.subject||courses[t.courseId]?.title||t.courseId||"")}</b><br><span class="small">${esc(courses[t.courseId]?.exam||"")} • ${esc(courses[t.courseId]?.batch||"")} • ${esc(courses[t.courseId]?.year||"")}</span></td>
  <td>${esc(t.lectureTitle||("Lecture "+t.lectureId))}</td><td>${esc(t.title||("Test "+t.testNumber))}<br><span class="small">#${esc(t.testNumber||"")}</span></td><td>${(t.questions||[]).length}</td>
  <td><button class="btn muted" data-edit-test="${esc(id)}">Edit</button> <button class="btn danger" data-delete-test="${esc(id)}">Delete</button></td></tr>`).join("")+`</table>`;
  document.querySelectorAll("[data-edit-test]").forEach(b=>b.onclick=()=>editTest(b.dataset.editTest));
  document.querySelectorAll("[data-delete-test]").forEach(b=>b.onclick=()=>deleteTest(b.dataset.deleteTest));
}
$("testForm").onsubmit=async e=>{
  e.preventDefault();
  const courseId=$("tCourse").value, lectureId=$("tLecture").value.trim(), testNumber=$("tTestNumber").value.trim();
  if(!courseId||!lectureId||!testNumber){alert("Course, Lecture and Test number are required.");return;}
  const id=testDocId(courseId,lectureId,testNumber), questions=collectQuestions();
  await setDoc(doc(db,"tests",id),{
    courseId, lectureId, lectureTitle:$("tLectureTitle").value.trim()||`Lecture ${lectureId}`,
    testNumber, title:$("tTitle").value.trim()||`${courses[courseId]?.subject||"Course"} - Lecture ${lectureId} Test - ${testNumber}`,
    duration:Number($("tDuration").value)||30, questions, updatedAt:serverTimestamp()
  },{merge:true});
  await loadData(); renderTestList(); clearTest(); alert("Test saved successfully.");
};
async function deleteTest(id){if(!confirm("Delete this test and its questions? Existing test result documents will remain."))return;await deleteDoc(doc(db,"tests",id));await loadData();renderTestList();}
$("newTestBtn").onclick=clearTest;
$("tCourse").onchange=()=>{ if(!$("tTitle").value) $("tTitle").value=courses[$("tCourse").value]?.subject||""; };

/* Import current hard-coded test.js data into Firestore */
function flattenDefaultTests(){
  const out=[];
  // The old test.js used subject IDs such as "real-analysis".
  // Each Firestore course can have a different exam/batch/year ID,
  // so copy the matching subject tests onto every actual course.
  for(const [courseId,c] of Object.entries(courses)){
    const source=DEFAULT_TESTS[c.testId] || DEFAULT_TESTS[courseId];
    if(!source) continue;
    for(const [lectureId,l] of Object.entries(source.lectures||{})){
      for(const [testNumber,t] of Object.entries(l.tests||{})){
        out.push({
          id:testDocId(courseId,lectureId,testNumber),
          courseId,
          lectureId,
          lectureTitle:l.title||`Lecture ${lectureId}`,
          testNumber,
          title:t.title||`${c.title||c.subject||"Course"} - Lecture ${lectureId} Test - ${testNumber}`,
          duration:Number(t.duration)||30,
          questions:t.questions||[]
        });
      }
    }
  }
  return out;
}
$("seedTestsBtn").onclick=async()=>{
  const arr=flattenDefaultTests();
  if(!confirm(`Import ${arr.length} existing lecture-wise tests into Firestore? Existing same IDs will be overwritten.`))return;
  for(const t of arr) await setDoc(doc(db,"tests",t.id),{...t,updatedAt:serverTimestamp()});
  await loadData(); renderTestList(); alert(`Imported ${arr.length} tests.`);
};

/* ================= RESULTS / LEADERBOARD ================= */
let allResults=[];
async function refreshResults(){
  try{
    const snap=await getDocs(collection(db,"testResults"));
    allResults=[]; snap.forEach(d=>allResults.push({id:d.id,...d.data()}));
    $("statResults").textContent=allResults.length;
    renderResults();
  }catch(e){$("resultsTable").innerHTML='<p class="small">Could not load results. Check Firestore rules.</p>';console.error(e);}
}
function renderResults(){
  const filter=($("resultStudentFilter")?.value||"").toLowerCase();
  const rows=allResults.filter(x=>!filter||(x.email||"").toLowerCase().includes(filter)||(x.name||"").toLowerCase().includes(filter));
  rows.sort((a,b)=>Number(b.submittedAt||0)-Number(a.submittedAt||0));
  $("resultsTable").innerHTML=rows.length?`<table class="table"><tr><th>Student</th><th>Exam / Batch / Course</th><th>Lecture / Test</th><th>Score</th><th>Date</th><th>PDF</th></tr>`+
  rows.map(x=>{
    const c=courses[x.course]||{}, ts=x.submittedAt?new Date(Number(x.submittedAt)).toLocaleString():"";
    return `<tr><td><b>${esc(x.name||"Student")}</b><br><span class="small">${esc(x.email||"")}</span></td>
    <td>${esc(c.exam||"")} • ${esc(c.batch||"")} • ${esc(c.year||"")}<br>${esc(c.subject||x.course||"")}</td>
    <td>Lecture ${esc(x.lecture||"")} • Test ${esc(x.testNumber||"")}</td><td><b>${esc(x.score||0)}/${esc(x.total||0)}</b><br>${esc(x.percentage||0)}%</td><td>${esc(ts)}</td>
    <td><button class="btn muted" data-pdf-result="${esc(x.id)}">PDF</button></td></tr>`;
  }).join("")+`</table>`:'<p class="small">No test results.</p>';
  document.querySelectorAll("[data-pdf-result]").forEach(b=>b.onclick=()=>downloadResultPDF(allResults.find(x=>x.id===b.dataset.pdfResult)));
}
$("refreshResultsBtn").onclick=refreshResults;
$("resultStudentFilter").addEventListener("input",renderResults);
$("clearResultsBtn").onclick=async()=>{
  if(!confirm("Delete ALL testResults documents? This cannot be undone."))return;
  for(const x of allResults) await deleteDoc(doc(db,"testResults",x.id)); await refreshResults();
};
$("downloadAllResultsBtn").onclick=()=>downloadResultsPDF(allResults);

function pdfReady(){return !!window.jspdf?.jsPDF;}
function downloadResultPDF(x){
  if(!x)return;
  if(!pdfReady()){alert("PDF library load nahi hui. Internet connection check karke page reload karein.");return;}
  const {jsPDF}=window.jspdf, pdf=new jsPDF();
  const c=courses[x.course]||{}, date=x.submittedAt?new Date(Number(x.submittedAt)).toLocaleString():"";
  let y=18;
  pdf.setFontSize(18); pdf.text("FJMC ACADEMY - TEST RESULT",14,y); y+=12;
  pdf.setFontSize(11);
  const lines=[
    `Student: ${x.name||"Student"}`,`Email: ${x.email||""}`,`Exam: ${c.exam||""}`,
    `Batch: ${c.batch||""}`,`Year: ${c.year||""}`,`Course: ${c.subject||x.course||""}`,
    `Lecture: ${x.lecture||""}`,`Test: ${x.testNumber||""}`,`Score: ${x.score||0}/${x.total||0}`,
    `Percentage: ${x.percentage||0}%`,`Submitted: ${date}`
  ];
  lines.forEach(t=>{pdf.text(String(t).slice(0,100),14,y);y+=7;});
  y+=4; pdf.setFontSize(13); pdf.text("Answer Summary",14,y); y+=8; pdf.setFontSize(9);
  (x.answers||[]).forEach((a,i)=>{ if(y>280){pdf.addPage();y=18;} pdf.text(`Q${i+1}: Selected ${Number(a.selectedIndex)>=0?String.fromCharCode(65+Number(a.selectedIndex)):"Not answered"} | Correct ${Number(a.correctIndex)>=0?String.fromCharCode(65+Number(a.correctIndex)):"-"}`,14,y);y+=6;});
  const safe=(x.name||"student").replace(/[^a-z0-9]+/gi,"_"); pdf.save(`FJMC_${safe}_L${x.lecture||""}_T${x.testNumber||""}.pdf`);
}
function downloadResultsPDF(arr){
  if(!arr.length){alert("No test results to export.");return;}
  if(!pdfReady()){alert("PDF library load nahi hui. Internet connection check karke page reload karein.");return;}
  const {jsPDF}=window.jspdf, pdf=new jsPDF(); let y=16;
  pdf.setFontSize(16); pdf.text("FJMC ACADEMY - ALL STUDENT TEST RESULTS",14,y); y+=10; pdf.setFontSize(8);
  [...arr].sort((a,b)=>Number(b.submittedAt||0)-Number(a.submittedAt||0)).forEach((x,i)=>{
    if(y>282){pdf.addPage();y=16;}
    const c=courses[x.course]||{};
    const line=`${i+1}. ${x.name||"Student"} | ${x.email||""} | ${c.exam||""} | ${c.batch||""} | ${c.year||""} | ${c.subject||x.course||""} | L${x.lecture||""} T${x.testNumber||""} | ${x.score||0}/${x.total||0} (${x.percentage||0}%)`;
    pdf.text(line.slice(0,190),14,y); y+=6;
  });
  pdf.save("FJMC_All_Student_Test_Results.pdf");
}

/* ================= DEVICES: VIEW/RELEASE ONLY ================= */
async function loadDevices(){
  const host=$("deviceStudents"); host.innerHTML="Loading...";
  try{
    const us=await getDocs(collection(db,"users")); let html="";
    for(const ud of us.docs){
      const u=ud.data(); if(!u.email)continue;
      const ds=await getDocs(collection(db,"users",ud.id,"devices"));
      html+=`<div class="card"><b>${esc(u.email)}</b>`;
      if(ds.empty)html+='<p class="small">No reserved devices.</p>';
      for(const dd of ds.docs){const x=dd.data();html+=`<div class="device"><button class="btn danger" data-release-device="${esc(ud.id)}|${esc(dd.id)}">Release</button><b>${esc(x.deviceType||"unknown")}</b><br><span class="small">Device: ${esc(dd.id)} | Expires: ${esc(x.expiresAt?new Date(Number(x.expiresAt)).toLocaleString():"-")}</span></div>`;}
      html+='</div>';
    }
    host.innerHTML=html||'<p class="small">No users/devices found. Device documents are created when students log in.</p>';
    document.querySelectorAll("[data-release-device]").forEach(b=>b.onclick=async()=>{if(confirm("Release this device reservation?")){const [uid,did]=b.dataset.releaseDevice.split("|");await deleteDoc(doc(db,"users",uid,"devices",did));loadDevices();}});
  }catch(e){host.innerHTML='<p class="small">Could not load devices. Check Firestore rules.</p>';console.error(e);}
}

/* ================= SEED EXISTING DATA ================= */
$("seedBtn").onclick=async()=>{
  if(!confirm("Import existing dashboard students and courses into Firestore? Existing same IDs will be overwritten."))return;
  for(const [email,s] of Object.entries(DEFAULT_STUDENTS)){if(ADMIN_EMAILS.includes(email.toLowerCase()))continue;await setDoc(doc(db,"students",studentDocId(email)),{...s,email,updatedAt:serverTimestamp()});}
  for(const [id,c] of Object.entries(DEFAULT_COURSES))await setDoc(doc(db,"courses",id),{...c,updatedAt:serverTimestamp()});
  await refreshAll(); alert("Existing dashboard data imported successfully.");
};

clearCourse(); clearStudent(); clearTest();
