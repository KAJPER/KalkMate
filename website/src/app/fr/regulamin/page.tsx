import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/fr";

export const generateMetadata = () => legalMetadata("fr", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="fr" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
