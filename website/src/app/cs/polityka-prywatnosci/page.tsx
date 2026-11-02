import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/cs";

export const generateMetadata = () => legalMetadata("cs", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="cs" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
