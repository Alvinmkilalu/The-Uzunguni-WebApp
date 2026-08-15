"use client";

import { useMemo, useState } from "react";

type Screen = "bill" | "how" | "split" | "custom" | "wallet" | "prompt" | "success";
type SplitMode = "full" | "equal" | "items" | "amount";

const items = [
  ["Uzunguni grilled chicken", 28000],
  ["Pilau ya nyama", 18000],
  ["Beef mishkaki", 16000],
  ["Fresh juice", 12000],
  ["Soda", 6000]
] as const;

const money = (value: number) => `TZS ${new Intl.NumberFormat("en-US").format(value)}`;

function Arrow() { return <span className="arrow">←</span>; }

export default function Home() {
  const [screen, setScreen] = useState<Screen>("bill");
  const [splitMode, setSplitMode] = useState<SplitMode>("full");
  const [people, setPeople] = useState(2);
  const [selected, setSelected] = useState<number[]>([0]);
  const [customAmount, setCustomAmount] = useState("25000");
  const [wallet, setWallet] = useState("M-Pesa");
  const [phone, setPhone] = useState("0712 345 678");

  const billTotal = 106000;
  const payable = useMemo(() => {
    if (splitMode === "equal") return Math.ceil(billTotal / people / 100) * 100;
    if (splitMode === "items") return selected.reduce((sum, index) => sum + items[index][1], 0);
    if (splitMode === "amount") return Math.min(Math.max(Number(customAmount) || 0, 1000), billTotal);
    return billTotal;
  }, [customAmount, people, selected, splitMode]);

  const back = () => {
    const previous: Record<Screen, Screen> = { bill: "bill", how: "bill", split: "how", custom: "split", wallet: splitMode === "full" ? "how" : "custom", prompt: "wallet", success: "bill" };
    setScreen(previous[screen]);
  };

  const choosePayment = (mode: SplitMode) => {
    setSplitMode(mode);
    setScreen(mode === "full" ? "wallet" : mode === "equal" ? "split" : "custom");
  };

  return (
    <main className="site-shell">
      <header className="site-header"><span className="wordmark">UZUNGUNI</span><a href="/staff">Staff view ↗</a></header>
      <section className="phone-wrap">
        <div className="phone">
          <div className="phone-top"><span>9:41</span><b>UZUNGUNI</b><span className="signal">●●●</span></div>
          <div className="app-bar">{screen !== "bill" && screen !== "success" ? <button className="icon-button" onClick={back} aria-label="Go back"><Arrow /></button> : <span />}<span className="table-pill">Table 12</span><span className="lang">EN</span></div>
          {screen === "bill" && <Bill total={billTotal} onPay={() => setScreen("how")} />}
          {screen === "how" && <HowToPay onPick={choosePayment} />}
          {screen === "split" && <SplitPeople people={people} setPeople={setPeople} amount={payable} onCustom={() => { setSplitMode("items"); setScreen("custom"); }} onContinue={() => setScreen("wallet")} />}
          {screen === "custom" && <CustomSplit selected={selected} setSelected={setSelected} customAmount={customAmount} setCustomAmount={setCustomAmount} amount={payable} onChooseItems={() => { if (!selected.length) setSelected([0]); setSplitMode("items"); }} onChooseAmount={() => { setSelected([]); setSplitMode("amount"); }} onContinue={() => setScreen("wallet")} />}
          {screen === "wallet" && <Wallet wallet={wallet} setWallet={setWallet} phone={phone} setPhone={setPhone} amount={payable} onContinue={() => setScreen("prompt")} />}
          {screen === "prompt" && <Prompt wallet={wallet} phone={phone} amount={payable} onPaid={() => setScreen("success")} />}
          {screen === "success" && <Success amount={payable} remaining={billTotal - payable} onClose={() => setScreen("bill")} />}
        </div>
      </section>
      <p className="demo-note">Demo only - payment approval is simulated. A real site never asks for a mobile-money PIN.</p>
    </main>
  );
}

function Bill({ total, onPay }: { total: number; onPay: () => void }) {
  return <section className="screen bill"><p className="eyebrow">YOUR LIVE BILL</p><h1>Your bill</h1><div className="session"><span>Session #UZP-004-004</span><b>Open</b></div><div className="line" />
    <div className="item-list">{items.map(([name, price]) => <div className="bill-item" key={name}><span><b>{name}</b><small>1 item</small></span><b>{money(price)}</b></div>)}</div>
    <div className="totals"><span>Subtotal <b>{money(total)}</b></span><span>VAT included <b>TZS 0</b></span><strong>Amount due <b>{money(total)}</b></strong></div><button className="primary" onClick={onPay}>Pay TZS 106,000</button>
  </section>;
}

function HowToPay({ onPick }: { onPick: (mode: SplitMode) => void }) { return <section className="screen"><p className="step">1 of 3</p><h1>How would you like to pay?</h1><p className="muted">Choose a payment option for this bill.</p><Choice active icon="●" title="Full bill" text="Pay the full amount now." onClick={() => onPick("full")} /><Choice icon="↗" title="Split bill" text="Share this bill with other people." onClick={() => onPick("equal")} /><div className="bottom"><span>Total bill <b>TZS 106,000</b></span></div></section>; }

