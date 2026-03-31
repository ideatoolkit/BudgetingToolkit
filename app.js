const STORAGE_KEY = 'north-ledger-clean-v2';
const fmtCurrency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmtMonth = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' });
const fmtShortDate = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const TODAY = new Date();

const defaultCategories = [
  ['Home & Living', '#5B8CFF'],
  ['Pleasure', '#FF8A65'],
  ['Subscriptions', '#8B5CF6'],
  ['Online Purchases', '#2DD4BF'],
];
const defaultPaymentMethods = ['Credit Card', 'Debit', 'Cash', 'E-transfer', 'Apple Pay', 'PayPal'];

const state = {
  activeTab: 'home',
  entrySheetId: null,
  deferredInstallPrompt: null,
  data: initState(),
};

const el = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheEls();
  loadState();
  bindEvents();
  initStaticFilters();
  resetForm();
  renderAll();
  registerSW();
  initInstall();
}

function initState() {
  return {
    version: 2,
    categories: defaultCategories.map(([name, color]) => ({ id: uid('cat'), name, color, system: true, createdAt: new Date().toISOString() })),
    paymentMethods: defaultPaymentMethods.map((name) => ({ id: uid('pay'), name })),
    expenses: [],
  };
}

function cacheEls() {
  const ids = [
    'headerTitle','installBtn','homeTotal','homeMonthLabel','homeTxnCount','homeTopCategory','homeMetrics','homeLegend','homeInsights',
    'expenseForm','expenseId','expenseTitle','expenseAmount','expenseDate','expenseCategory','expensePaymentMethod','expenseCostType',
    'expenseRecurringFrequency','expensePeriodType','expenseNotes','recurringRow','formTitle','saveExpenseBtn','resetFormBtn',
    'openCategorySheetBtn','openCategorySheetSettingsBtn','recentList','clearEntryFiltersBtn','searchInput','filterMonth','filterSort',
    'filterDateStart','filterDateEnd','filterCategory','filterPaymentMethod','filterCostType','filterFrequency','filterPeriodType',
    'filterGroup','entriesHeading','entriesList','clearChartFiltersBtn','chartMonth','chartCompareWindow','chartCategory','chartPaymentMethod',
    'chartCostType','chartFrequency','chartDateStart','chartDateEnd','chartPeriodType','chartSummaryPill','chartLegend','chartInsights',
    'openCategorySheetSettingsBtn','categorySheet','categorySheetTitle','categoryForm','categoryId','categoryName','categoryColor','categoryList',
    'settingsCategoryList','entrySheet','entrySheetTitle','entrySheetBody','entryEditBtn','entryDuplicateBtn','entryDeleteBtn',
    'exportBtn','importInput','storageStatus','resetDataBtn','toast'
  ];
  ids.forEach((id) => el[id] = document.getElementById(id));
  el.tabs = [...document.querySelectorAll('.tab')];
  el.navBtns = [...document.querySelectorAll('.nav-btn')];
  el.costSegments = [...document.querySelectorAll('#costTypeSegment .segment')];
  el.periodSegments = [...document.querySelectorAll('#periodSegment .segment, #periodSegmentSingle .segment')];
  el.sheetCloseBtns = [...document.querySelectorAll('[data-close-sheet]')];
  el.homeTrendChart = document.getElementById('homeTrendChart');
  el.homeDonutChart = document.getElementById('homeDonutChart');
  el.chartDonut = document.getElementById('chartDonut');
  el.chartLine = document.getElementById('chartLine');
  el.chartBar = document.getElementById('chartBar');
  el.chartStack = document.getElementById('chartStack');
  el.chartPayment = document.getElementById('chartPayment');
}

function bindEvents() {
  el.navBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tabTarget)));
  el.expenseForm.addEventListener('submit', saveExpense);
  el.resetFormBtn.addEventListener('click', resetForm);
  el.costSegments.forEach((btn) => btn.addEventListener('click', () => setCostType(btn.dataset.costType)));
  el.periodSegments.forEach((btn) => btn.addEventListener('click', () => setPeriodType(btn.dataset.periodType)));
  el.openCategorySheetBtn.addEventListener('click', () => openSheet('categorySheet'));
  el.openCategorySheetSettingsBtn.addEventListener('click', () => openSheet('categorySheet'));
  el.categoryForm.addEventListener('submit', saveCategory);
  el.sheetCloseBtns.forEach((btn) => btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet)));
  [
    el.searchInput, el.filterMonth, el.filterSort, el.filterDateStart, el.filterDateEnd, el.filterCategory, el.filterPaymentMethod,
    el.filterCostType, el.filterFrequency, el.filterPeriodType, el.filterGroup,
    el.chartMonth, el.chartCompareWindow, el.chartCategory, el.chartPaymentMethod, el.chartCostType, el.chartFrequency,
    el.chartDateStart, el.chartDateEnd, el.chartPeriodType
  ].forEach((node) => node.addEventListener('input', renderAll));
  el.clearEntryFiltersBtn.addEventListener('click', resetEntryFilters);
  el.clearChartFiltersBtn.addEventListener('click', resetChartFilters);
  el.entryEditBtn.addEventListener('click', editFromSheet);
  el.entryDuplicateBtn.addEventListener('click', duplicateFromSheet);
  el.entryDeleteBtn.addEventListener('click', deleteFromSheet);
  el.exportBtn.addEventListener('click', exportBackup);
  el.importInput.addEventListener('change', importBackup);
  el.resetDataBtn.addEventListener('click', resetAllData);
  window.addEventListener('resize', () => { if (state.activeTab === 'home') renderHome(); if (state.activeTab === 'charts') renderCharts(); });
}

