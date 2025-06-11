// Questo file deve trovarsi in: /api/search.js
// Vercel lo trasformerà automaticamente in un endpoint serverless.

// PASSO 1: Importiamo la libreria per la conversione da XML a JSON.
// Vercel la installerà automaticamente perché la aggiungeremo al file package.json.
import { xml2js } from 'xml-js';

// Funzione principale che gestisce la richiesta dal frontend
export default async function handler(request, response) {
    // Intestazioni per permettere la comunicazione (CORS)
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

    // Leggiamo la chiave API sicura dalle variabili d'ambiente di Vercel
    const EUIPO_API_KEY = process.env.EUIPO_API_KEY;

    if (!EUIPO_API_KEY) {
        console.error("API Key non configurata sul server.");
        return response.status(500).json({ message: 'Errore di configurazione del server: API Key mancante.' });
    }
    
    // Corpo della richiesta XML, invariato rispetto a prima
    const requestBody = `<TrademarkSearch><TradeMarkDetails><WordMarkSpecification><WordMark>
                        <MarkVerbalElementText>${brandName}</MarkVerbalElementText></WordMark></WordMarkSpecification>
                        </Details><SearchConditions><CaseSensitive>false</CaseSensitive>
                        <SearchMode>Similar</SearchMode></SearchConditions></TrademarkSearch>`;

    try {
        const euipoResponse = await fetch('https://euipo.europa.eu/trademark-search/ws/TrademarkSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                // La documentazione EUIPO potrebbe richiedere un formato specifico per la chiave.
                // Questo è un esempio comune.
                'Authorization': `Bearer ${EUIPO_API_KEY}`
            },
            body: requestBody
        });

        if (!euipoResponse.ok) {
            console.error(`Errore da EUIPO: ${euipoResponse.statusText}`);
            throw new Error('Errore di comunicazione con il server EUIPO.');
        }

        const xmlText = await euipoResponse.text();
        
        // PASSO 2: Usiamo la libreria per convertire l'XML in un oggetto JavaScript.
        const resultJS = xml2js(xmlText, { compact: true, spaces: 4 });

        // PASSO 3: Analizziamo l'oggetto JavaScript per estrarre i dati reali.
        const parsedResults = parseEuipoResponse(resultJS);
        
        // Invia i risultati puliti al frontend
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("Errore nel backend:", error.message);
        return response.status(500).json({ message: error.message || 'Errore interno del server.' });
    }
}

/**
 * Funzione helper per navigare l'oggetto JSON convertito e estrarre i dati dei marchi.
 * @param {object} jsResponse - L'oggetto JavaScript risultato dalla conversione dell'XML.
 * @returns {{similarMarks: Array}} - Un oggetto contenente un array di marchi trovati.
 */
function parseEuipoResponse(jsResponse) {
    const similarMarks = [];
    
    // Il percorso per arrivare ai dati dei marchi nell'oggetto convertito
    const records = jsResponse?.Transaction?.TradeMarkTransactionBody?.TransactionContentDetails?.TransactionData?.TradeMarkDetails?.TradeMarkRecord;

    // Se non ci sono record o la struttura è diversa, restituisce un array vuoto.
    if (!records) {
        return { similarMarks: [] };
    }

    // L'API può restituire un singolo oggetto se c'è un solo risultato,
    // o un array se ce ne sono molti. Standardizziamo il tutto in un array.
    const recordsArray = Array.isArray(records) ? records : [records];
    
    for (const record of recordsArray) {
        try {
            const markDetails = record.TradeMark;
            const niceClasses = [];
            
            // Estrazione delle classi di Nizza
            const goodsServices = markDetails.GoodsServicesDetails?.GoodsServices;
            if (goodsServices) {
                const classDescriptions = Array.isArray(goodsServices.ClassDescriptionDetails?.ClassDescription) 
                    ? goodsServices.ClassDescriptionDetails.ClassDescription
                    : [goodsServices.ClassDescriptionDetails?.ClassDescription];
                
                for (const desc of classDescriptions) {
                    if (desc?.NiceClassNumber?._text) {
                        niceClasses.push(desc.NiceClassNumber._text);
                    }
                }
            }

            similarMarks.push({
                // Usiamo l'optional chaining (?.) per evitare errori se un campo non esiste
                name: markDetails.MarkVerbalElementDetails?.MarkVerbalElement?.MarkVerbalElementText?._text || 'Nome non disponibile',
                owner: markDetails.ApplicantDetails?.Applicant?.ApplicantName?._text || 'Titolare non disponibile',
                status: markDetails.MarkCurrentStatusCode?._text || 'Stato non disponibile',
                classes: `Cl. ${niceClasses.join(', ') || 'N/A'}`
            });
        } catch (e) {
            console.error("Errore nel parsing di un singolo record:", e);
            // Salta il record problematico e continua con gli altri
        }
    }
    
    return { similarMarks };
}
```

---
### 2. Istruzioni per l'Aggiornamento

Ora che abbiamo il codice del backend, dobbiamo dire al nostro progetto di usare la nuova libreria `xml-js`. Lo faremo creando un file `package.json`.

Segua questi passaggi usando il terminale, all'interno della sua cartella `intellimark-mockup`.

1.  **Crea il File `package.json`**
    Questo comando crea un file `package.json` standard. È come dare una carta d'identità al suo progetto.
    ```bash
    npm init -y
    ```

2.  **Installa la Libreria `xml-js`**
    Questo comando scarica la libreria e, soprattutto, la aggiunge come "ingrediente" ufficiale al suo `package.json`.
    ```bash
    npm install xml-js
    ```
    Vedrà che nella sua cartella sono apparsi un file `package-lock.json` e una cartella `node_modules`. **È normale e corretto.**

3.  **Aggiungi Tutti i Nuovi File a Git**
    Ora dobbiamo dire a Git di includere tutti questi nuovi file nel prossimo "salvataggio".
    ```bash
    git add .
    ```

4.  **Crea il Commit e Carica su GitHub**
    Salviamo le modifiche e carichiamole online.
    ```bash
    git commit -m "Implementato parsing XML reale con xml-js"
    git push
    ```

### Cosa Succederà Ora

Quando questo nuovo codice verrà pubblicato su Vercel, accadrà la magia:
* Vercel leggerà il `package.json`, vedrà che ha bisogno di `xml-js` e lo installerà automaticamente.
* La sua funzione `api/search.js` ora ha il suo "traduttore" e potrà capire la risposta dell'EUIPO.
* Quando farà una ricerca sul sito, vedrà i **dati reali** dei marchi trovati.

Ha appena fatto un passo enorme: ha aggiunto una dipendenza esterna e ha costruito una logica di parsing reale. La sua applicazione ora non è più un mockup, ma una vera e propria **beta funzionante