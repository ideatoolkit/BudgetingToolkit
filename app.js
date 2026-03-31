const APP_STORAGE_KEY = 'north-ledger-state-v1';
const TODAY = new Date();

const DEFAULT_CATEGORIES = [
  { name: 'Home & Living', color: '#5B8CFF' },
  { name: 'Pleasure', color: '#FF8A65' },
  { name: 'Subscriptions', color: '#8B5CF6' },
  { name: 'Online Purchases', color: '#2DD4BF' },
];

const DEFAULT_PAYMENT_METHODS = [
  'Credit Card',
  'Debit',
  'Cash',
  'E-transfer',
  'Apple Pay',
  'PayPal',
];

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' });
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const MONTH_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', { month: 'short', year: '2-digit' });
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

const state = {
  activeTab: 'home',
  selectedEntryId: null,
  deferredInstallPrompt: null,
  data: createInitialState(),
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  loadState();
  bindEvents();
  populateStaticSelects();
  applyPreferences();
  renderAll();
  registerServiceWorker();
  setupInstallPrompt();
}

function createInitialState() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map((category) => ({
      id: uid('cat'),
      name: category.name,
      color: category.color,
      system: true,
      createdAt: new Date().toISOString(),
    })),
    paymentMethods: DEFAULT_PAYMENT_METHODS.map((name) => ({
      id: uid('pay'),
      name,
    })),
    expenses: [],
    preferences: {
      reduceMotion: false,
      backupReminder: true,
      accentGlow: true,
    },
  };
}

function cacheElements() {
  const ids = [
    'homeFocusMonth', 'homeTotalSpent', 'homeMetricGrid', 'homeTopCategoryBadge', 'homeLegend', 'homeInsights', 'homeTrendBadge',
    'expenseForm', 'expenseId', 'expenseTitle', 'expenseAmount', 'expenseDate', 'expenseCategory', 'expensePaymentMethod',
    'expenseCostType', 'expenseRecurringFrequency', 'expenseNotes', 'expensePeriodType', 'saveExpenseBtn', 'clearFormBtn',
    'recentSubmissions', 'recurringFields', 'periodOnlyField', 'formHeading', 'categoryForm', 'categoryId', 'categoryName', 'categoryColor',
    'categoryList', 'categorySheet', 'categorySheetTitle', 'openCategorySheetBtn', 'settingsCategoryBtn', 'settingsCategoryList',
    'entriesList', 'entriesCountLabel', 'searchInput', 'filterMonth', 'filterDateStart', 'filterDateEnd', 'filterCategory', 'filterPaymentMethod',
    'filterCostType', 'filterFrequency', 'filterPeriodType', 'filterSort', 'filterGroup', 'clearFiltersBtn',
    'chartCategory', 'chartPaymentMethod', 'chartCostType', 'chartFrequency', 'chartMonth', 'chartDateStart', 'chartDateEnd',
    'chartPeriodType', 'chartCompareWindow', 'chartSummaryBadge', 'resetChartFiltersBtn', 'chartInsights', 'chartDonutLegend',
    'chartDonutMetric', 'storageStatus', 'prefMotion', 'prefBackupReminder', 'prefAccentGlow', 'exportBtn', 'importFileInput',
    'resetDataBtn', 'installBtn', 'toast', 'entrySheet', 'entrySheetBody', 'entryEditBtn', 'entryDuplicateBtn', 'entryDeleteBtn', 'entrySheetTitle'
  ];
  ids.forEach((id) => { els[id] = document.getElementById(id); });

  els.tabs = Array.from(document.querySelectorAll('.tab-panel'));
  els.navItems = Array.from(document.querySelectorAll('.nav-item'));
  els.costSegments = Array.from(document.querySelectorAll('#costTypeSegment .segment'));
  els.periodSegments = Array.from(document.querySelectorAll('#periodSegment .segment'));
  els.periodRecurringSegments = Array.from(document.querySelectorAll('#periodSegmentRecurring .segment'));
  els.sheetClosers = Array.from(document.querySelectorAll('[data-sheet-close]'));
  els.jumpChartsBtn = document.querySelector('[data-action="jumpCharts"]');

  els.homeDonutChart = document.getElementById('homeDonutChart');
  els.homeTrendChart = document.getElementById('homeTrendChart');
  els.chartsDonutCanvas = document.getElementById('chartsDonutCanvas');
  els.chartsBarCanvas = document.getElementById('chartsBarCanvas');
  els.chartsLineCanvas = document.getElementById('chartsLineCanvas');
  els.chartsStackCanvas = document.getElementById('chartsStackCanvas');
  els.chartsPaymentCanvas = document.getElementById('chartsPaymentCanvas');
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
  });

  els.expenseForm.addEventListener('submit', onExpenseSubmit);
  els.clearFormBtn.addEventListener('click', resetExpenseForm);

  els.costSegments.forEach((button) => {
    button.addEventListener('click', () => setCostType(button.dataset.costType));
  });
  [...els.periodSegments, ...els.periodRecurringSegments].forEach((button) => {
    button.addEventListener('click', () => setPeriodType(button.dataset.periodType));
  });

  els.categoryForm.addEventListener('submit', onCategorySubmit);
  els.openCategorySheetBtn.addEventListener('click', () => openSheet('categorySheet'));
  els.settingsCategoryBtn.addEventListener('click', () => openSheet('categorySheet'));
  els.sheetClosers.forEach((button) => {
    button.addEventListener('click', () => closeSheet(button.dataset.sheetClose));
  });

  [
    els.searchInput, els.filterMonth, els.filterDateStart, els.filterDateEnd, els.filterCategory, els.filterPaymentMethod,
    els.filterCostType, els.filterFrequency, els.filterPeriodType, els.filterSort, els.filterGroup,
    els.chartCategory, els.chartPaymentMethod, els.chartCostType, els.chartFrequency, els.chartMonth, els.chartDateStart,
    els.chartDateEnd, els.chartPeriodType, els.chartCompareWindow
  ].forEach((input) => input.addEventListener('input', renderAll));

  els.clearFiltersBtn.addEventListener('click', resetEntriesFilters);
  els.resetChartFiltersBtn.addEventListener('click', resetChartFilters);

  els.exportBtn.addEventListener('click', exportBackup);
  els.importFileInput.addEventListener('change', importBackup);
  els.resetDataBtn.addEventListener('click', resetAllData);

  els.prefMotion.addEventListener('change', updatePreferencesFromControls);
  els.prefBackupReminder.addEventListener('change', updatePreferencesFromControls);
  els.prefAccentGlow.addEventListener('change', updatePreferencesFromControls);

  els.entryEditBtn.addEventListener('click', editSelectedEntry);
  els.entryDuplicateBtn.addEventListener('click', duplicateSelectedEntry);
  els.entryDeleteBtn.addEventListener('click', deleteSelectedEntry);
  els.jumpChartsBtn?.addEventListener('click', () => setActiveTab('charts'));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSheet('categorySheet');
      closeSheet('entrySheet');
    }
  });
}

