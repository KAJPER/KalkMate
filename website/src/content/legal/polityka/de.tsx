import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie niemieckie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Datenschutzerklärung: DSGVO und Cookies | KalkMate",
  metaDescription:
    "Wie KalkMate Ihre Daten schützt: was wir erheben und wozu, wie lange wir sie speichern, Cookies und Microsoft Clarity, der KI-Chat sowie Ihre Rechte nach der DSGVO.",
  badge: "DSGVO · konform mit EU 2016/679",
  dateLabel: "Aktualisierung · 2026-10-28",
  eyebrow: "[ datenschutz ] · 14 Abschnitte",
  h1: "Datenschutz-",
  h1Accent: "erklärung",
  intro: "Welche Daten wir erheben, warum wir sie verarbeiten, wer Zugriff darauf hat und wie Sie Ihre Rechte wahrnehmen können. Gemäß DSGVO.",
  bindingNote: (
    <>
      Dies ist eine Übersetzung, die zu Ihrer Information bereitgestellt wird. Rechtlich verbindlich ist die
      polnische Fassung — bei Abweichungen hat die <A href="/polityka-prywatnosci">polnische Fassung</A> Vorrang.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Allgemeine Bestimmungen", title: "Allgemeine", accent: "Bestimmungen",
      body: (
        <>
          <P>
            Diese Datenschutzerklärung legt die Grundsätze der Verarbeitung und des Schutzes personenbezogener Daten
            der Nutzer des Dienstes KalkMate.pl (nachfolgend: „Dienst“) fest, der von
            KalkMate (nachfolgend: „Verantwortlicher“) betrieben wird.
          </P>
          <Gap>
            <P>
              Der Verantwortliche legt besonderen Wert auf die Achtung der Privatsphäre der Nutzer
              sowie die Sicherheit ihrer personenbezogenen Daten. Personenbezogene Daten werden gemäß der
              Verordnung (EU) 2016/679 des Europäischen Parlaments und des Rates vom 27. April 2016
              (DSGVO) sowie den Vorschriften des nationalen Rechts verarbeitet.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Verantwortliche Stelle", title: "Verantwortliche", accent: "Stelle",
      body: (
        <>
          <P>Verantwortlicher für die über den Dienst erhobenen personenbezogenen Daten ist:</P>
          <CompanyBox
            rows={[
              { label: "Steuernummer (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Geschäftssitz", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Kurzbezeichnung", value: "KAJPA", mono: true },
              { label: "E-Mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefon", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>In Angelegenheiten der Verarbeitung personenbezogener Daten ist der Verantwortliche erreichbar über:</P>
          </Gap>
          <UL>
            <li>E-Mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefonisch: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>das auf der Website verfügbare Kontaktformular.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Umfang der erhobenen Daten", title: "Umfang", accent: "der Daten",
      body: (
        <>
          <P>Im Rahmen des Betriebs des Dienstes erheben wir folgende Kategorien personenbezogener Daten:</P>

          <SubH>3.1. Vom Nutzer angegebene Daten</SubH>
          <UL>
            <li>Vor- und Nachname,</li>
            <li>E-Mail-Adresse,</li>
            <li>Telefonnummer,</li>
            <li>Adresse der InPost-Abholstelle (Paketautomat Paczkomat).</li>
          </UL>

          <SubH>3.2. Automatisch erhobene Daten</SubH>
          <UL>
            <li>IP-Adresse,</li>
            <li>Browsertyp und -version,</li>
            <li>Betriebssystem,</li>
            <li>Daten über die Aktivität im Dienst (besuchte Seiten, Besuchsdauer),</li>
            <li>technische Informationen über das Gerät.</li>
          </UL>

          <SubH>3.3. Transaktionsdaten</SubH>
          <UL>
            <li>Bestellhistorie,</li>
            <li>Zahlungsdaten (verarbeitet durch Stripe),</li>
            <li>Informationen über Guthaben, Käufe und Aktivierungen von KI-Tokens (einschließlich aktivierter Lizenzcodes aus der Verpackung),</li>
            <li>Verlauf der Unterhaltungen im AI Chat.</li>
          </UL>

          <SubH>3.4. Chat mit dem KI-Assistenten auf der Website</SubH>
          <P>Wenn Sie im Chatfenster auf der Website ein Gespräch beginnen (AGB §8), verarbeiten wir:</P>
          <UL>
            <li>die beim Start des Gesprächs angegebene E-Mail-Adresse,</li>
            <li>den Inhalt Ihrer Nachrichten und der Antworten des Assistenten, mit Datum und Uhrzeit,</li>
            <li>die Adresse der Unterseite, von der die Nachricht gesendet wurde, die Sprache der Seite und Informationen über den Browser (User-Agent),</li>
            <li>
              <B>nur wenn Sie in Analyse-Cookies eingewilligt haben</B>: den Verlauf
              Ihres Besuchs auf der Website (besuchte Unterseiten und angesehene Abschnitte, mit Uhrzeit) sowie eine
              Gesprächskennung, die der Sitzungsaufzeichnung in Microsoft Clarity hinzugefügt wird — so können wir sehen,
              wonach Sie gesucht haben, und Ihnen besser antworten. Ohne diese Einwilligung wird der Besuchsverlauf nicht erfasst.
            </li>
          </UL>
          <P>
            Die Bestätigung „Ich bin kein Roboter“ führt eine Berechnung in Ihrem Browser durch — sie nutzt keine Dienste
            externer Unternehmen und speichert keine Cookies. Der Inhalt der Nachrichten wird an den Anbieter des KI-Modells
            (siehe Abschnitt 6) ausschließlich zur Generierung einer Antwort übermittelt.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Zweck und Rechtsgrundlage", title: "Zweck", accent: "der Verarbeitung",
      body: (
        <>
          <P>Übersicht über die Verarbeitungszwecke und die entsprechenden Rechtsgrundlagen nach der DSGVO.</P>
          <BasisTable
            head={["Verarbeitungszweck", "Rechtsgrundlage nach DSGVO"]}
            rows={[
              ["Erfüllung des Kaufvertrags", "Art. 6 Abs. 1 lit. b DSGVO"],
              ["Zahlungsabwicklung", "Art. 6 Abs. 1 lit. b DSGVO"],
              ["Bereitstellung des Dienstes AI Chat", "Art. 6 Abs. 1 lit. b DSGVO"],
              ["Chat mit dem KI-Assistenten auf der Website (Gespräch, E-Mail, Antwort per E-Mail)", "Art. 6 Abs. 1 lit. b DSGVO (Dienst auf Ihre Anfrage)"],
              ["Auswertung von Chatgesprächen zur Verbesserung des Kundenservice und des Assistenten", "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)"],
              ["Zuordnung des Besuchsverlaufs und der Clarity-Aufzeichnung zum Gespräch", "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung in Analyse-Cookies)"],
              ["Versand der Produkte", "Art. 6 Abs. 1 lit. b DSGVO"],
              ["Bearbeitung von Reklamationen", "Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung)"],
              ["Ausstellung von Rechnungen", "Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung)"],
              ["Direktmarketing", "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)"],
              ["Analyse und Statistik", "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)"],
              ["Newsletter (sofern eingewilligt)", "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Speicherdauer", title: "Dauer der", accent: "Speicherung",
      body: (
        <>
          <P>
            Wir speichern personenbezogene Daten für die gesetzlich vorgeschriebenen Zeiträume oder so lange,
            wie es zur Erreichung der Verarbeitungszwecke erforderlich ist:
          </P>
          <ULWide>
            <li><B>Transaktionsdaten und Rechnungen:</B> 5 Jahre ab dem Ende des Kalenderjahres, in dem die Steuerpflicht entstanden ist.</li>
            <li><B>Vertragsdaten:</B> für die Dauer des Vertrags sowie für den gesetzlich vorgeschriebenen Zeitraum (z. B. 6 Jahre im Zusammenhang mit der Verjährung von Ansprüchen).</li>
            <li><B>Daten im Zusammenhang mit KI-Tokens</B> (Guthaben, Paketkäufe, aktivierte Codes)<B>:</B> für die Dauer des Bestehens des Kontos sowie 3 Jahre nach dessen Löschung.</li>
            <li><B>AI-Chat-Verlauf:</B> für die Dauer des Bestehens des Kontos (bis zur Löschung des Gesprächs oder des Kontos durch den Nutzer) sowie bis zu 30 Tage nach Löschung des Kontos.</li>
            <li><B>Marketingdaten (Einwilligung):</B> bis zum Widerruf der Einwilligung oder bis zur Einlegung eines Widerspruchs.</li>
            <li><B>Analysedaten:</B> bis zu 25 Monate ab der letzten Aktivität.</li>
            <li><B>Gespräche im Website-Chat</B> (E-Mail, Inhalt, Besuchsverlauf)<B>:</B> 12 Monate ab der letzten Nachricht im Gespräch, danach automatische Löschung; früher — auf Ihren Wunsch.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Weitergabe von Daten", title: "Weitergabe", accent: "",
      body: (
        <>
          <P>Personenbezogene Daten können an folgende Kategorien von Empfängern weitergegeben werden:</P>
          <ULWide>
            <li><B>Stripe</B> – Zahlungsdienstleister (Abwicklung von Kartenzahlungen, einschließlich Käufen von KI-Token-Paketen).</li>
            <li><B>InPost</B> – Kurierunternehmen (Lieferung der Produkte an Paczkomat-Paketautomaten).</li>
            <li><B>Resend</B> – E-Mail-Dienst (Versand von Transaktionsnachrichten und Magic Links).</li>
            <li><B>Google AI (Gemini)</B> – Anbieter des Dienstes AI Chat (Verarbeitung von Anfragen im Chatbot).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – Vermittler für den Zugang zu KI-Modellen (u. a. Google Gemini); erhält den Inhalt der Nachrichten aus dem Website-Chat und dem AI Chat, um Antworten zu generieren. Die E-Mail-Adresse übermitteln wir an diesen Anbieter nicht.</li>
            <li><B>Microsoft Clarity</B> – Analysetool (Heatmaps, Sitzungsaufzeichnungen), das ausschließlich nach Einwilligung in Analyse-Cookies eingesetzt wird — siehe Abschnitt 9.</li>
            <li><B>Hosting-Anbieter</B> – Speicherung der Daten auf VPS-Servern.</li>
            <li><B>Anbieter der PostgreSQL-Datenbank</B> – Speicherung der Nutzerdaten.</li>
            <li><B>Gesetzlich berechtigte Stellen</B> – staatliche Behörden, Gerichte (sofern gesetzlich vorgeschrieben).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Alle Datenempfänger handeln auf Grundlage von Verträgen über die Auftragsverarbeitung
              personenbezogener Daten und sind verpflichtet, deren Vertraulichkeit zu wahren und
              angemessene Sicherheitsmaßnahmen anzuwenden.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Übermittlung außerhalb des EWR", title: "Übermittlung", accent: "außerhalb des EWR",
      body: (
        <>
          <P>
            Einige Dienstleister (z. B. Stripe, Google AI, OpenRouter, Microsoft Clarity) können Daten
            außerhalb des Europäischen Wirtschaftsraums (EWR) verarbeiten. In solchen Fällen gilt:
          </P>
          <UL>
            <li>Wir stellen geeignete Garantien gemäß der DSGVO sicher (von der Europäischen Kommission genehmigte Standardvertragsklauseln).</li>
            <li>Die Übermittlung erfolgt ausschließlich in Länder, die ein angemessenes Datenschutzniveau gewährleisten, oder an Stellen, die geeignete Garantien anwenden.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Rechte der Nutzer", title: "Rechte", accent: "der Nutzer",
      body: (
        <>
          <P>Gemäß der DSGVO stehen Ihnen folgende Rechte zu:</P>

          <SubH>8.1. Auskunft — Art. 15 DSGVO</SubH>
          <P>
            Sie haben das Recht, eine Bestätigung darüber zu verlangen, ob wir Ihre personenbezogenen Daten verarbeiten,
            und, falls ja, Auskunft über diese Daten sowie eine Kopie davon zu erhalten.
          </P>

          <SubH>8.2. Berichtigung — Art. 16 DSGVO</SubH>
          <P>
            Sie haben das Recht, unverzüglich die Berichtigung unrichtiger Daten
            oder die Vervollständigung unvollständiger Daten zu verlangen.
          </P>

          <SubH>8.3. Löschung („Recht auf Vergessenwerden“) — Art. 17 DSGVO</SubH>
          <P>In bestimmten Fällen haben Sie das Recht, die Löschung Ihrer personenbezogenen Daten zu verlangen.</P>

          <SubH>8.4. Einschränkung der Verarbeitung — Art. 18 DSGVO</SubH>
          <P>In bestimmten Situationen können Sie die Einschränkung der Verarbeitung Ihrer Daten verlangen.</P>

          <SubH>8.5. Datenübertragbarkeit — Art. 20 DSGVO</SubH>
          <P>
            Sie haben das Recht, Ihre Daten in einem strukturierten, gängigen und
            maschinenlesbaren Format zu erhalten und sie einem anderen Verantwortlichen zu übermitteln.
          </P>

          <SubH>8.6. Widerspruch — Art. 21 DSGVO</SubH>
          <P>
            Sie haben das Recht, der Verarbeitung Ihrer Daten zu Marketingzwecken
            oder auf Grundlage eines berechtigten Interesses zu widersprechen.
          </P>

          <SubH>8.7. Widerruf der Einwilligung — Art. 7 Abs. 3 DSGVO</SubH>
          <P>
            Erfolgt die Verarbeitung auf Grundlage einer Einwilligung, haben Sie das Recht, diese
            jederzeit zu widerrufen.
          </P>

          <SubH>8.8. Beschwerde bei der Aufsichtsbehörde — Art. 77 DSGVO</SubH>
          <P>
            Sie haben das Recht, beim Präsidenten des polnischen Datenschutzamts (PUODO) Beschwerde einzulegen,
            wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verstößt.
          </P>
          <InfoBox title="PUODO · Kontakt">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Zur Ausübung der oben genannten Rechte kontaktieren Sie uns bitte per E-Mail oder über das Kontaktformular.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Was sind Cookies</SubH>
          <P>
            Cookies sind kleine Textdateien, die beim Besuch einer Website auf dem Gerät
            des Nutzers gespeichert werden.
          </P>

          <SubH>9.2. Welche Cookies wir verwenden</SubH>
          <ULWide>
            <li><B>Notwendige Cookies</B> — gewährleisten die grundlegenden Funktionen der Website (Nutzersitzung, Warenkorb, Anmeldung).</li>
            <li><B>Funktionale Cookies</B> — speichern Ihre Präferenzen (z. B. Dunkelmodus).</li>
            <li><B>Analyse-Cookies</B> — helfen uns zu verstehen, wie Nutzer die Website verwenden (Heatmaps, Sitzungsaufzeichnungen, Besuchsstatistiken). Dafür verwenden wir <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketing-Cookies</B> — werden zur Personalisierung von Werbung verwendet (nur mit Einwilligung).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity wird ausschließlich nach Einwilligung in Analyse-Cookies
            im Einwilligungsbanner („Alle akzeptieren“) geladen. Das Tool speichert auf dem Gerät u. a. die
            Cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> und <Mono>SM</Mono>, die dazu dienen, wiederkehrende
            Nutzer zu erkennen, Sitzungen aufzuzeichnen und Heatmaps zu erstellen. Die Daten
            werden von der Microsoft Corporation gemäß der{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">Datenschutzrichtlinie von Microsoft Clarity</A> verarbeitet.
            Die Einwilligung kann jederzeit widerrufen werden, indem Sie die Daten des Einwilligungsbanners
            in den Browsereinstellungen (localStorage) löschen und „Nur notwendige“ wählen.
          </P>

          <SubH>9.4. Vom Chat genutzter Browserspeicher</SubH>
          <P>
            Der Chat mit dem Assistenten speichert im Browserspeicher (localStorage) die Kennung Ihres Gesprächs, damit
            es nach dem Neuladen der Seite fortgesetzt werden kann — dies ist für die Funktion des von Ihnen angeforderten
            Dienstes erforderlich und wird nach dem Klick auf „Beenden“ gelöscht. Nur mit Einwilligung in Analyse-Cookies
            speichert der Chat außerdem im sessionStorage (bis zum Schließen des Tabs) die in Punkt 3.4 genannte Liste
            der besuchten Unterseiten und Abschnitte.
          </P>

          <SubH>9.5. Verwaltung von Cookies</SubH>
          <P>
            Sie können Cookies über die Einstellungen Ihres Browsers verwalten. Bitte beachten Sie
            jedoch, dass die Deaktivierung von Cookies die Funktionalität des Dienstes beeinträchtigen kann
            (z. B. Anmeldung, Warenkorb).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Datensicherheit", title: "Sicherheit", accent: "",
      body: (
        <>
          <P>
            Wir setzen geeignete technische und organisatorische Maßnahmen ein, um personenbezogene
            Daten zu schützen vor:
          </P>
          <UL>
            <li>unbefugtem Zugriff,</li>
            <li>Verlust,</li>
            <li>Zerstörung,</li>
            <li>unbefugter Veränderung,</li>
            <li>unbefugter Verbreitung.</li>
          </UL>
          <Gap size={5}>
            <P>Insbesondere setzen wir ein:</P>
          </Gap>
          <UL>
            <li>Verschlüsselung der Verbindungen mit SSL/TLS (HTTPS),</li>
            <li>sichere Speicherung von Passwörtern (bcrypt-Algorithmus mit Salt),</li>
            <li>Schutz der Nutzersitzung (Cookies mit HttpOnly und Secure),</li>
            <li>Beschränkung des Datenzugriffs ausschließlich auf befugte Personen,</li>
            <li>regelmäßige Aktualisierungen von Software und System,</li>
            <li>Überwachung der Sicherheit der Infrastruktur,</li>
            <li>regelmäßige Sicherungskopien der Datenbank.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatisierung und Profiling", title: "Automatisierung", accent: "",
      body: (
        <>
          <P>
            Im Rahmen des Dienstes setzen wir keine automatisierte Entscheidungsfindung einschließlich
            Profiling ein, die gegenüber den Nutzern rechtliche Wirkung entfalten oder sie in ähnlicher
            Weise erheblich beeinträchtigen würde.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) sowie der Assistent im Website-Chat sind unterstützende
              Werkzeuge, die Anfragen der Nutzer beantworten, jedoch keine automatisierten
              Entscheidungen mit rechtlicher Wirkung treffen. Der einem Gespräch zugeordnete
              Besuchsverlauf (nur mit Einwilligung) dient ausschließlich dazu, die Antworten anzupassen und die Website zu verbessern.
              Dass Sie mit einer KI sprechen, teilen wir Ihnen im Chatfenster mit.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Daten von Kindern", title: "Daten", accent: "von Kindern",
      body: (
        <>
          <P>
            Der Dienst KalkMate.pl kann von Minderjährigen (Schülerinnen und Schülern weiterführender
            Schulen) genutzt werden. Hat der Nutzer das 18. Lebensjahr noch nicht vollendet, erfordern der Kauf
            des Rechners und die Nutzung von AI Chat die Zustimmung eines Elternteils oder des gesetzlichen Vertreters.
          </P>
          <Gap>
            <P>
              Wir erheben nicht wissentlich personenbezogene Daten von Kindern unter 13 Jahren ohne
              Zustimmung der Eltern/Erziehungsberechtigten.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Änderungen der Erklärung", title: "Änderungen", accent: "der Erklärung",
      body: (
        <>
          <P>
            Diese Datenschutzerklärung kann aufgrund technologischer Entwicklungen, Änderungen
            der Rechtsvorschriften oder Änderungen im Betrieb des Dienstes geändert werden.
          </P>
          <Gap>
            <P>Über alle wesentlichen Änderungen informieren wir die Nutzer durch:</P>
          </Gap>
          <UL>
            <li>eine Mitteilung auf der Startseite des Dienstes,</li>
            <li>eine E-Mail (für registrierte Nutzer).</li>
          </UL>
          <Gap>
            <P>
              Die aktuelle Fassung der Datenschutzerklärung ist stets abrufbar unter:{" "}
              <A href="/de/polityka-prywatnosci">kalkmate.pl/de/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Kontakt", title: "Kontakt", accent: "",
      body: (
        <>
          <P>
            Alle Fragen zur Verarbeitung personenbezogener Daten und zur Ausübung
            Ihrer Rechte richten Sie bitte an:
          </P>
          <UL>
            <li>E-Mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefon: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>das auf der Website verfügbare{" "}<A href="/de/pomoc#kontakt">Kontaktformular</A>.</li>
          </UL>
          <Gap size={5}>
            <P>Wir verpflichten uns, Ihre Anfragen innerhalb von 30 Tagen nach Eingang zu beantworten.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Vielen Dank für Ihr Vertrauen und die Nutzung von KalkMate.pl. Der Schutz Ihrer Privatsphäre
      und die Sicherheit Ihrer personenbezogenen Daten liegen uns besonders am Herzen.
    </>
  ),
  footerNote: "Letzte Aktualisierung · 2026-10-28 (Chat mit dem KI-Assistenten auf der Website)",
  otherDocLabel: "→ AGB",
  homeLabel: "← Startseite",
};

export default doc;
