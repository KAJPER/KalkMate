import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/it";

export const generateMetadata = () => legalMetadata("it", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="it" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
