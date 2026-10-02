import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from "./firebase.js";

const id=new URLSearchParams(location.search).get("series");
const head=document.getElementById("head"), box=document.getElementById("subjects");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

async function courseList(series){
  const all=await getDocs(collection(db,"courses"));
  const rows=[]; all.forEach(d=>rows.push({id:d.id,...d.data()}));
  if(Array.isArray(series.courseIds)&&series.courseIds.length){
    const wanted=new Set(series.courseIds.map(String));
    return rows.filter(c=>wanted.has(String(c.id)));
  }
  return rows.filter(c=>String(c.exam||"").toLowerCase()===String(series.exam||"").toLowerCase()
    &&String(c.year||"")===String(series.year||"")
    &&String(c.batch||"")===String(series.batch||""));
}

async function getTestsForCourse(course){
  let data=null;
  try{
    const snap=await getDoc(doc(db,"tests",course.testId||course.id));
    if(snap.exists()) data=snap.data();
  }catch(e){console.warn(e);}
  if(!data){
    try{const m=await import("./test-default-data.js"); data=m.TESTS[course.testId||course.id]||null;}catch(e){console.warn(e);}
  }
  const out=[];
  if(data?.lectures){
    Object.entries(data.lectures).forEach(([lid,lec])=>{
      Object.entries(lec.tests||{}).forEach(([tn,t])=>out.push({lecture:lid,test:tn,title:t.title||`Test ${tn}`,duration:t.duration}));
    });
  }else if(Array.isArray(data?.tests)){
    data.tests.forEach((t,i)=>out.push({lecture:"",test:String(i+1),title:t.title||`Test ${i+1}`,duration:t.duration}));
  }else if(Array.isArray(data?.questions)){
    out.push({lecture:"",test:"1",title:data.title||"Test 1",duration:data.duration});
  }
  return out;
}

try{
  const sSnap=await getDoc(doc(db,"testSeries",id));
  let series=sSnap.exists()?sSnap.data():null;
  if(!series){
    const all=await getDocs(collection(db,"courses"));
    const rows=[]; all.forEach(d=>rows.push({id:d.id,...d.data()}));
    const parts=String(id||"").split("|");
    const [exam,year,batch]=parts;
    series={title:`${exam||"Exam"} ${year||""} - ${batch||""} Test Series`,exam,year,batch,courseIds:rows.filter(c=>String(c.exam||"").toLowerCase()===String(exam||"").toLowerCase()&&String(c.year||"")===String(year||"")&&String(c.batch||"")===String(batch||"")).map(c=>c.id)};
  }
  const price=series.price===undefined||series.price===null||series.price===""?"Price set by Admin":`₹${esc(series.price)}`;
  head.innerHTML=`<div class="exam-title"><h1>${esc(series.title||"Paid Test Series")}</h1><div class="meta"><b>Exam:</b> ${esc(series.exam||"—")} &nbsp; | &nbsp; <b>Year:</b> ${esc(series.year||"—")} &nbsp; | &nbsp; <b>Batch:</b> ${esc(series.batch||"—")}</div><h3>${price}</h3></div>`;

  const courses=await courseList(series);
  box.innerHTML=`<h2>Exam → Subjects → Tests</h2><p class="muted">Subject par click karke uske Lecture-wise Tests dekho. Test attempt karne ke liye Student Login required hai.</p>`;
  const grid=document.createElement("div");grid.className="subject-grid";box.appendChild(grid);
  if(!courses.length){grid.innerHTML='<div class="muted">No subjects available.</div>';return;}

  for(const c of courses){
    const subject=document.createElement("div");subject.className="subject";
    subject.innerHTML=`<h3>${esc(c.title||c.subject||c.name||"Subject")}</h3><div class="muted">Click to view tests</div><div class="tests"><div class="muted">Loading tests...</div></div>`;
    const testsBox=subject.querySelector(".tests");
    subject.addEventListener("click",async()=>{
      if(testsBox.classList.contains("open")){testsBox.classList.remove("open");return;}
      testsBox.classList.add("open");
      testsBox.innerHTML='<div class="muted">Loading tests...</div>';
      const tests=await getTestsForCourse(c);
      testsBox.innerHTML="";
      if(!tests.length){testsBox.innerHTML='<div class="muted">No tests added for this subject yet.</div>';return;}
      tests.forEach(t=>{
        const row=document.createElement("div");row.className="test-row";
        const label=t.lecture?`Lecture ${esc(t.lecture)} — ${esc(t.title)}`:esc(t.title);
        row.innerHTML=`<span class="test-name">${label}</span><a class="test-btn" href="login.html">Login to Attempt</a>`;
        testsBox.appendChild(row);
      });
    });
    grid.appendChild(subject);
  }
}catch(e){console.error(e);head.innerHTML="<h2>Could not load Test Series</h2>";box.innerHTML="<p>Please try again.</p>";}