function populateStaticSelects() {
  const monthOptions = buildMonthOptions();
  setOptions(els.filterMonth, [{ value: 'all', label: 'All months' }, ...monthOptions]);
  setOptions(els.chartMonth, [{ value: 'all', label: 'All months' }, ...monthOptions]);
  els.filterMonth.value = getCurrentMonthKey();
  els.chartMonth.value = 'all';
  els.expenseDate.value = toDateInputValue(TODAY);
}

function buildMonthOptions() {
  const start = new Date(TODAY.getFullYear() - 1, TODAY.getMonth(), 1);
  const options = [];
  for (let i = 0; i < 24; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const value = getMonthKey(date);
    options.push({ value, label: MONTH_FORMATTER.format(date) });
  }
  return options.reverse();
}

function loadState() {
  const raw = localStorage.getItem(APP_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    state.data = normalizeImportedState(parsed);
  } catch (error) {
    console.error('Failed to load local data', error);
    showToast('Could not read saved data. Using a clean local setup.');
  }
}

function saveState() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state.data));
}

function normalizeImportedState(input) {
  const clean = createInitialState();
  clean.categories = Array.isArray(input.categories) && input.categories.length ? input.categories.map((category) => ({
    id: category.id || uid('cat'),
    name: String(category.name || 'Untitled'),
    color: category.color || randomColor(),
    system: Boolean(category.system),
    createdAt: category.createdAt || new Date().toISOString(),
  })) : clean.categories;

  clean.paymentMethods = Array.isArray(input.paymentMethods) && input.paymentMethods.length ? input.paymentMethods.map((method) => ({
    id: method.id || uid('pay'),
    name: String(method.name || 'Method'),
  })) : clean.paymentMethods;

  clean.expenses = Array.isArray(input.expenses) ? input.expenses.map((expense) => ({
    id: expense.id || uid('exp'),
    title: String(expense.title || ''),
    amount: Number(expense.amount || 0),
    date: expense.date || toDateInputValue(TODAY),
    categoryId: resolveCategoryId(expense.categoryId, clean.categories),
    paymentMethodId: resolvePaymentMethodId(expense.paymentMethodId, clean.paymentMethods),
    costType: expense.costType === 'recurring' ? 'recurring' : 'one-time',
    recurringFrequency: expense.recurringFrequency || 'monthly',
    notes: String(expense.notes || ''),
    periodType: expense.periodType === 'yearly' ? 'yearly' : 'monthly',
    createdAt: expense.createdAt || new Date().toISOString(),
    updatedAt: expense.updatedAt || new Date().toISOString(),
  })) : [];

  clean.preferences = {
    reduceMotion: Boolean(input.preferences?.reduceMotion),
    backupReminder: input.preferences?.backupReminder !== false,
    accentGlow: input.preferences?.accentGlow !== false,
  };
  return clean;
}

function resolveCategoryId(categoryId, categories) {
  return categories.some((item) => item.id === categoryId) ? categoryId : categories[0].id;
}

function resolvePaymentMethodId(paymentMethodId, methods) {
  return methods.some((item) => item.id === paymentMethodId) ? paymentMethodId : methods[0].id;
}

function renderAll() {
  saveState();
  populateDynamicSelects();
  renderHome();
  renderRecentSubmissions();
  renderEntries();
  renderCharts();
  renderCategories();
  renderSettings();
}

function populateDynamicSelects() {
  const categories = state.data.categories.map((category) => ({ value: category.id, label: category.name }));
  const methods = state.data.paymentMethods.map((method) => ({ value: method.id, label: method.name }));

  preserveSelectValue(els.expenseCategory, categories, categories[0]?.value || '');
  preserveSelectValue(els.expensePaymentMethod, methods, methods[0]?.value || '');
  preserveSelectValue(els.filterCategory, [{ value: 'all', label: 'All categories' }, ...categories], 'all');
  preserveSelectValue(els.filterPaymentMethod, [{ value: 'all', label: 'All payment methods' }, ...methods], 'all');
  preserveSelectValue(els.chartCategory, [{ value: 'all', label: 'All categories' }, ...categories], 'all');
  preserveSelectValue(els.chartPaymentMethod, [{ value: 'all', label: 'All payment methods' }, ...methods], 'all');
}

function preserveSelectValue(select, options, fallback) {
  const currentValue = select.value;
  setOptions(select, options);
  select.value = options.some((option) => option.value === currentValue) ? currentValue : fallback;
}

