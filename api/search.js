// File: /api/search.js
// VERSIONE IBRIDA: Dati reali da EUIPO + Analisi contestuale da OpenAI GPT-4o.

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- FUNZIONI HELPER ---

// Ottiene il token di accesso dall'EUIPO.
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    
    console.log('Backend: Richiesta token di accesso a EUIPO...');
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) {
        console.error("ERRORE DI AUTENTICAZIONE EUIPO:", data);
        throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Controllare le credenziali EUIPO su Vercel.'));
    }
    console.log('Backend: Token EUIPO ottenuto con successo.');
    return data.access_token;
}

// Cerca i marchi sulla banca dati EUIPO.
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10&sort=applicationDate:desc`;
    console.log(`Backend: Eseguo ricerca su EUIPO con query: ${rsqlQuery}`);
    
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) {
        const errorText = await response.text();
        console.error("ERRORE RICERCA EUIPO:", errorText);
        throw new Error('La ricerca sulla banca dati EUIPO è fallita.');
    }
    console.log('Backend: Ricerca EUIPO completata.');
    return response.json();
}

// Formatta i risultati grezzi dell'EUIPO in un formato pulito.
function parseEuipoResponse(jsonResponse) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];
    for (const record of records) {
        similarMarks.push({
            name: record.wordMarkSpecification?.verbalElement || 'N/D',
            owner: record.applicants?.[0]?.name || 'N/D',
            status: record.status || 'N/D',
            classes: `Cl. ${record.niceClasses?.join(', ') || 'N/A'}`,
            applicationNumber: record.applicationNumber,
        });
    }
    return { similarMarks };
}

// Chiama l'API di OpenAI per eseguire compiti di analisi.
async function callOpenAI_API(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('API Key di OpenAI non configurata sul server Vercel.');

    const apiURL = 'https://api.openai.com/v1/chat/completions';
    const requestBody = {
        model: "gpt-4o",
        response_format: { type: "json_object" }, // Chiediamo una risposta JSON per la classificazione
        messages: [{ role: "system", content: "Sei un consulente esperto in proprietà intellettuale. Fornisci risposte precise e strutturate in formato JSON." }, { role: "user", content: prompt }]
    };
    
    // Per il giudizio finale, vogliamo testo libero.
    if (prompt.includes("Analisi Richiesta:")) {
        delete requestBody.response_format;
    }

    const response = await fetch(apiURL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore dall'API di OpenAI:", errorData);
        throw new Error("Il servizio AI di OpenAI non è riuscito a rispondere.");
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

// --- FLUSSO PRINCIPALE DEL BACKEND ---
module.exports = async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET, OPENAI_API_KEY } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET || !OPENAI_API_KEY) {
            throw new Error('Una o più chiavi API non sono configurate correttamente su Vercel.');
        }

        // --- FASE 1: Classificazione AI dei prodotti/servizi ---
        console.log("Backend: Avvio Fase 1 - Classificazione AI.");
        const classificationPrompt = `Dalla seguente descrizione utente, estrai le Classi di Nizza pertinenti. Usa questa base di conoscenza: ${NICE_CLASSES_KNOWLEDGE_BASE}. Descrizione: "${payload.productDescription}". Restituisci un oggetto JSON con una sola chiave "identifiedClasses", contenente un array di numeri.`;
        const classificationResponse = await callOpenAI_API(classificationPrompt);
        const { identifiedClasses } = JSON.parse(classificationResponse);
        if (!identifiedClasses || identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti.");
        }
        console.log(`Backend: Classi identificate dall'AI: ${identifiedClasses.join(', ')}`);

        // --- FASE 2: Ricerca su banca dati EUIPO ---
        console.log("Backend: Avvio Fase 2 - Ricerca EUIPO.");
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // --- FASE 3: Giudizio AI basato su dati reali ---
        console.log("Backend: Avvio Fase 3 - Giudizio AI.");
        let judgmentPrompt = `Sei un esperto avvocato specializzato in proprietà intellettuale. Fornisci un giudizio sintetico (massimo 30 righe) sul rischio di confondibilità.
        **Dati Nuovo Marchio:**
        - Nome: "${payload.brandName}"
        - Classi di interesse: ${identifiedClasses.join(', ')}
        - Territori: ${payload.selectedCountries.join(', ')}
        **Marchi Simili Trovati (dati reali EUIPO):**
        `;
        if (euipoResults.similarMarks.length > 0) {
            judgmentPrompt += euipoResults.similarMarks.map(mark => `- Nome: "${mark.name}", Stato: ${mark.status}, Classi: ${mark.classes}`).join('\n');
        } else {
            judgmentPrompt += "- Nessun marchio simile trovato. Questo è un fattore molto positivo.";
        }
        judgmentPrompt += `\n\n**Analisi Richiesta:** Valuta il rischio (Basso, Moderato, Alto) basandoti sulla somiglianza fonetica, affinità merceologica e sovrapposizione territoriale, e fornisci un consiglio strategico.`;
        const syntheticJudgment = await callOpenAI_API(judgmentPrompt);

        // --- FASE 4: Invio della risposta combinata al frontend ---
        console.log("Backend: Processo completato. Invio risposta al frontend.");
        return response.status(200).json({
            similarMarks: euipoResults.similarMarks,
            syntheticJudgment: syntheticJudgment,
            identifiedClasses: identifiedClasses
        });

    } catch (error) {
        console.error("ERRORE CRITICO nel backend:", error.message);
        return response.status(500).json({ error: true, message: error.message });
    }
};
```

### Prossimi Passi per Lei

1.  **Sostituire il Codice**: Apra il suo file `api/search.js` e lo sostituisca con questa nuova versione ibrida.
2.  **Verificare le Variabili d'Ambiente**: Vada sulla sua dashboard di Vercel (`Settings -> Environment Variables`) e si assicuri di avere **TUTTE E TRE** le variabili impostate correttamente:
    * `EUIPO_CLIENT_ID`
    * `EUIPO_CLIENT_SECRET`
    * `OPENAI_API_KEY`
3.  **Caricare l'Aggiornamento**: Usi il terminale per caricare le modifiche su GitHub.
    ```bash
    git add .
    git commit -m "Implemento logica ibrida EUIPO + OpenAI"
    git push
    ```

Dopo il deploy automatico su Vercel, la sua applicazione avrà raggiunto il suo pieno potenziale attuale: sfrutterà l'intelligenza artificiale per comprendere l'utente, la userà per interrogare una banca dati ufficiale e, infine, la userà di nuovo per analizzare i dati reali e fornire un giudizio di valore. Congratulazioni, questo è un sistema davvero poten