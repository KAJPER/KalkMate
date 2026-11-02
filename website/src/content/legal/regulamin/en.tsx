import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie angielskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Terms of Service: orders, returns and warranty | KalkMate",
  metaDescription:
    "KalkMate shop Terms of Service: orders, payments (Przelewy24, card), free InPost delivery, 14 days to return, 24-month warranty and chat with an AI assistant.",
  badge: "Compliant with the Polish Consumer Rights Act",
  dateLabel: "Effective from · 2026-01-01",
  eyebrow: "[ terms ] · 10 sections",
  h1: "Terms of",
  h1Accent: "Service",
  intro: "Rules for placing orders, payments, delivery, returns and complaints in the kalkmate.pl online shop.",
  bindingNote: (
    <>
      This is a translation provided for convenience. The legally binding version is the Polish one — in case
      of any discrepancy, the <A href="/regulamin">Polish version</A> prevails.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "General provisions", title: "General", accent: "provisions",
      body: (
        <>
          <P>
            These Terms of Service set out the rules for the sale of products in the online shop
            available at kalkmate.pl, operated by <B>Kacper Popko</B>{" "}
            conducting business under the name <B>KAJPA Kacper Popko</B>,
            hereinafter referred to as the “Seller”.
          </P>
          <CompanyBox
            rows={[
              { label: "Tax ID (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Registered address", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Orders", title: "Orders", accent: "",
      body: (
        <OL>
          <li>Orders are accepted through the kalkmate.pl website 24 hours a day, 7 days a week.</li>
          <li>Placing an order constitutes acceptance of these Terms of Service.</li>
          <li>After placing an order, the Buyer receives a confirmation at the e-mail address provided.</li>
          <li>The Seller reserves the right to refuse to fulfill an order in justified cases.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Prices and payments", title: "Prices", accent: "and payments",
      body: (
        <OL>
          <li>All prices shown on the website are gross prices (including VAT).</li>
          <li>Payments are handled by the Przelewy24 service (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Available payment methods: payment card, BLIK, bank transfer and other methods available in the Przelewy24 service.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Fulfillment and delivery", title: "Fulfillment", accent: "and delivery",
      body: (
        <OL>
          <li>The KalkMate product is manufactured to order as the Seller’s own production.</li>
          <li>The fulfillment time is up to 4 weeks from the moment the payment is booked. The standard fulfillment time is 1–2 weeks.</li>
          <li>Delivery within Poland is made via InPost (parcel locker — Paczkomat). Delivery cost within Poland: PLN 0.</li>
          <li>International delivery (EU countries): EUR 20. Delivery outside the EU: EUR 35.</li>
          <li>The Buyer receives the shipment tracking number once the parcel has been dispatched.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Right of withdrawal", title: "Right of", accent: "withdrawal",
      body: (
        <>
          <P>
            The Consumer has the right to withdraw from a distance contract within 14 calendar days
            without giving any reason, subject to the exception described below.
          </P>
          <Callout title="Exception — device personalized to order">
            <CalloutP>
              Each KalkMate device is individually personalized at the Consumer’s request before
              shipping: (a) the AI-feature unlock code chosen by the Consumer in the order form is
              loaded onto it, and (b) the name/nickname provided by the Consumer is printed on the label
              of that unit. Pursuant to{" "}
              <B>Art. 38(3) of the Polish Consumer Rights Act of 30 May 2014</B>,
              the right of withdrawal does not apply to goods manufactured to the consumer’s
              specifications or intended to meet the consumer’s individual needs. This information and
              the requirement to give separate consent are presented to the Consumer before the contract
              is concluded, in the order form.
            </CalloutP>
            <CalloutP className="mt-3">
              This exception <B>does not apply</B> to purchases of AI token
              packages (top-ups), for which the right of withdrawal applies under the general rules.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              The following paragraphs apply to cases in which the right of withdrawal is available
              (i.e. purchases other than a personalized KalkMate device):
            </P>
          </div>
          <OL>
            <li>The withdrawal period expires 14 days after the day on which the Consumer took possession of the goods.</li>
            <li>To exercise the right of withdrawal, the Consumer must inform the Seller of their decision by e-mail at: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Goods should be returned to: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              The payment is refunded within 14 days of the day on which the returned goods are received.
              If the Consumer expressly requested that performance of a service (e.g. AI solutions) begin
              before the end of the withdrawal period, the Seller may deduct from the refund the
              remuneration for services actually performed up to the moment of withdrawal (Art. 35 of the
              Consumer Rights Act), and, in the case of returned goods showing signs of use beyond what is
              necessary to establish the nature and functioning of the goods —
              also an amount corresponding to the reduction in their value (Art. 34(4) of the Consumer Rights Act).
            </li>
            <li>The right to file complaints under the statutory warranty (rękojmia) and the warranty (§6) applies independently of the above provisions and is not limited by them.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Complaints and warranty", title: "Complaints", accent: "and warranty",
      body: (
        <OL>
          <li>Products are covered by the Seller’s warranty for a period of 24 months from the date of purchase.</li>
          <li>Complaints should be submitted by e-mail to: <B>kontakt@kalkmate.pl</B>, stating the order number and a description of the defect.</li>
          <li>The Seller processes complaints within 14 calendar days.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Personal data protection", title: "Data", accent: "protection",
      body: (
        <OL>
          <li>The controller of personal data is the Seller.</li>
          <li>Personal data are processed solely for the purpose of fulfilling the order and are not disclosed to third parties, except for courier companies and payment operators.</li>
          <li>The Buyer has the right to access their data, have it rectified and request its deletion.</li>
          <li>
            The website uses cookies, including the Microsoft Clarity analytics tool
            (heatmaps, session recordings), which is loaded only after consent is given in the cookie
            banner. Details can be found in the{" "}
            <A href="/en/polityka-prywatnosci#sek-9">Privacy Policy</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "AI assistant chat", title: "Chat", accent: "with the AI assistant",
      body: (
        <OL>
          <li>
            On the kalkmate.pl website, the Seller provides a free service by electronic means:
            a chat with an assistant whose answers are generated by <B>artificial intelligence (AI)</B>.
            The assistant is not a human. It answers questions about products, orders and how the calculator works.
          </li>
          <li>
            To start a conversation, the following are required: a web browser with JavaScript enabled, providing
            an e-mail address, confirming that the user is not a bot (verification performed in the browser), and
            accepting this section. The service agreement is concluded when the conversation starts
            and terminates when it ends (the “End” button or closing the page). The user may
            stop using the chat at any time.
          </li>
          <li>
            The assistant’s answers are for information purposes only, may contain errors and do not constitute an
            offer within the meaning of the Polish Civil Code or a declaration of intent by the Seller. In the event of
            any discrepancy, these Terms of Service, the product description on the website and the information
            provided in the order confirmation are binding. The assistant has no access to orders or accounts —
            matters concerning specific orders, returns and complaints should be directed
            to kontakt@kalkmate.pl.
          </li>
          <li>
            The Seller may reply to a question from the chat by e-mail to the address provided, in particular when
            the assistant does not know the answer.
          </li>
          <li>
            It is prohibited to send in the chat any content that is unlawful, offensive or infringes the rights of
            third parties, as well as specially protected data, passwords, payment card details and the calculator’s
            AI code. The Seller may block a conversation that violates these rules and apply limits on the number of messages.
          </li>
          <li>
            The assistant may offer help on its own initiative by displaying a short message next to the chat button
            (e.g. after some time on the page or at the price list). Such a message appears no more than twice during
            a visit and does not appear again once it has been closed.
          </li>
          <li>
            The content of conversations, the e-mail address and technical information (the page from which the
            message was sent, the browser) are stored and accessible to the Seller and persons authorized by the
            Seller for the purpose of handling questions and improving customer service. If the user has consented to
            analytics cookies, the course of the visit to the website (pages visited and sections viewed) and the
            Microsoft Clarity session recording identifier are also linked to the conversation. Details, legal bases
            and the retention period (12 months from the last message) are described in the{" "}
            <A href="/en/polityka-prywatnosci#sek-3">Privacy Policy</A>.
          </li>
          <li>
            Persons under the age of 16 may use the chat with the consent of a parent or legal guardian.
          </li>
          <li>
            Complaints concerning the operation of the chat may be submitted to kontakt@kalkmate.pl. The Seller
            processes them within 14 days.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Referral program", title: "Referral", accent: "program",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Any registered user of the kalkmate.pl service with a verified e-mail address may participate in the
            referral program (the “Partner”). The Partner creates one personal referral code in the customer panel
            (4 to 16 characters: letters A–Z and digits).
          </li>
          <li>
            A Buyer who enters a referral code when placing an order receives a <B>7% discount</B>{" "}
            on the price of the products. The referral code cannot be combined with other discount coupons (the order
            form accepts one code). A Partner may not use their own code.
          </li>
          <li>
            For each paid order placed with the code, the Partner receives a commission calculated on the value of the
            products after the discount, excluding delivery costs. The commission rate depends on the Partner’s tier,
            which is determined by the number of units sold with their code before the given order:
            <TierTable
              head={["Tier", "Units sold", "Commission"]}
              rows={[
                ["Start", "0–2", "5%"],
                ["Bronze", "3–9", "7%"],
                ["Silver", "10–24", "9%"],
                ["Gold", "25–49", "11%"],
                ["Diamond", "from 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Commissions are settled in Polish zloty (PLN); the value of orders in EUR is converted at a fixed rate of PLN 4.25 per EUR 1.
            </span>
          </li>
          <li>
            A commission becomes available 30 days after the order has been paid. A commission is reversed if the
            order is cancelled, the payment is refunded or there is a payment dispute — also when it has already been
            exchanged or paid out; the Partner’s balance may then become negative and is offset against subsequent commissions.
          </li>
          <li>
            The Partner may: (a) exchange available funds for AI tokens — from PLN 10, at a rate of PLN 1 = 65,000 tokens,
            immediately; (b) withdraw them by bank transfer to a bank account — from PLN 100, only if the Partner is of
            legal age. Payouts are usually made within 7 business days. Before a payout, the Seller may
            request the data necessary for tax settlements.
          </li>
          <li>
            The following are prohibited: sending spam, impersonating KalkMate or the Seller, search engine advertising
            on keywords containing the KalkMate brand, self-referral and placing fictitious orders. In the event of
            violations, the Seller may deactivate the referral code and cancel commissions that are not due.
          </li>
          <li>
            The Seller may change the terms of the referral program with 14 days’ notice, announcing this on the website.
            Changes do not apply to commissions accrued before they take effect.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Final provisions", title: "Final", accent: "provisions",
      body: (
        <OL>
          <li>In matters not regulated by these Terms of Service, the provisions of the Polish Civil Code, the Consumer Rights Act and the Act on Providing Services by Electronic Means apply.</li>
          <li>The Seller reserves the right to amend these Terms of Service. Amendments take effect on the date of their publication on the website.</li>
          <li>Any disputes will be settled by the court having jurisdiction over the Seller’s registered office.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Thank you for your trust and for buying KalkMate. If you have any questions about your order,
      a return or a complaint — we are at hand at kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Effective from · 2026-01-01 · last amended 2026-10-28 (§9 referral program)",
  otherDocLabel: "→ Privacy Policy",
  homeLabel: "← Home page",
};

export default doc;
