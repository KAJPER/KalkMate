import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/es";

export const generateMetadata = () => legalMetadata("es", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="es" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
