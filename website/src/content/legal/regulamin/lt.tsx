import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie litewskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Parduotuvės taisyklės: užsakymai, grąžinimai ir garantija | KalkMate",
  metaDescription:
    "KalkMate parduotuvės taisyklės: užsakymai, mokėjimai (Przelewy24, kortelė), nemokamas InPost pristatymas, 14 dienų grąžinimui, 24 mėnesių garantija ir pokalbis su DI asistentu.",
  badge: "Atitinka Lenkijos vartotojų teisių įstatymą",
  dateLabel: "Galioja nuo · 2026-01-01",
  eyebrow: "[ taisyklės ] · 10 skyrių",
  h1: "Parduotuvės",
  h1Accent: "taisyklės",
  intro: "Užsakymų pateikimo, mokėjimo, pristatymo, grąžinimo ir pretenzijų teikimo internetinėje parduotuvėje kalkmate.pl tvarka.",
  bindingNote: (
    <>
      Tai informacinis vertimas, pateikiamas jūsų patogumui. Teisiškai privaloma yra lenkiška šių taisyklių
      versija — esant neatitikimų, viršenybę turi <A href="/regulamin">lenkiška versija</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Bendrosios nuostatos", title: "Bendrosios", accent: "nuostatos",
      body: (
        <>
          <P>
            Šios taisyklės nustato produktų pardavimo internetinėje parduotuvėje, pasiekiamoje adresu
            kalkmate.pl, tvarką. Parduotuvę valdo <B>Kacper Popko</B>, vykdantis ūkinę veiklą
            įmonės pavadinimu <B>KAJPA Kacper Popko</B>,
            toliau — „Pardavėjas“.
          </P>
          <CompanyBox
            rows={[
              { label: "Mokesčių kodas (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Buveinės adresas", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Užsakymai", title: "Užsakymai", accent: "",
      body: (
        <OL>
          <li>Užsakymai priimami per interneto svetainę kalkmate.pl visą parą, 7 dienas per savaitę.</li>
          <li>Pateikdamas užsakymą Pirkėjas sutinka su šiomis taisyklėmis.</li>
          <li>Pateikęs užsakymą Pirkėjas gauna patvirtinimą nurodytu el. pašto adresu.</li>
          <li>Pardavėjas pasilieka teisę pagrįstais atvejais atsisakyti vykdyti užsakymą.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Kainos ir mokėjimai", title: "Kainos", accent: "ir mokėjimai",
      body: (
        <OL>
          <li>Visos svetainėje nurodytos kainos yra galutinės (su PVM).</li>
          <li>Mokėjimus aptarnauja Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Galimi mokėjimo būdai: mokėjimo kortelė, BLIK, banko pavedimas ir kiti Przelewy24 siūlomi būdai.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Vykdymas ir pristatymas", title: "Vykdymas", accent: "ir pristatymas",
      body: (
        <OL>
          <li>KalkMate produktas gaminamas pagal užsakymą — tai nuosava gamyba.</li>
          <li>Užsakymas įvykdomas per 4 savaites nuo mokėjimo įskaitymo. Įprastas vykdymo laikas — 1–2 savaitės.</li>
          <li>Pristatymas Lenkijoje vykdomas per InPost (į InPost paštomatą — Paczkomat). Pristatymo kaina Lenkijoje: 0 PLN.</li>
          <li>Pristatymas į užsienį (ES šalys): 20 EUR. Pristatymas už ES ribų: 35 EUR.</li>
          <li>Išsiuntus siuntą Pirkėjas gauna jos sekimo numerį.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Teisė atsisakyti sutarties", title: "Teisė", accent: "atsisakyti sutarties",
      body: (
        <>
          <P>
            Vartotojas turi teisę per 14 kalendorinių dienų atsisakyti nuotoliniu būdu sudarytos sutarties
            nenurodydamas priežasties, išskyrus toliau aprašytą išimtį.
          </P>
          <Callout title="Išimtis — pagal užsakymą personalizuotas įrenginys">
            <CalloutP>
              Kiekvienas KalkMate įrenginio egzempliorius prieš išsiuntimą individualiai personalizuojamas
              Vartotojo pageidavimu: (a) į jį įrašomas Vartotojo užsakymo formoje pasirinktas DI funkcijų
              atrakinimo kodas ir (b) ant to egzemplioriaus etiketės išspausdinamas Vartotojo nurodytas
              vardas / slapyvardis. Pagal{" "}
              <B>2014 m. gegužės 30 d. Lenkijos vartotojų teisių įstatymo 38 straipsnio 3 punktą</B>,
              teisė atsisakyti sutarties netaikoma daiktui, pagamintam pagal vartotojo specifikaciją arba
              skirtam jo individualiems poreikiams tenkinti. Ši informacija ir reikalavimas išreikšti
              atskirą sutikimą Vartotojui pateikiami prieš sudarant sutartį, užsakymo formoje.
            </CalloutP>
            <CalloutP className="mt-3">
              Ši išimtis <B>netaikoma</B> DI žetonų paketų
              (papildymų) pirkimams — jiems teisė atsisakyti sutarties taikoma bendra tvarka.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Toliau pateiktos dalys taikomos tais atvejais, kai teisė atsisakyti sutarties galioja
              (t. y. kitiems pirkiniams nei personalizuotas KalkMate įrenginys):
            </P>
          </div>
          <OL>
            <li>Sutarties atsisakymo terminas baigiasi praėjus 14 dienų nuo dienos, kurią Vartotojas įgijo daikto valdymą.</li>
            <li>Norėdamas pasinaudoti teise atsisakyti sutarties, Vartotojas turi pranešti Pardavėjui apie savo sprendimą el. paštu adresu: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Prekę reikia grąžinti adresu: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Mokėjimas grąžinamas per 14 dienų nuo grąžinamos prekės gavimo dienos.
              Jeigu Vartotojas aiškiai paprašė pradėti teikti paslaugą (pvz., DI sprendimus)
              nepasibaigus sutarties atsisakymo terminui, Pardavėjas turi teisę iš grąžinamos sumos
              išskaičiuoti atlyginimą už paslaugas, faktiškai suteiktas iki sutarties atsisakymo (Lenkijos
              vartotojų teisių įstatymo 35 straipsnis), o jei grąžinamas daiktas turi naudojimo žymių,
              viršijančių tai, kas būtina prekės pobūdžiui ir veikimui nustatyti, —
              taip pat sumą, atitinkančią jo vertės sumažėjimą (Lenkijos vartotojų teisių įstatymo 34 straipsnio 4 dalis).
            </li>
            <li>Teisė teikti pretenzijas pagal Pardavėjo atsakomybę už prekės trūkumus (rękojmia) ir garantiją (§6) galioja nepriklausomai nuo pirmiau nurodytų nuostatų ir jomis neribojama.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Pretenzijos ir garantija", title: "Pretenzijos", accent: "ir garantija",
      body: (
        <OL>
          <li>Produktams suteikiama 24 mėnesių Pardavėjo garantija nuo pirkimo dienos.</li>
          <li>Pretenzijas reikia teikti el. paštu adresu: <B>kontakt@kalkmate.pl</B>, nurodant užsakymo numerį ir gedimo aprašymą.</li>
          <li>Pardavėjas pretenzijas išnagrinėja per 14 kalendorinių dienų.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Asmens duomenų apsauga", title: "Duomenų", accent: "apsauga",
      body: (
        <OL>
          <li>Asmens duomenų valdytojas yra Pardavėjas.</li>
          <li>Asmens duomenys tvarkomi tik užsakymui įvykdyti ir neatskleidžiami tretiesiems asmenims, išskyrus kurjerių įmones ir mokėjimo operatorius.</li>
          <li>Pirkėjas turi teisę susipažinti su savo duomenimis, juos ištaisyti ir reikalauti juos ištrinti.</li>
          <li>
            Svetainė naudoja slapukus, įskaitant analitikos įrankį Microsoft Clarity
            (šilumos žemėlapiai, sesijų įrašai), kuris įkeliamas tik davus sutikimą slapukų
            juostoje. Daugiau informacijos pateikiama{" "}
            <A href="/lt/polityka-prywatnosci#sek-9">Privatumo politikoje</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Pokalbis su DI asistentu", title: "Pokalbis", accent: "su DI asistentu",
      body: (
        <OL>
          <li>
            Svetainėje kalkmate.pl Pardavėjas teikia nemokamą elektroninę paslaugą:
            pokalbį su asistentu, kurio atsakymus generuoja <B>dirbtinis intelektas (DI)</B>.
            Asistentas nėra žmogus. Jis atsako į klausimus apie produktus, užsakymus ir skaičiuotuvo veikimą.
          </li>
          <li>
            Pokalbiui pradėti reikia: interneto naršyklės su įjungtu JavaScript, nurodyti el. pašto
            adresą, patvirtinti, kad naudotojas nėra automatas (patikra atliekama naršyklėje), ir
            sutikti su šiuo paragrafu. Paslaugos teikimo sutartis sudaroma pradėjus pokalbį
            ir nutrūksta jį baigus (mygtukas „Baigti“ arba puslapio uždarymas). Naudotojas gali
            bet kada nustoti naudotis pokalbiu.
          </li>
          <li>
            Asistento atsakymai yra tik informacinio pobūdžio, gali būti klaidingi ir nėra pasiūlymas
            pagal Lenkijos civilinį kodeksą ar Pardavėjo valios pareiškimas. Esant neatitikimų, privalomos yra
            šios taisyklės, produkto aprašymas svetainėje ir užsakymo patvirtinime pateikta informacija.
            Asistentas neturi prieigos prie užsakymų ar paskyrų — klausimus dėl konkrečių užsakymų, grąžinimų ir pretenzijų reikia
            siųsti adresu kontakt@kalkmate.pl.
          </li>
          <li>
            Pardavėjas gali atsakyti į pokalbyje užduotą klausimą el. laišku nurodytu adresu, ypač kai
            asistentas nežino atsakymo.
          </li>
          <li>
            Pokalbyje draudžiama siųsti neteisėtą, įžeidžiantį ar trečiųjų asmenų teises pažeidžiantį turinį,
            taip pat ypatingus asmens duomenis, slaptažodžius, mokėjimo kortelių duomenis ir skaičiuotuvo DI kodą. Pardavėjas
            gali užblokuoti šias taisykles pažeidžiantį pokalbį ir taikyti žinučių skaičiaus apribojimus.
          </li>
          <li>
            Asistentas gali pats pasiūlyti pagalbą, parodydamas trumpą žinutę šalia pokalbio mygtuko (pvz., praėjus tam tikram
            laikui svetainėje arba prie kainoraščio). Tokia žinutė vieno apsilankymo metu parodoma ne daugiau kaip du kartus ir
            jos uždarius nebepasirodo.
          </li>
          <li>
            Pokalbių turinys, el. pašto adresas ir techninė informacija (puslapis, iš kurio išsiųsta žinutė, naršyklė)
            išsaugomi ir prieinami Pardavėjui bei jo įgaliotiems asmenims, kad būtų galima atsakyti į klausimus
            ir gerinti klientų aptarnavimą. Jeigu naudotojas sutiko su analitiniais slapukais, prie pokalbio
            taip pat priskiriama apsilankymo svetainėje eiga (aplankyti puslapiai ir peržiūrėtos skiltys) ir
            sesijos įrašo Microsoft Clarity identifikatorius. Išsamią informaciją, teisinius pagrindus ir saugojimo laikotarpį
            (12 mėnesių nuo paskutinės žinutės) aprašo{" "}
            <A href="/lt/polityka-prywatnosci#sek-3">Privatumo politika</A>.
          </li>
          <li>
            Asmenys, kuriems dar nėra 16 metų, gali naudotis pokalbiu tėvų ar teisėto globėjo sutikimu.
          </li>
          <li>
            Pretenzijas dėl pokalbio veikimo galima teikti adresu kontakt@kalkmate.pl. Pardavėjas jas išnagrinėja
            per 14 dienų.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Partnerių programa", title: "Partnerių", accent: "programa",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Partnerių programos dalyviu („Partneriu“) gali būti registruotas svetainės kalkmate.pl naudotojas
            su patvirtintu el. pašto adresu. Partneris kliento skydelyje susikuria vieną nuosavą partnerio kodą
            (nuo 4 iki 16 simbolių: raidės A–Z ir skaitmenys).
          </li>
          <li>
            Pirkėjas, užsakymo metu nurodęs partnerio kodą, gauna <B>7% nuolaidą</B>{" "}
            produktų kainai. Partnerio kodas nejungiamas su kitais nuolaidų kuponais (užsakymo forma
            priima vieną kodą). Partneris negali naudoti savo paties kodo.
          </li>
          <li>
            Už kiekvieną apmokėtą užsakymą su kodu Partneris gauna komisinį atlyginimą, skaičiuojamą nuo produktų vertės po nuolaidos,
            be pristatymo išlaidų. Komisinio atlyginimo dydis priklauso nuo Partnerio lygio, nustatomo pagal vienetų,
            parduotų su jo kodu iki atitinkamo užsakymo, skaičių:
            <TierTable
              head={["Lygis", "Parduoti vienetai", "Komisinis"]}
              rows={[
                ["Startas", "0–2", "5%"],
                ["Bronza", "3–9", "7%"],
                ["Sidabras", "10–24", "9%"],
                ["Auksas", "25–49", "11%"],
                ["Deimantas", "nuo 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Komisiniai atlyginimai apskaičiuojami Lenkijos zlotais (PLN); užsakymų vertė EUR perskaičiuojama pastoviu 4,25 PLN už 1 EUR kursu.
            </span>
          </li>
          <li>
            Komisinis atlyginimas tampa prieinamas praėjus 30 dienų nuo užsakymo apmokėjimo. Komisinis atlyginimas atšaukiamas, jei
            užsakymas atšaukiamas, mokėjimas grąžinamas arba kyla ginčas dėl mokėjimo — taip pat ir tuo atveju, kai jis jau buvo
            iškeistas ar išmokėtas; tokiu atveju Partnerio balansas gali tapti neigiamas ir yra išlyginamas iš vėlesnių komisinių atlyginimų.
          </li>
          <li>
            Prieinamas lėšas Partneris gali: (a) iškeisti į DI žetonus — nuo 10 PLN, kursu 1 PLN = 65 000 žetonų,
            iš karto; (b) išsimokėti banko pavedimu į sąskaitą — nuo 100 PLN, tik jei Partneris yra
            pilnametis. Išmoka paprastai įvykdoma per 7 darbo dienas. Prieš išmokėdamas Pardavėjas gali
            paprašyti duomenų, būtinų mokestiniams atsiskaitymams.
          </li>
          <li>
            Draudžiama: siųsti brukalą (spam), apsimesti KalkMate ar Pardavėju, reklamuotis paieškos sistemose
            pagal raktažodžius, kuriuose yra prekės ženklas KalkMate, rekomenduoti pačiam sau ir teikti fiktyvius užsakymus. Pažeidimų
            atveju Pardavėjas gali išjungti partnerio kodą ir anuliuoti nepagrįstai priskaičiuotus komisinius atlyginimus.
          </li>
          <li>
            Pardavėjas gali pakeisti partnerių programos sąlygas, apie tai paskelbęs svetainėje prieš 14 dienų.
            Pakeitimai netaikomi komisiniams atlyginimams, priskaičiuotiems iki jų įsigaliojimo.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Baigiamosios nuostatos", title: "Baigiamosios", accent: "nuostatos",
      body: (
        <OL>
          <li>Klausimams, kurių nereglamentuoja šios taisyklės, taikomos Lenkijos civilinio kodekso, Lenkijos vartotojų teisių įstatymo ir Lenkijos elektroninių paslaugų teikimo įstatymo nuostatos.</li>
          <li>Pardavėjas pasilieka teisę keisti taisykles. Pakeitimai įsigalioja jų paskelbimo svetainėje dieną.</li>
          <li>Visi ginčai sprendžiami teisme, kurio jurisdikcijai priklauso Pardavėjo buveinė.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Dėkojame už pasitikėjimą ir KalkMate pirkimą. Jei turite klausimų dėl užsakymo,
      grąžinimo ar pretenzijos — esame pasiekiami adresu kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Galioja nuo · 2026-01-01 · paskutinis pakeitimas 2026-10-28 (§9 partnerių programa)",
  otherDocLabel: "→ Privatumo politika",
  homeLabel: "← Pagrindinis puslapis",
};

export default doc;
