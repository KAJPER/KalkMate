import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie niemieckie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "AGB: Bestellungen, Rücksendungen und Garantie | KalkMate",
  metaDescription:
    "AGB des KalkMate-Shops: Bestellungen, Zahlungen (Przelewy24, Karte), kostenloser Versand mit InPost, 14 Tage für die Rücksendung, 24 Monate Garantie und Chat mit einem KI-Assistenten.",
  badge: "Konform mit dem polnischen Verbraucherrechtegesetz",
  dateLabel: "Gültig ab · 2026-01-01",
  eyebrow: "[ agb ] · 10 Abschnitte",
  h1: "Allgemeine",
  h1Accent: "Geschäfts­bedingungen",
  intro: "Regeln für Bestellungen, Zahlungen, Lieferung, Rücksendungen und Reklamationen im Onlineshop kalkmate.pl.",
  bindingNote: (
    <>
      Dies ist eine Übersetzung, die zu Ihrer Information bereitgestellt wird. Rechtlich verbindlich ist die
      polnische Fassung — bei Abweichungen hat die <A href="/regulamin">polnische Fassung</A> Vorrang.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Allgemeine Bestimmungen", title: "Allgemeine", accent: "Bestimmungen",
      body: (
        <>
          <P>
            Diese AGB regeln den Verkauf von Produkten im Onlineshop unter der Adresse
            kalkmate.pl, betrieben von <B>Kacper Popko</B>{" "}
            (Ausübung einer gewerblichen Tätigkeit unter der Firma <B>KAJPA Kacper Popko</B>),
            nachfolgend „Verkäufer“ genannt.
          </P>
          <CompanyBox
            rows={[
              { label: "Steuernummer (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Geschäftssitz", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Bestellungen", title: "Bestellungen", accent: "",
      body: (
        <OL>
          <li>Bestellungen werden über die Website kalkmate.pl rund um die Uhr, 7 Tage die Woche, entgegengenommen.</li>
          <li>Mit der Aufgabe einer Bestellung akzeptiert der Käufer diese AGB.</li>
          <li>Nach Aufgabe der Bestellung erhält der Käufer eine Bestätigung an die angegebene E-Mail-Adresse.</li>
          <li>Der Verkäufer behält sich das Recht vor, die Ausführung einer Bestellung in begründeten Fällen abzulehnen.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Preise und Zahlungen", title: "Preise", accent: "und Zahlungen",
      body: (
        <OL>
          <li>Alle auf der Website angegebenen Preise sind Bruttopreise (inkl. Mehrwertsteuer).</li>
          <li>Zahlungen werden über den Dienst Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań) abgewickelt.</li>
          <li>Verfügbare Zahlungsmethoden: Zahlungskarte, BLIK, Banküberweisung sowie weitere im Dienst Przelewy24 verfügbare Methoden.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Abwicklung und Lieferung", title: "Abwicklung", accent: "und Lieferung",
      body: (
        <OL>
          <li>Das Produkt KalkMate wird auf Bestellung in Eigenproduktion hergestellt.</li>
          <li>Die Bearbeitungszeit beträgt bis zu 4 Wochen ab Gutschrift der Zahlung. Die übliche Bearbeitungszeit beträgt 1–2 Wochen.</li>
          <li>Die Lieferung innerhalb Polens erfolgt über InPost (Paketautomat — Paczkomat). Versandkosten innerhalb Polens: 0 PLN.</li>
          <li>Lieferung ins Ausland (EU-Länder): 20 EUR. Lieferung außerhalb der EU: 35 EUR.</li>
          <li>Der Käufer erhält die Sendungsnummer zur Sendungsverfolgung nach dem Versand.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Widerrufsrecht", title: "Recht auf", accent: "Widerruf",
      body: (
        <>
          <P>
            Der Verbraucher hat das Recht, einen Fernabsatzvertrag innerhalb von 14 Kalendertagen
            ohne Angabe von Gründen zu widerrufen, vorbehaltlich der nachstehend beschriebenen Ausnahme.
          </P>
          <Callout title="Ausnahme — auf Bestellung personalisiertes Gerät">
            <CalloutP>
              Jedes KalkMate-Gerät wird vor dem Versand auf Wunsch des Verbrauchers individuell
              personalisiert: (a) Es wird der vom Verbraucher im Bestellformular gewählte Code zur
              Freischaltung der KI-Funktionen aufgespielt und (b) auf das Etikett des jeweiligen Exemplars
              wird der vom Verbraucher angegebene Name/Nickname gedruckt. Gemäß{" "}
              <B>Art. 38 Nr. 3 des polnischen Verbraucherrechtegesetzes vom 30. Mai 2014</B>{" "}
              besteht das Widerrufsrecht nicht bei Waren, die nach den Spezifikationen des Verbrauchers
              hergestellt werden oder seinen individuellen Bedürfnissen dienen. Diese Information sowie das
              Erfordernis einer gesonderten Zustimmung werden dem Verbraucher vor Vertragsschluss im
              Bestellformular mitgeteilt.
            </CalloutP>
            <CalloutP className="mt-3">
              Diese Ausnahme <B>gilt nicht</B> für den Kauf von Paketen
              (Aufladungen) mit KI-Tokens, für die das Widerrufsrecht nach den allgemeinen Regeln gilt.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Die folgenden Absätze betreffen Fälle, in denen das Widerrufsrecht besteht
              (d. h. andere Käufe als das personalisierte KalkMate-Gerät):
            </P>
          </div>
          <OL>
            <li>Die Widerrufsfrist endet 14 Tage nach dem Tag, an dem der Verbraucher die Ware in Besitz genommen hat.</li>
            <li>Um das Widerrufsrecht auszuüben, muss der Verbraucher den Verkäufer per E-Mail an folgende Adresse über seine Entscheidung informieren: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Die Ware ist an folgende Adresse zurückzusenden: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Die Rückzahlung erfolgt innerhalb von 14 Tagen ab dem Tag des Eingangs der zurückgesandten Ware.
              Hat der Verbraucher ausdrücklich verlangt, dass mit der Erbringung einer Dienstleistung (z. B.
              KI-Lösungen) vor Ablauf der Widerrufsfrist begonnen wird, ist der Verkäufer berechtigt, vom
              Erstattungsbetrag die Vergütung für die bis zum Widerruf tatsächlich erbrachten Leistungen
              abzuziehen (Art. 35 des Verbraucherrechtegesetzes), und bei einer zurückgesandten Ware mit
              Gebrauchsspuren, die über das zur Feststellung der Beschaffenheit und Funktionsweise der Ware
              notwendige Maß hinausgehen —
              auch einen dem Wertverlust entsprechenden Betrag (Art. 34 Abs. 4 des Verbraucherrechtegesetzes).
            </li>
            <li>Das Recht auf Reklamation aus gesetzlicher Gewährleistung (rękojmia) und Garantie (§6) besteht unabhängig von den vorstehenden Bestimmungen und wird durch diese nicht eingeschränkt.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reklamationen und Garantie", title: "Reklamationen", accent: "und Garantie",
      body: (
        <OL>
          <li>Auf die Produkte gewährt der Verkäufer eine Garantie von 24 Monaten ab dem Kaufdatum.</li>
          <li>Reklamationen sind per E-Mail an <B>kontakt@kalkmate.pl</B> unter Angabe der Bestellnummer und einer Beschreibung des Mangels zu melden.</li>
          <li>Der Verkäufer bearbeitet Reklamationen innerhalb von 14 Kalendertagen.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Schutz personenbezogener Daten", title: "Schutz", accent: "der Daten",
      body: (
        <OL>
          <li>Verantwortlicher für die personenbezogenen Daten ist der Verkäufer.</li>
          <li>Personenbezogene Daten werden ausschließlich zur Abwicklung der Bestellung verarbeitet und nicht an Dritte weitergegeben, mit Ausnahme von Kurierunternehmen und Zahlungsdienstleistern.</li>
          <li>Der Käufer hat das Recht auf Auskunft über seine Daten, auf deren Berichtigung sowie das Recht, ihre Löschung zu verlangen.</li>
          <li>
            Die Website verwendet Cookies, darunter das Analysetool Microsoft Clarity
            (Heatmaps, Sitzungsaufzeichnungen), das ausschließlich nach Erteilung der Einwilligung im
            Cookie-Banner geladen wird. Einzelheiten finden Sie in der{" "}
            <A href="/de/polityka-prywatnosci#sek-9">Datenschutzerklärung</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat mit dem KI-Assistenten", title: "Chat", accent: "mit dem KI-Assistenten",
      body: (
        <OL>
          <li>
            Auf der Website kalkmate.pl stellt der Verkäufer einen kostenlosen, elektronisch erbrachten Dienst bereit:
            einen Chat mit einem Assistenten, dessen Antworten von <B>künstlicher Intelligenz (KI)</B> generiert werden.
            Der Assistent ist kein Mensch. Er beantwortet Fragen zu Produkten, Bestellungen und zur Funktionsweise des Rechners.
          </li>
          <li>
            Für den Beginn eines Gesprächs sind erforderlich: ein Webbrowser mit aktiviertem JavaScript, die Angabe einer
            E-Mail-Adresse, die Bestätigung, dass der Nutzer kein Bot ist (im Browser durchgeführte Prüfung), sowie die
            Annahme dieses Paragraphen. Der Vertrag über die Erbringung des Dienstes kommt mit Beginn des Gesprächs zustande
            und endet mit dessen Abschluss (Schaltfläche „Beenden“ oder Schließen der Seite). Der Nutzer kann
            die Nutzung des Chats jederzeit beenden.
          </li>
          <li>
            Die Antworten des Assistenten dienen ausschließlich Informationszwecken, können Fehler enthalten und stellen weder
            ein Angebot im Sinne des polnischen Zivilgesetzbuchs noch eine Willenserklärung des Verkäufers dar. Bei Abweichungen
            sind diese AGB, die Produktbeschreibung auf der Website sowie die in der Bestellbestätigung übermittelten
            Informationen maßgeblich. Der Assistent hat keinen Zugriff auf Bestellungen oder Konten — Anliegen zu konkreten
            Bestellungen, Rücksendungen und Reklamationen sind an die Adresse kontakt@kalkmate.pl zu richten.
          </li>
          <li>
            Der Verkäufer kann eine Frage aus dem Chat per E-Mail an die angegebene Adresse beantworten, insbesondere wenn
            der Assistent die Antwort nicht kennt.
          </li>
          <li>
            Es ist untersagt, im Chat rechtswidrige, beleidigende oder die Rechte Dritter verletzende Inhalte zu übermitteln,
            ebenso besonders geschützte Daten, Passwörter, Zahlungskartendaten und den KI-Code des Rechners. Der Verkäufer
            kann ein Gespräch, das gegen diese Regeln verstößt, sperren sowie die Anzahl der Nachrichten begrenzen.
          </li>
          <li>
            Der Assistent kann von sich aus Hilfe anbieten, indem er neben der Chat-Schaltfläche eine kurze Nachricht anzeigt
            (z. B. nach einer gewissen Zeit auf der Seite oder bei der Preisliste). Eine solche Nachricht erscheint höchstens
            zweimal pro Besuch und nach dem Schließen nicht erneut.
          </li>
          <li>
            Der Inhalt der Gespräche, die E-Mail-Adresse und technische Informationen (die Seite, von der die Nachricht
            gesendet wurde, der Browser) werden gespeichert und sind dem Verkäufer sowie von ihm befugten Personen zugänglich,
            um Anfragen zu bearbeiten und den Kundenservice zu verbessern. Hat der Nutzer in Analyse-Cookies eingewilligt,
            werden dem Gespräch außerdem der Verlauf des Besuchs auf der Website (besuchte Unterseiten und angesehene
            Abschnitte) sowie die Kennung der Sitzungsaufzeichnung in Microsoft Clarity zugeordnet. Einzelheiten,
            Rechtsgrundlagen und die Speicherdauer (12 Monate ab der letzten Nachricht) beschreibt die{" "}
            <A href="/de/polityka-prywatnosci#sek-3">Datenschutzerklärung</A>.
          </li>
          <li>
            Personen unter 16 Jahren dürfen den Chat mit Zustimmung eines Elternteils oder des gesetzlichen Vertreters nutzen.
          </li>
          <li>
            Reklamationen zur Funktionsweise des Chats können an kontakt@kalkmate.pl gerichtet werden. Der Verkäufer
            bearbeitet sie innerhalb von 14 Tagen.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Partnerprogramm", title: "Partnerprogramm", accent: "",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Teilnehmer des Partnerprogramms („Partner“) kann jeder registrierte Nutzer des Dienstes kalkmate.pl
            mit bestätigter E-Mail-Adresse sein. Der Partner erstellt im Kundenbereich einen eigenen Partnercode
            (4 bis 16 Zeichen: Buchstaben A–Z und Ziffern).
          </li>
          <li>
            Ein Käufer, der bei der Bestellung einen Partnercode angibt, erhält <B>7% Rabatt</B>{" "}
            auf den Preis der Produkte. Der Partnercode kann nicht mit anderen Rabattgutscheinen kombiniert werden (das
            Bestellformular akzeptiert einen Code). Der Partner kann seinen eigenen Code nicht verwenden.
          </li>
          <li>
            Für jede bezahlte Bestellung mit dem Code erhält der Partner eine Provision, die vom Warenwert nach Rabatt
            ohne Versandkosten berechnet wird. Die Höhe der Provision hängt von der Stufe des Partners ab, die anhand der
            Anzahl der vor der jeweiligen Bestellung mit seinem Code verkauften Stück bestimmt wird:
            <TierTable
              head={["Stufe", "Verkaufte Stück", "Provision"]}
              rows={[
                ["Start", "0–2", "5%"],
                ["Bronze", "3–9", "7%"],
                ["Silber", "10–24", "9%"],
                ["Gold", "25–49", "11%"],
                ["Diamant", "ab 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Provisionen werden in Złoty (PLN) abgerechnet; der Wert von Bestellungen in EUR wird zum festen Kurs von 4,25 PLN für 1 EUR umgerechnet.
            </span>
          </li>
          <li>
            Die Provision wird 30 Tage nach Bezahlung der Bestellung verfügbar. Die Provision wird zurückgebucht, wenn die
            Bestellung storniert, die Zahlung erstattet oder die Zahlung angefochten wird — auch dann, wenn sie bereits
            getauscht oder ausgezahlt wurde; das Guthaben des Partners kann dadurch negativ werden und wird mit künftigen
            Provisionen ausgeglichen.
          </li>
          <li>
            Verfügbare Mittel kann der Partner: (a) in KI-Tokens tauschen — ab 10 PLN, zum Kurs 1 PLN = 65.000 Tokens,
            sofort; (b) per Überweisung auf ein Bankkonto auszahlen lassen — ab 100 PLN, nur wenn der Partner volljährig
            ist. Die Auszahlung erfolgt in der Regel innerhalb von 7 Werktagen. Vor der Auszahlung kann der Verkäufer
            die für die steuerliche Abrechnung erforderlichen Angaben anfordern.
          </li>
          <li>
            Untersagt sind: das Versenden von Spam, das Auftreten als KalkMate oder als Verkäufer, Suchmaschinenwerbung
            auf Suchbegriffe, die die Marke KalkMate enthalten, Empfehlungen an sich selbst sowie fingierte Bestellungen. Bei
            Verstößen kann der Verkäufer den Partnercode deaktivieren und nicht geschuldete Provisionen stornieren.
          </li>
          <li>
            Der Verkäufer kann die Bedingungen des Partnerprogramms mit einer Vorankündigung von 14 Tagen ändern und
            informiert darüber auf der Website. Die Änderungen gelten nicht für Provisionen, die vor ihrem Inkrafttreten
            angefallen sind.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Schlussbestimmungen", title: "Abschließende", accent: "Bestimmungen",
      body: (
        <OL>
          <li>In Angelegenheiten, die in diesen AGB nicht geregelt sind, gelten die Vorschriften des polnischen Zivilgesetzbuchs, des Verbraucherrechtegesetzes sowie des Gesetzes über die Erbringung elektronischer Dienstleistungen.</li>
          <li>Der Verkäufer behält sich das Recht vor, diese AGB zu ändern. Änderungen treten am Tag ihrer Veröffentlichung auf der Website in Kraft.</li>
          <li>Alle Streitigkeiten werden von dem für den Sitz des Verkäufers zuständigen Gericht entschieden.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Vielen Dank für Ihr Vertrauen und den Kauf von KalkMate. Bei Fragen zu Ihrer Bestellung,
      einer Rücksendung oder einer Reklamation sind wir unter kontakt@kalkmate.pl für Sie da.
    </>
  ),
  footerNote: "Gültig ab · 2026-01-01 · letzte Änderung 2026-10-28 (§9 Partnerprogramm)",
  otherDocLabel: "→ Datenschutzerklärung",
  homeLabel: "← Startseite",
};

export default doc;
