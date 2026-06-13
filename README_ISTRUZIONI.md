
# StudyFlash AI

Webapp installabile tipo Flashka, pubblicabile su GitHub Pages.

## Funzioni incluse

- Flashcard manuali
- Generazione base senza AI
- Generazione AI tramite Cloudflare Worker
- Lettura PDF
- Lettura immagini con OCR
- Quiz automatici
- Ripasso intelligente con scadenze
- XP e livello
- Sintesi vocale
- Backup import/export
- PWA installabile
- Funzionamento offline

## Pubblicazione su GitHub Pages

1. Crea un repository GitHub, esempio `studyflash-ai`.
2. Carica tutti i file della cartella principale.
3. Vai su Settings > Pages.
4. Source: Deploy from branch.
5. Branch: main / root.
6. Apri il link GitHub Pages.

## Attivare AI con Cloudflare Worker

1. Vai su Cloudflare.
2. Crea un Worker.
3. Incolla il contenuto di `worker-cloudflare.js`.
4. Salva e pubblica.
5. Aggiungi un secret chiamato `OPENAI_API_KEY`.
6. Nell'app, vai su Impostazioni e inserisci l'URL del Worker.

## Nota importante

La chiave OpenAI non deve mai essere messa dentro `app.js` o su GitHub Pages.
Va inserita solo nei secret del Worker.


## Novità versione 2

- Ricerca nei mazzi e nelle risposte
- Gestione mazzi salvati
- Modifica flashcard
- Eliminazione singola flashcard
- Rinomina mazzo
- Aggiunta schede dopo il salvataggio
- AI Gemini con più endpoint:
  - `/generate`
  - `/summary`
  - `/explain`
  - `/quiz`
- Strumenti AI extra dentro la schermata Crea:
  - riassunto
  - spiegazione semplice
  - aggiunta di altre flashcard

## Aggiornamento Worker

Su Cloudflare Worker sostituisci tutto il codice con il nuovo `worker-cloudflare.js`.
Mantieni il secret:

GEMINI_API_KEY


## Correzione V3

- Sistemato il pulsante “Mostra risposta”.
- I pulsanti Difficile / Medio / Facile ora avanzano correttamente alla flashcard successiva.
- Aggiunto anche il pulsante “Successiva” nel ripasso.
- Reso il click più stabile anche su telefono.


## Correzione V4 - Mazzi

- Sistemati i pulsanti nella Home: Studia, Gestisci, Elimina.
- Aggiunto pulsante Rinomina direttamente nella Home.
- Migliorata la schermata Gestione.
- Quando salvi un mazzo senza nome, l'app chiede il nome.
- Per aggiornare una versione già pubblicata basta sostituire:
  - `index.html`
  - `app.js`

# V6 Cloudflare D1

Sostituisci su GitHub: index.html e app.js.
Sostituisci su Cloudflare Worker: worker-cloudflare.js.

Binding necessari nel Worker:
- Secret: GEMINI_API_KEY
- D1 binding: Variable name DB

Test:
apri https://TUO-WORKER.workers.dev
deve comparire StudyFlash AI CTF Worker D1 V6.

# V7 CTF Pro

Nuove sezioni:
- Materie CTF
- Esami
- Tutor AI
- Simulazione orale
- Scheda farmaco

File da sostituire su GitHub:
- index.html
- app.js
- style.css
- sw.js

File Worker:
- se hai già la V6 D1, puoi lasciare worker-cloudflare.js invariato.


# V8 - Correzione argomento PDF

Correzione importante:
- Gemini ora genera flashcard basate ESCLUSIVAMENTE sul contenuto del PDF/testo caricato.
- La materia selezionata viene usata solo come etichetta organizzativa.
- Se il PDF parla di un argomento diverso dalla materia selezionata, l'app mostra:
  - Argomento rilevato
  - Avviso di possibile incongruenza

File da sostituire su GitHub:
- app.js
- sw.js

File da sostituire su Cloudflare Worker:
- worker-cloudflare.js

Dopo l'aggiornamento:
- Apri l'app
- Premi Ctrl + F5
- Riprova il PDF


