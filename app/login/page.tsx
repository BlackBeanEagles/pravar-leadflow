import { redirect } from "next/navigation";
import { authEnabled, isAuthorized } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!authEnabled() || await isAuthorized()) redirect("/");
  return <LoginForm />;
}
