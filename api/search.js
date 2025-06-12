// File: /api/search.js
// VERSIONE CON DIAGNOSTICA AVANZATA PER LE VARIABILI D'AMBIENTE

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- FUNZIONI HELPER (invariate) ---
async function getAccessToken(clientId, clientSecret) {
    // ... logica per ottenere il token EUIPO
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) {
        console.error("ERRORE DI AUTENTICAZIONE EUIPO:", data);
        throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Controllare le credenziali EUIPO su Vercel.'));
    }
    return data.access_token;
}

async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    // ... logica per la ricerca EUIPO
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10`;
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) throw new Error('Ricerca EUIPO fallita.');
    return response.json();
}

function parseEuipoResponse(jsonResponse) {
    // ... logica per formattare i risultati
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

async function callOpenAI_API(prompt) {
    // Questa funzione ora si fida che la chiave esista, perché la controlliamo prima.
    const apiKey = process.env.OPENAI_API_KEY;
    const apiURL = 'https://api.openai.com/v1/chat/completions';
    const requestBody = {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: "Sei un consulente esperto in proprietà intellettuale. Fornisci risposte precise e strutturate in formato JSON." }, { role: "user", content: prompt }]
    };
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
    // Intestazioni CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    // *** INIZIO BLOCCO DI DIAGNOSTICA ***
    console.log('--- ESEGUO DIAGNOSTICA VARIABILI D\'AMBIENTE ---');
    const availableEnvVars = Object.keys(process.env);
    console.log(`Vercel vede ${availableEnvVars.length} variabili totali.`);
    
    const isOpenAiKeyPresent = availableEnvVars.includes('OPENAI_API_KEY');
    console.log(`VERIFICA "OPENAI_API_KEY": ${isOpenAiKeyPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    
    const isEuipoIdPresent = availableEnvVars.includes('EUIPO_CLIENT_ID');
    console.log(`VERIFICA "EUIPO_CLIENT_ID": ${isEuipoIdPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);

    const isEuipoSecretPresent = availableEnvVars.includes('EUIPO_CLIENT_SECRET');
    console.log(`VERIFICA "EUIPO_CLIENT_SECRET": ${isEuipoSecretPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    console.log('--- FINE DIAGNOSTICA ---');
    // *** FINE BLOCCO DI DIAGNOSTICA ***
    
    try {
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET, OPENAI_API_KEY } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET || !OPENAI_API_KEY) {
            throw new Error('Una o più chiavi API non sono configurate correttamente sul server Vercel. Controllare i log di diagnostica.');
        }

        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        // FASE 1: Classificazione AI
        const classificationPrompt = `Dalla seguente descrizione utente, estrai le Classi di Nizza pertinenti. Usa questa base di conoscenza: ${NICE_CLASSES_KNOWLEDGE_BASE}. Descrizione: "${payload.productDescription}". Restituisci un oggetto JSON con una sola chiave "identifiedClasses", contenente un array di numeri.`;
        const classificationResponse = await callOpenAI_API(classificationPrompt);
        const { identifiedClasses } = JSON.parse(classificationResponse);
        if (!identifiedClasses || identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti.");
        }

        // FASE 2: Ricerca EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // FASE 3: Giudizio AI
        let judgmentPrompt = `Sei un esperto avvocato specializzato in proprietà intellettuale... (prompt omesso per brevità)`;
        const syntheticJudgment = await callOpenAI_API(judgmentPrompt);

        // FASE 4: Risposta al frontend
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
// --- FINE DEL BACKEND ---