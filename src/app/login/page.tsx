import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <div className="login-page">
    <section className="login-brand"><div><p>UZUNGUNI CITY PARK</p><h1>Serve with clarity.<br/>Settle with confidence.</h1><span>Secure table operations and verified payments.</span></div></section>
    <section className="login-panel"><div className="login-card"><p className="eyebrow">STAFF ACCESS</p><h2>Welcome back</h2><p className="muted">Sign in using the account issued by your administrator.</p><LoginForm/><div className="security-note">◆ Staff-only system · Activity is recorded</div></div></section>
  </div>;
}
