// Questo file deve trovarsi in: /api/search.js
// Utilizza la potente API pubblica di WIPO (Organizzazione Mondiale per la Proprietà Intellettuale)

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
    
    // L'API di WIPO per la ricerca pubblica non richiede una chiave API,
    // rendendola ideale per lo sviluppo e il testing.
    const WIPO_API_ENDPOINT = 'https://patentscope.wipo.int/branddb-search/search/webservice/brand';

    // Corpo della richiesta per l'API WIPO
    const requestBody = {
        "searchMode": "structured",
        "structuredSearch": {
            "searchIn": "Brand",
            "operator": "and",
            "searchCriteria": [
                {
                    "field": "BrandText",
                    "value": brandName,
                    "operator": "is"
                }
            ]
        },
        "page": 1,
        "sort": "score",
        "searchType": "brand"
    };

    try {
        const wipoResponse = await fetch(WIPO_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!wipoResponse.ok) {
            console.error(`Errore da WIPO: Status ${wipoResponse.status}`);
            const errorText = await wipoResponse.text();
            console.error(`Risposta WIPO: ${errorText}`);
            throw new Error(`Il server WIPO ha risposto con un errore: ${wipoResponse.statusText}.`);
        }
        
        const resultJSON = await wipoResponse.json();
        
        const parsedResults = parseWipoResponse(resultJSON);
        
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("Errore nel backend:", error.message);
        return response.status(500).json({ message: error.message || 'Errore interno del server.' });
    }
}

/**
 * Funzione helper per analizzare la risposta JSON di WIPO e formattarla
 * per il nostro frontend.
 */
function parseWipoResponse(jsResponse) {
    const similarMarks = [];
    
    // Il percorso per arrivare ai dati dei marchi nell'oggetto WIPO
    const records = jsResponse?.results;

    if (!records || records.length === 0) {
        return { similarMarks: [] };
    }
    
    for (const record of records) {
        try {
            // Estrae le classi di Nizza da una stringa separata da virgole
            const niceClasses = record.niceClasses ? record.niceClasses.split(',').map(c => c.trim()).join(', ') : 'N/A';

            similarMarks.push({
                name: record.brand ?? 'Nome non disponibile',
                owner: record.owner ?? 'Titolare non disponibile',
                status: record.status ?? 'Stato non disponibile',
                classes: `Cl. ${niceClasses}`
            });
        } catch (e) {
            console.error("Errore nel parsing di un singolo record WIPO:", e);
        }
    }
    
    return { similarMarks };
}
```

### 2. Azioni da Eseguire

1.  **Sostituisca il Codice**: Apra il suo file locale `api/search.js` e sostituisca l'intero contenuto con il nuovo codice qui sopra.
2.  **Rimuova la Variabile d'Ambiente (Opzionale ma Consigliato)**: Poiché non usiamo più la chiave, può andare su Vercel (`Settings -> Environment Variables`) e rimuovere la variabile `EUIPO_API_KEY` per fare pulizia.
3.  **Aggiorni GitHub**: Apra il terminale e carichi la modifica.
    ```bash
    git add .
    git commit -m "Sostituisco API EUIPO con API globale WIPO"
    git push
    ```

Vercel rileverà l'aggiornamento e pubblicherà la nuova versione. Ora, quando farà una ricerca, il suo backend contatterà un'API molto più accessibile e potente, e il suo sito dovrebbe finalmente mostrare risultati reali senza errori di comunicazione.

### Altre Banche Dati Open Source (Per il Futuro)

Oltre a WIPO, ecco altre eccellenti risorse che possiamo integrare in futuro per rendere Intellimark.ai ancora più completo:

* **USPTO (USA)**: L'Ufficio Marchi e Brevetti degli Stati Uniti offre un'API pubblica per accedere alla sua vastissima banca dati. È fondamentale per chiunque voglia proteggere un brand sul mercato americano.
* **Google Patents/Trademarks**: Anche Google ha una sua banca dati che aggrega informazioni da varie fonti, inclusi l'USPTO e l'EPO (European Patent Office), e fornisce un'interfaccia di ricerca.
* **OpenCorporates**: Sebbene non sia specifica per i marchi, è la più grande banca dati aperta di aziende al mondo. Può essere utile per verificare se un nome è già usato pesantemente come ragione sociale.

Per ora, concentriamoci sul far funzionare perfettamente l'integrazione con WIPO. Mi faccia sapere appena ha caricato l'aggiornamen