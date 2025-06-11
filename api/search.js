// Questo file deve trovarsi in: /api/search.js
// Riscritto con sintassi CommonJS per massima compatibilità con Vercel.

// Usiamo 'require' invece di 'import'
const fetch = require('node-fetch');
const { xml2js } = require('xml-js');

// Funzione helper per ottenere il token di accesso (invariata nella logica)
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
            throw new Error('Autenticazione fallita. Verificare le credenziali EUIPO su Vercel.');
        }

        console.log('Token di accesso ottenuto con successo.');
        return responseData.access_token;
    } catch (error) {
        console.error('Errore di rete critico nella richiesta del token:', error);
        throw new Error('Impossibile contattare il server di autenticazione EUIPO.');
    }
}

// Funzione helper per analizzare la risposta (invariata nella logica)
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

// Usiamo 'module.exports' invece di 'export default'
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
```

---
### 2. Aggiornamento di `package.json`

Per completare il passaggio a CommonJS, dobbiamo aggiungere `node-fetch` come dipendenza, poiché `require('node-fetch')` funziona in modo leggermente diverso da `import`. Ho anche rimosso la riga `"type": "module"` che ora non serve più.

**Azione 2:** Sostituisca il contenuto del suo file `package.json` con questo.


```json
{
  "name": "intellimark-mockup",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "xml-js": "^1.6.11",
    "node-fetch": "^2.6.7"
  }
}
```

---
### 3. Comandi Finali da Eseguire

Ora esegua questa sequenza di comandi nel suo terminale per mettere tutto in ordine e caricare su GitHub.

1.  **Cancelli il vecchio file (se esiste):**
    ```bash
    rm api/search.mjs
    ```
    *(Se il comando `rm` dà errore su Windows, cancelli il file manualmente da Esplora File).*

2.  **Installi le nuove dipendenze:**
    ```bash
    npm install
    ```

3.  **Prepari tutti i file per il commit:**
    ```bash
    git add .
    ```

4.  **Crei il commit finale:**
    ```bash
    git commit -m "Fix: Riscrivo backend in CommonJS per massima compatibilità"
    ```

5.  **Carichi su GitHub:**
    ```bash
    git push
    ```

Dopo il deploy automatico su Vercel, questa versione, che si adatta all'ambiente del server invece di chiedergli di cambiare, risolverà l'errore di sintassi. Se dovesse ancora esserci un problema, i log ci mostreranno un errore diverso e più specifico legato all'autenticazione, che a quel punto potremo risolvere con certez