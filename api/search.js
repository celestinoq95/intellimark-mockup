// File: /api/search.js
// VERSIONE CON DIAGNOSTICA AVANZATA PER LE VARIABILI D'AMBIENTE

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// Le funzioni helper (getAccessToken, etc.) rimangono invariate...
async function getAccessToken(clientId, clientSecret) { /*...*/ }
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) { /*...*/ }
function parseEuipoResponse(jsonResponse) { /*...*/ }
async function callOpenAI_API(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        // Questo è l'errore che stiamo vedendo.
        throw new Error('API Key di OpenAI non configurata correttamente sul server Vercel.');
    }
    const apiURL = 'https://api.openai.com/v1/chat/completions';
    const requestBody = { model: "gpt-4o", response_format: { type: "json_object" }, messages: [ { role: "system", content: "Sei un esperto avvocato specializzato in proprietà intellettuale e marchi. Il tuo compito è analizzare i dati forniti e restituire una risposta strutturata in formato JSON, senza alcun testo aggiuntivo." }, { role: "user", content: prompt } ] };
    const response = await fetch(apiURL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore dall'API di OpenAI:", errorData);
        throw new Error("Il servizio AI di OpenAI non è riuscito a rispondere.");
    }
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}


// --- FLUSSO PRINCIPALE DEL BACKEND ---
module.exports = async (request, response) => {
    // Intestazioni CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    // *** INIZIO BLOCCO DI DIAGNOSTICA ***
    console.log('--- ESEGUO DIAGNOSTICA VARIABILI D\'AMBIENTE ---');
    // Stampiamo i nomi di tutte le variabili che Vercel rende disponibili
    const availableEnvVars = Object.keys(process.env);
    console.log('Nomi delle variabili disponibili:', availableEnvVars);
    
    // Eseguiamo un controllo specifico e case-sensitive sulla nostra chiave
    const isOpenAiKeyPresent = availableEnvVars.includes('OPENAI_API_KEY');
    console.log(`VERIFICA SPECIFICA "OPENAI_API_KEY": ${isOpenAiKeyPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    
    const isEuipoIdPresent = availableEnvVars.includes('EUIPO_CLIENT_ID');
    console.log(`VERIFICA SPECIFICA "EUIPO_CLIENT_ID": ${isEuipoIdPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);

    const isEuipoSecretPresent = availableEnvVars.includes('EUIPO_CLIENT_SECRET');
    console.log(`VERIFICA SPECIFICA "EUIPO_CLIENT_SECRET": ${isEuipoSecretPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    console.log('--- FINE DIAGNOSTICA ---');
    // *** FINE BLOCCO DI DIAGNOSTICA ***

    try {
        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate.');
        }

        const classificationPrompt = `Sei un esperto di Classificazione di Nizza... (prompt omesso per brevità)`; // Il prompt rimane invariato
        const identifiedClassesString = "9,25"; // Valore fittizio per bypassare la prima chiamata AI durante il debug
        const identifiedClasses = [9, 25];

        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        let judgmentPrompt = `Sei un esperto avvocato... (prompt omesso per brevità)`;
        const syntheticJudgment = await callOpenAI_API(judgmentPrompt);

        return response.status(200).json({
            similarMarks: euipoResults.similarMarks,
            syntheticJudgment: syntheticJudgment,
            identifiedClasses: identifiedClasses
        });

    } catch (error) {
        console.error("ERRORE CRITICO nel backend:", error);
        return response.status(500).json({ error: true, message: error.message });
    }
};
```

### Azioni Finali per la Diagnosi

1.  **Sostituisca il Codice**: Apra il suo file `api/search.js` e lo sostituisca con questa nuova versione diagnostica.
2.  **Aggiorni GitHub**: Apra il terminale e carichi la modifica.
    ```bash
    git add .
    git commit -m "Fix: Aggiungo diagnostica avanzata al backend"
    git push
    ```
3.  **Forzi un Nuovo Deploy su Vercel**: Per essere assolutamente certi che Vercel usi il nuovo codice e le nuove variabili, forziamo un "redeploy".
    * Vada sulla sua dashboard di Vercel.
    * Clicchi sul suo progetto.
    * Vada sulla tab **"Deployments"**.
    * Trovi l'ultimo deploy in cima alla lista (dovrebbe essere di pochi istanti fa). Clicchi sui **tre puntini (⋮)** a destra.
    * Selezioni **"Redeploy"**.

4.  **Esegua il Test e Catturi i Log**:
    * Attenda il completamento del nuovo deploy.
    * Apra la tab **"Functions" -> `/api/search`** per vedere i log in tempo reale.
    * Vada sul suo sito e faccia una ricerca.
    * **Copi e incolli qui l'intero nuovo output dei log**.

Questa volta, il log conterrà la lista di tutte le variabili che il server vede. Se `OPENAI_API_KEY` non è in quella lista o ha un nome diverso, avremo trovato la causa e la soluzione sarà sempli