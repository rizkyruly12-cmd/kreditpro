// ============================================================
// KREDITPRO — Main Application (Supabase version)
// ============================================================

let currentPage = 'dashboard';
let monthlyChartInst = null;
let statusChartInst  = null;
let laporanChartInst = null;

const PG       = { cust: 1, pay: 1, kartu: 1 };
const PAGE_SIZE = 20;

// ---- Global loading state ----
function showPageLoader(msg = 'Memuat data...') {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.style.cssText = `position:fixed;inset:0;background:rgba(255,255,255,.85);
      backdrop-filter:blur(4px);z-index:9999;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:14px;`;
    el.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#2563eb;
        border-radius:50%;animation:spin .7s linear infinite;"></div>
      <div style="font-size:13px;font-weight:600;color:#334155;" id="page-loader-msg">${msg}</div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById('page-loader-msg').textContent = msg;
    el.style.display = 'flex';
  }
}

function hidePageLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.style.display = 'none';
}

// ============================================================
//  UTILITY HELPERS
// ============================================================
function formatRupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function formatTgl(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Hitung angsuran per bulan dari data pelanggan
function hitungAngsuran(c) {
  const kreditPokok    = Number(c.kreditPokok) || 0;
  const totalBungaPct  = Number(c.totalBunga)  || 0;   // total bunga dalam %
  const tenor          = Number(c.tenor)        || 1;

  const totalBunga     = kreditPokok * (totalBungaPct / 100);
  const totalBayar     = kreditPokok + totalBunga;
  const angsuranPerBulan  = totalBayar / tenor;
  const cicilanPerBulan   = totalBunga / tenor;         // bunga per bulan
  const totalProfit    = totalBunga;

  return { angsuranPerBulan, cicilanPerBulan, totalBayar, totalProfit };
}

// Status kredit: lunas | menunggak | aktif
function getStatusKredit(c) {
  const payments = getPaymentsByCustomer(c.id);
  const { totalBayar } = hitungAngsuran(c);
  const totalDibayar = payments.reduce((s, p) => s + (p.jumlahAngsuran || 0), 0);

  if (totalDibayar >= totalBayar) return 'lunas';

  // Cek apakah ada angsuran yang terlambat
  const tglKredit = new Date(c.tgl);
  const today = new Date();
  const { angsuranPerBulan } = hitungAngsuran(c);
  let bulanBerjalan = 0;
  for (let i = 1; i <= c.tenor; i++) {
    const tglTempo = new Date(tglKredit);
    tglTempo.setMonth(tglTempo.getMonth() + i);
    if (tglTempo <= today) bulanBerjalan = i;
  }
  const seharusnyaBayar = Math.min(angsuranPerBulan * bulanBerjalan, totalBayar);
  if (totalDibayar < seharusnyaBayar - 1) return 'menunggak';
  return 'aktif';
}

// ---- INIT ----
window.addEventListener('DOMContentLoaded', async () => {
  showPageLoader('Memeriksa sesi...');

  // Auth guard (async)
  const ok = await requireAuth();
  if (!ok) return;

  showPageLoader('Memuat data...');
  await initDB();
  // Data sudah di-cache saat login via bootstrap, pakai cache dulu
  await Promise.all([
    DB.getCustomers(false),
    DB.getPayments(false)
  ]);

  populateYearSelects();
  populatePayMonths();
  populateCustFilterYear();
  setDate();
  renderSidebarUser();

  ['click','keydown','touchstart'].forEach(ev =>
    document.addEventListener(ev, () => extendSession(), { passive: true })
  );

  hidePageLoader();
  navTo('dashboard');
});

function setDate() {
  const d = new Date();
  document.getElementById('topbar-date').textContent =
    d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
}

// ---- NAVIGATION ----
function navTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  const titles = {
    dashboard:'Dashboard', pelanggan:'Data Pelanggan',
    pembayaran:'Riwayat Pembayaran', laporan:'Laporan Profit',
    kartu:'Kartu Angsuran', whatsapp:'WhatsApp — Kirim Pesan'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // async render — hanya refresh cache saat ada aksi tulis (bukan setiap navigasi)
  (async () => {
    showPageLoader('Memuat data...');
    // Gunakan cache kecuali belum ada data sama sekali
    await DB.getCustomers(false);
    await DB.getPayments(false);
    hidePageLoader();
    if (page === 'dashboard') renderDashboard();
    if (page === 'pelanggan') { PG.cust = 1; renderCustomerTable(); }
    if (page === 'pembayaran') { PG.pay = 1; renderPaymentTable(); }
    if (page === 'laporan') { renderLaporan(); switchLapTab('ringkasan'); }
    if (page === 'kartu') { PG.kartu = 1; renderKartuList(); }
    if (page === 'whatsapp') renderWhatsAppPage();
  })();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').style.display =
    document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// ---- MODAL HELPERS ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// close on overlay click
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
});

// ---- TOAST ----
function toast(msg, type = 'success') {
  const colors = { success:'#16a34a', danger:'#dc2626', info:'#0891b2', warning:'#d97706' };
  const icons  = { success:'✅', danger:'❌', info:'ℹ️', warning:'⚠️' };
  const t = document.createElement('div');
  t.style.cssText = `background:${colors[type]};color:white;padding:12px 16px;border-radius:10px;
    font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);
    display:flex;align-items:center;gap:8px;min-width:240px;animation:slideIn .25s ease;`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---- YEAR SELECTS ----
function getYears() {
  const payments = getPayments();
  const years = [...new Set(payments.map(p => p.tgl?.slice(0,4)).filter(Boolean))].sort();
  return years.length ? years : ['2022','2023','2024','2025','2026'];
}

function populateYearSelects() {
  const years = getYears();
  const currentYear = new Date().getFullYear().toString();
  ['dash-year-select','lap-year'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = years.map(y => `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('');
  });
}

function populatePayMonths() {
  const payments = getPayments();
  const months = [...new Set(payments.map(p => p.tgl?.slice(0,7)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('pay-filter-month');
  if (!sel) return;
  sel.innerHTML = '<option value="">Semua Bulan</option>' +
    months.slice(0,24).map(m => {
      const [y,mo] = m.split('-');
      const label = new Date(y, mo-1).toLocaleDateString('id-ID', {month:'long', year:'numeric'});
      return `<option value="${m}">${label}</option>`;
    }).join('');
}

function populateCustFilterYear() {
  const customers = getCustomers();
  const years = [...new Set(customers.map(c => c.tgl?.slice(0,4)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('cust-filter-year');
  if (!sel) return;
  sel.innerHTML = '<option value="">Semua Tahun</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join('');
}

// ============================================================
//  DASHBOARD
// ============================================================
function renderDashboard() {
  const customers = getCustomers();
  const payments  = getPayments();

  const totalKredit  = customers.reduce((s,c) => s + c.kreditPokok, 0);
  const totalUangMasuk = payments.reduce((s,p) => s + (p.jumlahAngsuran||0), 0);
  const totalProfit  = payments.reduce((s,p) => s + (p.cicilan||0), 0);

  let aktif=0, lunas=0, menunggak=0;
  customers.forEach(c => {
    const s = getStatusKredit(c);
    if (s==='aktif') aktif++;
    else if (s==='lunas') lunas++;
    else menunggak++;
  });

  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const profitBulanIni = payments
    .filter(p => p.tgl?.startsWith(thisMonth))
    .reduce((s,p) => s + (p.cicilan||0), 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-users"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Pelanggan</div>
        <div class="stat-value">${customers.length}</div>
        <div class="stat-sub">${aktif} aktif · ${lunas} lunas · ${menunggak} menunggak</div>
      </div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-money"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Uang Masuk</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(totalUangMasuk)}</div>
        <div class="stat-sub">${payments.length} transaksi</div>
      </div>
    </div>
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-trend"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Profit (Bunga)</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(totalProfit)}</div>
        <div class="stat-sub">Bulan ini: ${formatRupiah(profitBulanIni)}</div>
      </div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-payment"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Kredit Disalurkan</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(totalKredit)}</div>
        <div class="stat-sub">${customers.length} kredit</div>
      </div>
    </div>
    <div class="stat-card red">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-alert"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Menunggak</div>
        <div class="stat-value">${menunggak}</div>
        <div class="stat-sub">Pelanggan bermasalah</div>
      </div>
    </div>
  `;

  renderMonthlyChart();
  renderStatusChart(aktif, lunas, menunggak);
  renderRecentPayments();
  renderDueList();
}

function renderMonthlyChart() {
  const year = document.getElementById('dash-year-select')?.value || new Date().getFullYear().toString();
  const payments = getPayments().filter(p => p.tgl?.startsWith(year));
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const data = months.map((_,i) => {
    const mo = String(i+1).padStart(2,'0');
    return payments.filter(p => p.tgl?.slice(5,7) === mo).reduce((s,p) => s + (p.cicilan||0), 0);
  });

  if (monthlyChartInst) monthlyChartInst.destroy();
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  monthlyChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Profit (Rp)',
        data,
        backgroundColor: 'rgba(59,130,246,.75)',
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => 'Rp ' + ctx.parsed.y.toLocaleString('id-ID') }
      }},
      scales: {
        y: { ticks: { callback: v => 'Rp ' + (v/1000).toFixed(0)+'K', font:{size:10} }, grid:{color:'#f1f5f9'} },
        x: { grid: { display: false }, ticks:{font:{size:11}} }
      }
    }
  });
}

