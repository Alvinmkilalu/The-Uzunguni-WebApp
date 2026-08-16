"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type Table={id:string;table_number:number;label:string;qr_version:number};
type SecureCode=Table&{url:string};

export default function QrGrid({tables}:{tables:Table[]}){
  const[codes,setCodes]=useState<Record<string,string>>({}),[versions,setVersions]=useState<Record<string,number>>({}),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const generate=useCallback(async(rotateTableId?:string)=>{setBusy(true);setError("");const response=await fetch("/api/admin/qr",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(rotateTableId?{rotateTableId}:{})});const result=await response.json();if(!response.ok){setError(result.error||"Secure QR generation failed.");setBusy(false);return}const generated=await Promise.all((result.codes as SecureCode[]).map(async item=>[item.id,await QRCode.toDataURL(item.url,{width:360,margin:2,color:{dark:"#181818",light:"#ffffff"}}),item.qr_version]as const));setCodes(current=>({...current,...Object.fromEntries(generated.map(([id,image])=>[id,image]))}));setVersions(current=>({...current,...Object.fromEntries(generated.map(([id,,version])=>[id,version]))}));setBusy(false)},[]);
  useEffect(()=>{void generate()},[generate]);
  function download(table:Table){const image=codes[table.id];if(!image)return;const anchor=document.createElement("a");anchor.href=image;anchor.download=`Uzunguni-Table-${table.table_number}-Secure-QR-v${versions[table.id]||table.qr_version}.png`;anchor.click()}
  async function rotate(table:Table){if(!confirm(`Rotate ${table.label}'s QR? The previously printed QR will stop working immediately and this table must be reprinted.`))return;await generate(table.id)}
  return <>{error&&<p className="form-error">⚠ {error}</p>}<div className="qr-grid">{tables.map(table=><article className="qr-card" key={table.id}>{codes[table.id]?<img src={codes[table.id]} alt={`Secure QR code for ${table.label}`}/>:<div className="qr-loading">{busy?"Generating secure QR…":"Unavailable"}</div>}<h3>{table.label}</h3><p>Opaque secure QR · Version {versions[table.id]||table.qr_version}</p><button onClick={()=>download(table)} disabled={!codes[table.id]}>Download PNG</button><button className="qr-rotate" onClick={()=>rotate(table)} disabled={busy}>Rotate compromised QR</button></article>)}</div></>;
}