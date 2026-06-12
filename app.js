
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const storeKey = "studyflash_ai_v1";
let db = load();
let draftCards = [];
let currentStudy = null;
let currentQuiz = null;
let deferredPrompt = null;

function load(){ return JSON.parse(localStorage.getItem(storeKey) || '{"decks":[],"xp":0,"settings":{"workerUrl":""}}'); }
function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); refresh(); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function today(){ return new Date().toISOString().slice(0,10); }
function dueDate(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

window.addEventListener("beforeinstallprompt", e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden");});
$("#installBtn").onclick=()=> deferredPrompt?.prompt();

if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

$$(".tab").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
function showView(v){ $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v)); $$(".view").forEach(x=>x.classList.toggle("active",x.id===v)); refresh(); }

function refresh(){
  $("#deckCount").textContent=db.decks.length;
  $("#cardCount").textContent=db.decks.reduce((a,d)=>a+d.cards.length,0);
  $("#dueCount").textContent=db.decks.flatMap(d=>d.cards).filter(c=>(c.due||today())<=today()).length;
  $("#xpCount").textContent=db.xp||0;
  $("#workerUrl").value=db.settings.workerUrl||"";
  renderDecks(); fillSelects(); renderStats();
}
function renderDecks(){
  const box=$("#deckList"); box.innerHTML="";
  if(!db.decks.length){ box.innerHTML='<div class="item">Ancora nessun mazzo. Vai su “Crea”.</div>'; return; }
  db.decks.slice().reverse().forEach(d=>{
    const due=d.cards.filter(c=>(c.due||today())<=today()).length;
    box.insertAdjacentHTML("beforeend",`<div class="item"><b>${esc(d.name)}</b><div class="small">${d.topic||""} • ${d.cards.length} schede • ${due} da ripassare</div><button class="secondary" onclick="deleteDeck('${d.id}')">Elimina</button></div>`);
  });
}
function deleteDeck(id){ if(confirm("Eliminare questo mazzo?")){ db.decks=db.decks.filter(d=>d.id!==id); save(); } }
window.deleteDeck=deleteDeck;

function fillSelects(){
  ["studyDeckSelect","quizDeckSelect"].forEach(id=>{
    const s=$("#"+id); const old=s.value; s.innerHTML=db.decks.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("");
    if(old) s.value=old;
  });
}

$("#readFileBtn").onclick=async()=>{
  const f=$("#fileInput").files[0]; if(!f) return alert("Scegli un file.");
  $("#fileStatus").textContent="Lettura in corso...";
  try{
    let text="";
    if(f.type==="application/pdf" || f.name.toLowerCase().endsWith(".pdf")) text=await readPdf(f);
    else if(f.type.startsWith("image/")) text=await readImage(f);
    else text=await f.text();
    $("#sourceText").value=($("#sourceText").value+"\n"+text).trim();
    $("#fileStatus").textContent="File letto correttamente.";
  }catch(e){ $("#fileStatus").textContent="Errore lettura file: "+e.message; }
};

async function readPdf(file){
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  let out="";
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    out += content.items.map(x=>x.str).join(" ")+"\n";
  }
  return out;
}
async function readImage(file){
  const res=await Tesseract.recognize(file,"ita+eng",{ logger:m=>$("#fileStatus").textContent=`OCR immagine: ${Math.round((m.progress||0)*100)}%` });
  return res.data.text;
}

$("#localGenerateBtn").onclick=()=>{
  const text=$("#sourceText").value.trim(); if(!text) return alert("Inserisci testo.");
  draftCards = draftCards.concat(localCards(text));
  renderPreview();
};
$("#aiGenerateBtn").onclick=async()=>{
  const text=$("#sourceText").value.trim(); if(!text) return alert("Inserisci testo.");
  const url=(db.settings.workerUrl||"").trim();
  if(!url) return alert("Inserisci prima l'URL del Cloudflare Worker nelle Impostazioni.");
  $("#fileStatus").textContent="Generazione AI in corso...";
  try{
    const r=await fetch(url+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text, topic:$("#deckTopic").value, count:12})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Errore AI");
    draftCards=draftCards.concat(data.cards.map(c=>({id:uid(),q:c.question,a:c.answer,due:today(),box:0,ok:0,ko:0})));
    renderPreview();
    $("#fileStatus").textContent="Flashcard generate.";
  }catch(e){ $("#fileStatus").textContent="Errore AI: "+e.message; }
};
function localCards(text){
  const parts=text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>60).slice(0,12);
  return parts.map((p,i)=>({id:uid(),q:`Spiega questo concetto ${i+1}`,a:p,due:today(),box:0,ok:0,ko:0}));
}

$("#addManualBtn").onclick=()=>{
  const q=$("#manualQ").value.trim(), a=$("#manualA").value.trim();
  if(!q||!a) return alert("Inserisci domanda e risposta.");
  draftCards.push({id:uid(),q,a,due:today(),box:0,ok:0,ko:0});
  $("#manualQ").value=""; $("#manualA").value=""; renderPreview();
};
function renderPreview(){
  const box=$("#previewCards"); box.innerHTML="";
  draftCards.forEach((c,i)=>box.insertAdjacentHTML("beforeend",`<div class="item"><b>${i+1}. ${esc(c.q)}</b><div class="small">${esc(c.a)}</div><button class="secondary" onclick="removeDraft(${i})">Rimuovi</button></div>`));
}
window.removeDraft=i=>{draftCards.splice(i,1);renderPreview();};

