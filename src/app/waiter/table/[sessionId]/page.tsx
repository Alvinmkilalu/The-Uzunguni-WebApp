import { notFound } from "next/navigation";
import StaffShell from "@/components/StaffShell";
import TableWorkspace from "@/components/TableWorkspace";
import { requireStaff } from "@/lib/auth";

export default async function WorkspacePage({params}:{params:Promise<{sessionId:string}>}) {
  const {sessionId}=await params; const {supabase,profile}=await requireStaff();
  const {data:session}=await supabase.from("table_sessions").select("id,status,opened_at,customer_access_enabled,customer_access_expires_at,dining_tables(table_number,label)").eq("id",sessionId).single(); if(!session)notFound();
  const [{data:items},{data:menu},{data:payments}]=await Promise.all([supabase.from("order_items").select("id,item_name,unit_price_amount,quantity").eq("table_session_id",sessionId).order("created_at"),supabase.from("menu_items").select("id,name,category,price_amount").eq("is_active",true).order("category"),supabase.from("payments").select("id,amount,payment_method,status,provider_reference,created_at").eq("table_session_id",sessionId).order("created_at",{ascending:false})]);
  const table=Array.isArray(session.dining_tables)?session.dining_tables[0]:session.dining_tables as {table_number:number;label:string}|null;
  const accessOpen=Boolean(session.customer_access_enabled&&session.customer_access_expires_at&&new Date(session.customer_access_expires_at)>new Date());
  return <StaffShell role={profile.role} name={profile.full_name}><header className="ops-header"><div><p className="eyebrow">CITY PARK · {table?.label?.toUpperCase()} · SESSION {session.id.slice(0,8).toUpperCase()}</p><h1>{table?.label} workspace</h1><p>Opened {new Date(session.opened_at).toLocaleString()} · Status: {session.status.replaceAll("_"," ")}</p></div></header><TableWorkspace sessionId={sessionId} sessionStatus={session.status} items={items||[]} menu={menu||[]} payments={payments||[]} isAdmin={profile.role==="ADMIN"} accessEnabled={accessOpen} accessExpiresAt={session.customer_access_expires_at}/></StaffShell>;
}