import StaffShell from "@/components/StaffShell";
import MenuManager from "@/components/MenuManager";
import { requireStaff } from "@/lib/auth";

export default async function MenuPage(){const{supabase,profile}=await requireStaff("ADMIN");const{data:items}=await supabase.from("menu_items").select("id,name,category,price_amount,is_active").order("category").order("name");return <StaffShell role="ADMIN" name={profile.full_name}><header className="ops-header"><div><p className="eyebrow">CONTROLLED MENU</p><h1>Menu and prices</h1><p>Changes affect new orders only; historical bills keep their original price.</p></div></header><MenuManager items={items||[]}/></StaffShell>}
