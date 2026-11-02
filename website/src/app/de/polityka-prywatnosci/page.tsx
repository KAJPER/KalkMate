import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/de";

export const generateMetadata = () => legalMetadata("de", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="de" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
