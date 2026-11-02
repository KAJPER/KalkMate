import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie litewskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Privatumo politika: BDAR ir slapukai | KalkMate",
  metaDescription:
    "Kaip KalkMate saugo jūsų duomenis: ką renkame ir kodėl, kiek laiko saugome, slapukai ir Microsoft Clarity, pokalbis su DI ir jūsų teisės pagal BDAR.",
  badge: "BDAR · atitinka ES 2016/679",
  dateLabel: "Atnaujinta · 2026-10-28",
  eyebrow: "[ privatumas ] · 14 skyrių",
  h1: "Privatumo",
  h1Accent: "politika",
  intro: "Kokius duomenis renkame, kodėl juos tvarkome, kas turi prie jų prieigą ir kaip galite pasinaudoti savo teisėmis. Pagal BDAR.",
  bindingNote: (
    <>
      Tai informacinis vertimas, pateikiamas jūsų patogumui. Teisiškai privaloma yra lenkiška šios privatumo
      politikos versija — esant neatitikimų, viršenybę turi <A href="/polityka-prywatnosci">lenkiška versija</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Bendrosios nuostatos", title: "Bendrosios", accent: "nuostatos",
      body: (
        <>
          <P>
            Ši Privatumo politika nustato asmens duomenų tvarkymo ir apsaugos taisykles
            Naudotojams, besinaudojantiems svetaine KalkMate.pl (toliau — „Svetainė“), kurią valdo
            KalkMate (toliau — „Duomenų valdytojas“).
          </P>
          <Gap>
            <P>
              Duomenų valdytojas ypač daug dėmesio skiria Naudotojų privatumo gerbimui
              ir jų asmens duomenų saugumui. Asmens duomenys tvarkomi laikantis
              2016 m. balandžio 27 d. Europos Parlamento ir Tarybos reglamento (ES) 2016/679
              (Bendrasis duomenų apsaugos reglamentas, BDAR) ir nacionalinės teisės aktų.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Duomenų valdytojas", title: "Duomenų", accent: "valdytojas",
      body: (
        <>
          <P>Per Svetainę renkamų asmens duomenų valdytojas yra:</P>
          <CompanyBox
            rows={[
              { label: "Mokesčių kodas (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Buveinės adresas", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Trumpasis pavadinimas", value: "KAJPA", mono: true },
              { label: "El. paštas", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefonas", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Asmens duomenų tvarkymo klausimais su Duomenų valdytoju galima susisiekti:</P>
          </Gap>
          <UL>
            <li>el. paštu: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefonu: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>per svetainėje esančią kontaktinę formą.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Renkami duomenys", title: "Renkami", accent: "duomenys",
      body: (
        <>
          <P>Vykdydami Svetainės veiklą renkame šių kategorijų asmens duomenis:</P>

          <SubH>3.1. Naudotojo pateikiami duomenys</SubH>
          <UL>
            <li>vardas ir pavardė,</li>
            <li>el. pašto adresas,</li>
            <li>telefono numeris,</li>
            <li>InPost atsiėmimo punkto (paštomato Paczkomat) adresas.</li>
          </UL>

          <SubH>3.2. Automatiškai renkami duomenys</SubH>
          <UL>
            <li>IP adresas,</li>
            <li>naršyklės tipas ir versija,</li>
            <li>operacinė sistema,</li>
            <li>duomenys apie veiklą Svetainėje (lankyti puslapiai, apsilankymo trukmė),</li>
            <li>techninė informacija apie įrenginį.</li>
          </UL>

          <SubH>3.3. Sandorių duomenys</SubH>
          <UL>
            <li>užsakymų istorija,</li>
            <li>mokėjimo duomenys (tvarkomi Stripe),</li>
            <li>informacija apie DI žetonų balansą, pirkimus ir aktyvavimus (įskaitant aktyvuotus licencijos kodus iš dėžutės),</li>
            <li>pokalbių su AI Chat istorija.</li>
          </UL>

          <SubH>3.4. Pokalbis su DI asistentu svetainėje</SubH>
          <P>Kai pradedate pokalbį svetainės pokalbių lange (taisyklių §8), tvarkome:</P>
          <UL>
            <li>pokalbio pradžioje nurodytą el. pašto adresą,</li>
            <li>jūsų žinučių ir asistento atsakymų turinį su data ir laiku,</li>
            <li>puslapio, iš kurio išsiųsta žinutė, adresą, puslapio kalbą ir informaciją apie naršyklę (user-agent),</li>
            <li>
              <B>tik jei sutikote su analitiniais slapukais</B>: apsilankymo
              svetainėje eigą (aplankytus puslapius ir peržiūrėtas skiltis, su laiku) ir pokalbio identifikatorių,
              pridedamą prie sesijos įrašo Microsoft Clarity — taip galime matyti, ko ieškojote,
              ir geriau atsakyti. Be šio sutikimo apsilankymo eiga nerenkama.
            </li>
          </UL>
          <P>
            Patvirtinimas „Aš ne robotas“ atlieka skaičiavimą jūsų naršyklėje — jis nesinaudoja išorinių
            įmonių paslaugomis ir neįrašo slapukų. Žinučių turinys perduodamas DI modelio teikėjui
            (žr. 6 skyrių) tik atsakymui sugeneruoti.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Tikslas ir teisinis pagrindas", title: "Tvarkymo", accent: "tikslas",
      body: (
        <>
          <P>Tvarkymo tikslų ir juos atitinkančių BDAR teisinių pagrindų apžvalga.</P>
          <BasisTable
            head={["Tvarkymo tikslas", "Teisinis pagrindas pagal BDAR"]}
            rows={[
              ["Pirkimo–pardavimo sutarties vykdymas", "BDAR 6 straipsnio 1 dalies b punktas"],
              ["Mokėjimų aptarnavimas", "BDAR 6 straipsnio 1 dalies b punktas"],
              ["AI Chat paslaugos teikimas", "BDAR 6 straipsnio 1 dalies b punktas"],
              ["Pokalbis su DI asistentu svetainėje (pokalbis, el. paštas, atsakymas el. laišku)", "BDAR 6 straipsnio 1 dalies b punktas (paslauga jūsų prašymu)"],
              ["Pokalbių peržiūra siekiant gerinti aptarnavimą ir asistentą", "BDAR 6 straipsnio 1 dalies f punktas (teisėtas interesas)"],
              ["Apsilankymo eigos ir Clarity įrašo priskyrimas pokalbiui", "BDAR 6 straipsnio 1 dalies a punktas (sutikimas su analitiniais slapukais)"],
              ["Produktų siuntimas", "BDAR 6 straipsnio 1 dalies b punktas"],
              ["Pretenzijų nagrinėjimas", "BDAR 6 straipsnio 1 dalies c punktas (teisinė prievolė)"],
              ["Sąskaitų faktūrų išrašymas", "BDAR 6 straipsnio 1 dalies c punktas (teisinė prievolė)"],
              ["Tiesioginė rinkodara", "BDAR 6 straipsnio 1 dalies f punktas (teisėtas interesas)"],
              ["Analitika ir statistika", "BDAR 6 straipsnio 1 dalies f punktas (teisėtas interesas)"],
              ["Naujienlaiškis (jei duotas sutikimas)", "BDAR 6 straipsnio 1 dalies a punktas (sutikimas)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Saugojimo laikotarpis", title: "Saugojimo", accent: "laikotarpis",
      body: (
        <>
          <P>
            Asmens duomenis saugome teisės aktų reikalaujamą laikotarpį arba tiek laiko,
            kiek būtina tvarkymo tikslams pasiekti:
          </P>
          <ULWide>
            <li><B>Sandorių duomenys ir sąskaitos faktūros:</B> 5 metus nuo kalendorinių metų, kuriais atsirado mokestinė prievolė, pabaigos.</li>
            <li><B>Su sutartimi susiję duomenys:</B> sutarties galiojimo laikotarpiu ir teisės aktų reikalaujamą laiką (pvz., 6 metus dėl reikalavimų senaties).</li>
            <li><B>Su DI žetonais susiję duomenys</B> (balansas, paketų pirkimai, aktyvuoti kodai)<B>:</B> visą paskyros naudojimo laiką ir 3 metus po jos ištrynimo.</li>
            <li><B>AI Chat istorija:</B> visą paskyros naudojimo laiką (kol naudotojas ištrina pokalbį ar paskyrą) ir iki 30 dienų po paskyros ištrynimo.</li>
            <li><B>Rinkodaros duomenys (sutikimas):</B> iki sutikimo atšaukimo arba prieštaravimo pateikimo.</li>
            <li><B>Analitiniai duomenys:</B> iki 25 mėnesių nuo paskutinės veiklos.</li>
            <li><B>Svetainės pokalbiai</B> (el. paštas, turinys, apsilankymo eiga)<B>:</B> 12 mėnesių nuo paskutinės pokalbio žinutės, vėliau ištrinami automatiškai; anksčiau — jūsų prašymu.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Duomenų teikimas", title: "Duomenų", accent: "teikimas",
      body: (
        <>
          <P>Asmens duomenys gali būti teikiami šių kategorijų gavėjams:</P>
          <ULWide>
            <li><B>Stripe</B> – mokėjimų operatorius (mokėjimo kortelėmis atliekamų operacijų, įskaitant DI žetonų paketų pirkimus, tvarkymas).</li>
            <li><B>InPost</B> – kurjerių įmonė (produktų pristatymas į paštomatus Paczkomat).</li>
            <li><B>Resend</B> – el. pašto paslauga (sandorių pranešimų ir prisijungimo nuorodų (magic links) siuntimas).</li>
            <li><B>Google AI (Gemini)</B> – AI Chat paslaugos teikėjas (užklausų pokalbių robote tvarkymas).</li>
            <li><B>OpenRouter, Inc.</B> (JAV) – tarpininkas, suteikiantis prieigą prie DI modelių (be kita ko, Google Gemini); gauna svetainės pokalbio ir AI Chat žinučių turinį atsakymui sugeneruoti. Jam neperduodame el. pašto adreso.</li>
            <li><B>Microsoft Clarity</B> – analitikos įrankis (šilumos žemėlapiai, sesijų įrašai), naudojamas tik davus sutikimą su analitiniais slapukais — žr. 9 skyrių.</li>
            <li><B>Prieglobos paslaugų teikėjas</B> – duomenų saugojimas VPS serveriuose.</li>
            <li><B>PostgreSQL duomenų bazės paslaugų teikėjas</B> – naudotojų duomenų saugojimas.</li>
            <li><B>Pagal įstatymą įgalioti subjektai</B> – valstybės institucijos, teismai (jei to reikalauja teisės aktai).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Visi duomenų gavėjai veikia pagal asmens duomenų tvarkymo
              sutartis ir privalo užtikrinti jų konfidencialumą bei taikyti
              tinkamas saugumo priemones.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Perdavimas už EEE ribų", title: "Perdavimas", accent: "už EEE ribų",
      body: (
        <>
          <P>
            Kai kurie paslaugų teikėjai (pvz., Stripe, Google AI, OpenRouter, Microsoft Clarity) gali tvarkyti
            duomenis už Europos ekonominės erdvės (EEE) ribų. Tokiais atvejais:
          </P>
          <UL>
            <li>Užtikriname tinkamas apsaugos priemones pagal BDAR (Europos Komisijos patvirtintas standartines sutarčių sąlygas).</li>
            <li>Duomenys perduodami tik į šalis, užtikrinančias tinkamą duomenų apsaugos lygį, arba subjektams, taikantiems tinkamas apsaugos garantijas.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Naudotojų teisės", title: "Naudotojų", accent: "teisės",
      body: (
        <>
          <P>Pagal BDAR jūs turite šias teises:</P>

          <SubH>8.1. Teisė susipažinti su duomenimis — BDAR 15 straipsnis</SubH>
          <P>
            Turite teisę gauti patvirtinimą, ar tvarkome jūsų asmens duomenis,
            o jei taip — susipažinti su jais ir gauti jų kopiją.
          </P>

          <SubH>8.2. Teisė reikalauti ištaisyti duomenis — BDAR 16 straipsnis</SubH>
          <P>
            Turite teisę reikalauti nedelsiant ištaisyti netikslius duomenis
            arba papildyti neišsamius duomenis.
          </P>

          <SubH>8.3. Teisė reikalauti ištrinti duomenis („teisė būti pamirštam“) — BDAR 17 straipsnis</SubH>
          <P>Tam tikrais atvejais turite teisę reikalauti ištrinti asmens duomenis.</P>

          <SubH>8.4. Teisė apriboti tvarkymą — BDAR 18 straipsnis</SubH>
          <P>Tam tikrais atvejais galite reikalauti apriboti duomenų tvarkymą.</P>

          <SubH>8.5. Teisė į duomenų perkeliamumą — BDAR 20 straipsnis</SubH>
          <P>
            Turite teisę gauti savo duomenis susistemintu, įprastai naudojamu ir kompiuterio
            skaitomu formatu ir persiųsti juos kitam duomenų valdytojui.
          </P>

          <SubH>8.6. Teisė nesutikti — BDAR 21 straipsnis</SubH>
          <P>
            Turite teisę nesutikti, kad duomenys būtų tvarkomi rinkodaros tikslais
            arba remiantis teisėtu interesu.
          </P>

          <SubH>8.7. Teisė atšaukti sutikimą — BDAR 7 straipsnio 3 dalis</SubH>
          <P>
            Jei tvarkymas grindžiamas sutikimu, turite teisę jį bet kada
            atšaukti.
          </P>

          <SubH>8.8. Teisė pateikti skundą priežiūros institucijai — BDAR 77 straipsnis</SubH>
          <P>
            Turite teisę pateikti skundą Lenkijos Asmens duomenų apsaugos tarnybos pirmininkui (PUODO),
            jei manote, kad jūsų duomenų tvarkymas pažeidžia BDAR nuostatas.
          </P>
          <InfoBox title="PUODO · kontaktai">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Norėdami pasinaudoti pirmiau nurodytomis teisėmis, susisiekite su mumis el. paštu arba per kontaktinę formą.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Slapukai", title: "Slapukai", accent: "",
      body: (
        <>
          <SubH>9.1. Kas yra slapukai</SubH>
          <P>
            Slapukai (cookies) — tai nedideli tekstiniai failai, įrašomi į naudotojo įrenginį
            lankantis interneto svetainėje.
          </P>

          <SubH>9.2. Kokius slapukus naudojame</SubH>
          <ULWide>
            <li><B>Būtinieji</B> — užtikrina pagrindines svetainės funkcijas (naudotojo sesija, krepšelis, prisijungimas).</li>
            <li><B>Funkciniai</B> — įsimena jūsų nuostatas (pvz., tamsųjį režimą).</li>
            <li><B>Analitiniai</B> — padeda mums suprasti, kaip naudotojai naudojasi svetaine (šilumos žemėlapiai, sesijų įrašai, lankomumo statistika). Tam naudojame <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Rinkodaros</B> — naudojami reklamai personalizuoti (tik gavus sutikimą).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity įkeliamas tik davus sutikimą su analitiniais slapukais
            sutikimo juostoje („Priimti visus“). Įrankis įrenginyje įrašo, be kita ko,
            slapukus <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> ir <Mono>SM</Mono>, skirtus
            grįžtančiam naudotojui atpažinti, sesijoms įrašyti ir šilumos žemėlapiams generuoti. Duomenis
            tvarko Microsoft Corporation pagal{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">Microsoft Clarity privatumo politiką</A>.
            Sutikimą galima bet kada atšaukti išvalius sutikimo juostos duomenis
            naršyklės nustatymuose (localStorage) ir pasirinkus „Tik būtinuosius“.
          </P>

          <SubH>9.4. Pokalbio naudojama naršyklės atmintis</SubH>
          <P>
            Pokalbis su asistentu naršyklės atmintyje (localStorage) įrašo jūsų pokalbio identifikatorių, kad
            jį būtų galima tęsti perkrovus puslapį — tai būtina jūsų prašomos paslaugos veikimui,
            ir jis išnyksta paspaudus „Baigti“. Tik davus sutikimą su analitiniais slapukais pokalbis sessionStorage
            (iki skirtuko uždarymo) taip pat įrašo 3.4 punkte nurodytą aplankytų puslapių ir skilčių sąrašą.
          </P>

          <SubH>9.5. Slapukų valdymas</SubH>
          <P>
            Slapukus galite valdyti naršyklės nustatymuose. Tačiau reikia
            turėti omenyje, kad išjungus slapukus gali sutrikti Svetainės funkcionalumas
            (pvz., prisijungimas, pirkinių krepšelis).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Duomenų saugumas", title: "Saugumas", accent: "",
      body: (
        <>
          <P>
            Taikome tinkamas technines ir organizacines priemones, kad apsaugotume asmens
            duomenis nuo:
          </P>
          <UL>
            <li>neteisėtos prieigos,</li>
            <li>praradimo,</li>
            <li>sunaikinimo,</li>
            <li>neteisėto pakeitimo,</li>
            <li>neteisėto platinimo.</li>
          </UL>
          <Gap size={5}>
            <P>Visų pirma taikome:</P>
          </Gap>
          <UL>
            <li>SSL/TLS ryšio šifravimą (HTTPS),</li>
            <li>saugų slaptažodžių saugojimą (bcrypt algoritmas su druska),</li>
            <li>naudotojo sesijos apsaugą (HttpOnly, Secure slapukai),</li>
            <li>prieigos prie duomenų ribojimą tik įgaliotiems asmenims,</li>
            <li>reguliarius programinės įrangos ir sistemos atnaujinimus,</li>
            <li>infrastruktūros saugumo stebėseną,</li>
            <li>reguliarias duomenų bazės atsargines kopijas.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatizavimas ir profiliavimas", title: "Automatizavimas", accent: "",
      body: (
        <>
          <P>
            Svetainėje netaikome automatizuoto sprendimų priėmimo, įskaitant
            profiliavimą, kuris sukeltų teisinių pasekmių Naudotojams ar panašiu
            būdu reikšmingai paveiktų jų padėtį.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) ir svetainės pokalbio asistentas yra pagalbiniai
              įrankiai, kurie atsako į naudotojų užklausas, tačiau nepriima
              automatizuotų teisinį poveikį turinčių sprendimų. Pokalbiui priskirta apsilankymo
              eiga (tik gavus sutikimą) naudojama tik atsakymams pritaikyti ir svetainei tobulinti.
              Apie tai, kad bendraujate su DI, informuojame pokalbių lange.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Vaikų duomenys", title: "Vaikų", accent: "duomenys",
      body: (
        <>
          <P>
            Svetaine KalkMate.pl gali naudotis nepilnamečiai (vidurinių mokyklų
            mokiniai). Jei naudotojui dar nėra 18 metų, skaičiuotuvui pirkti ir
            AI Chat naudotis reikia tėvų ar teisėto globėjo sutikimo.
          </P>
          <Gap>
            <P>
              Sąmoningai nerenkame jaunesnių nei 13 metų vaikų asmens duomenų be
              tėvų / globėjų sutikimo.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Politikos pakeitimai", title: "Politikos", accent: "pakeitimai",
      body: (
        <>
          <P>
            Privatumo politika gali būti keičiama dėl technologijų plėtros,
            teisės aktų pakeitimų ar Svetainės veiklos pokyčių.
          </P>
          <Gap>
            <P>Apie visus esminius pakeitimus Naudotojus informuosime:</P>
          </Gap>
          <UL>
            <li>pranešimu Svetainės pagrindiniame puslapyje,</li>
            <li>el. laišku (registruotiems naudotojams).</li>
          </UL>
          <Gap>
            <P>
              Galiojanti Privatumo politikos versija visada pasiekiama adresu:{" "}
              <A href="/lt/polityka-prywatnosci">kalkmate.pl/lt/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Kontaktai", title: "Kontaktai", accent: "",
      body: (
        <>
          <P>
            Visus klausimus dėl asmens duomenų tvarkymo ir naudojimosi
            jums suteiktomis teisėmis prašome siųsti:
          </P>
          <UL>
            <li>El. paštu: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefonu: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>Per <A href="/lt/pomoc#kontakt">kontaktinę formą</A>{" "}svetainėje.</li>
          </UL>
          <Gap size={5}>
            <P>Įsipareigojame atsakyti į jūsų užklausas per 30 dienų nuo jų gavimo.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Dėkojame už pasitikėjimą ir naudojimąsi KalkMate.pl. Ypač daug dėmesio skiriame
      jūsų privatumo ir asmens duomenų saugumo apsaugai.
    </>
  ),
  footerNote: "Paskutinis atnaujinimas · 2026-10-28 (pokalbis su DI asistentu svetainėje)",
  otherDocLabel: "→ Taisyklės",
  homeLabel: "← Pagrindinis puslapis",
};

export default doc;
