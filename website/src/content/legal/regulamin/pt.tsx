import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie portugalskie (pt_PT) pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Termos e condições: encomendas, devoluções e garantia | KalkMate",
  metaDescription:
    "Termos e condições da loja KalkMate: encomendas, pagamentos (Przelewy24, cartão), envio gratuito com InPost, 14 dias para devolução, 24 meses de garantia e chat com assistente de IA.",
  badge: "Em conformidade com a Lei polaca dos direitos do consumidor",
  dateLabel: "Em vigor desde · 2026-01-01",
  eyebrow: "[ termos ] · 10 secções",
  h1: "Termos e condições",
  h1Accent: "da loja",
  intro: "Regras relativas a encomendas, pagamentos, entregas, devoluções e reclamações na loja online kalkmate.pl.",
  bindingNote: (
    <>
      A presente tradução é disponibilizada apenas para sua conveniência. A versão juridicamente vinculativa
      é a polaca: em caso de divergência, prevalece a <A href="/regulamin">versão polaca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposições gerais", title: "Disposições", accent: "gerais",
      body: (
        <>
          <P>
            Os presentes termos e condições estabelecem as regras de venda de produtos na loja online
            disponível em kalkmate.pl, gerida por <B>Kacper Popko</B>,{" "}
            que exerce atividade empresarial sob a firma <B>KAJPA Kacper Popko</B>,
            doravante designado «Vendedor».
          </P>
          <CompanyBox
            rows={[
              { label: "NIF polaco (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Sede", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Encomendas", title: "Encomendas", accent: "",
      body: (
        <OL>
          <li>As encomendas são aceites através do sítio web kalkmate.pl 24 horas por dia, 7 dias por semana.</li>
          <li>A realização de uma encomenda implica a aceitação dos presentes termos e condições.</li>
          <li>Após a realização da encomenda, o Comprador recebe uma confirmação no endereço de e-mail indicado.</li>
          <li>O Vendedor reserva-se o direito de recusar a execução de uma encomenda em casos justificados.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Preços e pagamentos", title: "Preços", accent: "e pagamentos",
      body: (
        <OL>
          <li>Todos os preços indicados no sítio web são preços brutos (com IVA incluído).</li>
          <li>Os pagamentos são processados através do serviço Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Métodos de pagamento disponíveis: cartão de pagamento, BLIK, transferência bancária e outros métodos disponíveis no serviço Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Execução e entrega", title: "Execução", accent: "e entrega",
      body: (
        <OL>
          <li>O produto KalkMate é fabricado por encomenda, como produção própria.</li>
          <li>O prazo de execução é de até 4 semanas a contar do registo do pagamento. O prazo de execução habitual é de 1–2 semanas.</li>
          <li>A entrega na Polónia é efetuada através da InPost (cacifo automático Paczkomat). Custo de envio na Polónia: 0 PLN.</li>
          <li>Envio para o estrangeiro (países da UE): 20 EUR. Envio para fora da UE: 35 EUR.</li>
          <li>O Comprador recebe o número de seguimento da remessa após a sua expedição.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Direito de livre resolução", title: "Direito", accent: "de livre resolução",
      body: (
        <>
          <P>
            O Consumidor tem o direito de resolver o contrato celebrado à distância no prazo de 14 dias
            de calendário, sem necessidade de indicar o motivo, sem prejuízo da exceção descrita abaixo.
          </P>
          <Callout title="Exceção — dispositivo personalizado por encomenda">
            <CalloutP>
              Cada unidade do dispositivo KalkMate é personalizada individualmente a pedido do
              Consumidor antes do envio: (a) é carregado o código de desbloqueio das funções de IA
              escolhido pelo Consumidor no formulário de encomenda e (b) é impresso na etiqueta da respetiva
              unidade o nome/alcunha indicado pelo Consumidor. Nos termos do{" "}
              <B>artigo 38.º, ponto 3, da Lei polaca dos direitos do consumidor, de 30 de maio de 2014</B>,
              o direito de livre resolução não se aplica a bens produzidos segundo as especificações do
              consumidor ou destinados a satisfazer as suas necessidades individualizadas. Esta informação,
              bem como o requisito de prestar um consentimento separado, são apresentados ao Consumidor
              antes da celebração do contrato, no formulário de encomenda.
            </CalloutP>
            <CalloutP className="mt-3">
              Esta exceção <B>não se aplica</B> à compra de pacotes
              (carregamentos) de tokens de IA, relativamente aos quais o direito de livre resolução se rege pelas regras gerais.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Os números seguintes referem-se aos casos em que existe direito de livre resolução
              (ou seja, compras que não sejam o dispositivo KalkMate personalizado):
            </P>
          </div>
          <OL>
            <li>O prazo de livre resolução expira 14 dias após o dia em que o Consumidor adquiriu a posse do bem.</li>
            <li>Para exercer o direito de livre resolução, o Consumidor deve informar o Vendedor da sua decisão por e-mail para o endereço: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              A devolução da mercadoria deve ser efetuada para o endereço: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              O reembolso do pagamento é efetuado no prazo de até 14 dias a contar da data de receção da mercadoria devolvida.
              Se o Consumidor tiver solicitado expressamente o início da prestação do serviço (p. ex., soluções de IA)
              antes do termo do prazo de livre resolução, o Vendedor tem o direito de deduzir do montante a reembolsar
              a remuneração pelos serviços efetivamente prestados até ao momento da resolução (artigo 35.º da Lei polaca
              dos direitos do consumidor) e, no caso de um bem devolvido que apresente sinais de utilização que excedam
              o necessário para verificar a natureza e o funcionamento do bem, também o montante correspondente
              à diminuição do seu valor (artigo 34.º, n.º 4, da Lei polaca dos direitos do consumidor).
            </li>
            <li>O direito de reclamação ao abrigo da garantia legal (rękojmia) e da garantia comercial (§6) existe independentemente das disposições anteriores e não é por elas limitado.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reclamações e garantia", title: "Reclamações", accent: "e garantia",
      body: (
        <OL>
          <li>Os produtos estão abrangidos por uma garantia do Vendedor pelo período de 24 meses a contar da data de compra.</li>
          <li>As reclamações devem ser apresentadas por e-mail para o endereço: <B>kontakt@kalkmate.pl</B>, indicando o número da encomenda e a descrição da avaria.</li>
          <li>O Vendedor analisa as reclamações no prazo de até 14 dias de calendário.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Proteção de dados pessoais", title: "Proteção", accent: "de dados",
      body: (
        <OL>
          <li>O responsável pelo tratamento dos dados pessoais é o Vendedor.</li>
          <li>Os dados pessoais são tratados exclusivamente para efeitos de execução da encomenda e não são partilhados com terceiros, com exceção das empresas de transporte e dos operadores de pagamento.</li>
          <li>O Comprador tem o direito de aceder aos seus dados, de os retificar e de solicitar o seu apagamento.</li>
          <li>
            O sítio web utiliza cookies, incluindo a ferramenta de análise Microsoft Clarity
            (mapas de calor, gravações de sessões), carregada apenas após a prestação de consentimento
            no banner de cookies. Os detalhes encontram-se na{" "}
            <A href="/pt/polityka-prywatnosci#sek-9">Política de privacidade</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat com o assistente de IA", title: "Chat", accent: "com o assistente de IA",
      body: (
        <OL>
          <li>
            No sítio web kalkmate.pl, o Vendedor disponibiliza um serviço gratuito prestado por via eletrónica:
            um chat com um assistente cujas respostas são geradas por <B>inteligência artificial (IA)</B>.
            O assistente não é uma pessoa. Responde a perguntas sobre os produtos, as encomendas e o funcionamento da calculadora.
          </li>
          <li>
            Para iniciar uma conversa são necessários: um navegador de internet com JavaScript ativado, a indicação de um
            endereço de e-mail, a confirmação de que o utilizador não é um programa automático (verificação efetuada no
            navegador) e a aceitação da presente cláusula. O contrato de prestação do serviço é celebrado no momento do
            início da conversa e cessa no momento do seu termo (botão «Terminar» ou fecho da página). O utilizador pode
            deixar de utilizar o chat a qualquer momento.
          </li>
          <li>
            As respostas do assistente têm caráter meramente informativo, podem conter erros e não constituem uma proposta
            contratual na aceção do Código Civil polaco nem uma declaração de vontade do Vendedor. Em caso de divergência,
            são vinculativos os presentes termos e condições, a descrição do produto no sítio web e as informações
            transmitidas na confirmação da encomenda. O assistente não tem acesso às encomendas nem às contas: as questões
            relativas a encomendas concretas, devoluções e reclamações devem ser dirigidas para kontakt@kalkmate.pl.
          </li>
          <li>
            O Vendedor pode responder a uma pergunta colocada no chat através de uma mensagem de e-mail para o endereço
            indicado, em especial quando o assistente não souber a resposta.
          </li>
          <li>
            É proibido enviar no chat conteúdos ilícitos, ofensivos ou que violem direitos de terceiros, bem como dados
            especialmente protegidos, palavras-passe, dados de cartões de pagamento e o código de IA da calculadora.
            O Vendedor pode bloquear uma conversa que viole estas regras e aplicar limites ao número de mensagens.
          </li>
          <li>
            O assistente pode, por iniciativa própria, oferecer ajuda apresentando uma breve mensagem junto ao botão do chat
            (p. ex., após algum tempo no sítio web ou junto à tabela de preços). Essa mensagem aparece no máximo duas vezes
            durante uma visita e não volta a aparecer depois de fechada.
          </li>
          <li>
            O conteúdo das conversas, o endereço de e-mail e as informações técnicas (a página a partir da qual a mensagem
            foi enviada, o navegador) são registados e ficam acessíveis ao Vendedor e às pessoas por ele autorizadas, para
            efeitos de resposta às perguntas e de melhoria do apoio ao cliente. Se o utilizador tiver dado consentimento aos
            cookies analíticos, são também associados à conversa o percurso da visita ao sítio web (subpáginas visitadas e
            secções vistas) e o identificador da gravação da sessão no Microsoft Clarity. Os detalhes, os fundamentos
            jurídicos e o prazo de conservação (12 meses a contar da última mensagem) são descritos na{" "}
            <A href="/pt/polityka-prywatnosci#sek-3">Política de privacidade</A>.
          </li>
          <li>
            As pessoas com menos de 16 anos podem utilizar o chat com o consentimento dos pais ou do representante legal.
          </li>
          <li>
            As reclamações relativas ao funcionamento do chat podem ser apresentadas através de kontakt@kalkmate.pl.
            O Vendedor analisa-as no prazo de 14 dias.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Programa de parceiros", title: "Programa", accent: "de parceiros",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Pode participar no programa de parceiros (doravante «Parceiro») qualquer utilizador registado do sítio web
            kalkmate.pl com endereço de e-mail confirmado. O Parceiro cria no painel de cliente um único código de parceiro
            próprio (de 4 a 16 caracteres: letras A–Z e algarismos).
          </li>
          <li>
            O Comprador que indicar um código de parceiro na encomenda obtém <B>7% de desconto</B>{" "}
            sobre o preço dos produtos. O código de parceiro não é cumulável com outros cupões de desconto (o formulário
            de encomenda aceita um único código). O Parceiro não pode utilizar o seu próprio código.
          </li>
          <li>
            Por cada encomenda paga com o código, o Parceiro recebe uma comissão calculada sobre o valor dos produtos após
            o desconto, excluindo os portes de envio. O montante da comissão depende do nível do Parceiro, determinado com
            base no número de unidades vendidas com o seu código antes da encomenda em causa:
            <TierTable
              head={["Nível", "Unidades vendidas", "Comissão"]}
              rows={[
                ["Início", "0–2", "5%"],
                ["Bronze", "3–9", "7%"],
                ["Prata", "10–24", "9%"],
                ["Ouro", "25–49", "11%"],
                ["Diamante", "a partir de 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              As comissões são liquidadas em zlótis polacos (PLN); o valor das encomendas em EUR é convertido à taxa fixa de 4,25 PLN por 1 EUR.
            </span>
          </li>
          <li>
            A comissão fica disponível 30 dias após o pagamento da encomenda. A comissão é anulada em caso de cancelamento
            da encomenda, reembolso do pagamento ou litígio relativo ao pagamento, mesmo que já tenha sido trocada ou paga;
            nesse caso, o saldo do Parceiro pode tornar-se negativo, sendo compensado com as comissões seguintes.
          </li>
          <li>
            O Parceiro pode: (a) trocar os fundos disponíveis por tokens de IA, a partir de 10 PLN, à taxa de 1 PLN = 65 000 tokens,
            de imediato; (b) levantá-los por transferência para uma conta bancária, a partir de 100 PLN, apenas se o Parceiro
            for maior de idade. O pagamento é normalmente efetuado no prazo de 7 dias úteis. Antes do pagamento, o Vendedor
            pode solicitar os dados necessários para efeitos fiscais.
          </li>
          <li>
            É proibido: enviar spam, fazer-se passar pela KalkMate ou pelo Vendedor, publicar anúncios em motores de pesquisa
            com palavras-chave que contenham a marca KalkMate, recomendar-se a si próprio e efetuar encomendas fictícias. Em caso
            de infração, o Vendedor pode desativar o código de parceiro e anular as comissões indevidas.
          </li>
          <li>
            O Vendedor pode alterar as condições do programa de parceiros com uma antecedência de 14 dias, informando desse facto no sítio web.
            As alterações não se aplicam às comissões apuradas antes da sua entrada em vigor.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Disposições finais", title: "Disposições", accent: "finais",
      body: (
        <OL>
          <li>Em tudo o que não estiver regulado nos presentes termos e condições aplicam-se as disposições do Código Civil polaco, da Lei polaca dos direitos do consumidor e da Lei polaca relativa à prestação de serviços por via eletrónica.</li>
          <li>O Vendedor reserva-se o direito de alterar os presentes termos e condições. As alterações entram em vigor na data da sua publicação no sítio web.</li>
          <li>Todos os litígios serão dirimidos pelo tribunal competente da área da sede do Vendedor.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Obrigado pela sua confiança e pela compra do KalkMate. Em caso de dúvidas sobre uma encomenda,
      devolução ou reclamação, estamos ao seu dispor através de kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Em vigor desde · 2026-01-01 · última alteração 2026-10-28 (§9 programa de parceiros)",
  otherDocLabel: "→ Política de privacidade",
  homeLabel: "← Página inicial",
};

export default doc;
