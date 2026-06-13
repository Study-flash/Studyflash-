
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const storeKey = "studyflash_ai_v1";
let db = load();
let draftCards = [];
let currentStudy = null;
let currentQuiz = null;
let deferredPrompt = null;

function load(){ return JSON.parse(localStorage.getItem(storeKey) || '{"decks":[],"xp":0,"settings":{"workerUrl":""}}'); }
function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); 
document.addEventListener("input", e=>{
  if(e.target && e.target.id==="deckSearch") renderDecks();
});

function quickStudy(id){
  showView("study");
  $("#studyDeckSelect").value=id;
  $("#startStudyBtn").click();
}
function quickManage(id){
  showView("manage");
  $("#manageDeckSelect").value=id;
  renderManage();
}
window.quickStudy=quickStudy;
window.quickManage=quickManage;

async function aiExtra(endpoint){
  const text=$("#sourceText").value.trim();
  const url=(db.settings.workerUrl||"").trim();
  if(!text) return alert("Inserisci o importa prima un testo.");
  if(!url) return alert("Inserisci prima l'URL del Cloudflare Worker nelle Impostazioni.");
  $("#aiExtraBox").textContent="Elaborazione AI in corso...";
  try{
    const r=await fetch(url+"/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text, topic:$("#deckTopic").value||"studio", count:10})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Errore AI");
    $("#aiExtraBox").textContent=data.result || JSON.stringify(data,null,2);
    if(endpoint==="generate" && data.cards){
      draftCards=draftCards.concat(data.cards.map(c=>({id:uid(),q:c.question,a:c.answer,due:today(),box:0,ok:0,ko:0})));
      renderPreview();
      $("#aiExtraBox").textContent="Aggiunte altre flashcard al mazzo.";
    }
  }catch(e){ $("#aiExtraBox").textContent="Errore AI: "+e.message; }
}
$("#aiSummaryBtn") && ($("#aiSummaryBtn").onclick=()=>aiExtra("summary"));
$("#aiExplainBtn") && ($("#aiExplainBtn").onclick=()=>aiExtra("explain"));
$("#aiMoreCardsBtn") && ($("#aiMoreCardsBtn").onclick=()=>aiExtra("generate"));

function renderManage(){
  const sel=$("#manageDeckSelect");
  const box=$("#manageCards");
  if(!sel || !box) return;
  const d=db.decks.find(x=>x.id===sel.value) || db.decks[0];
  if(!d){ box.innerHTML='<div class="item">Nessun mazzo salvato.</div>'; return; }
  sel.value=d.id;
  box.innerHTML=`
    <div class="item">
      <b>${esc(d.name)}</b>
      <div class="small">${esc(d.topic||"")} • ${d.cards.length} schede</div>
      <div class="itemActions">
        <button onclick="addCardToDeck('${d.id}')">Aggiungi scheda</button>
        <button class="secondary" onclick="renameDeck('${d.id}')">Rinomina</button>
      </div>
    </div>`;
  d.cards.forEach((c,i)=>{
    box.insertAdjacentHTML("beforeend",`
      <div class="item">
        <b>${i+1}. ${esc(c.q)}</b>
        <div class="small">${esc(c.a)}</div>
        <span class="badge">Ripasso: ${c.due||today()}</span>
        <div class="itemActions">
          <button class="secondary" onclick="editCard('${d.id}','${c.id}')">Modifica</button>
          <button class="secondary" onclick="deleteCard('${d.id}','${c.id}')">Elimina</button>
        </div>
      </div>`);
  });
}
$("#manageDeckSelect") && ($("#manageDeckSelect").onchange=renderManage);

function renameDeck(deckId){
  const d=db.decks.find(x=>x.id===deckId); if(!d) return;
  const name=prompt("Nuovo nome mazzo:", d.name);
  if(name){ d.name=name.trim(); save(); }
}
function addCardToDeck(deckId){
  const d=db.decks.find(x=>x.id===deckId); if(!d) return;
  const q=prompt("Domanda:");
  if(!q) return;
  const a=prompt("Risposta:");
  if(!a) return;
  d.cards.push({id:uid(),q,a,due:today(),box:0,ok:0,ko:0});
  save();
}
function editCard(deckId, cardId){
  const d=db.decks.find(x=>x.id===deckId); if(!d) return;
  const c=d.cards.find(x=>x.id===cardId); if(!c) return;
  const q=prompt("Modifica domanda:", c.q);
  if(!q) return;
  const a=prompt("Modifica risposta:", c.a);
  if(!a) return;
  c.q=q; c.a=a; save();
}
function deleteCard(deckId, cardId){
  const d=db.decks.find(x=>x.id===deckId); if(!d) return;
  if(confirm("Eliminare questa scheda?")){
    d.cards=d.cards.filter(c=>c.id!==cardId);
    save();
  }
}
window.renameDeck=renameDeck;
window.addCardToDeck=addCardToDeck;
window.editCard=editCard;
window.deleteCard=deleteCard;

refresh(); }
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
  renderDecks(); fillSelects(); renderStats(); renderManage();
}
function renderDecks(){
  const box=$("#deckList"); box.innerHTML="";
  const q=($("#deckSearch")?.value||"").toLowerCase();
  let decks=db.decks.slice().reverse();
  if(q){
    decks=decks.filter(d => (d.name+" "+(d.topic||"")+" "+d.cards.map(c=>c.q+" "+c.a).join(" ")).toLowerCase().includes(q));
  }
  if(!decks.length){ box.innerHTML='<div class="item">Nessun mazzo trovato.</div>'; return; }
  decks.forEach(d=>{
    const due=d.cards.filter(c=>(c.due||today())<=today()).length;
    box.insertAdjacentHTML("beforeend",`<div class="item"><b>${esc(d.name)}</b><div class="small">${d.topic||""} • ${d.cards.length} schede • ${due} da ripassare</div><span class="badge">Creato: ${(d.created||"").slice(0,10)}</span><div class="itemActions"><button onclick="quickStudy('${d.id}')">Studia</button><button class="secondary" onclick="quickManage('${d.id}')">Gestisci</button><button class="secondary" onclick="deleteDeck('${d.id}')">Elimina</button></div></div>`);
  });
}
function deleteDeck(id){ if(confirm("Eliminare questo mazzo?")){ db.decks=db.decks.filter(d=>d.id!==id); save(); } }
window.deleteDeck=deleteDeck;

