import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

export default async function LetterWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string; letterId: string }>;
}) {
  await params;
  return (
    <PlaceholderPage
      title={strings.pages.letterWorkspace.title}
      body={strings.pages.letterWorkspace.body}
    />
  );
}
