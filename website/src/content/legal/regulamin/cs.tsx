import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie czeskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Obchodní podmínky: objednávky, vrácení a záruka | KalkMate",
  metaDescription:
    "Obchodní podmínky obchodu KalkMate: objednávky, platby (Przelewy24, karta), doručení InPost zdarma, 14 dní na vrácení, záruka 24 měsíců a chat s AI asistentem.",
  badge: "V souladu s polským zákonem o právech spotřebitelů",
  dateLabel: "Platné od · 2026-01-01",
  eyebrow: "[ obchodní podmínky ] · 10 sekcí",
  h1: "Obchodní",
  h1Accent: "podmínky",
  intro: "Pravidla pro zadávání objednávek, platby, doručení, vrácení zboží a reklamace v internetovém obchodě kalkmate.pl.",
  bindingNote: (
    <>
      Tento překlad slouží pouze pro vaše pohodlí. Právně závazné je znění v polském jazyce — v případě
      rozporu má přednost <A href="/regulamin">polská verze</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Obecná ustanovení", title: "Obecná", accent: "ustanovení",
      body: (
        <>
          <P>
            Tyto obchodní podmínky upravují pravidla prodeje produktů v internetovém obchodě
            dostupném na adrese kalkmate.pl, jehož provozovatelem je <B>Kacper Popko</B>{" "}
            podnikající pod obchodní firmou <B>KAJPA Kacper Popko</B> (dále jen „Prodávající“).
          </P>
          <CompanyBox
            rows={[
              { label: "DIČ (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Adresa sídla", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Objednávky", title: "Objednávky", accent: "",
      body: (
        <OL>
          <li>Objednávky jsou přijímány prostřednictvím webové stránky kalkmate.pl nepřetržitě, 7 dní v týdnu.</li>
          <li>Zadání objednávky je rovnocenné s přijetím těchto obchodních podmínek.</li>
          <li>Po zadání objednávky obdrží Kupující potvrzení na uvedenou e-mailovou adresu.</li>
          <li>Prodávající si vyhrazuje právo v odůvodněných případech odmítnout vyřízení objednávky.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Ceny a platby", title: "Ceny", accent: "a platby",
      body: (
        <OL>
          <li>Všechny ceny uvedené na stránce jsou ceny brutto (včetně DPH).</li>
          <li>Platby zpracovává služba Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Dostupné platební metody: platební karta, BLIK, bankovní převod a další metody dostupné ve službě Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Vyřízení a doručení", title: "Vyřízení", accent: "a doručení",
      body: (
        <OL>
          <li>Produkt KalkMate je vyráběn na zakázku jako vlastní výroba.</li>
          <li>Lhůta pro vyřízení objednávky činí až 4 týdny od připsání platby. Standardní doba vyřízení je 1–2 týdny.</li>
          <li>Doručení na území Polska probíhá prostřednictvím společnosti InPost (výdejní box Paczkomat). Cena doručení v Polsku: 0 PLN.</li>
          <li>Doručení do zahraničí (země EU): 20 EUR. Doručení mimo EU: 35 EUR.</li>
          <li>Kupující obdrží číslo pro sledování zásilky po jejím odeslání.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Právo na odstoupení", title: "Právo", accent: "na odstoupení",
      body: (
        <>
          <P>
            Spotřebitel má právo odstoupit od smlouvy uzavřené na dálku ve lhůtě 14 kalendářních
            dnů bez udání důvodu, s výhradou výjimky popsané níže.
          </P>
          <Callout title="Výjimka — zařízení personalizované na zakázku">
            <CalloutP>
              Každý kus zařízení KalkMate je před odesláním individuálně personalizován na
              přání Spotřebitele: (a) nahrává se do něj kód pro odemknutí funkcí AI, který si
              Spotřebitel zvolil v objednávkovém formuláři, a (b) na štítek daného kusu se tiskne
              jméno/přezdívka uvedené Spotřebitelem. Podle{" "}
              <B>čl. 38 bodu 3 polského zákona o právech spotřebitelů ze dne 30. května 2014</B>{" "}
              se právo na odstoupení od smlouvy nevztahuje na věc vyrobenou podle specifikace
              spotřebitele nebo sloužící k uspokojení jeho individualizovaných potřeb. Tato
              informace a požadavek na udělení samostatného souhlasu jsou Spotřebiteli předloženy
              před uzavřením smlouvy, v objednávkovém formuláři.
            </CalloutP>
            <CalloutP className="mt-3">
              Tato výjimka <B>se nevztahuje</B> na nákupy balíčků
              (dobití) AI tokenů, u nichž se právo na odstoupení řídí obecnými pravidly.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Následující odstavce se týkají případů, kdy právo na odstoupení náleží
              (tj. nákupů jiných než personalizované zařízení KalkMate):
            </P>
          </div>
          <OL>
            <li>Lhůta pro odstoupení od smlouvy uplyne po 14 dnech ode dne, kdy Spotřebitel převzal věc do svého držení.</li>
            <li>Pro uplatnění práva na odstoupení musí Spotřebitel informovat Prodávajícího o svém rozhodnutí e-mailem na adresu: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Zboží je třeba vrátit na adresu: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Platba je vrácena do 14 dnů ode dne obdržení vraceného zboží.
              Pokud Spotřebitel výslovně požádal o zahájení poskytování služby (např. řešení pomocí AI)
              před uplynutím lhůty pro odstoupení, má Prodávající právo odečíst z vracené částky
              úhradu za služby skutečně poskytnuté do okamžiku odstoupení (čl. 35 polského zákona
              o právech spotřebitelů), a v případě vracené věci nesoucí stopy použití přesahující
              míru nezbytnou ke zjištění povahy a funkčnosti zboží — také částku odpovídající
              snížení její hodnoty (čl. 34 odst. 4 polského zákona o právech spotřebitelů).
            </li>
            <li>Právo na reklamaci z titulu odpovědnosti za vady a ze záruky (§6) náleží nezávisle na výše uvedených ustanoveních a není jimi omezeno.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reklamace a záruka", title: "Reklamace", accent: "a záruka",
      body: (
        <OL>
          <li>Na produkty se vztahuje záruka Prodávajícího po dobu 24 měsíců od data nákupu.</li>
          <li>Reklamace je třeba uplatňovat e-mailem na adrese: <B>kontakt@kalkmate.pl</B> s uvedením čísla objednávky a popisu závady.</li>
          <li>Prodávající vyřizuje reklamace ve lhůtě do 14 kalendářních dnů.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Ochrana osobních údajů", title: "Ochrana", accent: "údajů",
      body: (
        <OL>
          <li>Správcem osobních údajů je Prodávající.</li>
          <li>Osobní údaje jsou zpracovávány výhradně za účelem vyřízení objednávky a nejsou zpřístupňovány třetím subjektům, s výjimkou přepravních společností a provozovatelů plateb.</li>
          <li>Kupující má právo nahlížet do svých údajů, opravovat je a požadovat jejich výmaz.</li>
          <li>
            Stránka využívá soubory cookies, včetně analytického nástroje Microsoft Clarity
            (teplotní mapy, záznamy relací), který se načítá výhradně po udělení souhlasu v cookie
            banneru. Podrobnosti najdete v{" "}
            <A href="/cs/polityka-prywatnosci#sek-9">Zásadách ochrany osobních údajů</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat s AI asistentem", title: "Chat", accent: "s AI asistentem",
      body: (
        <OL>
          <li>
            Na stránce kalkmate.pl Prodávající zpřístupňuje bezplatnou službu poskytovanou elektronickou cestou:
            chat s asistentem, jehož odpovědi generuje <B>umělá inteligence (AI)</B>.
            Asistent není člověk. Odpovídá na otázky o produktech, objednávkách a fungování kalkulačky.
          </li>
          <li>
            K zahájení konverzace je potřeba: webový prohlížeč se zapnutým JavaScriptem, uvedení e-mailové
            adresy, potvrzení, že uživatel není automat (ověření probíhá v prohlížeči), a souhlas s tímto
            paragrafem. Smlouva o poskytování služby je uzavřena okamžikem zahájení konverzace a zaniká
            okamžikem jejího ukončení (tlačítko „Ukončit“ nebo zavření stránky). Uživatel může chat
            kdykoli přestat používat.
          </li>
          <li>
            Odpovědi asistenta mají výhradně informativní povahu, mohou obsahovat chyby a nepředstavují nabídku
            ve smyslu polského občanského zákoníku ani projev vůle Prodávajícího. V případě rozporu jsou závazné
            tyto obchodní podmínky, popis produktu na stránce a informace uvedené v potvrzení objednávky.
            Asistent nemá přístup k objednávkám ani účtům — záležitosti konkrétních objednávek, vrácení zboží
            a reklamací je třeba směřovat na adresu kontakt@kalkmate.pl.
          </li>
          <li>
            Prodávající může na dotaz z chatu odpovědět e-mailem na uvedenou adresu, zejména pokud
            asistent odpověď nezná.
          </li>
          <li>
            V chatu je zakázáno zasílat protiprávní či urážlivý obsah nebo obsah porušující práva třetích osob,
            jakož i zvláštní kategorie osobních údajů, hesla, údaje platebních karet a AI kód kalkulačky. Prodávající
            může zablokovat konverzaci porušující tato pravidla a uplatňovat limity počtu zpráv.
          </li>
          <li>
            Asistent může sám nabídnout pomoc zobrazením krátké zprávy vedle tlačítka chatu (např. po určité
            době strávené na stránce nebo u ceníku). Taková zpráva se zobrazí nejvýše dvakrát během návštěvy
            a po jejím zavření se znovu nezobrazí.
          </li>
          <li>
            Obsah konverzací, e-mailová adresa a technické informace (stránka, ze které byla zpráva odeslána, prohlížeč)
            se ukládají a jsou přístupné Prodávajícímu a jím pověřeným osobám za účelem vyřizování dotazů
            a zlepšování zákaznické podpory. Pokud uživatel udělil souhlas s analytickými cookies, ke konverzaci
            se přiřazuje také průběh návštěvy stránky (navštívené podstránky a zobrazené sekce) a
            identifikátor záznamu relace v Microsoft Clarity. Podrobnosti, právní základy a dobu uchovávání
            (12 měsíců od poslední zprávy) popisují{" "}
            <A href="/cs/polityka-prywatnosci#sek-3">Zásady ochrany osobních údajů</A>.
          </li>
          <li>
            Osoby mladší 16 let mohou chat používat se souhlasem rodiče nebo zákonného zástupce.
          </li>
          <li>
            Reklamace týkající se fungování chatu lze podávat na adresu kontakt@kalkmate.pl. Prodávající
            je vyřizuje ve lhůtě 14 dnů.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Partnerský program", title: "Partnerský", accent: "program",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Účastníkem partnerského programu („Partner“) může být registrovaný uživatel služby kalkmate.pl
            s potvrzenou e-mailovou adresou. Partner si v zákaznickém panelu vytvoří jeden vlastní partnerský kód
            (4 až 16 znaků: písmena A–Z a číslice).
          </li>
          <li>
            Kupující, který při objednávce zadá partnerský kód, obdrží <B>slevu 7%</B>{" "}
            z ceny produktů. Partnerský kód nelze kombinovat s jinými slevovými kupóny (objednávkový formulář
            přijímá jeden kód). Partner nemůže použít vlastní kód.
          </li>
          <li>
            Za každou zaplacenou objednávku s kódem obdrží Partner provizi vypočtenou z hodnoty produktů po slevě,
            bez nákladů na doručení. Výše provize závisí na úrovni Partnera, která se stanoví podle počtu kusů
            prodaných s jeho kódem před danou objednávkou:
            <TierTable
              head={["Úroveň", "Prodané kusy", "Provize"]}
              rows={[
                ["Start", "0–2", "5%"],
                ["Bronz", "3–9", "7%"],
                ["Stříbro", "10–24", "9%"],
                ["Zlato", "25–49", "11%"],
                ["Diamant", "od 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Provize se vyúčtovávají v polských zlotých (PLN); hodnota objednávek v EUR se přepočítává pevným kurzem 4,25 PLN za 1 EUR.
            </span>
          </li>
          <li>
            Provize je k dispozici po 30 dnech od zaplacení objednávky. Provize se ruší v případě
            zrušení objednávky, vrácení platby nebo sporu týkajícího se platby — i tehdy, pokud již byla
            vyměněna nebo vyplacena; zůstatek Partnera se pak může stát záporným a vyrovnává se z dalších provizí.
          </li>
          <li>
            Dostupné prostředky může Partner: (a) vyměnit za AI tokeny — od 10 PLN, v kurzu 1 PLN = 65 000 tokenů,
            okamžitě; (b) nechat vyplatit převodem na bankovní účet — od 100 PLN, pouze pokud je Partner
            zletilý. Výplata se obvykle provádí do 7 pracovních dnů. Před výplatou může Prodávající
            požádat o údaje nezbytné pro daňové vyúčtování.
          </li>
          <li>
            Zakázáno je: rozesílání spamu, vydávání se za KalkMate nebo Prodávajícího, reklama ve vyhledávačích
            na klíčová slova obsahující značku KalkMate, doporučování sám sobě a zadávání fiktivních objednávek. V případě
            porušení může Prodávající partnerský kód deaktivovat a zrušit neoprávněně připsané provize.
          </li>
          <li>
            Prodávající může změnit podmínky partnerského programu s předstihem 14 dnů, o čemž informuje na stránce.
            Změny se nevztahují na provize připsané před nabytím jejich účinnosti.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Závěrečná ustanovení", title: "Závěrečná", accent: "ustanovení",
      body: (
        <OL>
          <li>Ve věcech neupravených těmito obchodními podmínkami se použijí ustanovení polského občanského zákoníku, polského zákona o právech spotřebitelů a polského zákona o poskytování služeb elektronickou cestou.</li>
          <li>Prodávající si vyhrazuje právo tyto obchodní podmínky změnit. Změny nabývají účinnosti dnem zveřejnění na stránce.</li>
          <li>Veškeré spory bude rozhodovat soud příslušný podle sídla Prodávajícího.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Děkujeme za důvěru a za nákup KalkMate. S dotazy k objednávce, vrácení zboží
      nebo reklamaci jsme vám k dispozici na adrese kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Platné od · 2026-01-01 · poslední změna 2026-10-28 (§9 partnerský program)",
  otherDocLabel: "→ Zásady ochrany osobních údajů",
  homeLabel: "← Hlavní stránka",
};

export default doc;