function fillSelects(){
  ["studyDeckSelect","quizDeckSelect","manageDeckSelect"].forEach(id=>{
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
  const d=db.decks.find(x=>x.id===$("#studyDeckSelect").value); 
  if(!d) return alert("Scegli un mazzo.");
  const due=d.cards.filter(c=>(c.due||today())<=today());
  currentStudy={deck:d,queue:(due.length?due:[...d.cards]).sort(()=>Math.random()-0.5),card:null};
  nextStudy();
};

function nextStudy(){
  if(!currentStudy || !currentStudy.queue.length){
    $("#studyBox").classList.add("hidden");
    alert("Ripasso completato!");
    save();
    return;
  }

  const c=currentStudy.queue.shift();
  currentStudy.card=c;

  $("#studyBox").classList.remove("hidden");
  $("#flipCard").classList.remove("show");
  $("#studyQuestion").textContent=c.q || "";
  $("#studyAnswer").textContent=c.a || "";
  $("#ratingBtns").classList.add("hidden");
  $("#showAnswerBtn").textContent="Mostra risposta";
}

function showCurrentAnswer(){
  if(!currentStudy || !currentStudy.card) return;
  $("#flipCard").classList.add("show");
  $("#ratingBtns").classList.remove("hidden");
  $("#showAnswerBtn").textContent="Risposta mostrata";
}

$("#showAnswerBtn").onclick=showCurrentAnswer;

$("#flipCard").onclick=()=>{
  if(!currentStudy || !currentStudy.card) return;
  $("#flipCard").classList.toggle("show");
  if($("#flipCard").classList.contains("show")){
    $("#ratingBtns").classList.remove("hidden");
  }
};

document.addEventListener("click", e=>{
  const rateBtn=e.target.closest("[data-rate]");
  if(rateBtn){
    if(!currentStudy || !currentStudy.card) return;
    const c=currentStudy.card;
    const r=rateBtn.dataset.rate;
    const days = r==="hard" ? 1 : r==="medium" ? 3 : 7;
    c.due=dueDate(days);
    c.box=(c.box||0)+(r==="easy"?2:r==="medium"?1:0);
    c.ok=(c.ok||0)+1;
    db.xp=(db.xp||0)+(r==="easy"?10:r==="medium"?7:4);
    save();
    nextStudy();
  }

  if(e.target && e.target.id==="skipStudyBtn"){
    nextStudy();
  }
});

$("#speakBtn").onclick=()=>{
  const shown=$("#flipCard").classList.contains("show");
  speak(shown ? $("#studyAnswer").textContent : $("#studyQuestion").textContent);
};

function speak(t){
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t);
  u.lang="it-IT";
  speechSynthesis.speak(u);
}

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


/* ===== FIX V4 MAZZI: pulsanti Home + nomi mazzi + gestione stabile ===== */

function getDeckByIdSafe(id){
  return db.decks.find(d => String(d.id) === String(id));
}

function askDeckNameIfNeeded(){
  const input = document.querySelector("#deckName");
  if(!input) return "Nuovo mazzo";
  let name = input.value.trim();
  if(!name){
    name = prompt("Inserisci il nome del mazzo:", "Nuovo mazzo") || "Nuovo mazzo";
    input.value = name.trim();
  }
  return name.trim() || "Nuovo mazzo";
}

// Sovrascrive il salvataggio per obbligare/aiutare a dare un nome al mazzo.
const saveDeckBtnV4 = document.querySelector("#saveDeckBtn");
if(saveDeckBtnV4){
  saveDeckBtnV4.onclick = () => {
    const name = askDeckNameIfNeeded();
    if(!draftCards.length) return alert("Non ci sono flashcard da salvare.");
    db.decks.push({
      id: uid(),
      name,
      topic: document.querySelector("#deckTopic")?.value.trim() || "",
      created: new Date().toISOString(),
      cards: draftCards
    });
    draftCards = [];
    document.querySelector("#deckName").value = "";
    document.querySelector("#deckTopic").value = "";
    document.querySelector("#sourceText").value = "";
    renderPreview();
    save();
    showView("home");
  };
}

// Render mazzi robusto: niente onclick inline che può bloccarsi.
function renderDecks(){
  const box = document.querySelector("#deckList");
  if(!box) return;
  box.innerHTML = "";

  const q = (document.querySelector("#deckSearch")?.value || "").toLowerCase();
  let decks = db.decks.slice().reverse();

  if(q){
    decks = decks.filter(d => (
      (d.name || "") + " " +
      (d.topic || "") + " " +
      d.cards.map(c => (c.q || "") + " " + (c.a || "")).join(" ")
    ).toLowerCase().includes(q));
  }

  if(!decks.length){
    box.innerHTML = '<div class="item">Nessun mazzo trovato. Vai su “Crea” per crearne uno.</div>';
    return;
  }

  decks.forEach(d => {
    const due = d.cards.filter(c => (c.due || today()) <= today()).length;
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.deckId = d.id;
    el.innerHTML = `
      <b>${esc(d.name || "Senza nome")}</b>
      <div class="small">${esc(d.topic || "")} • ${d.cards.length} schede • ${due} da ripassare</div>
      <span class="badge">Creato: ${((d.created || "").slice(0,10)) || today()}</span>
      <div class="itemActions">
        <button type="button" class="homeStudyBtn">Studia</button>
        <button type="button" class="secondary homeManageBtn">Gestisci</button>
        <button type="button" class="secondary homeRenameBtn">Rinomina</button>
        <button type="button" class="secondary homeDeleteBtn">Elimina</button>
      </div>
    `;
    box.appendChild(el);
  });
}

document.addEventListener("click", (e) => {
  const item = e.target.closest("#deckList .item");
  if(!item) return;
  const deckId = item.dataset.deckId;

  if(e.target.closest(".homeStudyBtn")){
    const d = getDeckByIdSafe(deckId);
    if(!d) return alert("Mazzo non trovato.");
    showView("study");
    const sel = document.querySelector("#studyDeckSelect");
    if(sel) sel.value = d.id;
    setTimeout(() => document.querySelector("#startStudyBtn")?.click(), 50);
  }

  if(e.target.closest(".homeManageBtn")){
    const d = getDeckByIdSafe(deckId);
    if(!d) return alert("Mazzo non trovato.");
    showView("manage");
    const sel = document.querySelector("#manageDeckSelect");
    if(sel) sel.value = d.id;
    renderManage();
  }

  if(e.target.closest(".homeRenameBtn")){
    renameDeck(deckId);
  }

  if(e.target.closest(".homeDeleteBtn")){
    deleteDeck(deckId);
  }
});

function deleteDeck(id){
  const d = getDeckByIdSafe(id);
  if(!d) return alert("Mazzo non trovato.");
  if(confirm(`Eliminare il mazzo "${d.name || "Senza nome"}"?`)){
    db.decks = db.decks.filter(x => String(x.id) !== String(id));
    save();
  }
}
window.deleteDeck = deleteDeck;

function renameDeck(deckId){
  const d = getDeckByIdSafe(deckId);
  if(!d) return alert("Mazzo non trovato.");
  const name = prompt("Nuovo nome del mazzo:", d.name || "Senza nome");
  if(name && name.trim()){
    d.name = name.trim();
    save();
  }
}
window.renameDeck = renameDeck;

function renderManage(){
  const sel = document.querySelector("#manageDeckSelect");
  const box = document.querySelector("#manageCards");
  if(!sel || !box) return;

  const d = getDeckByIdSafe(sel.value) || db.decks[0];
  if(!d){
    box.innerHTML = '<div class="item">Nessun mazzo salvato.</div>';
    return;
  }

  sel.value = d.id;
  box.innerHTML = `
    <div class="item">
      <b>${esc(d.name || "Senza nome")}</b>
      <div class="small">${esc(d.topic || "")} • ${d.cards.length} schede</div>
      <div class="itemActions">
        <button type="button" onclick="addCardToDeck('${d.id}')">Aggiungi scheda</button>
        <button type="button" class="secondary" onclick="renameDeck('${d.id}')">Rinomina</button>
        <button type="button" class="secondary" onclick="deleteDeck('${d.id}')">Elimina mazzo</button>
      </div>
    </div>
  `;

  d.cards.forEach((c, i) => {
    box.insertAdjacentHTML("beforeend", `
      <div class="item">
        <b>${i+1}. ${esc(c.q || "")}</b>
        <div class="small">${esc(c.a || "")}</div>
        <span class="badge">Ripasso: ${c.due || today()}</span>
        <div class="itemActions">
          <button type="button" class="secondary" onclick="editCard('${d.id}','${c.id}')">Modifica</button>
          <button type="button" class="secondary" onclick="deleteCard('${d.id}','${c.id}')">Elimina</button>
        </div>
      </div>
    `);
  });
}
window.renderManage = renderManage;

const manageDeckSelectV4 = document.querySelector("#manageDeckSelect");
if(manageDeckSelectV4){
  manageDeckSelectV4.onchange = renderManage;
}

const renameSelectedDeckBtn = document.querySelector("#renameSelectedDeckBtn");
if(renameSelectedDeckBtn){
  renameSelectedDeckBtn.onclick = () => {
    const id = document.querySelector("#manageDeckSelect")?.value;
    if(id) renameDeck(id);
  };
}

function fillSelects(){
  ["studyDeckSelect","quizDeckSelect","manageDeckSelect"].forEach(id => {
    const s = document.querySelector("#"+id);
    if(!s) return;
    const old = s.value;
    s.innerHTML = db.decks.map(d => `<option value="${esc(d.id)}">${esc(d.name || "Senza nome")}</option>`).join("");
    if(old && db.decks.some(d => String(d.id) === String(old))) s.value = old;
  });
}
window.fillSelects = fillSelects;

function addCardToDeck(deckId){
  const d = getDeckByIdSafe(deckId);
  if(!d) return alert("Mazzo non trovato.");
  const q = prompt("Domanda:");
  if(!q || !q.trim()) return;
  const a = prompt("Risposta:");
  if(!a || !a.trim()) return;
  d.cards.push({id:uid(), q:q.trim(), a:a.trim(), due:today(), box:0, ok:0, ko:0});
  save();
}
window.addCardToDeck = addCardToDeck;

function editCard(deckId, cardId){
  const d = getDeckByIdSafe(deckId);
  if(!d) return alert("Mazzo non trovato.");
  const c = d.cards.find(x => String(x.id) === String(cardId));
  if(!c) return alert("Scheda non trovata.");
  const q = prompt("Modifica domanda:", c.q || "");
  if(!q || !q.trim()) return;
  const a = prompt("Modifica risposta:", c.a || "");
  if(!a || !a.trim()) return;
  c.q = q.trim();
  c.a = a.trim();
  save();
}
window.editCard = editCard;

function deleteCard(deckId, cardId){
  const d = getDeckByIdSafe(deckId);
  if(!d) return alert("Mazzo non trovato.");
  if(confirm("Eliminare questa scheda?")){
    d.cards = d.cards.filter(c => String(c.id) !== String(cardId));
    save();
  }
}
window.deleteCard = deleteCard;

document.querySelector("#deckSearch")?.addEventListener("input", renderDecks);

// Aggiorna subito interfaccia dopo il caricamento del fix.
refresh();

/* ===== V6 CLOUD D1 ===== */
function cloudSetStatus(msg){const el=document.querySelector("#cloudStatus"); if(el) el.textContent=msg;}
function getWorkerUrl(){return (db.settings?.workerUrl||document.querySelector("#workerUrl")?.value||"").trim().replace(/\/$/,"");}
async function cloudLogin(){
  const url=getWorkerUrl(), email=document.querySelector("#cloudEmail")?.value.trim(), pin=document.querySelector("#cloudPin")?.value.trim();
  if(!url) return alert("Inserisci prima l'URL del Worker.");
  if(!email||!pin) return alert("Inserisci email e PIN.");
  cloudSetStatus("Accesso al cloud in corso...");
  try{
    await fetch(url+"/db/init",{method:"POST"});
    const r=await fetch(url+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,pin,name:email.split("@")[0]})});
    const data=await r.json();
    if(!r.ok||!data.ok) throw new Error(data.error||"Errore login cloud");
    db.settings.cloudEmail=email; db.settings.userId=data.userId; save();
    cloudSetStatus("Cloud collegato correttamente.");
  }catch(e){cloudSetStatus("Errore cloud: "+e.message);}
}
async function cloudSave(){
  const url=getWorkerUrl(), userId=db.settings?.userId;
  if(!url) return alert("Inserisci l'URL del Worker.");
  if(!userId) return alert("Prima fai Accedi / crea profilo.");
  cloudSetStatus("Salvataggio online in corso...");
  try{
    const r=await fetch(url+"/cloud/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,data:db})});
    const data=await r.json();
    if(!r.ok||!data.ok) throw new Error(data.error||"Errore salvataggio cloud");
    cloudSetStatus("Dati salvati online: "+(data.updated_at||""));
  }catch(e){cloudSetStatus("Errore salvataggio: "+e.message);}
}
async function cloudLoad(){
  const url=getWorkerUrl(), userId=db.settings?.userId;
  if(!url) return alert("Inserisci l'URL del Worker.");
  if(!userId) return alert("Prima fai Accedi / crea profilo.");
  if(!confirm("Scaricare i dati dal cloud? I dati locali verranno sostituiti.")) return;
  cloudSetStatus("Download dal cloud in corso...");
  try{
    const r=await fetch(url+"/cloud/load",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});
    const data=await r.json();
    if(!r.ok||!data.ok) throw new Error(data.error||"Errore download cloud");
    if(!data.data){cloudSetStatus("Nessun dato cloud trovato."); return;}
    db=data.data; localStorage.setItem(storeKey,JSON.stringify(db)); refresh();
    cloudSetStatus("Dati scaricati dal cloud.");
  }catch(e){cloudSetStatus("Errore download: "+e.message);}
}
document.querySelector("#cloudLoginBtn")?.addEventListener("click",cloudLogin);
document.querySelector("#cloudSaveBtn")?.addEventListener("click",cloudSave);
document.querySelector("#cloudLoadBtn")?.addEventListener("click",cloudLoad);
setTimeout(()=>{if(db.settings?.cloudEmail&&document.querySelector("#cloudEmail")) document.querySelector("#cloudEmail").value=db.settings.cloudEmail;},300);


/* ===== V7 CTF PRO UI ===== */
const CTF_SUBJECTS = [
  "Chimica Generale",
  "Chimica Organica I",
  "Chimica Organica II",
  "Biochimica",
  "Farmacologia",
  "Tecnologia Farmaceutica",
  "Tossicologia",
  "Fisiologia",
  "Microbiologia",
  "Analisi dei Farmaci",
  "Legislazione Farmaceutica"
];

function ensureCtfData(){
  db.subjects = db.subjects || CTF_SUBJECTS.map(name => ({
    id: "ctf_" + name.toLowerCase().replaceAll(" ","_"),
    name,
    examDate:"",
    cfu:"",
    difficulty:"",
    progress:0
  }));
  db.exams = db.exams || [];
  db.settings = db.settings || {};
}
ensureCtfData();

const oldRefreshV7 = refresh;
refresh = function(){
  ensureCtfData();
  oldRefreshV7();
  renderCtfSubjects();
  fillCtfSelects();
  renderExams();
  renderNextExam();
};

function subjectProgress(name){
  const cards = db.decks.filter(d => (d.topic||"").toLowerCase().includes(name.toLowerCase()) || (d.name||"").toLowerCase().includes(name.toLowerCase())).flatMap(d=>d.cards||[]);
  if(!cards.length) return 0;
  const reviewed = cards.filter(c => (c.ok||0)>0 || (c.box||0)>0).length;
  return Math.round((reviewed / cards.length) * 100);
}

function renderCtfSubjects(){
  const box=document.querySelector("#ctfSubjectsGrid");
  if(!box) return;
  box.innerHTML="";
  db.subjects.forEach(s=>{
    const progress=Math.max(Number(s.progress||0), subjectProgress(s.name));
    const decks=db.decks.filter(d => (d.topic||"").toLowerCase().includes(s.name.toLowerCase()) || (d.name||"").toLowerCase().includes(s.name.toLowerCase()));
    const cards=decks.reduce((a,d)=>a+(d.cards?.length||0),0);
    const exam=db.exams.find(e=>e.subject===s.name);
    box.insertAdjacentHTML("beforeend",`
      <div class="subjectCard">
        <h3>${esc(subjectIcon(s.name))} ${esc(s.name)}</h3>
        <div class="small">${cards} flashcard • ${decks.length} capitoli/mazzi</div>
        <div class="progressBar"><span style="width:${progress}%"></span></div>
        <div class="small">Preparazione: ${progress}%</div>
        <div class="small">${exam ? "Esame: "+esc(formatDate(exam.date)) : "Nessun esame impostato"}</div>
        <div class="itemActions">
          <button type="button" onclick="createDeckForSubject('${escAttr(s.name)}')">Crea capitolo</button>
          <button type="button" class="secondary" onclick="openTutorForSubject('${escAttr(s.name)}')">Tutor</button>
        </div>
      </div>
    `);
  });
}

function subjectIcon(name){
  if(name.includes("Farmacologia")) return "💊";
  if(name.includes("Organica")) return "⚗️";
  if(name.includes("Biochimica")) return "🧬";
  if(name.includes("Tossicologia")) return "☠️";
  if(name.includes("Microbiologia")) return "🦠";
  if(name.includes("Fisiologia")) return "🫀";
  return "🧪";
}

function fillCtfSelects(){
  ["examSubject","tutorSubject","oralSubject"].forEach(id=>{
    const sel=document.querySelector("#"+id);
    if(!sel) return;
    const old=sel.value;
    sel.innerHTML=db.subjects.map(s=>`<option value="${escAttr(s.name)}">${esc(s.name)}</option>`).join("");
    if(old) sel.value=old;
  });
}

function createDeckForSubject(subject){
  showView("create");
  const topic=document.querySelector("#deckTopic");
  const name=document.querySelector("#deckName");
  if(topic) topic.value=subject;
  if(name) name.value=subject+" - Capitolo ";
}

function openTutorForSubject(subject){
  showView("tutor");
  const sel=document.querySelector("#tutorSubject");
  if(sel) sel.value=subject;
}
window.createDeckForSubject=createDeckForSubject;
window.openTutorForSubject=openTutorForSubject;

document.querySelector("#saveExamBtn")?.addEventListener("click",()=>{
  const subject=document.querySelector("#examSubject").value;
  const date=document.querySelector("#examDate").value;
  const cfu=document.querySelector("#examCfu").value;
  const difficulty=document.querySelector("#examDifficulty").value;
  if(!subject || !date) return alert("Inserisci materia e data esame.");
  const existing=db.exams.find(e=>e.subject===subject);
  if(existing){ existing.date=date; existing.cfu=cfu; existing.difficulty=difficulty; }
  else db.exams.push({id:uid(),subject,date,cfu,difficulty,created:new Date().toISOString()});
  const s=db.subjects.find(x=>x.name===subject);
  if(s){s.examDate=date;s.cfu=cfu;s.difficulty=difficulty;}
  save();
  alert("Esame salvato.");
});

