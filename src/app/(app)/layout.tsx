import { TimezoneCapture } from "@/features/account/components/timezone-capture";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <>
      <TimezoneCapture />
      {children}
    </>
  );
}
