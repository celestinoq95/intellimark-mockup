// File: /api/search.js
// VERSIONE AVANZATA con analisi legale approfondita e riferimenti normativi

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- CONFIGURAZIONE E COSTANTI ---

// Riferimenti normativi per l'analisi legale
const LEGAL_REFERENCES = {
  CPI: {
    art7: "Art. 7 CPI - Novità del marchio",
    art8: "Art. 8 CPI - Marchi registrati anteriori",
    art9: "Art. 9 CPI - Capacità distintiva",
    art10: "Art. 10 CPI - Liceità",
    art12: "Art. 12 CPI - Rischio di confusione e associazione",
    art13: "Art. 13 CPI - Carattere descrittivo",
    art14: "Art. 14 CPI - Marchi di forma",
    art25: "Art. 25 CPI - Unitarietà del marchio"
  },
  EUTMR: {
    art4: "Art. 4 EUTMR - Segni che possono costituire un marchio UE",
    art7: "Art. 7 EUTMR - Impedimenti assoluti alla registrazione",
    art8: "Art. 8 EUTMR - Impedimenti relativi alla registrazione",
    art9: "Art. 9 EUTMR - Diritti conferiti dal marchio UE",
    art46: "Art. 46 EUTMR - Motivi di opposizione",
    art58: "Art. 58 EUTMR - Motivi di nullità assoluta",
    art60: "Art. 60 EUTMR - Motivi di nullità relativa"
  }
};

// --- FUNZIONI HELPER ---

async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ 
        grant_type: 'client_credentials', 
        scope: 'trademark-search.trademarks.read' 
    });
    
    const response = await fetch(tokenUrl, { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded', 
            'Authorization': `Basic ${basicAuth}` 
        }, 
        body 
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Errore sconosciuto'));
    }
    return data.access_token;
}

async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    
    // Query RSQL migliorata per ricerche più accurate
    const rsqlQuery = `(wordMarkSpecification.verbalElement==*${brandName}* or wordMarkSpecification.verbalElement=="${brandName}") and niceClasses=in=(${classes.join(',')}) and status=in=("REGISTERED","FILED","PUBLISHED","OPPOSED")`;
    
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=20&sort=applicationDate:desc`;
    
    const response = await fetch(urlWithQuery, { 
        headers: { 
            'Authorization': `Bearer ${accessToken}`, 
            'X-IBM-Client-Id': clientId 
        } 
    });
    
    if (!response.ok) {
        throw new Error('Ricerca EUIPO fallita.');
    }
    return response.json();
}

function parseEuipoResponse(jsonResponse) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];
    
    for (const record of records) {
        const mark = {
            name: record.wordMarkSpecification?.verbalElement || 'N/D',
            owner: record.applicants?.[0]?.name || 'N/D',
            status: translateStatus(record.status),
            classes: record.niceClasses || [],
            applicationNumber: record.applicationNumber,
            applicationDate: record.applicationDate,
            registrationDate: record.registrationDate,
            expiryDate: record.expiryDate,
            basis: record.basis || 'EUTM',
            imageUrl: record.imageUrl
        };
        
        // Calcola la similarità fonetica/visiva
        mark.similarity = calculateSimilarity(record.wordMarkSpecification?.verbalElement, record.brandName);
        
        similarMarks.push(mark);
    }
    
    // Ordina per similarità decrescente
    return { 
        similarMarks: similarMarks.sort((a, b) => b.similarity - a.similarity) 
    };
}

function translateStatus(status) {
    const statusMap = {
        'REGISTERED': 'Registrato',
        'FILED': 'In domanda',
        'PUBLISHED': 'Pubblicato',
        'OPPOSED': 'In opposizione',
        'REFUSED': 'Rifiutato',
        'EXPIRED': 'Scaduto',
        'WITHDRAWN': 'Ritirato'
    };
    return statusMap[status] || status;
}

function calculateSimilarity(mark1, mark2) {
    if (!mark1 || !mark2) return 0;
    
    const s1 = mark1.toLowerCase().trim();
    const s2 = mark2.toLowerCase().trim();
    
    // Similarità esatta
    if (s1 === s2) return 100;
    
    // Calcolo similarità basato su distanza di Levenshtein
    const maxLen = Math.max(s1.length, s2.length);
    const distance = levenshteinDistance(s1, s2);
    const similarity = ((maxLen - distance) / maxLen) * 100;
    
    return Math.round(similarity);
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Funzione migliorata per chiamare Gemini con modello più potente
async function callGeminiAPI(prompt, useProModel = false) {
    const apiKey = "AIzaSyCt-EHsAzgPzUkRJV7tYMrleoascvM7y-0";
    
    if (!apiKey) {
        throw new Error('API Key di Gemini non è presente nel codice.');
    }

    // Usa Gemini Pro per analisi più complesse e Flash per classificazione rapida
    const model = useProModel ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3,  // Più bassa per output più consistenti
            topK: 40,
            topP: 0.95,
            maxOutputTokens: useProModel ? 2048 : 1024
        }
    };
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Errore da Gemini con modello ${model}:`, errorData);
        
        if (errorData.error?.status === 'RESOURCE_EXHAUSTED') {
            // Fallback a Flash se Pro esaurisce la quota
            if (useProModel) {
                console.log('Fallback a Gemini Flash per quota esaurita...');
                return callGeminiAPI(prompt, false);
            }
            throw new Error("Quota di richieste API per Gemini esaurita.");
        }
        throw new Error("Il servizio AI di Gemini non è riuscito a rispondere.");
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
        throw new Error("Risposta da Gemini non valida o contenuto bloccato.");
    }
    
    return data.candidates[0].content.parts[0].text;
}