function initStaticFilters() {
  const months = buildMonthOptions();
  fillSelect(el.filterMonth, [{ value: 'all', label: 'All months' }, ...months]);
  fillSelect(el.chartMonth, [{ value: 'all', label: 'All months' }, ...months]);
  el.filterMonth.value = currentMonthKey();
  el.chartMonth.value = 'all';
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    state.data = normalizeState(parsed);
  } catch (err) {
    toast('Could not load local data.');
  }
}

function normalizeState(input) {
  const clean = initState();
  if (Array.isArray(input.categories) && input.categories.length) {
    clean.categories = input.categories.map((c) => ({
      id: c.id || uid('cat'), name: String(c.name || 'Category'), color: c.color || '#7c5cff', system: !!c.system, createdAt: c.createdAt || new Date().toISOString()
    }));
  }
  if (Array.isArray(input.paymentMethods) && input.paymentMethods.length) {
    clean.paymentMethods = input.paymentMethods.map((m) => ({ id: m.id || uid('pay'), name: String(m.name || 'Method') }));
  }
  if (Array.isArray(input.expenses)) {
    clean.expenses = input.expenses.map((x) => ({
      id: x.id || uid('exp'),
      title: String(x.title || ''),
      amount: Number(x.amount || 0),
      date: x.date || dateInput(TODAY),
      categoryId: clean.categories.some((c) => c.id === x.categoryId) ? x.categoryId : clean.categories[0].id,
      paymentMethodId: clean.paymentMethods.some((m) => m.id === x.paymentMethodId) ? x.paymentMethodId : clean.paymentMethods[0].id,
      costType: x.costType === 'recurring' ? 'recurring' : 'one-time',
      recurringFrequency: ['weekly','monthly','yearly'].includes(x.recurringFrequency) ? x.recurringFrequency : 'monthly',
      notes: String(x.notes || ''),
      periodType: x.periodType === 'yearly' ? 'yearly' : 'monthly',
      createdAt: x.createdAt || new Date().toISOString(),
      updatedAt: x.updatedAt || new Date().toISOString(),
    }));
  }
  return clean;
}

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }

function renderAll() {
  persist();
  fillDynamicSelects();
  renderHome();
  renderRecent();
  renderEntries();
  renderCharts();
  renderCategories();
  renderStorage();
}

function fillDynamicSelects() {
  const cats = state.data.categories.map((c) => ({ value: c.id, label: c.name }));
  const methods = state.data.paymentMethods.map((m) => ({ value: m.id, label: m.name }));
  preserveSelect(el.expenseCategory, cats, cats[0]?.value || '');
  preserveSelect(el.expensePaymentMethod, methods, methods[0]?.value || '');
  preserveSelect(el.filterCategory, [{ value: 'all', label: 'All categories' }, ...cats], 'all');
  preserveSelect(el.filterPaymentMethod, [{ value: 'all', label: 'All payment methods' }, ...methods], 'all');
  preserveSelect(el.chartCategory, [{ value: 'all', label: 'All categories' }, ...cats], 'all');
  preserveSelect(el.chartPaymentMethod, [{ value: 'all', label: 'All payment methods' }, ...methods], 'all');
}

