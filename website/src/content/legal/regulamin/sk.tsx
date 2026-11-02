import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie slowackie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Obchodné podmienky: objednávky, vrátenie a záruka | KalkMate",
  metaDescription:
    "Obchodné podmienky obchodu KalkMate: objednávky, platby (Przelewy24, karta), doručenie InPost zadarmo, 14 dní na vrátenie, záruka 24 mesiacov a chat s AI asistentom.",
  badge: "V súlade s poľským zákonom o právach spotrebiteľa",
  dateLabel: "Platné od · 2026-01-01",
  eyebrow: "[ obchodné podmienky ] · 10 sekcií",
  h1: "Obchodné",
  h1Accent: "podmienky",
  intro: "Pravidlá zadávania objednávok, platieb, doručenia, vrátenia tovaru a reklamácií v internetovom obchode kalkmate.pl.",
  bindingNote: (
    <>
      Tento preklad slúži iba pre vaše pohodlie. Právne záväzné je znenie v poľskom jazyku — v prípade
      rozporu má prednosť <A href="/regulamin">poľská verzia</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Všeobecné ustanovenia", title: "Všeobecné", accent: "ustanovenia",
      body: (
        <>
          <P>
            Tieto obchodné podmienky upravujú pravidlá predaja produktov v internetovom obchode
            dostupnom na adrese kalkmate.pl, ktorého prevádzkovateľom je <B>Kacper Popko</B>{" "}
            podnikajúci pod obchodným menom <B>KAJPA Kacper Popko</B> (ďalej len „Predávajúci“).
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
          <li>Objednávky sa prijímajú prostredníctvom webovej stránky kalkmate.pl nepretržite, 7 dní v týždni.</li>
          <li>Zadanie objednávky je rovnocenné s prijatím týchto obchodných podmienok.</li>
          <li>Po zadaní objednávky dostane Kupujúci potvrdenie na uvedenú e-mailovú adresu.</li>
          <li>Predávajúci si vyhradzuje právo v odôvodnených prípadoch odmietnuť vybavenie objednávky.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Ceny a platby", title: "Ceny", accent: "a platby",
      body: (
        <OL>
          <li>Všetky ceny uvedené na stránke sú ceny brutto (vrátane DPH).</li>
          <li>Platby spracúva služba Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Dostupné platobné metódy: platobná karta, BLIK, bankový prevod a ďalšie metódy dostupné v službe Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Vybavenie a doručenie", title: "Vybavenie", accent: "a doručenie",
      body: (
        <OL>
          <li>Produkt KalkMate sa vyrába na zákazku ako vlastná výroba.</li>
          <li>Lehota na vybavenie objednávky je do 4 týždňov od pripísania platby. Štandardná doba vybavenia je 1–2 týždne.</li>
          <li>Doručenie na území Poľska sa uskutočňuje prostredníctvom spoločnosti InPost (výdajný box Paczkomat). Cena doručenia v Poľsku: 0 PLN.</li>
          <li>Doručenie do zahraničia (krajiny EÚ): 20 EUR. Doručenie mimo EÚ: 35 EUR.</li>
          <li>Kupujúci dostane číslo na sledovanie zásielky po jej odoslaní.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Právo na odstúpenie", title: "Právo", accent: "na odstúpenie",
      body: (
        <>
          <P>
            Spotrebiteľ má právo odstúpiť od zmluvy uzavretej na diaľku v lehote 14 kalendárnych
            dní bez uvedenia dôvodu, s výhradou výnimky opísanej nižšie.
          </P>
          <Callout title="Výnimka — zariadenie personalizované na zákazku">
            <CalloutP>
              Každý kus zariadenia KalkMate je pred odoslaním individuálne personalizovaný na
              želanie Spotrebiteľa: (a) nahráva sa doň kód na odomknutie funkcií AI, ktorý si
              Spotrebiteľ zvolil v objednávkovom formulári, a (b) na štítok daného kusu sa tlačí
              meno/prezývka uvedené Spotrebiteľom. Podľa{" "}
              <B>čl. 38 bodu 3 poľského zákona o právach spotrebiteľa z 30. mája 2014</B>{" "}
              sa právo na odstúpenie od zmluvy nevzťahuje na vec vyrobenú podľa špecifikácie
              spotrebiteľa alebo slúžiacu na uspokojenie jeho individualizovaných potrieb. Táto
              informácia a požiadavka na udelenie samostatného súhlasu sa Spotrebiteľovi predkladajú
              pred uzavretím zmluvy, v objednávkovom formulári.
            </CalloutP>
            <CalloutP className="mt-3">
              Táto výnimka <B>sa nevzťahuje</B> na nákupy balíkov
              (dobití) AI tokenov, pri ktorých sa právo na odstúpenie riadi všeobecnými pravidlami.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Nasledujúce odseky sa týkajú prípadov, v ktorých právo na odstúpenie patrí
              (t. j. nákupov iných než personalizované zariadenie KalkMate):
            </P>
          </div>
          <OL>
            <li>Lehota na odstúpenie od zmluvy uplynie po 14 dňoch odo dňa, keď Spotrebiteľ prevzal vec do svojej držby.</li>
            <li>Na uplatnenie práva na odstúpenie musí Spotrebiteľ informovať Predávajúceho o svojom rozhodnutí e-mailom na adresu: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Tovar je potrebné vrátiť na adresu: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Platba sa vráti do 14 dní odo dňa prijatia vráteného tovaru.
              Ak Spotrebiteľ výslovne požiadal o začatie poskytovania služby (napr. riešení pomocou AI)
              pred uplynutím lehoty na odstúpenie, Predávajúci má právo odpočítať z vracanej sumy
              odplatu za služby skutočne poskytnuté do okamihu odstúpenia (čl. 35 poľského zákona
              o právach spotrebiteľa), a v prípade vracanej veci, ktorá nesie stopy používania
              presahujúce mieru potrebnú na zistenie povahy a funkčnosti tovaru — aj sumu zodpovedajúcu
              zníženiu jej hodnoty (čl. 34 ods. 4 poľského zákona o právach spotrebiteľa).
            </li>
            <li>Právo na reklamáciu z titulu zodpovednosti za vady a zo záruky (§6) patrí nezávisle od vyššie uvedených ustanovení a nie je nimi obmedzené.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reklamácie a záruka", title: "Reklamácie", accent: "a záruka",
      body: (
        <OL>
          <li>Na produkty sa vzťahuje záruka Predávajúceho v trvaní 24 mesiacov od dátumu kúpy.</li>
          <li>Reklamácie je potrebné uplatňovať e-mailom na adrese: <B>kontakt@kalkmate.pl</B> s uvedením čísla objednávky a opisu poruchy.</li>
          <li>Predávajúci vybavuje reklamácie v lehote do 14 kalendárnych dní.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Ochrana osobných údajov", title: "Ochrana", accent: "údajov",
      body: (
        <OL>
          <li>Prevádzkovateľom osobných údajov je Predávajúci.</li>
          <li>Osobné údaje sa spracúvajú výlučne na účel vybavenia objednávky a nesprístupňujú sa tretím subjektom, s výnimkou kuriérskych spoločností a prevádzkovateľov platieb.</li>
          <li>Kupujúci má právo nahliadať do svojich údajov, opravovať ich a požadovať ich vymazanie.</li>
          <li>
            Stránka využíva súbory cookies vrátane analytického nástroja Microsoft Clarity
            (teplotné mapy, záznamy relácií), ktorý sa načítava výlučne po udelení súhlasu v cookie
            banneri. Podrobnosti nájdete v dokumente{" "}
            <A href="/sk/polityka-prywatnosci#sek-9">Ochrana osobných údajov</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat s AI asistentom", title: "Chat", accent: "s AI asistentom",
      body: (
        <OL>
          <li>
            Na stránke kalkmate.pl Predávajúci sprístupňuje bezplatnú službu poskytovanú elektronickými prostriedkami:
            chat s asistentom, ktorého odpovede generuje <B>umelá inteligencia (AI)</B>.
            Asistent nie je človek. Odpovedá na otázky o produktoch, objednávkach a fungovaní kalkulačky.
          </li>
          <li>
            Na začatie konverzácie je potrebné: webový prehliadač so zapnutým JavaScriptom, uvedenie e-mailovej
            adresy, potvrdenie, že používateľ nie je automat (overenie prebieha v prehliadači), a súhlas s týmto
            paragrafom. Zmluva o poskytovaní služby sa uzatvára okamihom začatia konverzácie a zaniká
            okamihom jej ukončenia (tlačidlo „Ukončiť“ alebo zatvorenie stránky). Používateľ môže chat
            kedykoľvek prestať používať.
          </li>
          <li>
            Odpovede asistenta majú výlučne informatívny charakter, môžu obsahovať chyby a nepredstavujú ponuku
            v zmysle poľského Občianskeho zákonníka ani prejav vôle Predávajúceho. V prípade rozporu sú záväzné
            tieto obchodné podmienky, opis produktu na stránke a informácie uvedené v potvrdení objednávky.
            Asistent nemá prístup k objednávkam ani účtom — záležitosti konkrétnych objednávok, vrátenia tovaru
            a reklamácií je potrebné smerovať na adresu kontakt@kalkmate.pl.
          </li>
          <li>
            Predávajúci môže na otázku z chatu odpovedať e-mailom na uvedenú adresu, najmä ak asistent
            odpoveď nepozná.
          </li>
          <li>
            V chate je zakázané posielať protiprávny či urážlivý obsah alebo obsah porušujúci práva tretích osôb,
            ako aj osobitné kategórie osobných údajov, heslá, údaje platobných kariet a AI kód kalkulačky. Predávajúci
            môže zablokovať konverzáciu porušujúcu tieto pravidlá a uplatňovať limity počtu správ.
          </li>
          <li>
            Asistent môže sám ponúknuť pomoc zobrazením krátkej správy vedľa tlačidla chatu (napr. po určitom
            čase strávenom na stránke alebo pri cenníku). Takáto správa sa zobrazí najviac dvakrát počas návštevy
            a po jej zatvorení sa už znova nezobrazí.
          </li>
          <li>
            Obsah konverzácií, e-mailová adresa a technické informácie (stránka, z ktorej bola správa odoslaná, prehliadač)
            sa ukladajú a sú prístupné Predávajúcemu a ním povereným osobám na účely vybavovania otázok
            a zlepšovania zákazníckej podpory. Ak používateľ udelil súhlas s analytickými cookies, ku konverzácii
            sa priraďuje aj priebeh návštevy stránky (navštívené podstránky a zobrazené sekcie) a
            identifikátor záznamu relácie v Microsoft Clarity. Podrobnosti, právne základy a dobu uchovávania
            (12 mesiacov od poslednej správy) opisuje dokument{" "}
            <A href="/sk/polityka-prywatnosci#sek-3">Ochrana osobných údajov</A>.
          </li>
          <li>
            Osoby mladšie ako 16 rokov môžu chat používať so súhlasom rodiča alebo zákonného zástupcu.
          </li>
          <li>
            Reklamácie týkajúce sa fungovania chatu možno podávať na adresu kontakt@kalkmate.pl. Predávajúci
            ich vybavuje v lehote 14 dní.
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
            Účastníkom partnerského programu („Partner“) môže byť registrovaný používateľ služby kalkmate.pl
            s potvrdenou e-mailovou adresou. Partner si v zákazníckom paneli vytvorí jeden vlastný partnerský kód
            (4 až 16 znakov: písmená A–Z a číslice).
          </li>
          <li>
            Kupujúci, ktorý pri objednávke zadá partnerský kód, dostane <B>zľavu 7%</B>{" "}
            z ceny produktov. Partnerský kód nemožno kombinovať s inými zľavovými kupónmi (objednávkový formulár
            prijíma jeden kód). Partner nemôže použiť vlastný kód.
          </li>
          <li>
            Za každú zaplatenú objednávku s kódom dostane Partner províziu vypočítanú z hodnoty produktov po zľave,
            bez nákladov na doručenie. Výška provízie závisí od úrovne Partnera, ktorá sa určuje podľa počtu kusov
            predaných s jeho kódom pred danou objednávkou:
            <TierTable
              head={["Úroveň", "Predané kusy", "Provízia"]}
              rows={[
                ["Štart", "0–2", "5%"],
                ["Bronz", "3–9", "7%"],
                ["Striebro", "10–24", "9%"],
                ["Zlato", "25–49", "11%"],
                ["Diamant", "od 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Provízie sa zúčtovávajú v poľských zlotých (PLN); hodnota objednávok v EUR sa prepočítava pevným kurzom 4,25 PLN za 1 EUR.
            </span>
          </li>
          <li>
            Provízia je k dispozícii po 30 dňoch od zaplatenia objednávky. Provízia sa ruší v prípade
            zrušenia objednávky, vrátenia platby alebo sporu týkajúceho sa platby — aj vtedy, ak už bola
            vymenená alebo vyplatená; zostatok Partnera sa potom môže stať záporným a vyrovnáva sa z ďalších provízií.
          </li>
          <li>
            Dostupné prostriedky môže Partner: (a) vymeniť za AI tokeny — od 10 PLN, v kurze 1 PLN = 65 000 tokenov,
            okamžite; (b) nechať vyplatiť prevodom na bankový účet — od 100 PLN, iba ak je Partner
            plnoletý. Výplata sa zvyčajne uskutoční do 7 pracovných dní. Pred výplatou môže Predávajúci
            požiadať o údaje potrebné na daňové zúčtovanie.
          </li>
          <li>
            Zakázané je: rozosielanie spamu, vydávanie sa za KalkMate alebo Predávajúceho, reklama vo vyhľadávačoch
            na kľúčové slová obsahujúce značku KalkMate, odporúčanie samému sebe a zadávanie fiktívnych objednávok. V prípade
            porušenia môže Predávajúci partnerský kód deaktivovať a zrušiť neoprávnene pripísané provízie.
          </li>
          <li>
            Predávajúci môže zmeniť podmienky partnerského programu s predstihom 14 dní, o čom informuje na stránke.
            Zmeny sa nevzťahujú na provízie pripísané pred nadobudnutím ich účinnosti.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Záverečné ustanovenia", title: "Záverečné", accent: "ustanovenia",
      body: (
        <OL>
          <li>Vo veciach neupravených týmito obchodnými podmienkami sa uplatnia ustanovenia poľského Občianskeho zákonníka, poľského zákona o právach spotrebiteľa a poľského zákona o poskytovaní služieb elektronickými prostriedkami.</li>
          <li>Predávajúci si vyhradzuje právo tieto obchodné podmienky zmeniť. Zmeny nadobúdajú účinnosť dňom zverejnenia na stránke.</li>
          <li>Všetky spory bude rozhodovať súd príslušný podľa sídla Predávajúceho.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Ďakujeme za dôveru a za kúpu KalkMate. S otázkami k objednávke, vráteniu tovaru
      alebo reklamácii sme vám k dispozícii na adrese kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Platné od · 2026-01-01 · posledná zmena 2026-10-28 (§9 partnerský program)",
  otherDocLabel: "→ Ochrana osobných údajov",
  homeLabel: "← Hlavná stránka",
};

export default doc;
