// File: /api/search.js
// VERSIONE SICURA: La chiave API viene letta dalle variabili d'ambiente di Vercel.

const fetch = require('node-fetch');

// La base di conoscenza delle Classi di Nizza rimane fondamentale per l'AI.
const { NICE_CLASSES_KNOWLEDGE_BASE } = require('./nice_knowledge_base.js');

// --- FUNZIONE HELPER PER CHIAMARE L'API DI OPENAI ---
async function callOpenAI_API(prompt) {
    // *** METODO SICURO ***
    // Leggiamo la chiave API di OpenAI dalle variabili d'ambiente di Vercel.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('API Key di OpenAI non configurata correttamente sul server Vercel.');
    }

    const apiURL = 'https://api.openai.com/v1/chat/completions';

    const requestBody = {
        model: "gpt-4o", 
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: "Sei un esperto avvocato specializzato in proprietà intellettuale e marchi. Il tuo compito è analizzare i dati forniti e restituire una risposta strutturata in formato JSON, senza alcun testo aggiuntivo."
            },
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Errore dall'API di OpenAI:", errorData);
        throw new Error("Il servizio AI di OpenAI non è riuscito a rispondere.");
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

// --- FLUSSO PRINCIPALE DEL BACKEND ---
module.exports = async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    try {
        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        const mainPrompt = `
            Analizza la seguente richiesta di registrazione di un nuovo marchio e restituisci un oggetto JSON con tre chiavi: "identifiedClasses", "similarMarks", e "syntheticJudgment".

            **Base di Conoscenza - Classi di Nizza:**
            ${NICE_CLASSES_KNOWLEDGE_BASE}

            **Dati del Nuovo Marchio Forniti dall'Utente:**
            - Nome Proposto: "${payload.brandName}"
            - Descrizione Prodotti/Servizi: "${payload.productDescription}"
            - Territori di Interesse: ${payload.selectedCountries.join(', ')}

            **Istruzioni per la risposta JSON:**

            1.  **"identifiedClasses"**: Basandoti sulla "Descrizione Prodotti/Servizi" e sulla "Base di Conoscenza", restituisci un array di numeri delle Classi di Nizza più pertinenti. Esempio: [9, 25, 41].

            2.  **"similarMarks"**: Simula una ricerca di anteriorità. Basandoti sulla tua vasta conoscenza di marchi esistenti, crea un array di 2 o 3 esempi fittizi ma realistici di marchi che potrebbero essere in conflitto. Per ogni marchio, fornisci un oggetto con le seguenti chiavi: "name", "owner", "status" (es. "Registered"), "classes" (es. "Cl. 9, 42"), e "applicationNumber" (un numero fittizio). Se il rischio è basso, restituisci un array vuoto.

            3.  **"syntheticJudgment"**: Genera un giudizio legale sintetico (massimo 30 righe, tono professionale). Valuta il rischio di confondibilità basandoti sulla somiglianza fonetica/concettuale, l'affinità merceologica tra le "identifiedClasses" e quelle dei "similarMarks", e la sovrapposizione territoriale. Concludi con una valutazione finale del rischio (Basso, Moderato, Medio, Alto) e un consiglio strategico.
        `;

        const aiResponse = await callOpenAI_API(mainPrompt);
        
        return response.status(200).json(aiResponse);

    } catch (error) {
        console.error("ERRORE CRITICO nel backend:", error);
        return response.status(500).json({ error: true, message: error.message });
    }
};
