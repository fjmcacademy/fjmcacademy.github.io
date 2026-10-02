import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from "./firebase.js";
const id=new URLSearchParams(location.search).get("series");
const head=document.getElementById("head"), box=document.getElementById("subjects");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
try{
 const sSnap=await getDoc(doc(db,"testSeries",id)); let series=sSnap.exists()?{id,...sSnap.data()}:null;
 if(!series){head.innerHTML="<h2>Test Series not found</h2>";box.innerHTML="";throw new Error("series not found");}
 if(series.active===false){head.innerHTML="<h2>Test Series unavailable</h2>";box.innerHTML="<p>This series is currently not published.</p>";throw new Error("inactive");}
 head.innerHTML=`<div class="exam-title"><h1>${esc(series.title||"Paid Test Series")}</h1><div class="meta"><b>Exam:</b> ${esc(series.exam||"—")} &nbsp; | &nbsp; <b>Year:</b> ${esc(series.year||"—")} &nbsp; | &nbsp; <b>Batch:</b> ${esc(series.batch||"—")}</div><h3>₹${esc(series.price??"0")}</h3><p>${esc(series.description||"")}</p></div>`;
 const all=await getDocs(collection(db,"testSeriesTests")); const tests=all.docs.map(d=>({id:d.id,...d.data()})).filter(t=>String(t.seriesId)===String(id));
 box.innerHTML=`<h2>Subjects → Tests</h2><p class="muted">Ye paid Test Series ke separate tests hain. Student Dashboard ke lecture tests is list ka part nahi hain.</p>`;
 const groups={}; tests.forEach(t=>(groups[t.subject||"General"] ||= []).push(t));
 const grid=document.createElement("div");grid.className="subject-grid";box.appendChild(grid);
 Object.entries(groups).forEach(([subject,items])=>{const b=document.createElement("div");b.className="subject";b.innerHTML=`<h3>${esc(subject)}</h3><div class="tests open"></div>`;const tb=b.querySelector('.tests');items.forEach(t=>{const row=document.createElement('div');row.className='test-row';row.innerHTML=`<span class="test-name">${esc(t.title||'Test')}</span><span class="muted">${esc(t.duration||30)} min • ${t.questions?.length||0} questions</span><a class="test-btn" href="login.html?redirect=${encodeURIComponent('series-test.html?test='+t.id)}">Open Test</a>`;tb.appendChild(row);});grid.appendChild(b);});
 if(!tests.length) box.innerHTML+='<div class="muted">No tests have been added to this Test Series yet.</div>';
}catch(e){console.error(e);}
