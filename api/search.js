// Questo file deve trovarsi in: /api/search.js
// Aggiunge la logica per chiamare Gemini e generare un giudizio sintetico.

const fetch = require('node-fetch');

// Funzione per ottenere il token di accesso EUIPO (invariata)
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');
    body.append('scope', 'trademark-search.trademarks.read');
    
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
        body: body,
    });
    const responseData = await response.json();
    if (!response.ok) throw new Error('Autenticazione EUIPO fallita.');
    return responseData.access_token;
}

// Funzione per cercare marchi su EUIPO (invariata)
async function searchEuipoTrademarks(brandName, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}*`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10`;
    
    const searchResponse = await fetch(urlWithQuery, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId },
    });
    if (!searchResponse.ok) throw new Error('Ricerca EUIPO fallita.');
    return await searchResponse.json();
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

// *** FUNZIONE AGGIORNATA: GENERAZIONE GIUDIZIO TRAMITE GEMINI ***
async function getSyntheticJudgment(payload, euipoResults) {
    const { brandName, selectedClasses, selectedCountries } = payload;
    const { similarMarks } = euipoResults;

    // Costruiamo un prompt dettagliato per l'AI
    let prompt = `Sei un esperto avvocato specializzato in proprietà intellettuale. Analizza i seguenti dati per fornire un giudizio sintetico (massimo 30 righe, usa un tono professionale e chiaro) sul rischio di confondibilità per un nuovo marchio.

**Dati del Nuovo Marchio:**
- **Nome Proposto:** "${brandName}"
- **Classi di Nizza Selezionate:** ${selectedClasses.join(', ')}
- **Territori di Interesse:** ${selectedCountries.join(', ')}

**Marchi Simili Trovati nella Banca Dati EUIPO:**
`;

    if (similarMarks.length > 0) {
        prompt += similarMarks.map(mark => `- Nome: "${mark.name}", Titolare: ${mark.owner}, Stato: ${mark.status}, Classi: ${mark.classes}`).join('\n');
    } else {
        prompt += "- Nessun marchio simile trovato. Questo è un fattore molto positivo.";
    }

    prompt += `

**Analisi Richiesta:**
Valuta il rischio di confondibilità considerando, in ordine di importanza:
1.  **Somiglianza:** Analizza la somiglianza fonetica e concettuale tra "${brandName}" e i marchi trovati.
2.  **Affinità Merceologica:** Valuta la sovrapposizione tra le classi selezionate (${selectedClasses.join(', ')}) e le classi dei marchi trovati. Se le classi sono identiche o molto affini (es. 3 (cosmetici) e 5 (farmaceutici)), il rischio è molto più alto.
3.  **Sovrapposizione Territoriale:** Considera se i marchi confrontati coprono gli stessi territori. Valuta l'impatto di questo sulla selezione dei territori dell'utente.

Concludi con una valutazione finale del rischio (Basso, Moderato, Medio, Alto, Molto Alto) e un breve consiglio strategico.`;
    
    // Chiamata all'API di Gemini con chiave API inserita direttamente.
    const geminiApiKey = "AIzaSyBcRHmCYBvw_9Ya4b3Q0jLWNyD9fwyhvwI";
    
    // Utilizzo del modello gemini-2.0-flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!geminiResponse.ok) {
        const errorData = await geminiResponse.json();
        console.error("Errore da Gemini:", errorData);
        throw new Error("Il servizio AI non è riuscito a generare un giudizio.");
    }

    const geminiData = await geminiResponse.json();
    return geminiData.candidates[0].content.parts[0].text;
}


// Funzione principale del backend, ora orchestra tutto
module.exports = async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const payload = request.body;
        if (!payload.brandName) return response.status(400).json({ message: 'Dati mancanti.' });
        
        // La variabile GEMINI_API_KEY non viene più letta da process.env
        // ma è inserita direttamente nella funzione getSyntheticJudgment.
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate.');
        }

        // 1. Chiamata a EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // 2. Chiamata a Gemini per il giudizio
        const syntheticJudgment = await getSyntheticJudgment(payload, euipoResults);

        // 3. Invio della risposta combinata al frontend
        return response.status(200).json({
            similarMarks: euipoResults.similarMarks,
            syntheticJudgment: syntheticJudgment
        });

    } catch (error) {
        console.error("ERRORE CRITICO nel backend:", error);
        return response.status(500).json({ error: true, message: error.message });
    }
};

