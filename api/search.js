<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IntelliMark.ai - Analisi Avanzata Marchi</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Inter', sans-serif; }
        :root { /* CSS Variables omitted for brevity */ }
        /* All other styles (gradient background, premium-card, buttons, etc.) unchanged */
    </style>
</head>
<body>
    <!-- Header, Hero, Analysis, Features, FAQ, Footer sections unchanged -->

    <script>
        // DOM Elements
        const elements = {
            searchForm: document.getElementById('searchForm'),
            brandName: document.getElementById('brandName'),
            productDescription: document.getElementById('productDescription'),
            countrySelection: document.getElementById('countrySelection'),
            imageInput: document.getElementById('imageInput'),
            imageUploadArea: document.getElementById('imageUploadArea'),
            uploadPlaceholder: document.getElementById('uploadPlaceholder'),
            imagePreviewContainer: document.getElementById('imagePreviewContainer'),
            imagePreview: document.getElementById('imagePreview'),
            removeImage: document.getElementById('removeImage'),
            submitBtn: document.getElementById('submitBtn'),
            loadingState: document.getElementById('loadingState'),
            loadingMessage: document.getElementById('loadingMessage'),
            resultsSection: document.getElementById('resultsSection'),
            scoreCard: document.getElementById('scoreCard'),
            scoreValue: document.getElementById('scoreValue'),
            scoreCircle: document.getElementById('scoreCircle'),
            classesCard: document.getElementById('classesCard'),
            aiClassesContainer: document.getElementById('aiClassesContainer'),
            imageAnalysisCard: document.getElementById('imageAnalysisCard'),
            imageAnalysisCheck: document.getElementById('imageAnalysisCheck'),
            imageDescription: document.getElementById('imageDescription'),
            distinctiveElements: document.getElementById('distinctiveElements'),
            viennaCodes: document.getElementById('viennaCodes'),
            judgmentIcon: document.getElementById('judgmentIcon'),
            judgmentSummary: document.getElementById('judgmentSummary'),
            judgmentDetails: document.getElementById('judgmentDetails'),
            verbalMarksContainer: document.getElementById('verbalMarksContainer'),
            figurativeMarksContainer: document.getElementById('figurativeMarksContainer'),
            downloadReport: document.getElementById('downloadReport'),
            newSearch: document.getElementById('newSearch')
        };

        // State
        let selectedCountries = ['EU'];
        let uploadedImage = null;
        let currentResults = null;
        let selectedSearchType = 'verbal';

        // Initialize handlers and UI
        document.addEventListener('DOMContentLoaded', () => {
            initializeCountrySelection();
            initializeImageUpload();
            initializeTabs();
            initializeFAQ();
            initializeFormHandlers();
            initializeSearchTypeHandlers();
        });

        // API functions
        const api = {
            async searchBrand(brandName, products, countries, imageData, searchType) {
                // Replace with your actual backend URL
                const BACKEND_URL = 'https://your-vercel-domain.vercel.app/api/search';
                console.log('Invio richiesta con immagine:', imageData ? 'Sì' : 'No');
                console.log('Tipo di ricerca:', searchType);
                const response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        brandName,
                        productDescription: products,
                        selectedCountries: countries,
                        imageData,
                        searchType: searchType || 'verbal'
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Errore nella ricerca');
                }
                const data = await response.json();
                console.log('Risposta ricevuta:', data);
                return {
                    success: true,
                    data: {
                        brand: brandName,
                        score: data.brandScore,
                        classes: data.identifiedClasses,
                        imageAnalysis: data.imageAnalysis,
                        judgment: {
                            level: this.mapRiskLevel(data.riskLevel),
                            summary: this.extractSummary(data.syntheticJudgment),
                            details: data.syntheticJudgment
                        },
                        verbalMarks: data.verbalMarks,
                        figurativeMarks: data.figurativeMarks
                    }
                };
            }
        };

        // Remove fallback mock: handle errors in form submit instead

        async function handleFormSubmit(e) {
            e.preventDefault();
            // Validation logic unchanged
            // ...
            showLoading();
            try {
                const results = await api.searchBrand(
                    brandName,
                    elements.productDescription.value.trim(),
                    selectedCountries,
                    uploadedImage,
                    selectedSearchType
                );
                currentResults = results.data;
                displayResults(results.data);
            } catch (error) {
                console.error('Error:', error);
                alert('Errore API: ' + error.message + '\nSi prega di riprovare più tardi.');
            } finally {
                hideLoading();
            }
        }

        // Other UI rendering functions unchanged: displayResults, showLoading, hideLoading, etc.
    </script>
</body>
</html>
