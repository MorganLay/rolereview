import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

/** Import calls the model and may upload a 5 MB file. */
export const maxDuration = 120;

export default function LibraryImportPage() {
  return (
    <PlaceholderPage
      title={strings.pages.libraryImport.title}
      body={strings.pages.libraryImport.body}
    />
  );
}