// Calcolo del Brand Potential Score™
function calculateBrandScore(similarMarks, riskLevel) {
    let baseScore = 90; // Punteggio base
    
    // Penalità per marchi simili trovati
    const activeSimilarMarks = similarMarks.filter(m => 
        ['Registrato', 'In domanda', 'Pubblicato'].includes(m.status)
    );
    
    // Penalità progressiva per numero di marchi simili
    if (activeSimilarMarks.length > 0) {
        baseScore -= Math.min(activeSimilarMarks.length * 5, 30);
    }
    
    // Penalità per alta similarità
    const highSimilarityMarks = activeSimilarMarks.filter(m => m.similarity > 70);
    if (highSimilarityMarks.length > 0) {
        baseScore -= highSimilarityMarks.length * 10;
    }
    
    // Aggiustamento basato sul livello di rischio
    const riskAdjustment = {
        'BASSO': 5,
        'MODERATO': -10,
        'ALTO': -25,
        'MOLTO ALTO': -40
    };
    
    const riskKey = riskLevel.toUpperCase().split(' - ')[0];
    baseScore += riskAdjustment[riskKey] || 0;
    
    // Assicura che il punteggio sia tra 0 e 100
    return Math.max(0, Math.min(100, baseScore));
}

// --- FLUSSO PRINCIPALE DEL BACKEND ---
module.exports = async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    try {
        const payload = request.body;
        
        // Validazione input
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ 
                error: true,
                message: 'Nome del brand e descrizione prodotti sono obbligatori.' 
            });
        }
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate correttamente su Vercel.');
        }

        // FASE 1: Classificazione AI migliorata con Gemini Flash
        const classificationPrompt = `Sei un esperto classificatore di marchi secondo la Classificazione di Nizza (12a edizione).

ISTRUZIONI:
1. Analizza attentamente la descrizione fornita
2. Identifica TUTTE le classi pertinenti, considerando anche classi correlate
3. Restituisci SOLO i numeri di classe separati da virgole, senza altro testo

KNOWLEDGE BASE:
${NICE_CLASSES_KNOWLEDGE_BASE}

DESCRIZIONE DA ANALIZZARE:
"${payload.productDescription}"

CLASSI PERTINENTI:`;

        const identifiedClassesString = await callGeminiAPI(classificationPrompt, false);
        const identifiedClasses = identifiedClassesString
            .split(',')
            .map(c => parseInt(c.trim()))
            .filter(c => !isNaN(c) && c >= 1 && c <= 45);

        if (identifiedClasses.length === 0) {
            throw new Error("Impossibile identificare classi di Nizza pertinenti.");
        }

        // FASE 2: Ricerca avanzata su EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(
            payload.brandName, 
            identifiedClasses, 
            accessToken, 
            EUIPO_CLIENT_ID
        );
        const euipoResults = parseEuipoResponse(euipoJson);

        // FASE 3: Giudizio legale approfondito con Gemini Pro e riferimenti normativi
        const legalAnalysisPrompt = `Sei un avvocato specializzato in proprietà intellettuale con 20 anni di esperienza in marchi europei.

COMPITO: Fornisci un'analisi legale professionale e dettagliata sulla registrabilità del marchio proposto.

DATI DEL MARCHIO PROPOSTO:
- Nome: "${payload.brandName}"
- Prodotti/Servizi: "${payload.productDescription}"
- Classi di Nizza identificate: ${identifiedClasses.map(c => `Classe ${c}`).join(', ')}
- Territori richiesti: ${payload.selectedCountries.join(', ')}

MARCHI ANTERIORI RILEVANTI (dati ufficiali EUIPO):
${euipoResults.similarMarks.length > 0 
    ? euipoResults.similarMarks.map(mark => 
        `• "${mark.name}" (${mark.applicationNumber})
          Titolare: ${mark.owner}
          Stato: ${mark.status}
          Classi: ${mark.classes.join(', ')}
          Similarità: ${mark.similarity}%
          Data deposito: ${mark.applicationDate || 'N/D'}`
      ).join('\n\n')
    : "Nessun marchio identico o molto simile trovato nel database EUIPO."}

STRUTTURA RICHIESTA DELL'ANALISI:

1. **VALUTAZIONE DEL RISCHIO**
   Indica chiaramente: BASSO / MODERATO / ALTO / MOLTO ALTO

2. **IMPEDIMENTI ASSOLUTI** (con riferimenti normativi)
   - Capacità distintiva (${LEGAL_REFERENCES.CPI.art9}, ${LEGAL_REFERENCES.EUTMR.art7})
   - Carattere descrittivo (${LEGAL_REFERENCES.CPI.art13})
   - Liceità (${LEGAL_REFERENCES.CPI.art10})

3. **IMPEDIMENTI RELATIVI** (con riferimenti normativi)
   - Rischio di confusione (${LEGAL_REFERENCES.CPI.art12}, ${LEGAL_REFERENCES.EUTMR.art8})
   - Analisi dei marchi anteriori trovati
   - Valutazione della somiglianza fonetica, visiva e concettuale
   - Affinità merceologica tra prodotti/servizi

4. **ANALISI TERRITORIALE**
   - Considerazioni specifiche per i territori selezionati
   - Eventuali peculiarità nazionali

5. **RACCOMANDAZIONI STRATEGICHE**
   - Suggerimenti per ridurre i rischi identificati
   - Possibili modifiche al marchio
   - Strategie di deposito alternative

6. **CONCLUSIONE**
   - Giudizio sintetico finale
   - Probabilità di successo della registrazione (in percentuale)

IMPORTANTE: 
- Cita sempre gli articoli di legge pertinenti
- Usa un linguaggio professionale ma comprensibile
- Sii specifico e concreto nelle raccomandazioni
- Considera la giurisprudenza EUIPO e della Corte di Giustizia UE`;

        const syntheticJudgment = await callGeminiAPI(legalAnalysisPrompt, true);
        
        // Estrai il livello di rischio dal giudizio
        const riskMatch = syntheticJudgment.match(/RISCHIO[:\s]*(BASSO|MODERATO|ALTO|MOLTO ALTO)/i);
        const riskLevel = riskMatch ? riskMatch[1] : 'MODERATO';
        
        // Calcola il Brand Potential Score™
        const brandScore = calculateBrandScore(euipoResults.similarMarks, riskLevel);

        // FASE 4: Formatta la risposta completa
        const formattedResponse = {
            success: true,
            brandScore: brandScore,
            riskLevel: riskLevel,
            identifiedClasses: identifiedClasses.map(classNum => {
                // Estrai informazioni dettagliate sulla classe dal knowledge base
                const classInfo = extractClassInfo(classNum, NICE_CLASSES_KNOWLEDGE_BASE);
                return {
                    number: classNum,
                    title: classInfo.title || `Classe ${classNum}`,
                    description: classInfo.description || 'Descrizione non disponibile'
                };
            }),
            similarMarks: euipoResults.similarMarks.map(mark => ({
                ...mark,
                classes: `Cl. ${mark.classes.join(', ')}`
            })),
            syntheticJudgment: syntheticJudgment,
            searchMetadata: {
                searchDate: new Date().toISOString(),
                totalResults: euipoResults.similarMarks.length,
                databaseSource: 'EUIPO',
                analysisModel: 'Gemini Pro 1.5'
            }
        };

        return response.status(200).json(formattedResponse);

    } catch (error) {
        console.error("ERRORE nel backend:", error);
        
        // Gestione errori più granulare
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.message.includes('Quota')) {
            statusCode = 429;
            errorMessage = 'Limite di richieste raggiunto. Riprova tra qualche minuto.';
        } else if (error.message.includes('EUIPO')) {
            statusCode = 503;
            errorMessage = 'Servizio EUIPO temporaneamente non disponibile.';
        }
        
        return response.status(statusCode).json({ 
            error: true, 
            message: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
};

// Funzione helper per estrarre info dettagliate sulle classi
function extractClassInfo(classNumber, knowledgeBase) {
    const regex = new RegExp(`Classe ${classNumber}:([^\\n]+)`, 'i');
    const match = knowledgeBase.match(regex);
    
    if (match) {
        const fullText = match[1].trim();
        const parts = fullText.split(';');
        return {
            title: parts[0].trim(),
            description: parts.slice(0, 2).join(';').trim()
        };
    }
    
    return {
        title: `Classe ${classNumber}`,
        description: 'Prodotti e servizi vari'
    };
}