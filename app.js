/*
  app.js
  --------------------------------------------------------
  Wires the UI (index.html) to the database (db.js).

  Responsibilities:
  1. Populate category options based on transaction type
  2. Handle the type toggle (expense / income)
  3. Handle form submission -> save to IndexedDB
  4. Handle the time-range filter (today/week/month/all/custom)
  5. Render the filtered transaction list + period totals
  6. Show all-time savings (income - expenses, regardless of filter)
  7. Handle deleting a transaction
--------------------------------------------------------- */

// --- State -------------------------------------------------------------

let currentType = "expense";   // "expense" | "income" — for the Add form
let currentFilter = "today";   // "today" | "week" | "month" | "all" | "custom"
let allTransactions = [];      // cached copy of everything in IndexedDB
let categories = { expense: [], income: [] }; // loaded from IndexedDB (includes custom ones)

// --- DOM references -----------------------------------------------------

const form = document.getElementById("transaction-form");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");
const typeButtons = document.querySelectorAll(".type-btn");

const newCategoryRow = document.getElementById("new-category-row");
const newCategoryInput = document.getElementById("new-category-input");
const addCategoryBtn = document.getElementById("add-category-btn");

const filterButtons = document.querySelectorAll(".filter-btn");
const customRange = document.getElementById("custom-range");
const rangeFrom = document.getElementById("range-from");
const rangeTo = document.getElementById("range-to");

const transactionList = document.getElementById("transaction-list");
const emptyState = document.getElementById("empty-state");
const listHeading = document.getElementById("list-heading");

const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");
const totalBalanceEl = document.getElementById("total-balance");
const summaryPeriodEl = document.getElementById("summary-period");
const summaryDateEl = document.getElementById("summary-date");
const savingsAmountEl = document.getElementById("savings-amount");

// --- Helpers -------------------------------------------------------------

function formatCurrency(amount) {
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converts a Date object to a local "YYYY-MM-DD" string (no timezone shift). */
function formatISO(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

function todayISO() {
  return formatISO(new Date());
}

/** "2026-06-13" -> "13 Jun" */
function formatDateLabel(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Date range logic ------------------------------------------------------

/**
 * Returns { from, to, label } for the currently selected filter.
 * from/to are ISO date strings (inclusive). from === null means "all time".
 */
function getDateRange(filter) {
  const today = new Date();
  const iso = todayISO();

  if (filter === "today") {
    return { from: iso, to: iso, label: "Today" };
  }

  if (filter === "week") {
    const day = today.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return { from: formatISO(monday), to: iso, label: "This week" };
  }

  if (filter === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatISO(first), to: iso, label: "This month" };
  }

  if (filter === "custom") {
    const from = rangeFrom.value || iso;
    const to = rangeTo.value || iso;
    return { from, to, label: "Custom range" };
  }

  // "all"
  return { from: null, to: null, label: "All time" };
}

function filterByRange(transactions, range) {
  if (!range.from) return transactions;
  return transactions.filter((t) => t.date >= range.from && t.date <= range.to);
}

/** Human-readable text for the date shown next to "Summary". */
function rangeText(range) {
  if (range.label === "All time") return "All time";
  if (range.from === range.to) return formatDateLabel(range.from);
  return `${formatDateLabel(range.from)} – ${formatDateLabel(range.to)}`;
}

// --- Category / type toggle ------------------------------------------------

async function loadCategories() {
  categories.expense = await getCategories("expense");
  categories.income = await getCategories("income");
}

function populateCategories(type) {
  categorySelect.innerHTML = "";

  categories[type].forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });

  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "+ Add new category…";
  categorySelect.appendChild(newOption);
}

function setType(type) {
  currentType = type;
  typeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  populateCategories(type);
  newCategoryRow.classList.add("hidden");
}

// --- Rendering ---------------------------------------------------------------