function renderExams(){
  const box=document.querySelector("#examList");
  if(!box) return;
  if(!db.exams.length){ box.innerHTML='<div class="item">Nessun esame inserito.</div>'; return; }
  box.innerHTML="";
  db.exams.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(e=>{
    const days=daysTo(e.date);
    box.insertAdjacentHTML("beforeend",`
      <div class="item">
        <div class="examRow">
          <div>
            <b>${esc(e.subject)}</b>
            <div class="small">${formatDate(e.date)} • ${days>=0 ? days+" giorni mancanti" : "esame passato"} • CFU ${esc(e.cfu||"-")} • difficoltà ${esc(e.difficulty||"-")}/10</div>
          </div>
          <div class="itemActions">
            <button type="button" onclick="studyPlan('${escAttr(e.id)}')">Piano studio</button>
            <button type="button" class="secondary" onclick="deleteExam('${escAttr(e.id)}')">Elimina</button>
          </div>
        </div>
      </div>
    `);
  });
}

function renderNextExam(){
  const box=document.querySelector("#nextExamBox");
  if(!box) return;
  const future=db.exams.filter(e=>daysTo(e.date)>=0).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  if(!future){ box.textContent="Nessun esame inserito."; return; }
  box.innerHTML=`<b>${esc(future.subject)}</b><br>${formatDate(future.date)} • mancano ${daysTo(future.date)} giorni`;
}

function deleteExam(id){
  if(confirm("Eliminare questo esame?")){
    db.exams=db.exams.filter(e=>e.id!==id);
    save();
  }
}
window.deleteExam=deleteExam;

function studyPlan(id){
  const e=db.exams.find(x=>x.id===id);
  if(!e) return;
  const days=Math.max(1,daysTo(e.date));
  const difficulty=Number(e.difficulty||6);
  const cfu=Number(e.cfu||9);
  const hours=Math.ceil(cfu*difficulty*1.5);
  const perDay=Math.max(1,Math.ceil(hours/days));
  alert(`Piano studio per ${e.subject}\\nOre stimate: ${hours}\\nGiorni disponibili: ${days}\\nOre consigliate al giorno: ${perDay}`);
}
window.studyPlan=studyPlan;

async function tutorCall(mode){
  const url=getWorkerUrl();
  if(!url) return alert("Inserisci URL Worker in Impostazioni.");
  const subject=document.querySelector("#tutorSubject").value;
  const q=document.querySelector("#tutorQuestion").value.trim();
  if(!q) return alert("Scrivi una domanda o un argomento.");
  const out=document.querySelector("#tutorAnswer");
  out.textContent="Tutor AI in elaborazione...";
  try{
    let endpoint="/explain";
    let text=q;
    if(mode==="summary") endpoint="/summary";
    if(mode==="cards") endpoint="/generate";
    if(mode==="quiz") endpoint="/summary", text="Crea domande universitarie d'esame su: "+q;
    const r=await fetch(url+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,topic:subject,count:10})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Errore AI");
    if(data.cards){
      out.textContent="Flashcard generate. Vai su Crea per salvarle in un mazzo.";
      draftCards = draftCards.concat(data.cards.map(c=>({id:uid(),q:c.question,a:c.answer,due:today(),box:0,ok:0,ko:0})));
      document.querySelector("#deckTopic").value=subject;
      document.querySelector("#deckName").value=subject+" - Tutor AI";
      renderPreview();
    }else{
      out.textContent=data.result || JSON.stringify(data,null,2);
    }
  }catch(e){out.textContent="Errore Tutor AI: "+e.message;}
}
document.querySelector("#tutorExplainBtn")?.addEventListener("click",()=>tutorCall("explain"));
document.querySelector("#tutorSummaryBtn")?.addEventListener("click",()=>tutorCall("summary"));
document.querySelector("#tutorQuizBtn")?.addEventListener("click",()=>tutorCall("quiz"));
document.querySelector("#tutorCardsBtn")?.addEventListener("click",()=>tutorCall("cards"));

document.querySelector("#oralEvaluateBtn")?.addEventListener("click",async()=>{
  const url=getWorkerUrl();
  if(!url) return alert("Inserisci URL Worker in Impostazioni.");
  const topic=document.querySelector("#oralSubject").value;
  const question=document.querySelector("#oralQuestion").value.trim();
  const answer=document.querySelector("#oralAnswer").value.trim();
  const out=document.querySelector("#oralResult");
  if(!question||!answer) return alert("Inserisci domanda e risposta.");
  out.textContent="Valutazione in corso...";
  try{
    const r=await fetch(url+"/oral",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,question,answer})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Errore AI");
    out.textContent=`Voto simulato: ${data.vote30}/30
Correttezza: ${data.correctness}%
Completezza: ${data.completeness}%
Chiarezza: ${data.clarity}%

Feedback:
${data.feedback}

Punti mancanti:
${(data.missing_points||[]).join("\\n")}

Risposta migliorata:
${data.improved_answer}`;
  }catch(e){out.textContent="Errore valutazione: "+e.message;}
});

document.querySelector("#drugGenerateBtn")?.addEventListener("click",async()=>{
  const url=getWorkerUrl();
  if(!url) return alert("Inserisci URL Worker in Impostazioni.");
  const drug=document.querySelector("#drugName").value.trim();
  const out=document.querySelector("#drugResult");
  if(!drug) return alert("Inserisci il nome del farmaco.");
  out.textContent="Generazione scheda farmaco...";
  try{
    const r=await fetch(url+"/drug",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({drug})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Errore AI");
    out.textContent=data.result;
  }catch(e){out.textContent="Errore farmaco: "+e.message;}
});

function daysTo(dateStr){
  const d=new Date(dateStr+"T00:00:00");
  const now=new Date(); now.setHours(0,0,0,0);
  return Math.ceil((d-now)/(1000*60*60*24));
}
function formatDate(dateStr){
  if(!dateStr) return "-";
  return new Date(dateStr+"T00:00:00").toLocaleDateString("it-IT");
}
function escAttr(s){return esc(s).replace(/"/g,"&quot;");}

refresh();


/* ===== V11 FIX STRUMENTI AI EXTRA ===== */
function setAiExtraMessage(message){
  const box = document.querySelector("#aiExtraBox");
  if(box) box.textContent = message || "";
}

async function aiExtra(endpoint){
  const text = document.querySelector("#sourceText")?.value.trim() || "";
  const url = getWorkerUrl ? getWorkerUrl() : ((db.settings?.workerUrl || "").trim().replace(/\/$/,""));

  if(!text){
    setAiExtraMessage("Inserisci o importa prima un testo, un PDF o un'immagine.");
    alert("Inserisci o importa prima un testo, un PDF o un'immagine.");
    return;
  }

  if(!url){
    setAiExtraMessage("Inserisci prima l'URL del Cloudflare Worker nelle Impostazioni.");
    alert("Inserisci prima l'URL del Cloudflare Worker nelle Impostazioni.");
    return;
  }

  setAiExtraMessage("Elaborazione AI in corso...");

  try{
    const payload = {
      text,
      topic: document.querySelector("#deckTopic")?.value || "",
      count: 10
    };

    const r = await fetch(url + "/" + endpoint, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if(!r.ok){
      throw new Error(data.error || "Errore AI");
    }

    if(endpoint === "generate"){
      const cards = data.cards || [];
      if(!cards.length){
        setAiExtraMessage("L'AI non ha generato flashcard. Prova con un testo più chiaro o più lungo.");
        return;
      }

      draftCards = draftCards.concat(cards.map(c => ({
        id: uid(),
        q: c.question || c.q || "",
        a: c.answer || c.a || "",
        due: today(),
        box: 0,
        ok: 0,
        ko: 0
      })));

      renderPreview();

      const lines = [
        data.detected_topic ? "✅ Argomento rilevato: " + data.detected_topic : "",
        data.warning ? "⚠️ " + data.warning : "",
        "✅ Aggiunte " + cards.length + " flashcard all'anteprima."
      ].filter(Boolean);

      setAiExtraMessage(lines.join("\n"));
      return;
    }

    setAiExtraMessage(formatAiText ? formatAiText(data.result || JSON.stringify(data,null,2)) : (data.result || JSON.stringify(data,null,2)));

  }catch(e){
    setAiExtraMessage("Errore AI: " + e.message);
  }
}

document.querySelector("#aiSummaryBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  aiExtra("summary");
});

document.querySelector("#aiExplainBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  aiExtra("explain");
});

document.querySelector("#aiMoreCardsBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  aiExtra("generate");
});


/* ===== V12 FIX DEFINITIVO SIMULAZIONE ORALE ===== */
function oralSetMessage(msg){
  const out = document.querySelector("#oralResult");
  if(out) out.textContent = msg || "";
}

async function generateOralQuestionV12(){
  const url = getWorkerUrl ? getWorkerUrl() : ((db.settings?.workerUrl || "").trim().replace(/\/$/,""));
  const subject = document.querySelector("#oralSubject")?.value || "CTF";
  const detail = document.querySelector("#oralTopicDetail")?.value.trim() || "";
  const topic = detail ? subject + " - " + detail : subject;

  if(!url){
    oralSetMessage("Errore: inserisci prima l'URL del Worker in Impostazioni.");
    alert("Inserisci prima l'URL del Worker in Impostazioni.");
    return;
  }

  if(!detail){
    oralSetMessage("Scrivi prima un argomento specifico, ad esempio: ciclo di Krebs, beta-lattamici, farmacocinetica.");
    alert("Scrivi prima un argomento specifico.");
    return;
  }

  oralSetMessage("Sto generando una domanda da professore...");

  try{
    const r = await fetch(url + "/oral-question", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ topic, context: detail, level: "universitario" })
    });

    let data;
    try{
      data = await r.json();
    }catch(_){
      throw new Error("Risposta del Worker non valida. Controlla che worker-cloudflare.js sia aggiornato.");
    }

    if(!r.ok){
      throw new Error(data.error || "Errore generazione domanda.");
    }

    if(!data.question){
      throw new Error("Il Worker ha risposto ma non ha restituito il campo question.");
    }

    document.querySelector("#oralQuestion").value = data.question;
    oralSetMessage("Domanda generata. Ora scrivi la risposta e premi 'Valuta risposta'.");

  }catch(e){
    oralSetMessage("Errore generazione domanda: " + e.message + "\n\nControlla di aver sostituito anche worker-cloudflare.js su Cloudflare e poi premi Save and deploy.");
  }
}

document.querySelector("#oralGenerateQuestionBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  generateOralQuestionV12();
});

/* Rende cliccabile anche nel caso in cui il vecchio listener non fosse agganciato */
document.addEventListener("click", (e)=>{
  if(e.target && e.target.id === "oralGenerateQuestionBtn"){
    e.preventDefault();
    generateOralQuestionV12();
  }
});


/* ===== V13 MATERIE EDITABILI ===== */
function addSubjectV13(){
  ensureCtfData();
  const name = prompt("Nome nuova materia:");
  if(!name || !name.trim()) return;

  const cleanName = name.trim();

  if(db.subjects.some(s => (s.name || "").toLowerCase() === cleanName.toLowerCase())){
    alert("Questa materia esiste già.");
    return;
  }

  db.subjects.push({
    id: "ctf_custom_" + uid(),
    name: cleanName,
    examDate: "",
    cfu: "",
    difficulty: "",
    progress: 0,
    custom: true
  });

  save();
  showView("subjects");
}

function editSubjectV13(subjectId){
  ensureCtfData();
  const s = db.subjects.find(x => String(x.id) === String(subjectId));
  if(!s) return alert("Materia non trovata.");

  const oldName = s.name;
  const newName = prompt("Modifica nome materia:", s.name || "");
  if(!newName || !newName.trim()) return;

  s.name = newName.trim();

  (db.exams || []).forEach(e => {
    if(e.subject === oldName) e.subject = s.name;
  });

  save();
}

function deleteSubjectV13(subjectId){
  ensureCtfData();
  const s = db.subjects.find(x => String(x.id) === String(subjectId));
  if(!s) return alert("Materia non trovata.");

  const linkedDecks = (db.decks || []).filter(d => 
    (d.topic || "").toLowerCase().includes((s.name || "").toLowerCase()) ||
    (d.name || "").toLowerCase().includes((s.name || "").toLowerCase())
  ).length;

  const msg = linkedDecks > 0
    ? `La materia "${s.name}" ha ${linkedDecks} mazzi/capitoli collegati. Vuoi eliminarla comunque? I mazzi non verranno cancellati.`
    : `Eliminare la materia "${s.name}"?`;

  if(!confirm(msg)) return;

  db.subjects = db.subjects.filter(x => String(x.id) !== String(subjectId));
  db.exams = (db.exams || []).filter(e => e.subject !== s.name);
  save();
}