function setOptions(select, options) {
  select.innerHTML = '';
  options.forEach((option) => {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    select.appendChild(node);
  });
}

function renderHome() {
  const monthKey = getCurrentMonthKey();
  const monthExpenses = state.data.expenses.filter((expense) => getMonthKey(expense.date) === monthKey);
  const total = sumAmounts(monthExpenses);
  const recurring = sumAmounts(monthExpenses.filter((item) => item.costType === 'recurring'));
  const oneTime = sumAmounts(monthExpenses.filter((item) => item.costType === 'one-time'));
  const biggest = monthExpenses.slice().sort((a, b) => b.amount - a.amount)[0];
  const average = monthExpenses.length ? total / monthExpenses.length : 0;
  const monthlySeries = buildMonthlySeries(state.data.expenses, 6);
  const trendDirection = monthlySeries.length >= 2 ? monthlySeries[monthlySeries.length - 1].value - monthlySeries[monthlySeries.length - 2].value : 0;
  const categoryTotals = aggregateByCategory(monthExpenses).slice(0, 6);
  const topCategory = categoryTotals[0];

  els.homeFocusMonth.textContent = MONTH_FORMATTER.format(parseMonthKey(monthKey));
  els.homeTotalSpent.textContent = formatCurrency(total);
  els.homeTopCategoryBadge.textContent = topCategory ? `${topCategory.name} · ${formatCurrency(topCategory.total)}` : 'No entries yet';
  els.homeTrendBadge.textContent = trendDirection > 0 ? 'Up from last month' : trendDirection < 0 ? 'Down from last month' : 'Stable';

  const metrics = [
    { label: 'Recurring total', value: formatCurrency(recurring) },
    { label: 'One-time total', value: formatCurrency(oneTime) },
    { label: 'Biggest expense', value: biggest ? formatCurrency(biggest.amount) : '—' },
    { label: 'Transactions', value: String(monthExpenses.length) },
    { label: 'Average spend', value: formatCurrency(average) },
    { label: 'Top category', value: topCategory ? topCategory.name : '—' },
  ];

  els.homeMetricGrid.innerHTML = metrics.map((metric) => `
    <div class="metric-card">
      <p class="eyebrow">${escapeHtml(metric.label)}</p>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
    </div>
  `).join('');

  renderLegend(els.homeLegend, categoryTotals);
  renderInsights(els.homeInsights, buildHomeInsights({ total, recurring, oneTime, biggest, average, categoryTotals, monthlySeries }));
  drawDonutChart(els.homeDonutChart, categoryTotals);
  drawLineChart(els.homeTrendChart, monthlySeries, { showArea: true });
}

function buildHomeInsights({ total, recurring, oneTime, biggest, average, categoryTotals, monthlySeries }) {
  const previous = monthlySeries.at(-2)?.value || 0;
  const current = monthlySeries.at(-1)?.value || 0;
  const delta = current - previous;
  const topCategory = categoryTotals[0];
  return [
    {
      icon: '◎',
      text: topCategory ? `${topCategory.name} is leading this month at ${formatCurrency(topCategory.total)}.` : 'Start logging expenses to unlock category insights.',
    },
    {
      icon: '↕',
      text: previous ? `Spending is ${delta >= 0 ? 'up' : 'down'} ${formatCurrency(Math.abs(delta))} versus last month.` : `Average spend this month is ${formatCurrency(average)} per transaction.`,
    },
    {
      icon: '⟳',
      text: recurring ? `Recurring expenses account for ${Math.round((recurring / Math.max(total, 1)) * 100)}% of this month.` : `You currently have no recurring expenses logged for this month.`,
    },
    {
      icon: '◆',
      text: biggest ? `Largest transaction: ${biggest.title} at ${formatCurrency(biggest.amount)}.` : 'Largest transaction insight will appear here once you add entries.',
    },
    {
      icon: '⋯',
      text: oneTime > recurring ? 'One-time spending is driving most of your recent outflow.' : 'Recurring commitments are the main driver of spend right now.',
    },
  ];
}

function renderRecentSubmissions() {
  const recent = state.data.expenses.slice().sort(sortByCreatedDesc).slice(0, 8);
  if (!recent.length) {
    els.recentSubmissions.innerHTML = '<div class="empty-state">Recent submissions will appear here after you log your first expense.</div>';
    return;
  }
  els.recentSubmissions.innerHTML = recent.map((expense) => {
    const category = getCategoryById(expense.categoryId);
    return `
      <div class="recent-item">
        <button class="recent-button" type="button" data-edit-expense="${expense.id}">
          <div class="ledger-title-row">
            <span class="category-dot" style="background:${category.color}"></span>
            <span class="ledger-title">${escapeHtml(expense.title)}</span>
            <span class="ledger-amount">${formatCurrency(expense.amount)}</span>
          </div>
          <div class="meta-row top-gap">
            <span class="meta-chip">${escapeHtml(formatShortDate(expense.date))}</span>
            <span class="meta-chip">${escapeHtml(category.name)}</span>
            <span class="meta-chip">${escapeHtml(getPaymentMethodName(expense.paymentMethodId))}</span>
          </div>
        </button>
      </div>
    `;
  }).join('');

  els.recentSubmissions.querySelectorAll('[data-edit-expense]').forEach((button) => {
    button.addEventListener('click', () => beginEditExpense(button.dataset.editExpense));
  });
}

