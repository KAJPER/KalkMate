import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/regulamin/pl";

// Tresc: src/content/legal/regulamin/pl.tsx (wersja wiazaca); tlumaczenia
// pod /<jezyk>/regulamin.
export const generateMetadata = () => legalMetadata("pl", REGULAMIN_PATH, doc);

export default function RegulaminPage() {
  return <LegalPage lang="pl" doc={doc} path={REGULAMIN_PATH} otherPath={POLITYKA_PATH} />;
}
