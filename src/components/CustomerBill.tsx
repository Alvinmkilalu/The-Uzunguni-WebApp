"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import styles from "./CustomerBill.module.css";

type BillItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price_amount: number;
  total_amount: number;
  unavailable?: boolean;

  // Optional future tax fields.
  net_amount?: number;
  vat_amount?: number;
};

type Bill = {
  table_number: number;
  table_label: string;
  session_id: string | null;
  status: string;

  items: BillItem[];

  total_amount: number;
  paid_amount: number;

  /*
   * OPTIONAL FIELDS.
   *
   * The receipt will automatically use these when your
   * backend billing engine begins returning VAT/discount
   * information.
   */
  subtotal_amount?: number;
  discount_amount?: number;
  vat_amount?: number;

  branch_name?: string;
  branch_city?: string;
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
  {
    id: "MPESA",
    name: "M-Pesa",
    initials: "MP",
  },
  {
    id: "AIRTEL_MONEY",
    name: "Airtel Money",
    initials: "AM",
  },
  {
    id: "MIXX",
    name: "Mixx by Yas",
    initials: "MY",
  },
  {
    id: "HALOPESA",
    name: "HaloPesa",
    initials: "HP",
  },
  {
    id: "SELCOM_PESA",
    name: "Selcom Pesa",
    initials: "SP",
  },
  {
    id: "AZAMPESA",
    name: "AzamPesa",
    initials: "AP",
  },
] as const;

/*
 * ============================================================
 * EDIT UZUNGUNI RECEIPT DETAILS HERE
 * ============================================================
 *
 * Replace these mock values when you receive the real
 * business details.
 *
 * Do NOT put payment API secrets here.
 */
const RECEIPT_BUSINESS = {
  name: "UZUNGUNI CITY PARK",

  address: "Tanzania",

  phone: "+255 700 000 000",

  email: "info@uzungunicitypark.co.tz",

  tin: "TIN: TO BE UPDATED",

  vrn: "VRN: TO BE UPDATED",

  /*
   * Put the transparent Uzunguni logo here:
   *
   * public/images/uzunguni-logo.png
   *
   * If the image does not exist, the receipt automatically
   * shows the UZUNGUNI text wordmark instead.
   */
  logoPath: "/images/uzunguni-logo.png",
};

const money = (value: number) =>
  `TZS ${Math.max(0, value).toLocaleString("en-US")}`;