function renderEntries() {
  const entries = getFilteredEntries(getEntryFilters());
  els.entriesCountLabel.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  if (!entries.length) {
    els.entriesList.innerHTML = '<div class="empty-state">No entries match these filters.</div>';
    return;
  }

  const grouped = els.filterGroup.value === 'month' ? groupEntriesByMonth(entries) : [{ monthKey: 'all', items: entries }];
  els.entriesList.innerHTML = grouped.map((group) => {
    const label = group.monthKey === 'all' ? '' : `
      <div class="ledger-month-header glass">
        <strong>${escapeHtml(MONTH_FORMATTER.format(parseMonthKey(group.monthKey)))}</strong>
      </div>`;
    const rows = group.items.map((expense) => renderLedgerRow(expense)).join('');
    return `<div class="ledger-section">${label}${rows}</div>`;
  }).join('');

  els.entriesList.querySelectorAll('[data-entry-id]').forEach((row) => {
    row.addEventListener('click', () => openEntrySheet(row.dataset.entryId));
  });
}

function renderLedgerRow(expense) {
  const category = getCategoryById(expense.categoryId);
  const recurringLabel = expense.costType === 'recurring' ? expense.recurringFrequency : 'One-time';
  return `
    <button class="ledger-row" type="button" data-entry-id="${expense.id}">
      <span class="ledger-marker" style="background:${category.color}"></span>
      <div class="ledger-main">
        <div class="ledger-title-row">
          <span class="ledger-title">${escapeHtml(expense.title)}</span>
        </div>
        <div class="meta-row top-gap">
          <span class="meta-chip category-chip" style="background:${category.color}22;border:1px solid ${category.color}55;color:${category.color};">${escapeHtml(category.name)}</span>
          <span class="meta-chip">${escapeHtml(formatShortDate(expense.date))}</span>
          <span class="meta-chip">${escapeHtml(getPaymentMethodName(expense.paymentMethodId))}</span>
          <span class="meta-chip">${escapeHtml(recurringLabel)}</span>
          <span class="meta-chip">${escapeHtml(expense.periodType)}</span>
        </div>
      </div>
      <div class="ledger-amount">${formatCurrency(expense.amount)}</div>
    </button>
  `;
}

function renderCharts() {
  const filters = getChartFilters();
  const entries = getFilteredEntries(filters);
  const categoryTotals = aggregateByCategory(entries);
  const paymentTotals = aggregateByPaymentMethod(entries);
  const monthlySeries = buildMonthlySeries(entries, resolveCompareWindow(filters.compareWindow));
  const recurringSeries = buildRecurringVsOneTimeSeries(entries, resolveCompareWindow(filters.compareWindow));
  const total = sumAmounts(entries);
  const topCategory = categoryTotals[0];
  const topMethod = paymentTotals[0];

  els.chartSummaryBadge.textContent = entries.length ? `${entries.length} entries · ${formatCurrency(total)}` : 'No matching data';
  els.chartDonutMetric.textContent = formatCurrency(total);
  renderLegend(els.chartDonutLegend, categoryTotals.slice(0, 8));
  renderInsights(els.chartInsights, buildChartInsights({ entries, categoryTotals, paymentTotals, monthlySeries, recurringSeries, total }));

  drawDonutChart(els.chartsDonutCanvas, categoryTotals);
  drawBarChart(els.chartsBarCanvas, categoryTotals.slice(0, 8));
  drawLineChart(els.chartsLineCanvas, monthlySeries, { showArea: false });
  drawStackedChart(els.chartsStackCanvas, recurringSeries);
  drawBarChart(els.chartsPaymentCanvas, paymentTotals.slice(0, 8), { horizontal: true, useSourceColor: false });

  if (topCategory) {
    els.chartSummaryBadge.textContent += ` · ${topCategory.name} leads`;
  } else if (topMethod) {
    els.chartSummaryBadge.textContent += ` · ${topMethod.name}`;
  }
}

function buildChartInsights({ entries, categoryTotals, paymentTotals, monthlySeries, recurringSeries, total }) {
  const recurringTotal = entries.filter((entry) => entry.costType === 'recurring').reduce((sum, item) => sum + item.amount, 0);
  const oneTimeTotal = total - recurringTotal;
  const monthsWithData = monthlySeries.filter((item) => item.value > 0).length;
  const peakMonth = monthlySeries.slice().sort((a, b) => b.value - a.value)[0];
  return [
    {
      icon: '◔',
      text: categoryTotals[0] ? `${categoryTotals[0].name} is the biggest category at ${formatCurrency(categoryTotals[0].total)}.` : 'No category data for the selected filters yet.',
    },
    {
      icon: '◫',
      text: paymentTotals[0] ? `${paymentTotals[0].name} is the most used payment method by spend.` : 'Payment method trends will appear once data is available.',
    },
    {
      icon: '▣',
      text: total ? `Recurring vs one-time: ${formatCurrency(recurringTotal)} recurring and ${formatCurrency(oneTimeTotal)} one-time.` : 'Adjust filters or add entries to compare recurring and one-time costs.',
    },
    {
      icon: '↗',
      text: peakMonth ? `Peak month in this window: ${peakMonth.label} at ${formatCurrency(peakMonth.value)}.` : 'Peak month insight is waiting for more data.',
    },
    {
      icon: '◌',
      text: `${monthsWithData} active ${monthsWithData === 1 ? 'month' : 'months'} inside the selected comparison window.`,
    },
  ];
}

function renderCategories() {
  const usage = getCategoryUsageMap();
  const markup = state.data.categories.map((category) => `
    <div class="sheet-item">
      <div class="ledger-title-row">
        <span class="category-dot" style="background:${category.color}"></span>
        <span class="ledger-title">${escapeHtml(category.name)}</span>
        <span class="meta-chip">${usage.get(category.id) || 0} entries</span>
      </div>
      <div class="button-row wrap top-gap">
        <button class="secondary-button small" type="button" data-category-edit="${category.id}">Edit</button>
        <button class="danger-button small" type="button" data-category-delete="${category.id}" ${usage.get(category.id) ? 'disabled' : ''}>Delete</button>
      </div>
    </div>
  `).join('');

  els.categoryList.innerHTML = markup || '<div class="empty-state">No categories yet.</div>';
  els.settingsCategoryList.innerHTML = markup || '<div class="empty-state">No categories yet.</div>';

  document.querySelectorAll('[data-category-edit]').forEach((button) => {
    button.addEventListener('click', () => fillCategoryForm(button.dataset.categoryEdit));
  });
  document.querySelectorAll('[data-category-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteCategory(button.dataset.categoryDelete));
  });
}

