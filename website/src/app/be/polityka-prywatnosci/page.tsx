import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/be";

export const generateMetadata = () => legalMetadata("be", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="be" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
