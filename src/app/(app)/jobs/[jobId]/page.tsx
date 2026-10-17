import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await params;
  return (
    <PlaceholderPage
      title={strings.pages.jobDetail.title}
      body={strings.pages.jobDetail.body}
    />
  );
}
