export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null));
    try {
      if (url.pathname === "/db/init" && request.method === "POST") {
        await initDb(env);
        return cors(json({ ok: true, message: "Tabelle D1 create/verificate." }));
      }
      if (url.pathname === "/auth/login" && request.method === "POST") {
        await initDb(env);
        const { email, pin, name = "" } = await request.json();
        if (!email || !pin) return cors(json({ error: "Email e PIN obbligatori." }, 400));
        const userId = await userIdFrom(email, pin);
        const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO users (id,email,name,created_at,updated_at) VALUES (?1,?2,?3,?4,?4) ON CONFLICT(id) DO UPDATE SET email=?2,name=COALESCE(NULLIF(?3,''),name),updated_at=?4`).bind(userId,email.trim().toLowerCase(),name,now).run();
        return cors(json({ ok: true, userId }));
      }
      if (url.pathname === "/cloud/save" && request.method === "POST") {
        await initDb(env);
        const { userId, data } = await request.json();
        if (!userId || !data) return cors(json({ error: "userId e data obbligatori." }, 400));
        const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO cloud_data (user_id,data,updated_at) VALUES (?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET data=?2,updated_at=?3`).bind(userId,JSON.stringify(data),now).run();
        await saveCtfSubjects(env,userId);
        return cors(json({ ok: true, updated_at: now }));
      }
      if (url.pathname === "/cloud/load" && request.method === "POST") {
        await initDb(env);
        const { userId } = await request.json();
        if (!userId) return cors(json({ error: "userId obbligatorio." }, 400));
        const row = await env.DB.prepare(`SELECT data,updated_at FROM cloud_data WHERE user_id=?1`).bind(userId).first();
        if (!row) return cors(json({ ok: true, data: null }));
        return cors(json({ ok: true, data: JSON.parse(row.data), updated_at: row.updated_at }));
      }
      if (url.pathname === "/subjects" && request.method === "POST") {
        await initDb(env);
        const { userId } = await request.json();
        const rows = await env.DB.prepare(`SELECT * FROM subjects WHERE user_id=?1 ORDER BY name`).bind(userId).all();
        return cors(json({ ok: true, subjects: rows.results || [] }));
      }


      if (url.pathname === "/documents/upload" && request.method === "POST") {
        await initDb(env);
        if (!env.FILES) return cors(json({ error: "Binding R2 mancante. Aggiungi un bucket R2 con variable name FILES." }, 500));

        const { userId, subject = "", title = "", fileName = "documento", mimeType = "application/octet-stream", base64 = "", textContent = "" } = await request.json();
        if (!userId) return cors(json({ error: "userId obbligatorio." }, 400));
        if (!base64) return cors(json({ error: "File mancante." }, 400));

        const id = crypto.randomUUID();
        const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]+/g, "_");
        const r2Key = `${userId}/documents/${id}_${safeName}`;
        const bytes = base64ToUint8Array(base64);

        await env.FILES.put(r2Key, bytes, {
          httpMetadata: { contentType: mimeType },
          customMetadata: { userId, subject, title, fileName: safeName }
        });

        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO documents (id,user_id,subject,title,file_name,mime_type,r2_key,size,text_content,created_at,updated_at)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)
        `).bind(id,userId,subject,title || safeName,safeName,mimeType,r2Key,bytes.length,String(textContent || "").slice(0,250000),now).run();

        return cors(json({ ok: true, id, r2Key, size: bytes.length }));
      }

      if (url.pathname === "/documents/list" && request.method === "POST") {
        await initDb(env);
        const { userId, q = "" } = await request.json();
        if (!userId) return cors(json({ error: "userId obbligatorio." }, 400));

        const search = `%${String(q || "").toLowerCase()}%`;
        const rows = q
          ? await env.DB.prepare(`
              SELECT id,subject,title,file_name,mime_type,size,created_at,updated_at,
                     substr(text_content,1,500) AS preview
              FROM documents
              WHERE user_id=?1 AND (
                lower(title) LIKE ?2 OR lower(subject) LIKE ?2 OR lower(file_name) LIKE ?2 OR lower(text_content) LIKE ?2
              )
              ORDER BY updated_at DESC
            `).bind(userId,search).all()
          : await env.DB.prepare(`
              SELECT id,subject,title,file_name,mime_type,size,created_at,updated_at,
                     substr(text_content,1,500) AS preview
              FROM documents
              WHERE user_id=?1
              ORDER BY updated_at DESC
            `).bind(userId).all();

        return cors(json({ ok: true, documents: rows.results || [] }));
      }

      if (url.pathname === "/documents/content" && request.method === "POST") {
        await initDb(env);
        const { userId, id } = await request.json();
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        return cors(json({ ok: true, document: row }));
      }

      if (url.pathname === "/documents/delete" && request.method === "POST") {
        await initDb(env);
        if (!env.FILES) return cors(json({ error: "Binding R2 mancante." }, 500));

        const { userId, id } = await request.json();
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT r2_key FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        await env.FILES.delete(row.r2_key);
        await env.DB.prepare(`DELETE FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).run();

        return cors(json({ ok: true }));
      }

      if (url.pathname === "/documents/download" && request.method === "GET") {
        await initDb(env);
        if (!env.FILES) return cors(json({ error: "Binding R2 mancante." }, 500));

        const userId = url.searchParams.get("userId");
        const id = url.searchParams.get("id");
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        const object = await env.FILES.get(row.r2_key);
        if (!object) return cors(json({ error: "File non trovato in R2." }, 404));

        return cors(new Response(object.body, {
          headers: {
            "Content-Type": row.mime_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${row.file_name || "documento"}"`
          }
        }));
      }

      if (url.pathname === "/backup/r2" && request.method === "POST") {
        await initDb(env);
        if (!env.FILES) return cors(json({ error: "Binding R2 mancante. Aggiungi un bucket R2 con variable name FILES." }, 500));

        const { userId, data } = await request.json();
        if (!userId || !data) return cors(json({ error: "userId e data obbligatori." }, 400));

        const now = new Date().toISOString();
        const key = `${userId}/backups/backup_${now.replace(/[:.]/g,"-")}.json`;
        await env.FILES.put(key, JSON.stringify(data,null,2), {
          httpMetadata: { contentType: "application/json" },
          customMetadata: { userId, type: "backup" }
        });

        return cors(json({ ok: true, key }));
      }



      if (url.pathname === "/documents/ask" && request.method === "POST") {
        await initDb(env);
        const { userId, id, question } = await request.json();
        if (!userId || !id || !question) return cors(json({ error: "userId, id documento e domanda obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));
        if (!row.text_content) return cors(json({ error: "Il documento non ha testo estratto." }, 400));

        const prompt = `
Rispondi in italiano alla domanda usando SOLO il testo del documento fornito.
Non inventare informazioni. Se la risposta non è nel documento, dillo chiaramente.
Non usare Markdown pesante.

TITOLO DOCUMENTO:
${row.title}

MATERIA COLLEGATA:
${row.subject}

TESTO DOCUMENTO:
${String(row.text_content).slice(0,50000)}

DOMANDA:
${question}

STRUTTURA RISPOSTA:
Risposta
Punti principali
Eventuali riferimenti al testo
`;
        return cors(json({ ok:true, result: await callAiCached(env,prompt,false), document:{id:row.id,title:row.title,subject:row.subject} }));
      }

      if (url.pathname === "/documents/quiz" && request.method === "POST") {
        await initDb(env);
        const { userId, id, count = 10 } = await request.json();
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        const prompt = `
Crea ${count} domande quiz in italiano basate SOLO sul testo del documento.
Rispondi SOLO con JSON valido:
{
  "quiz":[
    {
      "question":"domanda",
      "options":["A","B","C","D"],
      "answer":"risposta esatta",
      "explanation":"spiegazione breve basata sul documento"
    }
  ]
}

Documento:
${String(row.text_content||"").slice(0,50000)}
`;
        return cors(json(JSON.parse(cleanJson(await callAiCached(env,prompt,true)))));
      }

      if (url.pathname === "/documents/oral-questions" && request.method === "POST") {
        await initDb(env);
        const { userId, id, count = 5 } = await request.json();
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        const prompt = `
Crea ${count} domande orali da professore universitario basate SOLO sul testo del documento.
Non dare le risposte.
Rispondi SOLO con JSON valido:
{
  "questions":["domanda 1","domanda 2"]
}

Documento:
${String(row.text_content||"").slice(0,50000)}
`;
        return cors(json(JSON.parse(cleanJson(await callAiCached(env,prompt,true)))));
      }

      if (url.pathname === "/documents/check-subject" && request.method === "POST") {
        await initDb(env);
        const { userId, id } = await request.json();
        if (!userId || !id) return cors(json({ error: "userId e id documento obbligatori." }, 400));

        const row = await env.DB.prepare(`SELECT * FROM documents WHERE user_id=?1 AND id=?2`).bind(userId,id).first();
        if (!row) return cors(json({ error: "Documento non trovato." }, 404));

        const prompt = `
Analizza il documento e confrontalo con la materia collegata.

Materia collegata nell'app:
${row.subject}

Titolo:
${row.title}

Testo:
${String(row.text_content||"").slice(0,40000)}

Regole:
- Se la materia collegata è generica o diversa dall'argomento reale, matches deve essere false.
- Se il documento parla di economia, lavoro, salari, contrattazione, sociologia o diritto del lavoro e la materia collegata è Chimica, Farmacologia, CTF o simili, matches deve essere false.
- Nel warning spiega chiaramente la differenza.
- suggested_subject deve proporre una materia più adatta.

Rispondi SOLO con JSON valido:
{
  "detected_subject":"materia o area reale del documento",
  "matches":false,
  "warning":"avviso se la materia non corrisponde, altrimenti stringa vuota",
  "suggested_subject":"materia consigliata"
}
`;
        return cors(json(JSON.parse(cleanJson(await callAiCached(env,prompt,true)))));
      }


      if (["/generate","/summary","/explain","/oral-question","/oral","/drug","/reaction","/documents/ask","/documents/quiz","/documents/oral-questions","/documents/check-subject"].includes(url.pathname) && !env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
        return cors(json({ error: "Manca una chiave AI. Inserisci GEMINI_API_KEY oppure OPENROUTER_API_KEY nei secret del Worker." }, 500));
      }
      if (url.pathname === "/generate" && request.method === "POST") {
        const { text, topic = "", count = 12 } = await request.json();

        const sourceText = String(text || "").trim();
        if (!sourceText) {
          return cors(json({ error: "Nessun testo ricevuto. Carica un PDF, immagine o incolla degli appunti." }, 400));
        }

        const selectedTopic = String(topic || "").trim();
        const chunks = splitText(sourceText, 24000);
        const cardsPerChunk = Math.max(4, Math.ceil(Number(count || 12) / chunks.length));
        let allCards = [];
        let detectedTopics = [];
        let warnings = [];

        for (let i = 0; i < chunks.length; i++) {
          const prompt = `
Analizza attentamente questa parte del documento.

REGOLE OBBLIGATORIE:
- Devi basarti ESCLUSIVAMENTE sul contenuto del documento.
- Non inventare informazioni.
- Non usare conoscenze esterne se non strettamente necessario per chiarire una risposta già presente nel testo.
- Non assumere che il documento riguardi CTF, chimica, farmacologia o università.
- Il campo "Materia selezionata" serve SOLO come etichetta organizzativa dell'app.
- Se la materia selezionata non corrisponde al documento, devi indicarlo chiaramente nel campo "warning".
- Le flashcard devono riguardare soltanto ciò che è scritto nel documento.
- Le risposte devono essere chiare, fedeli e concise.

Materia selezionata nell'app:
${selectedTopic || "Nessuna materia selezionata"}

Parte del documento:
${chunks[i]}

COMPITI:
1. Identifica l'argomento reale di questa parte del documento.
2. Confronta l'argomento reale con la materia selezionata.
3. Se sono diversi, scrivi un avviso chiaro nel campo "warning".
4. Crea ${cardsPerChunk} flashcard basate SOLO su questa parte del documento.

Rispondi SOLO con JSON valido:
{
  "detected_topic": "argomento realmente rilevato dal documento",
  "warning": "avviso se la materia selezionata non corrisponde al documento, altrimenti stringa vuota",
  "cards": [
    {
      "question": "domanda basata sul documento",
      "answer": "risposta basata sul documento"
    }
  ]
}
`;
          const parsed = JSON.parse(cleanJson(await callAiCached(env, prompt, true)));
          if (parsed.detected_topic) detectedTopics.push(parsed.detected_topic);
          if (parsed.warning) warnings.push(parsed.warning);
          if (Array.isArray(parsed.cards)) allCards.push(...parsed.cards);
        }

        const detectedTopic = mergeTopics(detectedTopics);
        let warning = [...new Set(warnings)].join(" ");

        if (selectedTopic && detectedTopic && !topicLooksRelated(selectedTopic, detectedTopic)) {
          warning = warning || `Attenzione: la materia selezionata è "${selectedTopic}", ma il documento sembra trattare "${detectedTopic}". Le flashcard sono state generate sul contenuto reale del documento.`;
        }

        return cors(json({
          detected_topic: detectedTopic,
          warning,
          chunks_analyzed: chunks.length,
          text_length: sourceText.length,
          cards: allCards.slice(0, Math.max(Number(count || 12), allCards.length))
        }));
      }
      if (url.pathname === "/summary" && request.method === "POST") {
        const { text, topic = "CTF" } = await request.json();
        const prompt = `
Crea un riassunto universitario chiaro in italiano sull'argomento: ${topic}.

IMPORTANTE FORMATTAZIONE:
- Non usare Markdown.
- Non usare simboli come ##, ###, **, ---, *.
- Scrivi testo pulito, ordinato e leggibile.
- Usa titoli semplici in maiuscolo.
- Usa elenchi numerati solo quando utili.
- Mantieni un tono professionale ma facile da studiare.

STRUTTURA:
TITOLO
RIASSUNTO
CONCETTI CHIAVE
FORMULE / MECCANISMI / REAZIONI se presenti
POSSIBILI DOMANDE D'ESAME

Testo:
${String(text).slice(0,30000)}
`;
        return cors(json({ result: await callAiCached(env, prompt, false) }));
      }
      if (url.pathname === "/explain" && request.method === "POST") {
        const { text, topic = "CTF" } = await request.json();
        const prompt = `
Spiega in italiano semplice ma adatto a uno studente universitario CTF l'argomento: ${topic}.

IMPORTANTE FORMATTAZIONE:
- Non usare Markdown.
- Non usare simboli come ##, ###, **, ---, *.
- Scrivi in modo pulito e leggibile.
- Usa titoli brevi.
- Usa frasi chiare.
- Evidenzia definizioni, meccanismi e collegamenti pratici.

STRUTTURA:
SPIEGAZIONE SEMPLICE
PERCHÉ È IMPORTANTE
ESEMPIO PRATICO
DA RICORDARE ALL'ESAME

Testo / richiesta:
${String(text).slice(0,30000)}
`;
        return cors(json({ result: await callAiCached(env, prompt, false) }));
      }

      if (url.pathname === "/oral-question" && request.method === "POST") {
        const { topic = "CTF", context = "", level = "universitario" } = await request.json();
        const prompt = `
Genera UNA sola domanda orale da professore universitario per uno studente di CTF.

Materia/argomento:
${topic}

Contesto di studio, se presente:
${String(context || "").slice(0,12000)}

REGOLE:
- La domanda deve essere autonoma e chiara.
- Deve essere adatta a un esame orale universitario.
- Deve basarsi sull'argomento indicato o sul contesto fornito.
- Non usare Markdown.
- Non aggiungere spiegazioni.
- Non dare la risposta.
- Deve sembrare una domanda reale di un professore.

Rispondi SOLO con JSON valido:
{
  "question": "domanda orale"
}
`;
        return cors(json(JSON.parse(cleanJson(await callAiCached(env, prompt, true)))));
      }

      if (url.pathname === "/oral" && request.method === "POST") {
        const { question, answer, topic = "CTF" } = await request.json();
        const prompt = `Valuta questa risposta orale universitaria per CTF. Argomento: ${topic}. Domanda: ${question}. Risposta studente: ${answer}. Rispondi SOLO con JSON: {"vote30":numero_da_18_a_30,"correctness":0_100,"completeness":0_100,"clarity":0_100,"feedback":"commento","missing_points":["..."],"improved_answer":"risposta migliorata"}`;
        return cors(json(JSON.parse(cleanJson(await callAiCached(env, prompt, true)))));
      }
      if (url.pathname === "/drug" && request.method === "POST") {
        const { drug } = await request.json();
        const prompt = `
Crea una scheda di studio CTF sul farmaco: ${drug}.

IMPORTANTE FORMATTAZIONE:
- Non usare Markdown.
- Non usare simboli come ##, ###, **, ---, *.
- Scrivi in modo pulito e ordinato.
- Usa titoli semplici in maiuscolo.

STRUTTURA:
NOME DEL FARMACO
CLASSE FARMACOLOGICA
MECCANISMO D'AZIONE
INDICAZIONI PRINCIPALI
FARMACOCINETICA ESSENZIALE
EFFETTI AVVERSI
CONTROINDICAZIONI
INTERAZIONI IMPORTANTI
DOMANDE D'ESAME PROBABILI
`;
        return cors(json({ result: await callAiCached(env, prompt, false) }));
      }
      if (url.pathname === "/reaction" && request.method === "POST") {
        const { reaction } = await request.json();
        return cors(json({ result: await callAiCached(env, `Spiega per uno studente CTF questa reazione: ${reaction}. Includi reagenti, meccanismo, prodotto principale, condizioni, errori comuni e quiz finale.`, false) }));
      }


      if (url.pathname === "/tts-gemini" && request.method === "POST") {
        const { text, voiceName = "Kore" } = await request.json();
        const cleanText = String(text || "").trim();
        if (!cleanText) return cors(json({ error: "Testo mancante." }, 400));
        if (!env.GEMINI_API_KEY) return cors(json({ error: "Manca GEMINI_API_KEY nei secret del Worker." }, 500));

        const ttsResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Leggi in italiano con voce naturale da tutor universitario: ${cleanText.slice(0, 3500)}` }]
            }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
                }
              }
            }
          })
        });

        const data = await ttsResponse.json();
        if (!ttsResponse.ok) return cors(json({ error: data.error?.message || "Errore Gemini TTS" }, 500));

        const inline = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
        if (!inline?.data) return cors(json({ error: "Gemini non ha restituito audio." }, 500));

        const pcm = base64ToUint8Array(inline.data);
        const wav = pcmToWav(pcm, 24000, 1, 16);

        return cors(new Response(wav, {
          headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" }
        }));
      }

      if (url.pathname === "/tts" && request.method === "POST") {
        const { text, voiceId = "", apiKey = "" } = await request.json();
        const cleanText = String(text || "").trim();
        if (!cleanText) return cors(json({ error: "Testo mancante." }, 400));

        const key = apiKey || env.ELEVENLABS_API_KEY;
        if (!key) return cors(json({ error: "Manca ELEVENLABS_API_KEY nei secret del Worker oppure API key locale." }, 500));

        const selectedVoice = voiceId || env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": key
          },
          body: JSON.stringify({
            text: cleanText.slice(0, 4500),
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
              style: 0.25,
              use_speaker_boost: true
            }
          })
        });

        if (!ttsResponse.ok) {
          let err = "";
          try { err = JSON.stringify(await ttsResponse.json()); } catch (_) { err = await ttsResponse.text(); }
          return cors(json({ error: "Errore ElevenLabs: " + err }, 500));
        }

        const audio = await ttsResponse.arrayBuffer();
        return cors(new Response(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store"
          }
        }));
      }

      return cors(json({ ok: true, name: "StudyFlash AI CTF Worker D1 V21 Auto Materia" }));
    } catch (e) { return cors(json({ error: e.message }, 500)); }
  }
};
async function initDb(env){
  if(!env.DB) throw new Error("Binding D1 mancante. Aggiungi il binding con nome DB.");
  const sql=[
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT,name TEXT,created_at TEXT,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS cloud_data (user_id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY,user_id TEXT,name TEXT,exam_date TEXT,cfu INTEGER,difficulty INTEGER,progress REAL DEFAULT 0,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY,user_id TEXT,subject_id TEXT,name TEXT,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY,user_id TEXT,chapter_id TEXT,question TEXT,answer TEXT,due_date TEXT,level INTEGER DEFAULT 0,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS statistics (id TEXT PRIMARY KEY,user_id TEXT,subject_id TEXT,xp INTEGER DEFAULT 0,studied_cards INTEGER DEFAULT 0,success_rate REAL DEFAULT 0,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS ai_cache (cache_key TEXT PRIMARY KEY,prompt_hash TEXT,provider TEXT,response TEXT,created_at TEXT,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,user_id TEXT,subject TEXT,title TEXT,file_name TEXT,mime_type TEXT,r2_key TEXT,size INTEGER,text_content TEXT,created_at TEXT,updated_at TEXT)`
  ];
  for(const s of sql) await env.DB.prepare(s).run();
}
async function saveCtfSubjects(env,userId){
  const now=new Date().toISOString();
  const subjects=["Chimica Generale","Chimica Organica I","Chimica Organica II","Biochimica","Farmacologia","Tecnologia Farmaceutica","Tossicologia","Fisiologia","Microbiologia","Analisi dei Farmaci","Legislazione Farmaceutica"];
  for(const name of subjects){
    const id="sub_"+slug(name)+"_"+userId.slice(0,8);
    await env.DB.prepare(`INSERT INTO subjects (id,user_id,name,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET updated_at=?4`).bind(id,userId,name,now).run();
  }
}
async function userIdFrom(email,pin){
  const data=new TextEncoder().encode(email.trim().toLowerCase()+"::"+pin);
  const hash=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function callAiCached(env, prompt, jsonMode) {
  const cacheKey = await hashText((jsonMode ? "json:" : "text:") + prompt);

  if (env.DB) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_cache (cache_key TEXT PRIMARY KEY,prompt_hash TEXT,provider TEXT,response TEXT,created_at TEXT,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,user_id TEXT,subject TEXT,title TEXT,file_name TEXT,mime_type TEXT,r2_key TEXT,size INTEGER,text_content TEXT,created_at TEXT,updated_at TEXT)`).run();
      const cached = await env.DB.prepare(`SELECT response FROM ai_cache WHERE cache_key=?1`).bind(cacheKey).first();
      if (cached && cached.response) return cached.response;
    } catch (_) {}
  }

  const result = await callMultiAi(env, prompt, jsonMode);

  if (env.DB && result.text) {
    try {
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO ai_cache (cache_key,prompt_hash,provider,response,created_at,updated_at) VALUES (?1,?1,?2,?3,?4,?4) ON CONFLICT(cache_key) DO UPDATE SET response=?3,provider=?2,updated_at=?4`)
        .bind(cacheKey, result.provider, result.text, now).run();
    } catch (_) {}
  }

  return result.text;
}

