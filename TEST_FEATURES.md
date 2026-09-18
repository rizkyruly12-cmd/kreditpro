# Test Checklist - Semua Fitur Baru

## 1. Chart Color (Indigo Theme)
- [ ] Dashboard: Profit chart berwarna indigo (#6366f1), bukan biru
- [ ] Dashboard: Status chart badges indigo untuk "Aktif" 
- [ ] Laporan: Chart colors sudah indigo
- [ ] User avatar gradient: indigo + cyan

## 2. Search Pelanggan
- [ ] Cari nama pelanggan → hasil filter
- [ ] Cari ID pelanggan → hasil filter
- [ ] Cari nomor barang → hasil filter
- [ ] Cari nomor HP → hasil filter
- [ ] Search case-insensitive berfungsi
- [ ] Clear search → tampil semua data

## 3. Sortable Columns
- [ ] Klik header "Pelanggan" → sort by nama (up/down arrows visible)
- [ ] Klik header "Tgl Kredit" → sort by date
- [ ] Klik header "Kredit Pokok" → sort by nominal
- [ ] Klik header "Tenor" → sort numeric
- [ ] Default sort: Tgl Kredit DESC (newest first)
- [ ] Toggle direction saat klik ulang

## 4. Empty State
- [ ] Saat tidak ada data → tampil SVG icon + "Tidak ada pelanggan"
- [ ] Tombol "Tambah Pelanggan" ada di empty state
- [ ] Empty state responsive dan terlihat bagus

## 5. Loading States
- [ ] Hapus pelanggan → loading indicator muncul
- [ ] Simpan pelanggan → loading "Menyimpan data..."
- [ ] Edit pembayaran → loading indicator
- [ ] Tombol aksi tidak bisa di-klik 2x saat loading

## 6. Export Excel
- [ ] Laporan tab "Ringkasan" → tombol "Export Excel" ada
- [ ] Klik export → file CSV download (nama: laporan_kredit_YYYY-MM-DD.csv)
- [ ] CSV bisa dibuka di Excel
- [ ] Semua kolom data ada: ID, Nama, Barang, Tgl, Pokok, Tenor, Angsuran, Total, Bayar, Sisa, Status, Profit

## 7. Foto Compression
- [ ] Upload foto > 1MB → auto compress ke 800x800
- [ ] Quality 80% maintained untuk size kecil
- [ ] Compressed foto tetap terlihat bagus
- [ ] Ukuran file berkurang signifikan

## 8. Audit Log / Activity Log
- [ ] Menu "Activity Log" ada di sidebar > Admin section
- [ ] Klik Activity Log → halaman view logs
- [ ] Setiap CREATE customer → log muncul dengan aksi "CREATE"
- [ ] Setiap UPDATE customer → log muncul dengan aksi "UPDATE"
- [ ] Setiap DELETE customer → log muncul dengan aksi "DELETE"
- [ ] Log menampilkan: Waktu, Aksi, User, Entity Type, Entity ID, Detail
- [ ] Pagination bekerja (max 30 per page)
- [ ] Export Excel dari Activity Log bekerja
- [ ] Logs sorted by waktu DESC (newest first)

## 9. Desktop Notifications
- [ ] Browser minta permission notification saat load pertama
- [ ] 3 hari sebelum jatuh tempo → notifikasi "⏰ Kredit akan jatuh tempo dalam 3 hari"
- [ ] Hari jatuh tempo → notifikasi "📌 Jatuh tempo hari ini!"
- [ ] 1 hari setelah jatuh tempo → notifikasi "⚠️ Telah 1 hari telat!"
- [ ] Notifikasi hanya muncul 1x per kondisi
- [ ] Auto-check setiap 5 menit

## 10. Integration Test
- [ ] Add pelanggan baru → muncul di list + audit log
- [ ] Edit pelanggan → data ter-update + audit log
- [ ] Search & sort bekerja bersama
- [ ] Pagination tetap work dengan filter/search
- [ ] Export dari laporan mencakup semua data yang ter-filter
- [ ] Switch page → tidak ada error di console
- [ ] Responsive di mobile, tablet, desktop

## 11. Performance
- [ ] Page load time < 3 detik
- [ ] Sort/filter response immediate (< 500ms)
- [ ] 100+ data pelanggan tetap smooth
- [ ] No memory leaks setelah buka/tutup modal multiple times
- [ ] No error di browser console

---

## Testing Instructions

1. **Login** ke https://kreditruli.netlify.app
2. **Go through checklist** di atas
3. **Document any issues** dengan screenshot
4. **Record** status: ✅ Passed / ❌ Failed / ⚠️ Needs Fix

