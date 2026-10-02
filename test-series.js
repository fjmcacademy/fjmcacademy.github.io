import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { enforceFJMCDeviceRule } from "./device-guard.js";

const list = document.getElementById("seriesList");
const logoutBtn = document.getElementById("logoutBtn");
const backDashboard = document.getElementById("backDashboard");

backDashboard?.addEventListener("click", () => location.href = "dashboard.html");
logoutBtn?.addEventListener("click", async () => { await signOut(auth); location.href = "login.html"; });

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function keyFor(c){return [c.exam,c.year,c.batch].map(v=>String(v||"").trim().toLowerCase()).join("|");}

onAuthStateChanged(auth, async user => {
  if(!user){location.href="login.html";return;}
  try{
    if(!(await enforceFJMCDeviceRule(db,user))){await signOut(auth);location.href="login.html";return;}
    const email=(user.email||"").trim().toLowerCase();
    const sid=email.replaceAll("/","_");
    const studentSnap=await getDoc(doc(db,"students",sid));
    const student=studentSnap.exists()?studentSnap.data():null;
    if(!student){list.innerHTML='<div class="empty">Student profile not found.</div>';return;}

    const seriesSnap=await getDocs(collection(db,"testSeries"));
    const series=[];
    seriesSnap.forEach(s=>series.push({id:s.id,...s.data()}));

    if(!series.length){
      /* Fallback: create a visible series catalogue from the student's assigned courses. */
      const groups={};
      for(const courseId of (student.courses||[])){
        const cSnap=await getDoc(doc(db,"courses",courseId));
        if(!cSnap.exists()) continue;
        const c=cSnap.data();
        const k=keyFor(c);
        if(!groups[k]) groups[k]={id:k,title:`${c.exam||"Exam"} ${c.year||""} - ${c.batch||""} Test Series`,exam:c.exam,year:c.year,batch:c.batch,price:null,courseIds:[]};
        groups[k].courseIds.push(courseId);
      }
      Object.values(groups).forEach(x=>series.push(x));
    }

    list.innerHTML="";
    if(!series.length){list.innerHTML='<div class="empty">No test series available.</div>';return;}

    series.forEach(s=>{
      const card=document.createElement("div"); card.className="ts-card";
      const price=s.price===undefined||s.price===null||s.price===""?"Price set by Admin":`₹${esc(s.price)}`;
      card.innerHTML=`<h3>${esc(s.title||"Test Series")}</h3><div class="ts-meta"><b>Exam:</b> ${esc(s.exam||"—")}<br><b>Year:</b> ${esc(s.year||"—")}<br><b>Batch:</b> ${esc(s.batch||"—")}</div><div class="ts-price">${price}</div><button class="ts-btn">View Test Series</button>`;
      card.querySelector("button").addEventListener("click",()=>{
        const qs=new URLSearchParams({series:s.id});
        location.href=`test-series-detail.html?${qs.toString()}`;
      });
      list.appendChild(card);
    });
  }catch(e){console.error(e);list.innerHTML='<div class="empty">Test Series could not be loaded.</div>';}
});