function renderCtfSubjects(){
  const box=document.querySelector("#ctfSubjectsGrid");
  if(!box) return;
  ensureCtfData();
  box.innerHTML="";

  db.subjects.forEach(s=>{
    const progress=Math.max(Number(s.progress||0), subjectProgress(s.name));
    const decks=(db.decks || []).filter(d => 
      (d.topic||"").toLowerCase().includes((s.name||"").toLowerCase()) || 
      (d.name||"").toLowerCase().includes((s.name||"").toLowerCase())
    );
    const cards=decks.reduce((a,d)=>a+(d.cards?.length||0),0);
    const exam=(db.exams || []).find(e=>e.subject===s.name);

    box.insertAdjacentHTML("beforeend",`
      <div class="subjectCard">
        <h3>${esc(subjectIcon(s.name))} ${esc(s.name)}</h3>
        <div class="small">${cards} flashcard • ${decks.length} capitoli/mazzi</div>
        <div class="progressBar"><span style="width:${progress}%"></span></div>
        <div class="small">Preparazione: ${progress}%</div>
        <div class="small">${exam ? "Esame: "+esc(formatDate(exam.date)) : "Nessun esame impostato"}</div>
        <div class="itemActions">
          <button type="button" onclick="createDeckForSubject('${escAttr(s.name)}')">Crea capitolo</button>
          <button type="button" class="secondary" onclick="openTutorForSubject('${escAttr(s.name)}')">Tutor</button>
          <button type="button" class="secondary" onclick="editSubjectV13('${escAttr(s.id)}')">Modifica</button>
          <button type="button" class="secondary" onclick="deleteSubjectV13('${escAttr(s.id)}')">Elimina</button>
        </div>
      </div>
    `);
  });
}

document.querySelector("#addSubjectBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  addSubjectV13();
});

window.addSubjectV13 = addSubjectV13;
window.editSubjectV13 = editSubjectV13;
window.deleteSubjectV13 = deleteSubjectV13;
window.renderCtfSubjects = renderCtfSubjects;

refresh();

/* ===== V14 MESSAGGI QUOTA PIÙ CHIARI ===== */
function friendlyAiError(message){
  const m = String(message || "");
  if(m.toLowerCase().includes("quota") || m.toLowerCase().includes("rate") || m.includes("429")){
    return "Limite temporaneo AI raggiunto. Se OpenRouter è configurato, l'app passerà al provider alternativo. Se continua, attendi qualche minuto.";
  }
  return m;
}


/* ===== V15 VOCE TUTOR AI ===== */
let currentAiAudio = null;

function loadVoiceSettings(){
  db.settings = db.settings || {};
  const provider = document.querySelector("#voiceProvider");
  const key = document.querySelector("#elevenLabsKey");
  const voiceId = document.querySelector("#elevenLabsVoiceId");
  if(provider) provider.value = db.settings.voiceProvider || "browser";
  if(key) key.value = db.settings.elevenLabsKey || "";
  if(voiceId) voiceId.value = db.settings.elevenLabsVoiceId || "";
}

function saveVoiceSettings(){
  db.settings = db.settings || {};
  db.settings.voiceProvider = document.querySelector("#voiceProvider")?.value || "browser";
  db.settings.elevenLabsKey = document.querySelector("#elevenLabsKey")?.value.trim() || "";
  db.settings.elevenLabsVoiceId = document.querySelector("#elevenLabsVoiceId")?.value.trim() || "";
  db.settings.geminiVoiceName = document.querySelector("#geminiVoiceName")?.value || "Kore";
  save();
  const s = document.querySelector("#voiceStatus");
  if(s) s.textContent = "Impostazioni voce salvate.";
}

async function speakTutorText(text){
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if(!clean){ alert("Non c'è testo da leggere."); return; }

  db.settings = db.settings || {};
  const provider = db.settings.voiceProvider || "browser";


  if(provider === "gemini"){
    const url = getWorkerUrl ? getWorkerUrl() : ((db.settings.workerUrl || "").trim().replace(/\/$/,""));
    if(!url){ alert("Per usare Gemini TTS serve l'URL del Worker nelle Impostazioni."); return; }

    try{
      const status = document.querySelector("#voiceStatus");
      if(status) status.textContent = "Genero voce Gemini...";

      const r = await fetch(url + "/tts-gemini", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          text: clean,
          voiceName: db.settings.geminiVoiceName || "Kore"
        })
      });

      if(!r.ok){
        const err = await r.json().catch(()=>({error:"Errore voce Gemini"}));
        throw new Error(err.error || "Errore voce Gemini");
      }

      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);
      if(currentAiAudio){ currentAiAudio.pause(); currentAiAudio = null; }
      currentAiAudio = new Audio(audioUrl);
      currentAiAudio.play();
      if(status) status.textContent = "Voce Gemini in riproduzione.";
      return;
    }catch(e){
      alert("Errore voce Gemini: " + e.message + "\\nUso la voce gratuita del dispositivo.");
    }
  }

  if(provider === "elevenlabs"){
    const url = getWorkerUrl ? getWorkerUrl() : ((db.settings.workerUrl || "").trim().replace(/\/$/,""));
    if(!url){ alert("Per usare ElevenLabs serve l'URL del Worker nelle Impostazioni."); return; }

    try{
      const status = document.querySelector("#voiceStatus");
      if(status) status.textContent = "Genero voce AI...";

      const r = await fetch(url + "/tts", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          text: clean,
          apiKey: db.settings.elevenLabsKey || "",
          voiceId: db.settings.elevenLabsVoiceId || ""
        })
      });

      if(!r.ok){
        const err = await r.json().catch(()=>({error:"Errore voce AI"}));
        throw new Error(err.error || "Errore voce AI");
      }

      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);

      if(currentAiAudio){ currentAiAudio.pause(); currentAiAudio = null; }
      currentAiAudio = new Audio(audioUrl);
      currentAiAudio.play();

      if(status) status.textContent = "Voce AI in riproduzione.";
      return;
    }catch(e){
      alert("Errore voce AI: " + e.message + "\nUso la voce gratuita del dispositivo.");
    }
  }

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "it-IT";
  u.rate = 0.95;
  u.pitch = 1;
  speechSynthesis.speak(u);
}

function stopTutorVoice(){
  speechSynthesis.cancel();
  if(currentAiAudio){ currentAiAudio.pause(); currentAiAudio = null; }
}

function addVoiceButtons(){
  const targets = [
    ["#tutorAnswer", "Ascolta Tutor"],
    ["#oralResult", "Ascolta Valutazione"],
    ["#drugResult", "Ascolta Farmaco"],
    ["#aiExtraBox", "Ascolta Testo AI"]
  ];

  targets.forEach(([selector,label])=>{
    const box = document.querySelector(selector);
    if(!box || box.dataset.voiceReady) return;

    const row = document.createElement("div");
    row.className = "actions voiceActions";
    row.innerHTML = `
      <button type="button" class="secondary">🔊 ${label}</button>
      <button type="button" class="secondary">⏹️ Stop</button>
    `;

    const buttons = row.querySelectorAll("button");
    buttons[0].addEventListener("click",()=>speakTutorText(box.textContent));
    buttons[1].addEventListener("click",()=>stopTutorVoice());

    box.insertAdjacentElement("afterend", row);
    box.dataset.voiceReady = "1";
  });
}

document.querySelector("#saveVoiceSettingsBtn")?.addEventListener("click",(e)=>{
  e.preventDefault();
  saveVoiceSettings();
});

document.querySelector("#testVoiceBtn")?.addEventListener("click",(e)=>{
  e.preventDefault();
  saveVoiceSettings();
  speakTutorText("Ciao, sono il tutor vocale di StudyFlash AI CTF Pro. Posso leggere spiegazioni, risposte, schede farmaco e valutazioni orali.");
});

setTimeout(()=>{ loadVoiceSettings(); addVoiceButtons(); }, 500);
document.addEventListener("click",()=>{ setTimeout(addVoiceButtons, 300); });


/* ===== V17 VOCE GLOBALE SU TUTTI I TASTI ASCOLTA ===== */
function getGlobalVoiceSettings(){
  db.settings = db.settings || {};
  return {
    provider: db.settings.voiceProvider || "browser",
    geminiVoiceName: db.settings.geminiVoiceName || "Kore",
    elevenLabsKey: db.settings.elevenLabsKey || "",
    elevenLabsVoiceId: db.settings.elevenLabsVoiceId || ""
  };
}

/* Questa funzione sostituisce la lettura precedente e usa SEMPRE la voce scelta in Impostazioni */
async function speakTutorText(text){
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if(!clean){
    alert("Non c'è testo da leggere.");
    return;
  }

  const settings = getGlobalVoiceSettings();
  const provider = settings.provider;

  if(provider === "gemini"){
    const url = getWorkerUrl ? getWorkerUrl() : ((db.settings.workerUrl || "").trim().replace(/\/$/,""));
    if(!url){
      alert("Per usare Gemini Voice serve l'URL del Worker nelle Impostazioni.");
      return;
    }

    try{
      const status = document.querySelector("#voiceStatus");
      if(status) status.textContent = "Genero voce Gemini...";

      const r = await fetch(url + "/tts-gemini", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          text: clean,
          voiceName: settings.geminiVoiceName
        })
      });

      if(!r.ok){
        const err = await r.json().catch(()=>({error:"Errore voce Gemini"}));
        throw new Error(err.error || "Errore voce Gemini");
      }

      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);

      if(currentAiAudio){
        currentAiAudio.pause();
        currentAiAudio = null;
      }

      speechSynthesis.cancel();
      currentAiAudio = new Audio(audioUrl);
      currentAiAudio.play();

      if(status) status.textContent = "Voce Gemini in riproduzione.";
      return;
    }catch(e){
      alert("Errore voce Gemini: " + e.message + "\nUso la voce gratuita del dispositivo.");
    }
  }

  if(provider === "elevenlabs"){
    const url = getWorkerUrl ? getWorkerUrl() : ((db.settings.workerUrl || "").trim().replace(/\/$/,""));
    if(!url){
      alert("Per usare ElevenLabs serve l'URL del Worker nelle Impostazioni.");
      return;
    }

    try{
      const status = document.querySelector("#voiceStatus");
      if(status) status.textContent = "Genero voce ElevenLabs...";

      const r = await fetch(url + "/tts", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          text: clean,
          apiKey: settings.elevenLabsKey,
          voiceId: settings.elevenLabsVoiceId
        })
      });

      if(!r.ok){
        const err = await r.json().catch(()=>({error:"Errore voce ElevenLabs"}));
        throw new Error(err.error || "Errore voce ElevenLabs");
      }

      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);

      if(currentAiAudio){
        currentAiAudio.pause();
        currentAiAudio = null;
      }

      speechSynthesis.cancel();
      currentAiAudio = new Audio(audioUrl);
      currentAiAudio.play();

      if(status) status.textContent = "Voce ElevenLabs in riproduzione.";
      return;
    }catch(e){
      alert("Errore voce ElevenLabs: " + e.message + "\nUso la voce gratuita del dispositivo.");
    }
  }

  /* Fallback: voce gratuita del dispositivo */
  stopTutorVoice();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "it-IT";
  u.rate = 0.95;
  u.pitch = 1;
  speechSynthesis.speak(u);
}

/* Aggiorna anche il pulsante ascolta della modalità studio */
const oldSpeakBtn = document.querySelector("#speakBtn");
if(oldSpeakBtn){
  oldSpeakBtn.onclick = () => {
    const shown = document.querySelector("#flipCard")?.classList.contains("show");
    const txt = shown
      ? document.querySelector("#studyAnswer")?.textContent
      : document.querySelector("#studyQuestion")?.textContent;
    speakTutorText(txt || "");
  };
}

/* Ricrea i pulsanti ascolta usando sempre la voce globale */
function addVoiceButtons(){
  const targets = [
    ["#tutorAnswer", "Ascolta Tutor"],
    ["#oralResult", "Ascolta Valutazione"],
    ["#drugResult", "Ascolta Farmaco"],
    ["#aiExtraBox", "Ascolta Testo AI"],
    ["#quizFeedback", "Ascolta Quiz"],
    ["#fileStatus", "Ascolta Avviso"]
  ];

  targets.forEach(([selector,label])=>{
    const box = document.querySelector(selector);
    if(!box || box.dataset.voiceReadyGlobal) return;

    const row = document.createElement("div");
    row.className = "actions voiceActions";
    row.innerHTML = `
      <button type="button" class="secondary">🔊 ${label}</button>
      <button type="button" class="secondary">⏹️ Stop</button>
    `;

    const buttons = row.querySelectorAll("button");
    buttons[0].addEventListener("click",()=>speakTutorText(box.textContent));
    buttons[1].addEventListener("click",()=>stopTutorVoice());

    box.insertAdjacentElement("afterend", row);
    box.dataset.voiceReadyGlobal = "1";
  });
}

document.addEventListener("click",()=>{
  setTimeout(addVoiceButtons, 250);
});

setTimeout(addVoiceButtons, 800);


/* ===== V19 LIBRERIA CLOUD R2 ===== */
function fillDocumentSubjectSelect(){
  const sel = document.querySelector("#docSubject");
  if(!sel) return;
  ensureCtfData?.();
  const old = sel.value;
  sel.innerHTML = (db.subjects || []).map(s => `<option value="${escAttr(s.name)}">${esc(s.name)}</option>`).join("");
  if(old) sel.value = old;
}

