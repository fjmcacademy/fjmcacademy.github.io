import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth, db, app } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { DEFAULT_STUDENTS, DEFAULT_COURSES } from "./admin-default-data.js";

// IMPORTANT: change this to the Firebase Authentication email(s) you want to use as admins.
const ADMIN_EMAILS = ["fjmcacademy1008@gmail.com"];

const $ = id => document.getElementById(id);
let currentUser = null;
let students = {};
let courses = {};
let editingStudentId = null;
let editingCourseId = null;
const secondaryApp = initializeApp(app.options, "fjmcStudentCreator");
const secondaryAuth = getAuth(secondaryApp);

function studentDocId(email){ return email.trim().toLowerCase().replaceAll("/","_"); }
function showMsg(text, ok=false){ const el=$("loginMsg"); el.textContent=text; el.className="notice "+(ok?"success":"error"); }
function isAdmin(user){ return user && ADMIN_EMAILS.includes((user.email||"").toLowerCase()); }
function esc(v=""){ return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

onAuthStateChanged(auth, async user=>{
  if(!user){ $("loginView").classList.remove("hidden"); $("app").classList.add("hidden"); return; }
  if(!isAdmin(user)){ showMsg("This Firebase account is not authorized as admin."); await signOut(auth); return; }
  currentUser=user; $("loginView").classList.add("hidden"); $("app").classList.remove("hidden"); $("adminUser").textContent=user.email; await refreshAll();
});

$("adminLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("adminEmail").value.trim().toLowerCase();
  const password=$("adminPassword").value;
  showMsg("Signing in...",true);
  try {
    await signInWithEmailAndPassword(auth,email,password);
  } catch(err) {
    console.error("Admin Firebase login error:",err);
    const code=err?.code||"";
    if(code==="auth/invalid-credential"||code==="auth/wrong-password") showMsg("Incorrect admin email or password.");
    else if(code==="auth/user-not-found") showMsg("This Firebase Authentication account does not exist.");
    else if(code==="auth/invalid-email") showMsg("Please enter a valid email address.");
    else if(code==="auth/too-many-requests") showMsg("Too many attempts. Please try again later.");
    else showMsg("Admin login failed: "+(err?.message||"Unknown Firebase error"));
  }
});
$("logoutBtn").onclick=()=>signOut(auth);

document.querySelectorAll(".side button").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".side button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));$(btn.dataset.section).classList.add("active");if(btn.dataset.section==="devices") loadDevices();});

async function loadData(){
  students={}; courses={};
  const [ss,cs]=await Promise.all([getDocs(collection(db,"students")),getDocs(collection(db,"courses"))]);
  ss.forEach(d=>students[d.id]=d.data()); cs.forEach(d=>courses[d.id]=d.data());
}
async function refreshAll(){await loadData();renderStudents();renderCourses();renderCourseChecklist();await refreshResults();}

