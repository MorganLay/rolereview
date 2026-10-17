import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

export default async function ResumeWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string; resumeId: string }>;
}) {
  await params;
  return (
    <PlaceholderPage
      title={strings.pages.resumeWorkspace.title}
      body={strings.pages.resumeWorkspace.body}
    />
  );
}
