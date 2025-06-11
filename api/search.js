// Questo file deve trovarsi in: /api/search.js
// Implementa il flusso di autenticazione OAuth2 Client Credentials per l'API EUIPO.

// Funzione helper per ottenere il token di accesso
async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    // L'autenticazione per ottenere il token richiede l'invio di Client ID e Secret
    // in un formato specifico (Basic Auth).
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Errore durante l\'ottenimento del token:', errorData);
            throw new Error('Autenticazione fallita. Verificare Client ID e Client Secret.');
        }

        const tokenData = await response.json();
        return tokenData.access_token;

    } catch (error) {
        console.error('Errore di rete nella richiesta del token:', error);
        throw new Error('Impossibile contattare il server di autenticazione EUIPO.');
    }
}

// Funzione helper per analizzare la risposta della ricerca
function parseEuipoResponse(jsonResponse) {
    const similarMarks = [];
    const records = jsonResponse?.trademarks || [];

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
    // Intestazioni CORS
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

    // Leggiamo le due credenziali sicure dalle variabili d'ambiente di Vercel
    const CLIENT_ID = process.env.EUIPO_CLIENT_ID;
    const CLIENT_SECRET = process.env.EUIPO_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        const msg = 'Errore di configurazione del server: EUIPO_CLIENT_ID e/o EUIPO_CLIENT_SECRET non sono impostati su Vercel.';
        console.error(msg);
        return response.status(500).json({ message: msg });
    }

    try {
        // --- PASSO 1: Ottenere il token di accesso ---
        const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

        // --- PASSO 2: Eseguire la ricerca vera e propria con il token ---
        const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
        // Usiamo la sintassi RSQL come da documentazione
        const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}*`;
        const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=20`;

        const searchResponse = await fetch(urlWithQuery, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-IBM-Client-Id': CLIENT_ID, // Come da specifica, anche il Client ID va inviato qui
            },
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.error(`Errore dalla ricerca EUIPO: ${errorText}`);
            throw new Error(`Il server EUIPO ha risposto con un errore: ${searchResponse.statusText}.`);
        }

        const resultJSON = await searchResponse.json();
        const parsedResults = parseEuipoResponse(resultJSON);

        // Invia i risultati puliti al frontend
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("Errore completo nel backend:", error);
        return response.status(500).json({ message: error.message || 'Errore interno del server.' });
    }
}
```

---
### 2. Il Frontend Aggiornato: `index.html`

Ho leggermente modificato il frontend per mostrare i nuovi dati, come il numero di registrazione, e per dare messaggi di errore più chiari. Sostituisca il contenuto del suo file `index.html`.


```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intellimark.ai - Beta con Autenticazione EUIPO</title>
    <!-- Versione 9.0 - Autenticazione OAuth2 EUIPO -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root { --color-primary-start: #0A2A5B; --color-primary-end: #4A0E69; --color-green: #28A745; --color-yellow: #FFC107; --color-red: #DC3545; }
        body { font-family: 'Figtree', sans-serif; background-color: #F8F9FA; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .gradient-text { background: linear-gradient(to right, var(--color-primary-start), var(--color-primary-end)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .btn-gradient { background: linear-gradient(to right, var(--color-primary-start), var(--color-primary-end)); transition: all 0.3s ease; }
        .btn-gradient:hover { box-shadow: 0 4px 15px 0 rgba(10, 42, 91, 0.3); }
        .hidden { display: none !important; }
        #loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(248, 249, 250, 0.8); backdrop-filter: blur(5px); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .spinner { border: 6px solid #e2e8f0; border-top: 6px solid var(--color-primary-start); border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="antialiased text-gray-800">
    <div id="loading-overlay" class="hidden"> <div class="text-center"> <div class="spinner mx-auto"></div> <p class="mt-4 text-lg font-semibold font-inter text-gray-700">Sto interrogando le banche dati ufficiali...</p> </div> </div>
    <div id="app-container">
        <header id="main-header" class="bg-white/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-200/80">
            <div class="container mx-auto px-6 py-4 flex justify-between items-center">
                <a href="#" class="font-inter font-bold text-2xl gradient-text" onclick="location.reload(); return false;" aria-label="Homepage di Intellimark.ai"> Intellimark.ai </a>
            </div>
        </header>
        <main>
            <section id="home-screen" class="fade-in">
                <div class="container mx-auto px-6 py-16 md:py-24 text-center">
                    <h1 class="text-4xl md:text-6xl font-extrabold font-inter text-gray-900 leading-tight">Il tuo brand ha <span class="gradient-text">potenziale?</span></h1>
                    <div class="mt-10 max-w-2xl mx-auto">
                        <div class="relative flex items-center shadow-lg rounded-full">
                            <input id="brand-search-input" type="text" placeholder="Inserisci il nome del tuo brand..." class="w-full py-4 pl-8 pr-24 md:pr-20 rounded-full text-lg border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button id="start-search-btn" class="absolute right-2 top-2 bottom-2 btn-gradient text-white font-semibold px-4 rounded-full text-lg">Cerca</button>
                        </div>
                    </div>
                </div>
            </section>
            <section id="results-screen" class="hidden" aria-live="polite">
                <div class="bg-white border-b border-gray-200/80">
                    <div class="container mx-auto px-6 py-4"><h2 class="text-xl font-semibold">Risultati per: <span id="searched-brand-name" class="font-bold gradient-text"></span></h2></div>
                </div>
                <div class="container mx-auto px-6 py-12">
                    <div class="grid lg:grid-cols-3 gap-8">
                        <div class="lg:col-span-1 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200/80">
                            <h3 class="text-2xl font-bold font-inter text-center">Brand Potential Score™</h3>
                             <div class="relative w-full max-w-[300px] mx-auto h-[150px] md:h-[200px]"> <canvas id="brandScoreChart"></canvas> <div class="absolute inset-0 flex flex-col items-center justify-center font-inter"> <span id="score-value" class="text-5xl font-extrabold text-gray-800"></span> <span class="text-lg font-semibold text-gray-500">/ 100</span> </div> </div>
                            <div class="mt-8 space-y-6"> <div><div class="flex justify-between font-semibold mb-1"><span>Rischio di Confusione</span><span id="pillar2-value" class="font-bold"></span></div><div class="w-full bg-gray-200 rounded-full h-3"><div id="pillar2-bar" class="h-3 rounded-full transition-all duration-500"></div></div></div> </div>
                        </div>
                        <div class="lg:col-span-2 space-y-6">
                            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200/80"><h4 class="text-xl font-bold font-inter mb-3">Ricerca di Anteriorità (Banca Dati Ufficiale EUIPO)</h4><div id="anteriority-results-container"><p class="text-gray-500">I risultati della ricerca di anteriorità appariranno qui...</p></div></div>
                            <div id="error-box" class="hidden bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert"> <p class="font-bold">Errore di comunicazione</p> <p id="error-message"></p> </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <script>
    const AppController = (function() {
        const state = { brandScoreChart: null };
        const elements = {
            homeScreen: document.getElementById('home-screen'),
            resultsScreen: document.getElementById('results-screen'),
            startSearchBtn: document.getElementById('start-search-btn'),
            brandSearchInput: document.getElementById('brand-search-input'),
            searchedBrandName: document.getElementById('searched-brand-name'),
            loadingOverlay: document.getElementById('loading-overlay'),
            scoreValue: document.getElementById('score-value'),
            brandScoreChartCanvas: document.getElementById('brandScoreChart'),
            pillars: { p2: { value: document.getElementById('pillar2-value'), bar: document.getElementById('pillar2-bar') } },
            anteriorityContainer: document.getElementById('anteriority-results-container'),
            errorBox: document.getElementById('error-box'),
            errorMessage: document.getElementById('error-message'),
        };

        const api = {
            API_ENDPOINT: '/api/search', 
            async getAnalysis(brandName) {
                const response = await fetch(this.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brandName: brandName })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Risposta non valida o errore interno del server.' }));
                    throw new Error(errorData.message || `Errore di rete: ${response.status}`);
                }
                return await response.json();
            }
        };

        const render = {
            fullResultsPage(brandName, results) {
                elements.homeScreen.classList.add('hidden');
                elements.resultsScreen.classList.remove('hidden');
                elements.searchedBrandName.textContent = brandName;
                
                if (results.error) {
                    this.showError(results.message);
                    this.updateAnteriorityWithError();
                    this.updateMetrics([]);
                } else {
                    this.hideError();
                    this.updateAnteriorityResults(results.similarMarks);
                    this.updateMetrics(results.similarMarks);
                }
            },
            updateAnteriorityResults(similarMarks) {
                elements.anteriorityContainer.innerHTML = ''; 
                if (!similarMarks || similarMarks.length === 0) {
                    elements.anteriorityContainer.innerHTML = `<p class="text-green-700 font-semibold">🎉 Ottima notizia! Nessun marchio identico o molto simile trovato nella banca dati EUIPO.</p>`;
                    return;
                }
                let html = `<p class="text-gray-600 mb-4">Trovati <span class="font-bold">${similarMarks.length} marchi registrati</span> con potenziale di conflitto:</p><div class="space-y-3 max-h-[40rem] overflow-y-auto pr-2">`;
                similarMarks.forEach(mark => {
                    const statusColor = mark.status && mark.status.toLowerCase().includes('registered') ? 'text-green-600' : 'text-yellow-600';
                    html += `<div class="p-4 border rounded-lg bg-gray-50/50"><div class="flex justify-between items-start gap-4"><div class="flex-grow"><p class="font-bold text-lg">${mark.name}</p><p class="text-sm text-gray-500 mt-1">Titolare: ${mark.owner}</p></div><span class="font-semibold text-xs text-right whitespace-nowrap px-2 py-1 rounded-full bg-gray-200 ${statusColor}">${mark.status}</span></div><div class="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm text-gray-600"><span>Classi di Nizza: <b>${mark.classes}</b></span><span>N°: ${mark.applicationNumber}</span></div></div>`;
                });
                html += `</div>`;
                elements.anteriorityContainer.innerHTML = html;
            },
            updateMetrics(similarMarks = []) {
                const riskScore = 100 - (similarMarks.length * 8);
                const score = Math.max(10, riskScore);
                const update = (pillarId, value, labels) => {
                    let label = value > 75 ? labels[0] : (value > 40 ? labels[1] : labels[2]);
                    let color = ui.getScoreColor(value);
                    elements.pillars[pillarId].value.textContent = `${value}% (${label})`;
                    elements.pillars[pillarId].value.style.color = color;
                    elements.pillars[pillarId].bar.style.width = `${value}%`;
                    elements.pillars[pillarId].bar.style.backgroundColor = color;
                };
                update('p2', score, ['Basso', 'Medio', 'Alto']);
                this.createOrUpdateChart(score);
            },
            createOrUpdateChart(score) {
                const scoreColor = ui.getScoreColor(score);
                elements.scoreValue.textContent = score;
                elements.scoreValue.style.color = scoreColor;
                const data = { datasets: [{ data: [score, 100 - score], backgroundColor: [scoreColor, '#E5E7EB'], borderWidth: 0, circumference: 180, rotation: 270 }] };
                const options = { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { tooltip: { enabled: false } }, events: [] };
                if (state.brandScoreChart) state.brandScoreChart.destroy();
                state.brandScoreChart = new Chart(elements.brandScoreChartCanvas, { type: 'doughnut', data, options });
            },
            showError(message) {
                elements.errorMessage.textContent = `Dettaglio: ${message}`;
                elements.errorBox.classList.remove('hidden');
            },
            hideError() { elements.errorBox.classList.add('hidden'); },
            updateAnteriorityWithError() { elements.anteriorityContainer.innerHTML = `<p class="text-red-700">Impossibile caricare i risultati.</p>`; }
        };

        const ui = {
            showLoading() { elements.loadingOverlay.classList.remove('hidden'); },
            hideLoading() { elements.loadingOverlay.classList.add('hidden'); },
            getScoreColor: score => score < 40 ? 'var(--color-red)' : (score < 75 ? 'var(--color-yellow)' : 'var(--color-green)'),
            async handleSearch() {
                const brandName = elements.brandSearchInput.value.trim();
                if (!brandName) { elements.brandSearchInput.focus(); return; }
                ui.showLoading();
                try {
                    const results = await api.getAnalysis(brandName);
                    render.fullResultsPage(brandName, results);
                } catch (error) {
                    render.fullResultsPage(brandName, { error: true, message: error.message });
                } finally {
                    ui.hideLoading();
                }
            },
        };

        function init() {
            elements.loadingOverlay.classList.add('hidden');
            elements.startSearchBtn.addEventListener('click', ui.handleSearch);
            elements.brandSearchInput.addEventListener('keypress', e => { if (e.key === 'Enter') ui.handleSearch(); });
        }
        
        return { init };
    })();

    document.addEventListener('DOMContentLoaded', AppController.init);
    </script>
