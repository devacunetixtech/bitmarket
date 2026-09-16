import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, unseal } from "@/lib/session";
import WalletGate from "@/components/WalletGate";
export default async function AppPage() {
  const session = await unseal(
    (await cookies()).get(SESSION_COOKIE)?.value,
    "session",
  );
  if (!session) redirect("/?connect=required");
  return <WalletGate address={session.address} />;
}
