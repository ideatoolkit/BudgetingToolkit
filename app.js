const STORAGE_KEY = 'budget-flow-premium-v6';
const $ = id => document.getElementById(id);
const defaultCategories = [
  {name:'Home & Living', color:'#31d98c'},
  {name:'Pleasure', color:'#ff4d8d'},
  {name:'Subscriptions', color:'#5e8cff'},
  {name:'Online Purchases', color:'#f7b84b'}
];
const palette = ['#6d5efc','#31d98c','#ff4d8d','#f7b84b','#5e8cff','#25c7b6','#ff8a65','#c77dff','#9ccc65','#ff6b7b'];
const paymentMethods = ['Debit','Credit Card','Cash','Bank Transfer','Apple Pay','PayPal','Other'];
const state = { screen:'home', range:'1', chartType:'donut', editingId:null, data: loadData() };

if(!state.data.categories?.length) state.data.categories = [...defaultCategories];
if(state.data.monthlyIncome == null) state.data.monthlyIncome = '';
if(!state.data.entries?.length) state.data.entries = demoEntries();
upgradeData();
injectStyles();

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {entries:[], categories:[...defaultCategories], monthlyIncome:''}; }
  catch { return {entries:[], categories:[...defaultCategories], monthlyIncome:''}; }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }
function today(){ return new Date().toISOString().slice(0,10); }
function currentMonth(){ return new Date().toISOString().slice(0,7); }
function ym(d){ return d.slice(0,7); }
function shiftMonth(ymValue, delta){ const [y,m] = ymValue.split('-').map(Number); const d = new Date(y, m-1+delta, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(ymValue){ if(!ymValue) return ''; const [y,m] = ymValue.split('-').map(Number); return new Date(y,m-1,1).toLocaleString('en-CA',{month:'long', year:'numeric'}); }
function shortMonth(ymValue){ const [y,m] = ymValue.split('-').map(Number); return new Date(y,m-1,1).toLocaleString('en-CA',{month:'short'}); }
function prettyDate(d){ return new Date(d+'T12:00:00').toLocaleDateString('en-CA',{year:'numeric', month:'short', day:'numeric'}); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function formatMoney(value){ return `$${(Number(value)||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function sum(arr){ return arr.reduce((a,b)=> a + Number(b.amount ?? b.value ?? 0), 0); }
function pct(v,t){ return t ? `${Math.round((v/t)*100)}%` : '0%'; }
function getCategoryColor(name){ return state.data.categories.find(c=>c.name===name)?.color || '#6d5efc'; }
function groupBy(arr, fn){ return arr.reduce((acc,item)=>{ const k=fn(item); (acc[k] ||= []).push(item); return acc; }, {}); }
function normalize(){ return [...state.data.entries].sort((a,b)=> new Date(b.date)-new Date(a.date) || b.createdAt-a.createdAt); }

function parseCurrencyInput(value){
  const digits = String(value || '').replace(/\D/g,'');
  return digits ? Number(digits) / 100 : 0;
}
function formatCurrencyInput(value){
  const digits = String(value || '').replace(/\D/g,'');
  if(!digits) return '';
  return formatMoney(Number(digits) / 100);
}
function formatAmountField(){ $('amountInput').value = formatCurrencyInput($('amountInput').value); }

function loadLegacyData(){
  for(const key of ['budget-flow-premium-v4','budget-flow-premium-v3']){
    try{
      const raw = localStorage.getItem(key);
      if(raw && !localStorage.getItem(STORAGE_KEY)){
        localStorage.setItem(STORAGE_KEY, raw);
        state.data = JSON.parse(raw);
      }
    }catch{}
  }
}
loadLegacyData();

function upgradeData(){
  if(!Array.isArray(state.data.categories) || !state.data.categories.length) state.data.categories = [...defaultCategories];
  state.data.entries = (state.data.entries || []).map(e => ({
    id: e.id || crypto.randomUUID(),
    createdAt: e.createdAt || Date.now(),
    title: e.title || '',
    amount: Number(e.amount || 0),
    date: e.date || today(),
    category: e.category || state.data.categories[0].name,
    type: e.type || 'One-Time',
    frequency: e.type === 'Recurring' ? (e.frequency || 'Monthly') : '',
    payment: paymentMethods.includes(e.payment) ? e.payment : 'Debit',
    notes: e.notes || ''
  }));
  saveData();
}

function injectStyles(){
  const style = document.createElement('style');
  style.textContent = `
    .chart-large{height:300px!important}
    .donut-flex{grid-template-columns:1fr!important;gap:14px!important}
    .donut-box.small{height:220px!important;max-width:220px!important}
    .donut-box{height:220px!important}
    #chartVisualCard .legend{display:grid;grid-template-columns:1fr;gap:8px;max-height:320px;overflow:auto;padding-right:2px}
    #chartVisualCard .legend-row{padding:10px 12px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:rgba(255,255,255,.03)}
    .compact-group{margin-bottom:14px}
    .compact-group .group-title{margin-bottom:8px}
    .compact-list{display:grid;gap:8px}
    .compact-entry{position:relative;padding:11px 12px 11px 16px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.08);overflow:hidden}
    .compact-entry:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--row-color,#6d5efc)}
    .compact-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
    .compact-title{font-size:1rem;font-weight:800;letter-spacing:-.02em;min-width:0;word-break:break-word}
    .compact-amount{font-size:1.02rem;font-weight:800;letter-spacing:-.03em;white-space:nowrap}
    .compact-meta{display:flex;flex-wrap:wrap;gap:6px 10px;color:var(--muted);font-size:.77rem;margin-top:4px}
    .compact-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .compact-badge{font-size:.71rem;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06)}
    .compact-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
    .compact-actions button{padding:9px 11px}
    .chart-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .chart-metric{padding:11px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
    .chart-metric .k{font-size:.72rem;color:var(--muted)}
    .chart-metric .v{font-size:1.05rem;font-weight:800;margin-top:5px}
    .simple-breakdown{display:grid;gap:8px}
    .simple-breakdown .legend-row{padding:10px 0}
    .category-item{grid-template-columns:minmax(0,1fr)!important;gap:8px!important;padding:10px 12px!important}
    .category-actions{display:flex;gap:8px;flex-wrap:wrap}
    .category-actions button{width:auto;min-width:88px}
    .swatch-pill{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .line-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .line-legend .swatch-pill{font-size:.74rem;padding:7px 10px}
    #amountInput{font-variant-numeric:tabular-nums}
    @media (max-width:390px){
      .chart-summary{grid-template-columns:1fr}
      .chart-large{height:260px!important}
      .donut-box.small,.donut-box{height:200px!important;max-width:200px!important}
      .compact-head{grid-template-columns:1fr}
      .compact-amount{text-align:left}
    }
  `;
  document.head.appendChild(style);
}

function monthWindow(focus, range){
  const [fy,fm] = focus.split('-').map(Number);
  const end = new Date(fy, fm, 0);
  const start = range==='ytd' ? new Date(fy,0,1) : new Date(fy, fm-Number(range), 1);
  return {start,end};
}
function inWindow(entry,start,end){ const d = new Date(entry.date+'T12:00:00'); return d >= start && d <= end; }

function filteredEntries(opts={}){
  return normalize().filter(e => {
    if(opts.month && ym(e.date) !== opts.month) return false;
    if(opts.start && new Date(e.date+'T12:00:00') < new Date(opts.start+'-01T00:00:00')) return false;
    if(opts.end){ const [y,m] = opts.end.split('-').map(Number); if(new Date(e.date+'T12:00:00') > new Date(y,m,0,23,59,59)) return false; }
    if(opts.search && !e.title.toLowerCase().includes(opts.search.toLowerCase())) return false;
    if(opts.category && opts.category !== 'all' && e.category !== opts.category) return false;
    if(opts.payment && opts.payment !== 'all' && e.payment !== opts.payment) return false;
    if(opts.type && opts.type !== 'all' && e.type !== opts.type) return false;
    if(opts.frequency && opts.frequency !== 'all') {
      if(e.type !== 'Recurring') return false;
      if(e.frequency !== opts.frequency) return false;
    }
    return true;
  });
}

function aggregateBy(entries, group){
  const map = new Map();
  for(const e of entries){
    let key = 'Other';
    if(group === 'Category') key = e.category;
    else if(group === 'Payment Method') key = e.payment;
    else if(group === 'Cost Type') key = e.type;
    else if(group === 'Frequency') key = e.frequency || 'One-Time';
    else if(group === 'Month') key = ym(e.date);
    else if(group === 'Year') key = e.date.slice(0,4);
    map.set(key, (map.get(key)||0) + Number(e.amount || 0));
  }
  return [...map.entries()].map(([label,value],i)=>({
    label,
    value,
    color: group === 'Category' ? getCategoryColor(label) : palette[i % palette.length]
  }));
}

function sortEntries(list, mode){
  list.sort((a,b)=>{
    if(mode==='new') return new Date(b.date)-new Date(a.date) || b.createdAt-a.createdAt;
    if(mode==='old') return new Date(a.date)-new Date(b.date);
    if(mode==='high') return b.amount-a.amount;
    if(mode==='low') return a.amount-b.amount;
    if(mode==='title') return a.title.localeCompare(b.title);
    return 0;
  });
}

function fillSelectors(){
  const cats = ['all', ...state.data.categories.map(c=>c.name)];
  const setOpts = (id, values) => {
    const el = $(id); if(!el) return;
    const keep = el.value;
    el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v==='all' ? 'All' : v)}</option>`).join('');
    if(values.includes(keep)) el.value = keep;
  };
  setOpts('categoryInput', state.data.categories.map(c=>c.name));
  ['entryCategoryFilter','chartCategory'].forEach(id => setOpts(id, cats));
  ['paymentInput'].forEach(id => setOpts(id, paymentMethods));
  ['entryPaymentFilter','chartPayment'].forEach(id => setOpts(id, ['all', ...paymentMethods]));
  if(!$('chartCategory').value) $('chartCategory').value = 'all';
  if(!$('chartPayment').value) $('chartPayment').value = 'all';
}

function setScreen(name){
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.go === name));
}

