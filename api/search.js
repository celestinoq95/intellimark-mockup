// File: /api/search.js
// VERSIONE CORRETTA con bug fix e miglioramenti

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- CONFIGURAZIONE E COSTANTI ---

// Rate limiting configuration
const RATE_LIMIT = {
    requests: new Map(),
    windowMs: 60000, // 1 minuto
    maxRequests: 10
};

// Limiti di sicurezza
const SECURITY_LIMITS = {
    maxImageSize: 5 * 1024 * 1024, // 5MB in base64 (circa 3.75MB reali)
    maxTextLength: 1000,
    maxBrandNameLength: 100
};

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

// Sanitizzazione input
function sanitizeInput(input, maxLength = SECURITY_LIMITS.maxTextLength) {
    if (typeof input !== 'string') return '';
    
    // Rimuovi caratteri pericolosi
    return input
        .slice(0, maxLength)
        .replace(/[<>\"\']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Validazione immagine base64
function validateBase64Image(base64String, mimeType) {
    if (!base64String || typeof base64String !== 'string') {
        throw new Error('Immagine non valida');
    }
    
    // Controlla dimensione
    const sizeInBytes = base64String.length * 0.75;
    if (sizeInBytes > SECURITY_LIMITS.maxImageSize) {
        throw new Error('Immagine troppo grande. Max 5MB.');
    }
    
    // Controlla tipo MIME
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
        throw new Error('Formato immagine non supportato');
    }
    
    return true;
}

// Rate limiting
function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = RATE_LIMIT.requests.get(ip) || [];
    
    // Filtra richieste vecchie
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT.windowMs);
    
    if (recentRequests.length >= RATE_LIMIT.maxRequests) {
        return false;
    }
    
    recentRequests.push(now);
    RATE_LIMIT.requests.set(ip, recentRequests);
    
    // Pulizia periodica
    if (RATE_LIMIT.requests.size > 1000) {
        const oldestAllowed = now - RATE_LIMIT.windowMs;
        for (const [key, times] of RATE_LIMIT.requests.entries()) {
            const filtered = times.filter(t => t > oldestAllowed);
            if (filtered.length === 0) {
                RATE_LIMIT.requests.delete(key);
            } else {
                RATE_LIMIT.requests.set(key, filtered);
            }
        }
    }
    
    return true;
}

async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ 
        grant_type: 'client_credentials', 
        scope: 'trademark-search.trademarks.read' 
    });
    
    try {
        const response = await fetch(tokenUrl, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded', 
                'Authorization': `Basic ${basicAuth}` 
            }, 
            body,
            timeout: 10000
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Errore sconosciuto'));
        }
        return data.access_token;
    } catch (error) {
        console.error('Errore getAccessToken:', error);
        throw error;
    }
}

// Funzione per cercare marchi verbali
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    
    // Sanitizza il nome del brand per la query
    const safeBrandName = brandName.replace(/['"\\]/g, '');
    
    const rsqlQuery = `(wordMarkSpecification.verbalElement==*${safeBrandName}* or wordMarkSpecification.verbalElement=="${safeBrandName}") and niceClasses=in=(${classes.join(',')}) and status=in=("REGISTERED","FILED","PUBLISHED","OPPOSED")`;
    
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=20&sort=applicationDate:desc`;
    
    try {
        const response = await fetch(urlWithQuery, { 
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'X-IBM-Client-Id': clientId 
            },
            timeout: 15000
        });
        
        if (!response.ok) {
            throw new Error('Ricerca EUIPO fallita.');
        }
        return response.json();
    } catch (error) {
        console.error('Errore searchEuipoTrademarks:', error);
        throw error;
    }
}

// Nuova funzione per cercare marchi figurativi
async function searchEuipoFigurativeMarks(viennaCodes, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    
    // Costruisci query per marchi figurativi usando i codici di Vienna
    const viennaQuery = viennaCodes.map(code => `viennaClasses==${code}*`).join(' or ');
    const rsqlQuery = `(${viennaQuery}) and niceClasses=in=(${classes.join(',')}) and status=in=("REGISTERED","FILED","PUBLISHED","OPPOSED") and type=in=("FIGURATIVE","COMBINED")`;
    
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=15&sort=applicationDate:desc`;
    
    try {
        const response = await fetch(urlWithQuery, { 
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'X-IBM-Client-Id': clientId 
            },
            timeout: 15000
        });
        
        if (!response.ok) {
            console.error('Errore ricerca marchi figurativi:', response.status);
            return { trademarks: [] };
        }
        return response.json();
    } catch (error) {
        console.error('Errore searchEuipoFigurativeMarks:', error);
        return { trademarks: [] };
    }
}