async function fileToBase64(file){
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary);
}

async function extractTextForDocument(file){
  try{
    if(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")){
      return await readPdf(file);
    }
    if(file.type.startsWith("image/")){
      return await readImage(file);
    }
    if(file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")){
      return await file.text();
    }
  }catch(e){
    return "";
  }
  return "";
}

function docSetStatus(msg){
  const el = document.querySelector("#docStatus");
  if(el) el.textContent = msg || "";
}

async function uploadDocumentToR2(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const file = document.querySelector("#docFile")?.files?.[0];
  const subject = document.querySelector("#docSubject")?.value || "";
  const title = document.querySelector("#docTitle")?.value.trim() || file?.name || "Documento";

  if(!url) return alert("Inserisci l'URL del Worker in Impostazioni.");
  if(!userId) return alert("Prima accedi al Cloud D1 da Impostazioni.");
  if(!file) return alert("Scegli un PDF, immagine o file di testo.");

  docSetStatus("Lettura testo documento...");
  const textContent = await extractTextForDocument(file);

  docSetStatus("Preparazione file per R2...");
  const base64 = await fileToBase64(file);

  docSetStatus("Caricamento su Cloudflare R2...");
  try{
    const r = await fetch(url + "/documents/upload", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        userId,
        subject,
        title,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
        textContent
      })
    });
    const data = await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error || "Errore caricamento R2");

    docSetStatus(`Documento caricato in R2.\nTesto estratto: ${textContent.length} caratteri\nDimensione file: ${Math.round((data.size||0)/1024)} KB\n\nControllo coerenza materia in corso...`);
    document.querySelector("#docTitle").value = "";
    document.querySelector("#docFile").value = "";

    try{
      const check = await checkDocumentSubjectAuto(data.id);
      if(check){
        const suggested = check.suggested_subject || check.detected_subject || "";
        const msg = [
          `Documento caricato in R2.`,
          `Testo estratto: ${textContent.length} caratteri`,
          `Dimensione file: ${Math.round((data.size||0)/1024)} KB`,
          ``,
          `Materia scelta: ${subject || "-"}`,
          `Materia rilevata: ${check.detected_subject || "-"}`,
          `Materia suggerita: ${suggested || "-"}`,
          check.warning ? `⚠️ ${check.warning}` : `✅ La materia sembra coerente.`
        ].join("\n");
        docSetStatus(msg);

        const statusBox = document.querySelector("#docStatus");
        if(statusBox && suggested && !check.matches){
          const row = document.createElement("div");
          row.className = "actions";
          row.innerHTML = `
            <button type="button">Usa materia suggerita</button>
            <button type="button" class="secondary">Scegli manualmente</button>
          `;
          const btns = row.querySelectorAll("button");
          btns[0].addEventListener("click",()=>changeDocSubjectToSuggested(data.id, suggested));
          btns[1].addEventListener("click",()=>chooseDocSubjectManual(data.id));
          statusBox.insertAdjacentElement("afterend", row);
        }
      }
    }catch(e){
      docSetStatus(`Documento caricato in R2.\nTesto estratto: ${textContent.length} caratteri\nDimensione file: ${Math.round((data.size||0)/1024)} KB\n\nAvviso: controllo materia non riuscito: ${e.message}`);
    }

    await loadDocuments();
  }catch(e){
    docSetStatus("Errore caricamento: " + e.message);
  }
}

async function loadDocuments(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const box = document.querySelector("#docList");
  if(!box) return;
  if(!url){ box.innerHTML='<div class="item">Inserisci URL Worker in Impostazioni.</div>'; return; }
  if(!userId){ box.innerHTML='<div class="item">Accedi al Cloud D1 da Impostazioni.</div>'; return; }

  const q = document.querySelector("#docSearch")?.value.trim() || "";
  box.innerHTML = '<div class="item">Caricamento documenti...</div>';

  try{
    const r = await fetch(url + "/documents/list", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,q})
    });
    const data = await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error || "Errore lista documenti");

    if(!data.documents.length){
      box.innerHTML = '<div class="item">Nessun documento salvato.</div>';
      return;
    }

    box.innerHTML = "";
    data.documents.forEach(d=>{
      box.insertAdjacentHTML("beforeend",`
        <div class="item">
          <b>${esc(d.title || d.file_name)}</b>
          <div class="small">${esc(d.subject || "Senza materia")} • ${esc(d.file_name || "")} • ${Math.round((d.size||0)/1024)} KB</div>
          <div class="small">${esc((d.preview || "").slice(0,220))}</div>
          <div class="itemActions">
            <button type="button" onclick="openPdfChat('${escAttr(d.id)}')">Chat PDF</button>
            <button type="button" class="secondary" onclick="generateFromCloudDoc('${escAttr(d.id)}')">Genera flashcard</button>
            <button type="button" class="secondary" onclick="downloadCloudDoc('${escAttr(d.id)}')">Scarica</button>
            <button type="button" class="secondary" onclick="deleteCloudDoc('${escAttr(d.id)}')">Elimina</button>
          </div>
        </div>
      `);
    });
  }catch(e){
    box.innerHTML = '<div class="item">Errore libreria: '+esc(e.message)+'</div>';
  }
}

async function getCloudDocContent(id){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const r = await fetch(url + "/documents/content", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({userId,id})
  });
  const data = await r.json();
  if(!r.ok || !data.ok) throw new Error(data.error || "Errore documento");
  return data.document;
}

async function generateFromCloudDoc(id){
  try{
    const d = await getCloudDocContent(id);
    if(!d.text_content) return alert("Questo documento non ha testo estratto. Prova a ricaricarlo o usa OCR.");

    showView("create");
    document.querySelector("#deckTopic").value = d.subject || "";
    document.querySelector("#deckName").value = (d.subject || "Documento") + " - " + (d.title || d.file_name || "PDF");
    document.querySelector("#sourceText").value = d.text_content;
    alert("Documento caricato nella sezione Crea. Ora premi Genera con AI.");
  }catch(e){
    alert("Errore: " + e.message);
  }
}

function downloadCloudDoc(id){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  if(!url || !userId) return alert("Cloud non configurato.");
  window.open(url + "/documents/download?userId=" + encodeURIComponent(userId) + "&id=" + encodeURIComponent(id), "_blank");
}

async function deleteCloudDoc(id){
  if(!confirm("Eliminare questo documento da R2?")) return;
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  try{
    const r = await fetch(url + "/documents/delete", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id})
    });
    const data = await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error || "Errore eliminazione");
    await loadDocuments();
  }catch(e){
    alert("Errore: " + e.message);
  }
}

async function backupFullToR2(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  if(!url) return alert("Inserisci URL Worker.");
  if(!userId) return alert("Prima accedi al Cloud D1.");

  docSetStatus("Creazione backup su R2...");
  try{
    const r = await fetch(url + "/backup/r2", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,data:db})
    });
    const data = await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error || "Errore backup");
    docSetStatus("Backup creato in R2:\n" + data.key);
  }catch(e){
    docSetStatus("Errore backup: " + e.message);
  }
}

document.querySelector("#uploadDocBtn")?.addEventListener("click", e=>{e.preventDefault(); uploadDocumentToR2();});
document.querySelector("#refreshDocsBtn")?.addEventListener("click", e=>{e.preventDefault(); loadDocuments();});
document.querySelector("#backupR2Btn")?.addEventListener("click", e=>{e.preventDefault(); backupFullToR2();});
document.querySelector("#docSearch")?.addEventListener("input", ()=>setTimeout(loadDocuments, 200));

window.generateFromCloudDoc = generateFromCloudDoc;
window.downloadCloudDoc = downloadCloudDoc;
window.deleteCloudDoc = deleteCloudDoc;

const oldRefreshV19 = refresh;
refresh = function(){
  oldRefreshV19();
  fillDocumentSubjectSelect();
};

setTimeout(()=>{ fillDocumentSubjectSelect(); loadDocuments(); }, 700);


/* ===== V20 CHAT PDF / QUIZ PDF / ORALE PDF ===== */
let currentPdfChatDocId = null;
let currentPdfChatDoc = null;

async function openPdfChat(id){
  try{
    currentPdfChatDocId = id;
    currentPdfChatDoc = await getCloudDocContent(id);
    showView("pdfChat");
    const info = document.querySelector("#pdfChatDocInfo");
    if(info){
      info.innerHTML = `<b>${esc(currentPdfChatDoc.title || currentPdfChatDoc.file_name)}</b><br>${esc(currentPdfChatDoc.subject || "Senza materia")} • ${esc(currentPdfChatDoc.file_name || "")}`;
    }
    document.querySelector("#pdfChatAnswer").textContent = "Documento pronto. Scrivi una domanda oppure genera quiz/domande orali.";
  }catch(e){
    alert("Errore apertura Chat PDF: " + e.message);
  }
}

async function askCurrentPdf(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const q = document.querySelector("#pdfChatQuestion")?.value.trim();
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento dalla Libreria Cloud.");
  if(!q) return alert("Scrivi una domanda sul PDF.");
  out.textContent = "Sto leggendo il PDF e preparo la risposta...";
  try{
    const r = await fetch(url + "/documents/ask", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId,question:q})
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore Chat PDF");
    out.textContent = formatAiText ? formatAiText(data.result) : data.result;
  }catch(e){
    out.textContent = "Errore Chat PDF: " + e.message;
  }
}

async function quizCurrentPdf(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");
  out.textContent = "Genero quiz dal PDF...";
  try{
    const r = await fetch(url + "/documents/quiz", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId,count:10})
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore quiz PDF");
    const quiz = data.quiz || [];
    out.textContent = quiz.map((q,i)=>
      `${i+1}. ${q.question}\nA) ${q.options?.[0]||""}\nB) ${q.options?.[1]||""}\nC) ${q.options?.[2]||""}\nD) ${q.options?.[3]||""}\nRisposta: ${q.answer}\nSpiegazione: ${q.explanation||""}`
    ).join("\n\n");
  }catch(e){
    out.textContent = "Errore quiz PDF: " + e.message;
  }
}

async function oralQuestionsCurrentPdf(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");
  out.textContent = "Genero domande orali dal PDF...";
  try{
    const r = await fetch(url + "/documents/oral-questions", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId,count:6})
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore orale PDF");
    const qs = data.questions || [];
    out.textContent = qs.map((q,i)=>`${i+1}. ${q}`).join("\n\n");
  }catch(e){
    out.textContent = "Errore domande orali PDF: " + e.message;
  }
}

async function checkPdfSubject(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");
  out.textContent = "Controllo coerenza materia...";
  try{
    const r = await fetch(url + "/documents/check-subject", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId})
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore controllo materia");
    out.textContent =
      `Materia rilevata: ${data.detected_subject || "-"}\n`+
      `Corrisponde alla materia scelta: ${data.matches ? "Sì" : "No"}\n`+
      `Materia suggerita: ${data.suggested_subject || "-"}\n\n`+
      `${data.warning || "Nessun avviso."}`;
  }catch(e){
    out.textContent = "Errore controllo materia: " + e.message;
  }
}

document.querySelector("#askPdfBtn")?.addEventListener("click", e=>{e.preventDefault(); askCurrentPdf();});
document.querySelector("#pdfQuizBtn")?.addEventListener("click", e=>{e.preventDefault(); quizCurrentPdf();});
document.querySelector("#pdfOralBtn")?.addEventListener("click", e=>{e.preventDefault(); oralQuestionsCurrentPdf();});
document.querySelector("#pdfMatterCheckBtn")?.addEventListener("click", e=>{e.preventDefault(); checkPdfSubject();});

window.openPdfChat = openPdfChat;


/* ===== V21 CONTROLLO AUTOMATICO MATERIA DOPO UPLOAD ===== */
async function checkDocumentSubjectAuto(id){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  if(!url || !userId || !id) return null;

  const r = await fetch(url + "/documents/check-subject", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({userId,id})
  });

  const data = await r.json();
  if(!r.ok) throw new Error(data.error || "Errore controllo materia");
  return data;
}

/* Migliora il pulsante Controlla materia dentro Chat PDF */
async function checkPdfSubject(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");
  out.textContent = "Controllo coerenza materia...";
  try{
    const data = await checkDocumentSubjectAuto(currentPdfChatDocId);
    out.textContent =
      `Materia scelta: ${currentPdfChatDoc?.subject || "-"}\\n`+
      `Materia rilevata: ${data.detected_subject || "-"}\\n`+
      `Corrisponde alla materia scelta: ${data.matches ? "Sì" : "No"}\\n`+
      `Materia suggerita: ${data.suggested_subject || "-"}\\n\\n`+
      `${data.warning || "Nessun avviso: la materia sembra coerente."}`;
  }catch(e){
    out.textContent = "Errore controllo materia: " + e.message;
  }
}
window.checkPdfSubject = checkPdfSubject;


/* ===== V22 CAMBIA MATERIA DOCUMENTO ===== */
let lastSubjectCheck = null;