function renderCourseChecklist(){
  $("courseChecklist").innerHTML=Object.entries(courses).map(([id,c])=>`<label class="check"><input type="checkbox" value="${esc(id)}"> ${esc(c.title||id)} <span class="small">(${esc(c.exam||"")} • ${esc(c.batch||"")} • ${esc(c.year||"")})</span></label>`).join("")||'<div class="small">No courses yet. Create a course first.</div>';
}
function renderStudents(){
  $("statStudents").textContent=Object.keys(students).length;
  $("studentsTable").innerHTML=`<table class="table"><tr><th>Student</th><th>Exam / Batch / Year</th><th>Courses</th><th>Actions</th></tr>`+Object.entries(students).map(([id,s])=>`<tr><td><b>${esc(s.name)}</b><br><span class="small">${esc(s.email||id)}</span></td><td>${esc(s.exam)}<br>${esc(s.batch)} • ${esc(s.year)}</td><td>${(s.courses||[]).map(x=>`<span class="pill">${esc(courses[x]?.title||x)}</span>`).join("")}</td><td><button class="btn muted" data-edit-student="${esc(id)}">Edit</button> <button class="btn danger" data-delete-student="${esc(id)}">Delete</button></td></tr>`).join("")+`</table>`;
  document.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));
  document.querySelectorAll("[data-delete-student]").forEach(b=>b.onclick=()=>deleteStudent(b.dataset.deleteStudent));
}
function editStudent(id){let s=students[id];editingStudentId=id;$("sEmail").value=s.email||id;$("sName").value=s.name||"";$("sExam").value=s.exam||"";$("sBatch").value=s.batch||"";$("sYear").value=s.year||"";document.querySelectorAll("#courseChecklist input").forEach(x=>x.checked=(s.courses||[]).includes(x.value));window.scrollTo({top:0,behavior:"smooth"});}
function clearStudent(){editingStudentId=null;$("studentForm").reset();document.querySelectorAll("#courseChecklist input").forEach(x=>x.checked=false);}
$("newStudentBtn").onclick=clearStudent;
$("studentForm").onsubmit=async e=>{
 e.preventDefault();
 const email=$("sEmail").value.trim().toLowerCase();
 const password=$("sPassword")?.value||"";
 const id=studentDocId(email);
 const selected=[...document.querySelectorAll("#courseChecklist input:checked")].map(x=>x.value);
 const wasEditing=!!editingStudentId;
 try {
  if(!wasEditing && password){
   if(password.length<6) throw new Error("Student password must be at least 6 characters.");
   try { await createUserWithEmailAndPassword(secondaryAuth,email,password); }
   catch(authErr){ if(authErr.code!=="auth/email-already-in-use") throw authErr; }
  }
  await setDoc(doc(db,"students",id),{email,name:$("sName").value.trim(),exam:$("sExam").value.trim(),batch:$("sBatch").value.trim(),year:$("sYear").value.trim(),courses:selected,updatedAt:serverTimestamp()},{merge:true});
  await loadData(); renderStudents(); renderCourseChecklist(); clearStudent();
  alert(wasEditing?"Student profile updated.":"Student saved successfully.");
 } catch(err){ console.error(err); alert("Could not save student: "+(err.message||err.code||"Unknown error")); }
};
async function deleteStudent(id){if(!confirm("Delete this student profile? Firebase Authentication account will NOT be deleted."))return;await deleteDoc(doc(db,"students",id));await loadData();renderStudents();}

function addContentRow(item={type:"video",title:"",url:""}){const row=document.createElement("div");row.className="content-row";row.innerHTML=`<label>Type<select class="ct-type"><option value="video">YouTube/Video</option><option value="local-video">Local Video</option><option value="pdf">PDF</option><option value="live">Live</option></select></label><label>Title<input class="ct-title"></label><label>URL<input class="ct-url"></label><button type="button" class="btn danger remove-content">×</button>`;row.querySelector(".ct-type").value=item.type||"video";row.querySelector(".ct-title").value=item.title||"";row.querySelector(".ct-url").value=item.url||"";row.querySelector(".remove-content").onclick=()=>row.remove();$("contentsEditor").appendChild(row);}
$("addContentBtn").onclick=()=>addContentRow();
function clearCourse(){editingCourseId=null;$("courseForm").reset();$("contentsEditor").innerHTML="";addContentRow();}
$("newCourseBtn").onclick=clearCourse;
function editCourse(id){let c=courses[id];editingCourseId=id;$("cId").value=id;$("cExam").value=c.exam||"";$("cBatch").value=c.batch||"";$("cYear").value=c.year||"";$("cSubject").value=c.subject||"";$("cTitle").value=c.title||"";$("cDescription").value=c.description||"";$("cTestId").value=c.testId||"";$("contentsEditor").innerHTML="";(c.contents||[]).forEach(addContentRow);if(!(c.contents||[]).length)addContentRow();window.scrollTo({top:0,behavior:"smooth"});}
function renderCourses(){
 $("statCourses").textContent=Object.keys(courses).length;
 $("coursesTable").innerHTML=`<table class="table"><tr><th>Course</th><th>Exam / Batch / Year</th><th>Content</th><th>Actions</th></tr>`+Object.entries(courses).map(([id,c])=>`<tr><td><b>${esc(c.title||id)}</b><br><span class="small">${esc(id)}</span></td><td>${esc(c.exam)}<br>${esc(c.batch)} • ${esc(c.year)}</td><td>${(c.contents||[]).length} items</td><td><button class="btn muted" data-edit-course="${esc(id)}">Edit</button> <button class="btn danger" data-delete-course="${esc(id)}">Delete</button></td></tr>`).join("")+`</table>`;
 document.querySelectorAll("[data-edit-course]").forEach(b=>b.onclick=()=>editCourse(b.dataset.editCourse));document.querySelectorAll("[data-delete-course]").forEach(b=>b.onclick=()=>deleteCourse(b.dataset.deleteCourse));
}
$("courseForm").onsubmit=async e=>{e.preventDefault();const id=$("cId").value.trim();const contents=[...document.querySelectorAll("#contentsEditor .content-row")].map(r=>({type:r.querySelector(".ct-type").value,title:r.querySelector(".ct-title").value.trim(),url:r.querySelector(".ct-url").value.trim()})).filter(x=>x.title||x.url);await setDoc(doc(db,"courses",id),{exam:$("cExam").value.trim(),batch:$("cBatch").value.trim(),year:$("cYear").value.trim(),subject:$("cSubject").value.trim(),title:$("cTitle").value.trim(),description:$("cDescription").value.trim(),testId:$("cTestId").value.trim()||id,contents,updatedAt:serverTimestamp()},{merge:true});await loadData();renderCourses();renderCourseChecklist();clearCourse();alert("Course saved.");};
async function deleteCourse(id){if(!confirm("Delete this course? Student assignments containing this ID will remain until you edit them."))return;await deleteDoc(doc(db,"courses",id));await loadData();renderCourses();renderCourseChecklist();}

