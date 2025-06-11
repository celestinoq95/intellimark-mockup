// Questo file deve trovarsi in: /api/search.js
// Vercel lo trasformerà automaticamente in un endpoint serverless.

// Importiamo la libreria per la conversione da XML a JSON.
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
        const errorMessage = 'Errore di configurazione del server: la variabile EUIPO_API_KEY non è stata impostata su Vercel.';
        console.error(errorMessage);
        return response.status(500).json({ message: errorMessage });
    }
    
    // Corpo della richiesta XML corretto
    const requestBody = `
        <TrademarkSearch>
            <TradeMarkDetails>
                <WordMarkSpecification>
                    <WordMark>
                        <MarkVerbalElementText>${brandName}</MarkVerbalElementText>
                    </WordMark>
                </WordMarkSpecification>
            </TradeMarkDetails>
            <SearchConditions>
                <CaseSensitive>false</CaseSensitive>
                <SearchMode>Similar</SearchMode>
            </SearchConditions>
        </TrademarkSearch>`;

    try {
        const euipoResponse = await fetch('https://euipo.europa.eu/trademark-search/ws/TrademarkSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                // La documentazione EUIPO TMDS non specifica un header di autorizzazione standard.
                // Spesso, l'autenticazione è basata sull'IP o su parametri nella richiesta.
                // Se la chiamata continua a fallire, è probabile che l'API Key vada usata
                // in un altro modo o che l'accesso sia limitato.
                // Per ora, tentiamo una chiamata diretta.
            },
            body: requestBody
        });

        const responseText = await euipoResponse.text();

        if (!euipoResponse.ok) {
            // Se l'API restituisce un errore, proviamo a loggarlo per il debug
            console.error(`Errore da EUIPO: Status ${euipoResponse.status}`);
            console.error(`Risposta EUIPO: ${responseText}`);
            throw new Error(`Il server EUIPO ha risposto con un errore: ${euipoResponse.statusText}. Controllare i log di Vercel per dettagli.`);
        }
        
        const resultJS = xml2js(responseText, { compact: true, spaces: 2 });
        
        // Controlliamo se la risposta dall'API è un messaggio di errore (fault)
        if (resultJS.Fault) {
            const faultString = resultJS.Fault.faultstring?._text || 'Errore non specificato dall\'API.';
            console.error(`Fault dall'API EUIPO: ${faultString}`);
            throw new Error(faultString);
        }

        const parsedResults = parseEuipoResponse(resultJS);
        
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("Errore nel backend:", error.message);
        return response.status(500).json({ message: error.message || 'Errore interno del server.' });
    }
}

function parseEuipoResponse(jsResponse) {
    const similarMarks = [];
    const records = jsResponse?.Transaction?.TradeMarkTransactionBody?.TransactionContentDetails?.TransactionData?.TradeMarkDetails?.TradeMarkRecord;

    if (!records) { return { similarMarks: [] }; }

    const recordsArray = Array.isArray(records) ? records : [records];
    
    for (const record of recordsArray) {
        try {
            const markDetails = record.TradeMark;
            const niceClasses = [];
            
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
                name: markDetails.MarkVerbalElementDetails?.MarkVerbalElement?.MarkVerbalElementText?._text || 'N/D',
                owner: markDetails.ApplicantDetails?.Applicant?.ApplicantName?._text || 'N/D',
                status: markDetails.MarkCurrentStatusCode?._text || 'N/D',
                classes: `Cl. ${niceClasses.join(', ') || 'N/A'}`
            });
        } catch (e) {
            console.error("Errore nel parsing di un singolo record:", e);
        }
    }
    
    return { similarMarks };
}

```

### 2. Azioni Correttive (Checklist)

Ora, segua questi passaggi in ordine.

**Azione 1: Aggiorni il Codice**
1.  Apra il suo file locale `api/search.js`.
2.  Sostituisca l'intero contenuto con il codice che le ho appena fornito.
3.  Salvi il file.

**Azione 2: Verifichi la Chiave API su Vercel**
1.  Vada sulla dashboard del suo progetto su Vercel.
2.  Vada su **Settings** -> **Environment Variables**.
3.  Verifichi con la massima attenzione:
    * Il **NOME** della variabile deve essere `EUIPO_API_KEY`.
    * Il **VALORE** deve essere la sua chiave API, incollata perfettamente, senza spazi bianchi prima o dopo. Clicchi su "Edit" per controllarla e salvarla di nuovo per sicurezza.

**Azione 3: Carichi l'Aggiornamento su GitHub**
1.  Apra il terminale nella cartella del progetto.
2.  Esegua i soliti comandi:
    ```bash
    git add .
    git commit -m "Miglioro gestione errori e parsing backend"
    git push
    ```

**Azione 4: Test e Diagnosi Finale**
1.  Attenda 1-2 minuti che Vercel completi il nuovo deploy.
2.  Vada sul link del suo sito e faccia una **ricarica forzata** (`Ctrl+F5` o `Cmd+Shift+R`).
3.  Provi a fare una ricerca.

Se l'errore persiste, ora abbiamo uno strumento in più. Il nuovo codice logga gli errori in modo molto più dettagliato.

* **Come Controllare i Log:** Vada sulla dashboard di Vercel, clicchi sulla tab **"Functions"** e poi sulla riga `/api/search`. Lì vedrà i log in tempo reale. Se c'è un errore, apparirà scritto lì, dandomi l'indizio definitivo per risolverlo. Mi faccia sapere cosa legge in quella sezione se il problema non si risol