async function updateCloudDocSubject(id, newSubject){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  if(!url) throw new Error("URL Worker mancante.");
  if(!userId) throw new Error("Utente Cloud D1 non collegato.");
  if(!id || !newSubject) throw new Error("Documento o materia mancante.");

  const r = await fetch(url + "/documents/update-subject", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ userId, id, subject: newSubject })
  });

  const data = await r.json();
  if(!r.ok || !data.ok) throw new Error(data.error || "Errore aggiornamento materia");
  return data;
}

async function changeDocSubjectToSuggested(id, suggestedSubject){
  if(!suggestedSubject) return alert("Nessuna materia suggerita disponibile.");

  let finalSubject = suggestedSubject.trim();

  // Se la materia suggerita non esiste, chiede se crearla.
  ensureCtfData();
  const exists = (db.subjects || []).some(s => (s.name || "").toLowerCase() === finalSubject.toLowerCase());
  if(!exists){
    const create = confirm(`La materia "${finalSubject}" non esiste ancora. Vuoi aggiungerla alle materie?`);
    if(create){
      db.subjects.push({
        id: "ctf_custom_" + uid(),
        name: finalSubject,
        examDate: "",
        cfu: "",
        difficulty: "",
        progress: 0,
        custom: true
      });
      save();
    }
  }

  try{
    await updateCloudDocSubject(id, finalSubject);
    if(currentPdfChatDoc && currentPdfChatDoc.id === id) currentPdfChatDoc.subject = finalSubject;
    alert("Materia documento aggiornata: " + finalSubject);
    await loadDocuments();
    fillDocumentSubjectSelect?.();
  }catch(e){
    alert("Errore cambio materia: " + e.message);
  }
}

async function chooseDocSubjectManual(id){
  ensureCtfData();
  const names = (db.subjects || []).map(s => s.name).join(", ");
  const chosen = prompt("Scrivi la nuova materia per questo documento:\n\nMaterie disponibili:\n" + names);
  if(!chosen || !chosen.trim()) return;

  const finalSubject = chosen.trim();
  const exists = (db.subjects || []).some(s => (s.name || "").toLowerCase() === finalSubject.toLowerCase());
  if(!exists){
    const create = confirm(`La materia "${finalSubject}" non esiste. Vuoi aggiungerla?`);
    if(create){
      db.subjects.push({
        id: "ctf_custom_" + uid(),
        name: finalSubject,
        examDate: "",
        cfu: "",
        difficulty: "",
        progress: 0,
        custom: true
      });
      save();
    }
  }

  try{
    await updateCloudDocSubject(id, finalSubject);
    if(currentPdfChatDoc && currentPdfChatDoc.id === id) currentPdfChatDoc.subject = finalSubject;
    alert("Materia documento aggiornata: " + finalSubject);
    await loadDocuments();
    fillDocumentSubjectSelect?.();
  }catch(e){
    alert("Errore cambio materia: " + e.message);
  }
}

window.changeDocSubjectToSuggested = changeDocSubjectToSuggested;
window.chooseDocSubjectManual = chooseDocSubjectManual;

/* Migliora il controllo automatico: mostra pulsante per correggere la materia */
async function checkDocumentSubjectAuto(id){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  if(!url || !userId || !id) return null;

  const r = await fetch(url + "/documents/check-subject", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({userId,id})
  });

  const data = await r.json();
  if(!r.ok) throw new Error(data.error || "Errore controllo materia");

  lastSubjectCheck = { id, ...data };
  return data;
}

/* Sovrascrive la lista documenti per aggiungere Modifica materia */
async function loadDocuments(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const box = document.querySelector("#docList");
  if(!box) return;
  if(!url){ box.innerHTML='<div class="item">Inserisci URL Worker in Impostazioni.</div>'; return; }
  if(!userId){ box.innerHTML='<div class="item">Accedi al Cloud D1 da Impostazioni.</div>'; return; }

  const q = document.querySelector("#docSearch")?.value.trim() || "";
  box.innerHTML = '<div class="item">Caricamento documenti...</div>';

  try{
    const r = await fetch(url + "/documents/list", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,q})
    });
    const data = await r.json();
    if(!r.ok || !data.ok) throw new Error(data.error || "Errore lista documenti");

    if(!data.documents.length){
      box.innerHTML = '<div class="item">Nessun documento salvato.</div>';
      return;
    }

    box.innerHTML = "";
    data.documents.forEach(d=>{
      box.insertAdjacentHTML("beforeend",`
        <div class="item">
          <b>${esc(d.title || d.file_name)}</b>
          <div class="small">${esc(d.subject || "Senza materia")} • ${esc(d.file_name || "")} • ${Math.round((d.size||0)/1024)} KB</div>
          <div class="small">${esc((d.preview || "").slice(0,220))}</div>
          <div class="itemActions">
            <button type="button" onclick="openPdfChat('${escAttr(d.id)}')">Chat PDF</button>
            <button type="button" class="secondary" onclick="generateFromCloudDoc('${escAttr(d.id)}')">Genera flashcard</button>
            <button type="button" class="secondary" onclick="chooseDocSubjectManual('${escAttr(d.id)}')">Modifica materia</button>
            <button type="button" class="secondary" onclick="downloadCloudDoc('${escAttr(d.id)}')">Scarica</button>
            <button type="button" class="secondary" onclick="deleteCloudDoc('${escAttr(d.id)}')">Elimina</button>
          </div>
        </div>
      `);
    });
  }catch(e){
    box.innerHTML = '<div class="item">Errore libreria: '+esc(e.message)+'</div>';
  }
}

/* Sovrascrive controllo materia in Chat PDF con pulsante di correzione */
async function checkPdfSubject(){
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");
  out.textContent = "Controllo coerenza materia...";
  try{
    const data = await checkDocumentSubjectAuto(currentPdfChatDocId);
    const suggested = data.suggested_subject || data.detected_subject || "";
    out.innerHTML =
      `<b>Materia scelta:</b> ${esc(currentPdfChatDoc?.subject || "-")}<br>`+
      `<b>Materia rilevata:</b> ${esc(data.detected_subject || "-")}<br>`+
      `<b>Corrisponde:</b> ${data.matches ? "Sì" : "No"}<br>`+
      `<b>Materia suggerita:</b> ${esc(suggested || "-")}<br><br>`+
      `${esc(data.warning || "Nessun avviso: la materia sembra coerente.")}<br><br>`+
      `<div class="actions">`+
      `<button type="button" onclick="changeDocSubjectToSuggested('${escAttr(currentPdfChatDocId)}','${escAttr(suggested)}')">Usa materia suggerita</button>`+
      `<button type="button" class="secondary" onclick="chooseDocSubjectManual('${escAttr(currentPdfChatDocId)}')">Scegli manualmente</button>`+
      `</div>`;
  }catch(e){
    out.textContent = "Errore controllo materia: " + e.message;
  }
}
window.checkPdfSubject = checkPdfSubject;


/* ===== V23 DASHBOARD STATISTICHE INTERATTIVA ===== */
function getAllCardsWithDeck(){
  const result = [];
  (db.decks || []).forEach(deck=>{
    (deck.cards || []).forEach(card=>{
      result.push({deck, card});
    });
  });
  return result;
}

function getDueCards(){
  return getAllCardsWithDeck().filter(x => (x.card.due || today()) <= today());
}

function openStatsPanel(title, html){
  const panel = document.querySelector("#statsDetailPanel");
  const titleEl = document.querySelector("#statsDetailTitle");
  const content = document.querySelector("#statsDetailContent");
  if(!panel || !titleEl || !content) return;
  titleEl.textContent = title;
  content.innerHTML = html;
  panel.classList.remove("hidden");
  panel.scrollIntoView({behavior:"smooth", block:"start"});
}

function showAllFlashcardsStats(){
  const all = getAllCardsWithDeck();
  if(!all.length){
    openStatsPanel("Tutte le flashcard", '<div class="item">Nessuna flashcard salvata.</div>');
    return;
  }

  const grouped = {};
  all.forEach(({deck, card})=>{
    const key = deck.topic || deck.name || "Senza materia";
    grouped[key] = grouped[key] || [];
    grouped[key].push({deck, card});
  });

  let html = "";
  Object.entries(grouped).forEach(([subject, items])=>{
    html += `<div class="item"><b>${esc(subject)}</b><div class="small">${items.length} flashcard</div>`;
    html += `<div class="itemActions"><button type="button" onclick="startReviewBySubject('${escAttr(subject)}')">Studia questa materia</button></div></div>`;
  });

  openStatsPanel("Tutte le flashcard", html);
}

function showDueReviewStats(){
  const due = getDueCards();
  if(!due.length){
    openStatsPanel("Ripassi di oggi", '<div class="item">Nessuna scheda da ripassare oggi.</div>');
    return;
  }

  const grouped = {};
  due.forEach(({deck, card})=>{
    const key = deck.topic || deck.name || "Senza materia";
    grouped[key] = grouped[key] || [];
    grouped[key].push({deck, card});
  });

  let html = `
    <div class="item">
      <b>${due.length} schede da ripassare</b>
      <div class="small">Seleziona un gruppo oppure avvia tutto il ripasso.</div>
      <div class="itemActions">
        <button type="button" onclick="startSelectedReview('all')">Ripassa tutte</button>
        <button type="button" class="secondary" onclick="startSelectedQuizFromDue()">Quiz dai ripassi</button>
      </div>
    </div>
  `;

  Object.entries(grouped).forEach(([subject, items])=>{
    html += `
      <div class="item">
        <b>${esc(subject)}</b>
        <div class="small">${items.length} schede da ripassare</div>
        <div class="itemActions">
          <button type="button" onclick="startSelectedReview('${escAttr(subject)}')">Ripassa</button>
          <button type="button" class="secondary" onclick="previewDueCards('${escAttr(subject)}')">Vedi schede</button>
        </div>
      </div>
    `;
  });

  openStatsPanel("Ripassi di oggi", html);
}

function previewDueCards(subject){
  const due = getDueCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return subject === "all" || key === subject;
  });

  let html = `
    <div class="item">
      <b>${due.length} schede selezionate</b>
      <div class="itemActions">
        <button type="button" onclick="startSelectedReview('${escAttr(subject)}')">Avvia ripasso</button>
      </div>
    </div>
  `;

  due.slice(0,50).forEach(({deck, card}, i)=>{
    html += `
      <div class="item">
        <b>${i+1}. ${esc(card.q || "")}</b>
        <div class="small">${esc(deck.name || "")} • scadenza: ${esc(card.due || today())}</div>
      </div>
    `;
  });

  openStatsPanel("Schede da ripassare", html);
}

function startSelectedReview(subject){
  const due = getDueCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return subject === "all" || key === subject;
  });

  if(!due.length) return alert("Nessuna scheda da ripassare.");

  const tempDeck = {
    id: "temp_due_" + Date.now(),
    name: subject === "all" ? "Ripassi di oggi" : "Ripassi - " + subject,
    topic: subject === "all" ? "Ripassi" : subject,
    cards: due.map(x=>x.card)
  };

  currentStudy = {
    deck: tempDeck,
    queue: [...tempDeck.cards].sort(()=>Math.random()-0.5),
    card: null
  };

  showView("study");
  nextStudy();
}

function startReviewBySubject(subject){
  const cards = getAllCardsWithDeck().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return key === subject;
  });

  if(!cards.length) return alert("Nessuna flashcard per questa materia.");

  const tempDeck = {
    id: "temp_subject_" + Date.now(),
    name: "Studio - " + subject,
    topic: subject,
    cards: cards.map(x=>x.card)
  };

  currentStudy = {
    deck: tempDeck,
    queue: [...tempDeck.cards].sort(()=>Math.random()-0.5),
    card: null
  };

  showView("study");
  nextStudy();
}

function startSelectedQuizFromDue(){
  const due = getDueCards();
  if(!due.length) return alert("Nessuna scheda da ripassare.");
  const questions = due.slice(0,20).map(({card})=>({
    q: card.q,
    a: card.a
  }));

  let html = '<div class="item"><b>Quiz rapido dai ripassi</b><div class="small">Rispondi mentalmente e poi controlla la risposta.</div></div>';
  questions.forEach((x,i)=>{
    html += `
      <div class="item">
        <b>${i+1}. ${esc(x.q || "")}</b>
        <details><summary>Mostra risposta</summary><div class="small">${esc(x.a || "")}</div></details>
      </div>
    `;
  });
  openStatsPanel("Quiz dai ripassi", html);
}

function showXpStats(){
  const xp = db.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  const next = level * 100;
  const remaining = Math.max(0, next - xp);
  openStatsPanel("XP e livello", `
    <div class="item">
      <b>${xp} XP</b>
      <div class="small">Livello attuale: ${level}</div>
      <div class="small">XP mancanti al prossimo livello: ${remaining}</div>
      <div class="progressBar"><span style="width:${Math.min(100, xp % 100)}%"></span></div>
    </div>
    <div class="item">
      <b>Come aumentare XP</b>
      <div class="small">+4 risposta difficile, +7 risposta media, +10 risposta facile.</div>
    </div>
  `);
}

