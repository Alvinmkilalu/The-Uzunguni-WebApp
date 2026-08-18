import Link from "next/link";
import StaffShell from "@/components/StaffShell";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "./SalesHistory.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIME_ZONE = "Africa/Dar_es_Salaam";

const DATABASE_PAGE_SIZE = 1000;
const LOG_PAGE_SIZE = 100;

type SalesPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

type PaymentRow = {
  id: string;
  table_session_id: string | null;
  amount: number;
  payment_method: string | null;
  status: string;
  provider_reference: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  table_id: string;
  opened_at: string;
};

type DiningTableRow = {
  id: string;
  table_number: number;
  label: string | null;
};

type DailySale = {
  date: string;
  amount: number;
  transactions: number;
};

type MethodSummary = {
  method: string;
  amount: number;
  transactions: number;
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const displayDateFormatter = new Intl.DateTimeFormat("en-TZ", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-TZ", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const moneyFormatter = new Intl.NumberFormat("en-TZ", {
  maximumFractionDigits: 0,
});

const METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  AIRTEL_MONEY: "Airtel Money",
  MIXX: "Mixx by Yas",
  HALOPESA: "HaloPesa",
  SELCOM_PESA: "Selcom Pesa",
  AZAMPESA: "AzamPesa",
  CARD: "Card",
  CASH: "Cash",
  CASHIER_TERMINAL: "Cashier terminal",
};

function firstParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function isDateKey(value?: string) {
  if (!value) {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return !Number.isNaN(date.getTime());
}

function dateKeyFromDate(date: Date) {
  const parts = dateKeyFormatter.formatToParts(date);

  const year =
    parts.find((part) => part.type === "year")?.value || "";

  const month =
    parts.find((part) => part.type === "month")?.value || "";

  const day =
    parts.find((part) => part.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function shiftDateKey(
  dateKey: string,
  amount: number,
) {
  const date = new Date(`${dateKey}T12:00:00Z`);

  date.setUTCDate(date.getUTCDate() + amount);

  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function weekStartFor(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);

  const weekDay = date.getUTCDay();

  const daysFromMonday =
    weekDay === 0 ? 6 : weekDay - 1;

  return shiftDateKey(
    dateKey,
    -daysFromMonday,
  );
}

function eachDateKey(
  from: string,
  to: string,
) {
  const values: string[] = [];

  let cursor = from;
  let guard = 0;

  while (
    cursor <= to &&
    guard < 4000
  ) {
    values.push(cursor);

    cursor = shiftDateKey(cursor, 1);

    guard += 1;
  }

  return values;
}

function formatMoney(value: number) {
  return `TZS ${moneyFormatter.format(
    Math.round(value),
  )}`;
}

function formatMethod(method: string | null) {
  if (!method) {
    return "Unknown";
  }

  return (
    METHOD_LABELS[method] ||
    method
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      )
  );
}

function formatDateTime(timestamp: string) {
  return dateTimeFormatter.format(
    new Date(timestamp),
  );
}

function formatDisplayDate(dateKey: string) {
  return displayDateFormatter.format(
    new Date(`${dateKey}T12:00:00+03:00`),
  );
}

function rangeHref(
  from: string,
  to: string,
  page = 1,
) {
  const query = new URLSearchParams();

  query.set("from", from);
  query.set("to", to);

  if (page > 1) {
    query.set("page", String(page));
  }

  return `/admin/sales?${query.toString()}`;
}

async function fetchAllPaidPayments(
  admin: ReturnType<typeof createAdminClient>,
): Promise<PaymentRow[]> {
  const payments: PaymentRow[] = [];

  let from = 0;

  while (true) {
    const to =
      from +
      DATABASE_PAGE_SIZE -
      1;

    const { data, error } = await admin
      .from("payments")
      .select(
        "id,table_session_id,amount,payment_method,status,provider_reference,created_at",
      )
      .eq("status", "PAID")
      .order("created_at", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      throw new Error(
        `Unable to load sales history: ${error.message}`,
      );
    }

    const rows: PaymentRow[] = (data || []).map(
      (row) => ({
        id: row.id,
        table_session_id:
          row.table_session_id ?? null,
        amount: Number(row.amount || 0),
        payment_method:
          row.payment_method ?? null,
        status: row.status,
        provider_reference:
          row.provider_reference ?? null,
        created_at: row.created_at,
      }),
    );

    payments.push(...rows);

    if (
      rows.length <
      DATABASE_PAGE_SIZE
    ) {
      break;
    }

    from += DATABASE_PAGE_SIZE;
  }

  return payments;
}

async function fetchSessions(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<SessionRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const sessions: SessionRow[] = [];

  const chunkSize = 200;

  for (
    let index = 0;
    index < ids.length;
    index += chunkSize
  ) {
    const chunk = ids.slice(
      index,
      index + chunkSize,
    );

    const { data, error } = await admin
      .from("table_sessions")
      .select("id,table_id,opened_at")
      .in("id", chunk);

    if (error) {
      throw new Error(
        `Unable to load table sessions: ${error.message}`,
      );
    }

    const rows: SessionRow[] = (data || []).map(
      (row) => ({
        id: row.id,
        table_id: row.table_id,
        opened_at: row.opened_at,
      }),
    );

    sessions.push(...rows);
  }

  return sessions;
}

async function fetchDiningTables(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<DiningTableRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const tables: DiningTableRow[] = [];

  const chunkSize = 200;

  for (
    let index = 0;
    index < ids.length;
    index += chunkSize
  ) {
    const chunk = ids.slice(
      index,
      index + chunkSize,
    );

    const { data, error } = await admin
      .from("dining_tables")
      .select("id,table_number,label")
      .in("id", chunk);

    if (error) {
      throw new Error(
        `Unable to load dining tables: ${error.message}`,
      );
    }

    const rows: DiningTableRow[] = (data || []).map(
      (row) => ({
        id: row.id,
        table_number: Number(
          row.table_number,
        ),
        label: row.label ?? null,
      }),
    );

    tables.push(...rows);
  }

  return tables;
}

export default async function SalesHistoryPage({
  searchParams,
}: SalesPageProps) {
  const params = await searchParams;

  const { profile } = await requireStaff("ADMIN");

  const admin = createAdminClient();

  const today = dateKeyFromDate(new Date());

  const defaultWeekStart =
    weekStartFor(today);

  const monthStart =
    `${today.slice(0, 7)}-01`;

  const requestedFrom =
    firstParam(params.from);

  const requestedTo =
    firstParam(params.to);

  let from = isDateKey(requestedFrom)
    ? requestedFrom!
    : defaultWeekStart;

  let to = isDateKey(requestedTo)
    ? requestedTo!
    : today;

  if (from > to) {
    const previousFrom = from;

    from = to;
    to = previousFrom;
  }

  const allPaidPayments =
    await fetchAllPaidPayments(admin);

  const rangePayments =
    allPaidPayments.filter(
      (payment) => {
        const key = dateKeyFromDate(
          new Date(payment.created_at),
        );

        return key >= from && key <= to;
      },
    );

  const allTimeRevenue =
    allPaidPayments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0,
    );

  const selectedRevenue =
    rangePayments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0,
    );

  const transactionCount =
    rangePayments.length;

  const averagePayment =
    transactionCount > 0
      ? selectedRevenue /
        transactionCount
      : 0;

  const sessionIds = [
    ...new Set(
      rangePayments
        .map(
          (payment) =>
            payment.table_session_id,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    ),
  ];

  const sessions =
    await fetchSessions(
      admin,
      sessionIds,
    );

  const tableIds = [
    ...new Set(
      sessions.map(
        (session) =>
          session.table_id,
      ),
    ),
  ];

  const diningTables =
    await fetchDiningTables(
      admin,
      tableIds,
    );

  const sessionsById = new Map(
    sessions.map((session) => [
      session.id,
      session,
    ]),
  );

  const tablesById = new Map(
    diningTables.map((table) => [
      table.id,
      table,
    ]),
  );

  const uniqueTableCount =
    new Set(
      sessions.map(
        (session) =>
          session.table_id,
      ),
    ).size;

  const dayMap = new Map<
    string,
    {
      amount: number;
      transactions: number;
    }
  >();

  for (const payment of rangePayments) {
    const date = dateKeyFromDate(
      new Date(payment.created_at),
    );

    const current =
      dayMap.get(date) || {
        amount: 0,
        transactions: 0,
      };

    current.amount += Number(
      payment.amount || 0,
    );

    current.transactions += 1;

    dayMap.set(date, current);
  }

  const dailySales: DailySale[] =
    eachDateKey(from, to).map(
      (date) => ({
        date,
        amount:
          dayMap.get(date)?.amount ||
          0,
        transactions:
          dayMap.get(date)
            ?.transactions || 0,
      }),
    );

  const bestDay =
    dailySales.reduce<
      DailySale | null
    >(
      (best, day) => {
        if (
          !best ||
          day.amount >
            best.amount
        ) {
          return day;
        }

        return best;
      },
      null,
    );

  const methodMap = new Map<
    string,
    {
      amount: number;
      transactions: number;
    }
  >();

  for (const payment of rangePayments) {
    const method =
      payment.payment_method ||
      "UNKNOWN";

    const current =
      methodMap.get(method) || {
        amount: 0,
        transactions: 0,
      };

    current.amount += Number(
      payment.amount || 0,
    );

    current.transactions += 1;

    methodMap.set(method, current);
  }

  const methodSummary: MethodSummary[] =
    [...methodMap.entries()]
      .map(
        ([
          method,
          summary,
        ]) => ({
          method,
          amount:
            summary.amount,
          transactions:
            summary.transactions,
        }),
      )
      .sort(
        (a, b) =>
          b.amount - a.amount,
      );

  const maxDailyAmount =
    Math.max(
      0,
      ...dailySales.map(
        (day) =>
          day.amount,
      ),
    );

  const chartDays =
    dailySales.length > 31
      ? dailySales.slice(-31)
      : dailySales;

  const earliestDate =
    allPaidPayments.length > 0
      ? dateKeyFromDate(
          new Date(
            allPaidPayments[
              allPaidPayments.length -
                1
            ].created_at,
          ),
        )
      : today;

  const pageParam = Number(
    firstParam(params.page) || "1",
  );

  const totalPages = Math.max(
    1,
    Math.ceil(
      transactionCount /
        LOG_PAGE_SIZE,
    ),
  );

  const currentPage =
    Number.isInteger(pageParam) &&
    pageParam > 0
      ? Math.min(
          pageParam,
          totalPages,
        )
      : 1;

  const logStart =
    (currentPage - 1) *
    LOG_PAGE_SIZE;

  const logRows =
    rangePayments.slice(
      logStart,
      logStart +
        LOG_PAGE_SIZE,
    );

  const isToday =
    from === today &&
    to === today;

  const isWeek =
    from ===
      defaultWeekStart &&
    to === today;

  const isMonth =
    from === monthStart &&
    to === today;

  const isAllHistory =
    from ===
      earliestDate &&
    to === today;

  return (
    <StaffShell
      role="ADMIN"
      name={profile.full_name}
    >
      <header className="ops-header">
        <div>
          <p className="eyebrow">
            ADMINISTRATION ·
            FINANCIAL REPORTING
          </p>

          <h1>Sales history</h1>

          <p>
            Review verified
            revenue, payment
            activity and
            historical sales.
          </p>
        </div>

        <div
          className={
            styles.verifiedBadge
          }
        >
          ✓ Server verified
          payments
        </div>
      </header>

      <section
        className={
          styles.filterPanel
        }
      >
        <div
          className={
            styles.filterHeading
          }
        >
          <div>
            <p
              className={
                styles.overline
              }
            >
              SALES PERIOD
            </p>

            <h2>
              {formatDisplayDate(
                from,
              )}

              {from !== to
                ? ` — ${formatDisplayDate(
                    to,
                  )}`
                : ""}
            </h2>

            <p>
              The default view
              shows the current
              week from Monday
              through today.
            </p>
          </div>
        </div>

        <div
          className={
            styles.quickLinks
          }
        >
          <Link
            href={rangeHref(
              today,
              today,
            )}
            className={`${styles.quickLink} ${
              isToday
                ? styles.quickLinkActive
                : ""
            }`}
          >
            Today
          </Link>

          <Link
            href={rangeHref(
              defaultWeekStart,
              today,
            )}
            className={`${styles.quickLink} ${
              isWeek
                ? styles.quickLinkActive
                : ""
            }`}
          >
            This week
          </Link>

          <Link
            href={rangeHref(
              monthStart,
              today,
            )}
            className={`${styles.quickLink} ${
              isMonth
                ? styles.quickLinkActive
                : ""
            }`}
          >
            This month
          </Link>

          <Link
            href={rangeHref(
              earliestDate,
              today,
            )}
            className={`${styles.quickLink} ${
              isAllHistory
                ? styles.quickLinkActive
                : ""
            }`}
          >
            All history
          </Link>
        </div>

        <form
          method="get"
          action="/admin/sales"
          className={
            styles.dateForm
          }
        >
          <label>
            <span>From</span>

            <input
              type="date"
              name="from"
              defaultValue={from}
              max={today}
            />
          </label>

          <label>
            <span>To</span>

            <input
              type="date"
              name="to"
              defaultValue={to}
              max={today}
            />
          </label>

          <button type="submit">
            Load sales
          </button>
        </form>
      </section>

      <section
        className={
          styles.metricsGrid
        }
      >
        <article
          className={
            styles.metricCard
          }
        >
          <span>
            Selected revenue
          </span>

          <strong>
            {formatMoney(
              selectedRevenue,
            )}
          </strong>

          <small>
            Verified payments in
            selected period
          </small>
        </article>

        <article
          className={
            styles.metricCard
          }
        >
          <span>
            Transactions
          </span>

          <strong>
            {moneyFormatter.format(
              transactionCount,
            )}
          </strong>

          <small>
            Successful payments
          </small>
        </article>

        <article
          className={
            styles.metricCard
          }
        >
          <span>
            Average payment
          </span>

          <strong>
            {formatMoney(
              averagePayment,
            )}
          </strong>

          <small>
            Per successful
            transaction
          </small>
        </article>

        <article
          className={`${styles.metricCard} ${styles.allTimeMetric}`}
        >
          <span>
            All-time revenue
          </span>

          <strong>
            {formatMoney(
              allTimeRevenue,
            )}
          </strong>

          <small>
            Since first recorded
            verified sale
          </small>
        </article>
      </section>

      <section
        className={
          styles.insightGrid
        }
      >
        <article
          className={
            styles.insightCard
          }
        >
          <span>
            Best sales day
          </span>

          <b>
            {bestDay &&
            bestDay.amount > 0
              ? formatDisplayDate(
                  bestDay.date,
                )
              : "No sales"}
          </b>

          <small>
            {bestDay &&
            bestDay.amount > 0
              ? `${formatMoney(
                  bestDay.amount,
                )} · ${
                  bestDay.transactions
                } transaction${
                  bestDay.transactions ===
                  1
                    ? ""
                    : "s"
                }`
              : "No verified payments in this period"}
          </small>
        </article>

        <article
          className={
            styles.insightCard
          }
        >
          <span>
            Tables with sales
          </span>

          <b>
            {uniqueTableCount}
          </b>

          <small>
            Unique tables with a
            verified payment
          </small>
        </article>

        <article
          className={
            styles.insightCard
          }
        >
          <span>
            Reporting basis
          </span>

          <b>PAID only</b>

          <small>
            Pending and failed
            attempts never count
            as revenue
          </small>
        </article>
      </section>

      <section
        className={
          styles.analyticsGrid
        }
      >
        <article
          className={
            styles.analyticsCard
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <p
                className={
                  styles.overline
                }
              >
                DAILY TREND
              </p>

              <h2>
                Revenue by day
              </h2>
            </div>

            {dailySales.length >
              31 && (
              <small>
                Showing latest 31
                days of selected
                period
              </small>
            )}
          </div>

          {selectedRevenue ===
          0 ? (
            <div
              className={
                styles.emptyState
              }
            >
              No verified sales
              were recorded in
              this period.
            </div>
          ) : (
            <div
              className={
                styles.dailyChart
              }
            >
              {chartDays.map(
                (day) => {
                  const width =
                    maxDailyAmount >
                      0 &&
                    day.amount > 0
                      ? Math.max(
                          2,
                          (day.amount /
                            maxDailyAmount) *
                            100,
                        )
                      : 0;

                  return (
                    <div
                      key={day.date}
                      className={
                        styles.dayRow
                      }
                    >
                      <div
                        className={
                          styles.dayLabel
                        }
                      >
                        <span>
                          {formatDisplayDate(
                            day.date,
                          )}
                        </span>

                        <small>
                          {
                            day.transactions
                          }{" "}
                          payment
                          {day.transactions ===
                          1
                            ? ""
                            : "s"}
                        </small>
                      </div>

                      <div
                        className={
                          styles.barTrack
                        }
                      >
                        <div
                          className={
                            styles.barFill
                          }
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>

                      <b>
                        {formatMoney(
                          day.amount,
                        )}
                      </b>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </article>

        <article
          className={
            styles.analyticsCard
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <p
                className={
                  styles.overline
                }
              >
                PAYMENT MIX
              </p>

              <h2>
                Payment methods
              </h2>
            </div>
          </div>

          {methodSummary.length ===
          0 ? (
            <div
              className={
                styles.emptyState
              }
            >
              No payment methods
              to analyse in this
              period.
            </div>
          ) : (
            <div
              className={
                styles.methodList
              }
            >
              {methodSummary.map(
                (method) => {
                  const share =
                    selectedRevenue >
                    0
                      ? (method.amount /
                          selectedRevenue) *
                        100
                      : 0;

                  return (
                    <div
                      key={
                        method.method
                      }
                      className={
                        styles.methodRow
                      }
                    >
                      <div
                        className={
                          styles.methodTop
                        }
                      >
                        <div>
                          <b>
                            {formatMethod(
                              method.method,
                            )}
                          </b>

                          <small>
                            {
                              method.transactions
                            }{" "}
                            transaction
                            {method.transactions ===
                            1
                              ? ""
                              : "s"}
                          </small>
                        </div>

                        <div
                          className={
                            styles.methodAmount
                          }
                        >
                          <b>
                            {formatMoney(
                              method.amount,
                            )}
                          </b>

                          <small>
                            {share.toFixed(
                              1,
                            )}
                            %
                          </small>
                        </div>
                      </div>

                      <div
                        className={
                          styles.shareTrack
                        }
                      >
                        <div
                          className={
                            styles.shareFill
                          }
                          style={{
                            width: `${share}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </article>
      </section>

      <section
        className={
          styles.transactionsCard
        }
      >
        <div
          className={
            styles.cardHeader
          }
        >
          <div>
            <p
              className={
                styles.overline
              }
            >
              TRANSACTION LOG
            </p>

            <h2>
              Verified sales
            </h2>

            <p>
              Every row below is
              a successful
              server-verified
              payment already
              recorded in the
              system.
            </p>
          </div>

          <div
            className={
              styles.resultCount
            }
          >
            {transactionCount ===
            0
              ? "0 records"
              : `${moneyFormatter.format(
                  logStart + 1,
                )}–${moneyFormatter.format(
                  Math.min(
                    logStart +
                      LOG_PAGE_SIZE,
                    transactionCount,
                  ),
                )} of ${moneyFormatter.format(
                  transactionCount,
                )}`}
          </div>
        </div>

        {logRows.length === 0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            There are no
            successful payments
            for the selected
            dates.
          </div>
        ) : (
          <div
            className={
              styles.tableScroll
            }
          >
            <table
              className={
                styles.salesTable
              }
            >
              <thead>
                <tr>
                  <th>
                    Date &amp;
                    time
                  </th>

                  <th>Table</th>

                  <th>
                    Payment method
                  </th>

                  <th>
                    Reference
                  </th>

                  <th>Status</th>

                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {logRows.map(
                  (payment) => {
                    const session =
                      payment.table_session_id
                        ? sessionsById.get(
                            payment.table_session_id,
                          )
                        : undefined;

                    const table =
                      session
                        ? tablesById.get(
                            session.table_id,
                          )
                        : undefined;

                    const tableLabel =
                      table?.label ||
                      (table?.table_number
                        ? `Table ${table.table_number}`
                        : "Unknown table");

                    return (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td>
                          <b>
                            {formatDateTime(
                              payment.created_at,
                            )}
                          </b>

                          <small>
                            Africa/Dar_es_Salaam
                          </small>
                        </td>

                        <td>
                          {session ? (
                            <Link
                              className={
                                styles.tableLink
                              }
                              href={`/waiter/table/${session.id}`}
                            >
                              {
                                tableLabel
                              }
                            </Link>
                          ) : (
                            tableLabel
                          )}
                        </td>

                        <td>
                          {formatMethod(
                            payment.payment_method,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              styles.reference
                            }
                            title={
                              payment.provider_reference ||
                              ""
                            }
                          >
                            {payment.provider_reference ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              styles.paidChip
                            }
                          >
                            ✓ Paid
                          </span>
                        </td>

                        <td
                          className={
                            styles.amountCell
                          }
                        >
                          {formatMoney(
                            Number(
                              payment.amount ||
                                0,
                            ),
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            className={
              styles.pagination
            }
          >
            <div>
              Page{" "}
              <b>
                {currentPage}
              </b>{" "}
              of{" "}
              <b>
                {totalPages}
              </b>
            </div>

            <div
              className={
                styles.paginationButtons
              }
            >
              {currentPage > 1 && (
                <Link
                  href={rangeHref(
                    from,
                    to,
                    currentPage -
                      1,
                  )}
                >
                  ← Previous
                </Link>
              )}

              {currentPage <
                totalPages && (
                <Link
                  href={rangeHref(
                    from,
                    to,
                    currentPage +
                      1,
                  )}
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <section
        className={
          styles.reportingNote
        }
      >
        <b>Revenue rule:</b>{" "}
        only payments whose
        database status is{" "}
        <code>PAID</code> are
        included in the totals.
        Pending, expired and
        failed payment attempts
        do not count as sales.
      </section>
    </StaffShell>
  );
}