function render() {
  const range = getDateRange(currentFilter);
  const filtered = filterByRange(allTransactions, range);

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  transactionList.innerHTML = "";
  emptyState.classList.toggle("hidden", sorted.length > 0);
  emptyState.textContent =
    allTransactions.length === 0
      ? "No transactions yet — add your first one above."
      : "No transactions in this period.";

  sorted.forEach((t) => {
    const li = document.createElement("li");
    li.className = "transaction-item";

    const sign = t.type === "income" ? "+" : "-";
    const amountClass = t.type === "income" ? "transaction-item__amount--income" : "transaction-item__amount--expense";

    li.innerHTML = `
      <div class="transaction-item__info">
        <span class="transaction-item__category">${t.category}</span>
        <span class="transaction-item__meta">${t.date} · ${t.paymentMethod}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
      </div>
      <div class="transaction-item__right">
        <span class="transaction-item__amount ${amountClass}">${sign}${formatCurrency(t.amount)}</span>
        <button class="transaction-item__delete" aria-label="Delete transaction" data-id="${t.id}">&times;</button>
      </div>
    `;

    transactionList.appendChild(li);
  });

  // Period totals (for the filtered set)
  let periodIncome = 0;
  let periodExpense = 0;
  filtered.forEach((t) => {
    if (t.type === "income") periodIncome += t.amount;
    else periodExpense += t.amount;
  });

  totalIncomeEl.textContent = formatCurrency(periodIncome);
  totalExpenseEl.textContent = formatCurrency(periodExpense);
  totalBalanceEl.textContent = formatCurrency(periodIncome - periodExpense);

  summaryPeriodEl.textContent = range.label;
  summaryDateEl.textContent = rangeText(range);
  listHeading.textContent = `Transactions — ${range.label}`;

  // All-time savings (independent of the filter)
  let allIncome = 0;
  let allExpense = 0;
  allTransactions.forEach((t) => {
    if (t.type === "income") allIncome += t.amount;
    else allExpense += t.amount;
  });
  savingsAmountEl.textContent = formatCurrency(allIncome - allExpense);

  updateCategoryChart(filtered);
  updateTrendChart(filtered, range);
}

async function refresh() {
  allTransactions = await getAllTransactions();
  render();
}

// --- Event listeners -------------------------------------------------------

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setType(btn.dataset.type));
});

categorySelect.addEventListener("change", () => {
  if (categorySelect.value === "__new__") {
    newCategoryRow.classList.remove("hidden");
    newCategoryInput.value = "";
    newCategoryInput.focus();
  } else {
    newCategoryRow.classList.add("hidden");
  }
});

addCategoryBtn.addEventListener("click", async () => {
  const name = newCategoryInput.value.trim();
  if (!name) {
    newCategoryInput.focus();
    return;
  }

  const exists = categories[currentType].some((c) => c.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert("That category already exists.");
    return;
  }

  await addCategory(currentType, name);
  categories[currentType].push(name);
  populateCategories(currentType);
  categorySelect.value = name;
  newCategoryRow.classList.add("hidden");
});

newCategoryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCategoryBtn.click();
  }
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;

    filterButtons.forEach((b) => b.classList.toggle("active", b === btn));
    customRange.classList.toggle("hidden", currentFilter !== "custom");

    if (currentFilter === "custom" && !rangeFrom.value) {
      rangeFrom.value = todayISO();
      rangeTo.value = todayISO();
    }

    render();
  });
});

rangeFrom.addEventListener("change", () => {
  if (currentFilter === "custom") render();
});

rangeTo.addEventListener("change", () => {
  if (currentFilter === "custom") render();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const category = formData.get("category");

  if (category === "__new__") {
    newCategoryRow.classList.remove("hidden");
    newCategoryInput.focus();
    return;
  }

  const transaction = {
    type: currentType,
    amount: parseFloat(formData.get("amount")),
    category,
    note: formData.get("note").trim(),
    paymentMethod: formData.get("paymentMethod"),
    date: formData.get("date"),
    createdAt: Date.now(),
  };

  await addTransaction(transaction);
  form.reset();
  dateInput.value = todayISO();
  setType(currentType); // re-populate categories after reset
  await refresh();
});

transactionList.addEventListener("click", async (event) => {
  const button = event.target.closest(".transaction-item__delete");
  if (!button) return;

  const id = Number(button.dataset.id);
  await deleteTransaction(id);
  await refresh();
});

// --- Charts --------------------------------------------------------------

const categoryChartCanvas = document.getElementById("category-chart");
const categoryEmpty = document.getElementById("category-empty");
const trendChartCanvas = document.getElementById("trend-chart");
const trendHeading = document.getElementById("trend-heading");

const CATEGORY_COLORS = ["#b3432c", "#d9a441", "#3f7d4f", "#4a7fb5", "#8e6cae", "#c46b9b", "#6b9080", "#a0785a", "#8a8a8a"];
const INK_COLOR = "#232323";

