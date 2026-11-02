import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie angielskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Privacy Policy: GDPR and cookies | KalkMate",
  metaDescription:
    "How KalkMate protects your data: what we collect and why, how long we keep it, cookies and Microsoft Clarity, the AI chat and your rights under the GDPR.",
  badge: "GDPR · compliant with EU 2016/679",
  dateLabel: "Updated · 2026-10-28",
  eyebrow: "[ privacy ] · 14 sections",
  h1: "Privacy",
  h1Accent: "Policy",
  intro: "What data we collect, why we process it, who has access to it and how you can exercise your rights. In accordance with the GDPR.",
  bindingNote: (
    <>
      This is a translation provided for convenience. The legally binding version is the Polish one — in case
      of any discrepancy, the <A href="/polityka-prywatnosci">Polish version</A> prevails.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "General provisions", title: "General", accent: "provisions",
      body: (
        <>
          <P>
            This Privacy Policy sets out the rules for the processing and protection of the personal data
            of Users of the KalkMate.pl service (hereinafter: the “Service”), operated by
            KalkMate (hereinafter: the “Controller”).
          </P>
          <Gap>
            <P>
              The Controller attaches particular importance to respecting Users’ privacy
              and the security of their personal data. Personal data are processed in accordance with
              Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016
              (GDPR) and the provisions of national law.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Data controller", title: "Data", accent: "controller",
      body: (
        <>
          <P>The controller of the personal data collected via the Service is:</P>
          <CompanyBox
            rows={[
              { label: "Tax ID (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Registered address", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Short name", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Phone", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>The Controller can be contacted on matters concerning the processing of personal data via:</P>
          </Gap>
          <UL>
            <li>e-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>phone: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>the contact form available on the website.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Scope of data collected", title: "Scope", accent: "of data",
      body: (
        <>
          <P>In operating the Service, we collect the following categories of personal data:</P>

          <SubH>3.1. Data provided by the user</SubH>
          <UL>
            <li>first and last name,</li>
            <li>e-mail address,</li>
            <li>phone number,</li>
            <li>address of the InPost pickup point (Paczkomat parcel locker).</li>
          </UL>

          <SubH>3.2. Data collected automatically</SubH>
          <UL>
            <li>IP address,</li>
            <li>browser type and version,</li>
            <li>operating system,</li>
            <li>data on activity in the Service (pages visited, duration of the visit),</li>
            <li>technical information about the device.</li>
          </UL>

          <SubH>3.3. Transaction data</SubH>
          <UL>
            <li>order history,</li>
            <li>payment data (processed by Stripe),</li>
            <li>information on the balance, purchases and activations of AI tokens (including activated license codes from the box),</li>
            <li>AI Chat conversation history.</li>
          </UL>

          <SubH>3.4. AI assistant chat on the website</SubH>
          <P>When you start a conversation in the chat window on the website (Terms of Service §8), we process:</P>
          <UL>
            <li>the e-mail address provided when starting the conversation,</li>
            <li>the content of your messages and the assistant’s replies, with date and time,</li>
            <li>the address of the subpage from which the message was sent, the page language and information about the browser (user-agent),</li>
            <li>
              <B>only if you have consented to analytics cookies</B>: the course of
              your visit to the website (subpages visited and sections viewed, with times) and a conversation identifier
              added to the Microsoft Clarity session recording — this lets us see what you were looking for
              and answer you better. Without this consent, the course of the visit is not collected.
            </li>
          </UL>
          <P>
            The “I’m not a robot” confirmation performs a calculation in your browser — it does not use the services
            of external companies and does not store cookies. The content of messages is transmitted to the AI model provider
            (see section 6) solely for the purpose of generating a reply.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Purpose and legal basis", title: "Purpose", accent: "of processing",
      body: (
        <>
          <P>An overview of the purposes of processing and the corresponding legal bases under the GDPR.</P>
          <BasisTable
            head={["Purpose of processing", "Legal basis under the GDPR"]}
            rows={[
              ["Performance of the sales contract", "Art. 6(1)(b) GDPR"],
              ["Payment handling", "Art. 6(1)(b) GDPR"],
              ["Provision of the AI Chat service", "Art. 6(1)(b) GDPR"],
              ["AI assistant chat on the website (conversation, e-mail, reply by e-mail)", "Art. 6(1)(b) GDPR (service provided at your request)"],
              ["Review of chat conversations to improve customer service and the assistant", "Art. 6(1)(f) GDPR (legitimate interest)"],
              ["Linking the course of the visit and the Clarity recording to the conversation", "Art. 6(1)(a) GDPR (consent to analytics cookies)"],
              ["Shipping of products", "Art. 6(1)(b) GDPR"],
              ["Handling of complaints", "Art. 6(1)(c) GDPR (legal obligation)"],
              ["Issuing invoices", "Art. 6(1)(c) GDPR (legal obligation)"],
              ["Direct marketing", "Art. 6(1)(f) GDPR (legitimate interest)"],
              ["Analytics and statistics", "Art. 6(1)(f) GDPR (legitimate interest)"],
              ["Newsletter (if consent has been given)", "Art. 6(1)(a) GDPR (consent)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Retention period", title: "Retention", accent: "period",
      body: (
        <>
          <P>
            We store personal data for the periods required by law or for the time
            necessary to achieve the purposes of processing:
          </P>
          <ULWide>
            <li><B>Transaction data and invoices:</B> 5 years from the end of the calendar year in which the tax obligation arose.</li>
            <li><B>Contract data:</B> for the term of the contract and for the period required by law (e.g. 6 years in connection with the limitation period for claims).</li>
            <li><B>Data related to AI tokens</B> (balance, package purchases, activated codes)<B>:</B> for as long as the account exists and for 3 years after its deletion.</li>
            <li><B>AI Chat history:</B> for as long as the account exists (until the user deletes the conversation or the account) and for up to 30 days after the account is deleted.</li>
            <li><B>Marketing data (consent):</B> until consent is withdrawn or an objection is raised.</li>
            <li><B>Analytics data:</B> up to 25 months from the last activity.</li>
            <li><B>Website chat conversations</B> (e-mail, content, course of the visit)<B>:</B> 12 months from the last message in the conversation, after which they are deleted automatically; earlier — at your request.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Data sharing", title: "Data sharing", accent: "",
      body: (
        <>
          <P>Personal data may be disclosed to the following categories of recipients:</P>
          <ULWide>
            <li><B>Stripe</B> – payment operator (processing of payment card transactions, including purchases of AI token packages).</li>
            <li><B>InPost</B> – courier company (delivery of products to Paczkomat parcel lockers).</li>
            <li><B>Resend</B> – e-mail service (sending transactional messages and magic links).</li>
            <li><B>Google AI (Gemini)</B> – provider of the AI Chat service (processing of chatbot queries).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – intermediary providing access to AI models (including Google Gemini); receives the content of messages from the website chat and AI Chat in order to generate replies. We do not share your e-mail address with it.</li>
            <li><B>Microsoft Clarity</B> – analytics tool (heatmaps, session recordings) used only after consent to analytics cookies has been given — see section 9.</li>
            <li><B>Hosting provider</B> – storage of data on VPS servers.</li>
            <li><B>PostgreSQL database provider</B> – storage of user data.</li>
            <li><B>Entities authorized by law</B> – state authorities, courts (where required by law).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              All data recipients act on the basis of agreements entrusting them with the processing of
              personal data and are obliged to keep the data confidential and to apply
              appropriate security measures.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Transfers outside the EEA", title: "Transfers", accent: "outside the EEA",
      body: (
        <>
          <P>
            Some service providers (e.g. Stripe, Google AI, OpenRouter, Microsoft Clarity) may process
            data outside the European Economic Area (EEA). In such cases:
          </P>
          <UL>
            <li>We ensure appropriate safeguards in accordance with the GDPR (standard contractual clauses approved by the European Commission).</li>
            <li>Data are transferred only to countries ensuring an adequate level of data protection or to entities applying appropriate safeguards.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "User rights", title: "User", accent: "rights",
      body: (
        <>
          <P>Under the GDPR, you have the following rights:</P>

          <SubH>8.1. Access to data — Art. 15 GDPR</SubH>
          <P>
            You have the right to obtain confirmation as to whether we process your personal data
            and, if so, to access them and receive a copy.
          </P>

          <SubH>8.2. Rectification — Art. 16 GDPR</SubH>
          <P>
            You have the right to request the prompt rectification of inaccurate data
            or the completion of incomplete data.
          </P>

          <SubH>8.3. Erasure (“right to be forgotten”) — Art. 17 GDPR</SubH>
          <P>In certain cases, you have the right to request the erasure of your personal data.</P>

          <SubH>8.4. Restriction of processing — Art. 18 GDPR</SubH>
          <P>In certain situations, you may request the restriction of the processing of your data.</P>

          <SubH>8.5. Data portability — Art. 20 GDPR</SubH>
          <P>
            You have the right to receive your data in a structured, commonly used and
            machine-readable format and to transmit them to another controller.
          </P>

          <SubH>8.6. Objection — Art. 21 GDPR</SubH>
          <P>
            You have the right to object to the processing of your data for marketing purposes
            or on the basis of a legitimate interest.
          </P>

          <SubH>8.7. Withdrawal of consent — Art. 7(3) GDPR</SubH>
          <P>
            Where processing is based on consent, you have the right to withdraw it
            at any time.
          </P>

          <SubH>8.8. Complaint to the supervisory authority — Art. 77 GDPR</SubH>
          <P>
            You have the right to lodge a complaint with the President of the Personal Data Protection Office (PUODO)
            if you believe that the processing of your data infringes the GDPR.
          </P>
          <InfoBox title="PUODO · contact">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>To exercise the above rights, please contact us by e-mail or via the contact form.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. What cookies are</SubH>
          <P>
            Cookies are small text files stored on the user’s device when
            visiting a website.
          </P>

          <SubH>9.2. Cookies we use</SubH>
          <ULWide>
            <li><B>Necessary</B> — ensure the basic functionality of the website (user session, cart, login).</li>
            <li><B>Functional</B> — remember your preferences (e.g. dark mode).</li>
            <li><B>Analytics</B> — help us understand how users use the website (heatmaps, session recordings, visit statistics). For this purpose we use <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketing</B> — used to personalize ads (only with consent).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity is loaded only after consent to analytics cookies has been given
            in the consent banner (“Accept all”). The tool stores on the device, among others, the
            cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> and <Mono>SM</Mono>, which are used to recognize
            returning users, record sessions and generate heatmaps. The data
            are processed by Microsoft Corporation in accordance with the{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">Microsoft Clarity privacy policy</A>.
            Consent can be withdrawn at any time by clearing the consent banner data
            in your browser settings (localStorage) and selecting “Essential only”.
          </P>

          <SubH>9.4. Browser storage used by the chat</SubH>
          <P>
            The assistant chat stores your conversation identifier in the browser storage (localStorage) so that
            the conversation can be continued after the page is reloaded — this is necessary for the service you request to work,
            and it is removed when you click “End”. Only with consent to analytics cookies does the chat also store in sessionStorage
            (until the tab is closed) the list of visited subpages and sections referred to in point 3.4.
          </P>

          <SubH>9.5. Managing cookies</SubH>
          <P>
            You can manage cookies through your browser settings. Please bear in mind,
            however, that disabling cookies may affect the functionality of the Service
            (e.g. login, shopping cart).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Data security", title: "Security", accent: "",
      body: (
        <>
          <P>
            We apply appropriate technical and organizational measures to protect personal
            data against:
          </P>
          <UL>
            <li>unauthorized access,</li>
            <li>loss,</li>
            <li>destruction,</li>
            <li>unauthorized modification,</li>
            <li>unauthorized distribution.</li>
          </UL>
          <Gap size={5}>
            <P>In particular, we use:</P>
          </Gap>
          <UL>
            <li>SSL/TLS connection encryption (HTTPS),</li>
            <li>secure password storage (salted bcrypt algorithm),</li>
            <li>user session protection (HttpOnly, Secure cookies),</li>
            <li>access to data restricted to authorized persons only,</li>
            <li>regular software and system updates,</li>
            <li>monitoring of infrastructure security,</li>
            <li>regular database backups.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automation and profiling", title: "Automation", accent: "",
      body: (
        <>
          <P>
            Within the Service, we do not use automated decision-making, including
            profiling, that would produce legal effects concerning Users or similarly
            significantly affect them.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) and the assistant in the website chat are support
              tools that answer users’ queries but do not make
              automated decisions with legal effects. The course of the visit linked to the
              conversation (only with consent) is used solely to tailor replies and improve the website.
              We inform you in the chat window that you are talking to an AI.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Children’s data", title: "Children’s", accent: "data",
      body: (
        <>
          <P>
            The KalkMate.pl Service may be used by minors (secondary school
            students). If the user is under 18 years of age, purchasing the calculator and using
            AI Chat requires the consent of a parent or legal guardian.
          </P>
          <Gap>
            <P>
              We do not knowingly collect personal data of children under the age of 13 without
              the consent of their parents/guardians.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Policy changes", title: "Policy", accent: "changes",
      body: (
        <>
          <P>
            This Privacy Policy may be amended due to technological developments,
            changes in the law or changes in the operation of the Service.
          </P>
          <Gap>
            <P>We will inform Users of any material changes via:</P>
          </Gap>
          <UL>
            <li>a notice on the Service’s home page,</li>
            <li>an e-mail message (for registered users).</li>
          </UL>
          <Gap>
            <P>
              The current version of the Privacy Policy is always available at:{" "}
              <A href="/en/polityka-prywatnosci">kalkmate.pl/en/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Contact", title: "Contact", accent: "",
      body: (
        <>
          <P>
            Please direct any questions concerning the processing of personal data and the exercise
            of your rights to:
          </P>
          <UL>
            <li>E-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Phone: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/en/pomoc#kontakt">Contact form</A>{" "}available on the website.</li>
          </UL>
          <Gap size={5}>
            <P>We undertake to respond to your inquiries within 30 days of receipt.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Thank you for your trust and for using KalkMate.pl. We attach particular importance
      to protecting your privacy and the security of your personal data.
    </>
  ),
  footerNote: "Last updated · 2026-10-28 (AI assistant chat on the website)",
  otherDocLabel: "→ Terms of Service",
  homeLabel: "← Home page",
};

export default doc;
