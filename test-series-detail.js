import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { enforceFJMCDeviceRule } from "./device-guard.js";

const qs=new URLSearchParams(location.search); const seriesId=qs.get("series");
const head=document.getElementById("head"), content=document.getElementById("content");
document.getElementById("back")?.addEventListener("click",()=>location.href="test-series.html");
document.getElementById("dashboard")?.addEventListener("click",()=>location.href="dashboard.html");
document.getElementById("logout")?.addEventListener("click",async()=>{await signOut(auth);location.href="login.html";});
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

onAuthStateChanged(auth,async user=>{
 if(!user){location.href="login.html";return;}
 try{
  if(!(await enforceFJMCDeviceRule(db,user))){await signOut(auth);location.href="login.html";return;}
  const sSnap=await getDoc(doc(db,"testSeries",seriesId));
  let series=sSnap.exists()?sSnap.data():null;
  const studentId=(user.email||"").trim().toLowerCase().replaceAll("/","_");
  const stSnap=await getDoc(doc(db,"students",studentId)); const student=stSnap.exists()?stSnap.data():{};
  if(!series){
    series={title:"Test Series",exam:student.exam,year:student.year,batch:student.batch,courseIds:student.courses||[]};
  }
  head.innerHTML=`<h2>${esc(series.title||"Test Series")}</h2><div>Exam: ${esc(series.exam||"—")} &nbsp; | &nbsp; Year: ${esc(series.year||"—")} &nbsp; | &nbsp; Batch: ${esc(series.batch||"—")}</div>`;
  const ids=Array.isArray(series.courseIds)&&series.courseIds.length?series.courseIds:(student.courses||[]);
  const subjects=[];
  for(const id of ids){const snap=await getDoc(doc(db,"courses",id));if(snap.exists()){const c=snap.data();if(!subjects.some(x=>x.id===id))subjects.push({id,...c});}}
  content.innerHTML="";
  if(!subjects.length){content.innerHTML='<div class="empty">No subjects available.</div>';return;}
  const block=document.createElement("div"); block.className="exam-block"; block.innerHTML='<h2>Subjects</h2><div class="subject-grid"></div>'; content.appendChild(block); const grid=block.querySelector(".subject-grid");
  subjects.forEach(c=>{const b=document.createElement("div");b.className="subject";b.innerHTML=`<b>${esc(c.title||c.subject||"Subject")}</b><div>${esc(c.description||"")}</div><div class="tests" hidden></div>`;const testsBox=b.querySelector(".tests");b.addEventListener("click",async()=>{if(!testsBox.hidden){testsBox.hidden=true;return;} testsBox.hidden=false;testsBox.innerHTML='<div>Loading tests...</div>';let data=null;try{const s=await getDoc(doc(db,"tests",c.testId||c.id));if(s.exists())data=s.data();}catch(e){} if(!data){try{const m=await import("./test-default-data.js");data=m.TESTS[c.testId||c.id]||null;}catch(e){}} testsBox.innerHTML="";if(!data?.lectures){testsBox.innerHTML='<div>No tests available.</div>';return;}Object.entries(data.lectures).forEach(([lid,lec])=>{Object.entries(lec.tests||{}).forEach(([tn,t])=>{const x=document.createElement("button");x.className="test";x.textContent=`Lecture ${lid} — Test ${tn}${t.title?" — "+t.title:""}`;x.addEventListener("click",e=>{e.stopPropagation();location.href=`test.html?course=${encodeURIComponent(c.testId||c.id)}&lecture=${encodeURIComponent(lid)}&test=${encodeURIComponent(tn)}`});testsBox.appendChild(x);});});});grid.appendChild(b);});
 }catch(e){console.error(e);head.textContent="Could not load test series";content.innerHTML='<div class="empty">Please try again.</div>';}
});
