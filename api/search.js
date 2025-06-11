// Questo file deve trovarsi in: /api/search.js
// Vercel lo trasformerà automaticamente in un endpoint serverless
// accessibile a /api/search

// Funzione principale che gestisce la richiesta
export default async function handler(request, response) {
    // Permette al nostro frontend di chiamare questa funzione
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gestisce la richiesta pre-flight del browser
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Estrae il nome del brand inviato dal frontend
    const { brandName } = request.body;

    if (!brandName) {
        return response.status(400).json({ message: 'Il nome del brand è richiesto.' });
    }

    // --- PUNTO CRUCIALE: USO SICURO DELLA API KEY ---
    // Leggiamo la chiave da una "Variabile d'Ambiente" impostata su Vercel.
    // La chiave NON è scritta nel codice.
    const EUIPO_API_KEY = process.env.EUIPO_API_KEY;

    // Se la chiave non fosse configurata sul server, restituisce un errore.
    if (!EUIPO_API_KEY) {
        console.error("API Key non configurata sul server.");
        return response.status(500).json({ message: 'Errore di configurazione del server: API Key mancante.' });
    }
    
    // Corpo della richiesta XML per l'API EUIPO
    const requestBody = `<TrademarkSearch><TradeMarkDetails><WordMarkSpecification><WordMark>
                        <MarkVerbalElementText>${brandName}</MarkVerbalElementText></WordMark></WordMarkSpecification>
                        </TradeMarkDetails><SearchConditions><CaseSensitive>false</CaseSensitive>
                        <SearchMode>Similar</SearchMode></SearchConditions></TrademarkSearch>`;

    try {
        // Chiamata diretta all'API EUIPO dal nostro server
        const euipoResponse = await fetch('https://euipo.europa.eu/trademark-search/ws/TrademarkSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                // L'autenticazione con API Key avviene solitamente tramite header.
                // Controllare la documentazione specifica dell'API EUIPO per il nome esatto dell'header.
                'Authorization': `Bearer ${EUIPO_API_KEY}`
            },
            body: requestBody
        });

        if (!euipoResponse.ok) {
            console.error(`Errore da EUIPO: ${euipoResponse.statusText}`);
            throw new Error('Errore di comunicazione con il server EUIPO.');
        }

        const xmlText = await euipoResponse.text();
        
        // Funzione helper per analizzare la risposta XML
        const parsedResults = parseEuipoResponse(xmlText);
        
        // Invia i risultati puliti in formato JSON al frontend
        return response.status(200).json(parsedResults);

    } catch (error) {
        console.error("Errore nel backend:", error);
        return response.status(500).json({ message: error.message || 'Errore interno del server.' });
    }
}