function renderHome() {
  const monthKey = currentMonthKey();
  const entries = state.data.expenses.filter((e) => monthKeyFromDate(e.date) === monthKey);
  const total = sum(entries);
  const recurring = sum(entries.filter((e) => e.costType === 'recurring'));
  const oneTime = total - recurring;
  const biggest = entries.slice().sort((a,b) => b.amount - a.amount)[0];
  const avg = entries.length ? total / entries.length : 0;
  const cats = aggregateByCategory(entries);
  const methods = aggregateByPayment(entries);
  const trend = buildMonthlyTrend(state.data.expenses, 6);

  el.headerTitle.textContent = cap(state.activeTab);
  el.homeMonthLabel.textContent = fmtMonth.format(parseMonthKey(monthKey));
  el.homeTotal.textContent = money(total);
  el.homeTxnCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  el.homeTopCategory.textContent = cats[0] ? cats[0].name : 'No category yet';

  const metrics = [
    ['Recurring total', money(recurring)],
    ['One-time total', money(oneTime)],
    ['Average spend', money(avg)],
    ['Biggest expense', biggest ? money(biggest.amount) : '—'],
    ['Top payment', methods[0] ? methods[0].name : '—'],
    ['Top category', cats[0] ? cats[0].name : '—'],
  ];
  el.homeMetrics.innerHTML = metrics.map(([label, value]) => `<div class="metric"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join('');
  el.homeLegend.innerHTML = cats.length ? cats.slice(0,6).map(legendItem).join('') : `<div class="empty">Add expenses to see the category mix.</div>`;
  el.homeInsights.innerHTML = homeInsights({ total, recurring, oneTime, biggest, avg, cats, trend }).map(insightItem).join('');
  drawDonut(el.homeDonutChart, cats);
  drawLine(el.homeTrendChart, trend, true);
}

function renderRecent() {
  const recent = state.data.expenses.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,8);
  el.recentList.innerHTML = recent.length ? recent.map((e) => {
    const c = getCategory(e.categoryId);
    return `<button class="ledger-row" type="button" data-edit-entry="${e.id}">
      <span class="entry-dot" style="background:${c.color}"></span>
      <div class="ledger-main">
        <div class="row-title">${esc(e.title)}</div>
        <div class="meta">
          <span class="chip">${esc(c.name)}</span>
          <span class="chip">${esc(shortDate(e.date))}</span>
          <span class="chip">${esc(getPaymentName(e.paymentMethodId))}</span>
        </div>
      </div>
      <div class="row-amount">${money(e.amount)}</div>
    </button>`;
  }).join('') : `<div class="empty">Your latest saved expenses appear here.</div>`;
  [...el.recentList.querySelectorAll('[data-edit-entry]')].forEach((btn) => btn.addEventListener('click', () => beginEdit(btn.dataset.editEntry)));
}

function renderEntries() {
  const rows = filteredEntries(entryFilters());
  el.entriesHeading.textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`;
  if (!rows.length) {
    el.entriesList.innerHTML = `<div class="empty">No entries match these filters.</div>`;
    return;
  }
  const groups = el.filterGroup.value === 'month' ? groupByMonth(rows) : [{ key: 'all', items: rows }];
  el.entriesList.innerHTML = groups.map((group) => {
    const label = group.key === 'all' ? '' : `<div class="month-head">${esc(fmtMonth.format(parseMonthKey(group.key)))}</div>`;
    const items = group.items.map(entryRow).join('');
    return `<div class="ledger-month">${label}${items}</div>`;
  }).join('');
  [...el.entriesList.querySelectorAll('[data-entry-open]')].forEach((btn) => btn.addEventListener('click', () => openEntrySheet(btn.dataset.entryOpen)));
}

function entryRow(e) {
  const c = getCategory(e.categoryId);
  return `<button class="ledger-row" type="button" data-entry-open="${e.id}">
    <span class="entry-dot" style="background:${c.color}"></span>
    <div class="ledger-main">
      <div class="row-title">${esc(e.title)}</div>
      <div class="meta">
        <span class="chip" style="border:1px solid ${c.color}55;color:${c.color}">${esc(c.name)}</span>
        <span class="chip">${esc(shortDate(e.date))}</span>
        <span class="chip">${esc(getPaymentName(e.paymentMethodId))}</span>
        <span class="chip">${esc(e.costType === 'recurring' ? e.recurringFrequency : 'one-time')}</span>
        <span class="chip">${esc(e.periodType)}</span>
      </div>
    </div>
    <div class="row-amount">${money(e.amount)}</div>
  </button>`;
}

function renderCharts() {
  const filters = chartFilters();
  const rows = filteredEntries(filters);
  const cats = aggregateByCategory(rows);
  const methods = aggregateByPayment(rows);
  const trend = buildMonthlyTrend(rows, compareWindow(filters.compareWindow));
  const stack = buildRecurringTrend(rows, compareWindow(filters.compareWindow));
  const total = sum(rows);
  el.chartSummaryPill.textContent = rows.length ? `${rows.length} entries · ${money(total)}` : 'No matching data';
  el.chartLegend.innerHTML = cats.length ? cats.slice(0,8).map(legendItem).join('') : `<div class="empty">No category data for the current filters.</div>`;
  el.chartInsights.innerHTML = chartInsights({ rows, cats, methods, trend, stack, total }).map(insightItem).join('');
  drawDonut(el.chartDonut, cats);
  drawLine(el.chartLine, trend, false);
  drawBar(el.chartBar, cats.slice(0,8));
  drawStack(el.chartStack, stack);
  drawHorizontalBar(el.chartPayment, methods.slice(0,8));
}

function renderCategories() {
  const usage = usageMap();
  const markup = state.data.categories.map((c) => `
    <div class="category-item">
      <div class="legend-item" style="padding:0;border:0;background:none;">
        <span class="category-dot" style="background:${c.color}"></span>
        <div><div class="legend-name">${esc(c.name)}</div><div class="legend-meta">${usage.get(c.id) || 0} entries</div></div>
      </div>
      <div class="button-row top-gap">
        <button class="button secondary small" data-category-edit="${c.id}" type="button">Edit</button>
        <button class="button danger small" data-category-delete="${c.id}" type="button" ${usage.get(c.id) ? 'disabled' : ''}>Delete</button>
      </div>
    </div>`).join('');
  el.categoryList.innerHTML = markup || `<div class="empty">No categories.</div>`;
  el.settingsCategoryList.innerHTML = markup || `<div class="empty">No categories.</div>`;
  [...document.querySelectorAll('[data-category-edit]')].forEach((btn) => btn.addEventListener('click', () => loadCategory(btn.dataset.categoryEdit)));
  [...document.querySelectorAll('[data-category-delete]')].forEach((btn) => btn.addEventListener('click', () => removeCategory(btn.dataset.categoryDelete)));
}

function renderStorage() {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  const sizeKB = (new Blob([raw]).size / 1024).toFixed(1);
  el.storageStatus.innerHTML = `Entries: <strong>${state.data.expenses.length}</strong><br>Categories: <strong>${state.data.categories.length}</strong><br>Storage used: <strong>${sizeKB} KB</strong>`;
}

function saveExpense(ev) {
  ev.preventDefault();
  const title = el.expenseTitle.value.trim();
  const amount = Number(el.expenseAmount.value);
  const date = el.expenseDate.value;
  if (!title || !amount || amount <= 0 || !date) {
    toast('Add a title, amount, and date.');
    return;
  }
  const payload = {
    id: el.expenseId.value || uid('exp'),
    title,
    amount: round(amount),
    date,
    categoryId: el.expenseCategory.value,
    paymentMethodId: el.expensePaymentMethod.value,
    costType: el.expenseCostType.value,
    recurringFrequency: el.expenseCostType.value === 'recurring' ? el.expenseRecurringFrequency.value : 'monthly',
    notes: el.expenseNotes.value.trim(),
    periodType: el.expensePeriodType.value,
    createdAt: el.expenseId.value ? (state.data.expenses.find((x) => x.id === el.expenseId.value)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const idx = state.data.expenses.findIndex((x) => x.id === payload.id);
  if (idx >= 0) {
    state.data.expenses.splice(idx, 1, payload);
    toast('Entry updated.');
  } else {
    state.data.expenses.unshift(payload);
    toast('Entry saved.');
  }
  resetForm();
  renderAll();
  switchTab('entries');
}

function resetForm() {
  el.expenseForm.reset();
  el.expenseId.value = '';
  el.expenseDate.value = dateInput(TODAY);
  el.formTitle.textContent = 'Add expense';
  el.saveExpenseBtn.textContent = 'Save expense';
  setCostType('one-time');
  setPeriodType('monthly');
}

function beginEdit(id) {
  const e = state.data.expenses.find((x) => x.id === id);
  if (!e) return;
  el.expenseId.value = e.id;
  el.expenseTitle.value = e.title;
  el.expenseAmount.value = e.amount;
  el.expenseDate.value = e.date;
  el.expenseCategory.value = e.categoryId;
  el.expensePaymentMethod.value = e.paymentMethodId;
  el.expenseNotes.value = e.notes || '';
  setCostType(e.costType);
  setPeriodType(e.periodType);
  el.expenseRecurringFrequency.value = e.recurringFrequency || 'monthly';
  el.formTitle.textContent = 'Edit expense';
  el.saveExpenseBtn.textContent = 'Update expense';
  switchTab('add');
  closeSheet('entrySheet');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setCostType(type) {
  el.expenseCostType.value = type;
  el.costSegments.forEach((btn) => btn.classList.toggle('active', btn.dataset.costType === type));
  el.recurringRow.classList.toggle('hidden', type !== 'recurring');
}

function setPeriodType(type) {
  el.expensePeriodType.value = type;
  el.periodSegments.forEach((btn) => btn.classList.toggle('active', btn.dataset.periodType === type));
}

function saveCategory(ev) {
  ev.preventDefault();
  const name = el.categoryName.value.trim();
  const color = el.categoryColor.value;
  if (!name) return toast('Category name is required.');
  const dup = state.data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== el.categoryId.value);
  if (dup) return toast('Category name already exists.');
  if (el.categoryId.value) {
    const c = getCategory(el.categoryId.value);
    c.name = name; c.color = color;
    toast('Category updated.');
  } else {
    state.data.categories.push({ id: uid('cat'), name, color, system: false, createdAt: new Date().toISOString() });
    toast('Category added.');
  }
  el.categoryForm.reset();
  el.categoryId.value = '';
  el.categoryColor.value = '#7c5cff';
  el.categorySheetTitle.textContent = 'Add category';
  renderAll();
}

function loadCategory(id) {
  const c = getCategory(id);
  if (!c) return;
  el.categoryId.value = c.id;
  el.categoryName.value = c.name;
  el.categoryColor.value = c.color;
  el.categorySheetTitle.textContent = 'Edit category';
  openSheet('categorySheet');
}

function removeCategory(id) {
  if ((usageMap().get(id) || 0) > 0) return toast('Delete or recategorize entries first.');
  state.data.categories = state.data.categories.filter((c) => c.id !== id);
  renderAll();
  toast('Category removed.');
}

function openEntrySheet(id) {
  const e = state.data.expenses.find((x) => x.id === id);
  if (!e) return;
  const c = getCategory(e.categoryId);
  state.entrySheetId = id;
  el.entrySheetTitle.textContent = e.title;
  el.entrySheetBody.innerHTML = [
    detail('Amount', money(e.amount)),
    detail('Date', shortDate(e.date)),
    detail('Category', esc(c.name)),
    detail('Payment method', esc(getPaymentName(e.paymentMethodId))),
    detail('Cost type', esc(e.costType === 'recurring' ? `Recurring · ${e.recurringFrequency}` : 'One-time')),
    detail('Period', esc(e.periodType)),
    detail('Notes', e.notes ? esc(e.notes) : '—')
  ].join('');
  openSheet('entrySheet');
}

function detail(label, value) { return `<div class="detail-row"><span class="detail-label">${label}</span><span>${value}</span></div>`; }
function editFromSheet() { if (state.entrySheetId) beginEdit(state.entrySheetId); }
function duplicateFromSheet() {
  const source = state.data.expenses.find((x) => x.id === state.entrySheetId); if (!source) return;
  state.data.expenses.unshift({ ...source, id: uid('exp'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  closeSheet('entrySheet'); renderAll(); toast('Entry duplicated.');
}
function deleteFromSheet() {
  if (!state.entrySheetId) return;
  state.data.expenses = state.data.expenses.filter((x) => x.id !== state.entrySheetId);
  closeSheet('entrySheet'); renderAll(); toast('Entry deleted.');
}

function entryFilters() {
  return {
    search: el.searchInput.value.trim().toLowerCase(), month: el.filterMonth.value, sort: el.filterSort.value,
    startDate: el.filterDateStart.value, endDate: el.filterDateEnd.value, categoryId: el.filterCategory.value,
    paymentMethodId: el.filterPaymentMethod.value, costType: el.filterCostType.value, recurringFrequency: el.filterFrequency.value,
    periodType: el.filterPeriodType.value
  };
}
function chartFilters() {
  return {
    search: '', month: el.chartMonth.value, sort: 'date-asc', startDate: el.chartDateStart.value, endDate: el.chartDateEnd.value,
    categoryId: el.chartCategory.value, paymentMethodId: el.chartPaymentMethod.value, costType: el.chartCostType.value,
    recurringFrequency: el.chartFrequency.value, periodType: el.chartPeriodType.value, compareWindow: el.chartCompareWindow.value
  };
}

function filteredEntries(filters) {
  const rows = state.data.expenses.filter((e) => {
    if (filters.search && !(e.title.toLowerCase().includes(filters.search) || e.notes.toLowerCase().includes(filters.search))) return false;
    if (filters.month !== 'all' && monthKeyFromDate(e.date) !== filters.month) return false;
    if (filters.startDate && e.date < filters.startDate) return false;
    if (filters.endDate && e.date > filters.endDate) return false;
    if (filters.categoryId !== 'all' && e.categoryId !== filters.categoryId) return false;
    if (filters.paymentMethodId !== 'all' && e.paymentMethodId !== filters.paymentMethodId) return false;
    if (filters.costType !== 'all' && e.costType !== filters.costType) return false;
    if (filters.recurringFrequency !== 'all' && e.recurringFrequency !== filters.recurringFrequency) return false;
    if (filters.periodType !== 'all' && e.periodType !== filters.periodType) return false;
    return true;
  });
  return rows.sort((a,b) => {
    switch (filters.sort) {
      case 'date-asc': return a.date.localeCompare(b.date);
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc': return a.amount - b.amount;
      case 'created-desc': return new Date(b.createdAt) - new Date(a.createdAt);
      default: return b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt);
    }
  });
}

function resetEntryFilters() {
  el.searchInput.value = '';
  el.filterMonth.value = currentMonthKey();
  el.filterSort.value = 'date-desc';
  el.filterDateStart.value = '';
  el.filterDateEnd.value = '';
  el.filterCategory.value = 'all';
  el.filterPaymentMethod.value = 'all';
  el.filterCostType.value = 'all';
  el.filterFrequency.value = 'all';
  el.filterPeriodType.value = 'all';
  el.filterGroup.value = 'month';
  renderAll();
}
function resetChartFilters() {
  el.chartMonth.value = 'all';
  el.chartCompareWindow.value = '3';
  el.chartCategory.value = 'all';
  el.chartPaymentMethod.value = 'all';
  el.chartCostType.value = 'all';
  el.chartFrequency.value = 'all';
  el.chartDateStart.value = '';
  el.chartDateEnd.value = '';
  el.chartPeriodType.value = 'all';
  renderAll();
}

function groupByMonth(rows) {
  const map = new Map();
  rows.forEach((e) => {
    const key = monthKeyFromDate(e.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

function aggregateByCategory(rows) {
  const total = sum(rows);
  const map = new Map();
  rows.forEach((e) => {
    const c = getCategory(e.categoryId);
    if (!map.has(c.id)) map.set(c.id, { id: c.id, name: c.name, color: c.color, total: 0 });
    map.get(c.id).total += e.amount;
  });
  return [...map.values()].sort((a,b) => b.total - a.total).map((item) => ({ ...item, share: total ? Math.round(item.total / total * 100) : 0 }));
}

function aggregateByPayment(rows) {
  const colors = ['#7c5cff','#2ec5ff','#2fd1a2','#f59e0b','#ff8a65','#f472b6','#94a3b8'];
  const total = sum(rows); const map = new Map();
  rows.forEach((e) => {
    const name = getPaymentName(e.paymentMethodId);
    if (!map.has(name)) map.set(name, { name, color: colors[map.size % colors.length], total: 0 });
    map.get(name).total += e.amount;
  });
  return [...map.values()].sort((a,b) => b.total - a.total).map((item) => ({ ...item, share: total ? Math.round(item.total / total * 100) : 0 }));
}

function buildMonthlyTrend(rows, count) {
  const start = new Date(TODAY.getFullYear(), TODAY.getMonth() - (count - 1), 1);
  const points = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = monthKeyFromDate(d);
    const value = round(rows.filter((e) => monthKeyFromDate(e.date) === key).reduce((s, e) => s + e.amount, 0));
    points.push({ key, label: shortMonth(d), value });
  }
  return points;
}

function buildRecurringTrend(rows, count) {
  const trend = buildMonthlyTrend(rows, count);
  return trend.map((m) => {
    const monthRows = rows.filter((e) => monthKeyFromDate(e.date) === m.key);
    return {
      label: m.label,
      recurring: round(monthRows.filter((e) => e.costType === 'recurring').reduce((s, e) => s + e.amount, 0)),
      oneTime: round(monthRows.filter((e) => e.costType === 'one-time').reduce((s, e) => s + e.amount, 0)),
    };
  });
}

function homeInsights({ total, recurring, oneTime, biggest, avg, cats, trend }) {
  const last = trend.at(-1)?.value || 0; const prev = trend.at(-2)?.value || 0;
  return [
    { icon: '◎', text: cats[0] ? `${cats[0].name} leads this month at ${money(cats[0].total)}.` : 'Start adding expenses to unlock insights.' },
    { icon: '↕', text: prev ? `You are ${last >= prev ? 'up' : 'down'} ${money(Math.abs(last - prev))} versus last month.` : `Average spend is ${money(avg)} per entry.` },
    { icon: '◆', text: biggest ? `Largest transaction is ${biggest.title} at ${money(biggest.amount)}.` : 'Largest transaction will appear here.' },
    { icon: '◌', text: total ? `Recurring accounts for ${Math.round(recurring / Math.max(total, 1) * 100)}% of this month.` : 'No spending recorded this month yet.' },
    { icon: '⋯', text: oneTime > recurring ? 'One-time purchases are driving spend right now.' : 'Recurring costs are the main driver right now.' },
  ];
}

function chartInsights({ rows, cats, methods, trend, total }) {
  const recurring = sum(rows.filter((e) => e.costType === 'recurring'));
  const oneTime = total - recurring;
  const peak = trend.slice().sort((a,b) => b.value - a.value)[0];
  return [
    { icon: '◔', text: cats[0] ? `${cats[0].name} is the largest category at ${money(cats[0].total)}.` : 'No category trend available for these filters.' },
    { icon: '▣', text: methods[0] ? `${methods[0].name} is the top payment method by spend.` : 'No payment method data yet.' },
    { icon: '↗', text: peak ? `Peak month in this window is ${peak.label} at ${money(peak.value)}.` : 'Add more entries to compare months.' },
    { icon: '◫', text: total ? `Recurring is ${money(recurring)} and one-time is ${money(oneTime)} in this filtered view.` : 'Filtered charts will update as soon as data exists.' },
  ];
}

function legendItem(item) {
  return `<div class="legend-item"><span class="swatch" style="background:${item.color}"></span><div><div class="legend-name">${esc(item.name)}</div><div class="legend-meta">${money(item.total)} · ${item.share}%</div></div></div>`;
}
function insightItem(item) { return `<div class="insight"><strong style="margin-right:8px;">${item.icon}</strong>${esc(item.text)}</div>`; }

function drawDonut(canvas, items) {
  const ctx = prepCanvas(canvas); const w = canvas._cssW; const h = canvas._cssH; ctx.clearRect(0,0,w,h);
  if (!items.length) return emptyChart(ctx,w,h,'No data');
  const total = items.reduce((s,i) => s + i.total, 0); const cx = w/2, cy = h/2, r = Math.min(w,h)*0.33, inner = r*0.62;
  let angle = -Math.PI/2;
  items.forEach((item) => {
    const slice = item.total / total * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,angle,angle+slice); ctx.closePath(); ctx.fillStyle = item.color; ctx.fill(); angle += slice;
  });
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f5f7fb'; ctx.textAlign='center'; ctx.font='12px -apple-system'; ctx.fillText('Total', cx, cy - 8); ctx.font='700 20px -apple-system'; ctx.fillText(compactMoney(total), cx, cy + 18);
}

function drawLine(canvas, points, area) {
  const ctx = prepCanvas(canvas); const w = canvas._cssW; const h = canvas._cssH; ctx.clearRect(0,0,w,h);
  if (!points.length || points.every((p) => p.value === 0)) return emptyChart(ctx,w,h,'No trend data');
  const pad = { t: 18, r: 10, b: 28, l: 10 }; const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b; const max = Math.max(...points.map((p) => p.value), 1);
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  for (let i=0;i<4;i++) { const y = pad.t + (ch/3) * i; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
  const mapped = points.map((p,i) => ({ x: pad.l + (cw / Math.max(points.length - 1,1)) * i, y: pad.t + ch - (p.value / max) * ch, label: p.label }));
  if (area) {
    const grad = ctx.createLinearGradient(0,pad.t,0,h-pad.b); grad.addColorStop(0,'rgba(124,92,255,.28)'); grad.addColorStop(1,'rgba(46,197,255,.02)');
    ctx.beginPath(); ctx.moveTo(mapped[0].x, h-pad.b); mapped.forEach((p) => ctx.lineTo(p.x,p.y)); ctx.lineTo(mapped.at(-1).x,h-pad.b); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  }
  ctx.beginPath(); mapped.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#2ec5ff'; mapped.forEach((p) => { ctx.beginPath(); ctx.arc(p.x,p.y,3.5,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle = '#98a2b3'; ctx.font='11px -apple-system'; ctx.textAlign='center'; mapped.forEach((p) => ctx.fillText(p.label, p.x, h - 10));
}

function drawBar(canvas, items) {
  const ctx = prepCanvas(canvas); const w = canvas._cssW; const h = canvas._cssH; ctx.clearRect(0,0,w,h);
  if (!items.length) return emptyChart(ctx,w,h,'No category data');
  const pad = { t: 16, r: 10, b: 34, l: 10 }; const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b; const max = Math.max(...items.map((i) => i.total), 1); const slot = cw / items.length; const bw = slot * 0.62;
  items.forEach((item,i) => {
    const x = pad.l + slot*i + (slot-bw)/2; const bh = item.total / max * ch; const y = pad.t + ch - bh;
    roundedRect(ctx,x,y,bw,bh,10,item.color); ctx.fillStyle = '#98a2b3'; ctx.font='11px -apple-system'; ctx.textAlign='center'; ctx.fillText(trim(item.name,8), x+bw/2, h-10);
  });
}

function drawHorizontalBar(canvas, items) {
  const ctx = prepCanvas(canvas); const w = canvas._cssW; const h = canvas._cssH; ctx.clearRect(0,0,w,h);
  if (!items.length) return emptyChart(ctx,w,h,'No payment method data');
  const pad = { t: 14, r: 12, b: 8, l: 98 }; const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b; const max = Math.max(...items.map((i) => i.total), 1); const row = ch / items.length;
  items.forEach((item,i) => {
    const y = pad.t + row*i + 6; const barH = Math.max(row - 12, 12); const barW = item.total / max * cw;
    roundedRect(ctx,pad.l,y,barW,barH,10,item.color); ctx.fillStyle='#dce4f1'; ctx.font='12px -apple-system'; ctx.textAlign='left'; ctx.fillText(trim(item.name,13), 8, y + barH * 0.72); ctx.textAlign='right'; ctx.fillText(compactMoney(item.total), w - 4, y + barH * 0.72);
  });
}

function drawStack(canvas, items) {
  const ctx = prepCanvas(canvas); const w = canvas._cssW; const h = canvas._cssH; ctx.clearRect(0,0,w,h);
  if (!items.length || items.every((i) => i.recurring === 0 && i.oneTime === 0)) return emptyChart(ctx,w,h,'No comparison data');
  const pad = { t: 16, r: 10, b: 34, l: 10 }; const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b; const max = Math.max(...items.map((i) => i.recurring + i.oneTime),1); const slot = cw / items.length; const bw = slot * 0.62;
  items.forEach((item,i) => {
    const x = pad.l + slot*i + (slot-bw)/2; const h1 = item.oneTime / max * ch; const h2 = item.recurring / max * ch; const base = pad.t + ch;
    roundedRect(ctx,x,base-h1,bw,h1,10,'#2ec5ff'); roundedRect(ctx,x,base-h1-h2,bw,h2,10,'#7c5cff');
    ctx.fillStyle='#98a2b3'; ctx.font='11px -apple-system'; ctx.textAlign='center'; ctx.fillText(item.label, x+bw/2, h-10);
  });
}

function prepCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement.getBoundingClientRect();
  const cssW = Math.max(Math.floor(parent.width - 4), 120);
  const cssH = canvas.parentElement.classList.contains('donut-card') ? 260 : (canvas.parentElement.classList.contains('tall') ? 220 : 200);
  canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
  canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
  canvas._cssW = cssW; canvas._cssH = cssH;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); return ctx;
}

function roundedRect(ctx,x,y,w,h,r,color) { if (w <= 0 || h <= 0) return; ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
function emptyChart(ctx,w,h,text) { ctx.fillStyle='rgba(255,255,255,.04)'; roundedRect(ctx,8,8,w-16,h-16,16,'rgba(255,255,255,.04)'); ctx.fillStyle='#98a2b3'; ctx.textAlign='center'; ctx.font='13px -apple-system'; ctx.fillText(text, w/2, h/2); }

function fillSelect(select, options) { select.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join(''); }
function preserveSelect(select, options, fallback) { const cur = select.value; fillSelect(select, options); select.value = options.some((o) => o.value === cur) ? cur : fallback; }
function buildMonthOptions() { const start = new Date(TODAY.getFullYear() - 1, TODAY.getMonth(), 1); const out = []; for (let i=0;i<24;i++) { const d = new Date(start.getFullYear(), start.getMonth() + i, 1); out.push({ value: monthKeyFromDate(d), label: fmtMonth.format(d) }); } return out.reverse(); }
function usageMap() { const map = new Map(state.data.categories.map((c) => [c.id, 0])); state.data.expenses.forEach((e) => map.set(e.categoryId, (map.get(e.categoryId) || 0) + 1)); return map; }
function getCategory(id) { return state.data.categories.find((c) => c.id === id) || state.data.categories[0]; }
function getPaymentName(id) { return state.data.paymentMethods.find((m) => m.id === id)?.name || 'Payment'; }
function money(v) { return fmtCurrency.format(v || 0); }
function compactMoney(v) { return v >= 1000 ? `$${(v/1000).toFixed(1)}k` : money(v); }
function sum(rows) { return round(rows.reduce((s,e) => s + Number(e.amount || 0), 0)); }
function round(n) { return Math.round(n * 100) / 100; }
function monthKeyFromDate(input) { const d = typeof input === 'string' ? new Date(`${input}T00:00:00`) : input; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function currentMonthKey() { return monthKeyFromDate(TODAY); }
function parseMonthKey(key) { const [y,m] = key.split('-').map(Number); return new Date(y, m-1, 1); }
function shortMonth(d) { return new Intl.DateTimeFormat('en-CA', { month: 'short' }).format(d); }
function shortDate(d) { return fmtShortDate.format(new Date(`${d}T00:00:00`)); }
function dateInput(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function compareWindow(v) { return v === 'year' ? 12 : Number(v || 3); }
function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`; }
function trim(s, n) { return s.length > n ? `${s.slice(0, n-1)}…` : s; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function switchTab(tab) { state.activeTab = tab; el.tabs.forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); el.navBtns.forEach((x) => x.classList.toggle('active', x.dataset.tabTarget === tab)); el.headerTitle.textContent = cap(tab); if (tab === 'home') renderHome(); if (tab === 'charts') renderCharts(); }
function openSheet(id) { document.getElementById(id).classList.remove('hidden'); }
function closeSheet(id) { document.getElementById(id).classList.add('hidden'); if (id === 'entrySheet') state.entrySheetId = null; }
function toast(msg) { el.toast.textContent = msg; el.toast.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => el.toast.classList.add('hidden'), 2200); }

function exportBackup() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `north-ledger-backup-${dateInput(TODAY)}.json`; a.click(); URL.revokeObjectURL(url); toast('Backup exported.');
}
function importBackup(ev) {
  const file = ev.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { state.data = normalizeState(JSON.parse(reader.result)); renderAll(); toast('Backup imported.'); } catch { toast('Import failed.'); } finally { el.importInput.value = ''; } };
  reader.readAsText(file);
}
function resetAllData() { if (!confirm('Reset all local budgeting data on this device?')) return; state.data = initState(); resetForm(); resetEntryFilters(); resetChartFilters(); renderAll(); toast('All data reset.'); }

function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredInstallPrompt = e; el.installBtn.classList.remove('hidden'); });
  el.installBtn.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return toast('Use Add to Home Screen from your browser menu on iPhone.');
    state.deferredInstallPrompt.prompt(); await state.deferredInstallPrompt.userChoice; state.deferredInstallPrompt = null; el.installBtn.classList.add('hidden');
  });
}
function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {}); }
