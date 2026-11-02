import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — tlumaczenie hiszpanskie pl.tsx. Wiazaca jest wersja polska.
const doc: LegalDoc = {
  metaTitle: "Política de privacidad: RGPD y cookies | KalkMate",
  metaDescription:
    "Cómo protege KalkMate sus datos: qué recopilamos y para qué, cuánto tiempo los conservamos, cookies y Microsoft Clarity, chat con IA y sus derechos en virtud del RGPD.",
  badge: "RGPD · conforme al Reglamento (UE) 2016/679",
  dateLabel: "Actualización · 2026-10-28",
  eyebrow: "[ privacidad ] · 14 secciones",
  h1: "Política",
  h1Accent: "de privacidad",
  intro: "Qué datos recopilamos, por qué los tratamos, quién tiene acceso a ellos y cómo puede ejercer sus derechos. De conformidad con el RGPD.",
  bindingNote: (
    <>
      Esta traducción se facilita únicamente para su comodidad. La versión jurídicamente vinculante es
      la polaca: en caso de discrepancia, prevalece la <A href="/polityka-prywatnosci">versión polaca</A>.
    </>
  ),
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Disposiciones generales", title: "Disposiciones", accent: "generales",
      body: (
        <>
          <P>
            La presente Política de privacidad establece las normas de tratamiento y protección de los datos
            personales de los Usuarios del sitio web KalkMate.pl (en adelante, «el Sitio»), gestionado por
            KalkMate (en adelante, «el Responsable»).
          </P>
          <Gap>
            <P>
              El Responsable concede especial importancia al respeto de la privacidad de los Usuarios
              y a la seguridad de sus datos personales. Los datos personales se tratan de conformidad con el
              Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016
              (RGPD), y con la legislación nacional.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Responsable del tratamiento", title: "Responsable", accent: "del tratamiento",
      body: (
        <>
          <P>El responsable del tratamiento de los datos personales recopilados a través del Sitio es:</P>
          <CompanyBox
            rows={[
              { label: "NIF polaco (NIP)", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Domicilio social", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Nombre abreviado", value: "KAJPA", mono: true },
              { label: "Correo electrónico", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Teléfono", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Puede ponerse en contacto con el Responsable en materia de tratamiento de datos personales a través de:</P>
          </Gap>
          <UL>
            <li>correo electrónico: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>teléfono: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>el formulario de contacto disponible en el sitio web.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Datos recopilados", title: "Datos", accent: "recopilados",
      body: (
        <>
          <P>En el marco de la actividad del Sitio recopilamos las siguientes categorías de datos personales:</P>

          <SubH>3.1. Datos facilitados por el usuario</SubH>
          <UL>
            <li>nombre y apellidos,</li>
            <li>dirección de correo electrónico,</li>
            <li>número de teléfono,</li>
            <li>dirección del punto de recogida InPost (taquilla automática Paczkomat).</li>
          </UL>

          <SubH>3.2. Datos recopilados automáticamente</SubH>
          <UL>
            <li>dirección IP,</li>
            <li>tipo y versión del navegador,</li>
            <li>sistema operativo,</li>
            <li>datos sobre la actividad en el Sitio (páginas visitadas, duración de la visita),</li>
            <li>información técnica sobre el dispositivo.</li>
          </UL>

          <SubH>3.3. Datos de transacciones</SubH>
          <UL>
            <li>historial de pedidos,</li>
            <li>datos de pago (tratados por Stripe),</li>
            <li>información sobre el saldo, las compras y las activaciones de tokens de IA (incluidos los códigos de licencia de la caja que se hayan activado),</li>
            <li>historial de conversaciones con AI Chat.</li>
          </UL>

          <SubH>3.4. Chat con el asistente de IA en el sitio web</SubH>
          <P>Cuando inicia una conversación en la ventana de chat del sitio web (Términos y condiciones, §8), tratamos:</P>
          <UL>
            <li>la dirección de correo electrónico indicada al iniciar la conversación,</li>
            <li>el contenido de sus mensajes y de las respuestas del asistente, con fecha y hora,</li>
            <li>la dirección de la subpágina desde la que se envió el mensaje, el idioma de la página y la información sobre el navegador (user-agent),</li>
            <li>
              <B>solo si ha aceptado las cookies analíticas</B>: el recorrido
              de la visita al sitio web (subpáginas visitadas y secciones vistas, con la hora) y el identificador de la conversación
              que se añade a la grabación de la sesión en Microsoft Clarity; gracias a ello podemos ver lo que buscaba
              y responderle mejor. Sin este consentimiento no se recopila el recorrido de la visita.
            </li>
          </UL>
          <P>
            La confirmación «No soy un robot» realiza un cálculo en su navegador: no utiliza servicios de
            empresas externas ni guarda cookies. El contenido de los mensajes se transmite al proveedor del modelo de IA
            (véase la sección 6) únicamente para generar la respuesta.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Finalidad y base jurídica", title: "Finalidad", accent: "del tratamiento",
      body: (
        <>
          <P>Resumen de las finalidades del tratamiento y de las bases jurídicas correspondientes según el RGPD.</P>
          <BasisTable
            head={["Finalidad del tratamiento", "Base jurídica (RGPD)"]}
            rows={[
              ["Ejecución del contrato de compraventa", "Art. 6, apdo. 1, letra b), del RGPD"],
              ["Gestión de pagos", "Art. 6, apdo. 1, letra b), del RGPD"],
              ["Prestación del servicio AI Chat", "Art. 6, apdo. 1, letra b), del RGPD"],
              ["Chat con el asistente de IA en el sitio web (conversación, correo electrónico, respuesta por correo)", "Art. 6, apdo. 1, letra b), del RGPD (servicio prestado a petición suya)"],
              ["Revisión de las conversaciones del chat para mejorar la atención y el asistente", "Art. 6, apdo. 1, letra f), del RGPD (interés legítimo)"],
              ["Asociación del recorrido de la visita y de la grabación de Clarity a la conversación", "Art. 6, apdo. 1, letra a), del RGPD (consentimiento a las cookies analíticas)"],
              ["Envío de productos", "Art. 6, apdo. 1, letra b), del RGPD"],
              ["Tramitación de reclamaciones", "Art. 6, apdo. 1, letra c), del RGPD (obligación legal)"],
              ["Emisión de facturas", "Art. 6, apdo. 1, letra c), del RGPD (obligación legal)"],
              ["Marketing directo", "Art. 6, apdo. 1, letra f), del RGPD (interés legítimo)"],
              ["Analítica y estadísticas", "Art. 6, apdo. 1, letra f), del RGPD (interés legítimo)"],
              ["Boletín informativo (si se ha dado el consentimiento)", "Art. 6, apdo. 1, letra a), del RGPD (consentimiento)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Plazo de conservación", title: "Plazo", accent: "de conservación",
      body: (
        <>
          <P>
            Conservamos los datos personales durante los plazos exigidos por la ley o durante el tiempo
            necesario para cumplir las finalidades del tratamiento:
          </P>
          <ULWide>
            <li><B>Datos de transacciones y facturas:</B> 5 años desde el final del año natural en que nació la obligación tributaria.</li>
            <li><B>Datos relativos al contrato:</B> durante la vigencia del contrato y durante el tiempo exigido por la ley (p. ej., 6 años en relación con la prescripción de las acciones).</li>
            <li><B>Datos relacionados con los tokens de IA</B> (saldo, compras de paquetes, códigos activados)<B>:</B> mientras se mantenga la cuenta y durante 3 años tras su eliminación.</li>
            <li><B>Historial de AI Chat:</B> mientras se mantenga la cuenta (hasta que el usuario elimine la conversación o la cuenta) y hasta 30 días después de la eliminación de la cuenta.</li>
            <li><B>Datos de marketing (consentimiento):</B> hasta la retirada del consentimiento o la presentación de una oposición.</li>
            <li><B>Datos analíticos:</B> hasta 25 meses desde la última actividad.</li>
            <li><B>Conversaciones del chat del sitio web</B> (correo electrónico, contenido, recorrido de la visita)<B>:</B> 12 meses desde el último mensaje de la conversación; después se eliminan automáticamente; antes, a petición suya.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Comunicación de datos", title: "Destinatarios", accent: "",
      body: (
        <>
          <P>Los datos personales pueden comunicarse a las siguientes categorías de destinatarios:</P>
          <ULWide>
            <li><B>Stripe</B> – operador de pagos (procesamiento de transacciones con tarjetas de pago, incluidas las compras de paquetes de tokens de IA).</li>
            <li><B>InPost</B> – empresa de mensajería (entrega de productos en taquillas automáticas Paczkomat).</li>
            <li><B>Resend</B> – servicio de correo electrónico (envío de mensajes transaccionales y magic links).</li>
            <li><B>Google AI (Gemini)</B> – proveedor del servicio AI Chat (procesamiento de consultas en el chatbot).</li>
            <li><B>OpenRouter, Inc.</B> (EE. UU.) – intermediario en el acceso a modelos de IA (entre otros, Google Gemini); recibe el contenido de los mensajes del chat del sitio web y de AI Chat para generar la respuesta. No le transmitimos la dirección de correo electrónico.</li>
            <li><B>Microsoft Clarity</B> – herramienta analítica (mapas de calor, grabaciones de sesiones) utilizada únicamente tras el consentimiento a las cookies analíticas; véase la sección 9.</li>
            <li><B>Proveedor de alojamiento</B> – almacenamiento de datos en servidores VPS.</li>
            <li><B>Proveedor de la base de datos PostgreSQL</B> – almacenamiento de los datos de los usuarios.</li>
            <li><B>Entidades autorizadas por ley</B> – autoridades públicas y tribunales (cuando así lo exija la legislación).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Todos los destinatarios de los datos actúan sobre la base de contratos de encargo del
              tratamiento de datos personales y están obligados a mantener su confidencialidad y a aplicar
              medidas de seguridad adecuadas.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Transferencias fuera del EEE", title: "Transferencias", accent: "fuera del EEE",
      body: (
        <>
          <P>
            Algunos proveedores de servicios (p. ej., Stripe, Google AI, OpenRouter, Microsoft Clarity) pueden tratar
            datos fuera del Espacio Económico Europeo (EEE). En tales casos:
          </P>
          <UL>
            <li>Garantizamos salvaguardias adecuadas de conformidad con el RGPD (cláusulas contractuales tipo aprobadas por la Comisión Europea).</li>
            <li>La transferencia se realiza únicamente a países que garantizan un nivel adecuado de protección de datos o a entidades que aplican garantías adecuadas.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Derechos de los usuarios", title: "Derechos", accent: "de los usuarios",
      body: (
        <>
          <P>De conformidad con el RGPD, usted tiene los siguientes derechos:</P>

          <SubH>8.1. Acceso a los datos — art. 15 del RGPD</SubH>
          <P>
            Tiene derecho a obtener confirmación de si estamos tratando sus datos personales
            y, en tal caso, a acceder a ellos y a obtener una copia.
          </P>

          <SubH>8.2. Rectificación — art. 16 del RGPD</SubH>
          <P>
            Tiene derecho a solicitar la rectificación sin demora de los datos inexactos
            o que se completen los datos incompletos.
          </P>

          <SubH>8.3. Supresión («derecho al olvido») — art. 17 del RGPD</SubH>
          <P>En determinados casos, tiene derecho a solicitar la supresión de sus datos personales.</P>

          <SubH>8.4. Limitación del tratamiento — art. 18 del RGPD</SubH>
          <P>En determinadas situaciones, puede solicitar la limitación del tratamiento de sus datos.</P>

          <SubH>8.5. Portabilidad de los datos — art. 20 del RGPD</SubH>
          <P>
            Tiene derecho a recibir sus datos en un formato estructurado, de uso común
            y de lectura mecánica, y a transmitirlos a otro responsable del tratamiento.
          </P>

          <SubH>8.6. Oposición — art. 21 del RGPD</SubH>
          <P>
            Tiene derecho a oponerse al tratamiento de sus datos con fines de marketing
            o sobre la base de un interés legítimo.
          </P>

          <SubH>8.7. Retirada del consentimiento — art. 7, apdo. 3, del RGPD</SubH>
          <P>
            Si el tratamiento se basa en el consentimiento, tiene derecho a retirarlo
            en cualquier momento.
          </P>

          <SubH>8.8. Reclamación ante la autoridad de control — art. 77 del RGPD</SubH>
          <P>
            Tiene derecho a presentar una reclamación ante el Presidente de la Oficina polaca de Protección de Datos
            Personales (PUODO) si considera que el tratamiento de sus datos infringe el RGPD.
          </P>
          <InfoBox title="PUODO · contacto">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>Para ejercer los derechos mencionados, póngase en contacto con nosotros por correo electrónico o a través del formulario de contacto.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Qué son las cookies</SubH>
          <P>
            Las cookies son pequeños archivos de texto que se guardan en el dispositivo del usuario
            al visitar un sitio web.
          </P>

          <SubH>9.2. Qué cookies utilizamos</SubH>
          <ULWide>
            <li><B>Necesarias</B> — garantizan las funciones básicas del sitio web (sesión del usuario, carrito, inicio de sesión).</li>
            <li><B>Funcionales</B> — recuerdan sus preferencias (p. ej., el modo oscuro).</li>
            <li><B>Analíticas</B> — nos ayudan a entender cómo utilizan los usuarios el sitio web (mapas de calor, grabaciones de sesiones, estadísticas de visitas). Para ello utilizamos <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>De marketing</B> — se utilizan para personalizar la publicidad (solo con consentimiento).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity se carga únicamente tras otorgar el consentimiento a las cookies analíticas
            en el banner de consentimiento («Aceptar todas»). La herramienta guarda en el dispositivo, entre otras,
            las cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> y <Mono>SM</Mono>, que sirven para reconocer al
            usuario que regresa, grabar sesiones y generar mapas de calor. Los datos
            son tratados por Microsoft Corporation de conformidad con la{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">política de privacidad de Microsoft Clarity</A>.
            El consentimiento puede retirarse en cualquier momento borrando los datos del banner de consentimiento
            en la configuración del navegador (localStorage) y seleccionando «Solo esenciales».
          </P>

          <SubH>9.4. Almacenamiento del navegador utilizado por el chat</SubH>
          <P>
            El chat con el asistente guarda en el almacenamiento del navegador (localStorage) el identificador de su
            conversación para que pueda continuarse tras recargar la página; esto es necesario para el funcionamiento del
            servicio que usted solicita y se elimina al hacer clic en «Terminar». Solo con el consentimiento a las cookies
            analíticas, el chat guarda también en sessionStorage (hasta que se cierre la pestaña) la lista de subpáginas
            y secciones visitadas a que se refiere el punto 3.4.
          </P>

          <SubH>9.5. Gestión de las cookies</SubH>
          <P>
            Puede gestionar las cookies a través de la configuración del navegador. No obstante, tenga
            en cuenta que desactivar las cookies puede afectar a la funcionalidad del Sitio
            (p. ej., el inicio de sesión o el carrito de la compra).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Seguridad de los datos", title: "Seguridad", accent: "",
      body: (
        <>
          <P>
            Aplicamos medidas técnicas y organizativas adecuadas para proteger los datos
            personales frente a:
          </P>
          <UL>
            <li>el acceso no autorizado,</li>
            <li>la pérdida,</li>
            <li>la destrucción,</li>
            <li>la modificación no autorizada,</li>
            <li>la difusión no autorizada.</li>
          </UL>
          <Gap size={5}>
            <P>En particular, aplicamos:</P>
          </Gap>
          <UL>
            <li>cifrado de las conexiones SSL/TLS (HTTPS),</li>
            <li>almacenamiento seguro de las contraseñas (algoritmo bcrypt con sal),</li>
            <li>protección de la sesión del usuario (cookies HttpOnly y Secure),</li>
            <li>restricción del acceso a los datos exclusivamente a las personas autorizadas,</li>
            <li>actualizaciones periódicas del software y del sistema,</li>
            <li>supervisión de la seguridad de la infraestructura,</li>
            <li>copias de seguridad periódicas de la base de datos.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatización y elaboración de perfiles", title: "Automatización", accent: "",
      body: (
        <>
          <P>
            En el Sitio no aplicamos decisiones automatizadas, incluida la elaboración de perfiles,
            que produzcan efectos jurídicos en los Usuarios o les afecten significativamente
            de modo similar.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) y el asistente del chat del sitio web son herramientas de
              apoyo que responden a las consultas de los usuarios, pero no toman decisiones
              automatizadas con efectos jurídicos. El recorrido de la visita asociado a la
              conversación (solo con consentimiento) sirve exclusivamente para adaptar las respuestas y mejorar el sitio web.
              En la ventana del chat le informamos de que está hablando con una IA.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Datos de menores", title: "Datos", accent: "de menores",
      body: (
        <>
          <P>
            El Sitio KalkMate.pl puede ser utilizado por menores de edad (alumnos de educación
            secundaria). Si el usuario es menor de 18 años, la compra de la calculadora y el uso
            de AI Chat requieren el consentimiento de su padre, madre o tutor legal.
          </P>
          <Gap>
            <P>
              No recopilamos conscientemente datos personales de niños menores de 13 años sin
              el consentimiento de sus padres/tutores.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Cambios en la política", title: "Cambios", accent: "en la política",
      body: (
        <>
          <P>
            La Política de privacidad puede modificarse como consecuencia de la evolución tecnológica,
            de cambios legislativos o de cambios en la actividad del Sitio.
          </P>
          <Gap>
            <P>Informaremos a los Usuarios de cualquier cambio significativo mediante:</P>
          </Gap>
          <UL>
            <li>un aviso en la página principal del Sitio,</li>
            <li>un mensaje de correo electrónico (para los usuarios registrados).</li>
          </UL>
          <Gap>
            <P>
              La versión vigente de la Política de privacidad está siempre disponible en:{" "}
              <A href="/es/polityka-prywatnosci">kalkmate.pl/es/polityka-prywatnosci</A>
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
            Puede dirigir cualquier pregunta relativa al tratamiento de datos personales y al ejercicio
            de sus derechos a:
          </P>
          <UL>
            <li>Correo electrónico: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Teléfono: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/es/pomoc#kontakt">Formulario de contacto</A>{" "}disponible en el sitio web.</li>
          </UL>
          <Gap size={5}>
            <P>Nos comprometemos a responder a sus consultas en un plazo de 30 días desde su recepción.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Gracias por su confianza y por utilizar KalkMate.pl. Concedemos especial importancia
      a la protección de su privacidad y a la seguridad de sus datos personales.
    </>
  ),
  footerNote: "Última actualización · 2026-10-28 (chat con el asistente de IA en el sitio web)",
  otherDocLabel: "→ Términos y condiciones",
  homeLabel: "← Página principal",
};

export default doc;
