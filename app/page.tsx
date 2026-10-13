import LeadFlow from "@/components/LeadFlow";
import { authEnabled, isAuthorized } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthorized())) redirect("/login");
  return <LeadFlow showLogout={authEnabled()} />;
}
