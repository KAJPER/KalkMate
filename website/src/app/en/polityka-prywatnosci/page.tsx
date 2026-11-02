import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/en";

export const generateMetadata = () => legalMetadata("en", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="en" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