function showLevelStats(){
  const xp = db.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  let title = "Studente";
  if(level >= 5) title = "Assistente";
  if(level >= 10) title = "Ricercatore";
  if(level >= 15) title = "Laureando";
  if(level >= 20) title = "Esperto CTF";

  openStatsPanel("Livello", `
    <div class="item">
      <b>Livello ${level}</b>
      <div class="small">Titolo: ${title}</div>
      <div class="small">Continua con ripassi, quiz e simulazioni orali per salire di livello.</div>
    </div>
  `);
}

function makeStatsCardsInteractive(){
  const statsView = document.querySelector("#stats");
  if(!statsView) return;

  const cards = [...statsView.querySelectorAll(".stat, .statCard, .card, .panel > div > div")];
  const labels = [...statsView.querySelectorAll("*")].filter(el => {
    const t = (el.textContent || "").toLowerCase();
    return t.includes("schede totali") || t.includes("ripassi") || t.includes("xp") || t.includes("livello");
  });

  // Metodo robusto: trova i contenitori più vicini ai testi
  labels.forEach(label=>{
    const t = (label.textContent || "").toLowerCase();
    const box = label.closest(".stat") || label.closest(".statCard") || label.closest(".item") || label.parentElement;
    if(!box || box.dataset.statsReady) return;
    box.dataset.statsReady = "1";
    box.style.cursor = "pointer";
    box.title = "Clicca per aprire il dettaglio";

    if(t.includes("schede totali")){
      box.addEventListener("click", showAllFlashcardsStats);
    }else if(t.includes("ripassi")){
      box.addEventListener("click", showDueReviewStats);
    }else if(t.includes("xp")){
      box.addEventListener("click", showXpStats);
    }else if(t.includes("livello")){
      box.addEventListener("click", showLevelStats);
    }
  });
}

const oldRenderStatsV23 = renderStats;
renderStats = function(){
  oldRenderStatsV23();
  setTimeout(makeStatsCardsInteractive, 100);
};

window.showAllFlashcardsStats = showAllFlashcardsStats;
window.showDueReviewStats = showDueReviewStats;
window.previewDueCards = previewDueCards;
window.startSelectedReview = startSelectedReview;
window.startReviewBySubject = startReviewBySubject;
window.startSelectedQuizFromDue = startSelectedQuizFromDue;
window.showXpStats = showXpStats;
window.showLevelStats = showLevelStats;

setTimeout(makeStatsCardsInteractive, 700);
refresh();


/* ===== V24 QUIZ PDF E ORALE PDF INTERATTIVI ===== */
let currentPdfQuiz = [];
let currentPdfQuizIndex = 0;
let currentPdfQuizScore = 0;
let currentPdfOralQuestions = [];
let currentPdfOralIndex = 0;

function showPdfInteractive(title){
  const panel = document.querySelector("#pdfInteractivePanel");
  const titleEl = document.querySelector("#pdfInteractiveTitle");
  if(!panel || !titleEl) return;
  titleEl.textContent = title;
  panel.classList.remove("hidden");
  panel.scrollIntoView({behavior:"smooth", block:"start"});
}

function setPdfInteractiveContent(html){
  const box = document.querySelector("#pdfInteractiveContent");
  if(box) box.innerHTML = html;
}

async function quizCurrentPdf(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");

  out.textContent = "Genero quiz interattivo dal PDF...";
  showPdfInteractive("Quiz interattivo dal PDF");
  setPdfInteractiveContent('<div class="item">Generazione quiz in corso...</div>');

  try{
    const r = await fetch(url + "/documents/quiz", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId,count:10})
    });

    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore quiz PDF");

    currentPdfQuiz = data.quiz || [];
    currentPdfQuizIndex = 0;
    currentPdfQuizScore = 0;

    if(!currentPdfQuiz.length){
      setPdfInteractiveContent('<div class="item">Nessuna domanda generata.</div>');
      return;
    }

    out.textContent = "Quiz generato. Rispondi alle domande nel pannello interattivo.";
    renderPdfQuizQuestion();

  }catch(e){
    out.textContent = "Errore quiz PDF: " + e.message;
    setPdfInteractiveContent('<div class="item">Errore quiz PDF: '+esc(e.message)+'</div>');
  }
}

function renderPdfQuizQuestion(){
  const q = currentPdfQuiz[currentPdfQuizIndex];
  if(!q){
    renderPdfQuizResult();
    return;
  }

  const options = q.options || [];
  let html = `
    <div class="item">
      <b>Domanda ${currentPdfQuizIndex + 1} di ${currentPdfQuiz.length}</b>
      <div class="small">Punteggio: ${currentPdfQuizScore}/${currentPdfQuiz.length}</div>
    </div>
    <div class="item">
      <b>${esc(q.question || "")}</b>
      <div class="quizOptions">
  `;

  options.forEach((opt, i)=>{
    html += `<button type="button" class="quizOptionBtn" data-quiz-index="${i}">${String.fromCharCode(65+i)}) ${esc(String(opt || "").replace(/^[A-D]\)\s*/i, ""))}</button>`;
  });

  html += `
      </div>
      <div id="pdfQuizFeedback" class="aiBox hidden"></div>
    </div>
  `;

  setPdfInteractiveContent(html);
}

function answerPdfQuiz(selected){
  const q = currentPdfQuiz[currentPdfQuizIndex];
  const feedback = document.querySelector("#pdfQuizFeedback");
  if(!q || !feedback) return;

  const correct = String(selected).trim().toLowerCase() === String(q.answer || "").trim().toLowerCase();

  if(correct) currentPdfQuizScore++;

  feedback.classList.remove("hidden");
  feedback.textContent =
    (correct ? "✅ Risposta corretta!" : "❌ Risposta non corretta.") +
    "\\n\\nRisposta esatta: " + (q.answer || "-") +
    "\\n\\nSpiegazione: " + (q.explanation || "-");

  const buttons = document.querySelectorAll(".quizOptionBtn");
  buttons.forEach(btn=>btn.disabled = true);

  const box = document.querySelector("#pdfInteractiveContent");
  box.insertAdjacentHTML("beforeend", `
    <div class="actions">
      <button type="button" onclick="nextPdfQuizQuestion()">Domanda successiva</button>
      <button type="button" class="secondary" onclick="renderPdfQuizResult()">Termina quiz</button>
    </div>
  `);
}

function nextPdfQuizQuestion(){
  currentPdfQuizIndex++;
  if(currentPdfQuizIndex >= currentPdfQuiz.length){
    renderPdfQuizResult();
  }else{
    renderPdfQuizQuestion();
  }
}

function renderPdfQuizResult(){
  const total = currentPdfQuiz.length || 1;
  const percent = Math.round((currentPdfQuizScore / total) * 100);
  let giudizio = "Da ripassare";
  if(percent >= 60) giudizio = "Discreto";
  if(percent >= 75) giudizio = "Buono";
  if(percent >= 90) giudizio = "Ottimo";

  setPdfInteractiveContent(`
    <div class="item">
      <b>Quiz completato</b>
      <div class="small">Punteggio: ${currentPdfQuizScore}/${total}</div>
      <div class="small">Percentuale: ${percent}%</div>
      <div class="small">Valutazione: ${giudizio}</div>
      <div class="progressBar"><span style="width:${percent}%"></span></div>
      <div class="itemActions">
        <button type="button" onclick="quizCurrentPdf()">Rifai quiz</button>
        <button type="button" class="secondary" onclick="oralQuestionsCurrentPdf()">Passa a domande orali</button>
      </div>
    </div>
  `);
}

async function oralQuestionsCurrentPdf(){
  const url = getWorkerUrl();
  const userId = db.settings?.userId;
  const out = document.querySelector("#pdfChatAnswer");
  if(!currentPdfChatDocId) return alert("Seleziona un documento.");

  out.textContent = "Genero domande orali interattive dal PDF...";
  showPdfInteractive("Simulazione orale dal PDF");
  setPdfInteractiveContent('<div class="item">Generazione domande orali in corso...</div>');

  try{
    const r = await fetch(url + "/documents/oral-questions", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({userId,id:currentPdfChatDocId,count:6})
    });

    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore orale PDF");

    currentPdfOralQuestions = data.questions || [];
    currentPdfOralIndex = 0;

    if(!currentPdfOralQuestions.length){
      setPdfInteractiveContent('<div class="item">Nessuna domanda orale generata.</div>');
      return;
    }

    out.textContent = "Domande orali generate. Rispondi una domanda alla volta.";
    renderPdfOralQuestion();

  }catch(e){
    out.textContent = "Errore domande orali PDF: " + e.message;
    setPdfInteractiveContent('<div class="item">Errore domande orali PDF: '+esc(e.message)+'</div>');
  }
}

function renderPdfOralQuestion(){
  const q = currentPdfOralQuestions[currentPdfOralIndex];
  if(!q){
    setPdfInteractiveContent('<div class="item"><b>Simulazione orale completata.</b></div>');
    return;
  }

  setPdfInteractiveContent(`
    <div class="item">
      <b>Domanda orale ${currentPdfOralIndex + 1} di ${currentPdfOralQuestions.length}</b>
      <div class="small">${esc(currentPdfChatDoc?.title || "")}</div>
    </div>
    <div class="item">
      <b>${esc(q)}</b>
      <label>Scrivi la tua risposta</label>
      <textarea id="pdfOralStudentAnswer" rows="6" placeholder="Scrivi qui la risposta come se fossi all'orale..."></textarea>
      <div class="itemActions">
        <button type="button" onclick="evaluatePdfOralAnswer()">Valuta risposta</button>
        <button type="button" class="secondary" onclick="nextPdfOralQuestion()">Salta</button>
      </div>
      <div id="pdfOralFeedback" class="aiBox hidden"></div>
    </div>
  `);
}

async function evaluatePdfOralAnswer(){
  const url = getWorkerUrl();
  const answer = document.querySelector("#pdfOralStudentAnswer")?.value.trim();
  const feedback = document.querySelector("#pdfOralFeedback");
  const question = currentPdfOralQuestions[currentPdfOralIndex];

  if(!answer) return alert("Scrivi prima la risposta.");
  if(!feedback) return;

  feedback.classList.remove("hidden");
  feedback.textContent = "Valutazione risposta in corso...";

  try{
    const r = await fetch(url + "/oral", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        topic: currentPdfChatDoc?.subject || "Documento PDF",
        question,
        answer
      })
    });

    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Errore valutazione orale");

    feedback.textContent =
      `Voto simulato: ${data.vote30}/30\\n`+
      `Correttezza: ${data.correctness}%\\n`+
      `Completezza: ${data.completeness}%\\n`+
      `Chiarezza: ${data.clarity}%\\n\\n`+
      `Feedback:\\n${data.feedback}\\n\\n`+
      `Punti mancanti:\\n${(data.missing_points||[]).join("\\n")}\\n\\n`+
      `Risposta migliorata:\\n${data.improved_answer}`;

    const box = document.querySelector("#pdfInteractiveContent");
    box.insertAdjacentHTML("beforeend", `
      <div class="actions">
        <button type="button" onclick="nextPdfOralQuestion()">Domanda successiva</button>
        <button type="button" class="secondary" onclick="oralQuestionsCurrentPdf()">Ricomincia orale</button>
      </div>
    `);

  }catch(e){
    feedback.textContent = "Errore valutazione orale: " + e.message;
  }
}

function nextPdfOralQuestion(){
  currentPdfOralIndex++;
  if(currentPdfOralIndex >= currentPdfOralQuestions.length){
    setPdfInteractiveContent(`
      <div class="item">
        <b>Simulazione orale completata.</b>
        <div class="itemActions">
          <button type="button" onclick="oralQuestionsCurrentPdf()">Nuova simulazione</button>
          <button type="button" class="secondary" onclick="quizCurrentPdf()">Genera quiz</button>
        </div>
      </div>
    `);
  }else{
    renderPdfOralQuestion();
  }
}

window.quizCurrentPdf = quizCurrentPdf;
window.answerPdfQuiz = answerPdfQuiz;
window.nextPdfQuizQuestion = nextPdfQuizQuestion;
window.renderPdfQuizResult = renderPdfQuizResult;
window.oralQuestionsCurrentPdf = oralQuestionsCurrentPdf;
window.renderPdfOralQuestion = renderPdfOralQuestion;
window.evaluatePdfOralAnswer = evaluatePdfOralAnswer;
window.nextPdfOralQuestion = nextPdfOralQuestion;


/* ===== V26 FIX DEFINITIVO QUIZ PDF - EVENT DELEGATION ===== */
document.addEventListener("click", function(e){
  const btn = e.target.closest(".quizOptionBtn");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const idx = Number(btn.dataset.quizIndex);
  if(Number.isNaN(idx)){
    alert("Errore: indice risposta non valido.");
    return;
  }

  answerPdfQuizIndex(idx);
}, true);

