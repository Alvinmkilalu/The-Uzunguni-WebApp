import StaffShell from "@/components/StaffShell";
import QrGrid from "@/components/QrGrid";
import { requireStaff } from "@/lib/auth";

export default async function TablesPage() {
  const { supabase, profile } = await requireStaff("ADMIN");
  const { data: tables } = await supabase.from("dining_tables").select("id,table_number,label,qr_version").order("table_number");
  return <StaffShell role="ADMIN" name={profile.full_name}>
    <header className="ops-header"><div><p className="eyebrow">TABLE ACCESS</p><h1>QR code register</h1><p>Download each table’s permanent test QR for printing.</p></div></header>
    <div className="notice">ⓘ These QR codes use your current localhost or Vercel address. Print final permanent labels only after the production domain is approved.</div>
    <QrGrid tables={tables || []}/>
  </StaffShell>;
}
