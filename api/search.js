// Questo file deve trovarsi in: /api/search.js
// VERSIONE CON LOG DI DIAGNOSTICA AVANZATA

// Funzione helper per ottenere il token di accesso
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    console.log('Tentativo di ottenere il token di accesso...');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: 'grant_type=client_credentials',
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('ERRORE dall\'endpoint del token:', JSON.stringify(responseData, null, 2));
            throw new Error('Autenticazione fallita. Le credenziali potrebbero essere errate o il formato della richiesta non è accettato.');
        }

        console.log('Token di accesso ottenuto con successo.');
        return responseData.access_token;

    } catch (error) {
        console.error('Errore di rete critico nella richiesta del token:', error);
        throw new Error('Impossibile contattare il server di autenticazione EUIPO. Controllare la connessione o lo stato del servizio.');
    }
}

// Funzione helper per analizzare la risposta della ricerca
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


// Funzione principale che gestisce la richiesta dal frontend
export default async function handler(request, response) {
    console.log('--- Inizio esecuzione backend /api/search ---');
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

    // Leggiamo le credenziali
    const CLIENT_ID = process.env.EUIPO_CLIENT_ID;
    const CLIENT_SECRET = process.env.EUIPO_CLIENT_SECRET;

    console.log(`Variabile EUIPO_CLIENT_ID trovata: ${CLIENT_ID ? 'Sì' : 'No'}`);
    console.log(`Variabile EUIPO_CLIENT_SECRET trovata: ${CLIENT_SECRET ? 'Sì' : 'No'}`);

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
}
```

### 2. Piano d'Azione per la Diagnosi

1.  **Sostituisca il Codice**: Apra il suo file `api/search.js` e sostituisca il contenuto con la versione qui sopra.
2.  **Aggiorni GitHub**: Apra il terminale e carichi la modifica.
    ```bash
    git add .
    git commit -m "Aggiungo log di diagnostica al backend"
    git push
    ```
3.  **Prepari il Pannello di Vercel**:
    * Attenda 1-2 minuti che Vercel completi il nuovo deploy.
    * Apra due schede nel suo browser: una con il suo sito Intellimark e una con la sua dashboard di Vercel.
    * Nella dashboard di Vercel, vada alla tab **"Functions"** e clicchi sulla riga che dice **/api/search**. Vedrà una schermata pronta a mostrare i log in tempo reale.
4.  **Esegua il Test e Legga i Log**:
    * Torni alla scheda del suo sito e faccia una ricerca.
    * Immediatamente dopo, torni alla scheda di Vercel con i log.
    * Vedrà apparire una serie di messaggi. **Copi e incolli qui tutto quello che appare in quella schermata.**

Quei log ci diranno esattamente in quale punto il processo si interrompe e perché. È lo strumento definitivo per risolvere questo problema.
5.  **Analizzi i Log**:
    * Se vede errori, cerchi di capire se sono legati alla rete, all'autenticazione o a problemi con la risposta del server.
    * Se tutto sembra funzionare ma non ottiene risultati, verifichi che il nome del marchio sia corretto e che esistano marchi simili. 