async function refreshResults(){try{const snap=await getDocs(collection(db,"testResults"));$("statResults").textContent=snap.size;let rows=[];snap.forEach(d=>{let x=d.data();let ts=x.submittedAt?.toDate?x.submittedAt.toDate().toLocaleString():String(x.submittedAt||"");rows.push(`<div class="result-row"><div><b>${esc(x.name||"")}</b><br><span class="small">${esc(x.email||"")}</span></div><div>${esc(x.course||"")}<br><span class="small">${esc(x.testId||"")}</span></div><div>${esc(x.score||0)}/${esc(x.total||0)}</div><div>${esc(ts)}</div><button class="btn danger" data-delete-result="${esc(d.id)}">Delete</button></div>`)});$("resultsTable").innerHTML=rows.join("")||'<p class="small">No test results.</p>';document.querySelectorAll("[data-delete-result]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this result?")){await deleteDoc(doc(db,"testResults",b.dataset.deleteResult));refreshResults();}});}catch(e){$("resultsTable").innerHTML='<p class="small">Could not load results. Check Firestore rules.</p>';}}
$("refreshResultsBtn").onclick=refreshResults;
$("clearResultsBtn").onclick=async()=>{if(!confirm("Delete ALL testResults documents? This cannot be undone."))return;const snap=await getDocs(collection(db,"testResults"));for(const d of snap.docs)await deleteDoc(d.ref);await refreshResults();};

async function loadDevices(){const host=$("deviceStudents");host.innerHTML="Loading...";let html="";
// Scan users once and group matching email/device subcollections.
try{const us=await getDocs(collection(db,"users"));for(const ud of us.docs){const u=ud.data();if(!u.email)continue;const ds=await getDocs(collection(db,"users",ud.id,"devices"));html+=`<div class="card"><b>${esc(u.email)}</b>`;if(ds.empty)html+='<p class="small">No reserved devices.</p>';for(const dd of ds.docs){const x=dd.data();html+=`<div class="device"><button class="btn danger" data-release-device="${esc(ud.id)}|${esc(dd.id)}">Release</button><b>${esc(x.deviceType||"unknown")}</b><br><span class="small">Device: ${esc(dd.id)} | Expires: ${esc(x.expiresAt?new Date(Number(x.expiresAt)).toLocaleString():"-")}</span></div>`}html+='</div>';}host.innerHTML=html||'<p class="small">No users/devices found. Device documents are created when students log in.</p>';document.querySelectorAll("[data-release-device]").forEach(b=>b.onclick=async()=>{if(confirm("Release this device reservation?")){const [uid,did]=b.dataset.releaseDevice.split("|");await deleteDoc(doc(db,"users",uid,"devices",did));loadDevices();}});}catch(e){host.innerHTML='<p class="small">Could not load devices. Check Firestore rules.</p>';}}

$("seedBtn").onclick=async()=>{if(!confirm("Import the existing dashboard students and courses into Firestore? Existing documents with the same IDs will be overwritten."))return;for(const [email,s] of Object.entries(DEFAULT_STUDENTS)){if(ADMIN_EMAILS.includes(email.toLowerCase()))continue;await setDoc(doc(db,"students",studentDocId(email)),{...s,email,updatedAt:serverTimestamp()});}for(const [id,c] of Object.entries(DEFAULT_COURSES))await setDoc(doc(db,"courses",id),{...c,updatedAt:serverTimestamp()});await refreshAll();alert("Existing dashboard data imported successfully.");};
clearCourse();
