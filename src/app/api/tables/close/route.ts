import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const staff=await getApiStaff();if(!staff)return NextResponse.json({error:"Sign in required."},{status:401});
  const{sessionId}=await request.json();if(!sessionId)return NextResponse.json({error:"Table session is required."},{status:400});
  const{data:session}=await staff.supabase.from("table_sessions").select("id,waiter_id,status").eq("id",sessionId).single();
  if(!session)return NextResponse.json({error:"Table session not found."},{status:404});
  if(staff.profile.role!=="ADMIN"&&session.waiter_id!==staff.user.id)return NextResponse.json({error:"Only the waiter who initiated this table or an administrator may close it."},{status:403});
  const admin=createAdminClient();const{data,error}=await admin.rpc("close_table_session_secure",{p_session_id:sessionId,p_actor_id:staff.user.id});
  if(error)return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json(data);
}