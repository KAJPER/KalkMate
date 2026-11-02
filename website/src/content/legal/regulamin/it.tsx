import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie wloskie pliku pl.tsx. Wiazaca jest wersja
// polska (pl.tsx); sekcje i kotwice musza zostac takie same jak w oryginale.
const doc: LegalDoc = {
  metaTitle: "Termini e condizioni: ordini, resi e garanzia | KalkMate",
  metaDescription:
    "Termini e condizioni del negozio KalkMate: ordini, pagamenti (Przelewy24, carta), spedizione InPost gratuita, 14 giorni per il reso, 24 mesi di garanzia e chat con l’assistente IA.",
  badge: "Conforme alla legge polacca sui diritti dei consumatori",
  dateLabel: "In vigore dal · 2026-01-01",
  eyebrow: "[ termini ] · 10 sezioni",
  h1: "Termini",
  h1Accent: "e condizioni",
  intro: "Regole per l’effettuazione degli ordini, i pagamenti, la consegna, i resi e i reclami nel negozio online kalkmate.pl.",
  bindingNote: (
    <>
      La presente traduzione è fornita a titolo puramente informativo. Fa fede esclusivamente la versione
      polacca dei presenti termini e condizioni: in caso di discrepanze tra i due testi prevale la{" "}
      <A href="/regulamin">versione polacca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposizioni generali", title: "Disposizioni", accent: "generali",
      body: (
        <>
          <P>
            I presenti termini e condizioni disciplinano la vendita di prodotti nel negozio online
            disponibile all’indirizzo kalkmate.pl, gestito da <B>Kacper Popko</B>{" "}
            che esercita attività d’impresa con la denominazione <B>KAJPA Kacper Popko</B>,
            di seguito denominato «Venditore».
          </P>
          <CompanyBox
            rows={[
              { label: "Partita IVA polacca (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Sede legale", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Ordini", title: "Ordini", accent: "",
      body: (
        <OL>
          <li>Gli ordini vengono accettati tramite il sito web kalkmate.pl 24 ore su 24, 7 giorni su 7.</li>
          <li>L’effettuazione dell’ordine equivale all’accettazione dei presenti termini e condizioni.</li>
          <li>Dopo aver effettuato l’ordine, l’Acquirente riceve una conferma all’indirizzo e-mail indicato.</li>
          <li>Il Venditore si riserva il diritto di rifiutare l’evasione di un ordine in casi giustificati.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Prezzi e pagamenti", title: "Prezzi", accent: "e pagamenti",
      body: (
        <OL>
          <li>Tutti i prezzi indicati sul sito sono prezzi lordi (IVA inclusa).</li>
          <li>I pagamenti sono gestiti dal servizio Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Metodi di pagamento disponibili: carta di pagamento, BLIK, bonifico bancario e altri metodi disponibili nel servizio Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Evasione e consegna", title: "Evasione", accent: "e consegna",
      body: (
        <OL>
          <li>Il prodotto KalkMate è fabbricato su ordinazione, come produzione propria del Venditore.</li>
          <li>Il termine di evasione è di massimo 4 settimane dal momento dell’accredito del pagamento. Il tempo di evasione standard è di 1–2 settimane.</li>
          <li>La consegna in Polonia avviene tramite InPost (armadietto automatico Paczkomat). Costo di consegna in Polonia: 0 PLN.</li>
          <li>Consegna all’estero (paesi dell’UE): 20 EUR. Consegna fuori dall’UE: 35 EUR.</li>
          <li>L’Acquirente riceve il numero di tracciamento della spedizione dopo l’invio.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Diritto di recesso", title: "Diritto", accent: "di recesso",
      body: (
        <>
          <P>
            Il Consumatore ha il diritto di recedere dal contratto concluso a distanza entro 14 giorni
            di calendario senza indicarne il motivo, fatta salva l’eccezione descritta di seguito.
          </P>
          <Callout title="Eccezione — dispositivo personalizzato su ordinazione">
            <CalloutP>
              Ogni esemplare del dispositivo KalkMate viene personalizzato individualmente su richiesta del
              Consumatore prima della spedizione: (a) vi viene caricato il codice di sblocco delle funzioni IA
              scelto dal Consumatore nel modulo d’ordine e (b) sull’etichetta dell’esemplare viene stampato il
              nome/nickname indicato dal Consumatore. Ai sensi{" "}
              <B>dell’art. 38, punto 3, della legge polacca del 30 maggio 2014 sui diritti dei consumatori</B>,
              il diritto di recesso non si applica ai beni prodotti secondo le specifiche del consumatore o
              destinati a soddisfare le sue esigenze individualizzate. Tale informazione e la richiesta di un
              consenso separato vengono presentate al Consumatore prima della conclusione del contratto, nel
              modulo d’ordine.
            </CalloutP>
            <CalloutP className="mt-3">
              Tale eccezione <B>non riguarda</B> gli acquisti di pacchetti
              (ricariche) di token IA, per i quali il diritto di recesso si applica secondo le regole generali.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              I commi seguenti riguardano i casi in cui il diritto di recesso spetta
              (ossia gli acquisti diversi dal dispositivo KalkMate personalizzato):
            </P>
          </div>
          <OL>
            <li>Il termine per recedere dal contratto scade dopo 14 giorni dal giorno in cui il Consumatore è entrato in possesso del bene.</li>
            <li>Per esercitare il diritto di recesso, il Consumatore deve informare il Venditore della propria decisione via e-mail all’indirizzo: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Il bene deve essere restituito all’indirizzo: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Il rimborso del pagamento avviene entro 14 giorni dal giorno di ricevimento del bene restituito.
              Se il Consumatore ha espressamente richiesto l’inizio della prestazione del servizio (ad es. soluzioni IA)
              prima della scadenza del termine di recesso, il Venditore ha il diritto di trattenere dall’importo del
              rimborso il corrispettivo per i servizi effettivamente prestati fino al momento del recesso (art. 35 della
              legge polacca sui diritti dei consumatori) e, nel caso di un bene restituito che presenti segni d’uso
              eccedenti quanto necessario per stabilire la natura e il funzionamento del bene, anche un importo
              corrispondente alla diminuzione del suo valore (art. 34, comma 4, della legge polacca sui diritti dei consumatori).
            </li>
            <li>Il diritto di reclamo a titolo di garanzia legale (rękojmia) e di garanzia convenzionale (§6) spetta indipendentemente dalle disposizioni di cui sopra e non è da esse limitato.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reclami e garanzia", title: "Reclami", accent: "e garanzia",
      body: (
        <OL>
          <li>I prodotti sono coperti dalla garanzia del Venditore per un periodo di 24 mesi dalla data di acquisto.</li>
          <li>I reclami devono essere inviati via e-mail all’indirizzo: <B>kontakt@kalkmate.pl</B>, indicando il numero d’ordine e la descrizione del difetto.</li>
          <li>Il Venditore esamina i reclami entro 14 giorni di calendario.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Protezione dei dati personali", title: "Protezione", accent: "dei dati",
      body: (
        <OL>
          <li>Titolare del trattamento dei dati personali è il Venditore.</li>
          <li>I dati personali sono trattati esclusivamente ai fini dell’evasione dell’ordine e non vengono comunicati a terzi, ad eccezione dei corrieri e degli operatori di pagamento.</li>
          <li>L’Acquirente ha il diritto di accedere ai propri dati, di rettificarli e di chiederne la cancellazione.</li>
          <li>
            Il sito utilizza cookie, compreso lo strumento di analisi Microsoft Clarity
            (mappe di calore, registrazioni delle sessioni), caricato esclusivamente previo consenso espresso nel
            banner dei cookie. I dettagli sono riportati nella{" "}
            <A href="/it/polityka-prywatnosci#sek-9">Informativa sulla privacy</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat con l’assistente IA", title: "Chat", accent: "con l’assistente IA",
      body: (
        <OL>
          <li>
            Sul sito kalkmate.pl il Venditore mette a disposizione un servizio gratuito prestato per via elettronica:
            una chat con un assistente le cui risposte sono generate da un’<B>intelligenza artificiale (IA)</B>.
            L’assistente non è una persona. Risponde a domande sui prodotti, sugli ordini e sul funzionamento della calcolatrice.
          </li>
          <li>
            Per avviare una conversazione sono necessari: un browser con JavaScript attivato, l’indicazione di un
            indirizzo e-mail, la conferma che l’utente non è un automa (verifica eseguita nel browser) e
            l’accettazione del presente paragrafo. Il contratto di prestazione del servizio si conclude al momento
            dell’avvio della conversazione e si scioglie al momento della sua conclusione (pulsante «Termina» o
            chiusura della pagina). L’utente può smettere di utilizzare la chat in qualsiasi momento.
          </li>
          <li>
            Le risposte dell’assistente hanno carattere esclusivamente informativo, possono contenere errori e non
            costituiscono un’offerta ai sensi del Codice civile polacco né una dichiarazione di volontà del Venditore.
            In caso di discrepanze fanno fede i presenti termini e condizioni, la descrizione del prodotto sul sito e
            le informazioni fornite nella conferma d’ordine. L’assistente non ha accesso agli ordini né agli account —
            le questioni relative a specifici ordini, resi e reclami vanno indirizzate a kontakt@kalkmate.pl.
          </li>
          <li>
            Il Venditore può rispondere a una domanda posta in chat con un messaggio e-mail all’indirizzo indicato,
            in particolare quando l’assistente non conosce la risposta.
          </li>
          <li>
            È vietato inviare nella chat contenuti illeciti, offensivi o lesivi dei diritti di terzi, nonché dati
            particolarmente protetti, password, dati di carte di pagamento e il codice IA della calcolatrice. Il
            Venditore può bloccare una conversazione che violi tali regole e applicare limiti al numero di messaggi.
          </li>
          <li>
            L’assistente può offrire spontaneamente il proprio aiuto mostrando un breve messaggio accanto al pulsante
            della chat (ad es. dopo un certo tempo trascorso sul sito o in corrispondenza del listino prezzi). Tale
            messaggio compare al massimo due volte nel corso di una visita e non ricompare dopo essere stato chiuso.
          </li>
          <li>
            Il contenuto delle conversazioni, l’indirizzo e-mail e le informazioni tecniche (pagina da cui è stato
            inviato il messaggio, browser) vengono registrati e sono accessibili al Venditore e alle persone da questi
            autorizzate, al fine di gestire le richieste e migliorare l’assistenza clienti. Se l’utente ha acconsentito
            ai cookie analitici, alla conversazione vengono associati anche il percorso della visita sul sito (pagine
            visitate e sezioni visualizzate) e l’identificativo della registrazione della sessione in Microsoft Clarity.
            I dettagli, le basi giuridiche e il periodo di conservazione (12 mesi dall’ultimo messaggio) sono descritti
            nella{" "}
            <A href="/it/polityka-prywatnosci#sek-3">Informativa sulla privacy</A>.
          </li>
          <li>
            Le persone che non hanno compiuto 16 anni possono utilizzare la chat con il consenso di un genitore o di un tutore legale.
          </li>
          <li>
            I reclami relativi al funzionamento della chat possono essere inviati a kontakt@kalkmate.pl. Il Venditore
            li esamina entro 14 giorni.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Programma partner", title: "Programma", accent: "partner",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Può partecipare al programma partner («Partner») qualsiasi utente registrato del sito kalkmate.pl
            con indirizzo e-mail confermato. Il Partner crea nell’area clienti un unico codice partner personale
            (da 4 a 16 caratteri: lettere A–Z e cifre).
          </li>
          <li>
            L’Acquirente che inserisce un codice partner al momento dell’ordine ottiene uno <B>sconto del 7%</B>{" "}
            sul prezzo dei prodotti. Il codice partner non è cumulabile con altri buoni sconto (il modulo d’ordine
            accetta un solo codice). Il Partner non può utilizzare il proprio codice.
          </li>
          <li>
            Per ogni ordine pagato con il codice, il Partner riceve una commissione calcolata sul valore dei prodotti
            dopo lo sconto, spese di spedizione escluse. L’entità della commissione dipende dal livello del Partner,
            determinato in base al numero di unità vendute con il suo codice prima dell’ordine in questione:
            <TierTable
              head={["Livello", "Unità vendute", "Commissione"]}
              rows={[
                ["Start", "0–2", "5%"],
                ["Bronzo", "3–9", "7%"],
                ["Argento", "10–24", "9%"],
                ["Oro", "25–49", "11%"],
                ["Diamante", "da 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Le commissioni sono conteggiate in zloty (PLN); il valore degli ordini in EUR è convertito al tasso fisso di 4,25 PLN per 1 EUR.
            </span>
          </li>
          <li>
            La commissione diventa disponibile 30 giorni dopo il pagamento dell’ordine. La commissione viene stornata
            in caso di annullamento dell’ordine, rimborso del pagamento o contestazione relativa al pagamento — anche
            qualora sia già stata convertita o pagata; il saldo del Partner può in tal caso diventare negativo e viene
            compensato con le commissioni successive.
          </li>
          <li>
            Il Partner può utilizzare i fondi disponibili per: (a) convertirli in token IA — a partire da 10 PLN, al
            tasso di 1 PLN = 65 000 token, immediatamente; (b) prelevarli tramite bonifico su un conto bancario — a
            partire da 100 PLN, solo se il Partner è maggiorenne. Il pagamento viene effettuato di norma entro 7 giorni
            lavorativi. Prima del pagamento il Venditore può richiedere i dati necessari agli adempimenti fiscali.
          </li>
          <li>
            È vietato: inviare spam, spacciarsi per KalkMate o per il Venditore, pubblicare annunci sui motori di
            ricerca per parole chiave contenenti il marchio KalkMate, utilizzare il proprio codice a proprio favore
            ed effettuare ordini fittizi. In caso di violazioni il Venditore può disattivare il codice partner e
            annullare le commissioni non dovute.
          </li>
          <li>
            Il Venditore può modificare le condizioni del programma partner con un preavviso di 14 giorni, dandone
            comunicazione sul sito. Le modifiche non riguardano le commissioni maturate prima della loro entrata in vigore.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Disposizioni finali", title: "Disposizioni", accent: "finali",
      body: (
        <OL>
          <li>Per quanto non disciplinato dai presenti termini e condizioni si applicano le disposizioni del Codice civile polacco, della legge polacca sui diritti dei consumatori e della legge polacca sulla prestazione di servizi per via elettronica.</li>
          <li>Il Venditore si riserva il diritto di modificare i termini e condizioni. Le modifiche entrano in vigore il giorno della loro pubblicazione sul sito.</li>
          <li>Tutte le controversie saranno risolte dal tribunale competente per la sede del Venditore.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Grazie per la fiducia e per aver acquistato KalkMate. Per qualsiasi domanda su ordini,
      resi o reclami siamo a disposizione all’indirizzo kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "In vigore dal · 2026-01-01 · ultima modifica 2026-10-28 (§9 programma partner)",
  otherDocLabel: "→ Informativa sulla privacy",
  homeLabel: "← Home",
};

export default doc;