# V9 - PDF lunghi + avviso argomento

Novità:
- Il Worker divide automaticamente testi/PDF lunghi in più parti.
- Le flashcard vengono generate leggendo più blocchi del documento.
- L'app mostra in modo visibile:
  - Argomento rilevato
  - Avviso se la materia selezionata non corrisponde al PDF
  - Numero di parti analizzate
  - Caratteri letti
- La materia selezionata rimane solo un'etichetta organizzativa.

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: app.js e sw.js


# V10 - Tutor AI pulito + Domanda orale automatica

Novità:
- Il Tutor AI non restituisce più testi pieni di simboli Markdown come ##, **, ---.
- Le schede farmaco sono più pulite e leggibili.
- Nella sezione Orale puoi inserire un argomento specifico.
- Il pulsante "Genera domanda" crea automaticamente una domanda da professore in base alla materia e all'argomento.
- Poi lo studente scrive la risposta e l'AI la valuta.

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: index.html, app.js, style.css, sw.js


# V11 - Fix Strumenti AI extra

Correzione:
- Sistemati i pulsanti:
  - Crea riassunto
  - Spiega semplice
  - Aggiungi altre 10 flashcard
- Ora mostrano messaggi chiari se manca testo o URL Worker.
- Ora il box sotto i pulsanti viene compilato correttamente.

File da sostituire su GitHub:
- app.js
- sw.js

Non serve modificare il Worker Cloudflare.


# V12 - Fix Simulazione orale

Correzione:
- Il pulsante "Genera domanda" ora mostra sempre un messaggio chiaro.
- Se il Worker non è aggiornato, l'app lo segnala.
- Aggiunto controllo su URL Worker e argomento specifico.
- Aggiornato anche worker-cloudflare.js con endpoint /oral-question.

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: app.js e sw.js


# V13 - Materie editabili

Novità:
- Aggiunto pulsante "Aggiungi materia" nella sezione Materie CTF.
- Aggiunto pulsante "Modifica" su ogni materia.
- Aggiunto pulsante "Elimina" su ogni materia.
- Quando modifichi una materia, vengono aggiornati anche gli esami collegati.
- Eliminare una materia non cancella i mazzi già creati.

File da sostituire su GitHub:
- index.html
- app.js
- sw.js

Non serve modificare il Worker Cloudflare.


# V14 - Multi-AI Anti Quota

Novità:
- Il Worker prova prima Gemini.
- Se Gemini supera la quota o dà errore, passa automaticamente a OpenRouter.
- Aggiunta cache AI su Cloudflare D1.
- Nuova tabella D1: ai_cache.

Secret da aggiungere su Cloudflare Worker:
- OPENROUTER_API_KEY

Opzionale:
- OPENROUTER_MODEL

Se non imposti OPENROUTER_MODEL, viene usato:
openai/gpt-4o-mini

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: app.js e sw.js


# V15 - Voci Tutor AI

Novità:
- Sezione "Voce Tutor AI" in Impostazioni.
- Scelta tra voce gratuita del dispositivo e voce AI ElevenLabs.
- Campo per ElevenLabs API Key locale opzionale.
- Campo per Voice ID ElevenLabs.
- Pulsante "Prova voce".
- Pulsanti Ascolta/Stop su Tutor AI, Orale, Farmaci e Strumenti AI extra.

Consigliato:
inserire la chiave ElevenLabs come secret nel Worker:
ELEVENLABS_API_KEY

Opzionale:
ELEVENLABS_VOICE_ID

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: index.html, app.js, style.css, sw.js

# V16 - Gemini Voice

Novità:
- Aggiunta voce AI Gemini nella sezione Voce Tutor AI.
- Puoi scegliere: Voce dispositivo gratuita, Gemini, ElevenLabs.
- Gemini Voice usa la stessa GEMINI_API_KEY già presente nel Worker.
- Non serve ElevenLabs se scegli Gemini.
- Voci Gemini selezionabili: Kore, Puck, Charon, Fenrir, Aoede.

File da sostituire:
- Su Cloudflare Worker: worker-cloudflare.js
- Su GitHub: index.html, app.js, sw.js
