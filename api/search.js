// File: /api/search.js
// VERSIONE FINALE con motore di analisi Google Gemini Flash e chiave API aggiornata.

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- FUNZIONI HELPER ---

async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Errore sconosciuto'));
    return data.access_token;
}

async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10&sort=applicationDate:desc`;
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) throw new Error('Ricerca EUIPO fallita.');
    return response.json();
}

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

// Funzione aggiornata per chiamare l'API di Google Gemini
async function callGeminiAPI(prompt) {
    const apiKey = "AIzaSyCt-EHsAzgPzUkRJV7tYMrleoascvM7y-0";
    
    if (!apiKey) {
        throw new Error('API Key di Gemini non è presente nel codice.');
    }

    // *** MODELLO UNIFICATO A GEMINI FLASH COME RICHIESTO ***
    const model = 'gemini-1.5-flash-latest';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Errore da Gemini con modello ${model}:`, errorData);
        if (errorData.error?.status === 'RESOURCE_EXHAUSTED') {
             throw new Error("Quota di richieste API per Gemini esaurita. Verificare il piano di fatturazione su Google Cloud.");
        }
        throw new Error("Il servizio AI di Gemini non è riuscito a rispondere.");
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
        throw new Error("Risposta da Gemini non valida o contenuto bloccato per motivi di sicurezza.");
    }
    return data.candidates[0].content.parts[0].text;
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
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate correttamente su Vercel.');
        }

        // FASE 1: Classificazione AI con Gemini Flash
        const classificationPrompt = `Sei un esperto di Classificazione di Nizza. Analizza la seguente descrizione e restituisci SOLO un elenco di numeri di classe pertinenti, separati da virgole, senza testo aggiuntivo. Usa questa conoscenza: ${NICE_CLASSES_KNOWLEDGE_BASE}. Descrizione Utente: "${payload.productDescription}". Classi pertinenti:`;
        const identifiedClassesString = await callGeminiAPI(classificationPrompt);
        const identifiedClasses = identifiedClassesString.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c) && c > 0 && c < 46);

        if (identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti.");
        }

        // FASE 2: Ricerca su banca dati EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // FASE 3: Giudizio AI con Gemini Flash
        let judgmentPrompt = `Sei un esperto avvocato IP. Fornisci un giudizio sintetico (max 30 righe) sul rischio di confondibilità.
        **Dati Nuovo Marchio:**
        - Nome: "${payload.brandName}"
        - Descrizione: "${payload.productDescription}"
        - Classi AI: ${identifiedClasses.join(', ')}
        - Territori: ${payload.selectedCountries.join(', ')}
        **Marchi Simili Trovati (dati reali EUIPO):**
        `;
        if (euipoResults.similarMarks.length > 0) {
            judgmentPrompt += euipoResults.similarMarks.map(mark => `- Nome: "${mark.name}", Stato: ${mark.status}, Classi: ${mark.classes}`).join('\n');
        } else {
            judgmentPrompt += "- Nessun marchio simile trovato. Fattore molto positivo.";
        }
        judgmentPrompt += `\n\n**Analisi Richiesta:** Valuta il rischio (Basso, Moderato, Alto) basandoti su somiglianza fonetica, affinità merceologica e sovrapposizione territoriale. Fornisci un consiglio strategico.`;
        const syntheticJudgment = await callGeminiAPI(judgmentPrompt); 

        // FASE 4: Risposta
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