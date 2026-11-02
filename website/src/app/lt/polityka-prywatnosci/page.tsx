import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/lt";

export const generateMetadata = () => legalMetadata("lt", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="lt" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
