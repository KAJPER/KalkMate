import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie wloskie pliku pl.tsx. Wiazaca jest
// wersja polska (pl.tsx); sekcje i kotwice musza zostac takie same jak w oryginale.
const doc: LegalDoc = {
  metaTitle: "Informativa sulla privacy: GDPR e cookie | KalkMate",
  metaDescription:
    "Come KalkMate protegge i Suoi dati: cosa raccogliamo e perché, per quanto tempo li conserviamo, cookie e Microsoft Clarity, chat con l’IA e i Suoi diritti ai sensi del GDPR.",
  badge: "GDPR · conforme al Regolamento (UE) 2016/679",
  dateLabel: "Aggiornamento · 2026-10-28",
  eyebrow: "[ privacy ] · 14 sezioni",
  h1: "Informativa",
  h1Accent: "sulla privacy",
  intro: "Quali dati raccogliamo, perché li trattiamo, chi vi ha accesso e come può esercitare i Suoi diritti. In conformità al GDPR.",
  bindingNote: (
    <>
      La presente traduzione è fornita a titolo puramente informativo. Fa fede esclusivamente la versione
      polacca della presente informativa sulla privacy: in caso di discrepanze tra i due testi prevale la{" "}
      <A href="/polityka-prywatnosci">versione polacca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposizioni generali", title: "Disposizioni", accent: "generali",
      body: (
        <>
          <P>
            La presente Informativa sulla privacy definisce le regole di trattamento e di protezione dei dati
            personali degli Utenti che utilizzano il sito KalkMate.pl (di seguito: «Sito»), gestito da
            KalkMate (di seguito: «Titolare del trattamento»).
          </P>
          <Gap>
            <P>
              Il Titolare del trattamento attribuisce particolare importanza al rispetto della privacy degli Utenti
              e alla sicurezza dei loro dati personali. I dati personali sono trattati in conformità al
              Regolamento (UE) 2016/679 del Parlamento europeo e del Consiglio del 27 aprile 2016
              (Regolamento generale sulla protezione dei dati, GDPR) e alle disposizioni del diritto nazionale.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Titolare del trattamento", title: "Titolare", accent: "del trattamento",
      body: (
        <>
          <P>Il titolare del trattamento dei dati personali raccolti tramite il Sito è:</P>
          <CompanyBox
            rows={[
              { label: "Partita IVA polacca (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Sede legale", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Denominazione abbreviata", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefono", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>È possibile contattare il Titolare del trattamento per questioni relative al trattamento dei dati personali tramite:</P>
          </Gap>
          <UL>
            <li>e-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefono: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>il modulo di contatto disponibile sul sito.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Dati raccolti", title: "Dati", accent: "raccolti",
      body: (
        <>
          <P>Nell’ambito dell’attività del Sito raccogliamo le seguenti categorie di dati personali:</P>

          <SubH>3.1. Dati forniti dall’utente</SubH>
          <UL>
            <li>nome e cognome,</li>
            <li>indirizzo e-mail,</li>
            <li>numero di telefono,</li>
            <li>indirizzo del punto di ritiro InPost (armadietto automatico Paczkomat).</li>
          </UL>

          <SubH>3.2. Dati raccolti automaticamente</SubH>
          <UL>
            <li>indirizzo IP,</li>
            <li>tipo e versione del browser,</li>
            <li>sistema operativo,</li>
            <li>dati sull’attività nel Sito (pagine visitate, durata della visita),</li>
            <li>informazioni tecniche sul dispositivo.</li>
          </UL>

          <SubH>3.3. Dati transazionali</SubH>
          <UL>
            <li>cronologia degli ordini,</li>
            <li>dati di pagamento (trattati da Stripe),</li>
            <li>informazioni su saldo, acquisti e attivazioni di token IA (compresi i codici di licenza presenti nella confezione e attivati),</li>
            <li>cronologia delle conversazioni con AI Chat.</li>
          </UL>

          <SubH>3.4. Chat con l’assistente IA sul sito</SubH>
          <P>Quando avvia una conversazione nella finestra della chat sul sito (termini e condizioni §8), trattiamo:</P>
          <UL>
            <li>l’indirizzo e-mail indicato all’avvio della conversazione,</li>
            <li>il contenuto dei Suoi messaggi e delle risposte dell’assistente, con data e ora,</li>
            <li>l’indirizzo della pagina da cui è stato inviato il messaggio, la lingua della pagina e le informazioni sul browser (user-agent),</li>
            <li>
              <B>solo se ha acconsentito ai cookie analitici</B>: il percorso
              della visita sul sito (pagine visitate e sezioni visualizzate, con l’ora) e l’identificativo della
              conversazione aggiunto alla registrazione della sessione in Microsoft Clarity — grazie a ciò possiamo
              vedere che cosa stava cercando e risponderLe meglio. Senza tale consenso il percorso della visita non viene raccolto.
            </li>
          </UL>
          <P>
            La conferma «Non sono un robot» esegue un calcolo nel Suo browser — non si avvale di servizi di società
            terze e non salva cookie. Il contenuto dei messaggi viene trasmesso al fornitore del modello di IA
            (cfr. sezione 6) esclusivamente al fine di generare la risposta.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Finalità e base giuridica", title: "Finalità", accent: "del trattamento",
      body: (
        <>
          <P>Panoramica delle finalità del trattamento e delle corrispondenti basi giuridiche ai sensi del GDPR.</P>
          <BasisTable
            head={["Finalità del trattamento", "Base giuridica (GDPR)"]}
            rows={[
              ["Esecuzione del contratto di vendita", "Art. 6, par. 1, lett. b), del GDPR"],
              ["Gestione dei pagamenti", "Art. 6, par. 1, lett. b), del GDPR"],
              ["Prestazione del servizio AI Chat", "Art. 6, par. 1, lett. b), del GDPR"],
              ["Chat con l’assistente IA sul sito (conversazione, e-mail, risposta via e-mail)", "Art. 6, par. 1, lett. b), del GDPR (servizio prestato su Sua richiesta)"],
              ["Analisi delle conversazioni della chat per migliorare l’assistenza e l’assistente", "Art. 6, par. 1, lett. f), del GDPR (legittimo interesse)"],
              ["Associazione del percorso della visita e della registrazione Clarity alla conversazione", "Art. 6, par. 1, lett. a), del GDPR (consenso ai cookie analitici)"],
              ["Spedizione dei prodotti", "Art. 6, par. 1, lett. b), del GDPR"],
              ["Gestione dei reclami", "Art. 6, par. 1, lett. c), del GDPR (obbligo legale)"],
              ["Emissione delle fatture", "Art. 6, par. 1, lett. c), del GDPR (obbligo legale)"],
              ["Marketing diretto", "Art. 6, par. 1, lett. f), del GDPR (legittimo interesse)"],
              ["Analisi e statistiche", "Art. 6, par. 1, lett. f), del GDPR (legittimo interesse)"],
              ["Newsletter (previo consenso)", "Art. 6, par. 1, lett. a), del GDPR (consenso)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Periodo di conservazione", title: "Periodo", accent: "di conservazione",
      body: (
        <>
          <P>
            Conserviamo i dati personali per i periodi previsti dalla legge o per il tempo necessario
            al conseguimento delle finalità del trattamento:
          </P>
          <ULWide>
            <li><B>Dati transazionali e fatture:</B> 5 anni dalla fine dell’anno civile in cui è sorto l’obbligo tributario.</li>
            <li><B>Dati relativi al contratto:</B> per la durata del contratto e per il tempo richiesto dalla legge (ad es. 6 anni in relazione alla prescrizione dei diritti).</li>
            <li><B>Dati relativi ai token IA</B> (saldo, acquisti di pacchetti, codici attivati)<B>:</B> per tutta la durata dell’account e per 3 anni dopo la sua cancellazione.</li>
            <li><B>Cronologia AI Chat:</B> per tutta la durata dell’account (fino alla cancellazione della conversazione o dell’account da parte dell’utente) e fino a 30 giorni dopo la cancellazione dell’account.</li>
            <li><B>Dati di marketing (consenso):</B> fino alla revoca del consenso o all’esercizio del diritto di opposizione.</li>
            <li><B>Dati analitici:</B> fino a 25 mesi dall’ultima attività.</li>
            <li><B>Conversazioni della chat sul sito</B> (e-mail, contenuto, percorso della visita)<B>:</B> 12 mesi dall’ultimo messaggio della conversazione, poi cancellate automaticamente; prima — su Sua richiesta.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Comunicazione dei dati", title: "Destinatari", accent: "",
      body: (
        <>
          <P>I dati personali possono essere comunicati alle seguenti categorie di destinatari:</P>
          <ULWide>
            <li><B>Stripe</B> – operatore di pagamento (elaborazione delle transazioni con carte di pagamento, compresi gli acquisti di pacchetti di token IA).</li>
            <li><B>InPost</B> – corriere (consegna dei prodotti negli armadietti automatici Paczkomat).</li>
            <li><B>Resend</B> – servizio e-mail (invio di messaggi transazionali e di link di accesso «magic link»).</li>
            <li><B>Google AI (Gemini)</B> – fornitore del servizio AI Chat (elaborazione delle richieste nel chatbot).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – intermediario per l’accesso ai modelli di IA (tra cui Google Gemini); riceve il contenuto dei messaggi della chat sul sito e di AI Chat al fine di generare le risposte. Non gli trasmettiamo l’indirizzo e-mail.</li>
            <li><B>Microsoft Clarity</B> – strumento di analisi (mappe di calore, registrazioni delle sessioni) utilizzato esclusivamente previo consenso ai cookie analitici — cfr. sezione 9.</li>
            <li><B>Fornitore di hosting</B> – archiviazione dei dati su server VPS.</li>
            <li><B>Fornitore del database PostgreSQL</B> – archiviazione dei dati degli utenti.</li>
            <li><B>Soggetti autorizzati per legge</B> – autorità pubbliche, tribunali (se richiesto dalla legge).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Tutti i destinatari dei dati operano sulla base di accordi per il trattamento dei dati personali
              per conto del titolare e sono tenuti a garantirne la riservatezza e ad applicare adeguate
              misure di sicurezza.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Trasferimento fuori dal SEE", title: "Trasferimento", accent: "fuori dal SEE",
      body: (
        <>
          <P>
            Alcuni fornitori di servizi (ad es. Stripe, Google AI, OpenRouter, Microsoft Clarity) possono trattare
            dati al di fuori dello Spazio economico europeo (SEE). In tali casi:
          </P>
          <UL>
            <li>Adottiamo garanzie adeguate ai sensi del GDPR (clausole contrattuali tipo approvate dalla Commissione europea).</li>
            <li>Il trasferimento avviene esclusivamente verso paesi che assicurano un livello adeguato di protezione dei dati o verso soggetti che applicano garanzie adeguate.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Diritti degli utenti", title: "Diritti", accent: "degli utenti",
      body: (
        <>
          <P>Ai sensi del GDPR, Le spettano i seguenti diritti:</P>

          <SubH>8.1. Accesso ai dati — art. 15 del GDPR</SubH>
          <P>
            Ha il diritto di ottenere la conferma che sia o meno in corso un trattamento dei Suoi dati personali
            e, in tal caso, di accedervi e di riceverne una copia.
          </P>

          <SubH>8.2. Rettifica — art. 16 del GDPR</SubH>
          <P>
            Ha il diritto di ottenere senza ingiustificato ritardo la rettifica dei dati inesatti
            o l’integrazione dei dati incompleti.
          </P>

          <SubH>8.3. Cancellazione («diritto all’oblio») — art. 17 del GDPR</SubH>
          <P>In determinati casi ha il diritto di chiedere la cancellazione dei dati personali.</P>

          <SubH>8.4. Limitazione del trattamento — art. 18 del GDPR</SubH>
          <P>In determinate situazioni può chiedere la limitazione del trattamento dei dati.</P>

          <SubH>8.5. Portabilità dei dati — art. 20 del GDPR</SubH>
          <P>
            Ha il diritto di ricevere i Suoi dati in un formato strutturato, di uso comune e leggibile
            da dispositivo automatico e di trasmetterli a un altro titolare del trattamento.
          </P>

          <SubH>8.6. Opposizione — art. 21 del GDPR</SubH>
          <P>
            Ha il diritto di opporsi al trattamento dei dati per finalità di marketing
            o sulla base del legittimo interesse.
          </P>

          <SubH>8.7. Revoca del consenso — art. 7, par. 3, del GDPR</SubH>
          <P>
            Se il trattamento si basa sul consenso, ha il diritto di revocarlo
            in qualsiasi momento.
          </P>

          <SubH>8.8. Reclamo all’autorità di controllo — art. 77 del GDPR</SubH>
          <P>
            Ha il diritto di proporre reclamo al Presidente dell’Ufficio polacco per la protezione dei dati personali
            (PUODO) qualora ritenga che il trattamento dei Suoi dati violi le disposizioni del GDPR.
          </P>
          <InfoBox title="PUODO · contatti">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Per esercitare i diritti sopra indicati La preghiamo di contattarci via e-mail o tramite il modulo di contatto.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookie", title: "Cookie", accent: "",
      body: (
        <>
          <SubH>9.1. Che cosa sono i cookie</SubH>
          <P>
            I cookie sono piccoli file di testo salvati sul dispositivo dell’utente durante la
            visita di un sito web.
          </P>

          <SubH>9.2. Quali cookie utilizziamo</SubH>
          <ULWide>
            <li><B>Necessari</B> — garantiscono le funzionalità di base del sito (sessione utente, carrello, accesso).</li>
            <li><B>Funzionali</B> — memorizzano le Sue preferenze (ad es. la modalità scura).</li>
            <li><B>Analitici</B> — ci aiutano a capire come gli utenti utilizzano il sito (mappe di calore, registrazioni delle sessioni, statistiche delle visite). A tal fine utilizziamo <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Di marketing</B> — utilizzati per personalizzare la pubblicità (solo previo consenso).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity viene caricato esclusivamente previo consenso ai cookie analitici
            nel banner del consenso («Accetta tutti»). Lo strumento salva sul dispositivo, tra l’altro,
            i cookie <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> e <Mono>SM</Mono>, che servono a riconoscere
            l’utente di ritorno, registrare le sessioni e generare mappe di calore. I dati
            sono trattati da Microsoft Corporation conformemente alla{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">informativa sulla privacy di Microsoft Clarity</A>.
            Il consenso può essere revocato in qualsiasi momento cancellando i dati del banner del consenso
            nelle impostazioni del browser (localStorage) e scegliendo «Solo essenziali».
          </P>

          <SubH>9.4. Memoria del browser utilizzata dalla chat</SubH>
          <P>
            La chat con l’assistente salva nella memoria del browser (localStorage) l’identificativo della Sua
            conversazione, così da poterla proseguire dopo il ricaricamento della pagina — ciò è necessario al
            funzionamento del servizio da Lei richiesto e scompare dopo aver cliccato su «Termina». Solo previo
            consenso ai cookie analitici la chat salva inoltre nel sessionStorage (fino alla chiusura della scheda)
            l’elenco delle pagine e delle sezioni visitate di cui al punto 3.4.
          </P>

          <SubH>9.5. Gestione dei cookie</SubH>
          <P>
            Può gestire i cookie tramite le impostazioni del browser. Occorre tuttavia tenere
            presente che la disattivazione dei cookie può incidere sulla funzionalità del Sito
            (ad es. accesso, carrello).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Sicurezza dei dati", title: "Sicurezza", accent: "",
      body: (
        <>
          <P>
            Adottiamo misure tecniche e organizzative adeguate per proteggere i dati
            personali da:
          </P>
          <UL>
            <li>accesso non autorizzato,</li>
            <li>perdita,</li>
            <li>distruzione,</li>
            <li>modifica non autorizzata,</li>
            <li>diffusione non autorizzata.</li>
          </UL>
          <Gap size={5}>
            <P>In particolare utilizziamo:</P>
          </Gap>
          <UL>
            <li>crittografia delle connessioni SSL/TLS (HTTPS),</li>
            <li>archiviazione sicura delle password (algoritmo bcrypt con salt),</li>
            <li>protezione delle sessioni utente (cookie HttpOnly, Secure),</li>
            <li>limitazione dell’accesso ai dati alle sole persone autorizzate,</li>
            <li>aggiornamenti regolari del software e del sistema,</li>
            <li>monitoraggio della sicurezza dell’infrastruttura,</li>
            <li>backup regolari del database.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automazione e profilazione", title: "Automazione", accent: "",
      body: (
        <>
          <P>
            Nell’ambito del Sito non ricorriamo a processi decisionali automatizzati, compresa la
            profilazione, che producano effetti giuridici nei confronti degli Utenti o che incidano in modo
            analogo significativamente sulla loro situazione.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) e l’assistente della chat sul sito sono strumenti di supporto che
              rispondono alle richieste degli utenti, ma non adottano decisioni automatizzate con effetti
              giuridici. Il percorso della visita associato alla conversazione (solo previo consenso) serve
              esclusivamente ad adattare le risposte e a migliorare il sito.
              Nella finestra della chat La informiamo che sta conversando con un’IA.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Dati dei minori", title: "Dati", accent: "dei minori",
      body: (
        <>
          <P>
            Il Sito KalkMate.pl può essere utilizzato da minorenni (studenti delle scuole
            secondarie). Se l’utente non ha compiuto 18 anni, l’acquisto della calcolatrice e l’utilizzo
            di AI Chat richiedono il consenso di un genitore o di un tutore legale.
          </P>
          <Gap>
            <P>
              Non raccogliamo consapevolmente dati personali di bambini di età inferiore a 13 anni senza il
              consenso dei genitori/tutori.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Modifiche dell’informativa", title: "Modifiche", accent: "dell’informativa",
      body: (
        <>
          <P>
            L’Informativa sulla privacy può essere modificata in seguito allo sviluppo tecnologico,
            a modifiche della normativa o a cambiamenti nell’attività del Sito.
          </P>
          <Gap>
            <P>Informeremo gli Utenti di tutte le modifiche sostanziali tramite:</P>
          </Gap>
          <UL>
            <li>un avviso sulla pagina principale del Sito,</li>
            <li>un messaggio e-mail (per gli utenti registrati).</li>
          </UL>
          <Gap>
            <P>
              La versione aggiornata dell’Informativa sulla privacy è sempre disponibile all’indirizzo:{" "}
              <A href="/it/polityka-prywatnosci">kalkmate.pl/it/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Contatti", title: "Contatti", accent: "",
      body: (
        <>
          <P>
            Per qualsiasi domanda relativa al trattamento dei dati personali e all’esercizio dei diritti
            che Le spettano, La preghiamo di rivolgersi a:
          </P>
          <UL>
            <li>E-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefono: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/it/pomoc#kontakt">Modulo di contatto</A>{" "}disponibile sul sito.</li>
          </UL>
          <Gap size={5}>
            <P>Ci impegniamo a rispondere alle Sue richieste entro 30 giorni dal loro ricevimento.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Grazie per la fiducia e per aver scelto KalkMate.pl. Attribuiamo particolare importanza
      alla tutela della Sua privacy e alla sicurezza dei Suoi dati personali.
    </>
  ),
  footerNote: "Ultimo aggiornamento · 2026-10-28 (chat con l’assistente IA sul sito)",
  otherDocLabel: "→ Termini e condizioni",
  homeLabel: "← Home",
};

export default doc;
