"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./CustomerBill.module.css";

type BillItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price_amount: number;
  total_amount: number;
  unavailable?: boolean;
};

type Bill = {
  table_number: number;
  table_label: string;
  session_id: string | null;
  status: string;
  items: BillItem[];
  total_amount: number;
  paid_amount: number;
};

type Step =
  | "bill"
  | "choice"
  | "split"
  | "items"
  | "amount"
  | "provider"
  | "phone"
  | "waiting"
  | "success";

type SplitType = "FULL" | "EQUAL" | "ITEM" | "CUSTOM";

const providers = [
  { id: "MPESA", name: "M-Pesa", initials: "MP" },
  { id: "AIRTEL_MONEY", name: "Airtel Money", initials: "AM" },
  { id: "MIXX", name: "Mixx by Yas", initials: "MY" },
  { id: "HALOPESA", name: "HaloPesa", initials: "HP" },
  { id: "SELCOM_PESA", name: "Selcom Pesa", initials: "SP" },
  { id: "AZAMPESA", name: "AzamPesa", initials: "AP" },
] as const;

const money = (value: number) =>
  `TZS ${Math.max(0, value).toLocaleString("en-US")}`;

export default function CustomerBill({ token }: { token: string }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("bill");
  const [splitType, setSplitType] = useState<SplitType>("FULL");
  const [people, setPeople] = useState(3);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<string>("MPESA");
  const [phone, setPhone] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBill = useCallback(async () => {
    const { data } = await createClient().rpc("customer_table_bill", {
      p_qr_token: token,
    });

    setBill(data as Bill | null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadBill();

    const timer = window.setInterval(() => void loadBill(), 5000);

    return () => window.clearInterval(timer);
  }, [loadBill]);

  const remaining = Math.max(
    0,
    (bill?.total_amount ?? 0) - (bill?.paid_amount ?? 0),
  );

  const selectedTotal = useMemo(
    () =>
      (bill?.items ?? [])
        .filter((item) => selectedItems.includes(item.id))
        .reduce((sum, item) => sum + item.total_amount, 0),
    [bill, selectedItems],
  );

  const equalShare = Math.min(remaining, Math.ceil(remaining / people));

  const amount =
    splitType === "FULL"
      ? remaining
      : splitType === "EQUAL"
        ? equalShare
        : splitType === "ITEM"
          ? selectedTotal
          : Number(customAmount || 0);

  const selectedProvider =
    providers.find((provider) => provider.id === method) ?? providers[0];

  function go(next: Step) {
    setError("");
    setStep(next);
  }

  function toggleItem(id: string) {
    setSelectedItems((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  async function startPayment() {
    if (!amount || amount < 1 || amount > remaining) {
      setError(`Enter an amount between TZS 1 and ${money(remaining)}.`);
      return;
    }

    if (splitType === "ITEM" && selectedItems.length === 0) {
      setError("Select at least one available item.");
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch("/api/customer/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrToken: token,
        requestId: crypto.randomUUID(),
        splitType,
        amount,
        method,
        phone,
        itemIds: splitType === "ITEM" ? selectedItems : [],
      }),
    });

    const result = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(result.error || "The payment request could not be sent.");
      return;
    }

    setIntentId(result.intentId);
    setMaskedPhone(result.maskedPhone);
    go("waiting");
  }

  useEffect(() => {
    if (step !== "waiting" || !intentId) return;

    let stopped = false;
    let attempts = 0;

    const check = async () => {
      attempts += 1;

      const response = await fetch(
        `/api/customer/payments/status?intentId=${encodeURIComponent(
          intentId,
        )}&qrToken=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (stopped) return;

      if (result.status === "PAID") {
        setReference(result.reference || "");
        setPaidAmount(result.amount || amount);

        await loadBill();
        go("success");
        return;
      }

      if (
        ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status)
      ) {
        setError(
          result.message ||
            "Payment was not completed. No money was recorded.",
        );

        setStep("phone");
        return;
      }

      if (attempts >= 60) {
        setError(
          "Confirmation is taking longer than expected. You can check again or retry safely.",
        );

        setStep("phone");
        return;
      }

      window.setTimeout(check, 3000);
    };

    const timer = window.setTimeout(check, 1500);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [step, intentId, token, amount, loadBill]);

  if (loading) {
    return (
      <main className={styles.phone}>
        <div className={styles.center}>
          Checking this table securely...
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className={styles.phone}>
        <Empty
          title="QR not recognised"
          text="Please scan the QR label fixed to your table again."
        />
      </main>
    );
  }

  if (!bill.session_id) {
    return (
      <main className={styles.phone}>
        <Top table={bill.table_label} />
        <Empty
          title="No active bill"
          text="Ask your waiter to initiate the table after taking your order."
        />
      </main>
    );
  }

  return (
    <main className={styles.phone}>
      <Top table={bill.table_label} />

      {step === "bill" && (
        <Screen eyebrow="SECURE LIVE BILL" title="Your bill">
          <div className={styles.itemsCard}>
            <p className={styles.cardLabel}>
              ITEMS · {bill.items.length}
            </p>

            {bill.items.map((item) => (
              <div className={styles.billItem} key={item.id}>
                <span>
                  <b>{item.name}</b>
                  <small>
                    Qty {item.quantity} · {money(item.unit_price_amount)} each
                  </small>
                </span>

                <strong>{money(item.total_amount)}</strong>
              </div>
            ))}
          </div>

          <div className={styles.totals}>
            <div>
              <span>Total</span>
              <b>{money(bill.total_amount)}</b>
            </div>

            <div>
              <span>Already paid</span>
              <b>{money(bill.paid_amount)}</b>
            </div>

            <div className={styles.remaining}>
              <span>REMAINING BALANCE</span>
              <strong>{money(remaining)}</strong>
            </div>
          </div>

          <p className={styles.live}>◷ Updated automatically</p>

          {remaining > 0 ? (
            <StickyButton onClick={() => go("choice")}>
              ▣ Pay {money(remaining)}
            </StickyButton>
          ) : (
            <div className={styles.paidTag}>
              ✓ Paid in full · Server verified
            </div>
          )}
        </Screen>
      )}

      {step === "choice" && (
        <Screen
          back={() => go("bill")}
          eyebrow={`${bill.table_label.toUpperCase()} · REMAINING ${money(
            remaining,
          )}`}
          title="How would you like to pay?"
        >
          <Choice
            title="Full bill"
            text={`Pay the remaining ${money(remaining)} yourself`}
            icon="▣"
            onClick={() => {
              setSplitType("FULL");
              go("provider");
            }}
          />

          <Choice
            title="Split bill"
            text="Share the bill with others at the table"
            icon="♧"
            onClick={() => go("split")}
          />

          <p className={styles.help}>
            Nothing is final until you approve the secure prompt on your
            phone.
          </p>
        </Screen>
      )}

      {step === "split" && (
        <Screen
          back={() => go("choice")}
          eyebrow={`${bill.table_label.toUpperCase()} · SPLIT BILL`}
          title="Split the bill"
        >
          <Choice
            title="Split equally"
            text="Divide evenly by number of people"
            icon="♧"
            selected={splitType === "EQUAL"}
            onClick={() => setSplitType("EQUAL")}
          >
            {splitType === "EQUAL" && (
              <div
                className={styles.stepper}
                onClick={(event) => event.stopPropagation()}
              >
                <span>Number of people</span>

                <button
                  onClick={() => setPeople(Math.max(2, people - 1))}
                >
                  −
                </button>

                <b>{people}</b>

                <button
                  onClick={() => setPeople(Math.min(20, people + 1))}
                >
                  +
                </button>

                <small>
                  You pay {money(equalShare)} as one share
                </small>
              </div>
            )}
          </Choice>

          <Choice
            title="Select items"
            text="Choose exactly what you ordered"
            icon="▤"
            onClick={() => {
              setSplitType("ITEM");
              go("items");
            }}
          />

          <Choice
            title="Custom amount"
            text="Pick items to pay for, or type any amount"
            icon="＋"
            onClick={() => {
              setSplitType("CUSTOM");
              go("amount");
            }}
          />

          {splitType === "EQUAL" && (
            <StickyButton onClick={() => go("provider")}>
              Continue · {money(equalShare)}
            </StickyButton>
          )}
        </Screen>
      )}

      {step === "items" && (
        <Screen
          back={() => go("split")}
          eyebrow={`${bill.table_label.toUpperCase()} · SELECT ITEMS`}
          title="Select items to pay"
        >
          <div className={styles.itemsCard}>
            <p className={styles.cardLabel}>
              TAP TO SELECT · {bill.items.length} ITEMS
            </p>

            {bill.items.map((item) => (
              <button
                className={`${styles.selectItem} ${
                  selectedItems.includes(item.id) ? styles.checked : ""
                }`}
                key={item.id}
                disabled={item.unavailable}
                onClick={() => toggleItem(item.id)}
              >
                <span className={styles.checkbox}>
                  {item.unavailable
                    ? "–"
                    : selectedItems.includes(item.id)
                      ? "✓"
                      : ""}
                </span>

                <span>
                  <b>{item.name}</b>

                  <small>
                    {item.unavailable
                      ? "Already paid or reserved"
                      : `Qty ${item.quantity} · ${money(
                          item.unit_price_amount,
                        )} each`}
                  </small>
                </span>

                <strong>{money(item.total_amount)}</strong>
              </button>
            ))}
          </div>

          <p className={styles.help}>
            Locked items cannot be selected again while another payment is
            pending or completed.
          </p>

          <StickyButton
            disabled={!selectedTotal}
            onClick={() => go("provider")}
          >
            Pay {money(selectedTotal)}
          </StickyButton>
        </Screen>
      )}

      {step === "amount" && (
        <Screen
          back={() => go("split")}
          eyebrow={`${bill.table_label.toUpperCase()} · CUSTOM AMOUNT`}
          title="Pay a custom amount"
        >
          <div className={styles.tabs}>
            <button className={styles.activeTab}>Type amount</button>

            <button
              onClick={() => {
                setSplitType("ITEM");
                go("items");
              }}
            >
              Pick items
            </button>
          </div>

          <p className={styles.amountHint}>
            OF {money(remaining)} REMAINING
          </p>

          <label className={styles.amountInput}>
            <span>TZS</span>

            <input
              value={customAmount}
              onChange={(event) =>
                setCustomAmount(event.target.value.replace(/\D/g, ""))
              }
              inputMode="numeric"
              placeholder="0"
              autoFocus
            />
          </label>

          <div className={styles.quickAmounts}>
            {[25, 50, 75].map((percent) => (
              <button
                key={percent}
                onClick={() =>
                  setCustomAmount(
                    String(Math.floor((remaining * percent) / 100)),
                  )
                }
              >
                {percent}%
              </button>
            ))}

            <button onClick={() => setCustomAmount(String(remaining))}>
              Remaining
            </button>
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <StickyButton
            disabled={
              !Number(customAmount) ||
              Number(customAmount) > remaining
            }
            onClick={() => go("provider")}
          >
            Pay {money(Number(customAmount || 0))}
          </StickyButton>
        </Screen>
      )}

      {step === "provider" && (
        <Screen
          back={() =>
            go(
              splitType === "FULL"
                ? "choice"
                : splitType === "EQUAL"
                  ? "split"
                  : splitType === "ITEM"
                    ? "items"
                    : "amount",
            )
          }
          eyebrow={`${splitType.replace("_", " ")} · ${money(amount)}`}
          title="Choose how to pay"
        >
          <p className={styles.cardLabel}>MOBILE MONEY</p>

          <div className={styles.providers}>
            {providers.map((provider) => (
              <button
                key={provider.id}
                className={
                  method === provider.id
                    ? styles.providerSelected
                    : ""
                }
                onClick={() => setMethod(provider.id)}
              >
                <span className={styles.providerIcon}>
                  {provider.initials}
                </span>

                <span>
                  <b>{provider.name}</b>
                  <small>Push prompt to your phone</small>
                </span>

                <strong>›</strong>
              </button>
            ))}
          </div>

          <StickyButton onClick={() => go("phone")}>
            Continue with {selectedProvider.name}
          </StickyButton>
        </Screen>
      )}

      {step === "phone" && (
        <Screen
          back={() => go("provider")}
          eyebrow={`${selectedProvider.name.toUpperCase()} · ${money(
            amount,
          )}`}
          title="Enter your phone number"
        >
          <div className={styles.promptCard}>
            <span className={styles.providerIcon}>
              {selectedProvider.initials}
            </span>

            <div>
              <b>{selectedProvider.name}</b>
              <small>
                A secure approval prompt will be sent to this phone.
              </small>
            </div>
          </div>

          <label className={styles.phoneInput}>
            Mobile-money number

            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
            />
          </label>

          <div className={styles.securityBox}>
            <b>🔒 Your PIN stays private</b>

            <span>
              Enter your wallet PIN only in the secure prompt displayed by
              your mobile network. Uzunguni never asks for or stores it.
            </span>
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <StickyButton
            disabled={
              submitting || phone.replace(/\D/g, "").length < 9
            }
            onClick={startPayment}
          >
            {submitting
              ? "Sending securely..."
              : `Send ${selectedProvider.name} prompt`}
          </StickyButton>
        </Screen>
      )}

      {step === "waiting" && (
        <Screen eyebrow="PAYMENT PENDING" title="Check your phone">
          <div className={styles.waitingIcon}>
            <span />
          </div>

          <h2 className={styles.centerTitle}>
            Approve {money(amount)}
          </h2>

          <p className={styles.centerText}>
            A {selectedProvider.name} prompt was sent to{" "}
            <b>{maskedPhone}</b>. Enter your PIN in that provider prompt,
            not on this website.
          </p>

          <div className={styles.pendingBox}>
            <span className={styles.pulse} />

            <div>
              <b>Waiting for provider confirmation...</b>
              <small>
                The bill updates only after the provider confirms the
                payment.
              </small>
            </div>
          </div>

          <p className={styles.help}>
            Do not refresh or send another payment while this request is
            pending.
          </p>
        </Screen>
      )}

      {step === "success" && (
        <Screen eyebrow="SERVER VERIFIED" title="Payment received">
          <div className={styles.successIcon}>✓</div>

          <div className={styles.receipt}>
            <div>
              <span>Amount paid</span>
              <b>{money(paidAmount)}</b>
            </div>

            <div>
              <span>Method</span>
              <b>{selectedProvider.name}</b>
            </div>

            <div>
              <span>Reference</span>
              <b>{reference}</b>
            </div>

            <div>
              <span>Remaining on bill</span>
              <b>{money(remaining)}</b>
            </div>

            <em>
              ✓ {remaining === 0 ? "Paid in full" : "Partially paid"}
            </em>
          </div>

          <div className={styles.successActions}>
            <button onClick={() => window.print()}>▤ Receipt</button>

            <button
              onClick={() => {
                setIntentId(null);
                setSelectedItems([]);
                setCustomAmount("");
                go("bill");
              }}
            >
              Done
            </button>
          </div>
        </Screen>
      )}
    </main>
  );
}

function Top({ table }: { table: string }) {
  return (
    <header className={styles.top}>
      <b>UZUNGUNI CITY PARK</b>
      <small>{table}</small>
    </header>
  );
}

function Screen({
  eyebrow,
  title,
  back,
  children,
}: {
  eyebrow: string;
  title: string;
  back?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.screen}>
      {back && (
        <button
          className={styles.back}
          onClick={back}
          aria-label="Go back"
        >
          ‹
        </button>
      )}

      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <div className={styles.rule} />

      {children}
    </section>
  );
}

function Choice({
  title,
  text,
  icon,
  selected,
  onClick,
  children,
}: {
  title: string;
  text: string;
  icon: string;
  selected?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      className={`${styles.choice} ${
        selected ? styles.choiceSelected : ""
      }`}
      onClick={onClick}
    >
      <span className={styles.choiceIcon}>{icon}</span>

      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>

      <i>{selected ? "●" : "○"}</i>

      {children}
    </button>
  );
}

function StickyButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.sticky}>
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.center}>
      <div className={styles.successIcon}>✓</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}