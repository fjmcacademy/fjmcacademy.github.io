import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from "./firebase.js";
const id=new URLSearchParams(location.search).get("series");
const head=document.getElementById("head"), box=document.getElementById("subjects");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
try{
 const s=await getDoc(doc(db,"testSeries",id));
 if(!s.exists()){head.innerHTML="<h2>Test Series not found</h2>";box.innerHTML="";}
 else{
  const x=s.data(); const price=x.price===undefined||x.price===null||x.price===""?"Price set by Admin":`₹${esc(x.price)}`;
  head.innerHTML=`<h1>${esc(x.title||"Test Series")}</h1><p><b>Exam:</b> ${esc(x.exam||"—")} &nbsp; <b>Year:</b> ${esc(x.year||"—")} &nbsp; <b>Batch:</b> ${esc(x.batch||"—")}</p><h3>${price}</h3>`;
  const ids=Array.isArray(x.courseIds)?x.courseIds:[];
  const subjects=ids.map(v=>{const a=String(v).split("-"); return a.length>=5?a.slice(4).join(" ").replace(/\b\w/g,m=>m.toUpperCase()):v;});
  box.innerHTML=`<h2>Subjects / Tests</h2>${subjects.length?subjects.map(su=>`<div class="subject"><b>${esc(su)}</b><div>Tests are available after Student Login.</div></div>`).join(""):"<div class='subject'>Test details are managed by FJMC Academy.</div>"}<a class="login" href="login.html">Student Login to Access Tests</a>`;
 }
}catch(e){console.error(e);head.innerHTML="<h2>Could not load Test Series</h2>";box.innerHTML="<p>Please try again.</p>";}
