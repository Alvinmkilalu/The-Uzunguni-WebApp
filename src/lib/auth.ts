import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireStaff(requiredRole?: "ADMIN" | "WAITER") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id,full_name,username,email,role,is_active").eq("id", user.id).single();
  if (!profile?.is_active) redirect("/login?error=Account%20is%20inactive");
  if (requiredRole && profile.role !== requiredRole) redirect(profile.role === "ADMIN" ? "/admin" : "/waiter");
  return { supabase, user, profile };
}

export async function getApiStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,role,is_active").eq("id", user.id).single();
  return profile?.is_active ? { supabase, user, profile } : null;
}