function renderStatusChart(aktif, lunas, menunggak) {
  if (statusChartInst) statusChartInst.destroy();
  const ctx = document.getElementById('statusChart').getContext('2d');
  statusChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Aktif','Lunas','Menunggak'],
      datasets: [{
        data: [aktif, lunas, menunggak],
        backgroundColor: ['#3b82f6','#16a34a','#dc2626'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position:'bottom', labels:{font:{size:12}, padding:12} },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` }}
      }
    }
  });
}

function renderRecentPayments() {
  const payments = getPayments().slice().sort((a,b) => new Date(b.tgl)-new Date(a.tgl)).slice(0,8);
  const customers = getCustomers();
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);

  if (!payments.length) {
    document.getElementById('recent-payments').innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><p>Belum ada pembayaran</p></div>';
    return;
  }

  document.getElementById('recent-payments').innerHTML = `
    <table><thead><tr>
      <th>Tanggal</th><th>Pelanggan</th><th>Jumlah</th><th>Metode</th>
    </tr></thead><tbody>
    ${payments.map(p => {
      const c = custMap[p.customerId];
      return `<tr>
        <td class="text-xs">${formatTgl(p.tgl)}</td>
        <td>
          <div style="font-weight:600;font-size:12px;">${c ? c.nama : p.customerId}</div>
          <div style="font-size:11px;color:#94a3b8;">${p.customerId}</div>
        </td>
        <td style="font-weight:600;font-size:12px;color:#15803d;">${formatRupiah(p.jumlahAngsuran)}</td>
        <td><span class="badge ${p.metode==='Transfer'?'badge-blue':'badge-green'}" style="font-size:10px;">${p.metode||'-'}</span></td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

// ---- Photo cache for sync access in render functions ----
const _photoCache = {};

async function preloadPhotos(customerIds) {
  const unloaded = customerIds.filter(id => !_photoCache[id]);
  await Promise.all(unloaded.map(async id => {
    _photoCache[id] = await DB.getPhotos(id);
  }));
}

function getCustPhotoSync(customerId) {
  return _photoCache[customerId]?.cust || null;
}

function getItemPhotosSync(customerId) {
  const photos = _photoCache[customerId] || {};
  const items = [];
  for (let i = 0; i < 5; i++) { if (photos[`item_${i}`]) items.push(photos[`item_${i}`]); }
  if (items.length === 0 && photos['item']) items.push(photos['item']);
  return items;
}

function renderDueList() {
  const customers = getCustomers();
  const today = new Date();
  const dueCustomers = [];

  customers.forEach(c => {
    const status = getStatusKredit(c);
    if (status === 'lunas') return;
    const tglKredit = new Date(c.tgl);
    const bulanBerjalan = Math.floor((today - tglKredit) / (1000*60*60*24*30.44));
    const payments = getPaymentsByCustomer(c.id);
    const { angsuranPerBulan } = hitungAngsuran(c);
    const totalDibayar = payments.reduce((s,p) => s + (p.jumlahAngsuran||0), 0);
    const totalSeharusnya = Math.min(bulanBerjalan+1, c.tenor) * angsuranPerBulan;
    const sisa = totalSeharusnya - totalDibayar;
    if (sisa > 0) dueCustomers.push({ c, sisa, status });
  });

  dueCustomers.sort((a,b) => b.sisa - a.sisa);
  const top = dueCustomers.slice(0,8);

  if (!top.length) {
    document.getElementById('due-list').innerHTML = '<div class="empty-state"><div style="font-size:40px;opacity:.5;margin-bottom:10px;">✓</div><p>Semua pembayaran lancar!</p></div>';
    return;
  }

  document.getElementById('due-list').innerHTML = top.map(({c,sisa,status}) => {
    const photo = getCustPhotoSync(c.id);
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="viewCustomer('${c.id}')">
      <div style="display:flex;align-items:center;gap:10px;">
        ${photo ? `<img src="${photo}" class="avatar-photo" alt="${c.nama}">` : `<div class="avatar">${c.nama[0]}</div>`}
        <div>
          <div style="font-weight:600;font-size:13px;">${c.nama}</div>
          <div style="font-size:11px;color:#94a3b8;">${c.id}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:12px;color:#dc2626;">${formatRupiah(sisa)}</div>
        <span class="badge ${status==='menunggak'?'badge-red':'badge-orange'}" style="font-size:10px;">${status}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- Modal semua jatuh tempo ----
function openDueModal() {
  const customers = getCustomers();
  const payments  = getPayments();
  const today     = new Date();
  const list = [];

  customers.forEach(c => {
    const status = getStatusKredit(c);
    if (status === 'lunas') return;
    const tglKredit = new Date(c.tgl);
    const bulanBerjalan = Math.floor((today - tglKredit) / (1000*60*60*24*30.44));
    const pays = getPaymentsByCustomer(c.id);
    const { angsuranPerBulan, totalBayar } = hitungAngsuran(c);
    const totalDibayar = pays.reduce((s,p) => s+(p.jumlahAngsuran||0), 0);
    const totalSeharusnya = Math.min(bulanBerjalan+1, c.tenor) * angsuranPerBulan;
    const sisa = totalSeharusnya - totalDibayar;
    const sisaTotal = Math.max(0, totalBayar - totalDibayar);
    if (sisa > 0) list.push({ c, sisa, sisaTotal, status, angsuranPerBulan });
  });

  list.sort((a,b) => b.sisa - a.sisa);

  const el = document.getElementById('due-modal-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px;">
      <div style="font-size:36px;opacity:.4;margin-bottom:10px;">✓</div>
      <p>Semua pembayaran lancar bulan ini!</p>
    </div>`;
  } else {
    // Summary header
    const totalTagihan = list.reduce((s,x) => s+x.sisa, 0);
    const menunggakCount = list.filter(x=>x.status==='menunggak').length;
    el.innerHTML = `
      <div style="padding:14px 20px;background:#fffbeb;border-bottom:1px solid #fde68a;display:flex;gap:16px;flex-wrap:wrap;">
        <div><span style="font-size:11px;color:#92400e;">Total Pelanggan</span><br><strong>${list.length} orang</strong></div>
        <div><span style="font-size:11px;color:#92400e;">Menunggak</span><br><strong style="color:#dc2626;">${menunggakCount} orang</strong></div>
        <div><span style="font-size:11px;color:#92400e;">Total Tagihan Bulan Ini</span><br><strong style="color:#dc2626;">${formatRupiah(totalTagihan)}</strong></div>
      </div>
      ${list.map(({c, sisa, sisaTotal, status, angsuranPerBulan}) => {
        const photo = getCustPhotoSync(c.id);
        const badgeClass = status==='menunggak'?'badge-red':'badge-orange';
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="closeModal('dueModal');viewCustomer('${c.id}')">
          <div style="display:flex;align-items:center;gap:10px;">
            ${photo ? `<img src="${photo}" class="avatar-photo" alt="${c.nama}">` : `<div class="avatar">${c.nama[0]}</div>`}
            <div>
              <div style="font-weight:600;font-size:13px;">${c.nama}</div>
              <div style="font-size:11px;color:#94a3b8;">${c.id} · ${c.c?.noHp||c.noHp||'-'}</div>
              <div style="font-size:11px;color:#64748b;">${c.barang}</div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:12px;">
            <div style="font-size:11px;color:#64748b;">Tagihan bulan ini</div>
            <div style="font-weight:700;font-size:13px;color:#dc2626;">${formatRupiah(sisa)}</div>
            <div style="font-size:10px;color:#94a3b8;">Sisa total: ${formatRupiah(sisaTotal)}</div>
            <span class="badge ${badgeClass}" style="font-size:10px;">${status}</span>
          </div>
        </div>`;
      }).join('')}`;
  }
  openModal('dueModal');
}

// ============================================================
//  PELANGGAN TABLE
// ============================================================
async function renderCustomerTable() {
  const search = document.getElementById('cust-search').value.toLowerCase();
  const filterStatus = document.getElementById('cust-filter-status').value;
  const filterYear = document.getElementById('cust-filter-year').value;

  let customers = getCustomers().filter(c => {
    const matchSearch = !search || c.nama.toLowerCase().includes(search) ||
      c.id.toLowerCase().includes(search) || c.barang.toLowerCase().includes(search) ||
      (c.noHp||'').includes(search) ||
      (c.nik||'').includes(search) ||
      (c.alamat||'').toLowerCase().includes(search) ||
      (c.noSeri||'').toLowerCase().includes(search);
    const matchStatus = !filterStatus || getStatusKredit(c) === filterStatus;
    const matchYear = !filterYear || c.tgl?.startsWith(filterYear);
    return matchSearch && matchStatus && matchYear;
  });

  // Urutkan terbaru di atas (sort by tgl desc, lalu id desc)
  customers.sort((a,b) => {
    const tglDiff = new Date(b.tgl) - new Date(a.tgl);
    if (tglDiff !== 0) return tglDiff;
    return b.id.localeCompare(a.id);
  });

  const total = customers.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (PG.cust - 1) * PAGE_SIZE;
  const paged = customers.slice(start, start + PAGE_SIZE);

  // Preload photos for visible customers
  await preloadPhotos(paged.map(c => c.id));

  const tbody = document.getElementById('cust-tbody');
  if (!paged.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👤</div><p>Tidak ada data</p></div></td></tr>`;
  } else {
    tbody.innerHTML = paged.map(c => {
      const { angsuranPerBulan } = hitungAngsuran(c);
      const status = getStatusKredit(c);
      const badgeClass = status==='lunas'?'badge-green':status==='menunggak'?'badge-red':'badge-blue';
      return `<tr>
        <td>
          <div class="customer-cell">
            ${getCustPhotoSync(c.id)
              ? `<img src="${getCustPhotoSync(c.id)}" class="avatar-photo" alt="${c.nama}">`
              : `<div class="avatar">${c.nama[0]}</div>`}
            <div>
              <div class="cust-name">${c.nama}</div>
              <div class="cust-id">${c.id} · ${c.noHp||'-'}</div>
              ${c.nik ? `<div style="font-size:10px;color:#94a3b8;">NIK: ${c.nik}</div>` : ''}
              ${c.alamat ? `<div style="font-size:10px;color:#94a3b8;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.alamat}">${c.alamat}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="font-size:12px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.barang}</td>
        <td style="font-size:12px;white-space:nowrap;">${formatTgl(c.tgl)}</td>
        <td style="font-size:12px;font-weight:600;">${formatRupiah(c.kreditPokok)}</td>
        <td style="text-align:center;">${c.tenor} bln</td>
        <td style="font-size:12px;font-weight:600;color:#15803d;">${formatRupiah(angsuranPerBulan)}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-outline btn-xs" onclick="viewCustomer('${c.id}')" title="Detail">
              <svg width="13" height="13"><use href="#ic-eye"/></svg>
            </button>
            <button class="btn btn-outline btn-xs" onclick="editCustomer('${c.id}')" title="Edit">
              <svg width="13" height="13"><use href="#ic-edit"/></svg>
            </button>
            <button class="btn btn-success btn-xs" onclick="waQuickSendCustomer('${c.id}')" title="Kirim WA">
              <svg width="13" height="13"><use href="#ic-whatsapp"/></svg>
            </button>
            <button class="btn btn-danger btn-xs" onclick="confirmDeleteCustomer('${c.id}')" title="Hapus">
              <svg width="13" height="13"><use href="#ic-trash"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  renderPagination('cust-pagination', PG.cust, totalPages, page => {
    PG.cust = page; renderCustomerTable();
  });
}

// ---- CUSTOMER CRUD ----
async function openCustModal(custId) {
  document.getElementById('custModalTitle').textContent = custId ? 'Edit Pelanggan' : 'Tambah Pelanggan';
  document.getElementById('cust-edit-id').value = custId || '';
  document.getElementById('cust-preview').style.display = 'none';

  // Reset photos
  clearPhotoPreview('cust-photo');
  _stagingItemPhotos = [];
  renderItemPhotoStrip();
  updateItemDropZone();

  if (custId) {
    const c = getCustomerById(custId);
    document.getElementById('cust-id-field').value = c.id;
    document.getElementById('cust-nama').value     = c.nama;
    document.getElementById('cust-hp').value       = c.noHp || '';
    document.getElementById('cust-tgl').value      = c.tgl;
    document.getElementById('cust-barang').value   = c.barang;
    document.getElementById('cust-harga').value    = c.harga || '';
    document.getElementById('cust-dp').value       = c.dp || 0;
    document.getElementById('cust-tenor').value    = c.tenor;
    const bungaPctKonsisten = c.tenor > 0 ? parseFloat((c.totalBunga / c.tenor).toFixed(4)) : c.bungaPct;
    document.getElementById('cust-bunga').value        = bungaPctKonsisten;
    document.getElementById('cust-total-bunga').value  = c.totalBunga;
    document.getElementById('cust-nik').value          = c.nik    || '';
    document.getElementById('cust-alamat').value       = c.alamat || '';
    document.getElementById('cust-noseri').value       = c.noSeri || '';

    // Load photos from Supabase
    const photos = await DB.getPhotos(custId);
    const custPhoto = photos['cust'] || null;
    if (custPhoto) {
      showPhotoPreview('cust-photo', custPhoto);
      document.getElementById('cust-photo-data').value = custPhoto;
    }
    // Load item photos
    const items = [];
    for (let i = 0; i < 5; i++) { if (photos[`item_${i}`]) items.push(photos[`item_${i}`]); }
    if (items.length === 0 && photos['item']) items.push(photos['item']);
    _stagingItemPhotos = items;
    renderItemPhotoStrip();
    updateItemDropZone();
    calcPreview();
  } else {
    // Get next ID from server
    const newId = await generateCustomerId();
    document.getElementById('cust-id-field').value    = newId;
    document.getElementById('cust-nama').value        = '';
    document.getElementById('cust-hp').value          = '';
    document.getElementById('cust-tgl').value         = new Date().toISOString().slice(0,10);
    document.getElementById('cust-barang').value      = '';
    document.getElementById('cust-harga').value       = '';
    document.getElementById('cust-dp').value          = '0';
    document.getElementById('cust-tenor').value       = '';
    document.getElementById('cust-bunga').value       = '';
    document.getElementById('cust-total-bunga').value = '';
    document.getElementById('cust-nik').value         = '';
    document.getElementById('cust-alamat').value      = '';
    document.getElementById('cust-noseri').value      = '';
  }
  openModal('custModal');
  setTimeout(() => { initPhotoDragDrop(); initItemPhotoDragDrop(); }, 80);
}

function editCustomer(id) { openCustModal(id); }

function calcPreview() {
  const harga = parseFloat(document.getElementById('cust-harga').value) || 0;
  const dp    = parseFloat(document.getElementById('cust-dp').value) || 0;
  const tenor = parseInt(document.getElementById('cust-tenor').value) || 0;
  const bungaPct = parseFloat(document.getElementById('cust-bunga').value) || 0;

  if (!harga || !tenor || !bungaPct) {
    document.getElementById('cust-preview').style.display = 'none';
    document.getElementById('cust-total-bunga').value = '';
    return;
  }

  const kreditPokok = harga - dp;

  // Hitung totalBungaPct dari bungaPct × tenor, lalu tulis ke field Total Bunga
  const totalBungaPct = bungaPct * tenor;
  document.getElementById('cust-total-bunga').value = totalBungaPct;

  // Gunakan totalBunga (%) untuk kalkulasi — sama persis dengan hitungAngsuran()
  const totalBunga  = kreditPokok * (totalBungaPct / 100);
  const totalBayar  = kreditPokok + totalBunga;
  const angsuran    = totalBayar / tenor;

  document.getElementById('prev-pokok').textContent    = formatRupiah(kreditPokok);
  document.getElementById('prev-bunga').textContent    = formatRupiah(totalBunga) + ` (${totalBungaPct}%)`;
  document.getElementById('prev-total').textContent    = formatRupiah(totalBayar);
  document.getElementById('prev-angsuran').textContent = formatRupiah(angsuran) + ` / bulan`;
  document.getElementById('cust-preview').style.display = 'block';
}

async function saveCustomer() {
  const id     = document.getElementById('cust-id-field').value.trim();
  const nama   = document.getElementById('cust-nama').value.trim();
  const tgl    = document.getElementById('cust-tgl').value;
  const barang = document.getElementById('cust-barang').value.trim();
  const harga  = parseFloat(document.getElementById('cust-harga').value) || 0;
  const dp     = parseFloat(document.getElementById('cust-dp').value) || 0;
  const tenor  = parseInt(document.getElementById('cust-tenor').value) || 0;
  const bunga  = parseFloat(document.getElementById('cust-bunga').value) || 0;
  const hp     = document.getElementById('cust-hp').value.trim();
  const totalBunga = parseFloat(document.getElementById('cust-total-bunga').value) || bunga * tenor;
  const nik    = document.getElementById('cust-nik').value.trim();
  const alamat = document.getElementById('cust-alamat').value.trim();
  const noSeri = document.getElementById('cust-noseri').value.trim();

  if (!nama || !tgl || !barang || !tenor || !bunga) {
    toast('Lengkapi semua field wajib!', 'danger'); return;
  }

  const obj = {
    id, nama, tgl, barang, harga, dp,
    kreditPokok: harga - dp,
    tenor, totalBunga, bungaPct: bunga, noHp: hp,
    nik, alamat, noSeri
  };

  // Save to Supabase
  showPageLoader('Menyimpan data...');
  const res = await saveCustomer_db(obj);
  if (!res?.ok) { hidePageLoader(); toast('Gagal menyimpan: ' + (res?.error || ''), 'danger'); return; }

  // Save photos
  const custPhotoData = document.getElementById('cust-photo-data').value;
  await savePhotosForCustomer(id, custPhotoData || null, _stagingItemPhotos);

  hidePageLoader();
  closeModal('custModal');
  toast(document.getElementById('cust-edit-id').value ? 'Data pelanggan diperbarui' : 'Pelanggan baru ditambahkan', 'success');
  renderCustomerTable();
  if (currentPage === 'dashboard') renderDashboard();
}

// Internal helper to avoid naming conflict
async function saveCustomer_db(obj) {
  return saveCustomer_record(obj);
}
async function saveCustomer_record(obj) {
  return saveCustomer_supabase(obj);
}
async function saveCustomer_supabase(obj) {
  const existing = getCustomerById(obj.id);
  if (existing) {
    return DB.customers.update(obj.id, obj).then(async r => { await DB.getCustomers(true); return r; });
  } else {
    return DB.customers.create(obj).then(async r => { await DB.getCustomers(true); return r; });
  }
}

function confirmDeleteCustomer(id) {
  const c = getCustomerById(id);
  document.getElementById('confirmMsg').innerHTML =
    `Hapus pelanggan <strong>${c.nama}</strong> (${c.id})? Semua riwayat pembayarannya juga akan dihapus.`;
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeModal('confirmModal');
    showPageLoader('Menghapus data...');
    await DB.customers.delete(id); // cascade deletes payments & photos via FK
    await DB.getCustomers(true);
    await DB.getPayments(true);
    DB.invalidatePhotos(id);
    hidePageLoader();
    renderCustomerTable();
    if (currentPage === 'dashboard') renderDashboard();
    toast('Pelanggan dihapus', 'danger');
  };
  openModal('confirmModal');
}

// ---- CUSTOMER DETAIL ----
let _currentViewId = null;
async function viewCustomer(id) {
  _currentViewId = id;
  const c = getCustomerById(id);
  if (!c) return;

  // Load photos into cache
  await preloadPhotos([id]);

  const payments = getPaymentsByCustomer(id);
  const { angsuranPerBulan, cicilanPerBulan, totalBayar } = hitungAngsuran(c);
  const totalDibayar = payments.reduce((s,p) => s + (p.jumlahAngsuran||0), 0);
  const totalProfit  = payments.reduce((s,p) => s + (p.cicilan||0), 0);
  const sisa = Math.max(0, totalBayar - totalDibayar);
  const progress = Math.min(100, (totalDibayar / totalBayar) * 100);
  const status = getStatusKredit(c);
  const badgeClass = status==='lunas'?'badge-green':status==='menunggak'?'badge-red':'badge-blue';

  // build installment schedule
  const tglKredit = new Date(c.tgl);
  let scheduleRows = '';
  for (let i = 1; i <= c.tenor; i++) {
    const tglTempo = new Date(tglKredit);
    tglTempo.setMonth(tglTempo.getMonth() + i);
    const tempoStr = tglTempo.toISOString().slice(0,10);

    // find matching payment(s) for this installment (simple: pick payment around due date)
    const p = payments.find((pay, idx) => {
      // match by position if payments ordered
      const cumBefore = payments.slice(0,idx).reduce((s,x) => s+(x.jumlahAngsuran||0),0);
      return cumBefore < angsuranPerBulan * i && cumBefore >= angsuranPerBulan * (i-1);
    });

    const paid = p ? true : false;
    const rowClass = paid ? 'installment-paid' : (new Date() > tglTempo ? 'installment-late' : 'installment-due');
    scheduleRows += `<tr class="${rowClass}">
      <td style="text-align:center;font-weight:600;">${i}</td>
      <td>${formatRupiah(angsuranPerBulan - cicilanPerBulan)}</td>
      <td style="color:#0891b2;">${formatRupiah(cicilanPerBulan)}</td>
      <td style="font-weight:600;">${formatRupiah(angsuranPerBulan)}</td>
      <td style="font-size:11px;">${formatTgl(tempoStr)}</td>
      <td style="font-size:11px;">${p ? formatTgl(p.tgl) : '-'}</td>
      <td style="font-size:11px;">${p ? p.ket || '' : (new Date()>tglTempo ? '⚠️ Belum bayar' : '')}</td>
    </tr>`;
  }

  document.getElementById('custDetailTitle').textContent = `Detail: ${c.nama} (${c.id})`;
  document.getElementById('custDetailBody').innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('tab-info','detail-tabs')">Info Kredit</button>
      <button class="tab-btn" onclick="switchTab('tab-schedule','detail-tabs')">Jadwal Angsuran</button>
      <button class="tab-btn" onclick="switchTab('tab-history','detail-tabs')">Riwayat Bayar</button>
      <button class="tab-btn" onclick="switchTab('tab-foto','detail-tabs')">📷 Foto</button>
    </div>
    <div id="detail-tabs">
      <!-- INFO -->
      <div id="tab-info" class="tab-pane active">
        <div style="background:linear-gradient(135deg,#1e40af,#0ea5e9);color:white;border-radius:10px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);
              display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;overflow:hidden;flex-shrink:0;">
              ${getCustPhotoSync(id)
                ? `<img src="${getCustPhotoSync(id)}" style="width:100%;height:100%;object-fit:cover;">`
                : c.nama[0]}
            </div>
            <div>
              <div style="font-size:18px;font-weight:700;">${c.nama}</div>
              <div style="opacity:.8;font-size:12px;margin-top:2px;">${c.id} · ${c.noHp||'-'}</div>
              ${c.nik    ? `<div style="opacity:.7;font-size:11px;">NIK: ${c.nik}</div>` : ''}
              ${c.alamat ? `<div style="opacity:.7;font-size:11px;">📍 ${c.alamat}</div>` : ''}
            </div>
            <span class="badge ${badgeClass}" style="margin-left:auto;">${status}</span>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:8px;padding:10px;">
            <div style="font-size:11px;opacity:.75;margin-bottom:4px;">Progress Pembayaran</div>
            <div class="progress-bar" style="background:rgba(255,255,255,.3);">
              <div class="progress-fill" style="width:${progress.toFixed(1)}%;background:white;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
              <span>${formatRupiah(totalDibayar)} dibayar</span>
              <span>${progress.toFixed(1)}%</span>
              <span>${formatRupiah(sisa)} sisa</span>
            </div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><label>Barang</label><span>${c.barang}</span></div>
          <div class="detail-item"><label>Tanggal Kredit</label><span>${formatTgl(c.tgl)}</span></div>
          <div class="detail-item"><label>NIK / No. KTP</label><span>${c.nik || '<span style="color:#94a3b8;">—</span>'}</span></div>
          <div class="detail-item"><label>No. HP</label><span>${c.noHp || '<span style="color:#94a3b8;">—</span>'}</span></div>
          <div class="detail-item" style="grid-column:1/-1;"><label>Alamat</label><span style="font-size:13px;font-weight:400;color:#334155;">${c.alamat || '<span style="color:#94a3b8;">—</span>'}</span></div>
          <div class="detail-item"><label>No. Seri / IMEI</label><span style="font-family:monospace;font-size:13px;">${c.noSeri || '<span style="color:#94a3b8;">—</span>'}</span></div>
          <div class="detail-item"><label>Harga Barang</label><span>${formatRupiah(c.harga)}</span></div>
          <div class="detail-item"><label>Uang Muka (DP)</label><span>${formatRupiah(c.dp)}</span></div>
          <div class="detail-item"><label>Kredit Pokok</label><span>${formatRupiah(c.kreditPokok)}</span></div>
          <div class="detail-item"><label>Tenor</label><span>${c.tenor} Bulan</span></div>
          <div class="detail-item"><label>Bunga / Bulan</label><span>${c.bungaPct}%</span></div>
          <div class="detail-item"><label>Total Bunga</label><span>${c.totalBunga}%</span></div>
          <div class="detail-item"><label>Angsuran / Bulan</label><span style="color:#15803d;">${formatRupiah(angsuranPerBulan)}</span></div>
          <div class="detail-item"><label>Cicilan Bunga/Bln</label><span style="color:#0891b2;">${formatRupiah(cicilanPerBulan)}</span></div>
          <div class="detail-item"><label>Total Bayar</label><span style="font-weight:700;">${formatRupiah(totalBayar)}</span></div>
          <div class="detail-item"><label>Total Profit</label><span style="color:#0891b2;">${formatRupiah(totalProfit)}</span></div>
        </div>
      </div>
      <!-- SCHEDULE -->
      <div id="tab-schedule" class="tab-pane">
        <div class="table-wrap kartu-table">
          <table>
            <thead><tr>
              <th style="text-align:center;">Ke-</th>
              <th>Angsuran Pokok</th>
              <th>Bunga</th>
              <th>Total Angsuran</th>
              <th>Tgl Tempo</th>
              <th>Tgl Bayar</th>
              <th>Keterangan</th>
            </tr></thead>
            <tbody>${scheduleRows}</tbody>
          </table>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#94a3b8;display:flex;gap:16px;">
          <span style="background:#f0fdf4;padding:2px 8px;border-radius:4px;">🟢 Sudah bayar</span>
          <span style="background:#fffbeb;padding:2px 8px;border-radius:4px;">🟡 Belum jatuh tempo</span>
          <span style="background:#fef2f2;padding:2px 8px;border-radius:4px;">🔴 Terlambat</span>
        </div>
      </div>
      <!-- HISTORY -->
      <div id="tab-history" class="tab-pane">
        ${payments.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>No</th><th>Tanggal</th><th>Jumlah Angsuran</th><th>Cicilan/Bunga</th><th>Metode</th><th>Keterangan</th><th></th>
            </tr></thead>
            <tbody>
            ${payments.map((p,i) => `<tr>
              <td style="color:#94a3b8;">${i+1}</td>
              <td>${formatTgl(p.tgl)}</td>
              <td style="font-weight:600;color:#15803d;">${formatRupiah(p.jumlahAngsuran)}</td>
              <td style="color:#0891b2;">${formatRupiah(p.cicilan)}</td>
              <td><span class="badge ${p.metode==='Transfer'?'badge-blue':'badge-green'}" style="font-size:10px;">${p.metode||'-'}</span></td>
              <td style="font-size:12px;">${p.ket||''}</td>
              <td><button class="btn btn-danger btn-xs" onclick="confirmDeletePayment('${p.id}','${id}')">🗑</button></td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border-radius:8px;display:flex;gap:24px;font-size:13px;">
          <div><span style="color:#94a3b8;">Total Bayar:</span> <strong>${formatRupiah(totalDibayar)}</strong></div>
          <div><span style="color:#94a3b8;">Total Profit:</span> <strong style="color:#0891b2;">${formatRupiah(totalProfit)}</strong></div>
          <div><span style="color:#94a3b8;">Transaksi:</span> <strong>${payments.length}x</strong></div>
        </div>` :
        `<div class="empty-state"><div class="empty-icon">💸</div><p>Belum ada pembayaran</p></div>`}
      </div>
      <!-- FOTO -->
      <div id="tab-foto" class="tab-pane">
        ${buildFotoTab(c.id)}
      </div>
    </div>`;

  document.getElementById('custDetailAddPayBtn').onclick = () => {
    closeModal('custDetailModal');
    openPayModal(id);
  };

  openModal('custDetailModal');
}

function switchTab(tabId, groupId) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  // find parent tabs container
  const tabsEl = group.previousElementSibling;
  if (tabsEl) tabsEl.querySelectorAll('.tab-btn').forEach((btn,i) => {
    const panes = group.querySelectorAll('.tab-pane');
    btn.classList.toggle('active', panes[i] && panes[i].id === tabId);
  });
}

function printDetailModal() {
  if (_currentViewId) {
    exportKartuPDF(_currentViewId);
  }
}

// ---- Export PDF Kartu Angsuran per Pelanggan ----
function exportKartuPDF(customerId) {
  const c = getCustomerById(customerId);
  if (!c) return;
  const payments = getPaymentsByCustomer(customerId);
  const { angsuranPerBulan, cicilanPerBulan, totalBayar } = hitungAngsuran(c);
  const totalDibayar = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  const sisa = Math.max(0, totalBayar - totalDibayar);
  const status = getStatusKredit(c);
  const paidCount = Math.min(Math.floor(totalDibayar / angsuranPerBulan), c.tenor);

  const rows = payments.map((p,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${p.tgl ? new Date(p.tgl).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-'}</td>
      <td class="num">${formatRupiah(p.jumlahAngsuran)}</td>
      <td class="num">${formatRupiah(p.cicilan)}</td>
      <td>${p.metode||'-'}</td>
      <td>${p.ket||'-'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="id"><head>
  <meta charset="UTF-8">
  <title>Kartu Angsuran — ${c.nama}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; padding:30px; }
    .header { text-align:center; margin-bottom:20px; border-bottom:2px solid #1e40af; padding-bottom:14px; }
    .header h1 { font-size:18px; color:#1e40af; }
    .header p { font-size:11px; color:#64748b; margin-top:3px; }
    .info { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-bottom:20px; padding:14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
    .info-item .label { font-size:10px; color:#64748b; text-transform:uppercase; font-weight:600; }
    .info-item .value { font-size:13px; font-weight:600; margin-top:2px; }
    .stats { display:flex; gap:12px; margin-bottom:20px; }
    .stat { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center; }
    .stat .label { font-size:10px; color:#64748b; }
    .stat .value { font-size:15px; font-weight:700; color:#1e40af; margin-top:3px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#1e40af; color:white; padding:8px 10px; text-align:left; font-size:11px; text-transform:uppercase; }
    td { padding:7px 10px; border-bottom:1px solid #f1f5f9; font-size:11px; }
    tr:nth-child(even) td { background:#f8fafc; }
    .num { text-align:right; }
    .badge { display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700; }
    .badge-lunas { background:#dcfce7; color:#15803d; }
    .badge-aktif { background:#dbeafe; color:#1d4ed8; }
    .badge-menunggak { background:#fee2e2; color:#dc2626; }
    .footer { text-align:center; font-size:10px; color:#94a3b8; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:10px; }
    @media print { body { padding:15px; } }
  </style></head><body>
  <div class="header">
    <h1>Kartu Angsuran</h1>
    <p>KreditPro — Ruli Rizki Ariyanto &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
  <div class="info">
    <div class="info-item"><div class="label">Nama Pelanggan</div><div class="value">${c.nama}</div></div>
    <div class="info-item"><div class="label">ID Pelanggan</div><div class="value">${c.id}</div></div>
    <div class="info-item"><div class="label">Barang</div><div class="value">${c.barang}</div></div>
    <div class="info-item"><div class="label">No. Seri</div><div class="value">${c.noSeri||'-'}</div></div>
    <div class="info-item"><div class="label">Tanggal Kredit</div><div class="value">${c.tgl ? new Date(c.tgl).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'}</div></div>
    <div class="info-item"><div class="label">Status</div><div class="value"><span class="badge badge-${status}">${status}</span></div></div>
    <div class="info-item"><div class="label">No. HP</div><div class="value">${c.noHp||'-'}</div></div>
    <div class="info-item"><div class="label">NIK</div><div class="value">${c.nik||'-'}</div></div>
    <div class="info-item" style="grid-column:1/-1;"><div class="label">Alamat</div><div class="value">${c.alamat||'-'}</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="label">Harga Barang</div><div class="value">${formatRupiah(c.harga)}</div></div>
    <div class="stat"><div class="label">Kredit Pokok</div><div class="value">${formatRupiah(c.kreditPokok)}</div></div>
    <div class="stat"><div class="label">Angsuran/Bulan</div><div class="value">${formatRupiah(angsuranPerBulan)}</div></div>
    <div class="stat"><div class="label">Tenor</div><div class="value">${c.tenor} Bulan</div></div>
    <div class="stat"><div class="label">Terbayar</div><div class="value">${paidCount}/${c.tenor}</div></div>
    <div class="stat"><div class="label">Sisa Tagihan</div><div class="value" style="color:#dc2626;">${formatRupiah(sisa)}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Tanggal</th><th style="text-align:right">Jumlah</th><th style="text-align:right">Profit</th><th>Metode</th><th>Keterangan</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">Belum ada pembayaran</td></tr>'}</tbody>
  </table>
  <div class="footer">KreditPro &copy; ${new Date().getFullYear()} — Sistem Manajemen Kredit Barang</div>
  </body></html>`;

  const w = window.open('','_blank','width=900,height=700');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

// ---- Export PDF Data Semua Pelanggan ----
function exportPelangganPDF() {
  const customers = getCustomers();
  const payments = getPayments();

  const rows = customers.map((c,i) => {
    const pays = payments.filter(p=>p.customerId===c.id);
    const { totalBayar, angsuranPerBulan } = hitungAngsuran(c);
    const totalDibayar = pays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    const sisa = Math.max(0, totalBayar - totalDibayar);
    const status = getStatusKredit(c);
    const badgeStyle = status==='lunas'?'background:#dcfce7;color:#15803d':status==='menunggak'?'background:#fee2e2;color:#dc2626':'background:#dbeafe;color:#1d4ed8';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${c.nama}</strong><br><span style="font-size:10px;color:#64748b;">${c.id}</span></td>
      <td>${c.barang}</td>
      <td class="num">${formatRupiah(c.kreditPokok)}</td>
      <td class="num">${formatRupiah(angsuranPerBulan)}</td>
      <td style="text-align:center;">${c.tenor} bln</td>
      <td class="num">${formatRupiah(totalDibayar)}</td>
      <td class="num" style="color:#dc2626;">${formatRupiah(sisa)}</td>
      <td style="text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;${badgeStyle}">${status}</span></td>
    </tr>`;
  }).join('');

  const lunas = customers.filter(c=>getStatusKredit(c)==='lunas').length;
  const aktif = customers.filter(c=>getStatusKredit(c)==='aktif').length;
  const menunggak = customers.filter(c=>getStatusKredit(c)==='menunggak').length;

  const html = `<!DOCTYPE html><html lang="id"><head>
  <meta charset="UTF-8">
  <title>Data Pelanggan — KreditPro</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1e293b; padding:24px; }
    .header { text-align:center; margin-bottom:18px; border-bottom:2px solid #1e40af; padding-bottom:12px; }
    .header h1 { font-size:18px; color:#1e40af; }
    .header p { font-size:11px; color:#64748b; margin-top:3px; }
    .stats { display:flex; gap:12px; margin-bottom:18px; }
    .stat { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:10px; text-align:center; }
    .stat .label { font-size:10px; color:#64748b; }
    .stat .value { font-size:16px; font-weight:700; color:#1e40af; margin-top:2px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#1e40af; color:white; padding:7px 8px; text-align:left; font-size:10px; text-transform:uppercase; white-space:nowrap; }
    td { padding:6px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    tr:nth-child(even) td { background:#f8fafc; }
    .num { text-align:right; white-space:nowrap; }
    .footer { text-align:center; font-size:10px; color:#94a3b8; margin-top:18px; border-top:1px solid #e2e8f0; padding-top:10px; }
    @media print { body { padding:12px; } @page { size:A4 landscape; margin:15mm; } }
  </style></head><body>
  <div class="header">
    <h1>Data Seluruh Pelanggan</h1>
    <p>KreditPro — Ruli Rizki Ariyanto &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="label">Total Pelanggan</div><div class="value">${customers.length}</div></div>
    <div class="stat"><div class="label">Aktif</div><div class="value" style="color:#1d4ed8;">${aktif}</div></div>
    <div class="stat"><div class="label">Lunas</div><div class="value" style="color:#15803d;">${lunas}</div></div>
    <div class="stat"><div class="label">Menunggak</div><div class="value" style="color:#dc2626;">${menunggak}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Nama / ID</th><th>Barang</th><th style="text-align:right">Kredit</th><th style="text-align:right">Angsuran</th><th style="text-align:center">Tenor</th><th style="text-align:right">Terbayar</th><th style="text-align:right">Sisa</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">KreditPro &copy; ${new Date().getFullYear()} — Total ${customers.length} pelanggan</div>
  </body></html>`;

  const w = window.open('','_blank','width=1100,height=700');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

// ============================================================
//  PEMBAYARAN
// ============================================================
function renderPaymentTable() {
  const search  = document.getElementById('pay-search').value.toLowerCase();
  const method  = document.getElementById('pay-filter-method').value;
  const month   = document.getElementById('pay-filter-month').value;

  const customers = getCustomers();
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);

  let payments = getPayments().filter(p => {
    const c = custMap[p.customerId];
    const custName = c ? c.nama.toLowerCase() : '';
    const matchSearch = !search || custName.includes(search) || p.customerId.toLowerCase().includes(search) || (p.ket||'').toLowerCase().includes(search);
    const matchMethod = !method || p.metode === method;
    const matchMonth  = !month || p.tgl?.startsWith(month);
    return matchSearch && matchMethod && matchMonth;
  }).sort((a,b) => new Date(b.tgl)-new Date(a.tgl));

  const totalFiltered = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  const totalProfit   = payments.reduce((s,p)=>s+(p.cicilan||0),0);

  document.getElementById('pay-summary').textContent =
    `${payments.length} transaksi · Total: ${formatRupiah(totalFiltered)} · Profit: ${formatRupiah(totalProfit)}`;

  const total = payments.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (PG.pay - 1) * PAGE_SIZE;
  const paged = payments.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('pay-tbody');
  if (!paged.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💸</div><p>Tidak ada data pembayaran</p></div></td></tr>`;
  } else {
    tbody.innerHTML = paged.map((p, i) => {
      const c = custMap[p.customerId];
      return `<tr>
        <td style="color:#94a3b8;font-size:11px;">${start+i+1}</td>
        <td style="font-size:12px;white-space:nowrap;">${formatTgl(p.tgl)}</td>
        <td>
          <div style="font-weight:600;font-size:13px;">${c ? c.nama : p.customerId}</div>
          <div style="font-size:11px;color:#94a3b8;">${p.customerId}</div>
        </td>
        <td style="font-weight:700;font-size:13px;color:#15803d;">${formatRupiah(p.jumlahAngsuran)}</td>
        <td style="font-size:12px;color:#0891b2;">${formatRupiah(p.cicilan)}</td>
        <td><span class="badge ${p.metode==='Transfer'?'badge-blue':'badge-green'}" style="font-size:10px;">${p.metode||'-'}</span></td>
        <td style="font-size:12px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.ket||''}">${p.ket||'-'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-outline btn-xs" onclick="editPayment('${p.id}')" title="Edit">
              <svg width="13" height="13"><use href="#ic-edit"/></svg>
            </button>
            <button class="btn btn-danger btn-xs" onclick="confirmDeletePaymentFromTable('${p.id}')" title="Hapus">
              <svg width="13" height="13"><use href="#ic-trash"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  renderPagination('pay-pagination', PG.pay, totalPages, page => {
    PG.pay = page; renderPaymentTable();
  });
}

function openQuickPayModal() { openPayModal(null); }

function openPayModal(preSelectedCustomerId) {
  document.getElementById('payModalTitle').textContent = 'Catat Pembayaran';
  document.getElementById('pay-edit-id').value = '';
  document.getElementById('pay-tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('pay-metode').value = 'Tunai';
  document.getElementById('pay-jumlah').value = '';
  document.getElementById('pay-cicilan').value = '';
  document.getElementById('pay-ket').value = '';
  document.getElementById('pay-cust-info').style.display = 'none';

  // populate customer dropdown
  const customers = getCustomers()
    .filter(c => getStatusKredit(c) !== 'lunas')
    .sort((a,b) => a.nama.localeCompare(b.nama));
  const sel = document.getElementById('pay-cust-select');
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
    customers.map(c => `<option value="${c.id}" ${c.id===preSelectedCustomerId?'selected':''}>${c.nama} (${c.id})</option>`).join('');

  if (preSelectedCustomerId) fillPaymentInfo();
  openModal('payModal');
}

function fillPaymentInfo() {
  const id = document.getElementById('pay-cust-select').value;
  const infoBox = document.getElementById('pay-cust-info');
  if (!id) { infoBox.style.display='none'; return; }

  const c = getCustomerById(id);
  if (!c) return;
  const { angsuranPerBulan, cicilanPerBulan, totalBayar } = hitungAngsuran(c);
  const payments = getPaymentsByCustomer(id);
  const totalDibayar = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  const sisa = Math.max(0, totalBayar - totalDibayar);
  const angsuranKe = payments.length + 1;

  document.getElementById('pay-jumlah').value = Math.round(angsuranPerBulan);
  document.getElementById('pay-cicilan').value = Math.round(cicilanPerBulan);
  document.getElementById('pay-ket').value = angsuranKe <= c.tenor ? `Angsuran ke-${angsuranKe}` : 'pelunasan';

  document.getElementById('pay-cust-info-content').innerHTML = `
    <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div><span style="color:#64748b;">Barang:</span> <strong>${c.barang}</strong></div>
      <div><span style="color:#64748b;">Tenor:</span> <strong>${c.tenor} bulan</strong></div>
      <div><span style="color:#64748b;">Angsuran/Bln:</span> <strong style="color:#15803d;">${formatRupiah(angsuranPerBulan)}</strong></div>
      <div><span style="color:#64748b;">Angsuran ke-:</span> <strong>${angsuranKe} / ${c.tenor}</strong></div>
      <div><span style="color:#64748b;">Sudah Bayar:</span> <strong>${formatRupiah(totalDibayar)}</strong></div>
      <div><span style="color:#64748b;">Sisa:</span> <strong style="color:#dc2626;">${formatRupiah(sisa)}</strong></div>
    </div>`;
  infoBox.style.display = 'block';
}

function editPayment(payId) {
  const payments = getPayments();
  const p = payments.find(x => x.id === payId);
  if (!p) return;

  document.getElementById('payModalTitle').textContent = 'Edit Pembayaran';
  document.getElementById('pay-edit-id').value = p.id;

  const customers = getCustomers().sort((a,b) => a.nama.localeCompare(b.nama));
  const sel = document.getElementById('pay-cust-select');
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
    customers.map(c => `<option value="${c.id}" ${c.id===p.customerId?'selected':''}>${c.nama} (${c.id})</option>`).join('');

  document.getElementById('pay-tgl').value = p.tgl;
  document.getElementById('pay-metode').value = p.metode || 'Tunai';
  document.getElementById('pay-jumlah').value = p.jumlahAngsuran || '';
  document.getElementById('pay-cicilan').value = p.cicilan || '';
  document.getElementById('pay-ket').value = p.ket || '';
  document.getElementById('pay-cust-info').style.display = 'none';
  openModal('payModal');
}

async function savePayment() {
  const editId  = document.getElementById('pay-edit-id').value;
  const custId  = document.getElementById('pay-cust-select').value;
  const tgl     = document.getElementById('pay-tgl').value;
  const metode  = document.getElementById('pay-metode').value;
  const jumlah  = parseFloat(document.getElementById('pay-jumlah').value) || 0;
  const cicilan = parseFloat(document.getElementById('pay-cicilan').value) || 0;
  const ket     = document.getElementById('pay-ket').value.trim();

  if (!custId || !tgl || !jumlah) {
    toast('Pelanggan, tanggal, dan jumlah wajib diisi!', 'danger'); return;
  }

  showPageLoader('Menyimpan pembayaran...');
  let res;
  let newId = null;
  if (editId) {
    res = await DB.payments.update(editId, { customerId:custId, tgl, metode, jumlahAngsuran:jumlah, cicilan, ket });
  } else {
    newId = await generatePaymentId();
    res = await DB.payments.create({ id:newId, customerId:custId, tgl, jumlahAngsuran:jumlah, cicilan, metode, ket });
  }

  await DB.getPayments(true);
  hidePageLoader();

  if (!res?.ok) { toast('Gagal menyimpan: ' + (res?.error || ''), 'danger'); return; }

  toast(editId ? 'Pembayaran diperbarui' : 'Pembayaran dicatat', 'success');
  closeModal('payModal');
  populatePayMonths();
  renderPaymentTable();
  if (currentPage === 'dashboard') renderDashboard();

  // Tampilkan struk otomatis setelah pembayaran baru
  if (!editId) {
    const c = getCustomerById(custId);
    if (c) {
      setTimeout(() => printStruk(c, { id: newId, tgl, jumlahAngsuran: jumlah, cicilan, metode, ket }), 400);
    }
  }
}

// ---- Struk / Invoice Pembayaran ----
function printStruk(c, pay) {
  if (!c || !pay) return;

  const { angsuranPerBulan, totalBayar } = hitungAngsuran(c);
  const allPays = getPaymentsByCustomer(c.id);
  const totalDibayar = allPays.reduce((s,p) => s+(p.jumlahAngsuran||0), 0);
  const sisaTagihan  = Math.max(0, totalBayar - totalDibayar);
  const angsuranKe   = allPays.length;
  const status       = getStatusKredit(c);
  const tglFormatted = pay.tgl ? new Date(pay.tgl).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-';
  const now          = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) + ' ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

  const statusColor  = status==='lunas' ? '#15803d' : status==='menunggak' ? '#dc2626' : '#1d4ed8';
  const statusBg     = status==='lunas' ? '#dcfce7' : status==='menunggak' ? '#fee2e2' : '#dbeafe';
  const statusLabel  = status==='lunas' ? '✓ LUNAS' : status==='menunggak' ? 'MENUNGGAK' : 'AKTIF';

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;width:100%;max-width:320px;margin:0 auto;">

    <!-- Header -->
    <div style="text-align:center;padding:16px 0 14px;border-bottom:2px dashed #e2e8f0;margin-bottom:14px;">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#2563eb,#06b6d4);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.75" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>
      </div>
      <div style="font-size:16px;font-weight:800;color:#1e293b;letter-spacing:-.03em;">KreditPro</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:1px;">Ruli Rizki Ariyanto</div>
      <div style="margin-top:8px;display:inline-block;padding:3px 14px;border:1.5px solid #1e40af;border-radius:20px;font-size:10px;font-weight:700;color:#1e40af;letter-spacing:.05em;text-transform:uppercase;">Bukti Pembayaran</div>
    </div>

    <!-- Info Transaksi -->
    <table style="width:100%;margin-bottom:10px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;width:45%;">No. Struk</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${pay.id||'-'}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">Tanggal</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${tglFormatted}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">Metode</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${pay.metode||'Tunai'}</td></tr>
    </table>

    <div style="border-top:1px dashed #e2e8f0;margin:10px 0;"></div>

    <!-- Info Pelanggan -->
    <table style="width:100%;margin-bottom:10px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;width:45%;">Nama</td><td style="padding:4px 0;font-size:11px;font-weight:700;text-align:right;">${c.nama}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">ID</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${c.id}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">Barang</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${c.barang}</td></tr>
      ${c.noHp?`<tr><td style="padding:4px 0;font-size:11px;color:#64748b;">No. HP</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${c.noHp}</td></tr>`:''}
    </table>

    <div style="border-top:1px dashed #e2e8f0;margin:10px 0;"></div>

    <!-- Jumlah Bayar -->
    <div style="background:#1e40af;border-radius:10px;padding:12px 16px;text-align:center;margin-bottom:12px;">
      <div style="font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.05em;">Jumlah Dibayar</div>
      <div style="font-size:24px;font-weight:800;color:white;margin-top:3px;letter-spacing:-.02em;">${formatRupiah(pay.jumlahAngsuran)}</div>
    </div>

    <!-- Ringkasan -->
    <table style="width:100%;margin-bottom:10px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;width:45%;">Angsuran ke-</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${angsuranKe} / ${c.tenor}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">Total Kredit</td><td style="padding:4px 0;font-size:11px;font-weight:600;text-align:right;">${formatRupiah(totalBayar)}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748b;">Sudah Dibayar</td><td style="padding:4px 0;font-size:11px;font-weight:600;color:#15803d;text-align:right;">${formatRupiah(totalDibayar)}</td></tr>
    </table>

    <!-- Sisa Tagihan -->
    <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border:1px solid #e2e8f0;">
      <span style="font-size:12px;font-weight:700;color:#1e293b;">Sisa Tagihan</span>
      <span style="font-size:16px;font-weight:800;color:${sisaTagihan>0?'#dc2626':'#15803d'};">${formatRupiah(sisaTagihan)}</span>
    </div>

    <!-- Status -->
    <div style="text-align:center;margin-bottom:12px;">
      <span style="display:inline-block;padding:4px 18px;border-radius:20px;font-size:11px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span>
    </div>

    ${pay.ket?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:7px 12px;font-size:11px;color:#92400e;margin-bottom:12px;"><strong>Ket:</strong> ${pay.ket}</div>`:''}

    <!-- Footer -->
    <div style="text-align:center;padding-top:12px;border-top:2px dashed #e2e8f0;">
      <div style="font-size:10px;color:#94a3b8;line-height:1.7;">Terima kasih atas pembayaran Anda.<br>Simpan sebagai bukti pembayaran resmi.</div>
      <div style="font-size:9px;color:#cbd5e1;margin-top:4px;">${now}</div>
    </div>

  </div>`;

  document.getElementById('struk-content').innerHTML = html;
  openModal('strukModal');
}

function confirmDeletePayment(payId, custId) {
  document.getElementById('confirmMsg').textContent = 'Hapus catatan pembayaran ini?';
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeModal('confirmModal');
    showPageLoader('Menghapus...');
    await DB.payments.delete(payId);
    await DB.getPayments(true);
    hidePageLoader();
    viewCustomer(custId);
    toast('Pembayaran dihapus', 'danger');
  };
  openModal('confirmModal');
}

function confirmDeletePaymentFromTable(payId) {
  document.getElementById('confirmMsg').textContent = 'Hapus catatan pembayaran ini?';
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeModal('confirmModal');
    showPageLoader('Menghapus...');
    await DB.payments.delete(payId);
    await DB.getPayments(true);
    hidePageLoader();
    renderPaymentTable();
    if (currentPage === 'dashboard') renderDashboard();
    toast('Pembayaran dihapus', 'danger');
  };
  openModal('confirmModal');
}

// ============================================================
//  LAPORAN
// ============================================================
function renderLaporan() {
  const year = document.getElementById('lap-year')?.value || new Date().getFullYear().toString();
  const payments = getPayments();
  const customers = getCustomers();

  // Stats
  const allYears = getYears();
  let totalProfitAll = payments.reduce((s,p)=>s+(p.cicilan||0),0);
  let totalUangAll   = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  let avgProfit = payments.length ? totalProfitAll / allYears.length : 0;

  document.getElementById('laporan-stats').innerHTML = `
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-money"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Profit Keseluruhan</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(totalProfitAll)}</div>
        <div class="stat-sub">Dari ${payments.length} transaksi</div>
      </div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-trend"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Uang Masuk</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(totalUangAll)}</div>
        <div class="stat-sub">${allYears.length} tahun operasi</div>
      </div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-chart"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Avg Profit Per Tahun</div>
        <div class="stat-value" style="font-size:16px;">${formatRupiah(avgProfit)}</div>
        <div class="stat-sub">Rata-rata dari ${allYears.length} tahun</div>
      </div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-users"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Total Pelanggan</div>
        <div class="stat-value">${customers.length}</div>
        <div class="stat-sub">${customers.filter(c=>getStatusKredit(c)==='lunas').length} sudah lunas</div>
      </div>
    </div>`;

  // Monthly chart
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const yearPay = payments.filter(p => p.tgl?.startsWith(year));
  const profitData = months.map((_,i) => {
    const mo = String(i+1).padStart(2,'0');
    return yearPay.filter(p=>p.tgl?.slice(5,7)===mo).reduce((s,p)=>s+(p.cicilan||0),0);
  });
  const uangData = months.map((_,i) => {
    const mo = String(i+1).padStart(2,'0');
    return yearPay.filter(p=>p.tgl?.slice(5,7)===mo).reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  });

  if (laporanChartInst) laporanChartInst.destroy();
  const ctx = document.getElementById('laporanChart').getContext('2d');
  laporanChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Uang Masuk',
          data: uangData,
          backgroundColor: 'rgba(59,130,246,.45)',
          borderRadius: 5,
          yAxisID: 'y',
        },
        {
          label: 'Profit (Bunga)',
          data: profitData,
          backgroundColor: 'rgba(14,165,233,.85)',
          borderRadius: 5,
          yAxisID: 'y',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'top', labels:{font:{size:12}} },
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: Rp ${ctx.parsed.y.toLocaleString('id-ID')}` }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => 'Rp ' + (v/1000000).toFixed(1)+'Jt', font:{size:10} },
          grid: { color:'#f1f5f9' }
        },
        x: { grid:{ display:false }, ticks:{font:{size:11}} }
      }
    }
  });

  // Top customers by profit
  const custProfitMap = {};
  payments.forEach(p => {
    custProfitMap[p.customerId] = (custProfitMap[p.customerId]||0) + (p.cicilan||0);
  });
  const custMap = {};
  customers.forEach(c => custMap[c.id]=c);
  const topCust = Object.entries(custProfitMap)
    .sort((a,b) => b[1]-a[1]).slice(0,8)
    .map(([id,profit]) => ({ c: custMap[id], profit }))
    .filter(x => x.c);

  const maxProfit = topCust[0]?.profit || 1;
  document.getElementById('top-customers').innerHTML = topCust.map(({c,profit},i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <div style="width:22px;text-align:center;font-size:12px;font-weight:700;color:${i<3?'#d97706':'#94a3b8'};">${i+1}</div>
      <div class="avatar" style="width:28px;height:28px;font-size:11px;">${c.nama[0]}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nama}</div>
        <div class="progress-bar" style="margin-top:4px;">
          <div class="progress-fill" style="width:${(profit/maxProfit*100).toFixed(1)}%;background:#3b82f6;"></div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:700;color:#0891b2;white-space:nowrap;">${formatRupiah(profit)}</div>
    </div>`).join('');

  // Yearly summary
  const yearlyMap = {};
  payments.forEach(p => {
    const yr = p.tgl?.slice(0,4);
    if (!yr) return;
    if (!yearlyMap[yr]) yearlyMap[yr] = { uang:0, profit:0, count:0 };
    yearlyMap[yr].uang   += p.jumlahAngsuran||0;
    yearlyMap[yr].profit += p.cicilan||0;
    yearlyMap[yr].count++;
  });

  document.getElementById('yearly-summary').innerHTML = `
    <table style="width:100%;font-size:13px;">
      <thead><tr>
        <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">Tahun</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Uang Masuk</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Profit</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;font-weight:600;">Transaksi</th>
      </tr></thead>
      <tbody>
      ${Object.entries(yearlyMap).sort((a,b)=>b[0].localeCompare(a[0])).map(([yr,d]) => `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:8px;font-weight:700;">${yr}</td>
          <td style="padding:8px;text-align:right;color:#15803d;font-weight:600;">${formatRupiah(d.uang)}</td>
          <td style="padding:8px;text-align:right;color:#0891b2;font-weight:600;">${formatRupiah(d.profit)}</td>
          <td style="padding:8px;text-align:center;">${d.count}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function printLaporan() {
  printLaporanAktif();
}

// ---- Switch tab laporan ----
let _lapTab = 'ringkasan';
let aruskasChartInst = null;
let modalChartInst   = null;
let roiChartInst     = null;
let barangChartInst  = null;

function switchLapTab(tab) {
  _lapTab = tab;
  const tabs = ['ringkasan','piutang','tunggakan','aruskas','modal','barang'];
  tabs.forEach(t => {
    const panel = document.getElementById('lap-panel-'+t);
    const btn   = document.getElementById('lap-tab-'+t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) {
      btn.className = t === tab ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
    }
  });
  if (tab === 'piutang')   renderPiutang();
  if (tab === 'tunggakan') renderTunggakan();
  if (tab === 'aruskas')   renderArusKas();
  if (tab === 'modal')     renderModal();
  if (tab === 'barang')    renderBarang();
}

// ============================================================
// TAB PIUTANG — total uang di pelanggan
// ============================================================
function renderPiutang() {
  const customers = getCustomers();
  const payments  = getPayments();
  const search    = document.getElementById('piutang-search')?.value.toLowerCase() || '';

  let totalPiutang = 0, totalTagihan = 0, totalDibayarAll = 0;
  let rows = '';

  const filtered = customers.filter(c => !search || c.nama.toLowerCase().includes(search) || c.id.toLowerCase().includes(search));

  // Urutkan berdasarkan sisa piutang terbesar
  const sorted = filtered.map(c => {
    const pays = payments.filter(p => p.customerId === c.id);
    const { totalBayar } = hitungAngsuran(c);
    const totalDibayar = pays.reduce((s,p) => s+(p.jumlahAngsuran||0), 0);
    const sisa = Math.max(0, totalBayar - totalDibayar);
    return { c, totalBayar, totalDibayar, sisa };
  }).sort((a,b) => b.sisa - a.sisa);

  sorted.forEach(({ c, totalBayar, totalDibayar, sisa }) => {
    const status = getStatusKredit(c);
    const progress = Math.min(100, totalBayar > 0 ? (totalDibayar/totalBayar*100) : 100);
    const badgeClass = status==='lunas'?'badge-green':status==='menunggak'?'badge-red':'badge-blue';
    totalTagihan   += totalBayar;
    totalDibayarAll += totalDibayar;
    totalPiutang   += sisa;

    rows += `<tr>
      <td><strong>${c.nama}</strong><br><span style="font-size:11px;color:#94a3b8;">${c.id}</span></td>
      <td style="font-size:12px;">${c.barang}</td>
      <td class="text-right">${formatRupiah(totalBayar)}</td>
      <td class="text-right" style="color:#16a34a;">${formatRupiah(totalDibayar)}</td>
      <td class="text-right" style="color:${sisa>0?'#dc2626':'#16a34a'};font-weight:700;">${formatRupiah(sisa)}</td>
      <td style="min-width:120px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;background:#f1f5f9;border-radius:4px;height:6px;">
            <div style="width:${progress.toFixed(0)}%;background:${status==='lunas'?'#16a34a':status==='menunggak'?'#dc2626':'#3b82f6'};height:6px;border-radius:4px;"></div>
          </div>
          <span style="font-size:11px;color:#64748b;white-space:nowrap;">${progress.toFixed(0)}%</span>
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
    </tr>`;
  });

  document.getElementById('piutang-tbody').innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Tidak ada data</td></tr>';
  document.getElementById('piutang-tfoot').innerHTML = `
    <tr style="background:#eff6ff;font-weight:700;">
      <td colspan="2">TOTAL (${sorted.length} pelanggan)</td>
      <td class="text-right">${formatRupiah(totalTagihan)}</td>
      <td class="text-right" style="color:#16a34a;">${formatRupiah(totalDibayarAll)}</td>
      <td class="text-right" style="color:#dc2626;">${formatRupiah(totalPiutang)}</td>
      <td colspan="2"></td>
    </tr>`;

  const aktif    = customers.filter(c => getStatusKredit(c)==='aktif').length;
  const menunggak = customers.filter(c => getStatusKredit(c)==='menunggak').length;
  document.getElementById('piutang-stats').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-money"/></svg></div>
      <div class="stat-info"><div class="stat-label">Total Piutang Aktif</div>
      <div class="stat-value">${formatRupiah(totalPiutang)}</div>
      <div class="stat-sub">Uang yang masih di pelanggan</div></div>
    </div>
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-payment"/></svg></div>
      <div class="stat-info"><div class="stat-label">Sudah Diterima</div>
      <div class="stat-value">${formatRupiah(totalDibayarAll)}</div>
      <div class="stat-sub">Dari total tagihan ${formatRupiah(totalTagihan)}</div></div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-users"/></svg></div>
      <div class="stat-info"><div class="stat-label">Kredit Aktif</div>
      <div class="stat-value">${aktif}</div>
      <div class="stat-sub">pelanggan sedang berjalan</div></div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-alert"/></svg></div>
      <div class="stat-info"><div class="stat-label">Menunggak</div>
      <div class="stat-value">${menunggak}</div>
      <div class="stat-sub">pelanggan perlu ditagih</div></div>
    </div>`;
}

// ============================================================
// TAB TUNGGAKAN
// ============================================================
function renderTunggakan() {
  const customers = getCustomers();
  const payments  = getPayments();
  const today     = new Date();

  const menunggakList = customers
    .map(c => {
      const pays = payments.filter(p => p.customerId === c.id);
      const { angsuranPerBulan, totalBayar } = hitungAngsuran(c);
      const totalDibayar = pays.reduce((s,p) => s+(p.jumlahAngsuran||0), 0);
      if (totalDibayar >= totalBayar) return null; // lunas

      const tglKredit = new Date(c.tgl);
      let bulanBerjalan = 0;
      for (let i = 1; i <= c.tenor; i++) {
        const t = new Date(tglKredit); t.setMonth(t.getMonth()+i);
        if (t <= today) bulanBerjalan = i;
      }
      const seharusnya = Math.min(angsuranPerBulan * bulanBerjalan, totalBayar);
      const selisih    = Math.max(0, seharusnya - totalDibayar);
      if (selisih < 1) return null; // tidak menunggak
      const bulanTunggak = Math.ceil(selisih / angsuranPerBulan);
      return { c, angsuranPerBulan, seharusnya, totalDibayar, selisih, bulanTunggak };
    })
    .filter(Boolean)
    .sort((a,b) => b.selisih - a.selisih);

  const totalTunggakan = menunggakList.reduce((s,x) => s+x.selisih, 0);

  let rows = '';
  menunggakList.forEach(({ c, angsuranPerBulan, seharusnya, totalDibayar, selisih, bulanTunggak }) => {
    rows += `<tr>
      <td><strong>${c.nama}</strong><br><span style="font-size:11px;color:#94a3b8;">${c.id}</span></td>
      <td style="font-size:12px;">${c.barang}</td>
      <td style="font-size:12px;">${formatTgl(c.tgl)}</td>
      <td class="text-right">${formatRupiah(angsuranPerBulan)}</td>
      <td class="text-right">${formatRupiah(seharusnya)}</td>
      <td class="text-right" style="color:#16a34a;">${formatRupiah(totalDibayar)}</td>
      <td class="text-right" style="color:#dc2626;font-weight:700;">${formatRupiah(selisih)}
        <br><span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:10px;">${bulanTunggak} bln</span>
      </td>
      <td><button class="btn btn-outline btn-xs" onclick="viewCustomer('${c.id}')">Detail</button></td>
    </tr>`;
  });

  document.getElementById('tunggakan-tbody').innerHTML = rows || `
    <tr><td colspan="8" style="text-align:center;padding:32px;color:#16a34a;">
      Tidak ada pelanggan yang menunggak
    </td></tr>`;

  document.getElementById('tunggakan-stats').innerHTML = `
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-alert"/></svg></div>
      <div class="stat-info"><div class="stat-label">Pelanggan Menunggak</div>
      <div class="stat-value">${menunggakList.length}</div>
      <div class="stat-sub">perlu segera ditagih</div></div>
    </div>
    <div class="stat-card red" style="--card-color:#dc2626;">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-money"/></svg></div>
      <div class="stat-info"><div class="stat-label">Total Tunggakan</div>
      <div class="stat-value" style="color:#dc2626;">${formatRupiah(totalTunggakan)}</div>
      <div class="stat-sub">jumlah yang belum dibayar</div></div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-chart"/></svg></div>
      <div class="stat-info"><div class="stat-label">Rata-rata Tunggak</div>
      <div class="stat-value">${menunggakList.length ? formatRupiah(totalTunggakan/menunggakList.length) : 'Rp 0'}</div>
      <div class="stat-sub">per pelanggan menunggak</div></div>
    </div>
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-trend"/></svg></div>
      <div class="stat-info"><div class="stat-label">Terbesar Menunggak</div>
      <div class="stat-value" style="font-size:14px;">${menunggakList[0]?.c.nama || '-'}</div>
      <div class="stat-sub">${menunggakList[0] ? formatRupiah(menunggakList[0].selisih) : 'Tidak ada'}</div></div>
    </div>`;
}

// ============================================================
// TAB ARUS KAS
// ============================================================
function renderArusKas() {
  const payments  = getPayments();
  const customers = getCustomers();
  const today     = new Date();

  // Semua bulan dari data
  const bulanSet = [...new Set(payments.map(p=>p.tgl?.slice(0,7)).filter(Boolean))].sort();

  // Prediksi bulan depan dari kredit aktif
  const nextMonth = new Date(today.getFullYear(), today.getMonth()+1, 1).toISOString().slice(0,7);
  const prediksi  = customers
    .filter(c => getStatusKredit(c) !== 'lunas')
    .reduce((s,c) => s + hitungAngsuran(c).angsuranPerBulan, 0);

  // Bulan ini
  const thisMonth = today.toISOString().slice(0,7);
  const thisPays  = payments.filter(p=>p.tgl?.startsWith(thisMonth));
  const thisUang  = thisPays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  const thisProfit= thisPays.reduce((s,p)=>s+(p.cicilan||0),0);

  // Bulan lalu
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0,7);
  const lastPays  = payments.filter(p=>p.tgl?.startsWith(lastMonth));
  const lastUang  = lastPays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);

  const growth = lastUang > 0 ? ((thisUang-lastUang)/lastUang*100).toFixed(1) : 0;

  document.getElementById('aruskas-stats').innerHTML = `
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-calendar"/></svg></div>
      <div class="stat-info"><div class="stat-label">Uang Masuk Bulan Ini</div>
      <div class="stat-value">${formatRupiah(thisUang)}</div>
      <div class="stat-sub" style="color:${growth>=0?'#16a34a':'#dc2626'}">${growth>=0?'▲':'▼'} ${Math.abs(growth)}% vs bulan lalu</div></div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-money"/></svg></div>
      <div class="stat-info"><div class="stat-label">Profit Bulan Ini</div>
      <div class="stat-value">${formatRupiah(thisProfit)}</div>
      <div class="stat-sub">${thisPays.length} transaksi</div></div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-calendar"/></svg></div>
      <div class="stat-info"><div class="stat-label">Prediksi Bulan Depan</div>
      <div class="stat-value">${formatRupiah(prediksi)}</div>
      <div class="stat-sub">dari ${customers.filter(c=>getStatusKredit(c)!=='lunas').length} kredit aktif</div></div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-chart"/></svg></div>
      <div class="stat-info"><div class="stat-label">Bulan Lalu</div>
      <div class="stat-value">${formatRupiah(lastUang)}</div>
      <div class="stat-sub">${lastPays.length} transaksi</div></div>
    </div>`;

  // Tabel & chart 12 bulan terakhir
  const last12 = bulanSet.slice(-12);
  let rows = '', labels = [], uangData = [], profitData = [];
  let prevUang = 0;
  last12.forEach((m,i) => {
    const mp = payments.filter(p=>p.tgl?.startsWith(m));
    const u  = mp.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    const pr = mp.reduce((s,p)=>s+(p.cicilan||0),0);
    const [y,mo] = m.split('-');
    const label  = new Date(y,mo-1).toLocaleDateString('id-ID',{month:'short',year:'2-digit'});
    const vs = prevUang>0 ? ((u-prevUang)/prevUang*100).toFixed(1) : '-';
    const vsStyle = vs==='-'?'':Number(vs)>=0?'color:#16a34a':'color:#dc2626';
    rows += `<tr>
      <td>${new Date(y,mo-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</td>
      <td class="text-right">${mp.length}</td>
      <td class="text-right" style="color:#0891b2;font-weight:600;">${formatRupiah(u)}</td>
      <td class="text-right" style="color:#16a34a;font-weight:600;">${formatRupiah(pr)}</td>
      <td class="text-right" style="${vsStyle}">${vs==='-'?'-':(Number(vs)>=0?'▲':'▼')+Math.abs(vs)+'%'}</td>
    </tr>`;
    labels.push(label); uangData.push(u); profitData.push(pr);
    prevUang = u;
  });
  document.getElementById('aruskas-tbody').innerHTML = rows;

  if (aruskasChartInst) aruskasChartInst.destroy();
  const ctx = document.getElementById('aruskasChart').getContext('2d');
  aruskasChartInst = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Uang Masuk', data:uangData, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.1)', tension:.3, fill:true, pointRadius:4 },
      { label:'Profit', data:profitData, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.1)', tension:.3, fill:true, pointRadius:4 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'top'}, tooltip:{ callbacks:{label:c=>`${c.dataset.label}: Rp ${c.parsed.y.toLocaleString('id-ID')}`}}},
      scales:{ y:{ ticks:{callback:v=>'Rp '+(v/1e6).toFixed(1)+'Jt'}, grid:{color:'#f1f5f9'}}, x:{grid:{display:false}} }
    }
  });
}

// ============================================================
// TAB MODAL & ROI
// ============================================================
function renderModal() {
  const customers = getCustomers();
  const payments  = getPayments();

  // Total modal dikeluarkan = semua harga barang (setelah dp, modal = kreditPokok)
  const totalModal     = customers.reduce((s,c) => s+c.kreditPokok, 0);
  const totalDP        = customers.reduce((s,c) => s+(c.dp||0), 0);
  const totalHarga     = customers.reduce((s,c) => s+(c.harga||0), 0);
  const totalProfit    = payments.reduce((s,p) => s+(p.cicilan||0), 0);
  const totalDiterima  = payments.reduce((s,p) => s+(p.jumlahAngsuran||0), 0);
  const totalPiutang   = customers.reduce((c,x) => {
    const pays = payments.filter(p=>p.customerId===x.id);
    const { totalBayar } = hitungAngsuran(x);
    const dibayar = pays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    return c + Math.max(0, totalBayar - dibayar);
  }, 0);

  // ROI = total profit / total modal * 100
  const roi       = totalModal > 0 ? (totalProfit/totalModal*100).toFixed(1) : 0;
  const roiTarget = totalModal > 0 ? (customers.reduce((s,c)=>s+hitungAngsuran(c).totalProfit,0)/totalModal*100).toFixed(1) : 0;

  document.getElementById('modal-stats').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-bank"/></svg></div>
      <div class="stat-info"><div class="stat-label">Total Modal Kredit</div>
      <div class="stat-value">${formatRupiah(totalModal)}</div>
      <div class="stat-sub">Total harga barang: ${formatRupiah(totalHarga)}</div></div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-trend"/></svg></div>
      <div class="stat-info"><div class="stat-label">Profit Diterima</div>
      <div class="stat-value">${formatRupiah(totalProfit)}</div>
      <div class="stat-sub">ROI terealisasi: ${roi}%</div></div>
    </div>
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-chart"/></svg></div>
      <div class="stat-info"><div class="stat-label">Target Profit Total</div>
      <div class="stat-value">${formatRupiah(customers.reduce((s,c)=>s+hitungAngsuran(c).totalProfit,0))}</div>
      <div class="stat-sub">ROI target: ${roiTarget}%</div></div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-money"/></svg></div>
      <div class="stat-info"><div class="stat-label">Modal Belum Kembali</div>
      <div class="stat-value">${formatRupiah(totalPiutang)}</div>
      <div class="stat-sub">masih di tangan pelanggan</div></div>
    </div>`;

  // Chart komposisi modal
  if (modalChartInst) modalChartInst.destroy();
  const ctx1 = document.getElementById('modalChart').getContext('2d');
  const modalKembali = totalDiterima - totalProfit; // pokok yang sudah kembali
  modalChartInst = new Chart(ctx1, {
    type:'doughnut',
    data:{ labels:['Modal Kembali','Modal di Pelanggan','Profit Diterima'],
      datasets:[{ data:[modalKembali, totalPiutang - (totalPiutang - Math.max(0,totalModal-modalKembali)), totalProfit].map(v=>Math.max(0,v)),
        backgroundColor:['#3b82f6','#f59e0b','#10b981'], borderWidth:2 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom'}, tooltip:{callbacks:{label:c=>`${c.label}: ${formatRupiah(c.parsed)}`}}}
    }
  });

  // ROI chart per tahun
  const yearlyROI = {};
  payments.forEach(p => {
    const yr = p.tgl?.slice(0,4); if (!yr) return;
    if (!yearlyROI[yr]) yearlyROI[yr] = { profit:0, modal:0 };
    yearlyROI[yr].profit += p.cicilan||0;
  });
  customers.forEach(c => {
    const yr = c.tgl?.slice(0,4); if (!yr) return;
    if (!yearlyROI[yr]) yearlyROI[yr] = { profit:0, modal:0 };
    yearlyROI[yr].modal += c.kreditPokok||0;
  });
  const roiYears = Object.keys(yearlyROI).sort();
  const roiData  = roiYears.map(y => yearlyROI[y].modal>0 ? parseFloat((yearlyROI[y].profit/yearlyROI[y].modal*100).toFixed(1)) : 0);

  if (roiChartInst) roiChartInst.destroy();
  const ctx2 = document.getElementById('roiChart').getContext('2d');
  roiChartInst = new Chart(ctx2, {
    type:'bar',
    data:{ labels:roiYears, datasets:[{ label:'ROI (%)', data:roiData, backgroundColor:'rgba(16,185,129,.8)', borderRadius:6 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`ROI: ${c.parsed.y}%`}}},
      scales:{ y:{ticks:{callback:v=>v+'%'}, grid:{color:'#f1f5f9'}}, x:{grid:{display:false}} }
    }
  });
}

// ============================================================
// TAB ANALISA BARANG
// ============================================================
function renderBarang() {
  const customers = getCustomers();
  const payments  = getPayments();

  // Kelompokkan per jenis barang (ambil kata pertama-kedua)
  const barangMap = {};
  customers.forEach(c => {
    const key = c.barang;
    if (!barangMap[key]) barangMap[key] = { nama:c.barang, count:0, totalKredit:0, totalProfit:0, totalDp:0 };
    barangMap[key].count++;
    barangMap[key].totalKredit += c.kreditPokok||0;
    barangMap[key].totalDp     += c.dp||0;
    barangMap[key].totalProfit += hitungAngsuran(c).totalProfit;
  });

  const sorted = Object.values(barangMap).sort((a,b)=>b.count-a.count).slice(0,15);
  const maxCount = sorted[0]?.count || 1;

  // Stats
  const avgKredit = customers.length ? customers.reduce((s,c)=>s+(c.kreditPokok||0),0)/customers.length : 0;
  const topBarang = sorted[0];

  document.getElementById('barang-stats').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-box"/></svg></div>
      <div class="stat-info"><div class="stat-label">Jenis Barang Berbeda</div>
      <div class="stat-value">${Object.keys(barangMap).length}</div>
      <div class="stat-sub">dari ${customers.length} kredit</div></div>
    </div>
    <div class="stat-card teal">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-trend"/></svg></div>
      <div class="stat-info"><div class="stat-label">Barang Terlaris</div>
      <div class="stat-value" style="font-size:13px;">${topBarang?.nama||'-'}</div>
      <div class="stat-sub">${topBarang?.count||0}x dikreditkan</div></div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-money"/></svg></div>
      <div class="stat-info"><div class="stat-label">Rata-rata Kredit</div>
      <div class="stat-value">${formatRupiah(avgKredit)}</div>
      <div class="stat-sub">per pelanggan</div></div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="18" height="18"><use href="#ic-trend"/></svg></div>
      <div class="stat-info"><div class="stat-label">Total Profit Barang</div>
      <div class="stat-value">${formatRupiah(sorted.reduce((s,b)=>s+b.totalProfit,0))}</div>
      <div class="stat-sub">dari semua kredit</div></div>
    </div>`;

  document.getElementById('barang-list').innerHTML = sorted.map((b,i) => `
    <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="width:20px;text-align:center;font-size:11px;font-weight:700;color:${i<3?'#d97706':'#94a3b8'}">${i+1}</span>
        <span style="flex:1;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.nama}</span>
        <span style="font-size:12px;font-weight:700;color:#0891b2;">${b.count}x</span>
      </div>
      <div style="padding-left:28px;">
        <div style="background:#f1f5f9;border-radius:4px;height:5px;margin-bottom:4px;">
          <div style="width:${(b.count/maxCount*100).toFixed(0)}%;background:#3b82f6;height:5px;border-radius:4px;"></div>
        </div>
        <div style="display:flex;gap:12px;font-size:11px;color:#64748b;">
          <span>Kredit: <strong>${formatRupiah(b.totalKredit)}</strong></span>
          <span>Profit: <strong style="color:#16a34a;">${formatRupiah(b.totalProfit)}</strong></span>
        </div>
      </div>
    </div>`).join('');

  // Chart distribusi nilai kredit
  const rangeMap = { '<500rb':0, '500rb-1jt':0, '1jt-2jt':0, '2jt-3jt':0, '3jt-5jt':0, '>5jt':0 };
  customers.forEach(c => {
    const k = c.kreditPokok||0;
    if (k < 500000) rangeMap['<500rb']++;
    else if (k < 1000000) rangeMap['500rb-1jt']++;
    else if (k < 2000000) rangeMap['1jt-2jt']++;
    else if (k < 3000000) rangeMap['2jt-3jt']++;
    else if (k < 5000000) rangeMap['3jt-5jt']++;
    else rangeMap['>5jt']++;
  });

  if (barangChartInst) barangChartInst.destroy();
  const ctx = document.getElementById('barangChart').getContext('2d');
  barangChartInst = new Chart(ctx, {
    type:'pie',
    data:{ labels:Object.keys(rangeMap), datasets:[{
      data:Object.values(rangeMap),
      backgroundColor:['#6366f1','#3b82f6','#10b981','#f59e0b','#f97316','#dc2626'], borderWidth:2
    }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom',labels:{font:{size:11}}},
        tooltip:{callbacks:{label:c=>`${c.label}: ${c.parsed} pelanggan`}}}
    }
  });
}

// ---- Export PDF sesuai tab aktif ----
function printLaporanAktif() {
  if (_lapTab === 'ringkasan')  printLaporan_ringkasan();
  else if (_lapTab === 'piutang')   printLaporan_piutang();
  else if (_lapTab === 'tunggakan') printLaporan_tunggakan();
  else if (_lapTab === 'aruskas')   printLaporan_aruskas();
  else if (_lapTab === 'modal')     printLaporan_modal();
  else if (_lapTab === 'barang')    printLaporan_barang();
}

function _openPrintWindow(title, bodyHtml) {
  const baseStyle = `* { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; padding:28px; }
    .header { text-align:center; margin-bottom:20px; border-bottom:2px solid #1e40af; padding-bottom:14px; }
    .header h1 { font-size:18px; color:#1e40af; }
    .header p { font-size:11px; color:#64748b; margin-top:3px; }
    .stats { display:flex; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
    .stat { flex:1; min-width:150px; border:1px solid #e2e8f0; border-radius:8px; padding:10px; text-align:center; }
    .stat .lbl { font-size:10px; color:#64748b; } .stat .val { font-size:15px; font-weight:700; color:#1e40af; margin-top:2px; }
    table { width:100%; border-collapse:collapse; } th { background:#1e40af; color:white; padding:7px 9px; text-align:left; font-size:10px; text-transform:uppercase; }
    td { padding:6px 9px; border-bottom:1px solid #f1f5f9; font-size:11px; } tr:nth-child(even) td { background:#f8fafc; }
    .tr { text-align:right; } tfoot td { font-weight:700; background:#eff6ff !important; color:#1e40af; border-top:2px solid #1e40af; }
    .footer { text-align:center; font-size:10px; color:#94a3b8; margin-top:18px; border-top:1px solid #e2e8f0; padding-top:10px; }
    @media print { body { padding:15px; } @page { margin:15mm; } }`;
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>${title}</title><style>${baseStyle}</style></head><body>
    <div class="header"><h1>${title}</h1><p>KreditPro — Ruli Rizki Ariyanto &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p></div>
    ${bodyHtml}
    <div class="footer">KreditPro &copy; ${new Date().getFullYear()}</div></body></html>`;
  const w = window.open('','_blank','width=960,height=700');
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>w.print(), 500);
}

function printLaporan_ringkasan() {
  const year = document.getElementById('lap-year')?.value || new Date().getFullYear();
  const payments = getPayments(); const customers = getCustomers();
  const yp = payments.filter(p=>p.tgl?.startsWith(year));
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const rows = months.map((mn,i)=>{
    const mo=String(i+1).padStart(2,'0'); const mp=yp.filter(p=>p.tgl?.slice(5,7)===mo);
    return `<tr><td>${mn}</td><td class="tr">${mp.length}</td><td class="tr">${formatRupiah(mp.reduce((s,p)=>s+(p.jumlahAngsuran||0),0))}</td><td class="tr">${formatRupiah(mp.reduce((s,p)=>s+(p.cicilan||0),0))}</td></tr>`;
  }).join('');
  _openPrintWindow(`Laporan Profit Tahun ${year}`, `
    <div class="stats">
      <div class="stat"><div class="lbl">Transaksi</div><div class="val">${yp.length}</div></div>
      <div class="stat"><div class="lbl">Uang Masuk</div><div class="val">${formatRupiah(yp.reduce((s,p)=>s+(p.jumlahAngsuran||0),0))}</div></div>
      <div class="stat"><div class="lbl">Profit</div><div class="val">${formatRupiah(yp.reduce((s,p)=>s+(p.cicilan||0),0))}</div></div>
      <div class="stat"><div class="lbl">Total Pelanggan</div><div class="val">${customers.length}</div></div>
    </div>
    <table><thead><tr><th>Bulan</th><th class="tr">Transaksi</th><th class="tr">Uang Masuk</th><th class="tr">Profit</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>TOTAL</td><td class="tr">${yp.length}</td><td class="tr">${formatRupiah(yp.reduce((s,p)=>s+(p.jumlahAngsuran||0),0))}</td><td class="tr">${formatRupiah(yp.reduce((s,p)=>s+(p.cicilan||0),0))}</td></tr></tfoot></table>`);
}

function printLaporan_piutang() {
  const customers = getCustomers(); const payments = getPayments();
  let totalTagihan=0, totalDibayar=0, totalSisa=0;
  const rows = customers.map(c=>{
    const pays=payments.filter(p=>p.customerId===c.id);
    const {totalBayar}=hitungAngsuran(c);
    const dibayar=pays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    const sisa=Math.max(0,totalBayar-dibayar);
    totalTagihan+=totalBayar; totalDibayar+=dibayar; totalSisa+=sisa;
    const st=getStatusKredit(c);
    return `<tr><td>${c.nama}<br><span style="font-size:10px;color:#64748b">${c.id}</span></td><td>${c.barang}</td><td class="tr">${formatRupiah(totalBayar)}</td><td class="tr">${formatRupiah(dibayar)}</td><td class="tr" style="color:${sisa>0?'#dc2626':'#16a34a'}">${formatRupiah(sisa)}</td><td>${st}</td></tr>`;
  }).join('');
  _openPrintWindow('Laporan Piutang Pelanggan', `
    <div class="stats">
      <div class="stat"><div class="lbl">Total Piutang</div><div class="val" style="color:#dc2626">${formatRupiah(totalSisa)}</div></div>
      <div class="stat"><div class="lbl">Sudah Diterima</div><div class="val" style="color:#16a34a">${formatRupiah(totalDibayar)}</div></div>
      <div class="stat"><div class="lbl">Total Tagihan</div><div class="val">${formatRupiah(totalTagihan)}</div></div>
    </div>
    <table><thead><tr><th>Pelanggan</th><th>Barang</th><th class="tr">Total Tagihan</th><th class="tr">Dibayar</th><th class="tr">Sisa</th><th>Status</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2">TOTAL</td><td class="tr">${formatRupiah(totalTagihan)}</td><td class="tr">${formatRupiah(totalDibayar)}</td><td class="tr" style="color:#dc2626">${formatRupiah(totalSisa)}</td><td></td></tr></tfoot></table>`);
}

function printLaporan_tunggakan() {
  const customers=getCustomers(); const payments=getPayments(); const today=new Date();
  let totalTunggak=0;
  const rows=customers.map(c=>{
    const pays=payments.filter(p=>p.customerId===c.id);
    const {angsuranPerBulan,totalBayar}=hitungAngsuran(c);
    const dibayar=pays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    if(dibayar>=totalBayar) return '';
    const tglK=new Date(c.tgl); let bulan=0;
    for(let i=1;i<=c.tenor;i++){const t=new Date(tglK);t.setMonth(t.getMonth()+i);if(t<=today)bulan=i;}
    const seharusnya=Math.min(angsuranPerBulan*bulan,totalBayar);
    const selisih=Math.max(0,seharusnya-dibayar);
    if(selisih<1) return '';
    totalTunggak+=selisih;
    return `<tr><td>${c.nama}</td><td>${c.barang}</td><td class="tr">${formatRupiah(angsuranPerBulan)}</td><td class="tr">${formatRupiah(seharusnya)}</td><td class="tr">${formatRupiah(dibayar)}</td><td class="tr" style="color:#dc2626;font-weight:700">${formatRupiah(selisih)}</td></tr>`;
  }).join('');
  _openPrintWindow('Laporan Tunggakan', `
    <div class="stats"><div class="stat"><div class="lbl">Total Tunggakan</div><div class="val" style="color:#dc2626">${formatRupiah(totalTunggak)}</div></div></div>
    <table><thead><tr><th>Pelanggan</th><th>Barang</th><th class="tr">Angsuran/Bln</th><th class="tr">Seharusnya</th><th class="tr">Dibayar</th><th class="tr">Selisih</th></tr></thead><tbody>${rows||'<tr><td colspan="6" style="text-align:center">Tidak ada tunggakan</td></tr>'}</tbody></table>`);
}

function printLaporan_aruskas() {
  const payments=getPayments();
  const bulanSet=[...new Set(payments.map(p=>p.tgl?.slice(0,7)).filter(Boolean))].sort().slice(-12);
  let rows='', prevU=0;
  bulanSet.forEach(m=>{
    const mp=payments.filter(p=>p.tgl?.startsWith(m));
    const u=mp.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    const pr=mp.reduce((s,p)=>s+(p.cicilan||0),0);
    const [y,mo]=m.split('-');
    const vs=prevU>0?((u-prevU)/prevU*100).toFixed(1):'-';
    rows+=`<tr><td>${new Date(y,mo-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</td><td class="tr">${mp.length}</td><td class="tr">${formatRupiah(u)}</td><td class="tr">${formatRupiah(pr)}</td><td class="tr" style="color:${vs==='-'?'inherit':Number(vs)>=0?'#16a34a':'#dc2626'}">${vs==='-'?'-':(Number(vs)>=0?'▲':'▼')+Math.abs(vs)+'%'}</td></tr>`;
    prevU=u;
  });
  _openPrintWindow('Laporan Arus Kas (12 Bulan Terakhir)', `
    <table><thead><tr><th>Bulan</th><th class="tr">Transaksi</th><th class="tr">Uang Masuk</th><th class="tr">Profit</th><th class="tr">vs Bln Lalu</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function printLaporan_modal() {
  const customers=getCustomers(); const payments=getPayments();
  const totalModal=customers.reduce((s,c)=>s+c.kreditPokok,0);
  const totalProfit=payments.reduce((s,p)=>s+(p.cicilan||0),0);
  const roi=totalModal>0?(totalProfit/totalModal*100).toFixed(1):0;
  const totalPiutang=customers.reduce((acc,c)=>{
    const pays=payments.filter(p=>p.customerId===c.id);
    const {totalBayar}=hitungAngsuran(c);
    return acc+Math.max(0,totalBayar-pays.reduce((s,p)=>s+(p.jumlahAngsuran||0),0));
  },0);
  _openPrintWindow('Laporan Modal & ROI', `
    <div class="stats">
      <div class="stat"><div class="lbl">Total Modal</div><div class="val">${formatRupiah(totalModal)}</div></div>
      <div class="stat"><div class="lbl">Profit Diterima</div><div class="val" style="color:#16a34a">${formatRupiah(totalProfit)}</div></div>
      <div class="stat"><div class="lbl">ROI Terealisasi</div><div class="val" style="color:#0891b2">${roi}%</div></div>
      <div class="stat"><div class="lbl">Modal di Pelanggan</div><div class="val" style="color:#dc2626">${formatRupiah(totalPiutang)}</div></div>
    </div>`);
}

function printLaporan_barang() {
  const customers=getCustomers(); const payments=getPayments();
  const map={};
  customers.forEach(c=>{
    if(!map[c.barang]) map[c.barang]={nama:c.barang,count:0,kredit:0,profit:0};
    map[c.barang].count++; map[c.barang].kredit+=c.kreditPokok;
    map[c.barang].profit+=hitungAngsuran(c).totalProfit;
  });
  const sorted=Object.values(map).sort((a,b)=>b.count-a.count);
  const rows=sorted.map((b,i)=>`<tr><td>${i+1}</td><td>${b.nama}</td><td class="tr">${b.count}</td><td class="tr">${formatRupiah(b.kredit)}</td><td class="tr">${formatRupiah(b.profit)}</td></tr>`).join('');
  _openPrintWindow('Laporan Analisa Barang', `
    <table><thead><tr><th>#</th><th>Barang</th><th class="tr">Jumlah</th><th class="tr">Total Kredit</th><th class="tr">Total Profit</th></tr></thead><tbody>${rows}</tbody></table>`);
}

// ============================================================
//  KARTU ANGSURAN
// ============================================================
let kartuCurrentPage = 1;

async function renderKartuList() {
  const search = document.getElementById('kartu-search').value.toLowerCase();
  const filterStatus = document.getElementById('kartu-filter-status').value;

  let customers = getCustomers().filter(c => {
    const matchSearch = !search || c.nama.toLowerCase().includes(search) || c.id.toLowerCase().includes(search);
    const matchStatus = !filterStatus || getStatusKredit(c) === filterStatus;
    return matchSearch && matchStatus;
  });

  const total = customers.length;
  const totalPages = Math.ceil(total / 12);
  const start = (PG.kartu - 1) * 12;
  const paged = customers.slice(start, start + 12);

  // Preload photos
  await preloadPhotos(paged.map(c => c.id));

  const grid = document.getElementById('kartu-list-grid');
  if (!paged.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🗂️</div><p>Tidak ada kartu angsuran</p></div>`;
  } else {
    grid.innerHTML = paged.map(c => buildKartuCard(c)).join('');
  }

  renderPagination('kartu-pagination', PG.kartu, totalPages, page => {
    PG.kartu = page; renderKartuList();
  });
}

function buildKartuCard(c) {
  const payments = getPaymentsByCustomer(c.id);
  const { angsuranPerBulan, cicilanPerBulan, totalBayar } = hitungAngsuran(c);
  const totalDibayar = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
  const progress = Math.min(100, (totalDibayar / totalBayar) * 100);
  const status = getStatusKredit(c);
  const badgeClass = status==='lunas'?'badge-green':status==='menunggak'?'badge-red':'badge-blue';
  const sisa = Math.max(0, totalBayar - totalDibayar);

  // count paid installments
  const paidCount = Math.min(Math.floor(totalDibayar / angsuranPerBulan), c.tenor);

  return `
  <div class="card" style="padding:0;overflow:hidden;cursor:pointer;" onclick="viewCustomer('${c.id}')">
    ${getCustPhotoSync(c.id)
      ? `<img src="${getCustPhotoSync(c.id)}" class="kartu-cust-photo" alt="${c.nama}">`
      : getItemPhotosSync(c.id).length > 0
        ? `<div style="position:relative;"><img src="${getItemPhotosSync(c.id)[0]}" class="kartu-cust-photo" alt="${c.barang}">
           <div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;">📦 ${getItemPhotosSync(c.id).length} foto</div></div>`
        : ''}
    <div style="background:linear-gradient(135deg,#1e40af,#0891b2);color:white;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;opacity:.75;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">KARTU ANGSURAN</div>
          <div style="font-size:15px;font-weight:700;line-height:1.2;margin-top:2px;">${c.nama}</div>
          <div style="font-size:11px;opacity:.8;margin-top:1px;">${c.id}</div>
        </div>
        <span class="badge ${badgeClass}" style="font-size:10px;">${status}</span>
      </div>
      <div style="font-size:11px;opacity:.8;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.barang}</div>
      <div class="progress-bar" style="background:rgba(255,255,255,.3);">
        <div class="progress-fill" style="width:${progress.toFixed(0)}%;background:white;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px;opacity:.9;">
        <span>${paidCount}/${c.tenor} angsuran</span>
        <span>${progress.toFixed(0)}%</span>
      </div>
    </div>
    <div style="padding:12px 14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div>
          <div style="color:#94a3b8;font-size:10px;">Kredit Pokok</div>
          <div style="font-weight:600;">${formatRupiah(c.kreditPokok)}</div>
        </div>
        <div>
          <div style="color:#94a3b8;font-size:10px;">Angsuran/Bln</div>
          <div style="font-weight:600;color:#15803d;">${formatRupiah(angsuranPerBulan)}</div>
        </div>
        <div>
          <div style="color:#94a3b8;font-size:10px;">Sudah Dibayar</div>
          <div style="font-weight:600;color:#0891b2;">${formatRupiah(totalDibayar)}</div>
        </div>
        <div>
          <div style="color:#94a3b8;font-size:10px;">Sisa Tagihan</div>
          <div style="font-weight:600;color:${sisa>0?'#dc2626':'#15803d'};">${sisa>0?formatRupiah(sisa):'Lunas'}</div>
        </div>
      </div>
      ${c.nik || c.alamat ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:11px;color:#64748b;">
        ${c.nik   ? `<div>🪪 NIK: <span style="font-family:monospace;">${c.nik}</span></div>` : ''}
        ${c.alamat ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;" title="${c.alamat}">📍 ${c.alamat}</div>` : ''}
        ${c.noSeri ? `<div style="margin-top:2px;">🔖 Seri: <span style="font-family:monospace;">${c.noSeri}</span></div>` : ''}
      </div>` : ''}
      <div style="margin-top:10px;display:flex;gap:6px;" onclick="event.stopPropagation()">
        <button class="btn btn-outline btn-xs" style="flex:1;" onclick="viewCustomer('${c.id}')">
          <svg width="13" height="13"><use href="#ic-eye"/></svg> Detail
        </button>
        <button class="btn btn-success btn-xs" onclick="waQuickSendCustomer('${c.id}')" title="Kirim WA">
          <svg width="13" height="13"><use href="#ic-whatsapp"/></svg>
        </button>
        <button class="btn btn-primary btn-xs" style="flex:1;" onclick="openPayModal('${c.id}')">
          <svg width="13" height="13"><use href="#ic-plus"/></svg> Bayar
        </button>
      </div>
    </div>
  </div>`;
}

function exportKartuAll() {
  const customers = getCustomers();
  let csv = 'ID,Nama,Barang,Kredit Pokok,Tenor,Angsuran/Bln,Total Bayar,Total Dibayar,Sisa,Status\n';
  customers.forEach(c => {
    const { angsuranPerBulan, totalBayar } = hitungAngsuran(c);
    const payments = getPaymentsByCustomer(c.id);
    const totalDibayar = payments.reduce((s,p)=>s+(p.jumlahAngsuran||0),0);
    const sisa = Math.max(0, totalBayar - totalDibayar);
    const status = getStatusKredit(c);
    csv += `${c.id},"${c.nama}","${c.barang}",${c.kreditPokok},${c.tenor},${Math.round(angsuranPerBulan)},${Math.round(totalBayar)},${Math.round(totalDibayar)},${Math.round(sisa)},${status}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kartu-angsuran-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Export berhasil', 'success');
}

// ============================================================
//  PAGINATION
// ============================================================

// Store pagination callbacks globally
const PG_CALLBACKS = {};

function renderPagination(containerId, current, total, onClick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  // Store callback
  PG_CALLBACKS[containerId] = onClick;

  const range = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 2 && i <= current + 2)) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }

  let html = `<button class="page-btn" ${current===1?'disabled':''} onclick="pgGo('${containerId}',${current-1})">‹</button>`;
  range.forEach(p => {
    if (p === '...') {
      html += `<span style="padding:0 4px;color:#94a3b8;">…</span>`;
    } else {
      html += `<button class="page-btn ${p===current?'active':''}" onclick="pgGo('${containerId}',${p})">${p}</button>`;
    }
  });
  html += `<button class="page-btn" ${current===total?'disabled':''} onclick="pgGo('${containerId}',${current+1})">›</button>`;
  el.innerHTML = html;
}

function pgGo(containerId, page) {
  if (PG_CALLBACKS[containerId]) PG_CALLBACKS[containerId](page);
}

// ============================================================
//  AUTH UI
// ============================================================

function renderSidebarUser() {
  const s = getSession();
  if (!s) return;
  const el = document.getElementById('sidebar-avatar');
  const unEl = document.getElementById('sidebar-username');
  const roleEl = document.getElementById('sidebar-role');
  if (el) el.textContent = s.avatar || s.displayName[0];
  if (unEl) unEl.textContent = s.displayName || s.username;
  if (roleEl) roleEl.textContent = s.role === 'owner' ? '👑 Owner' : '👤 Staff';
}

function doLogout() {
  document.getElementById('confirmMsg').textContent = 'Yakin ingin keluar dari sistem?';
  document.getElementById('confirmOkBtn').textContent = 'Ya, Keluar';
  document.getElementById('confirmOkBtn').className = 'btn btn-danger';
  document.getElementById('confirmOkBtn').onclick = () => {
    logout();
    window.location.href = 'login.html';
  };
  openModal('confirmModal');
}

// ---- ACCOUNT MODAL ----
let activeAccountTab = 'tab-profile';

function openAccountModal() {
  activeAccountTab = 'tab-profile';
  switchAccountTab('tab-profile');
  renderProfileTab();
  renderUsersTab();
  renderLogTab();
  openModal('accountModal');
}

function switchAccountTab(tabId) {
  activeAccountTab = tabId;
  document.querySelectorAll('#accountModal .tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  // update tab buttons
  const btns = document.querySelectorAll('#accountModal .tab-btn');
  const tabs = ['tab-profile','tab-password','tab-users','tab-log'];
  btns.forEach((btn, i) => btn.classList.toggle('active', tabs[i] === tabId));

  // show/hide save button
  const saveBtn = document.getElementById('pw-save-btn');
  if (saveBtn) saveBtn.style.display = tabId === 'tab-password' ? 'flex' : 'none';

  if (tabId === 'tab-password') {
    document.getElementById('pw-old').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
    document.getElementById('pw-change-alert').style.display = 'none';
  }
}

async function renderProfileTab() {
  const s = getSession();
  if (!s) return;
  const users = await getUsers();
  const user = users.find(u => u.id === s.userId);

  document.getElementById('acc-avatar-big').textContent = s.avatar || s.displayName[0];
  document.getElementById('acc-displayname').textContent = s.displayName;
  document.getElementById('acc-username-lbl').textContent = '@' + s.username;
  document.getElementById('acc-role-badge').textContent = s.role === 'owner' ? '👑 Owner' : '👤 Staff';

  const lastLogin = user?.lastLogin ? formatTgl(user.lastLogin.slice(0,10)) + ' ' + user.lastLogin.slice(11,16) : '-';
  document.getElementById('acc-lastlogin').textContent = lastLogin;

  const expDate = new Date(s.expiresAt);
  document.getElementById('acc-session-exp').textContent =
    expDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) +
    ' · ' + expDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
}

async function renderUsersTab() {
  const s = getSession();
  const users = await getUsers();
  const isOwner = s?.role === 'owner';

  if (!isOwner) {
    document.getElementById('users-list-wrap').innerHTML =
      `<div class="alert alert-info">⚠️ Hanya Owner yang dapat mengelola pengguna.</div>`;
    // hide add form
    const addSection = document.querySelector('#tab-users hr');
    if (addSection) {
      let next = addSection.nextSibling;
      while (next) { const n = next.nextSibling; next.style && (next.style.display='none'); next=n; }
      addSection.style.display = 'none';
    }
    return;
  }

  document.getElementById('users-list-wrap').innerHTML = `
    <div style="font-size:13px;font-weight:600;color:#334155;margin-bottom:10px;">Daftar Pengguna (${users.length})</div>
    ${users.map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0;">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#0ea5e9);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;flex-shrink:0;">${u.avatar||u.displayName[0]}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${u.displayName}</div>
        <div style="font-size:11px;color:#94a3b8;">@${u.username} · ${u.role === 'owner' ? '👑 Owner' : '👤 Staff'}</div>
        <div style="font-size:11px;color:#94a3b8;">Login terakhir: ${u.lastLogin ? u.lastLogin.slice(0,10) : 'Belum pernah'}</div>
      </div>
      ${u.id !== s.userId ? `<button class="btn btn-danger btn-xs" onclick="confirmDeleteUser('${u.id}','${u.displayName}')">🗑 Hapus</button>` : '<span class="badge badge-green" style="font-size:10px;">Anda</span>'}
    </div>`).join('')}`;
}

function confirmDeleteUser(userId, name) {
  const s = getSession();
  if (s?.userId === userId) { toast('Tidak bisa menghapus akun sendiri!', 'danger'); return; }
  document.getElementById('confirmMsg').innerHTML = `Hapus pengguna <strong>${name}</strong>?`;
  document.getElementById('confirmOkBtn').textContent = 'Hapus';
  document.getElementById('confirmOkBtn').className = 'btn btn-danger';
  document.getElementById('confirmOkBtn').onclick = () => {
    const users = getUsers().filter(u => u.id !== userId);
    saveUsers(users);
    closeModal('confirmModal');
    renderUsersTab();
    toast('Pengguna dihapus', 'danger');
  };
  openModal('confirmModal');
}

async function submitAddUser() {
  const username    = document.getElementById('new-user-username').value.trim();
  const displayName = document.getElementById('new-user-name').value.trim();
  const password    = document.getElementById('new-user-password').value;
  const role        = document.getElementById('new-user-role').value;

  const alertEl = document.getElementById('add-user-alert');
  const showErr = msg => {
    alertEl.className = 'alert alert-danger';
    alertEl.innerHTML = '❌ ' + msg;
    alertEl.style.display = 'flex';
  };

  if (!username || !displayName || !password) { showErr('Semua field wajib diisi.'); return; }
  if (password.length < 6) { showErr('Password minimal 6 karakter.'); return; }

  const result = await addUser(username, password, displayName, role);
  if (!result?.ok) { showErr(result?.error || 'Gagal menambahkan user'); return; }

  alertEl.className = 'alert alert-success';
  alertEl.innerHTML = 'Pengguna berhasil ditambahkan.';
  alertEl.style.display = 'flex';

  document.getElementById('new-user-username').value = '';
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-password').value = '';
  await renderUsersTab();
  toast('Pengguna baru ditambahkan', 'success');
}

function submitChangePassword() {
  const s        = getSession();
  const oldPw    = document.getElementById('pw-old').value;
  const newPw    = document.getElementById('pw-new').value;
  const confirm  = document.getElementById('pw-confirm').value;
  const alertEl  = document.getElementById('pw-change-alert');

  const showErr = msg => {
    alertEl.className = 'alert alert-danger';
    alertEl.innerHTML = '❌ ' + msg;
    alertEl.style.display = 'flex';
  };

  if (!oldPw || !newPw || !confirm) { showErr('Semua field wajib diisi.'); return; }
  if (newPw !== confirm) { showErr('Konfirmasi password tidak cocok.'); return; }
  if (newPw.length < 6) { showErr('Password baru minimal 6 karakter.'); return; }
  if (oldPw === newPw) { showErr('Password baru tidak boleh sama dengan password lama.'); return; }

  const result = changePassword(s.userId, oldPw, newPw);
  if (!result.ok) { showErr(result.reason); return; }

  alertEl.className = 'alert alert-success';
  alertEl.innerHTML = 'Password berhasil diubah. Anda akan diminta login ulang...';
  alertEl.style.display = 'flex';

  setTimeout(() => {
    logout();
    window.location.href = 'login.html';
  }, 2000);
}

async function renderLogTab() {
  const allLogs = await getLogs();
  const logs = allLogs.slice(0, 50);
  const actionLabels = {
    login: '🔓 Login',
    logout: '🔒 Logout',
    change_password: '🔐 Ubah Password'
  };

  if (!logs.length) {
    document.getElementById('activity-log').innerHTML =
      '<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada aktivitas</p></div>';
    return;
  }

  document.getElementById('activity-log').innerHTML = `
    <div style="max-height:320px;overflow-y:auto;">
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;background:#f8fafc;">Waktu</th>
            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;background:#f8fafc;">Pengguna</th>
            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;background:#f8fafc;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(l => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px;color:#64748b;white-space:nowrap;">${new Date(l.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
            <td style="padding:8px;font-weight:600;">@${l.username}</td>
            <td style="padding:8px;">${actionLabels[l.action] || l.action} — <span style="color:#64748b;">${l.detail}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ---- SESSION EXPIRY WARNING ----
(function startSessionWatch() {
  setInterval(() => {
    const s = getSession();
    if (!s) {
      // Session expired while app was open
      toast('Sesi Anda telah berakhir. Mengalihkan ke halaman login...', 'warning');
      setTimeout(() => { window.location.href = 'login.html'; }, 2500);
      return;
    }
    const remaining = s.expiresAt - Date.now();
    // Warn at 10 minutes remaining
    if (remaining > 0 && remaining < 10 * 60 * 1000 && !window._sessionWarnShown) {
      window._sessionWarnShown = true;
      toast('Sesi akan berakhir dalam 10 menit. Klik di mana saja untuk perpanjang.', 'warning');
    }
    if (remaining > 10 * 60 * 1000) {
      window._sessionWarnShown = false;
    }
  }, 30000); // check every 30s
})();

// ============================================================
//  WHATSAPP MODULE
// ============================================================

const WA_LOG_KEY = 'bk_wa_log';
let waBlastQueue = [];
let waPreviewData = { phone: '', message: '' };

// ---- PHONE HELPER ----
function normalizePhone(raw) {
  if (!raw || raw === '-') return null;
  let p = raw.toString().replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
}

function buildWaUrl(phone, message) {
  const p = normalizePhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

// ---- MESSAGE TEMPLATES ----
function buildMessage(templateKey, customer) {
  const { angsuranPerBulan, cicilanPerBulan, totalBayar } = hitungAngsuran(customer);
  const payments = getPaymentsByCustomer(customer.id);
  const totalDibayar = payments.reduce((s, p) => s + (p.jumlahAngsuran || 0), 0);
  const sisa = Math.max(0, totalBayar - totalDibayar);
  const angsuranKe = payments.length + 1;

  // Due date calculation
  const tglKredit = new Date(customer.tgl);
  const tglTempo = new Date(tglKredit);
  tglTempo.setMonth(tglTempo.getMonth() + angsuranKe);
  const tglTempoStr = tglTempo.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const header = `Assalamu'alaikum / Halo, *${customer.nama}* 🙏`;
  const footer = `\n\nInfo lebih lanjut hubungi kami.\nTerima kasih atas kepercayaannya. 🙏\n\n_— Bisnis Kredit Ruli Rizki Ariyanto_`;

  const templates = {
    tagihan: `${header}\n\nBerikut info tagihan angsuran Anda:\n\n📦 *Barang:* ${customer.barang}\n *Angsuran ke:* ${angsuranKe} dari ${customer.tenor}\n💰 *Jumlah Angsuran:* ${formatRupiah(angsuranPerBulan)}\n📅 *Jatuh Tempo:* ${tglTempoStr}\n📊 *Sisa Tagihan:* ${formatRupiah(sisa)}\n\nMohon untuk segera melakukan pembayaran tepat waktu.${footer}`,

    jatuh_tempo: `${header}\n\n⏰ *PENGINGAT JATUH TEMPO*\n\nAngsuran Anda akan jatuh tempo pada:\n📅 *${tglTempoStr}*\n\n📦 *Barang:* ${customer.barang}\n💰 *Angsuran ke-${angsuranKe}:* ${formatRupiah(angsuranPerBulan)}\n\nHarap lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari keterlambatan. ✅${footer}`,

    terlambat: `${header}\n\n⚠️ *PEMBERITAHUAN KETERLAMBATAN*\n\nKami ingin mengingatkan bahwa angsuran Anda sudah melewati tanggal jatuh tempo.\n\n📦 *Barang:* ${customer.barang}\n💰 *Jumlah Tertunggak:* ${formatRupiah(sisa)}\n🔢 *Angsuran ke:* ${angsuranKe} dari ${customer.tenor}\n\nMohon segera lakukan pembayaran untuk menghindari penumpukan tunggakan.\n\nJika ada kendala, silakan hubungi kami untuk berkoordinasi. 🙏${footer}`,

    lunas: `${header}\n\n🎉 *SELAMAT! ANGSURAN LUNAS!*\n\nKami dengan senang hati memberitahukan bahwa seluruh kewajiban angsuran Anda telah *LUNAS*.\n\n📦 *Barang:* ${customer.barang}\n✅ *Status:* LUNAS\n💰 *Total Dibayar:* ${formatRupiah(totalDibayar)}\n\nTerima kasih atas kepercayaan dan kedisiplinan Anda dalam membayar angsuran. Semoga barang yang dibeli bermanfaat! 😊${footer}`,

    custom: ''
  };

  return templates[templateKey] || '';
}

// ---- RENDER WA PAGE ----
function renderWhatsAppPage() {
  renderWaStats();
  waPopulateCustDropdown();
  waLoadBlastList();
  renderWaLog();
}

async function renderWaStats() {
  const customers = getCustomers();
  const logs = await DB.walogs.getAll();
  const menunggak = customers.filter(c => getStatusKredit(c) === 'menunggak').length;
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const sentThisMonth = logs.filter(l => l.sentAt?.startsWith(thisMonth)).length;
  const hasPhone = customers.filter(c => normalizePhone(c.noHp)).length;

  document.getElementById('wa-stats-grid').innerHTML = `
    <div class="stat-card green">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-whatsapp"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Punya Nomor WA</div>
        <div class="stat-value">${hasPhone}</div>
        <div class="stat-sub">dari ${customers.length} pelanggan</div>
      </div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-alert"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Menunggak</div>
        <div class="stat-value">${menunggak}</div>
        <div class="stat-sub">Segera kirim reminder</div>
      </div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><svg width="20" height="20"><use href="#ic-wa-send"/></svg></div>
      <div class="stat-info">
        <div class="stat-label">Pesan Dikirim Bulan Ini</div>
        <div class="stat-value">${sentThisMonth}</div>
        <div class="stat-sub">Total: ${logs.length} pesan</div>
      </div>
    </div>`;
}

function waPopulateCustDropdown() {
  const customers = getCustomers()
    .filter(c => getStatusKredit(c) !== 'lunas')
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const sel = document.getElementById('wa-quick-cust');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
    customers.map(c => {
      const hasPhone = normalizePhone(c.noHp) ? '' : ' ⚠️ (no HP kosong)';
      return `<option value="${c.id}">${c.nama} (${c.id})${hasPhone}</option>`;
    }).join('');
}

function waFillQuickInfo() {
  const id = document.getElementById('wa-quick-cust').value;
  const infoEl = document.getElementById('wa-quick-info');
  if (!id) { infoEl.style.display = 'none'; document.getElementById('wa-message-box').value = ''; return; }

  const c = getCustomerById(id);
  const { angsuranPerBulan, totalBayar } = hitungAngsuran(c);
  const payments = getPaymentsByCustomer(id);
  const totalDibayar = payments.reduce((s, p) => s + (p.jumlahAngsuran || 0), 0);
  const sisa = Math.max(0, totalBayar - totalDibayar);
  const phone = normalizePhone(c.noHp);
  const status = getStatusKredit(c);
  const badgeClass = status === 'menunggak' ? 'badge-red' : status === 'lunas' ? 'badge-green' : 'badge-blue';

  infoEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div><strong>${c.barang}</strong></div>
      <div>${c.noHp || '—'} ${phone ? '✓' : '✗ Tidak valid'}</div>
      <div>Angsuran: <strong>${formatRupiah(angsuranPerBulan)}</strong></div>
      <div>📊 Sisa: <strong style="color:#dc2626;">${formatRupiah(sisa)}</strong></div>
      <div>Status: <span class="badge ${badgeClass}">${status}</span></div>
    </div>`;
  infoEl.style.display = 'block';

  // Auto-select best template
  const templateSel = document.getElementById('wa-template-select');
  if (status === 'menunggak') templateSel.value = 'terlambat';
  else if (status === 'lunas') templateSel.value = 'lunas';
  else templateSel.value = 'tagihan';

  waApplyTemplate();
}

function waApplyTemplate() {
  const id = document.getElementById('wa-quick-cust').value;
  const tpl = document.getElementById('wa-template-select').value;
  if (!id) return;
  const c = getCustomerById(id);
  if (!c) return;
  if (tpl === 'custom') {
    document.getElementById('wa-message-box').value = '';
    document.getElementById('wa-message-box').placeholder = 'Tulis pesan Anda di sini...';
    document.getElementById('wa-message-box').focus();
    return;
  }
  document.getElementById('wa-message-box').value = buildMessage(tpl, c);
}

function waSendSingle() {
  const id      = document.getElementById('wa-quick-cust').value;
  const message = document.getElementById('wa-message-box').value.trim();
  if (!id)      { toast('Pilih pelanggan dulu!', 'warning'); return; }
  if (!message) { toast('Isi pesan dulu!', 'warning'); return; }

  const c = getCustomerById(id);
  const phone = normalizePhone(c.noHp);

  if (!phone) {
    toast(`Nomor HP pelanggan ${c.nama} tidak valid!`, 'danger');
    return;
  }

  // Show preview first
  waPreviewData = { phone: c.noHp, message, customerId: id, custName: c.nama };
  document.getElementById('wa-preview-bubble').textContent = message;
  document.getElementById('wa-preview-phone').textContent = `${c.nama} · ${c.noHp}`;
  openModal('waPreviewModal');
}

function waOpenFromPreview() {
  const url = buildWaUrl(waPreviewData.phone, waPreviewData.message);
  if (!url) { toast('Nomor tidak valid!', 'danger'); return; }

  // Log
  waAddLog(waPreviewData.customerId, waPreviewData.custName, waPreviewData.phone, waPreviewData.message);
  closeModal('waPreviewModal');
  window.open(url, '_blank');
  toast(`Membuka WhatsApp untuk ${waPreviewData.custName}`, 'success');
  renderWaLog();
  renderWaStats();
}

function waCopyFromPreview() {
  navigator.clipboard.writeText(waPreviewData.message)
    .then(() => toast('Pesan disalin!', 'success'))
    .catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = waPreviewData.message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Pesan disalin!', 'success');
    });
}

function waCopyMessage() {
  const msg = document.getElementById('wa-message-box').value.trim();
  if (!msg) { toast('Tulis pesan dulu!', 'warning'); return; }
  navigator.clipboard.writeText(msg)
    .then(() => toast('Pesan disalin ke clipboard!', 'success'))
    .catch(() => toast('Gagal menyalin', 'danger'));
}

// ---- QUICK SEND FROM CUSTOMER TABLE ----
function waQuickSendCustomer(custId) {
  navTo('whatsapp');
  setTimeout(() => {
    const sel = document.getElementById('wa-quick-cust');
    if (sel) {
      sel.value = custId;
      waFillQuickInfo();
    }
  }, 150);
}

// ---- BLAST / BULK ----
function waLoadBlastList() {
  const filter   = document.getElementById('wa-blast-filter')?.value || 'menunggak';
  const template = document.getElementById('wa-blast-template')?.value || 'terlambat';
  const customers = getCustomers();
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let filtered = customers.filter(c => {
    const status = getStatusKredit(c);
    if (filter === 'menunggak')          return status === 'menunggak';
    if (filter === 'aktif')              return status === 'aktif';
    if (filter === 'semua')              return true;
    if (filter === 'jatuh_tempo_bulan_ini') {
      if (status === 'lunas') return false;
      // check if next due date is this month
      const payments = getPaymentsByCustomer(c.id);
      const angsuranKe = payments.length + 1;
      const tglKredit = new Date(c.tgl);
      const tglTempo = new Date(tglKredit);
      tglTempo.setMonth(tglTempo.getMonth() + angsuranKe);
      return tglTempo.toISOString().startsWith(thisMonth);
    }
    return true;
  });

  // Only those with valid phone
  const valid   = filtered.filter(c => normalizePhone(c.noHp));
  const invalid = filtered.filter(c => !normalizePhone(c.noHp));

  waBlastQueue = valid.map(c => ({
    customerId: c.id,
    custName:   c.nama,
    phone:      c.noHp,
    message:    buildMessage(template, c)
  }));

  const listEl   = document.getElementById('wa-blast-list');
  const countEl  = document.getElementById('wa-blast-count');
  if (!listEl) return;

  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Tidak ada pelanggan dalam filter ini</div>`;
    countEl.textContent = '0 pelanggan';
    return;
  }

  countEl.textContent = `${valid.length} pelanggan`;

  listEl.innerHTML = valid.map((c, i) => {
    const status = getStatusKredit(c);
    const badgeClass = status === 'menunggak' ? 'badge-red' : 'badge-orange';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">
      <div style="width:22px;text-align:center;color:#94a3b8;font-size:11px;">${i + 1}</div>
      <div class="avatar" style="width:26px;height:26px;font-size:10px;">${c.nama[0]}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nama}</div>
        <div style="color:#94a3b8;font-size:11px;">${c.noHp}</div>
      </div>
      <span class="badge ${badgeClass}" style="font-size:10px;">${status}</span>
    </div>`;
  }).join('') + (invalid.length ? `
    <div style="padding:8px 10px;font-size:11px;color:#dc2626;background:#fef2f2;">
      ⚠️ ${invalid.length} pelanggan tanpa nomor valid tidak termasuk
    </div>` : '');
}

function waUpdateBlastPreview() {
  waLoadBlastList();
}

function waStartBlast() {
  if (!waBlastQueue.length) {
    toast('Tidak ada pelanggan untuk dikirim!', 'warning'); return;
  }

  document.getElementById('confirmMsg').innerHTML =
    `Kirim pesan WhatsApp ke <strong>${waBlastQueue.length} pelanggan</strong>? <br><small style="color:#64748b;">WhatsApp akan terbuka satu per satu di browser.</small>`;
  document.getElementById('confirmOkBtn').textContent = `📱 Kirim ${waBlastQueue.length} Pesan`;
  document.getElementById('confirmOkBtn').className = 'btn btn-success';
  document.getElementById('confirmOkBtn').onclick = () => {
    closeModal('confirmModal');
    waExecuteBlast();
  };
  openModal('confirmModal');
}

function waExecuteBlast() {
  let delay = 0;
  let sent = 0;
  waBlastQueue.forEach((item, i) => {
    setTimeout(() => {
      const url = buildWaUrl(item.phone, item.message);
      if (url) {
        window.open(url, '_blank');
        waAddLog(item.customerId, item.custName, item.phone, item.message);
        sent++;
      }
      if (i === waBlastQueue.length - 1) {
        renderWaLog();
        renderWaStats();
        toast(`${sent} pesan berhasil dibuka di WhatsApp`, 'success');
      }
    }, delay);
    delay += 800; // 0.8s gap per tab to avoid browser blocking
  });
}

// ---- WA LOG ----
function waAddLog(customerId, custName, phone, message) {
  // Fire-and-forget async log to server
  DB.walogs.add({ customerId, custName, phone, message });
}

async function renderWaLog() {
  const logs = await DB.walogs.getAll();
  const el = document.getElementById('wa-log-table');
  if (!el) return;

  if (!logs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada pesan terkirim</p></div>`;
    return;
  }

  el.innerHTML = `<table>
    <thead><tr>
      <th>Waktu</th>
      <th>Pelanggan</th>
      <th>Nomor</th>
      <th>Pesan (Preview)</th>
      <th>Aksi</th>
    </tr></thead>
    <tbody>
    ${logs.slice(0, 50).map(l => `<tr>
      <td style="font-size:11px;white-space:nowrap;color:#64748b;">
        ${new Date(l.sentAt).toLocaleString('id-ID', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
      </td>
      <td>
        <div style="font-weight:600;font-size:12px;">${l.custName}</div>
        <div style="font-size:11px;color:#94a3b8;">${l.customerId}</div>
      </td>
      <td style="font-size:12px;">${l.phone}</td>
      <td style="font-size:11px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#64748b;" title="${l.message}">${l.message}</td>
      <td>
        <button class="btn btn-success btn-xs" onclick="waResend('${l.customerId}','${l.phone}')">
          <svg width="12" height="12"><use href="#ic-whatsapp"/></svg> Kirim Lagi
        </button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function waResend(customerId, phone) {
  const c = getCustomerById(customerId);
  if (!c) { toast('Pelanggan tidak ditemukan', 'danger'); return; }
  navTo('whatsapp');
  setTimeout(() => {
    const sel = document.getElementById('wa-quick-cust');
    if (sel) { sel.value = customerId; waFillQuickInfo(); }
  }, 150);
}

function waClearLog() {
  document.getElementById('confirmMsg').textContent = 'Hapus semua riwayat pengiriman WA?';
  document.getElementById('confirmOkBtn').textContent = 'Hapus';
  document.getElementById('confirmOkBtn').className = 'btn btn-danger';
  document.getElementById('confirmOkBtn').onclick = async () => {
    await DB.walogs.clearAll();
    closeModal('confirmModal');
    renderWaLog();
    renderWaStats();
    toast('Log WA dihapus', 'danger');
  };
  openModal('confirmModal');
}

// ============================================================
//  PHOTO MODULE
// ============================================================

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

function deletePhotosForCustomer(customerId) {
  // Stub — actual delete via Supabase handled in data.js deleteCustomer()
}

// ---- Upload handler ----
function handlePhotoUpload(inputPrefix, zonePrefix) {
  const input = document.getElementById(inputPrefix + '-input');
  const file  = input?.files?.[0];
  if (!file) return;

  if (file.size > MAX_PHOTO_SIZE) {
    toast('Ukuran foto terlalu besar! Maksimal 5MB.', 'danger');
    input.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    toast('File harus berupa gambar!', 'danger');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Compress before storing
    compressImage(e.target.result, 800, 0.75, (compressed) => {
      showPhotoPreview(zonePrefix, compressed);
      document.getElementById(zonePrefix + '-data').value = compressed;
    });
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxWidth, quality, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let w = img.width;
    let h = img.height;
    if (w > maxWidth) {
      h = Math.round(h * maxWidth / w);
      w = maxWidth;
    }
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = dataUrl;
}

function showPhotoPreview(prefix, dataUrl) {
  const previewEmpty = document.getElementById(prefix + '-preview');
  const previewImg   = document.getElementById(prefix + '-img');
  const dropZone     = document.getElementById(prefix + '-drop');
  const clearBtn     = document.getElementById(prefix + '-clear-btn');

  if (previewEmpty) previewEmpty.style.display = 'none';
  if (previewImg)   { previewImg.src = dataUrl; previewImg.style.display = 'block'; }
  if (dropZone)     dropZone.classList.add('has-photo');
  if (clearBtn)     clearBtn.style.display = 'inline-flex';
}

function clearPhotoPreview(prefix) {
  const previewEmpty = document.getElementById(prefix + '-preview');
  const previewImg   = document.getElementById(prefix + '-img');
  const dropZone     = document.getElementById(prefix + '-drop');
  const clearBtn     = document.getElementById(prefix + '-clear-btn');
  const dataInput    = document.getElementById(prefix + '-data');
  const fileInput    = document.getElementById(prefix + '-input');

  if (previewEmpty) previewEmpty.style.display = 'block';
  if (previewImg)   { previewImg.src = ''; previewImg.style.display = 'none'; }
  if (dropZone)     dropZone.classList.remove('has-photo');
  if (clearBtn)     clearBtn.style.display = 'none';
  if (dataInput)    dataInput.value = '';
  if (fileInput)    fileInput.value = '';
}

function clearPhoto(prefix) {
  clearPhotoPreview(prefix);
}

// ---- Drag & Drop ----
function initPhotoDragDrop() {
  ['cust-photo', 'item-photo'].forEach(prefix => {
    const zone = document.getElementById(prefix + '-drop');
    if (!zone) return;
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) {
        toast('File harus berupa gambar!', 'danger'); return;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        toast('Ukuran foto terlalu besar! Maksimal 5MB.', 'danger'); return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        compressImage(ev.target.result, 800, 0.75, (compressed) => {
          showPhotoPreview(prefix, compressed);
          document.getElementById(prefix + '-data').value = compressed;
        });
      };
      reader.readAsDataURL(file);
    });
  });
}

// ---- LIGHTBOX ----
function openLightbox(src, caption) {
  document.getElementById('photo-lightbox-img').src = src;
  document.getElementById('photo-lightbox-caption').textContent = caption || '';
  document.getElementById('photo-lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('photo-lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// ESC to close lightbox
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// Patch openCustModal to init drag-drop — handled directly in openCustModal above

// ============================================================
//  FOTO TAB BUILDER
// ============================================================

function buildFotoTab(customerId) {
  const custPhoto  = getCustPhotoSync(customerId);
  const itemPhotos = getItemPhotosSync(customerId);
  const hasAny     = custPhoto || itemPhotos.length > 0;

  if (!hasAny) {
    return `
      <div class="empty-state" style="padding:32px;">
        <div class="empty-icon">📷</div>
        <p style="margin-bottom:12px;">Belum ada foto untuk pelanggan ini</p>
        <button class="btn btn-primary btn-sm" onclick="closeModal('custDetailModal');editCustomer('${customerId}')">
          + Tambah Foto
        </button>
      </div>`;
  }

  return `
    <div class="cust-detail-photos">
      <!-- Foto Pelanggan -->
      <div>
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">👤 Foto Pelanggan</div>
        ${custPhoto ? `
        <div class="cust-photo-box">
          <img src="${custPhoto}" alt="Foto Pelanggan"
               onclick="openLightbox('${custPhoto}','Foto Pelanggan')">
        </div>` : `
        <div class="cust-photo-box" style="display:flex;align-items:center;justify-content:center;height:180px;flex-direction:column;gap:8px;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1;">
          <div style="font-size:32px;opacity:.3;">👤</div>
          <div style="font-size:12px;color:#94a3b8;">Belum ada foto</div>
        </div>`}
      </div>

      <!-- Foto Barang Gallery -->
      <div>
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">
          📦 Foto Barang
          ${itemPhotos.length > 0 ? `<span class="badge badge-blue" style="font-size:10px;margin-left:4px;">${itemPhotos.length} foto</span>` : ''}
        </div>
        ${itemPhotos.length > 0
          ? buildItemGallery(customerId)
          : `<div style="display:flex;align-items:center;justify-content:center;height:180px;flex-direction:column;gap:8px;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1;">
               <div style="font-size:32px;opacity:.3;">📦</div>
               <div style="font-size:12px;color:#94a3b8;">Belum ada foto barang</div>
             </div>`}
      </div>
    </div>
    <div style="text-align:center;margin-top:12px;">
      <button class="btn btn-outline btn-sm" onclick="closeModal('custDetailModal');editCustomer('${customerId}')">
        Edit / Tambah Foto
      </button>
    </div>`;
}

// ============================================================
//  MULTI ITEM PHOTO
// ============================================================

const MAX_ITEM_PHOTOS = 5;
// in-memory staging for item photos while modal is open
let _stagingItemPhotos = [];

function handleItemPhotosUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const available = MAX_ITEM_PHOTOS - _stagingItemPhotos.length;
  if (available <= 0) {
    toast(`Maksimal ${MAX_ITEM_PHOTOS} foto barang!`, 'warning');
    input.value = '';
    return;
  }

  const toProcess = files.slice(0, available);
  if (files.length > available) {
    toast(`Hanya ${available} foto lagi yang bisa ditambahkan (maks ${MAX_ITEM_PHOTOS}).`, 'warning');
  }

  let processed = 0;
  toProcess.forEach(file => {
    if (!file.type.startsWith('image/')) { processed++; return; }
    if (file.size > MAX_PHOTO_SIZE) {
      toast(`${file.name}: ukuran terlalu besar (maks 5MB)`, 'warning');
      processed++; return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      compressImage(e.target.result, 900, 0.78, (compressed) => {
        _stagingItemPhotos.push(compressed);
        processed++;
        if (processed === toProcess.length) {
          renderItemPhotoStrip();
          updateItemDropZone();
        }
      });
    };
    reader.readAsDataURL(file);
  });

  input.value = ''; // reset so same file can be re-added after delete
}

function removeItemPhoto(index) {
  _stagingItemPhotos.splice(index, 1);
  renderItemPhotoStrip();
  updateItemDropZone();
}

function clearAllItemPhotos() {
  _stagingItemPhotos = [];
  renderItemPhotoStrip();
  updateItemDropZone();
}

function renderItemPhotoStrip() {
  const strip = document.getElementById('item-photo-strip');
  const countLabel = document.getElementById('item-photo-count-label');
  const clearAllBtn = document.getElementById('item-photo-clear-all-btn');
  if (!strip) return;

  countLabel && (countLabel.textContent = `${_stagingItemPhotos.length} / ${MAX_ITEM_PHOTOS} foto`);
  clearAllBtn && (clearAllBtn.style.display = _stagingItemPhotos.length > 0 ? 'inline-flex' : 'none');

  strip.innerHTML = _stagingItemPhotos.map((src, i) => `
    <div class="item-thumb-wrap">
      <img src="${src}" alt="Foto barang ${i+1}"
           onclick="openLightbox('${src}','Foto Barang ${i+1}')">
      <button type="button" class="item-thumb-remove"
              onclick="event.stopPropagation();removeItemPhoto(${i})" title="Hapus foto ini">✕</button>
      <div class="item-thumb-num">${i+1}</div>
    </div>`).join('');
}

function updateItemDropZone() {
  const zone    = document.getElementById('item-photo-drop');
  const preview = document.getElementById('item-photo-preview');
  if (!zone || !preview) return;

  const full = _stagingItemPhotos.length >= MAX_ITEM_PHOTOS;
  zone.style.display   = full ? 'none' : 'flex';
  preview.style.display = 'flex';
}

function loadItemPhotosIntoStaging(customerId) {
  _stagingItemPhotos = getItemPhotosSync(customerId).slice(0, MAX_ITEM_PHOTOS);
  renderItemPhotoStrip();
  updateItemDropZone();
}

function saveItemPhotosFromStaging(customerId) {
  setItemPhotos(customerId, _stagingItemPhotos);
}

// Init drag-drop for item photo multi-zone
function initItemPhotoDragDrop() {
  const zone = document.getElementById('item-photo-drop');
  if (!zone || zone._ddInit) return;
  zone._ddInit = true;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    // Fake the input
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.getElementById('item-photo-input');
    try { input.files = dt.files; } catch(ex) {}
    handleItemPhotosUpload({ files: dt.files });
  });
}

// ============================================================
//  ITEM GALLERY (in detail modal)
// ============================================================

let _galleryPhotos  = [];
let _galleryIndex   = 0;

function buildItemGallery(customerId) {
  const photos = getItemPhotosSync(customerId);
  if (!photos.length) return '';

  _galleryPhotos = photos;
  _galleryIndex  = 0;

  return `
    <div class="item-gallery" id="item-gallery-${customerId}">
      <div class="item-gallery-main" style="position:relative;">
        <button class="item-gallery-nav prev" onclick="galleryNav(${-1},'${customerId}')" style="${photos.length<2?'display:none':''}">‹</button>
        <img id="gallery-main-img-${customerId}"
             src="${photos[0]}"
             alt="Foto Barang 1"
             onclick="openLightbox(this.src, 'Foto Barang ' + (${customerId === '' ? 0 : `_galleryIndex`}+1) + ' / ${photos.length}')">
        <button class="item-gallery-nav next" onclick="galleryNav(${1},'${customerId}')" style="${photos.length<2?'display:none':''}">›</button>
        ${photos.length > 1 ? `<div class="item-gallery-counter" id="gallery-counter-${customerId}">1 / ${photos.length}</div>` : ''}
      </div>
      ${photos.length > 1 ? `
      <div class="item-gallery-strip" id="gallery-strip-${customerId}">
        ${photos.map((src, i) => `
          <div class="item-gallery-thumb ${i===0?'active':''}" id="gallery-thumb-${customerId}-${i}"
               onclick="galleryGoTo(${i},'${customerId}')">
            <img src="${src}" alt="Foto ${i+1}">
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

function galleryNav(dir, customerId) {
  const photos = getItemPhotosSync(customerId);
  _galleryIndex = (_galleryIndex + dir + photos.length) % photos.length;
  galleryRender(customerId);
}

function galleryGoTo(index, customerId) {
  _galleryIndex = index;
  galleryRender(customerId);
}

function galleryRender(customerId) {
  const photos = getItemPhotosSync(customerId);
  const img = document.getElementById(`gallery-main-img-${customerId}`);
  if (img) img.src = photos[_galleryIndex];

  const counter = document.getElementById(`gallery-counter-${customerId}`);
  if (counter) counter.textContent = `${_galleryIndex + 1} / ${photos.length}`;

  // Update active thumb
  photos.forEach((_, i) => {
    const t = document.getElementById(`gallery-thumb-${customerId}-${i}`);
    if (t) t.classList.toggle('active', i === _galleryIndex);
  });
}