function legendHtml(r){
  return `<div class="legend-row"><span class="dot" style="background:${r.color}"></span><div>${escapeHtml(r.label)}</div><strong class="mono">${formatMoney(r.value)}</strong></div>`;
}

function monthRange(startMonth, endMonth){
  if(!startMonth || !endMonth) return [];
  const months = [];
  let cursor = startMonth;
  let guard = 0;
  while(cursor <= endMonth && guard < 60){ months.push(cursor); cursor = shiftMonth(cursor, 1); guard += 1; }
  return months;
}

function monthlyCategorySeries(entries, startMonth, endMonth, limit=5){
  const months = monthRange(startMonth, endMonth);
  const catTotals = new Map();
  entries.forEach(e => catTotals.set(e.category, (catTotals.get(e.category) || 0) + Number(e.amount || 0)));
  const topCategories = [...catTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0, limit).map(([name])=>name);
  const series = topCategories.map(name => ({
    label: name,
    color: getCategoryColor(name),
    points: months.map(month => ({ label: month, value: 0 }))
  }));
  const indexMap = new Map(series.map(s => [s.label, s]));
  entries.forEach(e => {
    const month = ym(e.date);
    const target = indexMap.get(e.category);
    if(!target) return;
    const point = target.points.find(p => p.label === month);
    if(point) point.value += Number(e.amount || 0);
  });
  return { months, series: series.filter(s => s.points.some(p => p.value > 0)) };
}

