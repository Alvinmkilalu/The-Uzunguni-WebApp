import CustomerBill from "@/components/CustomerBill";

export default async function PayPage({params}:{params:Promise<{qrToken:string}>}) { const {qrToken}=await params; return <div className="customer-page"><CustomerBill token={qrToken}/></div>; }