function renderSettings() {
  els.prefMotion.checked = state.data.preferences.reduceMotion;
  els.prefBackupReminder.checked = state.data.preferences.backupReminder;
  els.prefAccentGlow.checked = state.data.preferences.accentGlow;

  const raw = localStorage.getItem(APP_STORAGE_KEY) || '';
  const usageKb = (new Blob([raw]).size / 1024).toFixed(1);
  els.storageStatus.innerHTML = `
    <div>Local storage is active for this device and browser.</div>
    <div class="storage-metrics">
      <div class="storage-item"><div class="eyebrow">Entries</div><strong>${state.data.expenses.length}</strong></div>
      <div class="storage-item"><div class="eyebrow">Categories</div><strong>${state.data.categories.length}</strong></div>
      <div class="storage-item"><div class="eyebrow">Payment methods</div><strong>${state.data.paymentMethods.length}</strong></div>
      <div class="storage-item"><div class="eyebrow">Approx. storage</div><strong>${usageKb} KB</strong></div>
    </div>
  `;
}

function onExpenseSubmit(event) {
  event.preventDefault();
  const title = els.expenseTitle.value.trim();
  const amount = Number(els.expenseAmount.value);
  if (!title || !amount || amount <= 0 || !els.expenseDate.value) {
    showToast('Enter a title, valid amount, and date.');
    return;
  }

  const payload = {
    id: els.expenseId.value || uid('exp'),
    title,
    amount: roundMoney(amount),
    date: els.expenseDate.value,
    categoryId: els.expenseCategory.value,
    paymentMethodId: els.expensePaymentMethod.value,
    costType: els.expenseCostType.value,
    recurringFrequency: els.expenseCostType.value === 'recurring' ? els.expenseRecurringFrequency.value : 'monthly',
    notes: els.expenseNotes.value.trim(),
    periodType: els.expensePeriodType.value,
    createdAt: els.expenseId.value ? getExpenseById(els.expenseId.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = state.data.expenses.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    state.data.expenses.splice(existingIndex, 1, payload);
    showToast('Expense updated.');
  } else {
    state.data.expenses.unshift(payload);
    showToast('Expense saved.');
  }

  resetExpenseForm();
  renderAll();
  setActiveTab('add');
}

function beginEditExpense(expenseId) {
  const expense = getExpenseById(expenseId);
  if (!expense) return;
  els.expenseId.value = expense.id;
  els.expenseTitle.value = expense.title;
  els.expenseAmount.value = expense.amount;
  els.expenseDate.value = expense.date;
  els.expenseCategory.value = expense.categoryId;
  els.expensePaymentMethod.value = expense.paymentMethodId;
  els.expenseNotes.value = expense.notes || '';
  setCostType(expense.costType);
  setPeriodType(expense.periodType);
  els.expenseRecurringFrequency.value = expense.recurringFrequency || 'monthly';
  els.formHeading.textContent = 'Edit expense';
  els.saveExpenseBtn.textContent = 'Update expense';
  setActiveTab('add');
  window.scrollTo({ top: 0, behavior: state.data.preferences.reduceMotion ? 'auto' : 'smooth' });
}

function resetExpenseForm() {
  els.expenseForm.reset();
  els.expenseId.value = '';
  els.expenseDate.value = toDateInputValue(TODAY);
  els.expenseCategory.value = state.data.categories[0]?.id || '';
  els.expensePaymentMethod.value = state.data.paymentMethods[0]?.id || '';
  setCostType('one-time');
  setPeriodType('monthly');
  els.formHeading.textContent = 'Log expense';
  els.saveExpenseBtn.textContent = 'Save expense';
}

function setCostType(type) {
  els.expenseCostType.value = type;
  els.costSegments.forEach((button) => button.classList.toggle('active', button.dataset.costType === type));
  els.recurringFields.classList.toggle('hidden-block', type !== 'recurring');
}

function setPeriodType(type) {
  els.expensePeriodType.value = type;
  [...els.periodSegments, ...els.periodRecurringSegments].forEach((button) => {
    button.classList.toggle('active', button.dataset.periodType === type);
  });
}

function onCategorySubmit(event) {
  event.preventDefault();
  const name = els.categoryName.value.trim();
  const color = els.categoryColor.value;
  if (!name) {
    showToast('Give the category a name.');
    return;
  }
  const duplicateName = state.data.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && category.id !== els.categoryId.value);
  if (duplicateName) {
    showToast('Category name already exists.');
    return;
  }

  if (els.categoryId.value) {
    const category = getCategoryById(els.categoryId.value);
    if (category) {
      category.name = name;
      category.color = color;
      showToast('Category updated.');
    }
  } else {
    state.data.categories.push({ id: uid('cat'), name, color, system: false, createdAt: new Date().toISOString() });
    showToast('Category added.');
  }

  els.categoryForm.reset();
  els.categoryColor.value = '#8b5cf6';
  els.categoryId.value = '';
  els.categorySheetTitle.textContent = 'Add category';
  renderAll();
}

function fillCategoryForm(categoryId) {
  const category = getCategoryById(categoryId);
  if (!category) return;
  els.categoryId.value = category.id;
  els.categoryName.value = category.name;
  els.categoryColor.value = category.color;
  els.categorySheetTitle.textContent = 'Edit category';
  openSheet('categorySheet');
}