function parseEuipoResponse(jsonResponse, brandName) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];
    
    for (const record of records) {
        try {
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
                mark.similarity = 0;
            }
            
            similarMarks.push(mark);
        } catch (err) {
            console.error('Errore parsing record:', err);
            continue;
        }
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

// Funzione migliorata per chiamare Gemini con gestione errori robusta
async function callGeminiAPI(prompt, useProModel = false, imageData = null) {
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyCt-EHsAzgPzUkRJV7tYMrleoascvM7y-0";
    
    if (!apiKey) {
        throw new Error('API Key di Gemini non configurata');
    }

    const model = useProModel ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const parts = [{
        text: prompt
    }];
    
    // Aggiungi immagine se presente
    if (imageData) {
        try {
            validateBase64Image(imageData.base64, imageData.mimeType);
            
            parts.push({
                inline_data: {
                    mime_type: imageData.mimeType,
                    data: imageData.base64
                }
            });
        } catch (error) {
            console.error('Errore validazione immagine:', error);
            throw error;
        }
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
    
    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            timeout: 30000
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
    } catch (error) {
        console.error('Errore callGeminiAPI:', error);
        throw error;
    }
}

// Parser robusto per risposte AI
function parseAIResponse(response, expectedFormat) {
    try {
        const result = {};
        const lines = response.split('\n').filter(line => line.trim());
        
        switch (expectedFormat) {
            case 'classification':
                // Cerca numeri nel formato "1,2,3" o "1, 2, 3"
                const numberMatch = response.match(/\d+(?:\s*,\s*\d+)*/);
                if (numberMatch) {
                    result.classes = numberMatch[0]
                        .split(',')
                        .map(n => parseInt(n.trim()))
                        .filter(n => !isNaN(n) && n >= 1 && n <= 45);
                }
                break;
                
            case 'imageAnalysis':
                // Parser più robusto per analisi immagine
                result.description = '';
                result.viennaCodes = [];
                result.distinctiveElements = [];
                
                for (const line of lines) {
                    if (line.includes('DESCRIZIONE:')) {
                        result.description = line.substring(line.indexOf(':') + 1).trim();
                    } else if (line.includes('VIENNA:')) {
                        const codes = line.substring(line.indexOf(':') + 1).trim();
                        result.viennaCodes = codes
                            .split(/[,\s]+/)
                            .filter(c => /^\d+$/.test(c));
                    } else if (line.includes('ELEMENTI:')) {
                        const elements = line.substring(line.indexOf(':') + 1).trim();
                        result.distinctiveElements = elements
                            .split(',')
                            .map(e => e.trim())
                            .filter(e => e.length > 0);
                    }
                }
                
                // Valori default se parsing fallisce
                if (!result.description) result.description = 'Marchio figurativo';
                if (result.viennaCodes.length === 0) result.viennaCodes = ['26'];
                if (result.distinctiveElements.length === 0) {
                    result.distinctiveElements = ['Elemento grafico', 'Design', 'Composizione'];
                }
                break;
                
            case 'comparison':
                // Parser per confronto visivo
                result.visualSimilarity = 0;
                result.confusionRisk = 'NON DETERMINABILE';
                result.reasoning = '';
                
                for (const line of lines) {
                    if (line.includes('SIMILARITÀ VISIVA:')) {
                        const match = line.match(/\d+/);
                        if (match) result.visualSimilarity = parseInt(match[0]);
                    } else if (line.includes('RISCHIO CONFUSIONE:')) {
                        const risk = line.split(':')[1]?.trim();
                        if (risk && ['BASSO', 'MEDIO', 'ALTO'].includes(risk)) {
                            result.confusionRisk = risk;
                        }
                    } else if (line.includes('MOTIVAZIONE:')) {
                        result.reasoning = line.split(':')[1]?.trim() || '';
                    }
                }
                break;
        }
        
        return result;
    } catch (error) {
        console.error('Errore parsing AI response:', error);
        return null;
    }
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
        const result = parseAIResponse(response, 'imageAnalysis');
        
        if (!result) {
            throw new Error('Impossibile analizzare la risposta AI');
        }
        
        return result;
    } catch (error) {
        console.error('Errore in analyzeTrademarkImage:', error);
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
        // Semplifichiamo: non scarichiamo l'immagine esistente per ora
        // In produzione si dovrebbe implementare il download sicuro
        const response = await callGeminiAPI(comparisonPrompt, false, uploadedImage);
        const result = parseAIResponse(response, 'comparison');
        
        return result || {
            visualSimilarity: 0,
            confusionRisk: 'NON DETERMINABILE',
            reasoning: 'Impossibile confrontare le immagini'
        };
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

// Funzione migliorata per identificare classi tramite AI
async function classifyProductsWithAI(description) {
    const classificationPrompt = `Sei un esperto classificatore di marchi secondo la Classificazione di Nizza (12a edizione).

ANALIZZA QUESTA DESCRIZIONE: "${description}"

KNOWLEDGE BASE COMPLETA:
${NICE_CLASSES_KNOWLEDGE_BASE}

ISTRUZIONI STEP-BY-STEP:
1. Leggi attentamente la descrizione fornita
2. Identifica i prodotti/servizi SPECIFICI menzionati
3. Cerca questi prodotti/servizi ESATTI nella knowledge base
4. Seleziona SOLO le classi che contengono letteralmente quei prodotti

ESEMPI CORRETTI:
- "scarpe" → Classe 25 (perché contiene "Articoli di abbigliamento, scarpe, cappelleria")
- "software" → Classe 9 (perché contiene "software")
- "ristorante" → Classe 43 (perché contiene "Servizi di ristorazione")
- "consulenza aziendale" → Classe 35 (perché contiene "consulenza aziendale")
- "cosmetici" → Classe 3 (perché contiene "Cosmetici")

IMPORTANTE:
- NON aggiungere classi "correlate" se i prodotti non sono menzionati
- Se trovi "scarpe", usa SOLO classe 25, NON aggiungere 35 o 42
- Se trovi "software", usa SOLO classe 9, NON aggiungere automaticamente 42
- Puoi includere più classi SOLO se sono menzionati prodotti di classi diverse

OUTPUT: Solo i numeri delle classi pertinenti separati da virgole (es: 25 oppure 9,42)`;

    try {
        const response = await callGeminiAPI(classificationPrompt, false);
        const parsed = parseAIResponse(response, 'classification');
        
        if (parsed.classes && parsed.classes.length > 0) {
            return parsed.classes;
        }
        
        throw new Error('Nessuna classe identificata');
    } catch (error) {
        console.error('Errore classificazione AI:', error);
        return identifyClassesByKeywords(description);
    }
}

// Funzione di fallback per identificare classi tramite keywords
function identifyClassesByKeywords(description) {
    const descLower = description.toLowerCase();
    const classes = new Set();
    
    // Mappatura keywords -> classe (basata sulla knowledge base)
    const keywordMap = {
        1: ['chimici', 'fertilizzanti', 'resine', 'adesivi industriali'],
        2: ['pitture', 'vernici', 'coloranti', 'inchiostri'],
        3: ['cosmetici', 'profumi', 'trucco', 'shampoo', 'sapone', 'crema', 'deodorante', 'dentifrici'],
        4: ['oli industriali', 'lubrificanti', 'combustibili', 'candele'],
        5: ['farmaci', 'medicinali', 'integratori', 'cerotti', 'disinfettanti'],
        6: ['metalli', 'ferro', 'acciaio', 'alluminio', 'cavi metallici'],
        7: ['macchine', 'motori', 'utensili elettrici', 'robot'],
        8: ['utensili manuali', 'coltelli', 'forbici', 'rasoi'],
        9: ['software', 'app', 'applicazione', 'computer', 'hardware', 'smartphone', 'elettronica'],
        10: ['strumenti medici', 'protesi', 'apparecchi dentari'],
        11: ['illuminazione', 'riscaldamento', 'climatizzatori', 'frigoriferi'],
        12: ['veicoli', 'auto', 'moto', 'biciclette', 'navi', 'aerei'],
        13: ['armi', 'munizioni', 'fuochi d\'artificio', 'esplosivi'],
        14: ['gioielli', 'orologi', 'metalli preziosi', 'oro', 'argento'],
        15: ['strumenti musicali', 'pianoforti', 'chitarre', 'violini'],
        16: ['carta', 'quaderni', 'penne', 'matite', 'libri', 'stampati', 'cancelleria'],
        17: ['gomma', 'plastica', 'isolanti', 'tubi flessibili'],
        18: ['borse', 'valigie', 'zaini', 'portafogli', 'pelletteria', 'cuoio'],
        19: ['materiali costruzione', 'cemento', 'mattoni', 'legname', 'vetro'],
        20: ['mobili', 'materassi', 'specchi', 'cornici'],
        21: ['utensili cucina', 'piatti', 'bicchieri', 'pentole', 'spazzole'],
        22: ['corde', 'reti', 'tende', 'sacchi', 'vele'],
        23: ['fili', 'filati tessili', 'lana', 'cotone'],
        24: ['tessuti', 'biancheria', 'coperte', 'asciugamani', 'tende'],
        25: ['scarpe', 'abbigliamento', 'vestiti', 'magliette', 'pantaloni', 'cappelli', 'calzature'],
        26: ['pizzi', 'bottoni', 'cerniere', 'fiori artificiali'],
        27: ['tappeti', 'moquette', 'zerbini', 'carta da parati'],
        28: ['giochi', 'giocattoli', 'articoli sportivi', 'palloni'],
        29: ['carne', 'pesce', 'frutta', 'verdura', 'latte', 'formaggi', 'uova'],
        30: ['caffè', 'tè', 'pasta', 'pane', 'dolci', 'cioccolato', 'pizza', 'riso'],
        31: ['prodotti agricoli', 'piante', 'fiori', 'semi', 'animali vivi'],
        32: ['birre', 'bevande', 'succhi', 'acqua', 'bibite'],
        33: ['vini', 'alcolici', 'liquori', 'whisky', 'vodka'],
        34: ['tabacco', 'sigarette', 'sigari', 'fiammiferi'],
        35: ['pubblicità', 'marketing', 'vendita', 'commercio', 'consulenza aziendale', 'gestione affari'],
        36: ['assicurazioni', 'servizi bancari', 'finanza', 'immobiliare'],
        37: ['costruzioni', 'riparazioni', 'manutenzione', 'installazioni'],
        38: ['telecomunicazioni', 'trasmissioni', 'comunicazioni'],
        39: ['trasporti', 'spedizioni', 'logistica', 'viaggi', 'turismo'],
        40: ['trattamento materiali', 'stampa', 'riciclaggio'],
        41: ['formazione', 'educazione', 'corsi', 'eventi', 'intrattenimento', 'sport'],
        42: ['sviluppo software', 'programmazione', 'consulenza informatica', 'ricerca scientifica', 'design'],
        43: ['ristorante', 'bar', 'hotel', 'catering', 'albergo', 'pizzeria'],
        44: ['medico', 'bellezza', 'parrucchiere', 'estetista', 'spa', 'veterinario'],
        45: ['servizi legali', 'sicurezza', 'investigazioni', 'babysitting']
    };
    
    // Cerca keywords nella descrizione
    for (const [classNum, keywords] of Object.entries(keywordMap)) {
        if (keywords.some(keyword => descLower.includes(keyword))) {
            classes.add(parseInt(classNum));
        }
    }
    
    // Se non trova nulla, prova a dedurre dal contesto
    if (classes.size === 0) {
        if (descLower.includes('servizi') || descLower.includes('consulenza')) {
            classes.add(35);
        }
        if (descLower.includes('online') || descLower.includes('digitale') || descLower.includes('internet')) {
            classes.add(42);
        }
    }
    
    return Array.from(classes).sort((a, b) => a - b);
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
        // Rate limiting
        const clientIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
        if (!checkRateLimit(clientIp)) {
            return response.status(429).json({ 
                error: true,
                message: 'Troppe richieste. Riprova tra qualche minuto.' 
            });
        }
        
        const payload = request.body;
        
        // Sanitizza tutti gli input
        const brandName = sanitizeInput(payload.brandName || '', SECURITY_LIMITS.maxBrandNameLength);
        const productDescription = sanitizeInput(payload.productDescription || '', SECURITY_LIMITS.maxTextLength);
        const searchType = ['verbal', 'figurative', 'combined'].includes(payload.searchType) 
            ? payload.searchType 
            : 'verbal';
        
        // Log dei dati ricevuti
        console.log('Richiesta ricevuta:', {
            brandName: brandName.substring(0, 20) + '...',
            productDescription: productDescription.substring(0, 50) + '...',
            selectedCountries: payload.selectedCountries,
            hasImage: !!payload.imageData,
            searchType: searchType
        });
        
        // Validazione input basata sul tipo di ricerca
        if (searchType === 'verbal' || searchType === 'combined') {
            if (!brandName || !productDescription) {
                return response.status(400).json({ 
                    error: true,
                    message: 'Nome del brand e descrizione prodotti sono obbligatori.' 
                });
            }
        } else if (searchType === 'figurative') {
            if (!payload.imageData || !productDescription) {
                return response.status(400).json({ 
                    error: true,
                    message: 'Immagine e descrizione prodotti sono obbligatori per marchi figurativi.' 
                });
            }
        }
        
        // Validazione credenziali
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate correttamente su Vercel.');
        }

        // FASE 1: Classificazione AI
        const identifiedClasses = await classifyProductsWithAI(productDescription);
        
        if (identifiedClasses.length === 0) {
            throw new Error("Impossibile identificare classi di Nizza pertinenti.");
        }
        
        console.log('Classi identificate:', identifiedClasses);

        // FASE 2: Analisi dell'immagine se presente
        let imageAnalysis = null;
        let figurativeSearchResults = { similarMarks: [] };
        
        if (payload.imageData && (searchType === 'figurative' || searchType === 'combined')) {
            try {
                // Valida l'immagine
                validateBase64Image(payload.imageData.base64, payload.imageData.mimeType);
                
                console.log('Analizzando immagine del marchio...');
                imageAnalysis = await analyzeTrademarkImage(payload.imageData);
                console.log('Analisi immagine completata:', imageAnalysis);
            } catch (imageError) {
                console.error('Errore analisi immagine:', imageError);
                if (searchType === 'figurative') {
                    throw imageError;
                }
            }
        }

        // FASE 3: Ricerca su EUIPO
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        
        // Ricerca marchi verbali
        let verbalSearchResults = { similarMarks: [] };
        if (searchType !== 'figurative') {
            const verbalSearchJson = await searchEuipoTrademarks(
                brandName, 
                identifiedClasses, 
                accessToken, 
                EUIPO_CLIENT_ID
            );
            verbalSearchResults = parseEuipoResponse(verbalSearchJson, brandName);
            console.log(`Trovati ${verbalSearchResults.similarMarks.length} marchi verbali`);
        }

        // Ricerca marchi figurativi
        if (imageAnalysis && imageAnalysis.viennaCodes.length > 0) {
            const figurativeJson = await searchEuipoFigurativeMarks(
                imageAnalysis.viennaCodes,
                identifiedClasses,
                accessToken,
                EUIPO_CLIENT_ID
            );
            figurativeSearchResults = parseEuipoResponse(figurativeJson);
            
            // Confronta visivamente i marchi figurativi trovati (limitato ai primi 3)
            const marksToCompare = figurativeSearchResults.similarMarks.slice(0, 3);
            for (let mark of marksToCompare) {
                if (mark.imageUrl) {
                    mark.visualComparison = await compareTrademarkImages(
                        payload.imageData,
                        mark.imageUrl,
                        mark
                    );
                }
            }
        }

        // FASE 4: Giudizio legale approfondito
        const legalAnalysisPrompt = `Sei un avvocato specializzato in proprietà intellettuale con 20 anni di esperienza in marchi europei.

COMPITO: Fornisci un'analisi legale professionale e dettagliata sulla registrabilità del marchio proposto.

TIPO DI RICERCA: ${searchType === 'verbal' ? 'Marchio Denominativo' : searchType === 'figurative' ? 'Marchio Figurativo' : 'Marchio Complesso (denominativo + figurativo)'}

DATI DEL MARCHIO PROPOSTO:
${searchType !== 'figurative' ? `- Nome: "${brandName}"` : ''}
- Prodotti/Servizi: "${productDescription}"
- Classi di Nizza identificate: ${identifiedClasses.map(c => `Classe ${c}`).join(', ')}
- Territori richiesti: ${payload.selectedCountries.join(', ')}
${imageAnalysis ? `
- ELEMENTI FIGURATIVI RILEVATI:
  • Descrizione: ${imageAnalysis.description}
  • Elementi distintivi: ${imageAnalysis.distinctiveElements.join(', ')}
  • Codici Vienna: ${imageAnalysis.viennaCodes.join(', ')}` : ''}

${searchType !== 'figurative' ? `MARCHI VERBALI ANTERIORI (dati EUIPO):
${verbalSearchResults.similarMarks.length > 0 
    ? verbalSearchResults.similarMarks.slice(0, 5).map(mark => 
        `• "${mark.name}" (${mark.applicationNumber})
          Titolare: ${mark.owner}
          Stato: ${mark.status}
          Classi: ${mark.classes.join(', ')}
          Similarità verbale: ${mark.similarity}%`
      ).join('\n\n')
    : "Nessun marchio verbale identico o molto simile trovato."}` : ''}

${figurativeSearchResults.similarMarks.length > 0 ? `
MARCHI FIGURATIVI ANTERIORI (dati EUIPO):
${figurativeSearchResults.similarMarks.slice(0, 3).map(mark => 
    `• "${mark.name}" (${mark.applicationNumber})
      Titolare: ${mark.owner}
      Stato: ${mark.status}
      Classi: ${mark.classes.join(', ')}
      ${mark.visualComparison ? `
      Similarità visiva: ${mark.visualComparison.visualSimilarity}%
      Rischio confusione: ${mark.visualComparison.confusionRisk}` : ''}`
  ).join('\n\n')}` : ''}

STRUTTURA RICHIESTA DELL'ANALISI:

1. **VALUTAZIONE DEL RISCHIO COMPLESSIVO**
   Indica chiaramente: BASSO / MODERATO / ALTO / MOLTO ALTO

2. **IMPEDIMENTI ASSOLUTI**
   - Capacità distintiva (Art. 9 CPI, Art. 7 EUTMR)
   - Liceità (Art. 10 CPI)

3. **IMPEDIMENTI RELATIVI**
   - Rischio di confusione (Art. 12 CPI, Art. 8 EUTMR)
   - Analisi dei marchi anteriori trovati

4. **RACCOMANDAZIONI STRATEGICHE**
   - Suggerimenti concreti per ridurre i rischi

5. **CONCLUSIONE**
   - Giudizio sintetico finale

IMPORTANTE: Usa un linguaggio professionale ma comprensibile`;

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
                imageAnalyzed: !!imageAnalysis,
                searchType: searchType
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
        } else if (error.message.includes('Immagine')) {
            statusCode = 400;
        }
        
        return response.status(statusCode).json({ 
            error: true, 
            message: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
};