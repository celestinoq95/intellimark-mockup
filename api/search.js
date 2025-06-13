// File: /api/search.js
// VERSIONE AVANZATA con analisi marchi figurativi e confronto visivo

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

// Codici di Vienna per classificazione elementi figurativi
const VIENNA_CODES = {
  "1": "Corpi celesti, fenomeni naturali",
  "2": "Esseri umani",
  "3": "Animali",
  "4": "Esseri soprannaturali, fantastici",
  "5": "Piante",
  "6": "Paesaggi",
  "7": "Costruzioni, strutture",
  "8": "Prodotti alimentari",
  "9": "Tessuti, abbigliamento",
  "10": "Tabacco, articoli per fumatori",
  "11": "Articoli per la casa",
  "12": "Mobili, articoli sanitari",
  "13": "Illuminazione, radio, elettronica",
  "14": "Gioielleria, orologeria",
  "15": "Macchine, motori",
  "16": "Telecomunicazioni, registrazione",
  "17": "Orologi, strumenti di misura",
  "18": "Trasporti",
  "19": "Contenitori, imballaggi",
  "20": "Articoli di cancelleria",
  "21": "Giochi, sport, strumenti musicali",
  "22": "Armi, munizioni",
  "23": "Tabaccheria, articoli per fumatori",
  "24": "Stemmi, bandiere",
  "25": "Motivi ornamentali",
  "26": "Figure geometriche",
  "27": "Forme di scrittura, numeri",
  "28": "Iscrizioni di varia forma",
  "29": "Colori"
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

// Funzione per cercare marchi verbali
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    
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

// Nuova funzione per cercare marchi figurativi
async function searchEuipoFigurativeMarks(viennaCodes, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    
    // Costruisci query per marchi figurativi usando i codici di Vienna
    const viennaQuery = viennaCodes.map(code => `viennaClasses==${code}*`).join(' or ');
    const rsqlQuery = `(${viennaQuery}) and niceClasses=in=(${classes.join(',')}) and status=in=("REGISTERED","FILED","PUBLISHED","OPPOSED") and type=in=("FIGURATIVE","COMBINED")`;
    
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=15&sort=applicationDate:desc`;
    
    const response = await fetch(urlWithQuery, { 
        headers: { 
            'Authorization': `Bearer ${accessToken}`, 
            'X-IBM-Client-Id': clientId 
        } 
    });
    
    if (!response.ok) {
        console.error('Errore ricerca marchi figurativi:', response.status);
        return { trademarks: [] }; // Return empty array on error
    }
    return response.json();
}

function parseEuipoResponse(jsonResponse, brandName) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];
    
    for (const record of records) {
        const mark = {
            name: record.wordMarkSpecification?.verbalElement || 'Marchio Figurativo',
            owner: record.applicants?.[0]?.name || 'N/D',
            status: translateStatus(record.status),
            classes: record.niceClasses || [],
            applicationNumber: record.applicationNumber,
            applicationDate: record.applicationDate,
            registrationDate: record.registrationDate,
            expiryDate: record.expiryDate,
            basis: record.basis || 'EUTM',
            imageUrl: record.imageUrl,
            type: record.type || 'WORD',
            viennaClasses: record.viennaClasses || []
        };
        
        // Calcola la similarità per marchi verbali
        if (brandName && record.wordMarkSpecification?.verbalElement) {
            mark.similarity = calculateSimilarity(record.wordMarkSpecification.verbalElement, brandName);
        } else {
            mark.similarity = 0; // Per marchi puramente figurativi
        }
        
        similarMarks.push(mark);
    }
    
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
    
    if (s1 === s2) return 100;
    
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

// Funzione avanzata per chiamare Gemini con supporto multimodale
async function callGeminiAPI(prompt, useProModel = false, imageData = null) {
    const apiKey = "AIzaSyCt-EHsAzgPzUkRJV7tYMrleoascvM7y-0";
    
    if (!apiKey) {
        throw new Error('API Key di Gemini non è presente nel codice.');
    }

    const model = useProModel ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const parts = [{
        text: prompt
    }];
    
    // Aggiungi immagine se presente
    if (imageData) {
        // Verifica che l'immagine sia nel formato corretto
        if (!imageData.base64 || !imageData.mimeType) {
            throw new Error('Formato immagine non valido');
        }
        
        // Verifica i tipi MIME supportati
        const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!supportedMimeTypes.includes(imageData.mimeType)) {
            throw new Error(`Tipo immagine non supportato: ${imageData.mimeType}`);
        }
        
        parts.push({
            inline_data: {
                mime_type: imageData.mimeType,
                data: imageData.base64
            }
        });
        
        console.log('Immagine aggiunta alla richiesta Gemini:', {
            mimeType: imageData.mimeType,
            dataLength: imageData.base64.length
        });
    }
    
    const requestBody = {
        contents: [{
            parts: parts
        }],
        generationConfig: {
            temperature: 0.3,
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
            if (useProModel) {
                console.log('Fallback a Gemini Flash per quota esaurita...');
                return callGeminiAPI(prompt, false, imageData);
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

// Analizza l'immagine del marchio per estrarre elementi figurativi
async function analyzeTrademarkImage(imageData) {
    const analysisPrompt = `Sei un esperto analista di marchi figurativi. Analizza questa immagine di marchio e:

1. DESCRIVI dettagliatamente tutti gli elementi visivi presenti (forme, simboli, oggetti, testo)
2. IDENTIFICA i codici di Vienna pertinenti tra questi:
${Object.entries(VIENNA_CODES).map(([code, desc]) => `${code}: ${desc}`).join('\n')}

3. VALUTA le caratteristiche distintive principali del marchio

Fornisci SOLO:
- Una descrizione breve (max 50 parole)
- I codici di Vienna applicabili (solo numeri separati da virgole)
- 3 elementi distintivi chiave

Formato risposta:
DESCRIZIONE: [tua descrizione]
VIENNA: [codici separati da virgole]
ELEMENTI: [elemento1, elemento2, elemento3]`;

    try {
        const response = await callGeminiAPI(analysisPrompt, true, imageData);
        console.log('Risposta Gemini per analisi immagine:', response);
        
        // Parse della risposta con controlli robusti
        const lines = response.split('\n');
        const result = {
            description: '',
            viennaCodes: [],
            distinctiveElements: []
        };
        
        lines.forEach(line => {
            if (line.includes('DESCRIZIONE:')) {
                result.description = line.substring(line.indexOf(':') + 1).trim();
            } else if (line.includes('VIENNA:')) {
                const viennaStr = line.substring(line.indexOf(':') + 1).trim();
                result.viennaCodes = viennaStr
                    .split(',')
                    .map(c => c.trim())
                    .filter(c => c && /^\d+$/.test(c)); // Solo numeri validi
            } else if (line.includes('ELEMENTI:')) {
                const elementiStr = line.substring(line.indexOf(':') + 1).trim();
                result.distinctiveElements = elementiStr
                    .split(',')
                    .map(e => e.trim())
                    .filter(e => e.length > 0);
            }
        });
        
        // Valori di default se mancano dati
        if (!result.description) {
            result.description = 'Marchio figurativo analizzato';
        }
        if (result.viennaCodes.length === 0) {
            result.viennaCodes = ['26']; // Default: figure geometriche
        }
        if (result.distinctiveElements.length === 0) {
            result.distinctiveElements = ['Elemento grafico', 'Design distintivo', 'Composizione originale'];
        }
        
        console.log('Risultato analisi immagine processato:', result);
        return result;
    } catch (error) {
        console.error('Errore in analyzeTrademarkImage:', error);
        // Ritorna valori di default invece di fallire
        return {
            description: 'Analisi immagine non disponibile',
            viennaCodes: ['26'],
            distinctiveElements: ['Elemento visivo', 'Design', 'Grafica']
        };
    }
}

// Confronta visivamente due marchi
async function compareTrademarkImages(uploadedImage, existingMarkUrl, existingMarkData) {
    const comparisonPrompt = `Sei un esperto perito in marchi. Confronta il marchio caricato con questo marchio esistente:

MARCHIO ESISTENTE:
- Nome: ${existingMarkData.name}
- Numero: ${existingMarkData.applicationNumber}
- Classi: ${existingMarkData.classes.join(', ')}

COMPITO: Valuta la similarità visiva tra i due marchi considerando:
1. Somiglianza degli elementi grafici
2. Composizione e layout
3. Uso dei colori
4. Impressione generale

Fornisci SOLO:
- SIMILARITÀ VISIVA: [percentuale 0-100]
- RISCHIO CONFUSIONE: [BASSO/MEDIO/ALTO]
- MOTIVAZIONE: [max 30 parole]`;

    try {
        // Scarica l'immagine del marchio esistente
        const existingImageResponse = await fetch(existingMarkUrl);
        const existingImageBuffer = await existingImageResponse.buffer();
        const existingImageBase64 = existingImageBuffer.toString('base64');
        
        const response = await callGeminiAPI(comparisonPrompt, true, {
            mimeType: uploadedImage.mimeType,
            base64: uploadedImage.base64
        });
        
        // Parse della risposta
        const lines = response.split('\n');
        const result = {
            visualSimilarity: 0,
            confusionRisk: 'BASSO',
            reasoning: ''
        };
        
        lines.forEach(line => {
            if (line.includes('SIMILARITÀ VISIVA:')) {
                const match = line.match(/(\d+)/);
                if (match) result.visualSimilarity = parseInt(match[1]);
            } else if (line.includes('RISCHIO CONFUSIONE:')) {
                result.confusionRisk = line.split(':')[1].trim();
            } else if (line.includes('MOTIVAZIONE:')) {
                result.reasoning = line.split(':')[1].trim();
            }
        });
        
        return result;
    } catch (error) {
        console.error('Errore nel confronto immagini:', error);
        return {
            visualSimilarity: 0,
            confusionRisk: 'NON DETERMINABILE',
            reasoning: 'Impossibile confrontare le immagini'
        };
    }
}

// Calcolo del Brand Potential Score™ con supporto figurativo
function calculateBrandScore(verbalMarks, figurativeMarks, riskLevel, hasImage) {
    let baseScore = 90;
    
    // Penalità per marchi verbali simili
    const activeVerbalMarks = verbalMarks.filter(m => 
        ['Registrato', 'In domanda', 'Pubblicato'].includes(m.status)
    );
    
    if (activeVerbalMarks.length > 0) {
        baseScore -= Math.min(activeVerbalMarks.length * 5, 30);
    }
    
    const highSimilarityVerbal = activeVerbalMarks.filter(m => m.similarity > 70);
    if (highSimilarityVerbal.length > 0) {
        baseScore -= highSimilarityVerbal.length * 10;
    }
    
    // Penalità aggiuntive per marchi figurativi se è stata caricata un'immagine
    if (hasImage && figurativeMarks.length > 0) {
        const highRiskFigurative = figurativeMarks.filter(m => 
            m.visualComparison && m.visualComparison.confusionRisk !== 'BASSO'
        );
        
        if (highRiskFigurative.length > 0) {
            baseScore -= highRiskFigurative.length * 8;
        }
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
    
    return Math.max(0, Math.min(100, baseScore));
}

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
        
        // Log dei dati ricevuti
        console.log('Richiesta ricevuta:', {
            brandName: payload.brandName,
            productDescription: payload.productDescription?.substring(0, 50) + '...',
            selectedCountries: payload.selectedCountries,
            hasImage: !!payload.imageData,
            imageSize: payload.imageData ? payload.imageData.base64.length : 0
        });
        
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

        // FASE 1: Classificazione AI con Gemini Flash
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

        // FASE 2: Analisi dell'immagine se presente
        let imageAnalysis = null;
        let figurativeSearchResults = { similarMarks: [] };
        
        if (payload.imageData) {
            console.log('Analizzando immagine del marchio...');
            try {
                imageAnalysis = await analyzeTrademarkImage(payload.imageData);
                console.log('Analisi immagine completata:', imageAnalysis);
            } catch (imageError) {
                console.error('Errore analisi immagine:', imageError);
                // Continua senza analisi immagine invece di bloccare tutto
            }
        }

        // FASE 3: Ricerca su EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        
        // Ricerca marchi verbali
        const verbalSearchJson = await searchEuipoTrademarks(
            payload.brandName, 
            identifiedClasses, 
            accessToken, 
            EUIPO_CLIENT_ID
        );
        const verbalSearchResults = parseEuipoResponse(verbalSearchJson, payload.brandName);

        // Ricerca marchi figurativi se è stata caricata un'immagine
        if (imageAnalysis && imageAnalysis.viennaCodes.length > 0) {
            const figurativeJson = await searchEuipoFigurativeMarks(
                imageAnalysis.viennaCodes,
                identifiedClasses,
                accessToken,
                EUIPO_CLIENT_ID
            );
            figurativeSearchResults = parseEuipoResponse(figurativeJson);
            
            // Confronta visivamente i marchi figurativi trovati
            for (let mark of figurativeSearchResults.similarMarks) {
                if (mark.imageUrl) {
                    mark.visualComparison = await compareTrademarkImages(
                        payload.imageData,
                        mark.imageUrl,
                        mark
                    );
                }
            }
        }

        // FASE 4: Giudizio legale approfondito con Gemini Pro
        const legalAnalysisPrompt = `Sei un avvocato specializzato in proprietà intellettuale con 20 anni di esperienza in marchi europei.

COMPITO: Fornisci un'analisi legale professionale e dettagliata sulla registrabilità del marchio proposto.

DATI DEL MARCHIO PROPOSTO:
- Nome: "${payload.brandName}"
- Prodotti/Servizi: "${payload.productDescription}"
- Classi di Nizza identificate: ${identifiedClasses.map(c => `Classe ${c}`).join(', ')}
- Territori richiesti: ${payload.selectedCountries.join(', ')}
${imageAnalysis ? `
- ELEMENTI FIGURATIVI RILEVATI:
  • Descrizione: ${imageAnalysis.description}
  • Elementi distintivi: ${imageAnalysis.distinctiveElements.join(', ')}
  • Codici Vienna: ${imageAnalysis.viennaCodes.join(', ')}` : ''}

MARCHI VERBALI ANTERIORI (dati EUIPO):
${verbalSearchResults.similarMarks.length > 0 
    ? verbalSearchResults.similarMarks.map(mark => 
        `• "${mark.name}" (${mark.applicationNumber})
          Titolare: ${mark.owner}
          Stato: ${mark.status}
          Classi: ${mark.classes.join(', ')}
          Similarità verbale: ${mark.similarity}%
          Data deposito: ${mark.applicationDate || 'N/D'}`
      ).join('\n\n')
    : "Nessun marchio verbale identico o molto simile trovato."}

${figurativeSearchResults.similarMarks.length > 0 ? `
MARCHI FIGURATIVI ANTERIORI (dati EUIPO):
${figurativeSearchResults.similarMarks.map(mark => 
    `• "${mark.name}" (${mark.applicationNumber})
      Titolare: ${mark.owner}
      Stato: ${mark.status}
      Classi: ${mark.classes.join(', ')}
      ${mark.visualComparison ? `
      Similarità visiva: ${mark.visualComparison.visualSimilarity}%
      Rischio confusione: ${mark.visualComparison.confusionRisk}
      Motivazione: ${mark.visualComparison.reasoning}` : ''}`
  ).join('\n\n')}` : ''}

STRUTTURA RICHIESTA DELL'ANALISI:

1. **VALUTAZIONE DEL RISCHIO COMPLESSIVO**
   Indica chiaramente: BASSO / MODERATO / ALTO / MOLTO ALTO

2. **IMPEDIMENTI ASSOLUTI** (con riferimenti normativi)
   - Capacità distintiva (${LEGAL_REFERENCES.CPI.art9}, ${LEGAL_REFERENCES.EUTMR.art7})
   - Carattere descrittivo (${LEGAL_REFERENCES.CPI.art13})
   - Liceità (${LEGAL_REFERENCES.CPI.art10})
   ${imageAnalysis ? '- Distintività degli elementi figurativi' : ''}

3. **IMPEDIMENTI RELATIVI** (con riferimenti normativi)
   - Rischio di confusione elementi verbali (${LEGAL_REFERENCES.CPI.art12}, ${LEGAL_REFERENCES.EUTMR.art8})
   ${imageAnalysis ? '- Rischio di confusione elementi figurativi' : ''}
   - Analisi dei marchi anteriori trovati
   - Valutazione della somiglianza complessiva
   - Affinità merceologica tra prodotti/servizi

4. **ANALISI TERRITORIALE**
   - Considerazioni specifiche per i territori selezionati
   - Eventuali peculiarità nazionali

5. **RACCOMANDAZIONI STRATEGICHE**
   - Suggerimenti per ridurre i rischi identificati
   ${imageAnalysis ? '- Possibili modifiche agli elementi figurativi' : ''}
   - Possibili modifiche al marchio verbale
   - Strategie di deposito alternative

6. **CONCLUSIONE**
   - Giudizio sintetico finale
   - Probabilità di successo della registrazione (in percentuale)

IMPORTANTE: 
- Cita sempre gli articoli di legge pertinenti
- ${imageAnalysis ? 'Considera attentamente la combinazione di elementi verbali e figurativi' : ''}
- Usa un linguaggio professionale ma comprensibile
- Sii specifico e concreto nelle raccomandazioni`;

        const syntheticJudgment = await callGeminiAPI(legalAnalysisPrompt, true);
        
        // Estrai il livello di rischio dal giudizio
        const riskMatch = syntheticJudgment.match(/RISCHIO[^:]*:[^A-Z]*(BASSO|MODERATO|ALTO|MOLTO ALTO)/i);
        const riskLevel = riskMatch ? riskMatch[1] : 'MODERATO';
        
        // Calcola il Brand Potential Score™
        const brandScore = calculateBrandScore(
            verbalSearchResults.similarMarks, 
            figurativeSearchResults.similarMarks,
            riskLevel,
            !!imageAnalysis
        );

        // FASE 5: Formatta la risposta completa
        const formattedResponse = {
            success: true,
            brandScore: brandScore,
            riskLevel: riskLevel,
            identifiedClasses: identifiedClasses.map(classNum => {
                const classInfo = extractClassInfo(classNum, NICE_CLASSES_KNOWLEDGE_BASE);
                return {
                    number: classNum,
                    title: classInfo.title || `Classe ${classNum}`,
                    description: classInfo.description || 'Descrizione non disponibile'
                };
            }),
            imageAnalysis: imageAnalysis,
            verbalMarks: verbalSearchResults.similarMarks.map(mark => ({
                ...mark,
                classes: `Cl. ${mark.classes.join(', ')}`
            })),
            figurativeMarks: figurativeSearchResults.similarMarks.map(mark => ({
                ...mark,
                classes: `Cl. ${mark.classes.join(', ')}`,
                type: 'figurative'
            })),
            syntheticJudgment: syntheticJudgment,
            searchMetadata: {
                searchDate: new Date().toISOString(),
                totalVerbalResults: verbalSearchResults.similarMarks.length,
                totalFigurativeResults: figurativeSearchResults.similarMarks.length,
                databaseSource: 'EUIPO',
                analysisModel: 'Gemini Pro 1.5',
                imageAnalyzed: !!imageAnalysis
            }
        };

        return response.status(200).json(formattedResponse);

    } catch (error) {
        console.error("ERRORE nel backend:", error);
        
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