function deleteCategory(categoryId) {
  const usage = getCategoryUsageMap().get(categoryId) || 0;
  if (usage > 0) {
    showToast('Category is in use and cannot be deleted.');
    return;
  }
  state.data.categories = state.data.categories.filter((category) => category.id !== categoryId);
  if (!state.data.categories.length) {
    state.data.categories = createInitialState().categories;
  }
  renderAll();
  showToast('Category deleted.');
}

function openEntrySheet(entryId) {
  const entry = getExpenseById(entryId);
  if (!entry) return;
  const category = getCategoryById(entry.categoryId);
  state.selectedEntryId = entryId;
  els.entrySheetTitle.textContent = entry.title;
  els.entrySheetBody.innerHTML = `
    ${detailRow('Amount', formatCurrency(entry.amount))}
    ${detailRow('Date', formatShortDate(entry.date))}
    ${detailRow('Category', `<span class="meta-chip category-chip" style="background:${category.color}22;border:1px solid ${category.color}55;color:${category.color};">${escapeHtml(category.name)}</span>`)}
    ${detailRow('Payment', escapeHtml(getPaymentMethodName(entry.paymentMethodId)))}
    ${detailRow('Type', escapeHtml(entry.costType === 'recurring' ? `Recurring · ${entry.recurringFrequency}` : 'One-time'))}
    ${detailRow('Period', escapeHtml(entry.periodType))}
    ${detailRow('Added', escapeHtml(formatDateTime(entry.createdAt)))}
    ${detailRow('Notes', entry.notes ? escapeHtml(entry.notes) : '<span class="muted">None</span>')}
  `;
  openSheet('entrySheet');
}

function detailRow(label, value) {
  return `<div class="detail-row"><span class="detail-label">${label}</span><span>${value}</span></div>`;
}

function editSelectedEntry() {
  if (!state.selectedEntryId) return;
  closeSheet('entrySheet');
  beginEditExpense(state.selectedEntryId);
}

