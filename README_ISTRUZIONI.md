
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
