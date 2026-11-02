import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie francuskie pliku pl.tsx. Wiazaca jest
// wersja polska (pl.tsx); sekcje i kotwice musza zostac takie same jak w oryginale.
const doc: LegalDoc = {
  metaTitle: "Politique de confidentialité : RGPD et cookies | KalkMate",
  metaDescription:
    "Comment KalkMate protège vos données : ce que nous collectons et pourquoi, combien de temps nous les conservons, cookies et Microsoft Clarity, chat avec l’IA et vos droits au titre du RGPD.",
  badge: "RGPD · conforme au règlement (UE) 2016/679",
  dateLabel: "Mise à jour · 2026-10-28",
  eyebrow: "[ confidentialité ] · 14 sections",
  h1: "Politique",
  h1Accent: "de confidentialité",
  intro: "Quelles données nous collectons, pourquoi nous les traitons, qui y a accès et comment vous pouvez exercer vos droits. Conformément au RGPD.",
  bindingNote: (
    <>
      Cette traduction est fournie uniquement à titre informatif. Seule la version polonaise de la présente
      politique de confidentialité fait foi : en cas de divergence entre les deux textes, la{" "}
      <A href="/polityka-prywatnosci">version polonaise</A> prévaut.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Dispositions générales", title: "Dispositions", accent: "générales",
      body: (
        <>
          <P>
            La présente Politique de confidentialité définit les règles de traitement et de protection des données
            personnelles des Utilisateurs du site KalkMate.pl (ci-après : « le Site »), exploité par
            KalkMate (ci-après : « le Responsable du traitement »).
          </P>
          <Gap>
            <P>
              Le Responsable du traitement attache une importance particulière au respect de la vie privée des
              Utilisateurs et à la sécurité de leurs données personnelles. Les données personnelles sont traitées
              conformément au Règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016
              (RGPD) ainsi qu’aux dispositions du droit national.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Responsable du traitement", title: "Responsable", accent: "du traitement",
      body: (
        <>
          <P>Le responsable du traitement des données personnelles collectées via le Site est :</P>
          <CompanyBox
            rows={[
              { label: "N° fiscal (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Siège social", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Nom abrégé", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Téléphone", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Vous pouvez contacter le Responsable du traitement pour toute question relative au traitement des données personnelles :</P>
          </Gap>
          <UL>
            <li>par e-mail : <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>par téléphone : <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>via le formulaire de contact disponible sur le site.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Données collectées", title: "Données", accent: "collectées",
      body: (
        <>
          <P>Dans le cadre de l’activité du Site, nous collectons les catégories de données personnelles suivantes :</P>

          <SubH>3.1. Données fournies par l’utilisateur</SubH>
          <UL>
            <li>nom et prénom,</li>
            <li>adresse e-mail,</li>
            <li>numéro de téléphone,</li>
            <li>adresse du point de retrait InPost (consigne automatique Paczkomat).</li>
          </UL>

          <SubH>3.2. Données collectées automatiquement</SubH>
          <UL>
            <li>adresse IP,</li>
            <li>type et version du navigateur,</li>
            <li>système d’exploitation,</li>
            <li>données relatives à l’activité sur le Site (pages visitées, durée de la visite),</li>
            <li>informations techniques sur l’appareil.</li>
          </UL>

          <SubH>3.3. Données transactionnelles</SubH>
          <UL>
            <li>historique des commandes,</li>
            <li>données de paiement (traitées par Stripe),</li>
            <li>informations sur le solde, les achats et les activations de tokens IA (y compris les codes de licence fournis dans la boîte et activés),</li>
            <li>historique des conversations avec AI Chat.</li>
          </UL>

          <SubH>3.4. Chat avec l’assistant IA sur le site</SubH>
          <P>Lorsque vous démarrez une conversation dans la fenêtre de chat du site (CGV §8), nous traitons :</P>
          <UL>
            <li>l’adresse e-mail indiquée au début de la conversation,</li>
            <li>le contenu de vos messages et des réponses de l’assistant, avec la date et l’heure,</li>
            <li>l’adresse de la page depuis laquelle le message a été envoyé, la langue de la page et des informations sur le navigateur (user-agent),</li>
            <li>
              <B>uniquement si vous avez consenti aux cookies analytiques</B> : le déroulement
              de la visite sur le site (pages consultées et sections vues, avec l’heure) ainsi que l’identifiant de la
              conversation ajouté à l’enregistrement de session dans Microsoft Clarity — cela nous permet de voir ce que
              vous cherchiez et de mieux vous répondre. Sans ce consentement, le déroulement de la visite n’est pas collecté.
            </li>
          </UL>
          <P>
            La confirmation « Je ne suis pas un robot » effectue un calcul dans votre navigateur — elle ne fait appel à
            aucun service de sociétés tierces et n’enregistre pas de cookies. Le contenu des messages est transmis au
            fournisseur du modèle d’IA (voir section 6) uniquement afin de générer la réponse.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Finalités et base juridique", title: "Finalités", accent: "du traitement",
      body: (
        <>
          <P>Aperçu des finalités du traitement et des bases juridiques correspondantes au titre du RGPD.</P>
          <BasisTable
            head={["Finalité du traitement", "Base juridique (RGPD)"]}
            rows={[
              ["Exécution du contrat de vente", "Art. 6, par. 1, point b), du RGPD"],
              ["Traitement des paiements", "Art. 6, par. 1, point b), du RGPD"],
              ["Fourniture du service AI Chat", "Art. 6, par. 1, point b), du RGPD"],
              ["Chat avec l’assistant IA sur le site (conversation, e-mail, réponse par e-mail)", "Art. 6, par. 1, point b), du RGPD (service fourni à votre demande)"],
              ["Examen des conversations du chat afin d’améliorer le service client et l’assistant", "Art. 6, par. 1, point f), du RGPD (intérêt légitime)"],
              ["Association du déroulement de la visite et de l’enregistrement Clarity à la conversation", "Art. 6, par. 1, point a), du RGPD (consentement aux cookies analytiques)"],
              ["Expédition des produits", "Art. 6, par. 1, point b), du RGPD"],
              ["Traitement des réclamations", "Art. 6, par. 1, point c), du RGPD (obligation légale)"],
              ["Émission des factures", "Art. 6, par. 1, point c), du RGPD (obligation légale)"],
              ["Marketing direct", "Art. 6, par. 1, point f), du RGPD (intérêt légitime)"],
              ["Analyses et statistiques", "Art. 6, par. 1, point f), du RGPD (intérêt légitime)"],
              ["Newsletter (en cas de consentement)", "Art. 6, par. 1, point a), du RGPD (consentement)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Durée de conservation", title: "Durée", accent: "de conservation",
      body: (
        <>
          <P>
            Nous conservons les données personnelles pendant les durées prévues par la loi ou pendant le temps
            nécessaire à la réalisation des finalités du traitement :
          </P>
          <ULWide>
            <li><B>Données transactionnelles et factures :</B> 5 ans à compter de la fin de l’année civile au cours de laquelle l’obligation fiscale est née.</li>
            <li><B>Données relatives au contrat :</B> pendant la durée du contrat et pendant la durée exigée par la loi (p. ex. 6 ans en raison de la prescription des créances).</li>
            <li><B>Données liées aux tokens IA</B> (solde, achats de packs, codes activés)<B> :</B> pendant toute la durée d’existence du compte et 3 ans après sa suppression.</li>
            <li><B>Historique AI Chat :</B> pendant toute la durée d’existence du compte (jusqu’à la suppression de la conversation ou du compte par l’utilisateur) et jusqu’à 30 jours après la suppression du compte.</li>
            <li><B>Données marketing (consentement) :</B> jusqu’au retrait du consentement ou jusqu’à l’exercice du droit d’opposition.</li>
            <li><B>Données analytiques :</B> jusqu’à 25 mois à compter de la dernière activité.</li>
            <li><B>Conversations du chat sur le site</B> (e-mail, contenu, déroulement de la visite)<B> :</B> 12 mois à compter du dernier message de la conversation, puis suppression automatique ; plus tôt — à votre demande.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Communication des données", title: "Destinataires", accent: "",
      body: (
        <>
          <P>Les données personnelles peuvent être communiquées aux catégories de destinataires suivantes :</P>
          <ULWide>
            <li><B>Stripe</B> – opérateur de paiement (traitement des transactions par carte de paiement, y compris les achats de packs de tokens IA).</li>
            <li><B>InPost</B> – société de transport (livraison des produits dans les consignes automatiques Paczkomat).</li>
            <li><B>Resend</B> – service d’e-mail (envoi des messages transactionnels et des liens de connexion « magic links »).</li>
            <li><B>Google AI (Gemini)</B> – fournisseur du service AI Chat (traitement des requêtes dans le chatbot).</li>
            <li><B>OpenRouter, Inc.</B> (États-Unis) – intermédiaire pour l’accès aux modèles d’IA (notamment Google Gemini) ; reçoit le contenu des messages du chat sur le site et d’AI Chat afin de générer les réponses. Nous ne lui transmettons pas l’adresse e-mail.</li>
            <li><B>Microsoft Clarity</B> – outil d’analyse (cartes de chaleur, enregistrements de sessions) utilisé uniquement après consentement aux cookies analytiques — voir section 9.</li>
            <li><B>Fournisseur d’hébergement</B> – stockage des données sur des serveurs VPS.</li>
            <li><B>Fournisseur de la base de données PostgreSQL</B> – stockage des données des utilisateurs.</li>
            <li><B>Entités habilitées par la loi</B> – autorités publiques, tribunaux (si la loi l’exige).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Tous les destinataires des données agissent sur la base de contrats de sous-traitance du traitement
              des données personnelles et sont tenus d’en préserver la confidentialité et d’appliquer des mesures
              de sécurité appropriées.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Transferts hors EEE", title: "Transferts", accent: "hors EEE",
      body: (
        <>
          <P>
            Certains prestataires de services (p. ex. Stripe, Google AI, OpenRouter, Microsoft Clarity) peuvent traiter
            des données en dehors de l’Espace économique européen (EEE). Dans ce cas :
          </P>
          <UL>
            <li>Nous mettons en place des garanties appropriées conformément au RGPD (clauses contractuelles types approuvées par la Commission européenne).</li>
            <li>Le transfert n’a lieu que vers des pays assurant un niveau de protection adéquat des données ou vers des entités offrant des garanties appropriées.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Droits des utilisateurs", title: "Droits", accent: "des utilisateurs",
      body: (
        <>
          <P>Conformément au RGPD, vous disposez des droits suivants :</P>

          <SubH>8.1. Droit d’accès — art. 15 du RGPD</SubH>
          <P>
            Vous avez le droit d’obtenir la confirmation que des données personnelles vous concernant sont ou ne sont
            pas traitées et, lorsqu’elles le sont, d’y accéder et d’en obtenir une copie.
          </P>

          <SubH>8.2. Rectification — art. 16 du RGPD</SubH>
          <P>
            Vous avez le droit d’obtenir sans délai la rectification des données inexactes ou de faire compléter
            les données incomplètes.
          </P>

          <SubH>8.3. Effacement (« droit à l’oubli ») — art. 17 du RGPD</SubH>
          <P>Dans certains cas, vous avez le droit d’exiger l’effacement de vos données personnelles.</P>

          <SubH>8.4. Limitation du traitement — art. 18 du RGPD</SubH>
          <P>Dans certaines situations, vous pouvez exiger la limitation du traitement de vos données.</P>

          <SubH>8.5. Portabilité des données — art. 20 du RGPD</SubH>
          <P>
            Vous avez le droit de recevoir vos données dans un format structuré, couramment utilisé et lisible
            par machine, et de les transmettre à un autre responsable du traitement.
          </P>

          <SubH>8.6. Opposition — art. 21 du RGPD</SubH>
          <P>
            Vous avez le droit de vous opposer au traitement de vos données à des fins de marketing
            ou sur la base d’un intérêt légitime.
          </P>

          <SubH>8.7. Retrait du consentement — art. 7, par. 3, du RGPD</SubH>
          <P>
            Lorsque le traitement est fondé sur le consentement, vous avez le droit de le retirer
            à tout moment.
          </P>

          <SubH>8.8. Réclamation auprès de l’autorité de contrôle — art. 77 du RGPD</SubH>
          <P>
            Vous avez le droit d’introduire une réclamation auprès du Président de l’Office polonais de protection des
            données personnelles (PUODO) si vous estimez que le traitement de vos données enfreint les dispositions du RGPD.
          </P>
          <InfoBox title="PUODO · contact">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Pour exercer les droits ci-dessus, veuillez nous contacter par e-mail ou via le formulaire de contact.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Que sont les cookies</SubH>
          <P>
            Les cookies sont de petits fichiers texte enregistrés sur l’appareil de l’utilisateur lors de la
            consultation d’un site internet.
          </P>

          <SubH>9.2. Quels cookies utilisons-nous</SubH>
          <ULWide>
            <li><B>Nécessaires</B> — assurent les fonctionnalités de base du site (session utilisateur, panier, connexion).</li>
            <li><B>Fonctionnels</B> — mémorisent vos préférences (p. ex. le mode sombre).</li>
            <li><B>Analytiques</B> — nous aident à comprendre comment les utilisateurs utilisent le site (cartes de chaleur, enregistrements de sessions, statistiques de visites). Nous utilisons pour cela <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketing</B> — utilisés pour personnaliser les publicités (uniquement avec votre consentement).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity n’est chargé qu’après consentement aux cookies analytiques
            dans le bandeau de consentement (« Tout accepter »). L’outil enregistre sur l’appareil notamment
            les cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> et <Mono>SM</Mono>, qui servent à reconnaître un
            utilisateur qui revient sur le site, à enregistrer les sessions et à générer des cartes de chaleur. Les données
            sont traitées par Microsoft Corporation conformément à la{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">politique de confidentialité de Microsoft Clarity</A>.
            Le consentement peut être retiré à tout moment en effaçant les données du bandeau de consentement
            dans les paramètres du navigateur (localStorage) et en choisissant « Essentiels uniquement ».
          </P>

          <SubH>9.4. Stockage du navigateur utilisé par le chat</SubH>
          <P>
            Le chat avec l’assistant enregistre dans le stockage du navigateur (localStorage) l’identifiant de votre
            conversation afin de pouvoir la poursuivre après le rechargement de la page — cela est nécessaire au
            fonctionnement du service que vous demandez et disparaît après un clic sur « Terminer ». Uniquement après
            consentement aux cookies analytiques, le chat enregistre également dans le sessionStorage (jusqu’à la
            fermeture de l’onglet) la liste des pages et sections visitées mentionnée au point 3.4.
          </P>

          <SubH>9.5. Gestion des cookies</SubH>
          <P>
            Vous pouvez gérer les cookies via les paramètres de votre navigateur. Il convient toutefois de
            garder à l’esprit que la désactivation des cookies peut affecter le fonctionnement du Site
            (p. ex. la connexion, le panier d’achat).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Sécurité des données", title: "Sécurité", accent: "",
      body: (
        <>
          <P>
            Nous appliquons des mesures techniques et organisationnelles appropriées afin de protéger les données
            personnelles contre :
          </P>
          <UL>
            <li>l’accès non autorisé,</li>
            <li>la perte,</li>
            <li>la destruction,</li>
            <li>la modification non autorisée,</li>
            <li>la diffusion non autorisée.</li>
          </UL>
          <Gap size={5}>
            <P>Nous utilisons notamment :</P>
          </Gap>
          <UL>
            <li>le chiffrement des connexions SSL/TLS (HTTPS),</li>
            <li>le stockage sécurisé des mots de passe (algorithme bcrypt avec sel),</li>
            <li>la sécurisation des sessions utilisateur (cookies HttpOnly, Secure),</li>
            <li>la limitation de l’accès aux données aux seules personnes autorisées,</li>
            <li>des mises à jour régulières des logiciels et du système,</li>
            <li>la surveillance de la sécurité de l’infrastructure,</li>
            <li>des sauvegardes régulières de la base de données.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatisation et profilage", title: "Automatisation", accent: "",
      body: (
        <>
          <P>
            Dans le cadre du Site, nous n’avons pas recours à la prise de décision automatisée, y compris le
            profilage, qui produirait des effets juridiques à l’égard des Utilisateurs ou les affecterait de manière
            significative de façon similaire.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) et l’assistant du chat sur le site sont des outils d’assistance qui
              répondent aux requêtes des utilisateurs, mais ne prennent pas de décisions automatisées produisant
              des effets juridiques. Le déroulement de la visite associé à la conversation (uniquement avec
              consentement) sert exclusivement à adapter les réponses et à améliorer le site.
              Nous vous informons dans la fenêtre du chat que vous conversez avec une IA.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Données des enfants", title: "Données", accent: "des enfants",
      body: (
        <>
          <P>
            Le Site KalkMate.pl peut être utilisé par des personnes mineures (élèves de l’enseignement
            secondaire). Si l’utilisateur a moins de 18 ans, l’achat de la calculatrice et l’utilisation
            d’AI Chat nécessitent le consentement d’un parent ou d’un tuteur légal.
          </P>
          <Gap>
            <P>
              Nous ne collectons pas sciemment de données personnelles d’enfants de moins de 13 ans sans le
              consentement de leurs parents/tuteurs.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Modifications de la politique", title: "Modifications", accent: "de la politique",
      body: (
        <>
          <P>
            La Politique de confidentialité peut être modifiée en raison de l’évolution des technologies,
            de modifications de la législation ou de changements dans l’activité du Site.
          </P>
          <Gap>
            <P>Nous informerons les Utilisateurs de toute modification importante par :</P>
          </Gap>
          <UL>
            <li>un message sur la page d’accueil du Site,</li>
            <li>un e-mail (pour les utilisateurs enregistrés).</li>
          </UL>
          <Gap>
            <P>
              La version en vigueur de la Politique de confidentialité est toujours disponible à l’adresse :{" "}
              <A href="/fr/polityka-prywatnosci">kalkmate.pl/fr/polityka-prywatnosci</A>
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
            Pour toute question relative au traitement des données personnelles et à l’exercice des droits
            dont vous disposez, veuillez nous contacter :
          </P>
          <UL>
            <li>E-mail : <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Téléphone : <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/fr/pomoc#kontakt">Formulaire de contact</A>{" "}disponible sur le site.</li>
          </UL>
          <Gap size={5}>
            <P>Nous nous engageons à répondre à vos demandes dans un délai de 30 jours à compter de leur réception.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Merci de votre confiance et d’utiliser KalkMate.pl. Nous attachons une importance particulière
      à la protection de votre vie privée et à la sécurité de vos données personnelles.
    </>
  ),
  footerNote: "Dernière mise à jour · 2026-10-28 (chat avec l’assistant IA sur le site)",
  otherDocLabel: "→ Conditions générales de vente",
  homeLabel: "← Accueil",
};

export default doc;