let categoryChart = null;
let trendChart = null;

/** Total expenses per category, e.g. { Grocery: 450, Travel: 120 } */
function categoryBreakdown(transactions) {
  const map = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
  return map;
}

/** "2026-06" -> "Jun 2026" */
function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/**
 * Groups transactions by day (or by month for "All time") and returns
 * { labels: [...], income: [...], expense: [...] } ready for a bar chart.
 */
function getTrendData(transactions, range) {
  const groupByMonth = range.label === "All time";
  const map = {};

  transactions.forEach((t) => {
    const key = groupByMonth ? t.date.slice(0, 7) : t.date;
    if (!map[key]) map[key] = { income: 0, expense: 0 };
    map[key][t.type] += t.amount;
  });

  const keys = Object.keys(map).sort();
  const labels = keys.map(groupByMonth ? formatMonthLabel : formatDateLabel);
  const income = keys.map((k) => map[k].income);
  const expense = keys.map((k) => map[k].expense);

  return { labels, income, expense, groupByMonth };
}

function updateCategoryChart(filtered) {
  const breakdown = categoryBreakdown(filtered);
  const labels = Object.keys(breakdown);
  const data = Object.values(breakdown);
  const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

  categoryEmpty.classList.toggle("hidden", labels.length > 0);
  categoryChartCanvas.classList.toggle("hidden", labels.length === 0);

  if (!categoryChart) {
    categoryChart = new Chart(categoryChartCanvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: INK_COLOR, font: { size: 12 } } } },
      },
    });
  } else {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.data.datasets[0].backgroundColor = colors;
    categoryChart.update();
  }
}

function updateTrendChart(filtered, range) {
  const { labels, income, expense, groupByMonth } = getTrendData(filtered, range);
  trendHeading.textContent = groupByMonth ? "Spending over time (by month)" : "Spending over time (by day)";

  if (!trendChart) {
    trendChart = new Chart(trendChartCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Income", data: income, backgroundColor: "#3f7d4f" },
          { label: "Expenses", data: expense, backgroundColor: "#b3432c" },
        ],
      },
      options: {
        scales: {
          x: { ticks: { color: INK_COLOR } },
          y: { ticks: { color: INK_COLOR }, beginAtZero: true },
        },
        plugins: { legend: { position: "bottom", labels: { color: INK_COLOR, font: { size: 12 } } } },
      },
    });
  } else {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = income;
    trendChart.data.datasets[1].data = expense;
    trendChart.update();
  }
}

// --- Backup / restore ------------------------------------------------------

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

exportBtn.addEventListener("click", () => {
  const backup = {
    transactions: allTransactions,
    categories: categories,
  };
  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `pocket-ledger-backup-${todayISO()}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (err) {
    alert("That file doesn't look like a valid backup (invalid JSON).");
    importFile.value = "";
    return;
  }

  // Support both the current backup format ({ transactions, categories })
  // and the older format (a plain array of transactions).
  let transactions;
  let importedCategories = null;

  if (Array.isArray(data)) {
    transactions = data;
  } else if (data && Array.isArray(data.transactions)) {
    transactions = data.transactions;
    importedCategories = data.categories || null;
  } else {
    alert("That file doesn't look like a valid Pocket Ledger backup.");
    importFile.value = "";
    return;
  }

  const confirmed = confirm(
    `This will replace ALL current transactions with ${transactions.length} transaction(s) from this backup. This cannot be undone. Continue?`
  );
  if (!confirmed) {
    importFile.value = "";
    return;
  }

  await clearAllTransactions();
  for (const t of transactions) {
    // Drop the old "id" so IndexedDB assigns fresh ones and avoids key clashes.
    const { id, ...rest } = t;
    await addTransaction(rest);
  }

  // Merge any categories from the backup that don't exist locally yet.
  if (importedCategories) {
    for (const type of ["expense", "income"]) {
      const incoming = importedCategories[type] || [];
      for (const name of incoming) {
        const exists = categories[type].some((c) => c.toLowerCase() === name.toLowerCase());
        if (!exists) {
          await addCategory(type, name);
          categories[type].push(name);
        }
      }
    }
    populateCategories(currentType);
  }

  importFile.value = "";
  await refresh();
});

// --- Initial setup -----------------------------------------------------------

async function init() {
  await loadCategories();
  dateInput.value = todayISO();
  setType("expense");
  await refresh();
}

init();