async function callMultiAi(env, prompt, jsonMode) {
  let errors = [];

  if (env.GEMINI_API_KEY) {
    try {
      const text = await callGeminiProvider(env, prompt, jsonMode);
      return { provider: "gemini", text };
    } catch (e) {
      errors.push("Gemini: " + e.message);
      if (!isQuotaError(e.message) && !env.OPENROUTER_API_KEY) throw e;
    }
  }

  if (env.OPENROUTER_API_KEY) {
    try {
      const text = await callOpenRouterProvider(env, prompt, jsonMode);
      return { provider: "openrouter", text };
    } catch (e) {
      errors.push("OpenRouter: " + e.message);
    }
  }

  throw new Error("Tutti i provider AI sono momentaneamente non disponibili. " + errors.join(" | "));
}

async function callGeminiProvider(env, prompt, jsonMode) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
    body: JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.3,...(jsonMode?{responseMimeType:"application/json"}:{})}
    })
  });
  const data = await response.json();
  if(!response.ok) throw new Error(data.error?.message || "Errore Gemini");
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenRouterProvider(env, prompt, jsonMode) {
  const model = env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://study-flash.github.io/Studyflash-/",
      "X-OpenRouter-Title": "StudyFlash AI CTF"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: jsonMode ? "Rispondi solo con JSON valido. Non usare Markdown." : "Rispondi in italiano chiaro, senza Markdown pesante." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  const data = await response.json();
  if(!response.ok) throw new Error(data.error?.message || data.message || "Errore OpenRouter");
  return data.choices?.[0]?.message?.content || "";
}

