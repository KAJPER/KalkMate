import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/cs";

export const generateMetadata = () => legalMetadata("cs", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="cs" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
