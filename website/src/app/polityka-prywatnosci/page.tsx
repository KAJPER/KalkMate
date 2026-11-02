import LegalPage from "@/components/legal/LegalPage";
import { legalMetadata, POLITYKA_PATH, REGULAMIN_PATH } from "@/components/legal/legalMetadata";
import doc from "@/content/legal/polityka/pl";

// Tresc: src/content/legal/polityka/pl.tsx (wersja wiazaca); tlumaczenia
// pod /<jezyk>/polityka-prywatnosci.
export const generateMetadata = () => legalMetadata("pl", POLITYKA_PATH, doc);

export default function PrivacyPolicy() {
  return <LegalPage lang="pl" doc={doc} path={POLITYKA_PATH} otherPath={REGULAMIN_PATH} />;
}