function SplitPeople({ people, setPeople, amount, onCustom, onContinue }: { people: number; setPeople: (n: number) => void; amount: number; onCustom: () => void; onContinue: () => void }) { return <section className="screen"><p className="step">2 of 3</p><h1>Choose how to split</h1><p className="muted">Each person pays an equal share.</p><Choice active icon="÷" title="Split equally" text="Divide the bill between everyone." onClick={() => {}} /><Choice icon="⌁" title="Custom split" text="Choose items or enter an amount." onClick={onCustom} /><div className="people"><label>Number of people</label><div><button onClick={() => setPeople(Math.max(2, people - 1))}>−</button><b>{people}</b><button onClick={() => setPeople(Math.min(10, people + 1))}>+</button></div></div><div className="amount-box"><span>You will pay</span><strong>{money(amount)}</strong></div><button className="primary" onClick={onContinue}>Continue</button></section>; }

function CustomSplit({ selected, setSelected, customAmount, setCustomAmount, amount, onChooseItems, onChooseAmount, onContinue }: { selected: number[]; setSelected: (v: number[]) => void; customAmount: string; setCustomAmount: (v: string) => void; amount: number; onChooseItems: () => void; onChooseAmount: () => void; onContinue: () => void }) {
  const isItems = selected.length > 0;
  const toggle = (index: number) => { const next = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index]; setSelected(next); };
  return <section className="screen custom"><p className="step">2 of 3</p><h1>Choose a custom split</h1><Choice active={isItems} icon="□" title="Select items" text="Pay for selected items only." onClick={onChooseItems} /><Choice active={!isItems} icon="✎" title="Enter custom amount" text="Choose the amount you want to pay." onClick={onChooseAmount} />
    {isItems ? <div className="select-items">{items.map(([name, price], index) => <button key={name} onClick={() => toggle(index)} className={selected.includes(index) ? "selected" : ""}><span>{selected.includes(index) ? "✓" : "○"} {name}</span><b>{money(price)}</b></button>)}</div> : <input className="amount-input" inputMode="numeric" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))} aria-label="Custom amount" />}
    <div className="amount-box"><span>You will pay</span><strong>{money(amount)}</strong></div><button className="primary" onClick={onContinue}>Continue</button></section>;
}

function Wallet({ wallet, setWallet, phone, setPhone, amount, onContinue }: { wallet: string; setWallet: (w: string) => void; phone: string; setPhone: (p: string) => void; amount: number; onContinue: () => void }) { const wallets = ["M-Pesa", "Airtel Money", "Mixx by Yas", "HaloPesa", "Selcom Pesa", "AzamPesa"]; return <section className="screen"><p className="step">3 of 3</p><h1>Enter wallet number</h1><p className="muted">Select a wallet and enter the number that will receive the payment prompt.</p><div className="wallets">{wallets.map((item) => <button key={item} className={wallet === item ? "selected" : ""} onClick={() => setWallet(item)}><span>{item}</span><i>{wallet === item ? "✓" : ""}</i></button>)}</div><label className="field-label">{wallet} number</label><input className="phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /><div className="amount-box"><span>You will pay</span><strong>{money(amount)}</strong></div><p className="secure">▣ Your PIN is never entered on this website.</p><button className="primary" onClick={onContinue}>Send payment prompt</button></section>; }

function Prompt({ wallet, phone, amount, onPaid }: { wallet: string; phone: string; amount: number; onPaid: () => void }) { return <section className="screen centered"><div className="success-mark">✓</div><p className="step">PAYMENT REQUEST SENT</p><h1>Check your phone</h1><p className="muted">A {wallet} prompt was sent to <b>{phone}</b>.</p><div className="prompt-card"><b>What happens next</b><ol><li>Open the mobile-money prompt.</li><li>Confirm {money(amount)}.</li><li>Enter your PIN on your phone.</li></ol></div><p className="waiting">Waiting for a secure provider confirmation…</p><button className="secondary" onClick={onPaid}>Demo: approve payment</button></section>; }

function Success({ amount, remaining, onClose }: { amount: number; remaining: number; onClose: () => void }) { return <section className="screen centered receipt"><div className="success-mark">✓</div><p className="step">PAYMENT VERIFIED</p><h1>Payment received</h1><p className="muted">Thank you. Your payment has been confirmed.</p><div className="receipt-card"><span>Amount paid <b>{money(amount)}</b></span><span>Table <b>12</b></span><span>Reference <b>UZP-240815-082</b></span><span>Remaining balance <b>{money(remaining)}</b></span></div><button className="primary" onClick={onClose}>Close</button></section>; }

function Choice({ icon, title, text, active = false, onClick }: { icon: string; title: string; text: string; active?: boolean; onClick: () => void }) { return <button className={`choice ${active ? "active" : ""}`} onClick={onClick}><span className="choice-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><span className="choice-arrow">›</span></button>; }
