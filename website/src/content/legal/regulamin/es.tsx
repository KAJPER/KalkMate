import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — tlumaczenie hiszpanskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Términos y condiciones: pedidos, devoluciones y garantía | KalkMate",
  metaDescription:
    "Términos y condiciones de la tienda KalkMate: pedidos, pagos (Przelewy24, tarjeta), envío gratuito con InPost, 14 días para devoluciones, 24 meses de garantía y chat con asistente de IA.",
  badge: "Conforme a la Ley polaca de derechos del consumidor",
  dateLabel: "En vigor desde · 2026-01-01",
  eyebrow: "[ condiciones ] · 10 secciones",
  h1: "Términos y condiciones",
  h1Accent: "de la tienda",
  intro: "Normas para la realización de pedidos, pagos, entregas, devoluciones y reclamaciones en la tienda online kalkmate.pl.",
  bindingNote: (
    <>
      Esta traducción se facilita únicamente para su comodidad. La versión jurídicamente vinculante es
      la polaca: en caso de discrepancia, prevalece la <A href="/regulamin">versión polaca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposiciones generales", title: "Disposiciones", accent: "generales",
      body: (
        <>
          <P>
            Los presentes términos y condiciones establecen las normas de venta de productos en la tienda
            online disponible en kalkmate.pl, gestionada por <B>Kacper Popko</B>,{" "}
            que ejerce su actividad económica bajo el nombre comercial <B>KAJPA Kacper Popko</B>,
            en adelante, «el Vendedor».
          </P>
          <CompanyBox
            rows={[
              { label: "NIF polaco (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Domicilio social", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Pedidos", title: "Pedidos", accent: "",
      body: (
        <OL>
          <li>Los pedidos se aceptan a través del sitio web kalkmate.pl las 24 horas del día, los 7 días de la semana.</li>
          <li>La realización de un pedido implica la aceptación de los presentes términos y condiciones.</li>
          <li>Tras realizar el pedido, el Comprador recibe una confirmación en la dirección de correo electrónico indicada.</li>
          <li>El Vendedor se reserva el derecho a rechazar la ejecución de un pedido en casos justificados.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Precios y pagos", title: "Precios", accent: "y pagos",
      body: (
        <OL>
          <li>Todos los precios indicados en el sitio web son precios brutos (IVA incluido).</li>
          <li>Los pagos se gestionan a través del servicio Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Métodos de pago disponibles: tarjeta de pago, BLIK, transferencia bancaria y otros métodos disponibles en el servicio Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Ejecución y entrega", title: "Ejecución", accent: "y entrega",
      body: (
        <OL>
          <li>El producto KalkMate se fabrica por encargo, como producción propia.</li>
          <li>El plazo de ejecución es de hasta 4 semanas desde la contabilización del pago. El plazo de ejecución habitual es de 1–2 semanas.</li>
          <li>Las entregas en Polonia se realizan a través de InPost (taquilla automática Paczkomat). Gastos de envío en Polonia: 0 PLN.</li>
          <li>Envío al extranjero (países de la UE): 20 EUR. Envío fuera de la UE: 35 EUR.</li>
          <li>El Comprador recibe el número de seguimiento del envío una vez que este ha sido expedido.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Derecho de desistimiento", title: "Derecho", accent: "de desistimiento",
      body: (
        <>
          <P>
            El Consumidor tiene derecho a desistir del contrato celebrado a distancia en un plazo de 14 días
            naturales sin necesidad de indicar el motivo, sin perjuicio de la excepción descrita a continuación.
          </P>
          <Callout title="Excepción — dispositivo personalizado por encargo">
            <CalloutP>
              Cada unidad del dispositivo KalkMate se personaliza individualmente a petición del
              Consumidor antes del envío: (a) se carga en ella el código de desbloqueo de las funciones de IA
              elegido por el Consumidor en el formulario de pedido y (b) en la etiqueta de dicha unidad se
              imprime el nombre/apodo indicado por el Consumidor. De conformidad con el{" "}
              <B>art. 38, punto 3, de la Ley polaca de derechos del consumidor de 30 de mayo de 2014</B>,
              el derecho de desistimiento no se aplica a los bienes confeccionados conforme a las
              especificaciones del consumidor o destinados a satisfacer sus necesidades individualizadas.
              Esta información, así como el requisito de otorgar un consentimiento por separado, se
              presentan al Consumidor antes de la celebración del contrato, en el formulario de pedido.
            </CalloutP>
            <CalloutP className="mt-3">
              Esta excepción <B>no se aplica</B> a la compra de paquetes
              (recargas) de tokens de IA, respecto de los cuales el derecho de desistimiento rige conforme a las normas generales.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Los apartados siguientes se refieren a los casos en que sí existe el derecho de desistimiento
              (es decir, compras distintas del dispositivo KalkMate personalizado):
            </P>
          </div>
          <OL>
            <li>El plazo de desistimiento expira transcurridos 14 días desde el día en que el Consumidor entró en posesión del bien.</li>
            <li>Para ejercer el derecho de desistimiento, el Consumidor debe informar al Vendedor de su decisión por correo electrónico a la dirección: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              La mercancía debe devolverse a la dirección: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              El reembolso del pago se efectúa en un plazo de hasta 14 días desde la recepción de la mercancía devuelta.
              Si el Consumidor solicitó expresamente que la prestación del servicio (p. ej., las soluciones de IA)
              comenzara antes de que expirase el plazo de desistimiento, el Vendedor tiene derecho a deducir del importe
              que deba reembolsarse la remuneración por los servicios efectivamente prestados hasta el momento del
              desistimiento (art. 35 de la Ley polaca de derechos del consumidor) y, en el caso de un bien devuelto que
              presente signos de uso que excedan de lo necesario para establecer la naturaleza y el funcionamiento de la
              mercancía, también un importe equivalente a la disminución de su valor (art. 34, apdo. 4, de la Ley polaca de derechos del consumidor).
            </li>
            <li>El derecho a presentar reclamaciones en virtud de la garantía legal (rękojmia) y de la garantía comercial (§6) existe con independencia de las disposiciones anteriores y no queda limitado por ellas.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reclamaciones y garantía", title: "Reclamaciones", accent: "y garantía",
      body: (
        <OL>
          <li>Los productos están cubiertos por una garantía del Vendedor durante un periodo de 24 meses a partir de la fecha de compra.</li>
          <li>Las reclamaciones deben presentarse por correo electrónico a la dirección: <B>kontakt@kalkmate.pl</B>, indicando el número de pedido y una descripción del defecto.</li>
          <li>El Vendedor tramita las reclamaciones en un plazo de hasta 14 días naturales.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Protección de datos personales", title: "Protección", accent: "de datos",
      body: (
        <OL>
          <li>El responsable del tratamiento de los datos personales es el Vendedor.</li>
          <li>Los datos personales se tratan exclusivamente para ejecutar el pedido y no se comunican a terceros, a excepción de las empresas de mensajería y los operadores de pago.</li>
          <li>El Comprador tiene derecho a acceder a sus datos, a rectificarlos y a solicitar su supresión.</li>
          <li>
            El sitio web utiliza cookies, incluida la herramienta analítica Microsoft Clarity
            (mapas de calor, grabaciones de sesiones), que se carga únicamente tras otorgar el consentimiento
            en el banner de cookies. Encontrará más información en la{" "}
            <A href="/es/polityka-prywatnosci#sek-9">Política de privacidad</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Chat con el asistente de IA", title: "Chat", accent: "con el asistente de IA",
      body: (
        <OL>
          <li>
            En el sitio web kalkmate.pl, el Vendedor ofrece un servicio gratuito prestado por vía electrónica:
            un chat con un asistente cuyas respuestas son generadas por <B>inteligencia artificial (IA)</B>.
            El asistente no es una persona. Responde a preguntas sobre los productos, los pedidos y el funcionamiento de la calculadora.
          </li>
          <li>
            Para iniciar una conversación se requiere: un navegador web con JavaScript activado, indicar una dirección
            de correo electrónico, confirmar que el usuario no es un programa automatizado (verificación realizada en el
            navegador) y aceptar la presente cláusula. El contrato de prestación del servicio se celebra en el momento de
            iniciar la conversación y se extingue en el momento de su finalización (botón «Terminar» o cierre de la página).
            El usuario puede dejar de utilizar el chat en cualquier momento.
          </li>
          <li>
            Las respuestas del asistente tienen carácter meramente informativo, pueden contener errores y no constituyen
            una oferta en el sentido del Código Civil polaco ni una declaración de voluntad del Vendedor. En caso de
            discrepancia, son vinculantes los presentes términos y condiciones, la descripción del producto en el sitio web
            y la información facilitada en la confirmación del pedido. El asistente no tiene acceso a los pedidos ni a las
            cuentas: las cuestiones relativas a pedidos concretos, devoluciones y reclamaciones deben dirigirse
            a kontakt@kalkmate.pl.
          </li>
          <li>
            El Vendedor puede responder a una pregunta formulada en el chat mediante un mensaje de correo electrónico a la
            dirección indicada, en particular cuando el asistente no conozca la respuesta.
          </li>
          <li>
            Está prohibido enviar a través del chat contenidos ilícitos, ofensivos o que vulneren derechos de terceros,
            así como datos especialmente protegidos, contraseñas, datos de tarjetas de pago y el código de IA de la
            calculadora. El Vendedor puede bloquear una conversación que infrinja estas normas y aplicar límites al número de mensajes.
          </li>
          <li>
            El asistente puede ofrecer ayuda por iniciativa propia mostrando un breve mensaje junto al botón del chat
            (p. ej., tras cierto tiempo en el sitio web o en la sección de precios). Dicho mensaje aparece como máximo dos
            veces durante una visita y no vuelve a aparecer una vez cerrado.
          </li>
          <li>
            El contenido de las conversaciones, la dirección de correo electrónico y la información técnica (la página
            desde la que se envió el mensaje, el navegador) se registran y están disponibles para el Vendedor y las
            personas autorizadas por él, con el fin de atender las preguntas y mejorar la atención al cliente. Si el
            usuario ha dado su consentimiento a las cookies analíticas, también se asocian a la conversación el recorrido
            de la visita al sitio web (subpáginas visitadas y secciones vistas) y el identificador de la grabación de la
            sesión en Microsoft Clarity. Los detalles, las bases jurídicas y el plazo de conservación
            (12 meses desde el último mensaje) se describen en la{" "}
            <A href="/es/polityka-prywatnosci#sek-3">Política de privacidad</A>.
          </li>
          <li>
            Las personas menores de 16 años pueden utilizar el chat con el consentimiento de su padre, madre o tutor legal.
          </li>
          <li>
            Las reclamaciones relativas al funcionamiento del chat pueden presentarse en kontakt@kalkmate.pl. El Vendedor
            las tramita en un plazo de 14 días.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Programa de socios", title: "Programa", accent: "de socios",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Puede participar en el programa de socios (en adelante, «el Socio») cualquier usuario registrado del sitio
            web kalkmate.pl con una dirección de correo electrónico confirmada. El Socio crea en el panel de cliente un único
            código de socio propio (de 4 a 16 caracteres: letras A–Z y cifras).
          </li>
          <li>
            El Comprador que introduzca un código de socio al realizar el pedido obtiene un <B>7% de descuento</B>{" "}
            sobre el precio de los productos. El código de socio no es acumulable con otros cupones de descuento (el formulario
            de pedido admite un único código). El Socio no puede utilizar su propio código.
          </li>
          <li>
            Por cada pedido pagado con su código, el Socio recibe una comisión calculada sobre el valor de los productos tras
            el descuento, sin incluir los gastos de envío. El importe de la comisión depende del nivel del Socio, que se
            determina en función del número de unidades vendidas con su código antes del pedido de que se trate:
            <TierTable
              head={["Nivel", "Unidades vendidas", "Comisión"]}
              rows={[
                ["Inicio", "0–2", "5%"],
                ["Bronce", "3–9", "7%"],
                ["Plata", "10–24", "9%"],
                ["Oro", "25–49", "11%"],
                ["Diamante", "desde 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Las comisiones se liquidan en zlotys polacos (PLN); el valor de los pedidos en EUR se convierte al tipo fijo de 4,25 PLN por 1 EUR.
            </span>
          </li>
          <li>
            La comisión pasa a estar disponible 30 días después del pago del pedido. La comisión se anula en caso de
            cancelación del pedido, reembolso del pago o disputa relativa al pago, también cuando ya haya sido
            canjeada o pagada; en tal caso, el saldo del Socio puede pasar a ser negativo y se compensa con las comisiones siguientes.
          </li>
          <li>
            El Socio puede: (a) canjear los fondos disponibles por tokens de IA, a partir de 10 PLN, al tipo de 1 PLN = 65 000 tokens,
            de forma inmediata; (b) retirarlos mediante transferencia a una cuenta bancaria, a partir de 100 PLN, únicamente si el
            Socio es mayor de edad. El pago se realiza normalmente en un plazo de 7 días hábiles. Antes del pago, el Vendedor puede
            solicitar los datos necesarios a efectos fiscales.
          </li>
          <li>
            Queda prohibido: enviar spam, hacerse pasar por KalkMate o por el Vendedor, publicar anuncios en buscadores
            con palabras clave que contengan la marca KalkMate, recomendarse a uno mismo y realizar pedidos ficticios. En caso
            de infracción, el Vendedor puede desactivar el código de socio y anular las comisiones indebidas.
          </li>
          <li>
            El Vendedor puede modificar las condiciones del programa de socios con una antelación de 14 días, informando de ello en el sitio web.
            Las modificaciones no afectan a las comisiones devengadas antes de su entrada en vigor.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Disposiciones finales", title: "Disposiciones", accent: "finales",
      body: (
        <OL>
          <li>En lo no previsto en los presentes términos y condiciones serán de aplicación las disposiciones del Código Civil polaco, de la Ley polaca de derechos del consumidor y de la Ley polaca de prestación de servicios por vía electrónica.</li>
          <li>El Vendedor se reserva el derecho a modificar los presentes términos y condiciones. Las modificaciones entran en vigor el día de su publicación en el sitio web.</li>
          <li>Todos los litigios serán resueltos por el tribunal competente según el domicilio social del Vendedor.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Gracias por su confianza y por comprar KalkMate. Si tiene alguna pregunta sobre un pedido,
      una devolución o una reclamación, estamos a su disposición en kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "En vigor desde · 2026-01-01 · última modificación 2026-10-28 (§9 programa de socios)",
  otherDocLabel: "→ Política de privacidad",
  homeLabel: "← Página principal",
};

export default doc;
