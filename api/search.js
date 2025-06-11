// File: /api/search.js
// VERSIONE CON CORREZIONE PER RATE LIMITING (ERRORE 429)

const fetch = require('node-fetch');

// Funzione helper per creare un ritardo
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Funzione per ottenere il token di accesso EUIPO (invariata)
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Errore sconosciuto'));
    return data.access_token;
}

// Funzione per cercare marchi su EUIPO (invariata)
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10`;
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) throw new Error('Ricerca EUIPO fallita.');
    return response.json();
}

// Funzione per analizzare i risultati di EUIPO (invariata)
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

// Funzione generica per chiamare l'API di Gemini (invariata)
async function callGeminiAPI(prompt, model = 'gemini-1.5-pro-latest') {
    const geminiApiKey = "AIzaSyBcRHmCYBvw_9Ya4b3Q0jLWNyD9fwyhvwI";
    const effectiveModel = model.includes('flash') ? 'gemini-1.5-flash-latest' : 'gemini-1.5-pro-latest';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${geminiApiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Errore da Gemini con modello ${effectiveModel}:`, errorData);
        throw new Error("Il servizio AI non è riuscito a rispondere. Controllare i limiti di quota dell'API Key.");
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
        throw new Error("Risposta da Gemini non valida o contenuto bloccato.");
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
            throw new Error('Credenziali EUIPO non configurate.');
        }

        // FASE 1: Classificazione AI
        const classificationPrompt = `Sei un esperto di Classificazione di Nizza. Analizza la seguente descrizione di prodotti e servizi fornita da un utente e restituisci SOLO un elenco di numeri di classe pertinenti, separati da virgole, senza alcun testo aggiuntivo. Usa la seguente base di conoscenza per la tua analisi:\n\n[La base di conoscenza è omessa per brevità, ma è presente nel file reale]\n\nDescrizione Utente: "${payload.productDescription}"\n\nClassi pertinenti:`;
        const identifiedClassesString = await callGeminiAPI(classificationPrompt, 'gemini-1.5-flash-latest');
        const identifiedClasses = identifiedClassesString.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c) && c > 0 && c < 46);

        if (identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti dalla descrizione fornita.");
        }

        // FASE 2: Ricerca EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // *** LA CORREZIONE CHIAVE È QUI ***
        // Aggiungiamo una pausa di 1.5 secondi per rispettare i limiti di quota dell'API Gemini.
        console.log('Pausa di 1.5s per rispettare i rate limit di Gemini...');
        await delay(1500);

        // FASE 3: Giudizio AI
        let judgmentPrompt = `Sei un esperto avvocato specializzato in proprietà intellettuale. Fornisci un giudizio sintetico (massimo 30 righe, tono professionale e chiaro) sul rischio di confondibilità.

**Dati del Nuovo Marchio:**
- Nome Proposto: "${payload.brandName}"
- Descrizione Utente: "${payload.productDescription}"
- Classi Identificate dall'AI: ${identifiedClasses.join(', ')}
- Territori di Interesse: ${payload.selectedCountries.join(', ')}

**Marchi Simili Trovati:**
`;
        if (euipoResults.similarMarks.length > 0) {
            judgmentPrompt += euipoResults.similarMarks.map(mark => `- Nome: "${mark.name}", Stato: ${mark.status}, Classi: ${mark.classes}`).join('\n');
        } else {
            judgmentPrompt += "- Nessun marchio simile trovato. Questo è un fattore molto positivo.";
        }
        judgmentPrompt += `

**Analisi Richiesta:**
Valuta il rischio di confondibilità considerando somiglianza fonetica/concettuale, affinità merceologica (tra classi identificate e quelle dei marchi trovati) e sovrapposizione territoriale. Concludi con una valutazione finale del rischio (Basso, Moderato, Medio, Alto) e un consiglio strategico.`;
        const syntheticJudgment = await callGeminiAPI(judgmentPrompt, 'gemini-1.5-pro-latest'); 

        // FASE 4: Invio della risposta combinata
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
