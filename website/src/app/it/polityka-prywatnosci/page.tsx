import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/it";

export const generateMetadata = () => legalMetadata("it", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="it" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
