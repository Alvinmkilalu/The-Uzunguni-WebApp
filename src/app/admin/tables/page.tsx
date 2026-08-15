import StaffShell from "@/components/StaffShell";
import QrGrid from "@/components/QrGrid";
import { requireStaff } from "@/lib/auth";

export default async function TablesPage() {
  const { supabase, profile } = await requireStaff("ADMIN");
  const { data: tables } = await supabase.from("dining_tables").select("id,table_number,label,qr_version").order("table_number");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return <StaffShell role="ADMIN" name={profile.full_name}>
    <header className="ops-header"><div><p className="eyebrow">TABLE ACCESS</p><h1>QR code register</h1><p>Download each table’s permanent test QR for printing.</p></div></header>
    <div className="notice">ⓘ QR destination: <b>{baseUrl}</b>. After Vercel deployment, set NEXT_PUBLIC_APP_URL to the stable vercel.app address and download the QR codes again.</div>
    <QrGrid tables={tables || []} baseUrl={baseUrl}/>
  </StaffShell>;
}