function duplicateSelectedEntry() {
  const entry = getExpenseById(state.selectedEntryId);
  if (!entry) return;
  const copy = { ...entry, id: uid('exp'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.data.expenses.unshift(copy);
  closeSheet('entrySheet');
  renderAll();
  showToast('Entry duplicated.');
}

function deleteSelectedEntry() {
  if (!state.selectedEntryId) return;
  state.data.expenses = state.data.expenses.filter((expense) => expense.id !== state.selectedEntryId);
  closeSheet('entrySheet');
  renderAll();
  showToast('Entry deleted.');
}

function getEntryFilters() {
  return {
    search: els.searchInput.value.trim().toLowerCase(),
    month: els.filterMonth.value,
    startDate: els.filterDateStart.value,
    endDate: els.filterDateEnd.value,
    categoryId: els.filterCategory.value,
    paymentMethodId: els.filterPaymentMethod.value,
    costType: els.filterCostType.value,
    recurringFrequency: els.filterFrequency.value,
    periodType: els.filterPeriodType.value,
    sort: els.filterSort.value,
  };
}

function getChartFilters() {
  return {
    search: '',
    month: els.chartMonth.value,
    startDate: els.chartDateStart.value,
    endDate: els.chartDateEnd.value,
    categoryId: els.chartCategory.value,
    paymentMethodId: els.chartPaymentMethod.value,
    costType: els.chartCostType.value,
    recurringFrequency: els.chartFrequency.value,
    periodType: els.chartPeriodType.value,
    sort: 'date-asc',
    compareWindow: els.chartCompareWindow.value,
  };
}

function getFilteredEntries(filters) {
  const list = state.data.expenses.filter((expense) => {
    if (filters.search && !(expense.title.toLowerCase().includes(filters.search) || expense.notes.toLowerCase().includes(filters.search))) return false;
    if (filters.month && filters.month !== 'all' && getMonthKey(expense.date) !== filters.month) return false;
    if (filters.startDate && expense.date < filters.startDate) return false;
    if (filters.endDate && expense.date > filters.endDate) return false;
    if (filters.categoryId && filters.categoryId !== 'all' && expense.categoryId !== filters.categoryId) return false;
    if (filters.paymentMethodId && filters.paymentMethodId !== 'all' && expense.paymentMethodId !== filters.paymentMethodId) return false;
    if (filters.costType && filters.costType !== 'all' && expense.costType !== filters.costType) return false;
    if (filters.recurringFrequency && filters.recurringFrequency !== 'all' && expense.recurringFrequency !== filters.recurringFrequency) return false;
    if (filters.periodType && filters.periodType !== 'all' && expense.periodType !== filters.periodType) return false;
    return true;
  });

  return list.sort((a, b) => {
    switch (filters.sort) {
      case 'date-asc': return a.date.localeCompare(b.date);
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc': return a.amount - b.amount;
      case 'created-desc': return new Date(b.createdAt) - new Date(a.createdAt);
      case 'date-desc':
      default: return b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt);
    }
  });
}

function groupEntriesByMonth(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = getMonthKey(entry.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Array.from(groups.entries()).map(([monthKey, items]) => ({ monthKey, items }));
}

function resetEntriesFilters() {
  els.searchInput.value = '';
  els.filterMonth.value = getCurrentMonthKey();
  els.filterDateStart.value = '';
  els.filterDateEnd.value = '';
  els.filterCategory.value = 'all';
  els.filterPaymentMethod.value = 'all';
  els.filterCostType.value = 'all';
  els.filterFrequency.value = 'all';
  els.filterPeriodType.value = 'all';
  els.filterSort.value = 'date-desc';
  els.filterGroup.value = 'month';
  renderAll();
}

function resetChartFilters() {
  els.chartCategory.value = 'all';
  els.chartPaymentMethod.value = 'all';
  els.chartCostType.value = 'all';
  els.chartFrequency.value = 'all';
  els.chartMonth.value = 'all';
  els.chartDateStart.value = '';
  els.chartDateEnd.value = '';
  els.chartPeriodType.value = 'all';
  els.chartCompareWindow.value = '3';
  renderAll();
}

function renderLegend(container, items) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">No data to display for this view.</div>';
    return;
  }
  container.innerHTML = items.map((item) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${item.color}"></span>
      <div class="legend-meta">
        <div class="legend-name">${escapeHtml(item.name)}</div>
        <div class="legend-value">${formatCurrency(item.total)} · ${item.share}%</div>
      </div>
    </div>
  `).join('');
}

function renderInsights(container, items) {
  container.innerHTML = items.map((item) => `
    <div class="insight-item">
      <span class="insight-icon">${item.icon}</span>
      <div>${escapeHtml(item.text)}</div>
    </div>
  `).join('');
}

function aggregateByCategory(entries) {
  const total = sumAmounts(entries);
  const map = new Map();
  entries.forEach((expense) => {
    const category = getCategoryById(expense.categoryId);
    if (!map.has(category.id)) {
      map.set(category.id, { id: category.id, name: category.name, color: category.color, total: 0 });
    }
    map.get(category.id).total += expense.amount;
  });
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({ ...item, share: total ? Math.round((item.total / total) * 100) : 0 }));
}

function aggregateByPaymentMethod(entries) {
  const total = sumAmounts(entries);
  const palette = ['#7C5CFF', '#36C9C6', '#4BA3FF', '#F59E0B', '#FF8A65', '#2DD4BF', '#A78BFA'];
  const map = new Map();
  entries.forEach((expense) => {
    const name = getPaymentMethodName(expense.paymentMethodId);
    if (!map.has(name)) {
      map.set(name, { name, color: palette[map.size % palette.length], total: 0 });
    }
    map.get(name).total += expense.amount;
  });
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({ ...item, share: total ? Math.round((item.total / total) * 100) : 0 }));
}

function buildMonthlySeries(entries, windowSize = 6) {
  const end = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  const start = new Date(end.getFullYear(), end.getMonth() - (windowSize - 1), 1);
  const buckets = [];
  for (let i = 0; i < windowSize; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = getMonthKey(date);
    const value = entries.filter((entry) => getMonthKey(entry.date) === key).reduce((sum, item) => sum + item.amount, 0);
    buckets.push({ key, label: MONTH_KEY_FORMATTER.format(date), value: roundMoney(value) });
  }
  return buckets;
}

function buildRecurringVsOneTimeSeries(entries, windowSize = 6) {
  const series = buildMonthlySeries(entries, windowSize);
  return series.map((month) => {
    const monthEntries = entries.filter((entry) => getMonthKey(entry.date) === month.key);
    return {
      label: month.label,
      recurring: roundMoney(monthEntries.filter((entry) => entry.costType === 'recurring').reduce((sum, item) => sum + item.amount, 0)),
      oneTime: roundMoney(monthEntries.filter((entry) => entry.costType === 'one-time').reduce((sum, item) => sum + item.amount, 0)),
    };
  });
}

function drawDonutChart(canvas, items) {
  const ctx = canvas.getContext('2d');
  const { width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!items.length) {
    drawEmptyChart(canvas, 'No data');
    return;
  }
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const innerRadius = radius * 0.62;
  let startAngle = -Math.PI / 2;

  items.forEach((item) => {
    const slice = (item.total / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    startAngle += slice;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#f5f7fb';
  ctx.font = `${Math.round(width * 0.06)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Total', centerX, centerY - 10);
  ctx.font = `700 ${Math.round(width * 0.075)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(formatCompactCurrency(total), centerX, centerY + 22);
}

function drawLineChart(canvas, series, options = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!series.length || series.every((item) => item.value === 0)) {
    drawEmptyChart(canvas, 'No trend data');
    return;
  }

  const padding = { top: 20, right: 18, bottom: 32, left: 18 };
  const max = Math.max(...series.map((item) => item.value), 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const points = series.map((item, index) => ({
    x: padding.left + (chartWidth / Math.max(series.length - 1, 1)) * index,
    y: padding.top + chartHeight - (item.value / max) * chartHeight,
    label: item.label,
    value: item.value,
  }));

  if (options.showArea) {
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(124,92,255,0.34)');
    gradient.addColorStop(1, 'rgba(54,201,198,0.02)');
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = '#7C5CFF';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#36C9C6';
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#8f9bae';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  points.forEach((point) => {
    ctx.fillText(point.label, point.x, height - 10);
  });
}

function drawBarChart(canvas, items, options = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!items.length) {
    drawEmptyChart(canvas, 'No breakdown data');
    return;
  }

  if (options.horizontal) {
    drawHorizontalBars(ctx, width, height, items);
    return;
  }

  const padding = { top: 18, right: 12, bottom: 42, left: 12 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...items.map((item) => item.total), 1);
  const barWidth = chartWidth / items.length * 0.68;

  items.forEach((item, index) => {
    const x = padding.left + (chartWidth / items.length) * index + (chartWidth / items.length - barWidth) / 2;
    const barHeight = (item.total / max) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, item.color || '#7C5CFF');
    gradient.addColorStop(1, 'rgba(255,255,255,0.15)');
    roundRect(ctx, x, y, barWidth, barHeight, 12, true, false, gradient);

    ctx.fillStyle = '#8f9bae';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(truncateLabel(item.name, 8), x + barWidth / 2, height - 14);
  });
}

function drawHorizontalBars(ctx, width, height, items) {
  const padding = { top: 16, right: 18, bottom: 12, left: 92 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...items.map((item) => item.total), 1);
  const rowHeight = chartHeight / items.length;

  items.forEach((item, index) => {
    const y = padding.top + rowHeight * index + 8;
    const barHeight = Math.max(rowHeight - 14, 14);
    const barWidth = (item.total / max) * chartWidth;
    const gradient = ctx.createLinearGradient(padding.left, y, padding.left + barWidth, y);
    gradient.addColorStop(0, '#7C5CFF');
    gradient.addColorStop(1, '#36C9C6');
    roundRect(ctx, padding.left, y, barWidth, barHeight, 10, true, false, gradient);

    ctx.fillStyle = '#c5cfde';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateLabel(item.name, 12), 12, y + barHeight * 0.72);
    ctx.textAlign = 'right';
    ctx.fillText(formatCompactCurrency(item.total), width - 8, y + barHeight * 0.72);
  });
}

function drawStackedChart(canvas, series) {
  const ctx = canvas.getContext('2d');
  const { width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!series.length || series.every((item) => item.recurring === 0 && item.oneTime === 0)) {
    drawEmptyChart(canvas, 'No comparison data');
    return;
  }

  const padding = { top: 18, right: 12, bottom: 38, left: 12 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...series.map((item) => item.recurring + item.oneTime), 1);
  const barWidth = chartWidth / series.length * 0.64;

  series.forEach((item, index) => {
    const x = padding.left + (chartWidth / series.length) * index + (chartWidth / series.length - barWidth) / 2;
    const recurringHeight = (item.recurring / max) * chartHeight;
    const oneTimeHeight = (item.oneTime / max) * chartHeight;
    const baseY = padding.top + chartHeight;
    roundRect(ctx, x, baseY - oneTimeHeight, barWidth, oneTimeHeight, 10, true, false, '#36C9C6');
    roundRect(ctx, x, baseY - oneTimeHeight - recurringHeight, barWidth, recurringHeight, 10, true, false, '#7C5CFF');

    ctx.fillStyle = '#8f9bae';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x + barWidth / 2, height - 12);
  });
}

function drawEmptyChart(canvas, label) {
  const ctx = canvas.getContext('2d');
  const { width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 12, 12, width - 24, height - 24, 18, true, false, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = '#8f9bae';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, height / 2);
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor((rect.width || canvas.width) * ratio);
  const height = Math.floor((rect.height || canvas.height) * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  return { width: (rect.width || canvas.width / ratio), height: (rect.height || canvas.height / ratio) };
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke, fillStyle) {
  if (width <= 0 || height <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (stroke) ctx.stroke();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `north-ledger-backup-${toDateInputValue(TODAY)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Backup exported.');
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state.data = normalizeImportedState(parsed);
      saveState();
      renderAll();
      showToast('Backup imported.');
    } catch (error) {
      console.error(error);
      showToast('Backup file could not be imported.');
    } finally {
      els.importFileInput.value = '';
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  const confirmed = window.confirm('Reset all local categories, preferences, and expenses on this device?');
  if (!confirmed) return;
  state.data = createInitialState();
  saveState();
  resetExpenseForm();
  resetEntriesFilters();
  resetChartFilters();
  renderAll();
  showToast('All local data reset.');
}

function updatePreferencesFromControls() {
  state.data.preferences = {
    reduceMotion: els.prefMotion.checked,
    backupReminder: els.prefBackupReminder.checked,
    accentGlow: els.prefAccentGlow.checked,
  };
  applyPreferences();
  renderAll();
  showToast('Preferences saved.');
}

function applyPreferences() {
  document.body.classList.toggle('reduce-motion', state.data.preferences.reduceMotion);
  document.body.classList.toggle('no-glow', !state.data.preferences.accentGlow);
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.tabTarget === tabName));
  if (tabName === 'charts' || tabName === 'home') {
    requestAnimationFrame(() => {
      renderHome();
      renderCharts();
    });
  }
}

function openSheet(sheetId) {
  const sheet = els[sheetId];
  if (!sheet) return;
  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
}

function closeSheet(sheetId) {
  const sheet = els[sheetId];
  if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
  if (sheetId === 'entrySheet') state.selectedEntryId = null;
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) {
      showToast('Use Add to Home Screen from your browser menu on iPhone.');
      return;
    }
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  }
}