function answerPdfQuizIndex(index){
  const q = currentPdfQuiz[currentPdfQuizIndex];
  if(!q) return alert("Domanda non trovata.");

  const options = q.options || [];
  const selected = options[index] || "";
  answerPdfQuiz(selected, index);
}

function answerPdfQuiz(selected, selectedIndex = -1){
  const q = currentPdfQuiz[currentPdfQuizIndex];
  const feedback = document.querySelector("#pdfQuizFeedback");
  if(!q || !feedback) return alert("Feedback quiz non trovato.");

  const selectedClean = normalizeQuizTextV26(selected);
  const answerClean = normalizeQuizTextV26(q.answer);

  let correct = selectedClean === answerClean;

  const selectedLetter = selectedIndex >= 0 ? String.fromCharCode(65 + selectedIndex).toLowerCase() : "";
  const rawAnswer = String(q.answer || "").trim();
  const answerLetter = rawAnswer.charAt(0).toLowerCase();

  if(!correct && selectedLetter && ["a","b","c","d"].includes(answerLetter) && selectedLetter === answerLetter){
    correct = true;
  }

  if(!correct && rawAnswer.match(/^[A-D]\)/i) && selectedLetter === answerLetter){
    correct = true;
  }

  if(correct) currentPdfQuizScore++;

  feedback.classList.remove("hidden");
  feedback.textContent =
    (correct ? "✅ Risposta corretta!" : "❌ Risposta non corretta.") +
    "\n\nRisposta esatta: " + (q.answer || "-") +
    "\n\nSpiegazione: " + (q.explanation || "-");

  document.querySelectorAll(".quizOptionBtn").forEach((b, i)=>{
    b.disabled = true;
    if(i === selectedIndex) b.classList.add(correct ? "quizCorrect" : "quizWrong");
  });

  const box = document.querySelector("#pdfInteractiveContent");
  if(box && !document.querySelector("#pdfQuizNextActions")){
    box.insertAdjacentHTML("beforeend", `
      <div class="actions" id="pdfQuizNextActions">
        <button type="button" onclick="nextPdfQuizQuestion()">Domanda successiva</button>
        <button type="button" class="secondary" onclick="renderPdfQuizResult()">Termina quiz</button>
      </div>
    `);
  }
}

function normalizeQuizTextV26(value){
  return String(value || "")
    .replace(/^[A-D]\)\s*/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .toLowerCase();
}

window.answerPdfQuizIndex = answerPdfQuizIndex;
window.answerPdfQuiz = answerPdfQuiz;


/* ===== V27 FIX DEFINITIVO CLICK STATISTICHE HOME + STATISTICHE ===== */
function v27AllCards(){
  const list = [];
  (db.decks || []).forEach(deck=>{
    (deck.cards || []).forEach(card=>list.push({deck, card}));
  });
  return list;
}

function v27DueCards(){
  const todayStr = today();
  return v27AllCards().filter(x => (x.card.due || todayStr) <= todayStr);
}

function v27EnsureStatsPanel(){
  let panel = document.querySelector("#statsDetailPanel");
  if(panel) return panel;

  const statsView = document.querySelector("#stats");
  if(!statsView) return null;

  panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "statsDetailPanel";
  panel.innerHTML = `
    <h3 id="statsDetailTitle">Dettaglio</h3>
    <div id="statsDetailContent" class="list"></div>
  `;
  statsView.appendChild(panel);
  return panel;
}

function v27OpenStatsPanel(title, bodyHtml){
  showView("stats");
  setTimeout(()=>{
    const panel = v27EnsureStatsPanel();
    if(!panel) return;
    panel.querySelector("#statsDetailTitle").textContent = title;
    panel.querySelector("#statsDetailContent").innerHTML = bodyHtml;
    panel.scrollIntoView({behavior:"smooth", block:"start"});
  },120);
}

function v27ShowAllCards(){
  const all = v27AllCards();
  if(!all.length){
    v27OpenStatsPanel("Tutte le flashcard", '<div class="item">Nessuna flashcard salvata.</div>');
    return;
  }

  const grouped = {};
  all.forEach(({deck,card})=>{
    const key = deck.topic || deck.name || "Senza materia";
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push({deck,card});
  });

  let html = "";
  Object.entries(grouped).forEach(([subject, items])=>{
    html += `
      <div class="item">
        <b>${esc(subject)}</b>
        <div class="small">${items.length} flashcard</div>
        <div class="itemActions">
          <button type="button" onclick="v27StartStudySubject('${escAttr(subject)}')">Studia materia</button>
          <button type="button" class="secondary" onclick="v27PreviewSubject('${escAttr(subject)}')">Vedi schede</button>
        </div>
      </div>
    `;
  });

  v27OpenStatsPanel("Tutte le flashcard", html);
}

function v27ShowDueCards(){
  const due = v27DueCards();
  if(!due.length){
    v27OpenStatsPanel("Ripassi", '<div class="item">Nessuna scheda da ripassare oggi.</div>');
    return;
  }

  const grouped = {};
  due.forEach(({deck,card})=>{
    const key = deck.topic || deck.name || "Senza materia";
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push({deck,card});
  });

  let html = `
    <div class="item">
      <b>${due.length} schede da ripassare</b>
      <div class="small">Puoi ripassarle tutte oppure scegliere una materia.</div>
      <div class="itemActions">
        <button type="button" onclick="v27StartDueReview('all')">Ripassa tutte</button>
        <button type="button" class="secondary" onclick="v27QuickQuizDue()">Quiz rapido</button>
      </div>
    </div>
  `;

  Object.entries(grouped).forEach(([subject,items])=>{
    html += `
      <div class="item">
        <b>${esc(subject)}</b>
        <div class="small">${items.length} da ripassare</div>
        <div class="itemActions">
          <button type="button" onclick="v27StartDueReview('${escAttr(subject)}')">Ripassa questa materia</button>
          <button type="button" class="secondary" onclick="v27PreviewDue('${escAttr(subject)}')">Vedi schede</button>
        </div>
      </div>
    `;
  });

  v27OpenStatsPanel("Ripassi", html);
}

function v27PreviewDue(subject){
  const cards = v27DueCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return subject === "all" || key === subject;
  });

  let html = `
    <div class="item">
      <b>${cards.length} schede selezionate</b>
      <div class="itemActions">
        <button type="button" onclick="v27StartDueReview('${escAttr(subject)}')">Avvia ripasso</button>
      </div>
    </div>
  `;

  cards.slice(0,80).forEach(({deck,card},i)=>{
    html += `
      <div class="item">
        <b>${i+1}. ${esc(card.q || "")}</b>
        <div class="small">${esc(deck.name || "")} • scadenza ${esc(card.due || today())}</div>
      </div>
    `;
  });

  v27OpenStatsPanel("Schede da ripassare", html);
}

function v27PreviewSubject(subject){
  const cards = v27AllCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return key === subject;
  });

  let html = `
    <div class="item">
      <b>${cards.length} schede in ${esc(subject)}</b>
      <div class="itemActions">
        <button type="button" onclick="v27StartStudySubject('${escAttr(subject)}')">Studia materia</button>
      </div>
    </div>
  `;

  cards.slice(0,80).forEach(({deck,card},i)=>{
    html += `
      <div class="item">
        <b>${i+1}. ${esc(card.q || "")}</b>
        <div class="small">${esc(deck.name || "")}</div>
      </div>
    `;
  });

  v27OpenStatsPanel("Flashcard materia", html);
}

function v27StartDueReview(subject){
  const selected = v27DueCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return subject === "all" || key === subject;
  });

  if(!selected.length) return alert("Nessuna scheda da ripassare.");

  currentStudy = {
    deck: {
      id: "v27_due_" + Date.now(),
      name: subject === "all" ? "Ripassi di oggi" : "Ripassi - " + subject,
      topic: subject === "all" ? "Ripassi" : subject,
      cards: selected.map(x=>x.card)
    },
    queue: selected.map(x=>x.card).sort(()=>Math.random()-0.5),
    card: null
  };

  showView("study");
  nextStudy();
}

function v27StartStudySubject(subject){
  const selected = v27AllCards().filter(({deck})=>{
    const key = deck.topic || deck.name || "Senza materia";
    return key === subject;
  });

  if(!selected.length) return alert("Nessuna flashcard trovata.");

  currentStudy = {
    deck: {
      id: "v27_subject_" + Date.now(),
      name: "Studio - " + subject,
      topic: subject,
      cards: selected.map(x=>x.card)
    },
    queue: selected.map(x=>x.card).sort(()=>Math.random()-0.5),
    card: null
  };

  showView("study");
  nextStudy();
}

function v27QuickQuizDue(){
  const due = v27DueCards();
  if(!due.length) return alert("Nessuna scheda da ripassare.");

  let html = '<div class="item"><b>Quiz rapido dai ripassi</b><div class="small">Apri la risposta dopo aver provato mentalmente.</div></div>';
  due.slice(0,20).forEach(({card},i)=>{
    html += `
      <div class="item">
        <b>${i+1}. ${esc(card.q || "")}</b>
        <details>
          <summary>Mostra risposta</summary>
          <div class="small">${esc(card.a || "")}</div>
        </details>
      </div>
    `;
  });

  v27OpenStatsPanel("Quiz rapido dai ripassi", html);
}

function v27ShowXp(){
  const xp = Number(db.xp || 0);
  const level = Math.floor(xp / 100) + 1;
  const perc = xp % 100;
  v27OpenStatsPanel("XP", `
    <div class="item">
      <b>${xp} XP</b>
      <div class="small">Livello ${level}</div>
      <div class="small">Mancano ${100-perc} XP al prossimo livello</div>
      <div class="progressBar"><span style="width:${perc}%"></span></div>
    </div>
  `);
}

function v27ShowLevel(){
  const xp = Number(db.xp || 0);
  const level = Math.floor(xp / 100) + 1;
  let title = "Studente";
  if(level >= 5) title = "Assistente";
  if(level >= 10) title = "Ricercatore";
  if(level >= 15) title = "Laureando";
  if(level >= 20) title = "Esperto CTF";
  v27OpenStatsPanel("Livello", `
    <div class="item">
      <b>Livello ${level}</b>
      <div class="small">Titolo: ${title}</div>
      <div class="small">Studia, ripassa e completa quiz per aumentare il livello.</div>
    </div>
  `);
}

function v27AttachStatsClicks(){
  const labels = [
    {names:["mazzi","schede totali","flashcard"], fn:v27ShowAllCards},
    {names:["da ripassare","ripassi"], fn:v27ShowDueCards},
    {names:["xp"], fn:v27ShowXp},
    {names:["livello"], fn:v27ShowLevel}
  ];

  // Home + Statistiche: cerca card/riquadri che contengono queste etichette.
  const possibleCards = [...document.querySelectorAll(".stat, .statCard, .card, .panel div, #home .panel, #stats .panel")];

  possibleCards.forEach(card=>{
    if(card.dataset.v27StatsReady) return;
    const text = (card.textContent || "").toLowerCase();
    const match = labels.find(x => x.names.some(n => text.includes(n)));
    if(!match) return;

    // Evita di agganciare pannelli troppo grandi che contengono tutto.
    const rect = card.getBoundingClientRect();
    if(rect.width > window.innerWidth * 0.95 && text.length > 200) return;

    card.dataset.v27StatsReady = "1";
    card.classList.add("clickableStat");
    card.addEventListener("click", (e)=>{
      if(e.target.closest("button,input,textarea,select,a")) return;
      match.fn();
    });
  });
}

const oldRefreshV27 = refresh;
refresh = function(){
  oldRefreshV27();
  setTimeout(v27AttachStatsClicks, 150);
};

document.addEventListener("click", e=>{
  // Fallback: se clicca direttamente su un testo/numero dentro le statistiche.
  const t = (e.target.textContent || "").toLowerCase();
  if(!t) return;
  const inStats = e.target.closest("#stats") || e.target.closest("#home");
  if(!inStats) return;

  if(t.includes("da ripassare") || t.includes("ripassi")) v27ShowDueCards();
  else if(t.includes("mazzi") || t.includes("schede totali") || t.includes("flashcard")) v27ShowAllCards();
  else if(t.includes("xp")) v27ShowXp();
  else if(t.includes("livello")) v27ShowLevel();
}, false);

window.v27ShowAllCards = v27ShowAllCards;
window.v27ShowDueCards = v27ShowDueCards;
window.v27PreviewDue = v27PreviewDue;
window.v27PreviewSubject = v27PreviewSubject;
window.v27StartDueReview = v27StartDueReview;
window.v27StartStudySubject = v27StartStudySubject;
window.v27QuickQuizDue = v27QuickQuizDue;
window.v27ShowXp = v27ShowXp;
window.v27ShowLevel = v27ShowLevel;

setTimeout(v27AttachStatsClicks, 1000);
