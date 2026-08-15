import StaffShell from "@/components/StaffShell";
import WaiterDashboard from "@/components/WaiterDashboard";
import { requireStaff } from "@/lib/auth";

export default async function WaiterPage() {
  const { supabase, profile } = await requireStaff();
  const [{data:tables},{data:sessions}] = await Promise.all([
    supabase.from("dining_tables").select("id,table_number,label").eq("is_active",true).order("table_number"),
    supabase.from("table_sessions").select("id,table_id,status,opened_at").not("status","in",'(CLOSED,CANCELLED)').order("opened_at",{ascending:false})
  ]);
  return <StaffShell role={profile.role} name={profile.full_name}><header className="ops-header"><div><p className="eyebrow">MY SERVICE AREA</p><h1>My tables</h1><p>Only table sessions initiated by you appear here.</p></div></header><WaiterDashboard tables={tables||[]} sessions={sessions||[]}/></StaffShell>;
}
