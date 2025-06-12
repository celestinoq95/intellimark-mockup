// File: /api/search.js
// VERSIONE CON DIAGNOSTICA AVANZATA PER LE VARIABILI D'AMBIENTE

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// Funzioni helper...
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    console.log('Tentativo di ottenere il token di accesso...');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) {
        console.error('ERRORE dall\'endpoint del token:', data);
        throw new Error('Autenticazione EUIPO fallita.');
    }
    console.log('Token di accesso ottenuto.');
    return data.access_token;
}

async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10`;
    console.log(`URL di ricerca costruito: ${urlWithQuery}`);
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) {
         const errorText = await response.text();
         console.error(`ERRORE dalla ricerca EUIPO: Status ${response.status}`);
         console.error(`Testo della risposta di errore: ${errorText}`);
         throw new Error('Ricerca EUIPO fallita.');
    }
    return response.json();
}

function parseEuipoResponse(jsonResponse) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];
    console.log(`Trovati ${records.length} record nella risposta.`);
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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
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
    // *** BLOCCO DI DIAGNOSTICA ***
    console.log('--- ESEGUO DIAGNOSTICA VARIABILI D\'AMBIENTE ---');
    const availableEnvVars = Object.keys(process.env);
    console.log('Nomi delle variabili disponibili:', availableEnvVars);
    const isOpenAiKeyPresent = availableEnvVars.includes('OPENAI_API_KEY');
    console.log(`VERIFICA SPECIFICA "OPENAI_API_KEY": ${isOpenAiKeyPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    const isEuipoIdPresent = availableEnvVars.includes('EUIPO_CLIENT_ID');
    console.log(`VERIFICA SPECIFICA "EUIPO_CLIENT_ID": ${isEuipoIdPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    const isEuipoSecretPresent = availableEnvVars.includes('EUIPO_CLIENT_SECRET');
    console.log(`VERIFICA SPECIFICA "EUIPO_CLIENT_SECRET": ${isEuipoSecretPresent ? 'TROVATA' : '*** NON TROVATA ***'}`);
    console.log('--- FINE DIAGNOSTICA ---');

    // Intestazioni CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate.');
        }

        const classificationPrompt = `Sei un esperto di Classificazione di Nizza... (prompt omesso per brevità)`;
        const identifiedClassesString = await callOpenAI_API(classificationPrompt); // Uso fittizio di OpenAI per la classificazione
        const identifiedClasses = identifiedClassesString.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));

        if (identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti.");
        }

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