</body>
</html>
```

### Prossimi Passi (Checklist Finale)

1.  **Sostituisca ENTRAMBI i file** (`api/search.js` e `index.html`) con le nuove versioni che le ho fornito.
2.  **Verifichi le sue Credenziali EUIPO**: Acceda al suo pannello sviluppatore EUIPO e si assicuri di avere sia il **Client ID** sia il **Client Secret**. Sono due stringhe di testo separate.
3.  **Aggiorni le Variabili d'Ambiente su Vercel**:
    * Vada su Vercel (`Settings -> Environment Variables`).
    * **Rimuova** la vecchia variabile `EUIPO_API_KEY`.
    * **Aggiunga** la prima variabile:
        * NAME: `EUIPO_CLIENT_ID`
        * VALUE: (incolli qui il suo Client ID)
    * **Aggiunga** la seconda variabile:
        * NAME: `EUIPO_CLIENT_SECRET`
        * VALUE: (incolli qui il suo Client Secret)
4.  **Aggiorni GitHub e Faccia il Redeploy**:
    * Apra il terminale e carichi le modifiche:
        ```bash
        git add .
        git commit -m "Implemento flusso autenticazione OAuth2 EUIPO"
        git push
        ```
    * Vercel si aggiornerà automaticamente.

Una volta completato, vada sul suo sito e faccia una ricerca. Questa volta il suo backend ha le istruzioni esatte per autenticarsi correttamente. Sono molto fiducioso che vedrà i risultati reali dell'EUI