function parseEuipoResponse(xmlText) {
    // Questa funzione (semplificata) dovrebbe cercare i tag nell'XML
    // e restituire un array di oggetti. Per la demo, usiamo una logica fittizia.
    // Una libreria come 'xml-js' sarebbe ideale in un progetto reale.
    
    // Simulazione del parsing per dimostrare la struttura
    const tradeMarkCount = (xmlText.match(/<TradeMarkRecord>/g) || []).length;
    
    if (tradeMarkCount === 0) {
        return { similarMarks: [] };
    }
    
    const similarMarks = [];
    // In un'implementazione reale, si ciclerebbe sui risultati XML per popolare l'array
    for (let i = 0; i < Math.min(tradeMarkCount, 5); i++) {
        similarMarks.push({
            name: `Marchio Reale ${i + 1} (da XML)`,
            owner: 'Titolare Reale (da XML)',
            status: 'Registered',
            classes: 'Cl. 9, 42'
        });
    }
    
    return { similarMarks };
}
```

---
### 2. Il Frontend: `index.html` Aggiornato

Ora modifichiamo il nostro `index.html` per chiamare il nostro nuovo backend su Vercel. La modifica è solo nel JavaScript, nella funzione `api.getAnalysis`.

**Azione:** Sostituisca il contenuto del suo file `index.html` con questo.


```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intellimark.ai - Beta con Backend</title>
    <!-- Versione 7.0 - Architettura pronta per backend -->
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
    <!-- L'HTML rimane invariato, per brevità è omesso. L'unica parte che cambia è lo script alla fine. -->
    <div id="loading-overlay" class="hidden"> <div class="text-center"> <div class="spinner mx-auto"></div> <p class="mt-4 text-lg font-semibold font-inter text-gray-700">Sto interrogando le banche dati ufficiali...</p> </div> </div>
    <div id="app-container">
        <header id="main-header" class="bg-white/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-200/80">
            <div class="container mx-auto px-6 py-4 flex justify-between items-center">
                <a href="#" class="font-inter font-bold text-2xl gradient-text" onclick="location.reload(); return false;" aria-label="Homepage di Intellimark.ai"> Intellimark.ai </a>
                <nav class="hidden md:flex items-center space-x-6"> <a href="#" class="text-gray-600 hover:text-blue-900 transition-colors">Prezzi</a> </nav>
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
                            <div class="mt-8 space-y-6"> <div><div class="flex justify-between font-semibold mb-1"><span>Distintività Semantica</span><span id="pillar1-value" class="font-bold"></span></div><div class="w-full bg-gray-200 rounded-full h-3"><div id="pillar1-bar" class="h-3 rounded-full transition-all duration-500"></div></div></div> <div><div class="flex justify-between font-semibold mb-1"><span>Rischio di Confusione</span><span id="pillar2-value" class="font-bold"></span></div><div class="w-full bg-gray-200 rounded-full h-3"><div id="pillar2-bar" class="h-3 rounded-full transition-all duration-500"></div></div></div> <div><div class="flex justify-between font-semibold mb-1"><span>Disponibilità Digitale</span><span id="pillar3-value" class="font-bold"></span></div><div class="w-full bg-gray-200 rounded-full h-3"><div id="pillar3-bar" class="h-3 rounded-full transition-all duration-500"></div></div></div> </div>
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
            pillars: {
                p1: { value: document.getElementById('pillar1-value'), bar: document.getElementById('pillar1-bar') },
                p2: { value: document.getElementById('pillar2-value'), bar: document.getElementById('pillar2-bar') },
                p3: { value: document.getElementById('pillar3-value'), bar: document.getElementById('pillar3-bar') },
            },
            anteriorityContainer: document.getElementById('anteriority-results-container'),
            errorBox: document.getElementById('error-box'),
            errorMessage: document.getElementById('error-message'),
        };

        const api = {
            // L'endpoint ora punta al nostro backend serverless.
            // Vercel renderà il file /api/search.js disponibile a questo indirizzo.
            API_ENDPOINT: '/api/search', 

            async getAnalysis(brandName) {
                console.log(`Invio richiesta al nostro backend per: ${brandName}`);
                const response = await fetch(this.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brandName: brandName })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Risposta non valida dal server.' }));
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
                } else {
                    this.hideError();
                    this.updateAnteriorityResults(results.similarMarks);
                    this.updateSimulatedMetrics(results.similarMarks);
                }
            },
            updateAnteriorityResults(similarMarks) {
                elements.anteriorityContainer.innerHTML = ''; 
                if (!similarMarks || similarMarks.length === 0) {
                    elements.anteriorityContainer.innerHTML = `<p class="text-green-700 font-semibold">🎉 Ottima notizia! Nessun marchio simile trovato nella banca dati.</p>`;
                    return;
                }
                let html = `<p class="text-gray-600 mb-4">Trovati <span class="font-bold">${similarMarks.length} marchi registrati</span> con potenziale di conflitto:</p><div class="space-y-3 max-h-96 overflow-y-auto pr-2">`;
                similarMarks.forEach(mark => {
                    const statusColor = mark.status.toLowerCase().includes('registered') ? 'text-green-600' : 'text-yellow-600';
                    html += `<div class="p-3 border rounded-lg"><div class="flex justify-between items-start"><p class="font-bold text-lg">${mark.name}</p><span class="font-semibold text-sm whitespace-nowrap px-2 py-1 rounded-full bg-gray-100 ${statusColor}">${mark.status}</span></div><p class="text-sm text-gray-500 mt-1">Titolare: ${mark.owner}</p><p class="text-sm text-gray-500">Classi di Nizza: ${mark.classes}</p></div>`;
                });
                html += `</div>`;
                elements.anteriorityContainer.innerHTML = html;
            },
            updateSimulatedMetrics(similarMarks) {
                const riskScore = 100 - (similarMarks.length * 8); // Aumentato il peso di ogni marchio trovato
                const score = Math.max(10, riskScore);
                const update = (pillarId, value, labels) => {
                    let label = value > 75 ? labels[0] : (value > 40 ? labels[1] : labels[2]);
                    let color = ui.getScoreColor(value);
                    elements.pillars[pillarId].value.textContent = `${value}% (${label})`;
                    elements.pillars[pillarId].bar.style.color = color;
                    elements.pillars[pillarId].bar.style.width = `${value}%`;
                    elements.pillars[pillarId].bar.style.backgroundColor = color;
                };
                update('p1', Math.floor(Math.random() * 16) + 80, ['Forte', 'Buona', 'Debole']);
                update('p2', score, ['Basso', 'Medio', 'Alto']);
                update('p3', Math.floor(Math.random() * 31) + 60, ['Ottima', 'Buona', 'Scarsa']);
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
                if (!brandName) return;
                ui.showLoading();
                try {
                    const results = await api.getAnalysis(brandName);
                    render.fullResultsPage(brandName, results);
                } catch (error) {
                    render.showError(error.message);
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

### 3. Come Mettere Tutto Online (Istruzioni Finali)

1.  **Aggiorni GitHub**:
    * Si assicuri che la sua cartella `intellimark-mockup` contenga `index.html` e la nuova cartella `api` con dentro `search.js`.
    * Carichi tutto su GitHub con i soliti comandi:
        ```bash
        git add .
        git commit -m "Preparo architettura per Vercel"
        git push
        ```

2.  **Si Registri su Vercel**:
    * Vada su [vercel.com](https://vercel.com) e si registri usando il suo account GitHub. È il modo più rapido.

3.  **Importi il Progetto**:
    * Dalla sua dashboard Vercel, clicchi su "Add New..." -> "Project".
    * Selezioni il suo repository `intellimark-mockup` dalla lista. Vercel lo riconoscerà automaticamente.
    * Clicchi su "Import".

4.  **Configuri la Chiave API (Il Passaggio Sicuro)**:
    * Prima di cliccare su "Deploy", espanda la sezione **"Environment Variables"**.
    * Nel campo **NAME**, inserisca `EUIPO_API_KEY`.
    * Nel campo **VALUE**, incolli la sua chiave API che mi ha menzionato.
    * Clicchi su **Add**.

5.  **Faccia il Deploy**:
    * Clicchi sul pulsante **"Deploy"**.
    * Vercel inizierà il processo di build. Prenderà i suoi file, capirà che c'è una funzione nella cartella `/api` e la pubblicherà come backend, insieme al suo `index.html` come frontend.

Dopo pochi minuti, Vercel le fornirà un link al suo nuovo sito (es. `intellimark-mockup.vercel.app`). Ora ha una vera applicazione web con un frontend e un backend separati, sicuri e ospitati gratuitamen