function renderMultiLine(canvas, months, series){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 300, h = rect.height || 300;
  canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const pad = {l:36,r:18,t:18,b:42};
  const chartW = w-pad.l-pad.r, chartH = h-pad.t-pad.b;
  const allValues = series.flatMap(s => s.points.map(p => p.value));
  const max = Math.max(...allValues, 1);
  ctx.strokeStyle='rgba(255,255,255,.08)';
  for(let i=0;i<4;i++){ const y=pad.t+(chartH/3)*i; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
  months.forEach((m,i)=>{
    const x = pad.l + (chartW/Math.max(months.length-1,1))*i;
    ctx.fillStyle='rgba(255,255,255,.72)'; ctx.font='11px system-ui'; ctx.textAlign='center';
    ctx.fillText(shortMonth(m), x, h-16);
  });
  series.forEach(line => {
    ctx.beginPath(); ctx.strokeStyle = line.color; ctx.lineWidth = 2.5;
    line.points.forEach((point,i)=>{
      const x = pad.l + (chartW/Math.max(months.length-1,1))*i;
      const y = pad.t + chartH - (point.value/max)*chartH;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    ctx.stroke();
    line.points.forEach((point,i)=>{
      const x = pad.l + (chartW/Math.max(months.length-1,1))*i;
      const y = pad.t + chartH - (point.value/max)*chartH;
      ctx.fillStyle = line.color; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
  });
}

function renderDonut(canvas, data){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 280, h = rect.height || 280;
  canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 18, inner = r*0.58;
  const total = data.reduce((a,b)=>a+b.value,0);
  ctx.lineWidth = r-inner;
  if(!total){ ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.arc(cx,cy,(r+inner)/2,0,Math.PI*2); ctx.stroke(); return; }
  let start = -Math.PI/2;
  data.forEach(seg => {
    const angle = (seg.value/total) * Math.PI * 2;
    ctx.beginPath(); ctx.strokeStyle = seg.color; ctx.arc(cx,cy,(r+inner)/2,start,start+angle); ctx.stroke(); start += angle;
  });
}
function roundRect(ctx,x,y,w,h,r,color){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
function renderBar(canvas, data){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 300, h = rect.height || 300;
  canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const pad = {l:38,r:14,t:18,b:42};
  const max = Math.max(...data.map(d=>d.value),1);
  const chartW = w-pad.l-pad.r, chartH = h-pad.t-pad.b;
  const gap = 10; const barW = Math.max(16,(chartW-gap*Math.max(data.length-1,0))/Math.max(data.length,1));
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for(let i=0;i<4;i++){ const y = pad.t + (chartH/3)*i; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
  data.forEach((d,i)=>{
    const x = pad.l + i*(barW+gap), bh = (d.value/max)*chartH, y = pad.t + chartH - bh;
    roundRect(ctx,x,y,barW,bh,10,d.color);
    ctx.fillStyle='rgba(255,255,255,.72)'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.fillText((d.label||'').slice(0,9), x+barW/2, h-16);
  });
}
function renderLine(canvas, data){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 300, h = rect.height || 300;
  canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const pad = {l:30,r:12,t:18,b:42}; const max = Math.max(...data.map(d=>d.value),1); const chartW = w-pad.l-pad.r, chartH = h-pad.t-pad.b;
  ctx.strokeStyle='rgba(255,255,255,.08)'; for(let i=0;i<4;i++){ const y=pad.t+(chartH/3)*i; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
  if(!data.length) return;
  ctx.beginPath(); ctx.strokeStyle='#25c7b6'; ctx.lineWidth=3;
  data.forEach((d,i)=>{ const x=pad.l+(chartW/Math.max(data.length-1,1))*i; const y=pad.t+chartH-(d.value/max)*chartH; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.stroke();
  data.forEach((d,i)=>{ const x=pad.l+(chartW/Math.max(data.length-1,1))*i; const y=pad.t+chartH-(d.value/max)*chartH; ctx.fillStyle='#25c7b6'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.72)'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.fillText((d.label||'').slice(0,8), x, h-16); });
}

function recentEntryHtml(e){
  return `<div class="compact-entry" style="--row-color:${getCategoryColor(e.category)}"><div class="compact-head"><div class="compact-title">${escapeHtml(e.title)}</div><div class="compact-amount mono">${formatMoney(e.amount)}</div></div><div class="compact-meta"><span>${escapeHtml(prettyDate(e.date))}</span><span>${escapeHtml(e.category)}</span><span>${escapeHtml(e.payment)}</span></div></div>`;
}

function entryRowHtml(e){
  const freqText = e.type === 'Recurring' ? e.frequency : 'One-Time';
  const notes = e.notes ? `<div class="entry-sub" style="margin-top:8px">${escapeHtml(e.notes)}</div>` : '';
  return `<details class="compact-entry" style="--row-color:${getCategoryColor(e.category)}"><summary style="list-style:none;cursor:pointer"><div class="compact-head"><div class="compact-title">${escapeHtml(e.title)}</div><div class="compact-amount mono">${formatMoney(e.amount)}</div></div><div class="compact-meta"><span>${escapeHtml(prettyDate(e.date))}</span><span>${escapeHtml(e.payment)}</span><span>${escapeHtml(e.category)}</span></div><div class="compact-badges"><span class="compact-badge">${escapeHtml(e.type)}</span><span class="compact-badge">${escapeHtml(freqText)}</span></div></summary>${notes}<div class="compact-actions"><button class="secondary" onclick="editEntry('${e.id}')">Edit</button><button class="secondary" onclick="duplicateEntry('${e.id}')">Duplicate</button><button class="secondary" onclick="deleteEntry('${e.id}')">Delete</button></div></details>`;
}

function renderHome(){
  const focus = $('focusMonth').value || currentMonth();
  $('focusMonth').value = focus;
  $('heroMonthLabel').textContent = monthLabel(focus);
  $('focusMonthPretty').textContent = monthLabel(focus);
  const {start,end} = monthWindow(focus, state.range);
  const list = filteredEntries().filter(e=>inWindow(e,start,end));
  const total = sum(list);
  const recurring = list.filter(e=>e.type==='Recurring');
  const oneTime = list.filter(e=>e.type!=='Recurring');
  const monthsCount = state.range==='ytd' ? Number(focus.slice(5,7)) : Number(state.range);
  const income = Number(state.data.monthlyIncome || 0) * monthsCount;
  const catAgg = aggregateBy(list,'Category').sort((a,b)=>b.value-a.value);
  const trendAgg = aggregateBy(filteredEntries({start:(state.range==='ytd' ? focus.slice(0,4)+'-01' : shiftMonth(focus, -(monthsCount-1))), end:focus}),'Month').sort((a,b)=>a.label.localeCompare(b.label));

  $('heroRange').textContent = state.range==='ytd' ? 'YTD view' : `${state.range}M view`;
  $('heroAvailable').textContent = formatMoney(Math.max(income-total,0));
  $('heroSpent').textContent = formatMoney(total);
  $('heroBreakdown').textContent = `${recurring.length} recurring · ${oneTime.length} one-time`;
  $('totalSpend').textContent = formatMoney(total);
  $('avgSpend').textContent = formatMoney(monthsCount ? total/monthsCount : total);
  $('recSpend').textContent = formatMoney(sum(recurring));
  $('oneSpend').textContent = formatMoney(sum(oneTime));
  $('recSub').textContent = `${recurring.length} items`;
  $('oneSub').textContent = `${oneTime.length} items`;
  $('donutTotal').textContent = formatMoney(total);
  $('topCategoryPill').textContent = catAgg[0] ? `Top: ${catAgg[0].label}` : 'No data';
  renderDonut($('homeDonut'), catAgg);
  $('homeLegend').innerHTML = catAgg.length ? catAgg.slice(0,6).map(legendHtml).join('') : '<div class="empty">No spending yet.</div>';
  renderBar($('homeTrend'), trendAgg.map(r=>({label:shortMonth(r.label), value:r.value, color:'#6d5efc'})));
  $('topCategoryList').innerHTML = catAgg.length ? catAgg.slice(0,5).map(r => `<div class="compact-entry" style="--row-color:${r.color}"><div class="compact-head"><div class="compact-title">${escapeHtml(r.label)}</div><div class="compact-amount mono">${formatMoney(r.value)}</div></div><div class="compact-meta"><span>${pct(r.value,total)} of selected range</span></div></div>`).join('') : '<div class="empty">Add expenses to populate your dashboard.</div>';
}

function renderRecent(){
  const list = normalize().slice(0,6);
  $('recentCount').textContent = `${state.data.entries.length} entries`;
  $('recentList').innerHTML = list.length ? list.map(recentEntryHtml).join('') : '<div class="empty">No entries yet.</div>';
}

function renderCategories(){
  $('categoryList').innerHTML = state.data.categories.map(c => `<div class="category-item"><div><div class="category-name">${escapeHtml(c.name)}</div><div class="category-note">Used in filters and charts automatically</div><div class="category-actions"><button class="secondary" onclick="renameCategory('${encodeURIComponent(c.name)}')">Rename</button><button class="secondary" onclick="deleteCategory('${encodeURIComponent(c.name)}')">Delete</button></div></div><div><span class="swatch-pill"><b style="background:${c.color}"></b>Color</span></div></div>`).join('');
}

function renderEntries(){
  toggleEntryFrequencyFilter();
  const list = filteredEntries({
    month: $('entryMonthFilter').value,
    search: $('entrySearch').value,
    category: $('entryCategoryFilter').value,
    payment: $('entryPaymentFilter').value,
    type: $('entryTypeFilter').value,
    frequency: $('entryFreqFilter').value
  });
  sortEntries(list, $('entrySort').value);
  $('entryShownTotal').textContent = formatMoney(sum(list));
  $('entryLargest').textContent = formatMoney(Math.max(0, ...list.map(e=>e.amount)));
  $('entryShownCount').textContent = String(list.length);
  const grouped = groupBy(list, e => ym(e.date));
  const sections = Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([group,items]) => `<div class="compact-group"><div class="group-title"><h3>${monthLabel(group)}</h3><span>${items.length} items · ${formatMoney(sum(items))}</span></div><div class="compact-list">${items.map(entryRowHtml).join('')}</div></div>`).join('');
  $('entriesGrouped').innerHTML = list.length ? sections : '<div class="card"><div class="empty">No entries match these filters.</div></div>';
}

function renderCharts(){
  toggleChartFrequencyFilter();
  const startMonth = $('chartStart').value || shiftMonth(currentMonth(), -2);
  const endMonth = $('chartEnd').value || currentMonth();
  const list = filteredEntries({
    start: startMonth,
    end: endMonth,
    category: $('chartCategory').value,
    payment: $('chartPayment').value,
    type: $('chartTypeFilter').value,
    frequency: $('chartFreq').value
  });
  let group = $('chartGroup').value;
  if(group === 'Frequency' && $('chartTypeFilter').value === 'One-Time') group = 'Cost Type';
  const total = sum(list);
  const agg = aggregateBy(list, group).filter(r => Number.isFinite(r.value) && r.value > 0).sort((a,b)=> (group==='Month' || group==='Year') ? a.label.localeCompare(b.label) : b.value-a.value);
  const top = agg[0];
  const type = state.chartType;
  $('chartItemCount').textContent = `${list.length} items`;
  $('chartTotalPill').textContent = formatMoney(total);
  $('chartCenterTotal').textContent = formatMoney(total);
  $('chartCenterLabel').textContent = type === 'line' ? 'selected range' : `${group.toLowerCase()} view`;
  $('chartTitle').textContent = type === 'line' ? 'Category spending trend' : `${group} chart`;
  $('chartBreakdownPill').textContent = agg.length ? `Top ${Math.min(5, agg.length)}` : 'No data';

  $('donutArea').classList.toggle('hidden', type !== 'donut');
  $('barArea').classList.toggle('hidden', type !== 'bar');
  $('lineArea').classList.toggle('hidden', type !== 'line');

  if(type === 'donut'){
    renderDonut($('chartDonut'), agg);
    $('chartLegend').innerHTML = agg.length ? agg.slice(0,8).map(r=>legendHtml({...r, label: group==='Month' ? monthLabel(r.label) : r.label})).join('') : '<div class="empty">No data.</div>';
    $('chartDetailList').innerHTML = agg.length ? `<div class="chart-summary"><div class="chart-metric"><div class="k">Filtered total</div><div class="v mono">${formatMoney(total)}</div></div><div class="chart-metric"><div class="k">Largest segment</div><div class="v">${top ? escapeHtml(group==='Month' ? monthLabel(top.label) : top.label) : 'None'}</div></div><div class="chart-metric"><div class="k">Top share</div><div class="v mono">${top ? pct(top.value,total) : '0%'}</div></div></div><div class="simple-breakdown">${agg.slice(0,5).map(r=>legendHtml({...r, label: group==='Month' ? monthLabel(r.label) : r.label})).join('')}</div>` : '<div class="empty">No chart data for these filters.</div>';
  }

  if(type === 'bar'){
    renderBar($('chartBar'), agg.map(r=>({label: group==='Month' ? shortMonth(r.label) : String(r.label).slice(0,12), value:r.value, color:r.color})));
    $('chartDetailList').innerHTML = agg.length ? `<div class="chart-summary"><div class="chart-metric"><div class="k">Filtered total</div><div class="v mono">${formatMoney(total)}</div></div><div class="chart-metric"><div class="k">Largest bar</div><div class="v">${top ? escapeHtml(group==='Month' ? monthLabel(top.label) : top.label) : 'None'}</div></div><div class="chart-metric"><div class="k">Bars shown</div><div class="v mono">${agg.length}</div></div></div><div class="simple-breakdown">${agg.slice(0,5).map(r=>legendHtml({...r, label: group==='Month' ? monthLabel(r.label) : r.label})).join('')}</div>` : '<div class="empty">No chart data for these filters.</div>';
  }

  if(type === 'line'){
    const trend = monthlyCategorySeries(list, startMonth, endMonth, 5);
    renderMultiLine($('chartLine'), trend.months, trend.series);
    const trendTop = [...trend.series].sort((a,b)=>sum(a.points)-sum(b.points)).reverse();
    $('chartDetailList').innerHTML = trend.series.length ? `<div class="chart-summary"><div class="chart-metric"><div class="k">Filtered total</div><div class="v mono">${formatMoney(total)}</div></div><div class="chart-metric"><div class="k">Months shown</div><div class="v mono">${trend.months.length}</div></div><div class="chart-metric"><div class="k">Tracked categories</div><div class="v mono">${trend.series.length}</div></div></div><div class="line-legend">${trendTop.map(line=>`<span class="swatch-pill"><b style="background:${line.color}"></b>${escapeHtml(line.label)}</span>`).join('')}</div><div class="simple-breakdown">${trendTop.map(line=>legendHtml({label: line.label, value: sum(line.points), color: line.color})).join('')}</div>` : '<div class="empty">No trend data for these filters.</div>';
  }

  if(!(agg.length || type === 'line')){ ['chartDonut','chartBar','chartLine'].forEach(id => { const c = $(id); if(c){ const ctx = c.getContext('2d'); ctx && ctx.clearRect(0,0,c.width||0,c.height||0); } }); }
}

function clearForm(){
  $('titleInput').value='';
  $('amountInput').value='';
  $('dateInput').value=today();
  $('typeInput').value='One-Time';
  $('frequencyInput').value='';
  $('paymentInput').value='Debit';
  $('notesInput').value='';
  toggleFrequency();
}
function toggleFrequency(){
  const recurring = $('typeInput').value === 'Recurring';
  $('frequencyWrap').classList.toggle('hidden', !recurring);
  if(!recurring) $('frequencyInput').value = '';
}
function toggleEntryFrequencyFilter(){
  const show = $('entryTypeFilter').value !== 'One-Time';
  $('entryFreqWrap').classList.toggle('hidden', !show);
  if(!show) $('entryFreqFilter').value = 'all';
}
function toggleChartFrequencyFilter(){
  const show = $('chartTypeFilter').value !== 'One-Time';
  $('chartFreqWrap').classList.toggle('hidden', !show);
  if(!show) $('chartFreq').value = 'all';
}

function addEntry(){
  const title = $('titleInput').value.trim();
  const amountValue = parseCurrencyInput($('amountInput').value);
  if(!title || !amountValue){ alert('Add a title and amount.'); return; }
  const type = $('typeInput').value;
  const entry = {
    id: state.editingId || crypto.randomUUID(),
    createdAt: state.editingId ? (state.data.entries.find(e=>e.id===state.editingId)?.createdAt || Date.now()) : Date.now(),
    title,
    amount: amountValue,
    date: $('dateInput').value || today(),
    category: $('categoryInput').value,
    type,
    frequency: type === 'Recurring' ? $('frequencyInput').value : '',
    payment: $('paymentInput').value,
    notes: $('notesInput').value.trim()
  };
  if(entry.type === 'Recurring' && !entry.frequency){ alert('Choose weekly, monthly, or yearly for recurring costs.'); return; }
  if(state.editingId){
    state.data.entries = state.data.entries.map(e => e.id===state.editingId ? entry : e);
    state.editingId = null;
    $('saveEntryBtn').textContent = 'Save expense';
  } else {
    state.data.entries.unshift(entry);
  }
  clearForm();
  render();
  setScreen('entries');
}
function addCategory(){
  const name = $('newCategoryName').value.trim();
  const color = $('newCategoryColor').value;
  if(!name) return;
  if(state.data.categories.some(c => c.name.toLowerCase() === name.toLowerCase())){ alert('That category already exists.'); return; }
  state.data.categories.push({name, color});
  $('newCategoryName').value = '';
  render();
}
window.editEntry = function(id){
  const e = state.data.entries.find(x=>x.id===id); if(!e) return;
  state.editingId = id;
  $('titleInput').value = e.title;
  $('amountInput').value = formatMoney(e.amount);
  $('dateInput').value = e.date;
  $('categoryInput').value = e.category;
  $('typeInput').value = e.type;
  $('frequencyInput').value = e.frequency;
  $('paymentInput').value = e.payment;
  $('notesInput').value = e.notes;
  $('saveEntryBtn').textContent = 'Update expense';
  toggleFrequency();
  setScreen('add');
};
window.deleteEntry = function(id){ if(!confirm('Delete this expense?')) return; state.data.entries = state.data.entries.filter(e=>e.id!==id); render(); };
window.duplicateEntry = function(id){ const e = state.data.entries.find(x=>x.id===id); if(!e) return; state.data.entries.unshift({...e, id:crypto.randomUUID(), createdAt:Date.now(), date:today()}); render(); };
window.renameCategory = function(encoded){
  const name = decodeURIComponent(encoded); const next = prompt('Rename category', name);
  if(!next || next===name) return;
  if(state.data.categories.some(c=>c.name.toLowerCase()===next.toLowerCase())){ alert('That category already exists.'); return; }
  state.data.categories = state.data.categories.map(c=>c.name===name ? {...c, name:next} : c);
  state.data.entries = state.data.entries.map(e=>e.category===name ? {...e, category:next} : e);
  render();
};
window.deleteCategory = function(encoded){
  const name = decodeURIComponent(encoded);
  if(state.data.categories.length <= 1){ alert('Keep at least one category.'); return; }
  if(!confirm(`Delete ${name}? Entries will move to the first remaining category.`)) return;
  const fallback = state.data.categories.find(c=>c.name!==name).name;
  state.data.categories = state.data.categories.filter(c=>c.name!==name);
  state.data.entries = state.data.entries.map(e=>e.category===name ? {...e, category:fallback} : e);
  render();
};

function exportJson(){ download(new Blob([JSON.stringify(state.data,null,2)], {type:'application/json'}), 'budget-flow-data.json'); }
function exportCsv(){
  const rows = [['title','amount','date','category','type','frequency','payment','notes']].concat(state.data.entries.map(e=>[e.title,e.amount,e.date,e.category,e.type,e.frequency,e.payment,e.notes]));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  download(new Blob([csv], {type:'text/csv'}), 'budget-flow-data.csv');
}
function download(blob, name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),300); }

function demoEntries(){
  const now = new Date(); const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  return [
    {id:crypto.randomUUID(),createdAt:Date.now()-1000,title:'Rent',amount:1450,date:`${y}-${m}-01`,category:'Home & Living',type:'Recurring',frequency:'Monthly',payment:'Bank Transfer',notes:'Main monthly housing cost'},
    {id:crypto.randomUUID(),createdAt:Date.now()-900,title:'Groceries',amount:162.40,date:`${y}-${m}-03`,category:'Home & Living',type:'One-Time',frequency:'',payment:'Debit',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-800,title:'Movie Night',amount:24,date:`${y}-${m}-05`,category:'Pleasure',type:'One-Time',frequency:'',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-700,title:'Netflix',amount:18.99,date:`${y}-${m}-08`,category:'Subscriptions',type:'Recurring',frequency:'Monthly',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-600,title:'Amazon Order',amount:72.15,date:`${y}-${m}-10`,category:'Online Purchases',type:'One-Time',frequency:'',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-500,title:'Gym',amount:36,date:`${y}-${m}-12`,category:'Subscriptions',type:'Recurring',frequency:'Monthly',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-400,title:'Dinner Out',amount:54.80,date:`${y}-${m}-16`,category:'Pleasure',type:'One-Time',frequency:'',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-300,title:'Phone Bill',amount:85,date:`${y}-${m}-16`,category:'Home & Living',type:'Recurring',frequency:'Monthly',payment:'Credit Card',notes:''},
    {id:crypto.randomUUID(),createdAt:Date.now()-200,title:'Yearly Cloud Backup',amount:99,date:`${y}-${m}-20`,category:'Subscriptions',type:'Recurring',frequency:'Yearly',payment:'Credit Card',notes:''}
  ];
}

function syncIncome(){ $('settingsIncome').value = state.data.monthlyIncome || ''; $('incomeInput').value = state.data.monthlyIncome || ''; }
function render(){ saveData(); fillSelectors(); renderHome(); renderRecent(); renderCategories(); renderEntries(); renderCharts(); syncIncome(); }

$('focusMonth').value = currentMonth();
$('dateInput').value = today();
$('entryMonthFilter').value = currentMonth();
$('chartStart').value = shiftMonth(currentMonth(), -2);
$('chartEnd').value = currentMonth();

function bind(id, type, handler){ const el = $(id); if(el) el.addEventListener(type, handler); }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', ()=>setScreen(b.dataset.go)));
document.querySelectorAll('#rangeRow .segbtn').forEach(btn => btn.addEventListener('click', ()=>{ document.querySelectorAll('#rangeRow .segbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.range = btn.dataset.range; renderHome(); }));
document.querySelectorAll('#chartTypeTabs .chip-btn').forEach(btn => btn.addEventListener('click', ()=>{ document.querySelectorAll('#chartTypeTabs .chip-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.chartType = btn.dataset.chart; renderCharts(); }));
['focusMonth','incomeInput'].forEach(id => bind(id, 'input', ()=>{ if(id==='incomeInput') state.data.monthlyIncome = $(id).value; renderHome(); }));
['entrySearch'].forEach(id => bind(id, 'input', renderEntries));
['entryMonthFilter','entryCategoryFilter','entryPaymentFilter','entryTypeFilter','entrySort','entryFreqFilter'].forEach(id => { bind(id, 'input', renderEntries); bind(id, 'change', renderEntries); });
['chartStart','chartEnd','chartCategory','chartPayment','chartTypeFilter','chartFreq','chartGroup'].forEach(id => { bind(id, 'input', renderCharts); bind(id, 'change', renderCharts); });
bind('typeInput','change', toggleFrequency);
bind('amountInput','input', formatAmountField);
bind('saveEntryBtn','click', addEntry);
bind('resetEntryBtn','click', ()=>{ state.editingId=null; $('saveEntryBtn').textContent='Save expense'; clearForm(); });
bind('addCategoryBtn','click', addCategory);
bind('newCategoryColor','input', ()=>{ $('newCategoryPreview').style.background = $('newCategoryColor').value; $('newCategoryHex').textContent = $('newCategoryColor').value; });
bind('clearEntryFilters','click', ()=>{ $('entryMonthFilter').value=''; $('entrySearch').value=''; $('entryCategoryFilter').value='all'; $('entryPaymentFilter').value='all'; $('entryTypeFilter').value='all'; $('entrySort').value='new'; $('entryFreqFilter').value='all'; renderEntries(); });
bind('fabBtn','click', ()=>setScreen('add'));
bind('openExport','click', ()=>setScreen('settings'));
bind('exportJsonBtn','click', exportJson);
bind('exportCsvBtn','click', exportCsv);
bind('importBtn','click', ()=>$('importFile').click());
bind('importFile','change', async e=>{ const file=e.target.files[0]; if(!file) return; try{ const data=JSON.parse(await file.text()); state.data=data; if(!state.data.categories?.length) state.data.categories=[...defaultCategories]; upgradeData(); render(); alert('Import complete.'); }catch{ alert('Could not import that file.'); } e.target.value=''; });
bind('seedBtn','click', ()=>{ if(confirm('Replace current data with demo data?')){ state.data.entries=demoEntries(); state.data.categories=[...defaultCategories]; render(); } });
bind('saveIncomeBtn','click', ()=>{ state.data.monthlyIncome=$('settingsIncome').value; render(); alert('Income saved.'); });
bind('resetAllBtn','click', ()=>{ if(confirm('Delete all data?')){ state.data={entries:[], categories:[...defaultCategories], monthlyIncome:''}; clearForm(); render(); } });
window.addEventListener('resize', ()=>{ renderHome(); renderCharts(); });

toggleFrequency();
formatAmountField();
render();
setScreen('home');
