import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/fr";

export const generateMetadata = () => legalMetadata("fr", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="fr" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
