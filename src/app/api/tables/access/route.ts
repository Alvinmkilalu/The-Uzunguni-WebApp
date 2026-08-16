import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const staff=await getApiStaff();if(!staff)return NextResponse.json({error:"Sign in required."},{status:401});
  const{sessionId,enabled,durationMinutes=30}=await request.json();const duration=Number(durationMinutes);
  if(!sessionId||typeof enabled!=="boolean"||!Number.isInteger(duration)||duration<5||duration>60)return NextResponse.json({error:"Choose an access window between 5 and 60 minutes."},{status:400});
  const{data:session}=await staff.supabase.from("table_sessions").select("id,table_id,waiter_id,status").eq("id",sessionId).single();
  if(!session||(staff.profile.role!=="ADMIN"&&session.waiter_id!==staff.user.id))return NextResponse.json({error:"You do not control this table session."},{status:403});
  if(["CLOSED","CANCELLED","SETTLED"].includes(session.status))return NextResponse.json({error:"Customer access cannot be opened for this session."},{status:400});
  const admin=createAdminClient();const expiresAt=enabled?new Date(Date.now()+duration*60_000).toISOString():null;
  const{error}=await admin.from("table_sessions").update({customer_access_enabled:enabled,customer_access_expires_at:expiresAt}).eq("id",sessionId);if(error)return NextResponse.json({error:error.message},{status:400});
  if(!enabled)await admin.from("customer_access_sessions").update({revoked_at:new Date().toISOString(),revoked_reason:"STAFF_LOCKED"}).eq("table_session_id",sessionId).is("revoked_at",null);
  await admin.from("security_audit_events").insert({event_type:enabled?"CUSTOMER_ACCESS_OPENED":"CUSTOMER_ACCESS_LOCKED",actor_id:staff.user.id,table_id:session.table_id,table_session_id:sessionId,metadata:{duration_minutes:enabled?duration:null}});
  return NextResponse.json({ok:true,enabled,expiresAt});
}