$("#saveDeckBtn").onclick=()=>{
  const name=$("#deckName").value.trim()||"Nuovo mazzo";
  if(!draftCards.length) return alert("Non ci sono flashcard da salvare.");
  db.decks.push({id:uid(),name,topic:$("#deckTopic").value.trim(),created:new Date().toISOString(),cards:draftCards});
  draftCards=[]; $("#deckName").value=""; $("#deckTopic").value=""; $("#sourceText").value=""; renderPreview(); save(); showView("home");
};

$("#startStudyBtn").onclick=()=>{
  const d=db.decks.find(x=>x.id===$("#studyDeckSelect").value); if(!d) return;
  const due=d.cards.filter(c=>(c.due||today())<=today());
  currentStudy={deck:d,queue:due.length?due:[...d.cards],card:null};
  nextStudy();
};
function nextStudy(){
  const c=currentStudy.queue.shift();
  if(!c){ $("#studyBox").classList.add("hidden"); alert("Ripasso completato!"); save(); return; }
  currentStudy.card=c; $("#studyBox").classList.remove("hidden"); $("#flipCard").classList.remove("show");
  $("#studyQuestion").textContent=c.q; $("#studyAnswer").textContent=c.a; $("#ratingBtns").classList.add("hidden");
}
$("#showAnswerBtn").onclick=()=>{ $("#flipCard").classList.add("show"); $("#ratingBtns").classList.remove("hidden"); };
$("#flipCard").onclick=()=>$("#flipCard").classList.toggle("show");
$$("[data-rate]").forEach(b=>b.onclick=()=>{
  const c=currentStudy.card; const r=b.dataset.rate;
  const days = r==="hard"?1:r==="medium"?3:7;
  c.due=dueDate(days); c.box=(c.box||0)+(r==="easy"?2:r==="medium"?1:0); c.ok=(c.ok||0)+1; db.xp=(db.xp||0)+(r==="easy"?10:r==="medium"?7:4);
  save(); nextStudy();
});
$("#speakBtn").onclick=()=>speak($("#flipCard").classList.contains("show")?$("#studyAnswer").textContent:$("#studyQuestion").textContent);
function speak(t){ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang="it-IT"; speechSynthesis.speak(u); }

$("#startQuizBtn").onclick=()=>{
  const d=db.decks.find(x=>x.id===$("#quizDeckSelect").value); if(!d||d.cards.length<2) return alert("Servono almeno 2 flashcard.");
  currentQuiz={deck:d,items:[...d.cards].sort(()=>Math.random()-0.5),score:0,total:0};
  $("#quizBox").classList.remove("hidden"); nextQuiz();
};
function nextQuiz(){
  const c=currentQuiz.items.shift(); if(!c){ alert(`Quiz finito. Punteggio: ${currentQuiz.score}/${currentQuiz.total}`); $("#quizBox").classList.add("hidden"); save(); return; }
  currentQuiz.card=c; currentQuiz.total++;
  $("#quizQuestion").textContent=c.q; $("#quizFeedback").textContent=""; $("#nextQuizBtn").classList.add("hidden");
  const wrong=currentQuiz.deck.cards.filter(x=>x.id!==c.id).sort(()=>Math.random()-0.5).slice(0,3).map(x=>x.a);
  const opts=[c.a,...wrong].sort(()=>Math.random()-0.5);
  $("#quizOptions").innerHTML=opts.map(o=>`<button class="option">${esc(o)}</button>`).join("");
  $$("#quizOptions .option").forEach(b=>b.onclick=()=>answerQuiz(b,b.textContent===c.a));
}
function answerQuiz(btn,ok){
  $$("#quizOptions .option").forEach(b=>b.disabled=true);
  btn.classList.add(ok?"correct":"wrong");
  $("#quizFeedback").textContent=ok?"Risposta esatta!":"Risposta errata. Risposta corretta: "+currentQuiz.card.a;
  if(ok){ currentQuiz.score++; db.xp=(db.xp||0)+5; }
  $("#nextQuizBtn").classList.remove("hidden");
}
$("#nextQuizBtn").onclick=nextQuiz;

function renderStats(){
  const total=db.decks.reduce((a,d)=>a+d.cards.length,0);
  const reviewed=db.decks.flatMap(d=>d.cards).reduce((a,c)=>a+(c.ok||0)+(c.ko||0),0);
  $("#statsBox").innerHTML=`<div class="grid cards"><div class="card"><b>${total}</b><span>schede totali</span></div><div class="card"><b>${reviewed}</b><span>ripassi</span></div><div class="card"><b>${db.xp||0}</b><span>XP</span></div><div class="card"><b>${Math.floor((db.xp||0)/100)+1}</b><span>livello</span></div></div>`;
}

$("#saveSettingsBtn").onclick=()=>{db.settings.workerUrl=$("#workerUrl").value.trim().replace(/\/$/,""); save(); alert("Impostazioni salvate.");};
$("#exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="studyflash-backup.json"; a.click();
};
$("#importBtn").onclick=async()=>{
  const f=$("#importInput").files[0]; if(!f) return alert("Scegli backup JSON.");
  db=JSON.parse(await f.text()); save(); alert("Backup importato.");
};
$("#resetBtn").onclick=()=>{ if(confirm("Cancellare tutti i dati?")){ localStorage.removeItem(storeKey); db=load(); save(); } };

function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
refresh();
