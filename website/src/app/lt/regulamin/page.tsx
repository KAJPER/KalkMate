import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/lt";

export const generateMetadata = () => legalMetadata("lt", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="lt" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
