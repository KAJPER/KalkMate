import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie portugalskie (pt_PT) pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Política de privacidade: RGPD e cookies | KalkMate",
  metaDescription:
    "Como a KalkMate protege os seus dados: o que recolhemos e para quê, durante quanto tempo os conservamos, cookies e Microsoft Clarity, chat com IA e os seus direitos ao abrigo do RGPD.",
  badge: "RGPD · em conformidade com o Regulamento (UE) 2016/679",
  dateLabel: "Atualização · 2026-10-28",
  eyebrow: "[ privacidade ] · 14 secções",
  h1: "Política",
  h1Accent: "de privacidade",
  intro: "Que dados recolhemos, por que razão os tratamos, quem tem acesso a eles e como pode exercer os seus direitos. Em conformidade com o RGPD.",
  bindingNote: (
    <>
      A presente tradução é disponibilizada apenas para sua conveniência. A versão juridicamente vinculativa
      é a polaca: em caso de divergência, prevalece a <A href="/polityka-prywatnosci">versão polaca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposições gerais", title: "Disposições", accent: "gerais",
      body: (
        <>
          <P>
            A presente Política de privacidade estabelece as regras de tratamento e proteção dos dados pessoais
            dos Utilizadores do sítio web KalkMate.pl (doravante «Serviço»), gerido pela
            KalkMate (doravante «Responsável pelo tratamento»).
          </P>
          <Gap>
            <P>
              O Responsável pelo tratamento atribui especial importância ao respeito pela privacidade dos Utilizadores
              e à segurança dos seus dados pessoais. Os dados pessoais são tratados em conformidade com o
              Regulamento (UE) 2016/679 do Parlamento Europeu e do Conselho, de 27 de abril de 2016
              (RGPD), e com a legislação nacional.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Responsável pelo tratamento", title: "Responsável", accent: "pelo tratamento",
      body: (
        <>
          <P>O responsável pelo tratamento dos dados pessoais recolhidos através do Serviço é:</P>
          <CompanyBox
            rows={[
              { label: "NIF polaco (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Sede", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Denominação abreviada", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefone", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>O contacto com o Responsável pelo tratamento em matéria de tratamento de dados pessoais pode ser feito através de:</P>
          </Gap>
          <UL>
            <li>e-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefone: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>formulário de contacto disponível no sítio web.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Dados recolhidos", title: "Dados", accent: "recolhidos",
      body: (
        <>
          <P>No âmbito da atividade do Serviço, recolhemos as seguintes categorias de dados pessoais:</P>

          <SubH>3.1. Dados fornecidos pelo utilizador</SubH>
          <UL>
            <li>nome e apelido,</li>
            <li>endereço de e-mail,</li>
            <li>número de telefone,</li>
            <li>endereço do ponto de recolha InPost (cacifo automático Paczkomat).</li>
          </UL>

          <SubH>3.2. Dados recolhidos automaticamente</SubH>
          <UL>
            <li>endereço IP,</li>
            <li>tipo e versão do navegador,</li>
            <li>sistema operativo,</li>
            <li>dados sobre a atividade no Serviço (páginas visitadas, duração da visita),</li>
            <li>informações técnicas sobre o dispositivo.</li>
          </UL>

          <SubH>3.3. Dados de transações</SubH>
          <UL>
            <li>histórico de encomendas,</li>
            <li>dados de pagamento (tratados pela Stripe),</li>
            <li>informações sobre o saldo, as compras e as ativações de tokens de IA (incluindo os códigos de licença da caixa que tenham sido ativados),</li>
            <li>histórico de conversas com o AI Chat.</li>
          </UL>

          <SubH>3.4. Chat com o assistente de IA no sítio web</SubH>
          <P>Quando inicia uma conversa na janela de chat do sítio web (Termos e condições, §8), tratamos:</P>
          <UL>
            <li>o endereço de e-mail indicado no início da conversa,</li>
            <li>o conteúdo das suas mensagens e das respostas do assistente, com data e hora,</li>
            <li>o endereço da subpágina a partir da qual a mensagem foi enviada, o idioma da página e informações sobre o navegador (user-agent),</li>
            <li>
              <B>apenas se tiver aceitado os cookies analíticos</B>: o percurso
              da visita ao sítio web (subpáginas visitadas e secções vistas, com a hora) e o identificador da conversa
              acrescentado à gravação da sessão no Microsoft Clarity; deste modo, podemos ver o que procurava
              e responder-lhe melhor. Sem este consentimento, o percurso da visita não é recolhido.
            </li>
          </UL>
          <P>
            A confirmação «Não sou um robô» efetua um cálculo no seu navegador: não recorre a serviços de
            empresas externas nem guarda cookies. O conteúdo das mensagens é transmitido ao fornecedor do modelo de IA
            (ver secção 6) exclusivamente para gerar a resposta.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Finalidade e fundamento jurídico", title: "Finalidade", accent: "do tratamento",
      body: (
        <>
          <P>Panorâmica das finalidades do tratamento e dos respetivos fundamentos jurídicos previstos no RGPD.</P>
          <BasisTable
            head={["Finalidade do tratamento", "Fundamento jurídico (RGPD)"]}
            rows={[
              ["Execução do contrato de compra e venda", "Artigo 6.º, n.º 1, alínea b), do RGPD"],
              ["Processamento de pagamentos", "Artigo 6.º, n.º 1, alínea b), do RGPD"],
              ["Prestação do serviço AI Chat", "Artigo 6.º, n.º 1, alínea b), do RGPD"],
              ["Chat com o assistente de IA no sítio web (conversa, e-mail, resposta por e-mail)", "Artigo 6.º, n.º 1, alínea b), do RGPD (serviço prestado a seu pedido)"],
              ["Análise das conversas do chat para melhorar o apoio e o assistente", "Artigo 6.º, n.º 1, alínea f), do RGPD (interesse legítimo)"],
              ["Associação do percurso da visita e da gravação do Clarity à conversa", "Artigo 6.º, n.º 1, alínea a), do RGPD (consentimento para cookies analíticos)"],
              ["Envio dos produtos", "Artigo 6.º, n.º 1, alínea b), do RGPD"],
              ["Tratamento de reclamações", "Artigo 6.º, n.º 1, alínea c), do RGPD (obrigação jurídica)"],
              ["Emissão de faturas", "Artigo 6.º, n.º 1, alínea c), do RGPD (obrigação jurídica)"],
              ["Marketing direto", "Artigo 6.º, n.º 1, alínea f), do RGPD (interesse legítimo)"],
              ["Análise e estatísticas", "Artigo 6.º, n.º 1, alínea f), do RGPD (interesse legítimo)"],
              ["Newsletter (caso tenha sido dado consentimento)", "Artigo 6.º, n.º 1, alínea a), do RGPD (consentimento)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Prazo de conservação", title: "Prazo", accent: "de conservação",
      body: (
        <>
          <P>
            Conservamos os dados pessoais durante os prazos exigidos por lei ou durante o tempo
            necessário para cumprir as finalidades do tratamento:
          </P>
          <ULWide>
            <li><B>Dados de transações e faturas:</B> 5 anos a contar do final do ano civil em que se constituiu a obrigação fiscal.</li>
            <li><B>Dados relativos ao contrato:</B> durante a vigência do contrato e pelo período exigido por lei (p. ex., 6 anos, tendo em conta a prescrição dos créditos).</li>
            <li><B>Dados relacionados com os tokens de IA</B> (saldo, compras de pacotes, códigos ativados)<B>:</B> enquanto a conta se mantiver ativa e durante 3 anos após a sua eliminação.</li>
            <li><B>Histórico do AI Chat:</B> enquanto a conta se mantiver ativa (até o utilizador eliminar a conversa ou a conta) e até 30 dias após a eliminação da conta.</li>
            <li><B>Dados de marketing (consentimento):</B> até à retirada do consentimento ou à apresentação de oposição.</li>
            <li><B>Dados analíticos:</B> até 25 meses a contar da última atividade.</li>
            <li><B>Conversas do chat do sítio web</B> (e-mail, conteúdo, percurso da visita)<B>:</B> 12 meses a contar da última mensagem da conversa, sendo depois eliminadas automaticamente; antes disso, a seu pedido.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Partilha de dados", title: "Destinatários", accent: "",
      body: (
        <>
          <P>Os dados pessoais podem ser partilhados com as seguintes categorias de destinatários:</P>
          <ULWide>
            <li><B>Stripe</B> – operador de pagamentos (processamento de transações com cartões de pagamento, incluindo compras de pacotes de tokens de IA).</li>
            <li><B>InPost</B> – empresa de transporte (entrega de produtos em cacifos automáticos Paczkomat).</li>
            <li><B>Resend</B> – serviço de e-mail (envio de mensagens transacionais e magic links).</li>
            <li><B>Google AI (Gemini)</B> – fornecedor do serviço AI Chat (processamento de pedidos no chatbot).</li>
            <li><B>OpenRouter, Inc.</B> (EUA) – intermediário no acesso a modelos de IA (entre outros, Google Gemini); recebe o conteúdo das mensagens do chat do sítio web e do AI Chat para gerar a resposta. Não lhe transmitimos o endereço de e-mail.</li>
            <li><B>Microsoft Clarity</B> – ferramenta de análise (mapas de calor, gravações de sessões) utilizada apenas após consentimento para cookies analíticos; ver secção 9.</li>
            <li><B>Fornecedor de alojamento</B> – armazenamento de dados em servidores VPS.</li>
            <li><B>Fornecedor da base de dados PostgreSQL</B> – armazenamento dos dados dos utilizadores.</li>
            <li><B>Entidades legalmente autorizadas</B> – autoridades públicas e tribunais (quando exigido por lei).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Todos os destinatários dos dados atuam com base em contratos de subcontratação do
              tratamento de dados pessoais e estão obrigados a manter a sua confidencialidade e a aplicar
              medidas de segurança adequadas.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Transferências para fora do EEE", title: "Transferências", accent: "para fora do EEE",
      body: (
        <>
          <P>
            Alguns prestadores de serviços (p. ex., Stripe, Google AI, OpenRouter, Microsoft Clarity) podem tratar
            dados fora do Espaço Económico Europeu (EEE). Nesses casos:
          </P>
          <UL>
            <li>Asseguramos garantias adequadas em conformidade com o RGPD (cláusulas contratuais-tipo aprovadas pela Comissão Europeia).</li>
            <li>A transferência é efetuada apenas para países que asseguram um nível adequado de proteção de dados ou para entidades que aplicam garantias adequadas.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Direitos dos utilizadores", title: "Direitos", accent: "dos utilizadores",
      body: (
        <>
          <P>Nos termos do RGPD, são-lhe conferidos os seguintes direitos:</P>

          <SubH>8.1. Acesso aos dados — artigo 15.º do RGPD</SubH>
          <P>
            Tem o direito de obter a confirmação de que os seus dados pessoais são ou não objeto de tratamento
            e, em caso afirmativo, de aceder a esses dados e de obter uma cópia dos mesmos.
          </P>

          <SubH>8.2. Retificação — artigo 16.º do RGPD</SubH>
          <P>
            Tem o direito de solicitar, sem demora injustificada, a retificação dos dados inexatos
            ou que os dados incompletos sejam completados.
          </P>

          <SubH>8.3. Apagamento («direito a ser esquecido») — artigo 17.º do RGPD</SubH>
          <P>Em determinados casos, tem o direito de solicitar o apagamento dos seus dados pessoais.</P>

          <SubH>8.4. Limitação do tratamento — artigo 18.º do RGPD</SubH>
          <P>Em determinadas situações, pode solicitar a limitação do tratamento dos seus dados.</P>

          <SubH>8.5. Portabilidade dos dados — artigo 20.º do RGPD</SubH>
          <P>
            Tem o direito de receber os seus dados num formato estruturado, de uso corrente
            e de leitura automática, e de os transmitir a outro responsável pelo tratamento.
          </P>

          <SubH>8.6. Oposição — artigo 21.º do RGPD</SubH>
          <P>
            Tem o direito de se opor ao tratamento dos seus dados para fins de marketing
            ou com base em interesse legítimo.
          </P>

          <SubH>8.7. Retirada do consentimento — artigo 7.º, n.º 3, do RGPD</SubH>
          <P>
            Se o tratamento se basear no consentimento, tem o direito de o retirar
            a qualquer momento.
          </P>

          <SubH>8.8. Reclamação junto da autoridade de controlo — artigo 77.º do RGPD</SubH>
          <P>
            Tem o direito de apresentar reclamação ao Presidente do Gabinete polaco de Proteção de Dados
            Pessoais (PUODO), se considerar que o tratamento dos seus dados viola o RGPD.
          </P>
          <InfoBox title="PUODO · contacto">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Para exercer os direitos acima referidos, contacte-nos por e-mail ou através do formulário de contacto.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. O que são cookies</SubH>
          <P>
            Os cookies são pequenos ficheiros de texto guardados no dispositivo do utilizador durante
            a visita a um sítio web.
          </P>

          <SubH>9.2. Que cookies utilizamos</SubH>
          <ULWide>
            <li><B>Necessários</B> — asseguram as funcionalidades básicas do sítio web (sessão do utilizador, carrinho, início de sessão).</li>
            <li><B>Funcionais</B> — memorizam as suas preferências (p. ex., o modo escuro).</li>
            <li><B>Analíticos</B> — ajudam-nos a compreender como os utilizadores utilizam o sítio web (mapas de calor, gravações de sessões, estatísticas de visitas). Para este efeito, utilizamos o <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>De marketing</B> — utilizados para personalizar a publicidade (apenas mediante consentimento).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            O Microsoft Clarity é carregado apenas após a prestação de consentimento para cookies analíticos
            no banner de consentimento («Aceitar todos»). A ferramenta guarda no dispositivo, entre outros,
            os cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> e <Mono>SM</Mono>, que servem para reconhecer o
            utilizador que regressa, gravar sessões e gerar mapas de calor. Os dados
            são tratados pela Microsoft Corporation em conformidade com a{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">política de privacidade do Microsoft Clarity</A>.
            O consentimento pode ser retirado a qualquer momento, limpando os dados do banner de consentimento
            nas definições do navegador (localStorage) e selecionando «Só essenciais».
          </P>

          <SubH>9.4. Armazenamento do navegador utilizado pelo chat</SubH>
          <P>
            O chat com o assistente guarda no armazenamento do navegador (localStorage) o identificador da sua conversa,
            para que esta possa continuar após o recarregamento da página; isto é necessário ao funcionamento do serviço
            que solicitou e é eliminado ao clicar em «Terminar». Apenas mediante consentimento para cookies analíticos,
            o chat guarda também em sessionStorage (até ao fecho do separador) a lista de subpáginas e secções visitadas
            referida no ponto 3.4.
          </P>

          <SubH>9.5. Gestão de cookies</SubH>
          <P>
            Pode gerir os cookies através das definições do navegador. Note, contudo, que a
            desativação dos cookies pode afetar a funcionalidade do Serviço
            (p. ex., o início de sessão ou o carrinho de compras).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Segurança dos dados", title: "Segurança", accent: "",
      body: (
        <>
          <P>
            Aplicamos medidas técnicas e organizativas adequadas para proteger os dados
            pessoais contra:
          </P>
          <UL>
            <li>o acesso não autorizado,</li>
            <li>a perda,</li>
            <li>a destruição,</li>
            <li>a modificação não autorizada,</li>
            <li>a divulgação não autorizada.</li>
          </UL>
          <Gap size={5}>
            <P>Em especial, aplicamos:</P>
          </Gap>
          <UL>
            <li>cifragem das ligações SSL/TLS (HTTPS),</li>
            <li>armazenamento seguro das palavras-passe (algoritmo bcrypt com sal),</li>
            <li>proteção da sessão do utilizador (cookies HttpOnly e Secure),</li>
            <li>restrição do acesso aos dados exclusivamente a pessoas autorizadas,</li>
            <li>atualizações regulares do software e do sistema,</li>
            <li>monitorização da segurança da infraestrutura,</li>
            <li>cópias de segurança regulares da base de dados.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatização e definição de perfis", title: "Automatização", accent: "",
      body: (
        <>
          <P>
            No Serviço não utilizamos decisões automatizadas, incluindo a definição de perfis,
            que produzam efeitos jurídicos relativamente aos Utilizadores ou que os afetem
            significativamente de forma similar.
          </P>
          <Gap>
            <P>
              O AI Chat (Google Gemini) e o assistente do chat do sítio web são ferramentas de
              apoio que respondem aos pedidos dos utilizadores, mas não tomam decisões
              automatizadas com efeitos jurídicos. O percurso da visita associado à
              conversa (apenas mediante consentimento) serve exclusivamente para adequar as respostas e melhorar o sítio web.
              Informamos na janela do chat de que está a conversar com uma IA.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Dados de menores", title: "Dados", accent: "de menores",
      body: (
        <>
          <P>
            O Serviço KalkMate.pl pode ser utilizado por menores (alunos do ensino
            secundário). Se o utilizador tiver menos de 18 anos, a compra da calculadora e a utilização
            do AI Chat requerem o consentimento dos pais ou do representante legal.
          </P>
          <Gap>
            <P>
              Não recolhemos conscientemente dados pessoais de crianças com menos de 13 anos sem
              o consentimento dos pais/representantes legais.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Alterações da política", title: "Alterações", accent: "da política",
      body: (
        <>
          <P>
            A Política de privacidade pode ser alterada em virtude da evolução tecnológica,
            de alterações legislativas ou de alterações na atividade do Serviço.
          </P>
          <Gap>
            <P>Informaremos os Utilizadores de quaisquer alterações significativas através de:</P>
          </Gap>
          <UL>
            <li>um aviso na página inicial do Serviço,</li>
            <li>uma mensagem de e-mail (para utilizadores registados).</li>
          </UL>
          <Gap>
            <P>
              A versão atual da Política de privacidade está sempre disponível em:{" "}
              <A href="/pt/polityka-prywatnosci">kalkmate.pl/pt/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Contacto", title: "Contacto", accent: "",
      body: (
        <>
          <P>
            Quaisquer questões relativas ao tratamento de dados pessoais e ao exercício
            dos seus direitos devem ser dirigidas para:
          </P>
          <UL>
            <li>E-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefone: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/pt/pomoc#kontakt">Formulário de contacto</A>{" "}disponível no sítio web.</li>
          </UL>
          <Gap size={5}>
            <P>Comprometemo-nos a responder aos seus pedidos no prazo de 30 dias a contar da sua receção.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Obrigado pela sua confiança e por utilizar o KalkMate.pl. Atribuímos especial importância
      à proteção da sua privacidade e à segurança dos seus dados pessoais.
    </>
  ),
  footerNote: "Última atualização · 2026-10-28 (chat com o assistente de IA no sítio web)",
  otherDocLabel: "→ Termos e condições",
  homeLabel: "← Página inicial",
};

export default doc;