export default function CustomerBill() {
  const [bill, setBill] = useState<Bill | null>(null);

  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>("bill");

  const [splitType, setSplitType] =
    useState<SplitType>("FULL");

  const [people, setPeople] = useState(3);

  const [selectedItems, setSelectedItems] = useState<
    string[]
  >([]);

  const [customAmount, setCustomAmount] = useState("");

  const [method, setMethod] = useState<string>("MPESA");

  const [phone, setPhone] = useState("");

  const [intentId, setIntentId] = useState<
    string | null
  >(null);

  const [reference, setReference] = useState("");

  const [maskedPhone, setMaskedPhone] = useState("");

  const [requestedAmount, setRequestedAmount] =
    useState(0);

  const [paidAmount, setPaidAmount] = useState(0);

  const [paidAt, setPaidAt] = useState("");

  const [showReceipt, setShowReceipt] =
    useState(false);

  const [error, setError] = useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const loadBill = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/customer/bill",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setBill(null);
        setLoading(false);
        return;
      }

      const result = (await response.json()) as Bill;

      setBill(result);
      setLoading(false);
    } catch {
      setBill(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBill();

    const timer = window.setInterval(() => {
      void loadBill();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadBill]);

  const remaining = Math.max(
    0,
    (bill?.total_amount ?? 0) -
      (bill?.paid_amount ?? 0),
  );

  const selectedTotal = useMemo(() => {
    return (bill?.items ?? [])
      .filter((item) =>
        selectedItems.includes(item.id),
      )
      .reduce(
        (sum, item) => sum + item.total_amount,
        0,
      );
  }, [bill, selectedItems]);

  const equalShare = Math.min(
    remaining,
    Math.ceil(remaining / people),
  );

  const amount =
    splitType === "FULL"
      ? remaining
      : splitType === "EQUAL"
        ? equalShare
        : splitType === "ITEM"
          ? selectedTotal
          : Number(customAmount || 0);

  const selectedProvider =
    providers.find(
      (provider) => provider.id === method,
    ) ?? providers[0];

  const go = (next: Step) => {
    setError("");
    setStep(next);
  };

  function toggleItem(id: string) {
    setSelectedItems((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  async function startPayment() {
    if (
      !amount ||
      amount < 1 ||
      amount > remaining
    ) {
      setError(
        `Enter an amount between TZS 1 and ${money(
          remaining,
        )}.`,
      );

      return;
    }

    if (
      splitType === "ITEM" &&
      !selectedItems.length
    ) {
      setError(
        "Select at least one available item.",
      );

      return;
    }

    const paymentAmount = amount;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        "/api/customer/payments",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            requestId: crypto.randomUUID(),

            splitType,

            amount: paymentAmount,

            method,

            phone,

            itemIds:
              splitType === "ITEM"
                ? selectedItems
                : [],
          }),
        },
      );

      const result = await response.json();

      setSubmitting(false);

      if (!response.ok) {
        setError(
          result.error ||
            "The payment request could not be sent.",
        );

        return;
      }

      setRequestedAmount(paymentAmount);

      setIntentId(result.intentId);

      setMaskedPhone(
        result.maskedPhone || "your phone",
      );

      go("waiting");
    } catch {
      setSubmitting(false);

      setError(
        "The payment request could not be sent. Check your connection and try again.",
      );
    }
  }

  useEffect(() => {
    if (
      step !== "waiting" ||
      !intentId
    ) {
      return;
    }

    let stopped = false;
    let attempts = 0;

    const check = async () => {
      attempts++;

      try {
        const response = await fetch(
          `/api/customer/payments/status?intentId=${encodeURIComponent(
            intentId,
          )}`,
          {
            cache: "no-store",
          },
        );

        const result = await response.json();

        if (stopped) {
          return;
        }

        if (result.status === "PAID") {
          setReference(
            result.reference ||
              result.provider_reference ||
              "",
          );

          setPaidAmount(
            Number(
              result.amount || requestedAmount,
            ),
          );

          setPaidAt(new Date().toISOString());

          await loadBill();

          go("success");

          return;
        }

        if (
          [
            "FAILED",
            "EXPIRED",
            "CANCELLED",
          ].includes(result.status)
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
      } catch {
        if (stopped) {
          return;
        }

        if (attempts >= 60) {
          setError(
            "Confirmation is taking longer than expected. Check your connection and try again.",
          );

          setStep("phone");

          return;
        }

        window.setTimeout(check, 3000);
      }
    };

    const timer = window.setTimeout(
      check,
      1500,
    );

    return () => {
      stopped = true;

      window.clearTimeout(timer);
    };
  }, [
    step,
    intentId,
    requestedAmount,
    loadBill,
  ]);

  function finishPaymentFlow() {
    setShowReceipt(false);

    setIntentId(null);

    setReference("");

    setMaskedPhone("");

    setRequestedAmount(0);

    setPaidAmount(0);

    setPaidAt("");

    setSelectedItems([]);

    setCustomAmount("");

    setPhone("");

    setSplitType("FULL");

    setPeople(3);

    go("bill");
  }

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
        <Screen
          eyebrow="SECURE LIVE BILL"
          title="Your bill"
        >
          <div className={styles.itemsCard}>
            <p className={styles.cardLabel}>
              ITEMS · {bill.items.length}
            </p>

            {bill.items.map((item) => (
              <div
                className={styles.billItem}
                key={item.id}
              >
                <span>
                  <b>{item.name}</b>

                  <small>
                    Qty {item.quantity} ·{" "}
                    {money(
                      item.unit_price_amount,
                    )}{" "}
                    each
                  </small>
                </span>

                <strong>
                  {money(item.total_amount)}
                </strong>
              </div>
            ))}
          </div>

          <div className={styles.totals}>
            {typeof bill.subtotal_amount ===
              "number" && (
              <div>
                <span>Subtotal</span>

                <b>
                  {money(
                    bill.subtotal_amount,
                  )}
                </b>
              </div>
            )}

            {typeof bill.discount_amount ===
              "number" &&
              bill.discount_amount > 0 && (
                <div>
                  <span>Discount</span>

                  <b>
                    -
                    {money(
                      bill.discount_amount,
                    )}
                  </b>
                </div>
              )}

            {typeof bill.vat_amount ===
              "number" && (
              <div>
                <span>VAT</span>

                <b>
                  {money(bill.vat_amount)}
                </b>
              </div>
            )}

            <div>
              <span>Total</span>

              <b>
                {money(bill.total_amount)}
              </b>
            </div>

            <div>
              <span>Already paid</span>

              <b>
                {money(bill.paid_amount)}
              </b>
            </div>

            <div className={styles.remaining}>
              <span>
                REMAINING BALANCE
              </span>

              <strong>
                {money(remaining)}
              </strong>
            </div>
          </div>

          <p className={styles.live}>
            ◷ Updated automatically
          </p>

          {remaining > 0 ? (
            <StickyButton
              onClick={() => go("choice")}
            >
              ▣ Pay {money(remaining)}
            </StickyButton>
          ) : (
            <div className={styles.paidTag}>
              ✓ Paid in full · Server
              verified
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
            text={`Pay the remaining ${money(
              remaining,
            )} yourself`}
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
            Nothing is final until the
            payment has been confirmed by
            the provider.
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
            selected={
              splitType === "EQUAL"
            }
            onClick={() =>
              setSplitType("EQUAL")
            }
          >
            {splitType === "EQUAL" && (
              <div
                className={
                  styles.stepper
                }
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <span>
                  Number of people
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPeople(
                      Math.max(
                        2,
                        people - 1,
                      ),
                    )
                  }
                >
                  −
                </button>

                <b>{people}</b>

                <button
                  type="button"
                  onClick={() =>
                    setPeople(
                      Math.min(
                        20,
                        people + 1,
                      ),
                    )
                  }
                >
                  +
                </button>

                <small>
                  You pay{" "}
                  {money(equalShare)} as
                  one share
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
            text="Type any valid amount from the remaining bill"
            icon="＋"
            onClick={() => {
              setSplitType("CUSTOM");
              go("amount");
            }}
          />

          {splitType === "EQUAL" && (
            <StickyButton
              onClick={() =>
                go("provider")
              }
            >
              Continue ·{" "}
              {money(equalShare)}
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
              TAP TO SELECT ·{" "}
              {bill.items.length} ITEMS
            </p>

            {bill.items.map((item) => (
              <button
                type="button"
                className={`${styles.selectItem} ${
                  selectedItems.includes(
                    item.id,
                  )
                    ? styles.checked
                    : ""
                }`}
                key={item.id}
                disabled={item.unavailable}
                onClick={() =>
                  toggleItem(item.id)
                }
              >
                <span
                  className={
                    styles.checkbox
                  }
                >
                  {item.unavailable
                    ? "–"
                    : selectedItems.includes(
                          item.id,
                        )
                      ? "✓"
                      : ""}
                </span>

                <span>
                  <b>{item.name}</b>

                  <small>
                    {item.unavailable
                      ? "Already paid or reserved"
                      : `Qty ${
                          item.quantity
                        } · ${money(
                          item.unit_price_amount,
                        )} each`}
                  </small>
                </span>

                <strong>
                  {money(
                    item.total_amount,
                  )}
                </strong>
              </button>
            ))}
          </div>

          <p className={styles.help}>
            Locked items cannot be selected
            again while another payment is
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
            <button
              type="button"
              className={
                styles.activeTab
              }
            >
              Type amount
            </button>

            <button
              type="button"
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

          <label
            className={styles.amountInput}
          >
            <span>TZS</span>

            <input
              value={customAmount}
              onChange={(event) =>
                setCustomAmount(
                  event.target.value.replace(
                    /\D/g,
                    "",
                  ),
                )
              }
              inputMode="numeric"
              placeholder="0"
              autoFocus
            />
          </label>

          <div
            className={
              styles.quickAmounts
            }
          >
            {[25, 50, 75].map(
              (percent) => (
                <button
                  type="button"
                  key={percent}
                  onClick={() =>
                    setCustomAmount(
                      String(
                        Math.floor(
                          (remaining *
                            percent) /
                            100,
                        ),
                      ),
                    )
                  }
                >
                  {percent}%
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() =>
                setCustomAmount(
                  String(remaining),
                )
              }
            >
              Remaining
            </button>
          </div>

          {error && (
            <p className={styles.error}>
              ⚠ {error}
            </p>
          )}

          <StickyButton
            disabled={
              !Number(customAmount) ||
              Number(customAmount) >
                remaining
            }
            onClick={() => go("provider")}
          >
            Pay{" "}
            {money(
              Number(customAmount || 0),
            )}
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
          eyebrow={`${splitType.replace(
            "_",
            " ",
          )} · ${money(amount)}`}
          title="Choose how to pay"
        >
          <p className={styles.cardLabel}>
            MOBILE MONEY
          </p>

          <div className={styles.providers}>
            {providers.map(
              (provider) => (
                <button
                  type="button"
                  key={provider.id}
                  className={
                    method === provider.id
                      ? styles.providerSelected
                      : ""
                  }
                  onClick={() =>
                    setMethod(provider.id)
                  }
                >
                  <span
                    className={
                      styles.providerIcon
                    }
                  >
                    {provider.initials}
                  </span>

                  <span>
                    <b>
                      {provider.name}
                    </b>

                    <small>
                      Push prompt to your
                      phone
                    </small>
                  </span>

                  <strong>›</strong>
                </button>
              ),
            )}
          </div>

          <StickyButton
            onClick={() => go("phone")}
          >
            Continue with{" "}
            {selectedProvider.name}
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
          <div
            className={styles.promptCard}
          >
            <span
              className={
                styles.providerIcon
              }
            >
              {selectedProvider.initials}
            </span>

            <div>
              <b>
                {selectedProvider.name}
              </b>

              <small>
                A secure approval prompt
                will be sent to this phone.
              </small>
            </div>
          </div>

          <label
            className={styles.phoneInput}
          >
            Mobile-money number

            <input
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
            />
          </label>

          <div
            className={styles.securityBox}
          >
            <b>
              🔒 Your PIN stays private
            </b>

            <span>
              Enter your wallet PIN only in
              the secure prompt displayed by
              your mobile network. Uzunguni
              never asks for or stores it.
            </span>
          </div>

          {error && (
            <p className={styles.error}>
              ⚠ {error}
            </p>
          )}

          <StickyButton
            disabled={
              submitting ||
              phone.replace(/\D/g, "")
                .length < 9
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
        <Screen
          eyebrow="PAYMENT PENDING"
          title="Check your phone"
        >
          <div
            className={styles.waitingIcon}
          >
            <span />
          </div>

          <h2
            className={styles.centerTitle}
          >
            Approve{" "}
            {money(requestedAmount)}
          </h2>

          <p
            className={styles.centerText}
          >
            A {selectedProvider.name} prompt
            was sent to{" "}
            <b>{maskedPhone}</b>. Enter your
            PIN in that provider prompt, not
            on this website.
          </p>

          <div
            className={styles.pendingBox}
          >
            <span
              className={styles.pulse}
            />

            <div>
              <b>
                Waiting for provider
                confirmation...
              </b>

              <small>
                The bill updates only after
                the provider confirms the
                payment.
              </small>
            </div>
          </div>

          <p className={styles.help}>
            Do not refresh or send another
            payment while this request is
            pending.
          </p>
        </Screen>
      )}

      {step === "success" && (
        <Screen
          eyebrow="SERVER VERIFIED"
          title="Payment received"
        >
          <div
            className={styles.successIcon}
          >
            ✓
          </div>

          <div className={styles.receipt}>
            <div>
              <span>Amount paid</span>

              <b>{money(paidAmount)}</b>
            </div>

            <div>
              <span>Method</span>

              <b>
                {selectedProvider.name}
              </b>
            </div>

            <div>
              <span>Reference</span>

              <b>
                {reference || "Verified"}
              </b>
            </div>

            <div>
              <span>
                Remaining on bill
              </span>

              <b>{money(remaining)}</b>
            </div>

            <em>
              ✓{" "}
              {remaining === 0
                ? "Paid in full"
                : "Partially paid"}
            </em>
          </div>

          <div
            className={
              styles.successActions
            }
          >
            <button
              type="button"
              onClick={() =>
                setShowReceipt(true)
              }
            >
              ▤ Receipt
            </button>

            <button
              type="button"
              onClick={finishPaymentFlow}
            >
              Done
            </button>
          </div>
        </Screen>
      )}

      {showReceipt && (
        <ReceiptModal
          bill={bill}
          amountPaid={paidAmount}
          method={
            selectedProvider.name
          }
          reference={reference}
          paidAt={paidAt}
          splitType={splitType}
          selectedItems={selectedItems}
          intentId={intentId}
          remaining={remaining}
          onClose={() =>
            setShowReceipt(false)
          }
        />
      )}
    </main>
  );
}

function Top({
  table,
}: {
  table: string;
}) {
  return (
    <header className={styles.top}>
      <b>UZUNGUNI</b>

      <span>● EN · Secure</span>

      <small>
        {table} · City Park
      </small>
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
  children: ReactNode;
}) {
  return (
    <section className={styles.screen}>
      {back && (
        <button
          type="button"
          className={styles.back}
          onClick={back}
          aria-label="Go back"
        >
          ‹
        </button>
      )}

      <p className={styles.eyebrow}>
        {eyebrow}
      </p>

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
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${
        selected
          ? styles.choiceSelected
          : ""
      }`}
      onClick={onClick}
    >
      <span
        className={styles.choiceIcon}
      >
        {icon}
      </span>

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
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.sticky}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </div>
  );
}

function Empty({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className={styles.center}>
      <div
        className={styles.successIcon}
      >
        ✓
      </div>

      <h1>{title}</h1>

      <p>{text}</p>
    </div>
  );
}

/*
 * ============================================================
 * REAL PAYMENT RECEIPT
 * ============================================================
 *
 * This is a real HTML receipt view.
 *
 * It is NOT a screenshot of the payment-success screen.
 *
 * The Print / Save PDF button prints only this receipt.
 */
function ReceiptModal({
  bill,
  amountPaid,
  method,
  reference,
  paidAt,
  splitType,
  selectedItems,
  intentId,
  remaining,
  onClose,
}: {
  bill: Bill;
  amountPaid: number;
  method: string;
  reference: string;
  paidAt: string;
  splitType: SplitType;
  selectedItems: string[];
  intentId: string | null;
  remaining: number;
  onClose: () => void;
}) {
  const [logoAvailable, setLogoAvailable] =
    useState(true);

  const paymentDate = paidAt
    ? new Date(paidAt)
    : new Date();

  const receiptNumber =
    reference ||
    (intentId
      ? `UZP-${intentId
          .replace(/-/g, "")
          .slice(0, 10)
          .toUpperCase()}`
      : `UZP-${paymentDate
          .getTime()
          .toString()
          .slice(-10)}`);

  const receiptItems =
    splitType === "ITEM"
      ? bill.items.filter((item) =>
          selectedItems.includes(item.id),
        )
      : bill.items;

  const allocationName =
    splitType === "FULL"
      ? "Full bill"
      : splitType === "EQUAL"
        ? "Equal split"
        : splitType === "ITEM"
          ? "Selected items"
          : "Custom amount";

  /*
   * IMPORTANT:
   *
   * We do NOT invent VAT in the browser.
   *
   * When the backend starts sending:
   *
   * subtotal_amount
   * discount_amount
   * vat_amount
   *
   * the receipt automatically displays them
   * for a full-bill payment.
   *
   * This prevents the client from fabricating
   * tax information.
   */
  const hasAuthoritativeTaxBreakdown =
    splitType === "FULL" &&
    typeof bill.subtotal_amount ===
      "number" &&
    typeof bill.vat_amount === "number";

  const branchDisplay =
    bill.branch_name ||
    bill.branch_city ||
    "Uzunguni City Park";

  return (
    <div
      className={styles.receiptOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt"
    >
      <div
        className={styles.receiptToolbar}
      >
        <button
          type="button"
          onClick={onClose}
        >
          ← Back
        </button>

        <button
          type="button"
          className={
            styles.receiptPrintButton
          }
          onClick={() =>
            window.print()
          }
        >
          Print / Save PDF
        </button>
      </div>

      <article
        className={styles.realReceipt}
      >
        <div
          className={styles.receiptBrand}
        >
          {logoAvailable ? (
            <img
              className={
                styles.receiptLogoImage
              }
              src={
                RECEIPT_BUSINESS.logoPath
              }
              alt="Uzunguni City Park"
              onError={() =>
                setLogoAvailable(false)
              }
            />
          ) : (
            <div
              className={
                styles.receiptWordmark
              }
            >
              <strong>UZUNGUNI</strong>

              <span>CITY PARK</span>
            </div>
          )}
        </div>

        <header
          className={styles.receiptHeader}
        >
          <h1>
            {RECEIPT_BUSINESS.name}
          </h1>

          <p>{branchDisplay}</p>

          <p>
            {RECEIPT_BUSINESS.address}
          </p>

          <p>
            Tel:{" "}
            {RECEIPT_BUSINESS.phone}
          </p>

          <p>
            {RECEIPT_BUSINESS.email}
          </p>

          <div
            className={
              styles.receiptTaxNumbers
            }
          >
            <span>
              {RECEIPT_BUSINESS.tin}
            </span>

            <span>
              {RECEIPT_BUSINESS.vrn}
            </span>
          </div>
        </header>

        <ReceiptDivider />

        <section
          className={styles.receiptTitle}
        >
          <h2>PAYMENT RECEIPT</h2>

          <strong>
            ✓ SERVER VERIFIED
          </strong>
        </section>

        <ReceiptDivider />

        <section
          className={styles.receiptMeta}
        >
          <ReceiptRow
            label="Receipt No."
            value={receiptNumber}
          />

          <ReceiptRow
            label="Date"
            value={paymentDate.toLocaleDateString(
              "en-TZ",
              {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              },
            )}
          />

          <ReceiptRow
            label="Time"
            value={paymentDate.toLocaleTimeString(
              "en-TZ",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              },
            )}
          />

          <ReceiptRow
            label="Table"
            value={
              bill.table_label ||
              `Table ${bill.table_number}`
            }
          />

          <ReceiptRow
            label="Payment type"
            value={allocationName}
          />
        </section>

        <ReceiptDivider />

        {(splitType === "FULL" ||
          splitType === "ITEM") &&
        receiptItems.length > 0 ? (
          <section
            className={
              styles.receiptItems
            }
          >
            <div
              className={
                styles.receiptItemsHeading
              }
            >
              <span>ITEM</span>

              <span>QTY</span>

              <span>AMOUNT</span>
            </div>

            {receiptItems.map((item) => (
              <div
                className={
                  styles.receiptItem
                }
                key={item.id}
              >
                <span>
                  <b>{item.name}</b>

                  <small>
                    {money(
                      item.unit_price_amount,
                    )}{" "}
                    each
                  </small>
                </span>

                <span>
                  {item.quantity}
                </span>

                <strong>
                  {money(
                    item.total_amount,
                  )}
                </strong>
              </div>
            ))}
          </section>
        ) : (
          <section
            className={
              styles.partialReceiptItem
            }
          >
            <span>
              <b>
                Table bill payment
              </b>

              <small>
                {allocationName}
              </small>
            </span>

            <strong>
              {money(amountPaid)}
            </strong>
          </section>
        )}

        <ReceiptDivider />

        <section
          className={
            styles.receiptTotals
          }
        >
          {hasAuthoritativeTaxBreakdown ? (
            <>
              <ReceiptRow
                label="Subtotal"
                value={money(
                  bill.subtotal_amount!,
                )}
              />

              {typeof bill.discount_amount ===
                "number" &&
                bill.discount_amount >
                  0 && (
                  <ReceiptRow
                    label="Discount"
                    value={`-${money(
                      bill.discount_amount,
                    )}`}
                  />
                )}

              <ReceiptRow
                label="VAT"
                value={money(
                  bill.vat_amount!,
                )}
              />

              <ReceiptRow
                label="Bill total"
                value={money(
                  bill.total_amount,
                )}
              />
            </>
          ) : (
            <div
              className={
                styles.receiptTaxNotice
              }
            >
              <b>VAT INFORMATION</b>

              <span>
                Tax values are not calculated
                inside this receipt screen.
                The final VAT breakdown must
                come from the authoritative
                billing / fiscal service.
              </span>
            </div>
          )}

          <div
            className={
              styles.receiptGrandTotal
            }
          >
            <span>AMOUNT PAID</span>

            <strong>
              {money(amountPaid)}
            </strong>
          </div>
        </section>

        <ReceiptDivider />

        <section
          className={
            styles.receiptPayment
          }
        >
          <ReceiptRow
            label="Payment method"
            value={method}
          />

          <ReceiptRow
            label="Transaction ref."
            value={
              reference ||
              receiptNumber
            }
          />

          <ReceiptRow
            label="Status"
            value="PAID / VERIFIED"
          />

          <ReceiptRow
            label="Remaining bill"
            value={money(remaining)}
          />
        </section>

        <ReceiptDivider />

        <section
          className={styles.fiscalArea}
        >
          <h3>FISCAL INFORMATION</h3>

          <ReceiptRow
            label="EFD/VFD Receipt No."
            value="Pending integration"
          />

          <ReceiptRow
            label="Verification Code"
            value="—"
          />

          <ReceiptRow
            label="Fiscal status"
            value="Not yet issued"
          />
        </section>

        <div
          className={
            styles.nonFiscalWarning
          }
        >
          <b>
            PAYMENT RECEIPT
          </b>

          <span>
            This document confirms the
            server-verified payment recorded
            by the Uzunguni payment system.
            It is not yet a TRA fiscal receipt
            until the approved EFD/VFD
            integration supplies the official
            fiscal receipt details.
          </span>
        </div>

        <ReceiptDivider />

        <footer
          className={styles.receiptFooter}
        >
          <strong>
            THANK YOU FOR VISITING
          </strong>

          <p>
            Uzunguni City Park
          </p>

          <small>
            Scan. Check. Split. Pay.
          </small>

          <small>
            Please retain this receipt for
            payment reference.
          </small>
        </footer>
      </article>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={styles.receiptRow}
    >
      <span>{label}</span>

      <b>{value}</b>
    </div>
  );
}

function ReceiptDivider() {
  return (
    <div
      className={styles.receiptDivider}
    />
  );
}