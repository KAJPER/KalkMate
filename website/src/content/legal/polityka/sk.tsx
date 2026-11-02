import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie slowackie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Ochrana osobných údajov: GDPR a cookies | KalkMate",
  metaDescription:
    "Ako KalkMate chráni vaše údaje: čo zbierame a prečo, ako dlho ich uchovávame, cookies a Microsoft Clarity, chat s AI a vaše práva podľa GDPR.",
  badge: "GDPR · v súlade s nariadením EÚ 2016/679",
  dateLabel: "Aktualizácia · 2026-10-28",
  eyebrow: "[ súkromie ] · 14 sekcií",
  h1: "Ochrana",
  h1Accent: "osobných údajov",
  intro: "Aké údaje zbierame, prečo ich spracúvame, kto k nim má prístup a ako môžete uplatniť svoje práva. V súlade s GDPR.",
  bindingNote: (
    <>
      Tento preklad slúži iba pre vaše pohodlie. Právne záväzné je znenie v poľskom jazyku — v prípade
      rozporu má prednosť <A href="/polityka-prywatnosci">poľská verzia</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Všeobecné ustanovenia", title: "Všeobecné", accent: "ustanovenia",
      body: (
        <>
          <P>
            Tieto zásady ochrany osobných údajov stanovujú pravidlá spracúvania a ochrany osobných údajov
            Používateľov, ktorí používajú službu KalkMate.pl (ďalej len „Služba“), ktorú prevádzkuje
            KalkMate (ďalej len „Prevádzkovateľ“).
          </P>
          <Gap>
            <P>
              Prevádzkovateľ kladie osobitný dôraz na rešpektovanie súkromia Používateľov
              a bezpečnosť ich osobných údajov. Osobné údaje sa spracúvajú v súlade
              s nariadením Európskeho parlamentu a Rady (EÚ) 2016/679 z 27. apríla 2016
              (všeobecné nariadenie o ochrane údajov, GDPR) a s predpismi vnútroštátneho práva.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Prevádzkovateľ údajov", title: "Prevádzkovateľ", accent: "údajov",
      body: (
        <>
          <P>Prevádzkovateľom osobných údajov získavaných prostredníctvom Služby je:</P>
          <CompanyBox
            rows={[
              { label: "DIČ (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Adresa sídla", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Skrátený názov", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefón", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Prevádzkovateľa môžete vo veciach spracúvania osobných údajov kontaktovať:</P>
          </Gap>
          <UL>
            <li>e-mailom: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefonicky: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>prostredníctvom kontaktného formulára dostupného na stránke.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Rozsah získavaných údajov", title: "Rozsah", accent: "údajov",
      body: (
        <>
          <P>V rámci prevádzky Služby získavame tieto kategórie osobných údajov:</P>

          <SubH>3.1. Údaje poskytnuté používateľom</SubH>
          <UL>
            <li>meno a priezvisko,</li>
            <li>e-mailová adresa,</li>
            <li>telefónne číslo,</li>
            <li>adresa výdajného miesta InPost (výdajný box Paczkomat).</li>
          </UL>

          <SubH>3.2. Automaticky získavané údaje</SubH>
          <UL>
            <li>IP adresa,</li>
            <li>typ a verzia prehliadača,</li>
            <li>operačný systém,</li>
            <li>údaje o aktivite v Službe (navštívené stránky, čas návštevy),</li>
            <li>technické informácie o zariadení.</li>
          </UL>

          <SubH>3.3. Transakčné údaje</SubH>
          <UL>
            <li>história objednávok,</li>
            <li>platobné údaje (spracúvané spoločnosťou Stripe),</li>
            <li>informácie o zostatku, nákupoch a aktiváciách AI tokenov (vrátane aktivovaných licenčných kódov zo škatuľky),</li>
            <li>história konverzácií s AI Chat.</li>
          </UL>

          <SubH>3.4. Chat s AI asistentom na stránke</SubH>
          <P>Keď začnete konverzáciu v okne chatu na stránke (obchodné podmienky §8), spracúvame:</P>
          <UL>
            <li>e-mailovú adresu uvedenú pri začatí konverzácie,</li>
            <li>obsah vašich správ a odpovedí asistenta, s dátumom a časom,</li>
            <li>adresu podstránky, z ktorej bola správa odoslaná, jazyk stránky a informácie o prehliadači (user-agent),</li>
            <li>
              <B>iba ak ste udelili súhlas s analytickými cookies</B>: priebeh
              návštevy stránky (navštívené podstránky a zobrazené sekcie, s časom) a identifikátor konverzácie
              pripájaný k záznamu relácie v Microsoft Clarity — vďaka tomu vidíme, čo ste hľadali,
              a môžeme lepšie odpovedať. Bez tohto súhlasu sa priebeh návštevy nezbiera.
            </li>
          </UL>
          <P>
            Potvrdenie „Nie som robot“ vykonáva výpočet vo vašom prehliadači — nevyužíva služby
            externých firiem a neukladá cookies. Obsah správ sa odovzdáva poskytovateľovi modelu AI
            (pozri sekciu 6) výlučne na účel vygenerovania odpovede.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Účel a právny základ", title: "Účel", accent: "spracúvania",
      body: (
        <>
          <P>Prehľad účelov spracúvania a im zodpovedajúcich právnych základov podľa GDPR.</P>
          <BasisTable
            head={["Účel spracúvania", "Právny základ podľa GDPR"]}
            rows={[
              ["Plnenie kúpnej zmluvy", "Čl. 6 ods. 1 písm. b) GDPR"],
              ["Spracovanie platieb", "Čl. 6 ods. 1 písm. b) GDPR"],
              ["Poskytovanie služby AI Chat", "Čl. 6 ods. 1 písm. b) GDPR"],
              ["Chat s AI asistentom na stránke (konverzácia, e-mail, odpoveď e-mailom)", "Čl. 6 ods. 1 písm. b) GDPR (služba na vašu žiadosť)"],
              ["Kontrola konverzácií z chatu na účel zlepšovania podpory a asistenta", "Čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem)"],
              ["Priradenie priebehu návštevy a záznamu Clarity ku konverzácii", "Čl. 6 ods. 1 písm. a) GDPR (súhlas s analytickými cookies)"],
              ["Odosielanie produktov", "Čl. 6 ods. 1 písm. b) GDPR"],
              ["Vybavovanie reklamácií", "Čl. 6 ods. 1 písm. c) GDPR (zákonná povinnosť)"],
              ["Vystavovanie faktúr", "Čl. 6 ods. 1 písm. c) GDPR (zákonná povinnosť)"],
              ["Priamy marketing", "Čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem)"],
              ["Analytika a štatistiky", "Čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem)"],
              ["Newsletter (ak bol udelený súhlas)", "Čl. 6 ods. 1 písm. a) GDPR (súhlas)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Doba uchovávania", title: "Doba", accent: "uchovávania",
      body: (
        <>
          <P>
            Osobné údaje uchovávame počas obdobia vyžadovaného právnymi predpismi alebo počas doby
            potrebnej na dosiahnutie účelov spracúvania:
          </P>
          <ULWide>
            <li><B>Transakčné údaje a faktúry:</B> 5 rokov od konca kalendárneho roka, v ktorom vznikla daňová povinnosť.</li>
            <li><B>Údaje týkajúce sa zmluvy:</B> počas trvania zmluvy a počas doby vyžadovanej právnymi predpismi (napr. 6 rokov v súvislosti s premlčaním nárokov).</li>
            <li><B>Údaje súvisiace s AI tokenmi</B> (zostatok, nákupy balíkov, aktivované kódy)<B>:</B> počas existencie účtu a 3 roky po jeho zrušení.</li>
            <li><B>História AI Chat:</B> počas existencie účtu (do vymazania konverzácie alebo účtu používateľom) a do 30 dní po zrušení účtu.</li>
            <li><B>Marketingové údaje (súhlas):</B> do odvolania súhlasu alebo podania námietky.</li>
            <li><B>Analytické údaje:</B> do 25 mesiacov od poslednej aktivity.</li>
            <li><B>Konverzácie z chatu na stránke</B> (e-mail, obsah, priebeh návštevy)<B>:</B> 12 mesiacov od poslednej správy v konverzácii, potom sa automaticky vymažú; skôr — na vašu žiadosť.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Sprístupnenie údajov", title: "Sprístupnenie", accent: "",
      body: (
        <>
          <P>Osobné údaje môžu byť sprístupnené týmto kategóriám príjemcov:</P>
          <ULWide>
            <li><B>Stripe</B> – prevádzkovateľ platieb (spracovanie transakcií platobnými kartami vrátane nákupov balíkov AI tokenov).</li>
            <li><B>InPost</B> – kuriérska spoločnosť (doručovanie produktov do výdajných boxov Paczkomat).</li>
            <li><B>Resend</B> – e-mailová služba (odosielanie transakčných správ a prihlasovacích odkazov typu magic link).</li>
            <li><B>Google AI (Gemini)</B> – poskytovateľ služby AI Chat (spracovanie otázok v chatbote).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – sprostredkovateľ prístupu k modelom AI (okrem iného Google Gemini); dostáva obsah správ z chatu na stránke a z AI Chat na účel vygenerovania odpovede. E-mailovú adresu mu neodovzdávame.</li>
            <li><B>Microsoft Clarity</B> – analytický nástroj (teplotné mapy, záznamy relácií) používaný výlučne po udelení súhlasu s analytickými cookies — pozri sekciu 9.</li>
            <li><B>Poskytovateľ hostingu</B> – ukladanie údajov na serveroch VPS.</li>
            <li><B>Poskytovateľ databázy PostgreSQL</B> – ukladanie údajov používateľov.</li>
            <li><B>Subjekty oprávnené na základe zákona</B> – štátne orgány, súdy (ak to vyžadujú právne predpisy).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Všetci príjemcovia údajov konajú na základe zmlúv o spracúvaní
              osobných údajov a sú povinní zachovávať ich dôvernosť a uplatňovať
              primerané bezpečnostné opatrenia.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Prenos mimo EHP", title: "Prenos", accent: "mimo EHP",
      body: (
        <>
          <P>
            Niektorí poskytovatelia služieb (napr. Stripe, Google AI, OpenRouter, Microsoft Clarity) môžu spracúvať
            údaje mimo Európskeho hospodárskeho priestoru (EHP). V takých prípadoch:
          </P>
          <UL>
            <li>Zabezpečujeme primerané záruky v súlade s GDPR (štandardné zmluvné doložky schválené Európskou komisiou).</li>
            <li>K prenosu dochádza výlučne do krajín zabezpečujúcich primeranú úroveň ochrany údajov alebo subjektom, ktoré uplatňujú primerané záruky.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Práva používateľov", title: "Práva", accent: "používateľov",
      body: (
        <>
          <P>Podľa GDPR máte tieto práva:</P>

          <SubH>8.1. Prístup k údajom — čl. 15 GDPR</SubH>
          <P>
            Máte právo získať potvrdenie, či spracúvame vaše osobné údaje,
            a ak áno — získať k nim prístup a dostať ich kópiu.
          </P>

          <SubH>8.2. Oprava — čl. 16 GDPR</SubH>
          <P>
            Máte právo požadovať bezodkladnú opravu nesprávnych údajov
            alebo doplnenie neúplných údajov.
          </P>

          <SubH>8.3. Vymazanie („právo na zabudnutie“) — čl. 17 GDPR</SubH>
          <P>V určitých prípadoch máte právo požadovať vymazanie osobných údajov.</P>

          <SubH>8.4. Obmedzenie spracúvania — čl. 18 GDPR</SubH>
          <P>V určitých situáciách môžete požadovať obmedzenie spracúvania údajov.</P>

          <SubH>8.5. Prenosnosť údajov — čl. 20 GDPR</SubH>
          <P>
            Máte právo získať svoje údaje v štruktúrovanom, bežne používanom
            a strojovo čitateľnom formáte a preniesť ich inému prevádzkovateľovi.
          </P>

          <SubH>8.6. Námietka — čl. 21 GDPR</SubH>
          <P>
            Máte právo namietať proti spracúvaniu údajov na marketingové účely
            alebo na základe oprávneného záujmu.
          </P>

          <SubH>8.7. Odvolanie súhlasu — čl. 7 ods. 3 GDPR</SubH>
          <P>
            Ak sa spracúvanie vykonáva na základe súhlasu, máte právo ho
            kedykoľvek odvolať.
          </P>

          <SubH>8.8. Sťažnosť dozornému orgánu — čl. 77 GDPR</SubH>
          <P>
            Máte právo podať sťažnosť predsedovi poľského Úradu na ochranu osobných údajov (PUODO),
            ak sa domnievate, že spracúvanie vašich údajov porušuje GDPR.
          </P>
          <InfoBox title="PUODO · kontakt">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Na uplatnenie uvedených práv nás, prosím, kontaktujte e-mailom alebo prostredníctvom kontaktného formulára.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Čo sú cookies</SubH>
          <P>
            Cookies sú malé textové súbory ukladané do zariadenia používateľa počas
            návštevy webovej stránky.
          </P>

          <SubH>9.2. Aké cookies používame</SubH>
          <ULWide>
            <li><B>Nevyhnutné</B> — zabezpečujú základné funkcie stránky (relácia používateľa, košík, prihlásenie).</li>
            <li><B>Funkčné</B> — pamätajú si vaše preferencie (napr. tmavý režim).</li>
            <li><B>Analytické</B> — pomáhajú nám pochopiť, ako používatelia stránku používajú (teplotné mapy, záznamy relácií, štatistiky návštevnosti). Používame na to <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketingové</B> — používané na personalizáciu reklám (iba so súhlasom).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity sa načítava výlučne po udelení súhlasu s analytickými cookies
            v banneri súhlasu („Prijať všetky“). Nástroj ukladá do zariadenia okrem iného
            cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> a <Mono>SM</Mono>, ktoré slúžia na rozpoznanie
            vracajúceho sa používateľa, nahrávanie relácií a vytváranie teplotných máp. Údaje
            spracúva Microsoft Corporation v súlade so{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">zásadami ochrany osobných údajov Microsoft Clarity</A>.
            Súhlas možno kedykoľvek odvolať vymazaním údajov bannera súhlasu
            v nastaveniach prehliadača (localStorage) a voľbou „Iba nevyhnutné“.
          </P>

          <SubH>9.4. Úložisko prehliadača používané chatom</SubH>
          <P>
            Chat s asistentom ukladá do úložiska prehliadača (localStorage) identifikátor vašej konverzácie, aby
            v nej bolo možné pokračovať po obnovení stránky — je to nevyhnutné na fungovanie služby, o ktorú žiadate,
            a zmizne po kliknutí na „Ukončiť“. Iba po udelení súhlasu s analytickými cookies ukladá chat aj do sessionStorage
            (do zatvorenia karty) zoznam navštívených podstránok a sekcií, o ktorom sa hovorí v bode 3.4.
          </P>

          <SubH>9.5. Správa cookies</SubH>
          <P>
            Cookies môžete spravovať prostredníctvom nastavení prehliadača. Majte však
            na pamäti, že vypnutie cookies môže ovplyvniť funkčnosť Služby
            (napr. prihlásenie, nákupný košík).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Bezpečnosť údajov", title: "Bezpečnosť", accent: "",
      body: (
        <>
          <P>
            Uplatňujeme primerané technické a organizačné opatrenia na ochranu osobných
            údajov pred:
          </P>
          <UL>
            <li>neoprávneným prístupom,</li>
            <li>stratou,</li>
            <li>zničením,</li>
            <li>neoprávnenou zmenou,</li>
            <li>neoprávneným šírením.</li>
          </UL>
          <Gap size={5}>
            <P>Uplatňujeme najmä:</P>
          </Gap>
          <UL>
            <li>šifrovanie spojenia SSL/TLS (HTTPS),</li>
            <li>bezpečné ukladanie hesiel (algoritmus bcrypt so soľou),</li>
            <li>zabezpečenie relácií používateľov (cookies HttpOnly, Secure),</li>
            <li>obmedzenie prístupu k údajom výlučne na poverené osoby,</li>
            <li>pravidelné aktualizácie softvéru a systému,</li>
            <li>monitorovanie bezpečnosti infraštruktúry,</li>
            <li>pravidelné zálohy databázy.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatizácia a profilovanie", title: "Automatizácia", accent: "",
      body: (
        <>
          <P>
            V rámci Služby nepoužívame automatizované rozhodovanie vrátane
            profilovania, ktoré by malo voči Používateľom právne účinky alebo by ich podobným
            spôsobom významne ovplyvňovalo.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) a asistent v chate na stránke sú podporné
              nástroje, ktoré odpovedajú na otázky používateľov, ale neprijímajú
              automatizované rozhodnutia s právnymi účinkami. Priebeh návštevy priradený ku
              konverzácii (iba so súhlasom) slúži výlučne na prispôsobenie odpovedí a zlepšovanie stránky.
              O tom, že komunikujete s AI, vás informujeme v okne chatu.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Údaje detí", title: "Údaje", accent: "detí",
      body: (
        <>
          <P>
            Službu KalkMate.pl môžu používať maloleté osoby (študenti stredných
            škôl). Ak používateľ nedovŕšil 18 rokov, nákup kalkulačky a používanie
            AI Chat si vyžaduje súhlas rodiča alebo zákonného zástupcu.
          </P>
          <Gap>
            <P>
              Vedome nezbierame osobné údaje detí mladších ako 13 rokov bez
              súhlasu rodičov/zákonných zástupcov.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Zmeny zásad", title: "Zmeny", accent: "zásad",
      body: (
        <>
          <P>
            Tieto zásady ochrany osobných údajov sa môžu meniť v súvislosti s vývojom technológií,
            zmenami právnych predpisov alebo zmenami v prevádzke Služby.
          </P>
          <Gap>
            <P>O všetkých podstatných zmenách budeme Používateľov informovať prostredníctvom:</P>
          </Gap>
          <UL>
            <li>oznámenia na hlavnej stránke Služby,</li>
            <li>e-mailovej správy (pre registrovaných používateľov).</li>
          </UL>
          <Gap>
            <P>
              Aktuálna verzia zásad ochrany osobných údajov je vždy dostupná na adrese:{" "}
              <A href="/sk/polityka-prywatnosci">kalkmate.pl/sk/polityka-prywatnosci</A>
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
            Všetky otázky týkajúce sa spracúvania osobných údajov a uplatňovania
            vašich práv, prosím, smerujte na:
          </P>
          <UL>
            <li>E-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefón: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/sk/pomoc#kontakt">Kontaktný formulár</A>{" "}dostupný na stránke.</li>
          </UL>
          <Gap size={5}>
            <P>Zaväzujeme sa odpovedať na vaše otázky do 30 dní od ich prijatia.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Ďakujeme za dôveru a za používanie KalkMate.pl. Ochrane vášho súkromia
      a bezpečnosti vašich osobných údajov venujeme osobitnú pozornosť.
    </>
  ),
  footerNote: "Posledná aktualizácia · 2026-10-28 (chat s AI asistentom na stránke)",
  otherDocLabel: "→ Obchodné podmienky",
  homeLabel: "← Hlavná stránka",
};

export default doc;
