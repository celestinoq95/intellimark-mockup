// File: /api/search.js
// Versione con base di conoscenza completa delle Classi di Nizza.

const fetch = require('node-fetch');

// --- DATABASE COMPLETA DELLE CLASSI DI NIZZA (dal documento ufficiale) ---
const NICE_CLASSES_KNOWLEDGE_BASE = `
TITOLI DELLE CLASSI E NOTE ESPLICATIVE
PRODOTTI
Classe 1: Prodotti chimici destinati all'industria, alle scienze, alla fotografia, come anche all'agricoltura, all'orticoltura e alla silvicoltura; Resine artificiali allo stato grezzo, materie plastiche allo stato grezzo; Composizioni per estinguere il fuoco e per prevenire gli incendi; Preparati per la tempera e la saldatura dei metalli; Sostanze per la concia delle pelli di animali e del pellame; Adesivi destinati all'industria; Mastici e altri riempitivi di pasta; Compost, concimi e fertilizzanti; Preparati biologici destinati all'industria ed alla scienza.
Nota esplicativa: La classe 1 comprende essenzialmente i prodotti chimici destinati all'industria, alle scienze e all'agricoltura. Comprende in particolare: carta sensibilizzata; composizioni per la riparazione di pneumatici; il sale per conservare, non per uso alimentare; alcuni additivi destinati all'industria alimentare (pectina, lecitina, enzimi); alcuni ingredienti per prodotti cosmetici e farmaceutici (vitamine, conservanti, antiossidanti); alcuni materiali di filtraggio (sostanze minerali, vegetali, materiali ceramici). Non comprende: resine naturali grezze (Cl. 2); preparati chimici per scopo medico o veterinario (Cl. 5); fungicidi, erbicidi (Cl. 5); adesivi per cartoleria o uso domestico (Cl. 16); sale per conservare alimenti (Cl. 30); pacciamatura (Cl. 31).

Classe 2: Pitture, vernici, lacche; Prodotti preservanti dalla ruggine e dal deterioramento del legno; Coloranti, tinte; Inchiostri per la stampa, la marcatura e l'incisione; Resine naturali allo stato grezzo; Metalli in fogli e in polvere per uso in pittura, decorazione, stampa e arte.
Nota esplicativa: Comprende essenzialmente pitture, coloranti e prodotti contro la corrosione. Comprende in particolare: colori, vernici e lacche per industria, artigianato e arte; diluenti, addensanti, siccativi; mordente per legno e pelle; oli antiruggine; coloranti per indumenti, alimenti e bevande. Non comprende: resine artificiali grezze (Cl. 1); mordenti per metalli (Cl. 1); coloranti per bucato (Cl. 3); tinture cosmetiche (Cl. 3); scatole di pittura scolastiche (Cl. 16); inchiostri per cancelleria (Cl. 16); pitture e vernici isolanti (Cl. 17).

Classe 3: Cosmetici e preparati per la toeletta non medicati; Dentifrici non medicati; Profumeria, oli essenziali; Preparati per la sbianca e altre sostanze per il bucato; Preparati per pulire, lucidare e abradere.
Nota esplicativa: Comprende preparati per toilette non medicati e prodotti di pulizia. Comprende in particolare: preparazioni sanitarie per igiene personale; tessuti impregnati di lozioni cosmetiche; deodoranti per esseri umani o animali; preparati per profumare ambienti; cera per lucidare; carta vetrata. Non comprende: prodotti chimici per pulizia camini (Cl. 1); deodoranti diversi da quelli per umani/animali (Cl. 5); shampoo, saponi, lozioni e dentifrici medicati (Cl. 5); strumenti cosmetici e per pulizia (es. pennelli da trucco, stracci) (Cl. 21).

Classe 4: Oli e grassi industriali, cera; Lubrificanti; Prodotti per assorbire, bagnare e legare la polvere; Combustibili e materie illuminanti; Candele e stoppini per l'illuminazione.
Nota esplicativa: Comprende oli e grassi industriali, combustibili e materie illuminanti. Comprende in particolare: oli per conservazione di murature o cuoio; cera grezza, cera industriale; energia elettrica; carburanti per motori, biocarburanti; legno da bruciare. Non comprende: oli essenziali (Cl. 3); candele da massaggio (Cl. 3 e 5); cera da sarti, cera lucidante, cera depilatoria (Cl. 3), cera per dentisti (Cl. 5).

Classe 5: Prodotti farmaceutici, preparati medici e veterinari; Preparazioni sanitarie per uso medico; Alimenti e sostanze dietetiche per uso medico o veterinario, alimenti per neonati; Integratori alimentari per esseri umani e animali; Cerotti, materiali per medicazioni; Materiali per otturare i denti e cera dentaria; Disinfettanti; Preparati per la distruzione dei parassiti; Fungicidi, erbicidi.
Nota esplicativa: Comprende farmaceutici e preparati per uso medico/veterinario. Comprende in particolare: preparati sanitari per igiene personale (diversi da toilette); pannolini per bebè e incontinenza; deodoranti (diversi da quelli per umani/animali); shampoo, saponi, lozioni e dentifrici medicati; integratori alimentari; cibi sostitutivi dei pasti per uso medico. Non comprende: prodotti per igiene non medicati (Cl. 3); deodoranti per umani/animali (Cl. 3); fasciature di sostegno (Cl. 10); cibi dietetici non per uso medico (Cl. 29, 30, 32).

Classe 6: Metalli comuni e loro leghe, minerali; Materiali metallici per l'edilizia e la costruzione; Costruzioni trasportabili metalliche; Cavi e fili non elettrici in metallo comune; Piccoli oggetti di chincaglieria metallica; Contenitori metallici per immagazzinamento o di trasporto; Casseforti.
Nota esplicativa: Comprende metalli grezzi e semilavorati e alcuni prodotti in metallo. Comprende in particolare: metalli in fogli/polvere per trasformazione (es. stampanti 3D); materiali da costruzione metallici (binari, tubi); piccoli articoli di chincaglieria (bulloni, viti); edifici trasportabili metallici (case prefabbricate, piscine, gabbie); alcuni distributori metallici (salviette, biglietti); statue e oggetti d'arte in metallo comune. Non comprende: metalli come prodotti chimici (es. bauxite) (Cl. 1); metalli in fogli/polvere per pittura (Cl. 2); cavi elettrici (Cl. 9); tubi per impianti sanitari (Cl. 11); mobili (Cl. 20); utensili da cucina (Cl. 21).

Classe 7: Macchine, macchine-utensili, utensili a corrente; Motori (eccetto per veicoli terrestri); Giunti e organi di trasmissione (eccetto per veicoli terrestri); Strumenti agricoli (tranne quelli azionati manualmente); Incubatrici per uova; Distributori automatici.
Nota esplicativa: Comprende macchine, macchine-utensili e motori. Comprende in particolare: parti di motori (avviatori, marmitte); macchine elettriche di pulizia (lucidascarpe, aspirapolveri); stampanti 3D; robot industriali; veicoli speciali non per trasporto (spazzatrici, bulldozer). Non comprende: utensili manuali (Cl. 8); robot umanoidi con AI (Cl. 9); motori per veicoli terrestri (Cl. 12); macchine speciali come respiratori (Cl. 10) o refrigeranti (Cl. 11).

Classe 8: Utensili e strumenti azionati manualmente; Articoli di coltelleria, forchette e cucchiai; Armi bianche; Rasoi.
Nota esplicativa: Comprende utensili manuali per lavori come trapanare, tagliare. Comprende in particolare: utensili manuali per agricoltura/giardinaggio; utensili per carpentieri/artisti (martelli, scalpelli); attrezzi manuali per cura personale (rasoi, attrezzi per tatuaggi, manicure/pedicure); pompe manuali; posateria da tavola. Non comprende: utensili a motore (Cl. 7); coltelleria chirurgica (Cl. 10); armi da fuoco (Cl. 13); tagliacarte (Cl. 16); armi da scherma (Cl. 28).

Classe 9: Apparecchi e strumenti scientifici, di ricerca, di navigazione, geodetici, fotografici, cinematografici, audiovisivi, ottici, di pesata, di misura, di segnalazione, di rilevamento, di collaudo, di ispezione, di salvataggio e d'insegnamento; Apparecchi e strumenti per la conduzione, distribuzione, trasformazione, accumulazione, regolazione o controllo dell'elettricità; Apparecchi per la registrazione, trasmissione, riproduzione di suoni o immagini; Supporti registrati o scaricabili, software, supporti digitali vergini; Meccanismi per apparecchi di prepagamento; Registratori di cassa, macchine calcolatrici; Computer e periferiche; Mute da sub, maschere, tappi per orecchie, etc.; Estintori.
Nota esplicativa: Comprende apparecchiature scientifiche, audiovisive, informatiche e di sicurezza. Comprende in particolare: apparecchi da laboratorio; simulatori; droni e loro controlli; reti di sicurezza, luci di segnalazione, allarmi; indumenti protettivi (antiproiettile, anti-incendio); occhiali, lenti a contatto; smartwatch, joystick per computer, cuffie VR; bancomat; batterie per sigarette elettroniche; robot da laboratorio e di sorveglianza. Non comprende: joystick per macchine (Cl. 7) o per videogiochi (Cl. 28); apparecchi a gettone (classificati per funzione); robot industriali (Cl. 7) o chirurgici (Cl. 10); lampade (Cl. 11); abbigliamento sportivo protettivo come guantoni (Cl. 28).

Classe 10: Apparecchi e strumenti chirurgici, medici, dentari e veterinari; Membra, occhi e denti artificiali; Articoli ortopedici; Materiali di sutura; Dispositivi terapeutici e di assistenza per disabili; Apparecchi per il massaggio; Apparecchi, dispositivi ed articoli di puericultura; Apparecchi, dispositivi e articoli per le attività sessuali.
Nota esplicativa: Comprende apparecchi per diagnosi, trattamento o miglioramento della salute. Comprende in particolare: fasciature di sostegno; indumenti speciali per uso medico (calze per varici, camicie di forza); articoli per mestruazione, contraccezione e parto (coppette mestruali, preservativi, forcipi); impianti artificiali (seni artificiali, stimolatori cerebrali); mobili speciali per uso medico (poltrone da dentista, tavoli operatori). Non comprende: medicazioni assorbenti (cerotti, pannolini) (Cl. 5); impianti con tessuti viventi (Cl. 5); sedie a rotelle (Cl. 12); tavoli da massaggio (Cl. 20).

Classe 11: Apparecchi ed installazioni per illuminazione, riscaldamento, raffreddamento, produzione di vapore, cottura, essiccamento, ventilazione, distribuzione di acqua e impianti sanitari.
Nota esplicativa: Comprende impianti di controllo ambientale. Comprende in particolare: climatizzatori; forni (non da laboratorio); stufe; collettori solari termici; caminetti; sterilizzatori, inceneritori; apparecchi di illuminazione (proiettori, luci per veicoli); lampade; lettini abbronzanti; impianti per bagno; servizi igienici; fontane di cioccolato; coperte e vestiti riscaldati elettricamente; macchine per yogurt, pane, caffè, gelato. Non comprende: apparecchi di produzione vapore per macchine (Cl. 7); lampade per uso medico (Cl. 10); frigoriferi portatili non elettrici (Cl. 21).

Classe 12: Veicoli; Apparecchi di locomozione terrestri, aerei o nautici.
Nota esplicativa: Comprende veicoli per trasporto persone o merci. Comprende in particolare: motori per veicoli terrestri; giunti e organi di trasmissione per veicoli terrestri; veicoli a cuscino d'aria; veicoli radiocomandati (non giocattoli); parti di veicoli (paraurti, parabrezza); battistrada e pneumatici. Non comprende: materiali metallici per ferrovie (Cl. 6); motori non per veicoli terrestri (Cl. 7); tricicli giocattolo (Cl. 28); macchine speciali non da trasporto (motori a fuoco (Cl. 9), carrelli da tè (Cl. 20)).

Classe 13: Armi da fuoco; Munizioni e proiettili; Esplosivi; Fuochi d'artificio.
Nota esplicativa: Comprende armi da fuoco e prodotti pirotecnici. Comprende in particolare: razzi di salvataggio; pistole lanciafiamme; spray per difesa personale; segnali di nebbia esplosivi; pistole ad aria compressa (armi); armi da fuoco sportive. Non comprende: armi bianche (Cl. 8); mirini telescopici (Cl. 9); torce (Cl. 11); cracker di Natale (Cl. 28); pistole ad aria giocattolo (Cl. 28); fiammiferi (Cl. 34).

Classe 14: Metalli preziosi e loro leghe; Gioielleria, bigiotteria, pietre preziose e semipreziose; Orologeria e strumenti cronometrici.
Nota esplicativa: Comprende metalli preziosi, gioielleria, orologeria e loro parti. Comprende in particolare: gioielli (anche imitazione, strass); gemelli, spille da cravatta; portachiavi e ciondoli; scatole per gioielli; parti di orologi (meccanismi, lancette). Non comprende: smartwatch (Cl. 9); ciondoli non per gioielli (Cl. 26); oggetti d'arte non in metalli preziosi (classificati per materia); prodotti in metalli preziosi classificati per funzione (es. pennini in oro (Cl. 16), teiere (Cl. 21)).

Classe 15: Strumenti musicali; Leggii e supporti per strumenti musicali; Bacchette per battere il tempo.
Nota esplicativa: Comprende strumenti musicali e accessori. Comprende in particolare: strumenti musicali meccanici (organi a botte, pianoforti meccanici); strumenti elettrici ed elettronici; corde, canne, pedali per strumenti; carillon; diapason; colofonia. Non comprende: apparecchi per registrazione/amplificazione suono (pedali wah-wah, mixer audio) (Cl. 9); file musicali scaricabili (Cl. 9); juke-box (Cl. 9); metronomi (Cl. 9).

Classe 16: Carta e cartone; Stampati; Articoli per legatoria; Fotografie; Cartoleria e articoli per ufficio (tranne mobili); Adesivi (materie collanti) per cartoleria o uso domestico; Materiale per disegno e artisti; Pennelli; Materiale per istruzione o insegnamento; Fogli, pellicole e buste in materie plastiche per imballaggio; Caratteri tipografici, clichés.
Nota esplicativa: Comprende carta, cartone e articoli da ufficio. Comprende in particolare: tagliacarte; custodie e fodere per articoli di carta (cartelline, portassegni); alcune macchine per ufficio (macchine da scrivere, affrancatrici); articoli per pittura (cavalletti, tavolozze); prodotti usa e getta di carta (bavaglini, fazzoletti); statue e oggetti d'arte in carta/cartone. Non comprende: colori (Cl. 2); utensili manuali per artisti (spatole) (Cl. 8); apparecchi di insegnamento audiovisivi (Cl. 9); prodotti in carta classificati per funzione (es. carta fotografica (Cl. 1), tende di carta (Cl. 20), indumenti di carta (Cl. 25)).

Classe 17: Caucciù, guttaperca, gomma, amianto, mica grezzi e semi-lavorati e succedanei; Materie plastiche e resine semilavorate; Materie per turare, stoppare e isolare; Tubi flessibili non metallici.
Nota esplicativa: Comprende isolanti e materie plastiche semilavorate. Comprende in particolare: gomma per rigenerazione pneumatici; barriere galleggianti antinquinamento; nastri autoadesivi (non per medicina, cartoleria o casa); pellicole di plastica non per imballaggio (fogli antiabbaglianti); fili elastici (non per uso tessile). Non comprende: manichette antincendio (Cl. 9); tubi per impianti sanitari (Cl. 11) o da costruzione (Cl. 6, 19); vetro isolante per costruzione (Cl. 19); gomme per cancellare (Cl. 16).

Classe 18: Cuoio e sue imitazioni; Pelli di animali; Bagagli e borse per il trasporto; Ombrelli e ombrelloni; Bastoni da passeggio; Fruste, finimenti e selleria; Collari, guinzagli e indumenti per animali.
Nota esplicativa: Comprende cuoio, imitazioni e articoli in queste materie. Comprende in particolare: bagagli (valigie, bauli), borse da viaggio, porta-bebè, cartelle; targhette per valigie; porta-biglietti da visita, portafogli; scatole in cuoio. Non comprende: bastoni per scopi medici (Cl. 10); abbigliamento in cuoio per persone (Cl. 25); borse e astucci adattati (custodie per laptop (Cl. 9), borse per mazze da golf (Cl. 28)).

Classe 19: Materiali, non di metallo, per l'edilizia e la costruzione; Tubi rigidi non metallici per la costruzione; Asfalto, pece, catrame e bitume; Costruzioni trasportabili, non di metallo; Monumenti non metallici.
Nota esplicativa: Comprende materiali non metallici per edilizia. Comprende in particolare: legni semilavorati (travi, assi); vetro da costruzione; granito, marmo, ghiaia; tetti non metallici con celle fotovoltaiche; lapidi e tombe non metalliche; statue in pietra, cemento o marmo; buche delle lettere in muratura; impalcature non metalliche; edifici trasportabili non metallici (acquari, voliere, piscine). Non comprende: prodotti per conservazione cemento (Cl. 1); oli disarmanti (Cl. 4); cassette lettere metalliche (Cl. 6) o non in muratura (Cl. 20); statue in altri materiali; tubi non per costruzione; legno non segato (Cl. 31).

Classe 20: Mobili, specchi, cornici; Contenitori, non di metallo, per lo stoccaggio o per il trasporto; Osso, corno, balena o madreperla, allo stato grezzo o semilavorato; Conchiglie; Spuma di mare; Ambra gialla.
Nota esplicativa: Comprende mobili e loro parti e prodotti in legno, sughero, canna, ecc. o plastica. Comprende in particolare: mobili metallici, da campeggio; tapparelle da interno; articoli per letti (materassi, guanciali); specchi da arredo/toilette; targhe di immatricolazione non metalliche; piccoli articoli di chincaglieria non metallica; cassette lettere (non in metallo/muratura); alcuni distributori non metallici. Non comprende: mobili speciali per laboratori (Cl. 9) o uso medico (Cl. 10); biancheria da letto (Cl. 24); specchi per uso specifico (ottici (Cl. 9), chirurgici (Cl. 10)).

Classe 21: Utensili e recipienti per il governo della casa o la cucina; Pentole e vasellame (eccetto forchette, coltelli, cucchiai); Pettini e spugne; Spazzole (eccetto pennelli); Materiali per la fabbricazione di spazzole; Materiale per pulizia; Vetro grezzo o semilavorato (tranne vetro da costruzione); Vetreria, porcellana e maiolica.
Nota esplicativa: Comprende piccoli utensili e apparecchi manuali per casa/cucina e cosmesi. Comprende in particolare: utensili da cucina (pinze, cavatappi); contenitori per casa/cucina (vasi, bottiglie, secchi, pentole); piccoli apparecchi manuali (spremi-aglio, schiaccianoci); utensili per cosmesi (pettini, spazzolini da denti, filo interdentale, piumini da cipria); articoli da giardinaggio (guanti, annaffiatoi); acquari da interni. Non comprende: prodotti per pulizia (Cl. 3); piccoli apparecchi elettrici da cucina (Cl. 7); rasoi e strumenti da taglio (Cl. 8); utensili cottura elettrici (Cl. 11); specchi per toilette (Cl. 20).

Classe 22: Corde e stringhe; Reti; Tende, tende da sole; Pensiline in materie tessili o sintetiche; Vele; Sacchi per il trasporto o l'immagazzinaggio di merci alla rinfusa; Materiale per imbottitura (tranne carta, cartone, caucciù o materie plastiche); Materie tessili fibrose grezze e i loro succedanei.
Nota esplicativa: Comprende tela, corde, materiale da imbottitura e fibre tessili grezze. Comprende in particolare: corde e spaghi (fibra naturale/artificiale, carta, plastica); reti da pesca commerciale, amache; coperture per veicoli (non sagomate); sacchi a rete per bucato, sacchi per cadaveri, sacchi postali; fibre animali e tessili grezze (peli, bozzoli, iuta, lana, seta). Non comprende: funi metalliche (Cl. 6); corde per strumenti musicali (Cl. 15); materiale imbottitura di altri materiali; sacchi e reti classificati per funzione (reti salvataggio (Cl. 9), reticelle per capelli (Cl. 26), borse da golf (Cl. 28)).

Classe 23: Fili e filati per uso tessile.
Nota esplicativa: Comprende fili e filati naturali o sintetici per uso tessile. Comprende in particolare: fili in fibra di vetro, elastici, gomma e plastica per uso tessile; fili per ricamo, rammendo e cucito (anche metallici); filato di seta, cotone, lana. Non comprende: fili per usi specifici (fili identificazione elettrici (Cl. 9), fili chirurgici (Cl. 10), fili di metalli preziosi (Cl. 14)); fili non per uso tessile (classificati per materiale).

Classe 24: Tessuti e loro succedanei; Biancheria da casa; Tende in materia tessile o in materia plastica.
Nota esplicativa: Comprende tessuti e fodere per uso domestico. Comprende in particolare: biancheria da casa (trapunte, fodere per guanciali, asciugamani); biancheria da letto di carta; sacchi a pelo; zanzariere. Non comprende: termocoperte mediche (Cl. 10) e non (Cl. 11); biancheria da tavola di carta (Cl. 16); tende di sicurezza di amianto (Cl. 17); coperte per cavalli (Cl. 18).

Classe 25: Articoli di abbigliamento, scarpe, cappelleria.
Nota esplicativa: Comprende abbigliamento, calzature e cappelleria per esseri umani. Comprende in particolare: parti di abbigliamento (polsini, tasche, tacchi); abbigliamento e calzature per sport (guanti da sci, scarpe da calcio); costumi in maschera; indumenti di carta; bavaglini non di carta; fazzoletti da taschino; scaldapiedi non elettrici. Non comprende: piccoli articoli di ferramenta per calzature (Cl. 6, 20); abbigliamento per uso speciale (caschi protettivi (Cl. 9), indumenti anti-incendio (Cl. 9), calzature ortopediche (Cl. 10)); indumenti riscaldati elettricamente (Cl. 11); abbigliamento per animali (Cl. 18); vestiti per bambole (Cl. 28).

Classe 26: Merletti, pizzi e ricami, nastri e lacci; Bottoni, ganci e occhielli, spille e aghi; Fiori artificiali; Decorazioni per capelli; Capelli finti.
Nota esplicativa: Comprende articoli di merceria, capelli e decorazioni per oggetti. Comprende in particolare: parrucche, toupet, barbe posticce; fermagli, fasce per capelli; retine per capelli; nastri e fiocchi di merceria (non di carta); fibbie, cerniere lampo; ciondoli (non per gioielli); ghirlande artificiali; bigodini (non a mano). Non comprende: ciglia finte (Cl. 3); ganci metallici (Cl. 6) o non (Cl. 20); aghi speciali (tatuaggi (Cl. 8), medici (Cl. 10)); protesi capillari (Cl. 10); filati tessili (Cl. 23); alberi di Natale sintetici (Cl. 28).

Classe 27: Tappeti, zerbini, stuoie, linoleum e altri rivestimenti per pavimenti; Tappezzerie, non in materie tessili.
Nota esplicativa: Comprende prodotti per coprire pavimenti o pareti già costruiti. Comprende in particolare: tappetini per automobili; tappetini da bagno, ginnastica, yoga; erba sintetica; carta da parati (anche in tessuto). Non comprende: pavimenti e piastrelle (Cl. 6, 19); tappeti riscaldati elettricamente (Cl. 11); geotessili (Cl. 19); tappezzerie in tessuto (Cl. 24).

Classe 28: Giochi, giocattoli; Apparecchi di videogiochi; Articoli per la ginnastica e lo sport; Decorazioni per alberi di natale.
Nota esplicativa: Comprende giocattoli, apparecchi da gioco, attrezzature sportive e articoli da regalo/festa. Comprende in particolare: apparecchi di divertimento e telecomandi; articoli per scherzi e feste (maschere, cappellini di carta, coriandoli); materiale per caccia e pesca (canne da pesca, esche); attrezzi per sport e giochi vari. Non comprende: candele e luci per alberi di Natale (Cl. 4, 11); equipaggiamento per subacquei (Cl. 9); giocattoli del sesso (Cl. 10); abbigliamento sportivo (Cl. 25); alcuni articoli sportivi (caschi (Cl. 9), armi da fuoco (Cl. 13), tappetini da ginnastica (Cl. 27)).

Classe 29: Carne, pesce, pollame e selvaggina; Estratti di carne; Frutta e ortaggi conservati, congelati, essiccati e cotti; Gelatine, marmellate, composte; Uova; Latte, formaggio, burro, yogurt e altri prodotti lattiero-caseari; Oli e grassi per alimenti.
Nota esplicativa: Comprende prodotti alimentari di origine animale e vegetali preparati/conservati. Comprende in particolare: bevande a base di latte; alimenti a base di carne, pesce, frutta, verdura; insetti commestibili; succedanei del latte (latte di mandorle, soia); funghi conservati; legumi e noccioline preparati; semi preparati. Non comprende: oli e grassi non alimentari (Cl. 3, 4); condimenti per insalata (Cl. 30); frutta e verdura fresche (Cl. 31); alimenti per neonati (Cl. 5).

Classe 30: Caffè, tè, cacao e loro succedanei; Riso, pasta e noodles; Tapioca e sago; Farine e preparati fatti di cereali; Pane, pasticceria e confetteria; Cioccolato; Gelati, sorbetti e altri gelati commestibili; Zucchero, miele e melassa; Lievito, polvere per fare lievitare; Sale, condimenti, spezie, erbe conservate; Aceto, salse ed altri condimenti; Ghiaccio (acqua ghiacciata).
Nota esplicativa: Comprende prodotti alimentari di origine vegetale preparati/conservati e additivi per sapore. Comprende in particolare: bevande a base di caffè, cacao, cioccolato, tè; cereali pronti (fiocchi d'avena, muesli); pizza, torte, panini; aromi alimentari (non oli essenziali). Non comprende: sale industriale (Cl. 1); aromi come oli essenziali (Cl. 3); infusioni medicinali (Cl. 5); cereali grezzi (Cl. 31).

Classe 31: Prodotti dell'agricoltura, dell'acquacoltura, orticoli e forestali allo stato grezzo e non trasformati; Granaglie e sementi allo stato grezzo e non trasformati; Frutta e ortaggi freschi, erbe aromatiche fresche; Piante e fiori naturali; Bulbi di piante, semi e sementi; Animali vivi; Prodotti alimentari e bevande per animali; Malto.
Nota esplicativa: Comprende prodotti della terra non preparati, animali e piante vive. Comprende in particolare: cereali non trasformati; frutta e verdura fresca (anche lavata/cerata); residui vegetali; alghe non trasformate; legname non segato; uova fecondate; tartufi e funghi freschi; lettiere per animali. Non comprende: colture di microrganismi per uso medico (Cl. 5); legni semilavorati (Cl. 19); esche artificiali (Cl. 28); riso (Cl. 30); tabacco (Cl. 34).

Classe 32: Birre; Bevande non alcoliche; Acque minerali e gassose; Bevande a base di frutta e succhi di frutta; Sciroppi e altri preparati per fare bevande non alcoliche.
Nota esplicativa: Comprende bevande analcoliche e birre. Comprende in particolare: bevande analcoliche, bibite; bevande a base di riso e soia (non succedanei del latte); bevande energetiche, isotoniche; essenze analcoliche per bevande. Non comprende: aromi per bevande (Cl. 3, 30); bevande dietetiche mediche (Cl. 5); bevande a base di latte (Cl. 29); succedanei del latte (Cl. 29); bevande a base di caffè/cacao (Cl. 30).

Classe 33: Bevande alcoliche, escluse le birre; Preparati alcolici per fare bevande.
Nota esplicativa: Comprende bevande alcoliche, essenze ed estratti. Comprende in particolare: vini, vini fortificati; sidro alcolico; alcolici, liquori; essenze alcoliche, estratti di frutta alcolica, amari. Non comprende: bevande medicinali (Cl. 5); bevande analcoliche (Cl. 32); birre (Cl. 32).

Classe 34: Tabacco e succedanei del tabacco; Articoli per fumatori; Fiammiferi; Sigarette e sigari; Sigarette elettroniche e vaporizzatori orali per fumatori.
Nota esplicativa: Comprende tabacco e articoli per fumatori. Comprende in particolare: succedanei del tabacco (non per uso medico); aromi per sigarette elettroniche; erbe per fumo; tabacco da fiuto; accessori (accendini, posacenere, tabacchiere). Non comprende: sigarette senza tabacco mediche (Cl. 5); batterie per sigarette elettroniche (Cl. 9).

SERVIZI
Classe 35: Pubblicità; Gestione, organizzazione e amministrazione aziendale; Lavori di ufficio.
Nota esplicativa: Comprende servizi di gestione aziendale e pubblicità. Comprende in particolare: raggruppamento di prodotti per conto terzi per la vendita (al dettaglio, all'ingrosso, online); servizi pubblicitari (distribuzione campioni, redazione testi); pubbliche relazioni; organizzazione fiere commerciali; ottimizzazione motori di ricerca; assistenza commerciale (reclutamento, negoziazione contratti); servizi amministrativi (tenuta libri contabili, revisioni); amministrazione licenze per conto terzi; lavori d'ufficio (gestione archivi, centralino). Non comprende: servizi finanziari (Cl. 36); logistica (Cl. 39); progettazione grafica promozionale (Cl. 42); servizi legali (Cl. 45).

Classe 36: Servizi finanziari, monetari e bancari; Servizi di assicurazioni; Servizi immobiliari.
Nota esplicativa: Comprende servizi bancari, finanziari, assicurativi e immobiliari. Comprende in particolare: transazioni finanziarie (scambio denaro, trasferimento fondi); gestione finanziaria; stime (gioielleria, immobili); controllo assegni; finanziamenti e credito (prestiti, leasing); raccolta fondi; servizi di cassette di sicurezza; sponsorizzazioni finanziarie; agenzia immobiliare, gestione immobili, affitto appartamenti; sottoscrizione assicurazioni; servizi di mediazione (titoli, assicurazioni). Non comprende: servizi amministrativi contabili (Cl. 35); ricerca sponsor (Cl. 35); intermediazione merci (Cl. 39).

Classe 37: Servizi di costruzione; Servizi d'installazione e di riparazione; Estrazioni minerarie, trivellazione relativa a petrolio e gas.
Nota esplicativa: Comprende servizi di costruzione e ripristino/preservazione oggetti. Comprende in particolare: costruzione e demolizione (edifici, strade); costruzione navale; noleggio attrezzi da costruzione; servizi di riparazione (elettricità, computer hardware, mobili); servizi di restauro (edifici, opere d'arte); servizi di manutenzione (mobili, veicoli, piscine); servizi di pulizia (finestre, veicoli, abbigliamento, lavanderia). Non comprende: magazzinaggio (Cl. 39); trasformazione di oggetti (tintura stoffe, fusione metalli) (Cl. 40); installazione e manutenzione software (Cl. 42); progettazione architettonica (Cl. 42).

Classe 38: Servizi di telecomunicazioni.
Nota esplicativa: Comprende servizi che permettono la comunicazione e la trasmissione di dati. Comprende in particolare: trasmissione video on demand; trasmissione file digitali, posta elettronica; fornitura accesso a reti informatiche globali; radiodiffusione, telediffusione; fornitura forum di discussione internet; servizi telefonici e messaggeria vocale; teleconferenza, videoconferenza. Non comprende: pubblicità radiofonica (Cl. 35); fornitura di contenuti (film, musica) (Cl. 9, 41); servizi realizzati tramite telecomunicazioni (online banking) (Cl. 36); produzione programmi radio/TV (Cl. 41).

Classe 39: Trasporto; Imballaggio e deposito di merci; Organizzazione di viaggi.
Nota esplicativa: Comprende servizi di trasporto persone/animali/merci e immagazzinamento. Comprende in particolare: gestione stazioni, ponti, ferrovie; noleggio veicoli da trasporto, pilotaggio; noleggio posti parcheggio, container; rimorchi marittimi, scarico, salvataggio navi; imballaggio, imbottigliamento, spedizione merci; rifornimento distributori automatici; informazione su viaggi/trasporti; controllo veicoli/merci per trasporto; distribuzione energia, elettricità, acqua. Non comprende: pubblicità per viaggi (Cl. 35); assicurazioni durante trasporto (Cl. 36); manutenzione veicoli (Cl. 37); visite guidate (Cl. 41); prenotazione alloggi (Cl. 43).

Classe 40: Trattamento di materiali; Riciclaggio di rifiuti e immondizia; Purificazione dell'aria e trattamento dell'acqua; Servizi di stampa; Conservazione degli alimenti e delle bevande.
Nota esplicativa: Comprende servizi di trattamento, trasformazione o produzione meccanica/chimica di sostanze o oggetti per conto terzi. Comprende in particolare: trasformazione di oggetti (tintura indumento, cromatura paraurti); trattamento materiali (taglio, levigatura, rivestimento metallico); assemblaggio materiali (saldatura); lavorazione prodotti alimentari (frantumazione frutta, affumicatura, congelamento); fabbricazione su misura (automobili); trapuntatura, ricamo, sartoria su misura. Non comprende: servizi che non modificano proprietà (riparazione mobili) (Cl. 37); servizi di costruzione (Cl. 37); servizi di pulizia (Cl. 37); decorazione cibo (Cl. 43).

Classe 41: Educazione; Formazione; Divertimento; Attività sportive e culturali.
Nota esplicativa: Comprende servizi di istruzione, intrattenimento, divertimento, ricreazione e presentazione di opere d'arte/letteratura. Comprende in particolare: organizzazione esposizioni culturali/educative, conferenze, congressi; traduzione e interpretazione; pubblicazione libri/testi (non pubblicitari); servizi di giornalisti, reportage fotografici; fotografia; regia e produzione film (non pubblicitari); servizi di parchi divertimento, circhi, zoo, musei; formazione sportiva; addestramento animali; giochi online, gioco d'azzardo; prenotazione biglietti per eventi. Non comprende: organizzazione esposizioni commerciali (Cl. 35); agenzie di stampa (Cl. 38); scrittura tecnica (Cl. 42); servizi di asili nido (Cl. 43); servizi di stabilimenti termali (Cl. 44).

Classe 42: Servizi scientifici e tecnologici e servizi di ricerca e progettazione ad essi relativi; Servizi di analisi industriale, di ricerche industriali e di disegno industriale; Servizi di controllo di qualità e di autenticazione; Progettazione e sviluppo di hardware e software per computer.
Nota esplicativa: Comprende servizi teorici/pratici in settori complessi. Comprende in particolare: servizi di ingegneri, ricercatori (valutazioni, perizie); servizi tecnologici per sicurezza dati (protezione antivirus, crittografia); servizi software (SaaS), piattaforma come servizio (PaaS); ricerca scientifica per scopi medici; architettura, pianificazione urbanistica; servizi di design (disegno industriale, sviluppo software, architettura d'interni, arte grafica); esplorazione petrolio, gas, mineraria. Non comprende: ricerche commerciali (Cl. 35), finanziarie (Cl. 36), genealogiche (Cl. 45); gestione archivi informatici (Cl. 35); estrazione mineraria (Cl. 37); installazione/manutenzione hardware (Cl. 37); servizi medici (Cl. 44); servizi legali (Cl. 45).

Classe 43: Servizi di ristorazione (alimentazione); Alloggi temporanei.
Nota esplicativa: Comprende servizi di preparazione cibi/bevande e alloggi temporanei. Comprende in particolare: prenotazioni di alloggi (hotel); pensioni per animali; affitto sale riunioni, tende; servizi di case di riposo; servizi di asili nido; decorazione cibo; noleggio attrezzatura cucina, sedie, tavoli; servizi di sale narghilè; servizi di cuochi a domicilio. Non comprende: gestione amministrativa hotel (Cl. 35); locazione immobili (Cl. 36); prenotazione viaggi (Cl. 39); servizi educativi/intrattenimento (convitti, discoteche) (Cl. 41); case di convalescenza (Cl. 44); babysitting (Cl. 45).

Classe 44: Servizi medici; Servizi veterinari; Cure d'igiene e di bellezza per l'uomo o per gli animali; Servizi di agricoltura, di acquacoltura, di orticultura e di silvicoltura.
Nota esplicativa: Comprende cure mediche, igiene e bellezza per umani/animali e servizi per agricoltura/orticoltura/silvicoltura. Comprende in particolare: servizi ospedalieri; telemedicina; odontoiatria, optometria; analisi mediche da laboratori; servizi terapeutici (fisioterapia); consulenza in farmacia; banche del sangue/tessuti; case di convalescenza/riposo; consulenza dieta; bagni termali; inseminazione artificiale; allevamento animali; piercing, tatuaggi; servizi di giardinaggio (architettura paesaggio, manutenzione prati); arte floreale; distruzione erbacce, lotta contro animali nocivi. Non comprende: lotta contro animali nocivi (non per agricoltura) (Cl. 37); trasporto in ambulanza (Cl. 39); macellazione (Cl. 40); ammaestramento animali (Cl. 41); servizi di club cultura fisica (Cl. 41); pensioni per animali (Cl. 43).

Classe 45: Servizi giuridici; Servizi di sicurezza per la protezione fisica di beni e di individui; Servizi di club incontri, servizi di social network online; Servizi di pompe funebri; Babysitting.
Nota esplicativa: Comprende servizi legali, di sicurezza e personali/sociali. Comprende in particolare: arbitrato e mediazione; registrazione nomi a dominio; controllo conformità legale; servizi di investigazione, sorveglianza sicurezza; servizi per eventi sociali (accompagnamento, organizzazione matrimoni); cerimonie religiose, inumazione; sorveglianza animali a domicilio, dog-sitting; noleggio abbigliamento. Non comprende: servizi di locazione (appartamenti (Cl. 36), auto (Cl. 39)); trasporto di sicurezza (Cl. 39); servizi educativi (Cl. 41); servizi di intrattenimento (Cl. 41); servizi sicurezza informatica (Cl. 42); cure mediche (Cl. 44).
`;