function getCategoryById(categoryId) {
  return state.data.categories.find((category) => category.id === categoryId) || state.data.categories[0];
}

function getExpenseById(expenseId) {
  return state.data.expenses.find((expense) => expense.id === expenseId);
}

function getPaymentMethodName(paymentMethodId) {
  return state.data.paymentMethods.find((method) => method.id === paymentMethodId)?.name || 'Payment';
}

function getCategoryUsageMap() {
  const map = new Map();
  state.data.categories.forEach((category) => map.set(category.id, 0));
  state.data.expenses.forEach((expense) => map.set(expense.categoryId, (map.get(expense.categoryId) || 0) + 1));
  return map;
}

function sumAmounts(entries) {
  return roundMoney(entries.reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(value || 0);
}

function formatCompactCurrency(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return formatCurrency(value);
}

function getMonthKey(dateInput) {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00`) : dateInput;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getCurrentMonthKey() {
  return getMonthKey(TODAY);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateInput) {
  return DATE_FORMATTER.format(new Date(`${dateInput}T00:00:00`));
}

function formatDateTime(dateInput) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(dateInput));
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function resolveCompareWindow(value) {
  if (value === 'year') return 12;
  return Number(value || 3);
}

function truncateLabel(label, length) {
  return label.length > length ? `${label.slice(0, length - 1)}…` : label;
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function randomColor() {
  const palette = ['#5B8CFF', '#FF8A65', '#8B5CF6', '#2DD4BF', '#F59E0B', '#EC4899'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.addEventListener('resize', () => {
  if (state.activeTab === 'home') renderHome();
  if (state.activeTab === 'charts') renderCharts();
});
