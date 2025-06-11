// Questo file deve trovarsi in: /api/search.js
// Riscritto con sintassi CommonJS per massima compatibilità con Vercel.

// Usiamo 'require' invece di 'import'
const fetch = require('node-fetch');

// Funzione helper per ottenere il token di accesso
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    console.log('Tentativo di ottenere il token di accesso con lo scope corretto...');

    // Aggiungiamo lo scope richiesto dalla documentazione
    const body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');
    body.append('scope', 'uid');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: body,
        });

        const responseData = await response.json();
        if (!response.ok) {
            console.error('ERRORE dall\'endpoint del token:', JSON.stringify(responseData, null, 2));
            throw new Error('Autenticazione fallita. Verificare le credenziali EUIPO su Vercel.');
        }

        console.log('Token di accesso ottenuto con successo.');
        return responseData.access_token;
    } catch (error) {
        console.error('Errore di rete critico nella richiesta del token:', error);
        throw new Error('Impossibile contattare il server di autenticazione EUIPO.');
    }
}

// Funzione helper per analizzare la risposta
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

// Funzione principale del backend
module.exports = async (request, response) => {
    console.log('--- Inizio esecuzione backend CommonJS /api/search ---');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const { brandName } = request.body;
    if (!brandName) {
        return response.status(400).json({ message: 'Il nome del brand è richiesto.' });
    }
    console.log(`Ricerca per il brand: "${brandName}"`);

    const CLIENT_ID = process.env.EUIPO_CLIENT_ID;
    const CLIENT_SECRET = process.env.EUIPO_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        const msg = 'Errore di configurazione del server: EUIPO_CLIENT_ID e/o EUIPO_CLIENT_SECRET non sono impostati su Vercel.';
        console.error(msg);
        return response.status(500).json({ message: msg });
    }

    try {
        const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
        console.log('Token ricevuto, procedo con la ricerca del marchio...');

        const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
        const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}*`;
        const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=20`;
        console.log(`URL di ricerca costruito: ${urlWithQuery}`);

        const searchResponse = await fetch(urlWithQuery, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-IBM-Client-Id': CLIENT_ID,
            },
        });
        
        const responseText = await searchResponse.text();

        if (!searchResponse.ok) {
            console.error(`ERRORE dalla ricerca EUIPO: Status ${searchResponse.status}`);
            console.error(`Testo della risposta di errore: ${responseText}`);
            throw new Error(`Il server EUIPO ha risposto con un errore. Controllare i log di Vercel per i dettagli.`);
        }

        console.log('Risposta dalla ricerca EUIPO ottenuta con successo.');
        const resultJSON = JSON.parse(responseText);
        const parsedResults = parseEuipoResponse(resultJSON);

        console.log('--- Fine esecuzione backend (Successo) ---');
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("ERRORE CRITICO nel blocco principale del backend:", error);
        console.log('--- Fine esecuzione backend (Fallimento) ---');
        return response.status(500).json({ message: error.message || 'Errore interno del server non gestito.' });
    }
};
