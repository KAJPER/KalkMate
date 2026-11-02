import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie czeskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Zásady ochrany osobních údajů: GDPR a cookies | KalkMate",
  metaDescription:
    "Jak KalkMate chrání vaše údaje: co shromažďujeme a proč, jak dlouho je uchováváme, cookies a Microsoft Clarity, chat s AI a vaše práva podle GDPR.",
  badge: "GDPR · v souladu s nařízením EU 2016/679",
  dateLabel: "Aktualizace · 2026-10-28",
  eyebrow: "[ soukromí ] · 14 sekcí",
  h1: "Zásady ochrany",
  h1Accent: "osobních údajů",
  intro: "Jaké údaje shromažďujeme, proč je zpracováváme, kdo k nim má přístup a jak můžete uplatnit svá práva. V souladu s GDPR.",
  bindingNote: (
    <>
      Tento překlad slouží pouze pro vaše pohodlí. Právně závazné je znění v polském jazyce — v případě
      rozporu má přednost <A href="/polityka-prywatnosci">polská verze</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Obecná ustanovení", title: "Obecná", accent: "ustanovení",
      body: (
        <>
          <P>
            Tyto Zásady ochrany osobních údajů stanoví pravidla zpracování a ochrany osobních údajů
            Uživatelů, kteří používají službu KalkMate.pl (dále jen „Služba“), kterou provozuje
            KalkMate (dále jen „Správce“).
          </P>
          <Gap>
            <P>
              Správce klade zvláštní důraz na respektování soukromí Uživatelů
              a bezpečnost jejich osobních údajů. Osobní údaje jsou zpracovávány v souladu
              s nařízením Evropského parlamentu a Rady (EU) 2016/679 ze dne 27. dubna 2016
              (obecné nařízení o ochraně osobních údajů, GDPR) a s předpisy vnitrostátního práva.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Správce údajů", title: "Správce", accent: "údajů",
      body: (
        <>
          <P>Správcem osobních údajů shromažďovaných prostřednictvím Služby je:</P>
          <CompanyBox
            rows={[
              { label: "DIČ (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Adresa sídla", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Zkrácený název", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefon", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Správce můžete ve věcech zpracování osobních údajů kontaktovat:</P>
          </Gap>
          <UL>
            <li>e-mailem: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefonicky: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>prostřednictvím kontaktního formuláře dostupného na stránce.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Rozsah shromažďovaných údajů", title: "Rozsah", accent: "údajů",
      body: (
        <>
          <P>V rámci provozu Služby shromažďujeme tyto kategorie osobních údajů:</P>

          <SubH>3.1. Údaje poskytnuté uživatelem</SubH>
          <UL>
            <li>jméno a příjmení,</li>
            <li>e-mailová adresa,</li>
            <li>telefonní číslo,</li>
            <li>adresa výdejního místa InPost (výdejní box Paczkomat).</li>
          </UL>

          <SubH>3.2. Automaticky shromažďované údaje</SubH>
          <UL>
            <li>IP adresa,</li>
            <li>typ a verze prohlížeče,</li>
            <li>operační systém,</li>
            <li>údaje o aktivitě ve Službě (navštívené stránky, doba návštěvy),</li>
            <li>technické informace o zařízení.</li>
          </UL>

          <SubH>3.3. Transakční údaje</SubH>
          <UL>
            <li>historie objednávek,</li>
            <li>platební údaje (zpracovávané společností Stripe),</li>
            <li>informace o zůstatku, nákupech a aktivacích AI tokenů (včetně aktivovaných licenčních kódů z krabičky),</li>
            <li>historie konverzací s AI Chat.</li>
          </UL>

          <SubH>3.4. Chat s AI asistentem na stránce</SubH>
          <P>Když zahájíte konverzaci v okně chatu na stránce (obchodní podmínky §8), zpracováváme:</P>
          <UL>
            <li>e-mailovou adresu uvedenou při zahájení konverzace,</li>
            <li>obsah vašich zpráv a odpovědí asistenta, s datem a časem,</li>
            <li>adresu podstránky, ze které byla zpráva odeslána, jazyk stránky a informace o prohlížeči (user-agent),</li>
            <li>
              <B>pouze pokud jste udělili souhlas s analytickými cookies</B>: průběh
              návštěvy stránky (navštívené podstránky a zobrazené sekce, s časem) a identifikátor konverzace
              připojovaný k záznamu relace v Microsoft Clarity — díky tomu vidíme, co jste hledali,
              a můžeme lépe odpovědět. Bez tohoto souhlasu se průběh návštěvy neshromažďuje.
            </li>
          </UL>
          <P>
            Potvrzení „Nejsem robot“ provádí výpočet ve vašem prohlížeči — nevyužívá služeb
            externích firem a neukládá cookies. Obsah zpráv je předáván poskytovateli modelu AI
            (viz sekce 6) výhradně za účelem vygenerování odpovědi.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Účel a právní základ", title: "Účel", accent: "zpracování",
      body: (
        <>
          <P>Přehled účelů zpracování a jim odpovídajících právních základů podle GDPR.</P>
          <BasisTable
            head={["Účel zpracování", "Právní základ podle GDPR"]}
            rows={[
              ["Plnění kupní smlouvy", "Čl. 6 odst. 1 písm. b) GDPR"],
              ["Zpracování plateb", "Čl. 6 odst. 1 písm. b) GDPR"],
              ["Poskytování služby AI Chat", "Čl. 6 odst. 1 písm. b) GDPR"],
              ["Chat s AI asistentem na stránce (konverzace, e-mail, odpověď e-mailem)", "Čl. 6 odst. 1 písm. b) GDPR (služba na vaši žádost)"],
              ["Kontrola konverzací z chatu za účelem zlepšování podpory a asistenta", "Čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem)"],
              ["Přiřazení průběhu návštěvy a záznamu Clarity ke konverzaci", "Čl. 6 odst. 1 písm. a) GDPR (souhlas s analytickými cookies)"],
              ["Odesílání produktů", "Čl. 6 odst. 1 písm. b) GDPR"],
              ["Vyřizování reklamací", "Čl. 6 odst. 1 písm. c) GDPR (právní povinnost)"],
              ["Vystavování faktur", "Čl. 6 odst. 1 písm. c) GDPR (právní povinnost)"],
              ["Přímý marketing", "Čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem)"],
              ["Analytika a statistiky", "Čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem)"],
              ["Newsletter (pokud byl udělen souhlas)", "Čl. 6 odst. 1 písm. a) GDPR (souhlas)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Doba uchovávání", title: "Doba", accent: "uchovávání",
      body: (
        <>
          <P>
            Osobní údaje uchováváme po dobu vyžadovanou právními předpisy nebo po dobu
            nezbytnou k dosažení účelů zpracování:
          </P>
          <ULWide>
            <li><B>Transakční údaje a faktury:</B> 5 let od konce kalendářního roku, v němž vznikla daňová povinnost.</li>
            <li><B>Údaje týkající se smlouvy:</B> po dobu trvání smlouvy a po dobu vyžadovanou právními předpisy (např. 6 let v souvislosti s promlčením nároků).</li>
            <li><B>Údaje související s AI tokeny</B> (zůstatek, nákupy balíčků, aktivované kódy)<B>:</B> po dobu existence účtu a 3 roky po jeho smazání.</li>
            <li><B>Historie AI Chat:</B> po dobu existence účtu (do smazání konverzace nebo účtu uživatelem) a až 30 dnů po smazání účtu.</li>
            <li><B>Marketingové údaje (souhlas):</B> do odvolání souhlasu nebo vznesení námitky.</li>
            <li><B>Analytické údaje:</B> až 25 měsíců od poslední aktivity.</li>
            <li><B>Konverzace z chatu na stránce</B> (e-mail, obsah, průběh návštěvy)<B>:</B> 12 měsíců od poslední zprávy v konverzaci, poté se automaticky mažou; dříve — na vaši žádost.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Zpřístupnění údajů", title: "Zpřístupnění", accent: "",
      body: (
        <>
          <P>Osobní údaje mohou být zpřístupněny těmto kategoriím příjemců:</P>
          <ULWide>
            <li><B>Stripe</B> – provozovatel plateb (zpracování transakcí platebními kartami, včetně nákupů balíčků AI tokenů).</li>
            <li><B>InPost</B> – přepravní společnost (doručování produktů do výdejních boxů Paczkomat).</li>
            <li><B>Resend</B> – e-mailová služba (odesílání transakčních zpráv a přihlašovacích odkazů typu magic link).</li>
            <li><B>Google AI (Gemini)</B> – poskytovatel služby AI Chat (zpracování dotazů v chatbotu).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – zprostředkovatel přístupu k modelům AI (mj. Google Gemini); dostává obsah zpráv z chatu na stránce a z AI Chat za účelem vygenerování odpovědi. E-mailovou adresu mu nepředáváme.</li>
            <li><B>Microsoft Clarity</B> – analytický nástroj (teplotní mapy, záznamy relací) používaný výhradně po udělení souhlasu s analytickými cookies — viz sekce 9.</li>
            <li><B>Poskytovatel hostingu</B> – ukládání údajů na serverech VPS.</li>
            <li><B>Poskytovatel databáze PostgreSQL</B> – ukládání údajů uživatelů.</li>
            <li><B>Subjekty oprávněné ze zákona</B> – státní orgány, soudy (pokud to vyžadují právní předpisy).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Všichni příjemci údajů jednají na základě smluv o zpracování
              osobních údajů a jsou povinni zachovávat jejich důvěrnost a uplatňovat
              odpovídající bezpečnostní opatření.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Předávání mimo EHP", title: "Předávání", accent: "mimo EHP",
      body: (
        <>
          <P>
            Někteří poskytovatelé služeb (např. Stripe, Google AI, OpenRouter, Microsoft Clarity) mohou zpracovávat
            údaje mimo Evropský hospodářský prostor (EHP). V takových případech:
          </P>
          <UL>
            <li>Zajišťujeme odpovídající záruky v souladu s GDPR (standardní smluvní doložky schválené Evropskou komisí).</li>
            <li>K předávání dochází výhradně do zemí zajišťujících odpovídající úroveň ochrany údajů nebo subjektům, které uplatňují vhodné záruky.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Práva uživatelů", title: "Práva", accent: "uživatelů",
      body: (
        <>
          <P>Podle GDPR máte tato práva:</P>

          <SubH>8.1. Přístup k údajům — čl. 15 GDPR</SubH>
          <P>
            Máte právo získat potvrzení, zda zpracováváme vaše osobní údaje,
            a pokud ano — získat k nim přístup a obdržet jejich kopii.
          </P>

          <SubH>8.2. Oprava — čl. 16 GDPR</SubH>
          <P>
            Máte právo požadovat bezodkladnou opravu nepřesných údajů
            nebo doplnění neúplných údajů.
          </P>

          <SubH>8.3. Výmaz („právo být zapomenut“) — čl. 17 GDPR</SubH>
          <P>V určitých případech máte právo požadovat výmaz osobních údajů.</P>

          <SubH>8.4. Omezení zpracování — čl. 18 GDPR</SubH>
          <P>V určitých situacích můžete požadovat omezení zpracování údajů.</P>

          <SubH>8.5. Přenositelnost údajů — čl. 20 GDPR</SubH>
          <P>
            Máte právo získat své údaje ve strukturovaném, běžně používaném
            a strojově čitelném formátu a předat je jinému správci.
          </P>

          <SubH>8.6. Námitka — čl. 21 GDPR</SubH>
          <P>
            Máte právo vznést námitku proti zpracování údajů pro účely marketingu
            nebo na základě oprávněného zájmu.
          </P>

          <SubH>8.7. Odvolání souhlasu — čl. 7 odst. 3 GDPR</SubH>
          <P>
            Pokud zpracování probíhá na základě souhlasu, máte právo jej
            kdykoli odvolat.
          </P>

          <SubH>8.8. Stížnost u dozorového úřadu — čl. 77 GDPR</SubH>
          <P>
            Máte právo podat stížnost u předsedy polského Úřadu pro ochranu osobních údajů (PUODO),
            pokud se domníváte, že zpracování vašich údajů porušuje GDPR.
          </P>
          <InfoBox title="PUODO · kontakt">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Pro uplatnění výše uvedených práv nás prosím kontaktujte e-mailem nebo prostřednictvím kontaktního formuláře.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Co jsou cookies</SubH>
          <P>
            Cookies jsou malé textové soubory ukládané do zařízení uživatele při
            návštěvě webové stránky.
          </P>

          <SubH>9.2. Jaké cookies používáme</SubH>
          <ULWide>
            <li><B>Nezbytné</B> — zajišťují základní funkce stránky (relace uživatele, košík, přihlášení).</li>
            <li><B>Funkční</B> — pamatují si vaše preference (např. tmavý režim).</li>
            <li><B>Analytické</B> — pomáhají nám pochopit, jak uživatelé stránku používají (teplotní mapy, záznamy relací, statistiky návštěvnosti). Používáme k tomu <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketingové</B> — používané k personalizaci reklam (pouze se souhlasem).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity se načítá výhradně po udělení souhlasu s analytickými cookies
            v banneru souhlasu („Přijmout vše“). Nástroj ukládá do zařízení mj.
            cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> a <Mono>SM</Mono>, které slouží k rozpoznání
            vracejícího se uživatele, nahrávání relací a vytváření teplotních map. Údaje
            zpracovává Microsoft Corporation v souladu se{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">zásadami ochrany osobních údajů Microsoft Clarity</A>.
            Souhlas lze kdykoli odvolat vymazáním dat banneru souhlasu
            v nastavení prohlížeče (localStorage) a volbou „Jen nezbytné“.
          </P>

          <SubH>9.4. Úložiště prohlížeče používané chatem</SubH>
          <P>
            Chat s asistentem ukládá do úložiště prohlížeče (localStorage) identifikátor vaší konverzace, aby
            v ní bylo možné pokračovat po obnovení stránky — to je nezbytné pro fungování služby, o kterou žádáte,
            a zmizí po kliknutí na „Ukončit“. Pouze po udělení souhlasu s analytickými cookies ukládá chat také do sessionStorage
            (do zavření karty) seznam navštívených podstránek a sekcí, o kterém se hovoří v bodě 3.4.
          </P>

          <SubH>9.5. Správa cookies</SubH>
          <P>
            Cookies můžete spravovat prostřednictvím nastavení prohlížeče. Mějte však
            na paměti, že vypnutí cookies může ovlivnit funkčnost Služby
            (např. přihlášení, nákupní košík).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Bezpečnost údajů", title: "Bezpečnost", accent: "",
      body: (
        <>
          <P>
            Uplatňujeme vhodná technická a organizační opatření k ochraně osobních
            údajů před:
          </P>
          <UL>
            <li>neoprávněným přístupem,</li>
            <li>ztrátou,</li>
            <li>zničením,</li>
            <li>neoprávněnou změnou,</li>
            <li>neoprávněným šířením.</li>
          </UL>
          <Gap size={5}>
            <P>Uplatňujeme zejména:</P>
          </Gap>
          <UL>
            <li>šifrování spojení SSL/TLS (HTTPS),</li>
            <li>bezpečné ukládání hesel (algoritmus bcrypt se solí),</li>
            <li>zabezpečení relací uživatelů (cookies HttpOnly, Secure),</li>
            <li>omezení přístupu k údajům výhradně na pověřené osoby,</li>
            <li>pravidelné aktualizace softwaru a systému,</li>
            <li>monitorování bezpečnosti infrastruktury,</li>
            <li>pravidelné zálohy databáze.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatizace a profilování", title: "Automatizace", accent: "",
      body: (
        <>
          <P>
            V rámci Služby nepoužíváme automatizované rozhodování, včetně
            profilování, které by mělo vůči Uživatelům právní účinky nebo by se jich obdobným
            způsobem významně dotýkalo.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) a asistent v chatu na stránce jsou podpůrné
              nástroje, které odpovídají na dotazy uživatelů, ale nepřijímají
              automatizovaná rozhodnutí s právními účinky. Průběh návštěvy přiřazený ke
              konverzaci (pouze se souhlasem) slouží výhradně k přizpůsobení odpovědí a zlepšování stránky.
              O tom, že komunikujete s AI, vás informujeme v okně chatu.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Údaje dětí", title: "Údaje", accent: "dětí",
      body: (
        <>
          <P>
            Službu KalkMate.pl mohou používat nezletilé osoby (studenti středních
            škol). Pokud uživatel nedovršil 18 let, vyžaduje nákup kalkulačky a používání
            AI Chat souhlas rodiče nebo zákonného zástupce.
          </P>
          <Gap>
            <P>
              Vědomě neshromažďujeme osobní údaje dětí mladších 13 let bez
              souhlasu rodičů/zákonných zástupců.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Změny zásad", title: "Změny", accent: "zásad",
      body: (
        <>
          <P>
            Tyto Zásady ochrany osobních údajů se mohou měnit v souvislosti s vývojem technologií,
            změnami právních předpisů nebo změnami v provozu Služby.
          </P>
          <Gap>
            <P>O všech podstatných změnách budeme Uživatele informovat prostřednictvím:</P>
          </Gap>
          <UL>
            <li>oznámení na hlavní stránce Služby,</li>
            <li>e-mailové zprávy (pro registrované uživatele).</li>
          </UL>
          <Gap>
            <P>
              Aktuální verze Zásad ochrany osobních údajů je vždy k dispozici na adrese:{" "}
              <A href="/cs/polityka-prywatnosci">kalkmate.pl/cs/polityka-prywatnosci</A>
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
            Veškeré dotazy týkající se zpracování osobních údajů a uplatňování
            vašich práv prosím směřujte na:
          </P>
          <UL>
            <li>E-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefon: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/cs/pomoc#kontakt">Kontaktní formulář</A>{" "}dostupný na stránce.</li>
          </UL>
          <Gap size={5}>
            <P>Zavazujeme se odpovědět na vaše dotazy do 30 dnů od jejich obdržení.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Děkujeme za důvěru a za používání KalkMate.pl. Ochraně vašeho soukromí
      a bezpečnosti vašich osobních údajů věnujeme zvláštní pozornost.
    </>
  ),
  footerNote: "Poslední aktualizace · 2026-10-28 (chat s AI asistentem na stránce)",
  otherDocLabel: "→ Obchodní podmínky",
  homeLabel: "← Hlavní stránka",
};

export default doc;
