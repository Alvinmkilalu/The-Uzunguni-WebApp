"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Table = { id: string; table_number: number; label: string; qr_version: number };

export default function QrGrid({ tables }: { tables: Table[] }) {
  const [codes, setCodes] = useState<Record<number,string>>({});
  useEffect(() => { (async () => {
    const entries = await Promise.all(tables.map(async table => {
      const token = `demo-table-${String(table.table_number).padStart(2,"0")}`;
      const url = `${window.location.origin}/pay/${token}`;
      return [table.table_number, await QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#181818", light: "#ffffff" } })] as const;
    })); setCodes(Object.fromEntries(entries));
  })(); }, [tables]);
  function download(tableNumber: number) {
    const anchor = document.createElement("a"); anchor.href = codes[tableNumber]; anchor.download = `Uzunguni-Table-${tableNumber}-QR.png`; anchor.click();
  }
  return <div className="qr-grid">{tables.map(table => <article className="qr-card" key={table.id}>
    {codes[table.table_number] ? <img src={codes[table.table_number]} alt={`QR code for Table ${table.table_number}`} /> : <div className="qr-loading">Generating…</div>}
    <h3>{table.label}</h3><p>Permanent QR · Version {table.qr_version}</p>
    <button onClick={() => download(table.table_number)} disabled={!codes[table.table_number]}>Download PNG</button>
  </article>)}</div>;
}
