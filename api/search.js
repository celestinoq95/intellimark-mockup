process.on('unhandledRejection', console.error);

const fetch = require('node-fetch');
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- NUOVA SEZIONE: indicizzazione knowledge‑base ---------------------------
const stopWords = new Set([
  'di','e','per','con','da','il','la','le','gli',
  'dei','delle','del','dalla','alla','allo','un',
  'una','uno','su','sui','sulle','a','al','ai'
]);
const niceIndex = buildNiceIndex(NICE_CLASSES_KNOWLEDGE_BASE);

function buildNiceIndex(kb) {
  const index = {};
  const re = /Classe\s+(\d{1,2}):([\s\S]*?)(?:\nNota|\nClasse|\r|$)/gi;
  let m;
  while ((m = re.exec(kb)) !== null) {
    const cls = parseInt(m[1], 10);
    const text = m[2].replace(/[.;:()\n]/g, ' ').toLowerCase();
    const tokens = text.split(/\s+/).filter(t => t && !stopWords.has(t));
    index[cls] = new Set(tokens);
  }
  return index;
}

function determineNiceClasses(description) {
  const words = description
    .toLowerCase()
    .replace(/[.;,()]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stopWords.has(w));

  const scores = new Map();
  for (const [cls, tokenSet] of Object.entries(niceIndex)) {
    let hits = 0;
    for (const w of words) {
      if (tokenSet.has(w)) hits++;
    }
    if (hits) scores.set(parseInt(cls, 10), hits);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cls]) => cls);
}

// --- CONFIGURAZIONE E COSTANTI ---
const LEGAL_REFERENCES = { /* ... rimane invariato ... */ };
const VIENNA_CODES = { /* ... rimane invariato ... */ };

// --- FUNZIONI HELPER ---
async function getAccessToken(clientId, clientSecret) { /* ... invariato ... */ }
async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) { /* ... invariato ... */ }
async function searchEuipoFigurativeMarks(viennaCodes, classes, accessToken, clientId) { /* ... invariato ... */ }
function parseEuipoResponse(jsonResponse, brandName) { /* ... invariato ... */ }
function translateStatus(status) { /* ... invariato ... */ }
function calculateSimilarity(mark1, mark2) { /* ... invariato ... */ }
function levenshteinDistance(str1, str2) { /* ... invariato ... */ }
async function analyzeTrademarkImage(imageData) { /* ... invariato ... */ }
async function compareTrademarkImages(uploadedImage, existingMarkUrl, existingMarkData) { /* ... invariato ... */ }
function calculateBrandScore(verbalMarks, figurativeMarks, riskLevel, hasImage) { /* ... invariato ... */ }

function extractClassInfo(classNumber, knowledgeBase) {
  const regex = new RegExp(`Classe ${classNumber}:([\\s\\S]*?)(?:\\nNota|\\nClasse|\\r|$)`, 'i');
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
  if (request.method === 'OPTIONS') return response.status(200).end();
  try {
    const payload = request.body;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Richiesta:', payload);
    }
    // Validazione input...
    const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
    if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
      throw new Error('Credenziali EUIPO mancanti');
    }
    // --- CLASSIFICAZIONE LOCALE ---
    const identifiedClasses = determineNiceClasses(payload.productDescription);
    if (identifiedClasses.length === 0) {
      return response.status(422).json({
        error: true,
        message: 'Nessuna classe di Nizza trovata: controlla la descrizione.'
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Classi individuate:', identifiedClasses);
    }
    // ... segue il flusso 2, 3, 4, 5 invariato ...
  } catch (error) {
    console.error('ERRORE backend:', error);
    const status = error.message.includes('Quota') ? 429
                 : error.message.includes('EUIPO') ? 503
                 : 500;
    response.status(status).json({ error: true, message: error.message });
  }
};