function isQuotaError(message) {
  const m = String(message || "").toLowerCase();
  return m.includes("quota") || m.includes("rate") || m.includes("429") || m.includes("limit") || m.includes("too many requests");
}

async function hashText(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function splitText(text, maxLen = 24000) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxLen, clean.length);
    if (end < clean.length) {
      const lastPeriod = clean.lastIndexOf(".", end);
      const lastNewline = clean.lastIndexOf("\n", end);
      const cut = Math.max(lastPeriod, lastNewline);
      if (cut > start + maxLen * 0.55) end = cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

function mergeTopics(topics) {
  const valid = [...new Set((topics || []).map(t => String(t || "").trim()).filter(Boolean))];
  if (!valid.length) return "";
  if (valid.length === 1) return valid[0];
  return valid.slice(0, 3).join(" / ");
}

function topicLooksRelated(selected, detected) {
  const a = normalizeTopic(selected);
  const b = normalizeTopic(detected);
  if (!a || !b) return true;

  const ctfWords = ["chimica","organica","biochimica","farmacologia","farmaceutica","tossicologia","fisiologia","microbiologia","farmaci","legislazione"];
  const selectedIsCtf = ctfWords.some(w => a.includes(w));
  const detectedIsCtf = ctfWords.some(w => b.includes(w));

  if (selectedIsCtf && !detectedIsCtf) return false;

  const selectedWords = new Set(a.split(" ").filter(w => w.length > 3));
  const detectedWords = b.split(" ").filter(w => w.length > 3);
  const overlap = detectedWords.filter(w => selectedWords.has(w)).length;
  return overlap > 0;
}

function normalizeTopic(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}



function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcmToWav(pcmBytes, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcmBytes);
  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}


function cleanJson(t){return String(t).replace(/^```json/i,"").replace(/^```/i,"").replace(/```$/i,"").trim();}
function slug(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}
function cors(response){response.headers.set("Access-Control-Allow-Origin","*");response.headers.set("Access-Control-Allow-Methods","GET,POST,OPTIONS");response.headers.set("Access-Control-Allow-Headers","Content-Type,Authorization");return response;}
