import StaffShell from "@/components/StaffShell";
import CreateEmployeeForm from "@/components/CreateEmployeeForm";
import { requireStaff } from "@/lib/auth";

export default async function EmployeesPage() {
  const { supabase, profile } = await requireStaff("ADMIN");
  const { data: employees } = await supabase.from("profiles").select("id,full_name,username,email,role,is_active,created_at").order("created_at", { ascending: false });
  return <StaffShell role="ADMIN" name={profile.full_name}>
    <header className="ops-header"><div><p className="eyebrow">ACCESS CONTROL</p><h1>Employees</h1><p>Create credentials and review active staff accounts.</p></div></header>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">NEW EMPLOYEE</p><h2>Create waiter account</h2></div></div><CreateEmployeeForm/></section>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">STAFF DIRECTORY</p><h2>Issued accounts</h2></div><span>{employees?.length || 0} accounts</span></div>
      <div className="data-table"><div className="data-head"><span>Employee</span><span>Username</span><span>Role</span><span>Status</span></div>{(employees || []).map(item => <div className="data-row" key={item.id}><span><b>{item.full_name}</b><small>{item.email}</small></span><span>{item.username}</span><span>{item.role}</span><span className={`status-chip ${item.is_active ? "paid" : "failed"}`}>{item.is_active ? "✓ Active" : "× Inactive"}</span></div>)}</div>
    </section>
  </StaffShell>;
}
