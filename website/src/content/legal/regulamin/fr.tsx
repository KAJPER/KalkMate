import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie francuskie pliku pl.tsx. Wiazaca jest wersja
// polska (pl.tsx); sekcje i kotwice musza zostac takie same jak w oryginale.
const doc: LegalDoc = {
  metaTitle: "Conditions générales de vente : commandes, retours et garantie | KalkMate",
  metaDescription:
    "CGV de la boutique KalkMate : commandes, paiements (Przelewy24, carte), livraison InPost gratuite, 14 jours pour le retour, garantie de 24 mois et chat avec l’assistant IA.",
  badge: "Conforme à la loi polonaise relative aux droits des consommateurs",
  dateLabel: "En vigueur depuis · 2026-01-01",
  eyebrow: "[ cgv ] · 10 sections",
  h1: "Conditions générales",
  h1Accent: "de vente",
  intro: "Règles relatives aux commandes, aux paiements, à la livraison, aux retours et aux réclamations dans la boutique en ligne kalkmate.pl.",
  bindingNote: (
    <>
      Cette traduction est fournie uniquement à titre informatif. Seule la version polonaise des présentes
      CGV fait foi : en cas de divergence entre les deux textes, la{" "}
      <A href="/regulamin">version polonaise</A> prévaut.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Dispositions générales", title: "Dispositions", accent: "générales",
      body: (
        <>
          <P>
            Les présentes conditions générales de vente définissent les règles de vente des produits dans la
            boutique en ligne accessible à l’adresse kalkmate.pl, exploitée par <B>Kacper Popko</B>{" "}
            exerçant une activité commerciale sous la raison sociale <B>KAJPA Kacper Popko</B>,
            ci-après dénommé « le Vendeur ».
          </P>
          <CompanyBox
            rows={[
              { label: "N° fiscal (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Siège social", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Commandes", title: "Commandes", accent: "",
      body: (
        <OL>
          <li>Les commandes sont acceptées via le site internet kalkmate.pl 24 heures sur 24, 7 jours sur 7.</li>
          <li>Passer une commande vaut acceptation des présentes conditions générales de vente.</li>
          <li>Après avoir passé commande, l’Acheteur reçoit une confirmation à l’adresse e-mail indiquée.</li>
          <li>Le Vendeur se réserve le droit de refuser l’exécution d’une commande dans des cas justifiés.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Prix et paiements", title: "Prix", accent: "et paiements",
      body: (
        <OL>
          <li>Tous les prix indiqués sur le site sont des prix TTC (TVA incluse).</li>
          <li>Les paiements sont traités par le service Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Moyens de paiement disponibles : carte de paiement, BLIK, virement bancaire et autres moyens proposés par le service Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Exécution et livraison", title: "Exécution", accent: "et livraison",
      body: (
        <OL>
          <li>Le produit KalkMate est fabriqué sur commande ; il s’agit d’une production propre du Vendeur.</li>
          <li>Le délai d’exécution est de 4 semaines maximum à compter de l’encaissement du paiement. Le délai d’exécution standard est de 1 à 2 semaines.</li>
          <li>La livraison en Pologne est assurée par InPost (consigne automatique Paczkomat). Frais de livraison en Pologne : 0 PLN.</li>
          <li>Livraison à l’étranger (pays de l’UE) : 20 EUR. Livraison hors UE : 35 EUR.</li>
          <li>L’Acheteur reçoit le numéro de suivi du colis après son expédition.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Droit de rétractation", title: "Droit", accent: "de rétractation",
      body: (
        <>
          <P>
            Le Consommateur a le droit de se rétracter d’un contrat conclu à distance dans un délai de 14 jours
            calendaires sans avoir à motiver sa décision, sous réserve de l’exception décrite ci-dessous.
          </P>
          <Callout title="Exception — appareil personnalisé sur commande">
            <CalloutP>
              Chaque exemplaire de l’appareil KalkMate est personnalisé individuellement à la demande du
              Consommateur avant l’expédition : (a) le code de déverrouillage des fonctions IA choisi par le
              Consommateur dans le formulaire de commande y est enregistré et (b) le prénom/pseudo indiqué par
              le Consommateur est imprimé sur l’étiquette de l’exemplaire concerné. Conformément à{" "}
              <B>l’article 38, point 3, de la loi polonaise du 30 mai 2014 relative aux droits des consommateurs</B>,
              le droit de rétractation ne s’applique pas aux biens fabriqués selon les spécifications du
              consommateur ou servant à satisfaire ses besoins individualisés. Cette information ainsi que
              l’exigence d’un consentement distinct sont présentées au Consommateur avant la conclusion du
              contrat, dans le formulaire de commande.
            </CalloutP>
            <CalloutP className="mt-3">
              Cette exception <B>ne s’applique pas</B> aux achats de packs
              (recharges) de tokens IA, pour lesquels le droit de rétractation s’applique selon les règles générales.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Les paragraphes ci-dessous concernent les cas dans lesquels le droit de rétractation s’applique
              (c’est-à-dire les achats autres que l’appareil KalkMate personnalisé) :
            </P>
          </div>
          <OL>
            <li>Le délai de rétractation expire 14 jours après le jour où le Consommateur a pris possession du bien.</li>
            <li>Pour exercer son droit de rétractation, le Consommateur doit informer le Vendeur de sa décision par e-mail à l’adresse : <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Le bien doit être retourné à l’adresse : <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Le remboursement intervient dans un délai de 14 jours maximum à compter de la réception du bien retourné.
              Si le Consommateur a expressément demandé que l’exécution du service (p. ex. les solutions IA) commence
              avant l’expiration du délai de rétractation, le Vendeur est en droit de déduire du montant remboursé
              la rémunération des services effectivement fournis jusqu’au moment de la rétractation (article 35 de la
              loi polonaise relative aux droits des consommateurs) et, dans le cas d’un bien retourné présentant des
              traces d’utilisation allant au-delà de ce qui est nécessaire pour établir la nature et le fonctionnement
              du bien, également un montant correspondant à la diminution de sa valeur (article 34, paragraphe 4, de la
              loi polonaise relative aux droits des consommateurs).
            </li>
            <li>Le droit de réclamation au titre de la garantie légale (rękojmia) et de la garantie commerciale (§6) s’applique indépendamment des dispositions ci-dessus et n’est pas limité par celles-ci.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Réclamations et garantie", title: "Réclamations", accent: "et garantie",
      body: (
        <OL>
          <li>Les produits sont couverts par une garantie du Vendeur d’une durée de 24 mois à compter de la date d’achat.</li>
          <li>Les réclamations doivent être adressées par e-mail à l’adresse : <B>kontakt@kalkmate.pl</B>, en indiquant le numéro de commande et la description du défaut.</li>
          <li>Le Vendeur traite les réclamations dans un délai de 14 jours calendaires maximum.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Protection des données personnelles", title: "Protection", accent: "des données",
      body: (
        <OL>
          <li>Le responsable du traitement des données personnelles est le Vendeur.</li>
          <li>Les données personnelles sont traitées exclusivement aux fins de l’exécution de la commande et ne sont pas communiquées à des tiers, à l’exception des sociétés de transport et des opérateurs de paiement.</li>
          <li>L’Acheteur dispose d’un droit d’accès à ses données, d’un droit de rectification ainsi que du droit d’en demander l’effacement.</li>
          <li>
            Le site utilise des cookies, y compris l’outil d’analyse Microsoft Clarity
            (cartes de chaleur, enregistrements de sessions), chargé uniquement après consentement donné dans le
            bandeau cookies. Les détails figurent dans la{" "}
            <A href="/fr/polityka-prywatnosci#sek-9">Politique de confidentialité</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat avec l’assistant IA", title: "Chat", accent: "avec l’assistant IA",
      body: (
        <OL>
          <li>
            Sur le site kalkmate.pl, le Vendeur met à disposition un service gratuit fourni par voie électronique :
            un chat avec un assistant dont les réponses sont générées par une <B>intelligence artificielle (IA)</B>.
            L’assistant n’est pas un être humain. Il répond aux questions concernant les produits, les commandes et le fonctionnement de la calculatrice.
          </li>
          <li>
            Pour démarrer une conversation, il faut : un navigateur internet avec JavaScript activé, indiquer une
            adresse e-mail, confirmer que l’utilisateur n’est pas un robot (vérification effectuée dans le navigateur)
            et accepter le présent article. Le contrat de fourniture du service est conclu au moment où la conversation
            commence et prend fin au moment où elle se termine (bouton « Terminer » ou fermeture de la page).
            L’utilisateur peut cesser d’utiliser le chat à tout moment.
          </li>
          <li>
            Les réponses de l’assistant ont un caractère purement informatif, peuvent contenir des erreurs et ne
            constituent ni une offre au sens du Code civil polonais, ni une déclaration de volonté du Vendeur. En cas
            de divergence, les présentes conditions générales de vente, la description du produit sur le site et les
            informations communiquées dans la confirmation de commande font foi. L’assistant n’a accès ni aux commandes
            ni aux comptes — les questions relatives à des commandes, retours et réclamations particuliers doivent être
            adressées à kontakt@kalkmate.pl.
          </li>
          <li>
            Le Vendeur peut répondre à une question posée dans le chat par un e-mail envoyé à l’adresse indiquée,
            notamment lorsque l’assistant ne connaît pas la réponse.
          </li>
          <li>
            Il est interdit d’envoyer dans le chat des contenus illicites, injurieux ou portant atteinte aux droits de
            tiers, ainsi que des données particulièrement protégées, des mots de passe, des données de cartes de paiement
            et le code IA de la calculatrice. Le Vendeur peut bloquer une conversation qui enfreint ces règles et
            appliquer des limites au nombre de messages.
          </li>
          <li>
            L’assistant peut proposer de lui-même son aide en affichant un court message à côté du bouton du chat
            (p. ex. après un certain temps passé sur le site ou au niveau de la grille tarifaire). Ce message s’affiche
            au maximum deux fois au cours d’une visite et ne réapparaît pas après avoir été fermé.
          </li>
          <li>
            Le contenu des conversations, l’adresse e-mail et les informations techniques (page depuis laquelle le
            message a été envoyé, navigateur) sont enregistrés et accessibles au Vendeur ainsi qu’aux personnes qu’il
            a autorisées, afin de traiter les questions et d’améliorer le service client. Si l’utilisateur a consenti
            aux cookies analytiques, le déroulement de la visite sur le site (pages consultées et sections vues) ainsi
            que l’identifiant de l’enregistrement de session dans Microsoft Clarity sont également associés à la
            conversation. Les détails, les bases juridiques et la durée de conservation (12 mois à compter du dernier
            message) sont décrits dans la{" "}
            <A href="/fr/polityka-prywatnosci#sek-3">Politique de confidentialité</A>.
          </li>
          <li>
            Les personnes âgées de moins de 16 ans peuvent utiliser le chat avec l’accord d’un parent ou d’un tuteur légal.
          </li>
          <li>
            Les réclamations relatives au fonctionnement du chat peuvent être adressées à kontakt@kalkmate.pl. Le Vendeur
            les traite dans un délai de 14 jours.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Programme de parrainage", title: "Programme", accent: "de parrainage",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Peut participer au programme de parrainage (« Partenaire ») tout utilisateur enregistré du site kalkmate.pl
            dont l’adresse e-mail a été confirmée. Le Partenaire crée dans l’espace client un seul code partenaire
            personnel (de 4 à 16 caractères : lettres A–Z et chiffres).
          </li>
          <li>
            L’Acheteur qui saisit un code partenaire lors de la commande bénéficie d’une <B>remise de 7%</B>{" "}
            sur le prix des produits. Le code partenaire n’est pas cumulable avec d’autres coupons de réduction (le
            formulaire de commande n’accepte qu’un seul code). Le Partenaire ne peut pas utiliser son propre code.
          </li>
          <li>
            Pour chaque commande payée avec le code, le Partenaire perçoit une commission calculée sur la valeur des
            produits après remise, hors frais de livraison. Le taux de commission dépend du niveau du Partenaire,
            déterminé en fonction du nombre d’unités vendues avec son code avant la commande concernée :
            <TierTable
              head={["Niveau", "Unités vendues", "Commission"]}
              rows={[
                ["Départ", "0–2", "5%"],
                ["Bronze", "3–9", "7%"],
                ["Argent", "10–24", "9%"],
                ["Or", "25–49", "11%"],
                ["Diamant", "dès 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Les commissions sont décomptées en zlotys (PLN) ; la valeur des commandes en EUR est convertie au taux fixe de 4,25 PLN pour 1 EUR.
            </span>
          </li>
          <li>
            La commission devient disponible 30 jours après le paiement de la commande. La commission est annulée en
            cas d’annulation de la commande, de remboursement du paiement ou de litige relatif au paiement — y compris
            lorsqu’elle a déjà été échangée ou versée ; le solde du Partenaire peut alors devenir négatif et il est
            compensé par les commissions suivantes.
          </li>
          <li>
            Le Partenaire peut utiliser les fonds disponibles pour : (a) les échanger contre des tokens IA — à partir de
            10 PLN, au taux de 1 PLN = 65 000 tokens, immédiatement ; (b) les retirer par virement sur un compte
            bancaire — à partir de 100 PLN, uniquement si le Partenaire est majeur. Le virement est généralement
            effectué sous 7 jours ouvrés. Avant le versement, le Vendeur peut demander les données nécessaires aux
            obligations fiscales.
          </li>
          <li>
            Sont interdits : l’envoi de spam, l’usurpation de l’identité de KalkMate ou du Vendeur, les annonces sur
            les moteurs de recherche portant sur des mots-clés contenant la marque KalkMate, l’auto-parrainage ainsi que
            la passation de commandes fictives. En cas d’infraction, le Vendeur peut désactiver le code partenaire et
            annuler les commissions indues.
          </li>
          <li>
            Le Vendeur peut modifier les conditions du programme de parrainage moyennant un préavis de 14 jours, en en
            informant sur le site. Les modifications ne s’appliquent pas aux commissions acquises avant leur entrée en vigueur.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Dispositions finales", title: "Dispositions", accent: "finales",
      body: (
        <OL>
          <li>Pour toute question non régie par les présentes conditions générales de vente, les dispositions du Code civil polonais, de la loi polonaise relative aux droits des consommateurs et de la loi polonaise relative à la fourniture de services par voie électronique s’appliquent.</li>
          <li>Le Vendeur se réserve le droit de modifier les conditions générales de vente. Les modifications entrent en vigueur le jour de leur publication sur le site.</li>
          <li>Tout litige sera tranché par le tribunal compétent du lieu du siège du Vendeur.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Merci de votre confiance et de votre achat d’un KalkMate. Pour toute question concernant une commande,
      un retour ou une réclamation, nous restons à votre disposition à l’adresse kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "En vigueur depuis · 2026-01-01 · dernière modification 2026-10-28 (§9 programme de parrainage)",
  otherDocLabel: "→ Politique de confidentialité",
  homeLabel: "← Accueil",
};

export default doc;