// --- FUNZIONI HELPER ---

async function getAccessToken(clientId, clientSecret) {
    const tokenUrl = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'trademark-search.trademarks.read' });
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }, body });
    const data = await response.json();
    if (!response.ok) throw new Error('Autenticazione EUIPO fallita: ' + (data.error_description || 'Errore sconosciuto'));
    return data.access_token;
}

async function searchEuipoTrademarks(brandName, classes, accessToken, clientId) {
    const searchApiUrl = `https://api.euipo.europa.eu/trademark-search/trademarks`;
    const rsqlQuery = `wordMarkSpecification.verbalElement==*${brandName}* and niceClasses=in=(${classes.join(',')})`;
    const urlWithQuery = `${searchApiUrl}?query=${encodeURIComponent(rsqlQuery)}&size=10`;
    const response = await fetch(urlWithQuery, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-IBM-Client-Id': clientId } });
    if (!response.ok) throw new Error('Ricerca EUIPO fallita.');
    return response.json();
}

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

async function callGeminiAPI(prompt, model = 'gemini-pro') {
    const geminiApiKey = "AIzaSyBcRHmCYBvw_9Ya4b3Q0jLWNyD9fwyhvwI";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Errore da Gemini con modello ${model}:`, errorData);
        throw new Error("Il servizio AI non è riuscito a rispondere.");
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content) {
        throw new Error("Risposta da Gemini non valida o contenuto bloccato.");
    }
    return data.candidates[0].content.parts[0].text;
}

// --- FLUSSO PRINCIPALE DEL BACKEND ---
module.exports = async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const payload = request.body;
        if (!payload.brandName || !payload.productDescription) {
            return response.status(400).json({ message: 'Dati mancanti.' });
        }
        
        const { EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET } = process.env;
        if (!EUIPO_CLIENT_ID || !EUIPO_CLIENT_SECRET) {
            throw new Error('Credenziali EUIPO non configurate.');
        }

        // FASE 1: Classificazione AI dei prodotti/servizi
        const classificationPrompt = `Sei un esperto di Classificazione di Nizza. Analizza la seguente descrizione di prodotti e servizi fornita da un utente e restituisci SOLO un elenco di numeri di classe pertinenti, separati da virgole, senza alcun testo aggiuntivo. Usa la seguente base di conoscenza per la tua analisi:\n\n${NICE_CLASSES_KNOWLEDGE_BASE}\n\nDescrizione Utente: "${payload.productDescription}"\n\nClassi pertinenti:`;
        const identifiedClassesString = await callGeminiAPI(classificationPrompt);
        const identifiedClasses = identifiedClassesString.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c) && c > 0 && c < 46);

        if (identifiedClasses.length === 0) {
            throw new Error("L'AI non è riuscita a identificare classi pertinenti dalla descrizione fornita.");
        }

        // FASE 2: Ricerca EUIPO basata sulle classi identificate
        const accessToken = await getAccessToken(EUIPO_CLIENT_ID, EUIPO_CLIENT_SECRET);
        const euipoJson = await searchEuipoTrademarks(payload.brandName, identifiedClasses, accessToken, EUIPO_CLIENT_ID);
        const euipoResults = parseEuipoResponse(euipoJson);

        // FASE 3: Giudizio AI basato su tutti i dati raccolti
        let judgmentPrompt = `Sei un esperto avvocato specializzato in proprietà intellettuale. Fornisci un giudizio sintetico (massimo 30 righe, tono professionale e chiaro) sul rischio di confondibilità.

**Dati del Nuovo Marchio:**
- Nome Proposto: "${payload.brandName}"
- Descrizione Utente: "${payload.productDescription}"
- Classi Identificate dall'AI: ${identifiedClasses.join(', ')}
- Territori di Interesse: ${payload.selectedCountries.join(', ')}

**Marchi Simili Trovati:**
`;
        if (euipoResults.similarMarks.length > 0) {
            judgmentPrompt += euipoResults.similarMarks.map(mark => `- Nome: "${mark.name}", Stato: ${mark.status}, Classi: ${mark.classes}`).join('\n');
        } else {
            judgmentPrompt += "- Nessun marchio simile trovato. Questo è un fattore molto positivo.";
        }
        judgmentPrompt += `

**Analisi Richiesta:**
Valuta il rischio di confondibilità considerando somiglianza fonetica/concettuale, affinità merceologica (tra classi identificate e quelle dei marchi trovati) e sovrapposizione territoriale. Concludi con una valutazione finale del rischio (Basso, Moderato, Medio, Alto) e un consiglio strategico.`;
        const syntheticJudgment = await callGeminiAPI(judgmentPrompt, 'gemini-pro'); // Uso il modello più potente per l'analisi complessa

        // FASE 4: Invio della risposta combinata
        return response.status(200).json({
            similarMarks: euipoResults.similarMarks,
            syntheticJudgment: syntheticJudgment,
            identifiedClasses: identifiedClasses
        });

    } catch (error) {
        console.error("ERRORE CRITICO nel backend:", error);
        return response.status(500).json({ error: true, message: error.message });
    }
};
