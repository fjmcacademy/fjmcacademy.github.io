import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from "./firebase.js";

const list=document.getElementById("seriesList");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const key=(x)=>[x.exam,x.year,x.batch].map(v=>String(v||"").trim().toLowerCase()).join("|");

async function getCourseRows(){
  const snap=await getDocs(collection(db,"courses"));
  const rows=[]; snap.forEach(d=>rows.push({id:d.id,...d.data()})); return rows;
}

try{
  const [seriesSnap,courses]=await Promise.all([getDocs(collection(db,"testSeries")),getCourseRows()]);
  const rows=[]; seriesSnap.forEach(d=>rows.push({id:d.id,...d.data()}));

  // If Admin has not created a testSeries document yet, still show the
  // same Exam/Year/Batch structure from the existing course assignments.
  if(!rows.length){
    const groups=new Map();
    courses.forEach(c=>{
      const k=key(c); if(!groups.has(k)) groups.set(k,{id:k,title:`${c.exam||"Exam"} ${c.year||""} - ${c.batch||""} Test Series`,exam:c.exam,year:c.year,batch:c.batch,price:"",courseIds:[]});
      groups.get(k).courseIds.push(c.id);
    });
    rows.push(...groups.values());
  }

  list.innerHTML="";
  if(!rows.length){list.innerHTML='<div class="empty">No paid test series available.</div>';}
  else rows.forEach(s=>{
    const price=s.price===undefined||s.price===null||s.price===""?"Price set by Admin":`₹${esc(s.price)}`;
    const card=document.createElement("article"); card.className="ts-card";
    card.innerHTML=`<h3>${esc(s.title||"Paid Test Series")}</h3>
      <div class="ts-meta"><b>Exam:</b> ${esc(s.exam||"—")}<br><b>Year:</b> ${esc(s.year||"—")}<br><b>Batch:</b> ${esc(s.batch||"—")}</div>
      <div class="ts-price">${price}</div>
      <a class="ts-btn" href="public-test-series-detail.html?series=${encodeURIComponent(s.id)}">View Test Series</a>`;
    list.appendChild(card);
  });
}catch(e){
  console.error(e);
  list.innerHTML='<div class="empty">Test Series could not be loaded. Please try again.</div>';
}
