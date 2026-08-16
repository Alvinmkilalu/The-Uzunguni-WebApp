import StaffShell from "@/components/StaffShell";
import QrGrid from "@/components/QrGrid";
import { requireStaff } from "@/lib/auth";

export default async function TablesPage() {
  const { supabase, profile } = await requireStaff("ADMIN");

  const { data: tables } = await supabase
    .from("dining_tables")
    .select("id,table_number,label,qr_version")
    .order("table_number");

  return (
    <StaffShell role="ADMIN" name={profile.full_name}>
      <header className="ops-header">
        <div>
          <p className="eyebrow">TABLE ACCESS</p>
          <h1>Secure QR register</h1>

          <p>
            Each code uses an opaque 256-bit identifier. Table numbers
            and session IDs are never encoded in the link.
          </p>
        </div>
      </header>

      <div className="notice">
        ⓘ After the security migration, download and print these new QR
        codes. All old <b>demo-table-01</b> style codes are intentionally
        invalid.
      </div>

      <QrGrid tables={tables || []} />
    </StaffShell>
  );
}