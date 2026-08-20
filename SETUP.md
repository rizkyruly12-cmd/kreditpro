# KreditPro — Panduan Deploy ke Netlify + Supabase

## Perkiraan Waktu: 30–45 menit

---

## LANGKAH 1 — Buat Akun Supabase (Gratis)

1. Buka **https://supabase.com** → klik **Start your project**
2. Daftar dengan akun Google atau GitHub
3. Klik **New Project**
   - Organization: pilih yang ada (atau buat baru)
   - Name: `kreditpro`
   - Database Password: buat password kuat, **SIMPAN password ini**
   - Region: pilih **Southeast Asia (Singapore)**
4. Tunggu ~2 menit sampai project siap

---

## LANGKAH 2 — Setup Database

1. Di dashboard Supabase, klik menu **SQL Editor** (ikon database di sidebar kiri)
2. Klik **New query**
3. Copy semua isi file `supabase_schema.sql` dari folder project
4. Paste di SQL Editor → klik **Run** (tombol hijau)
5. Pastikan muncul pesan "Success. No rows returned"

---

## LANGKAH 3 — Ambil API Keys Supabase

1. Di sidebar Supabase klik **Settings** → **API**
2. Catat 2 nilai ini:
   - **Project URL** — contoh: `https://abcdefgh.supabase.co`
   - **service_role** key (bukan anon key!) — klik "Reveal" untuk lihat

> ⚠️ **PENTING:** Jangan share service_role key ke siapapun. Key ini hanya untuk Netlify, bukan untuk browser.

---

## LANGKAH 4 — Buat Akun Netlify (Gratis)

1. Buka **https://netlify.com** → Sign up dengan GitHub atau email
2. Setelah masuk, klik **Add new site** → **Deploy manually**

---

## LANGKAH 5 — Upload Project ke Netlify

**Cara paling mudah (drag & drop):**

1. Di Netlify dashboard, klik **Sites**
2. Drag & drop **seluruh folder** `c:\bisniskredit` ke area drop zone
3. Tunggu upload selesai (~1-2 menit)
4. Netlify akan memberikan URL seperti `https://nama-acak.netlify.app`

**Atau via GitHub (lebih baik untuk update otomatis):**

1. Upload folder ke GitHub repository
2. Di Netlify: New site → Import from Git → pilih repo
3. Build command: `npm install`
4. Publish directory: `.`

---

## LANGKAH 6 — Set Environment Variables di Netlify

1. Di Netlify, buka site Anda → **Site configuration** → **Environment variables**
2. Klik **Add a variable** dan tambahkan 2 variable:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | URL dari Langkah 3 (contoh: `https://abcdefgh.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | service_role key dari Langkah 3 |

3. Klik **Save**
4. Setelah save, **Deploy ulang**: Deploys → Trigger deploy → Deploy site

---

## LANGKAH 7 — Import Data dari Browser Lama

> Lakukan ini di komputer/browser yang sebelumnya menyimpan data KreditPro

1. Buka URL Netlify Anda: `https://nama-anda.netlify.app`
2. Login dengan: username `admin` / password `admin123`
3. Setelah login, buka: `https://nama-anda.netlify.app/seed.html`
4. Halaman akan otomatis scan data localStorage di browser Anda
5. Klik **Mulai Import**
6. Tunggu sampai muncul "✅ Import berhasil!"

> Jika data tidak ditemukan di browser tersebut, data seed default (111 pelanggan) akan diimport otomatis.

---

## LANGKAH 8 — Ganti Password Admin

1. Login ke aplikasi
2. Klik ikon ⚙️ di pojok kiri bawah sidebar
3. Tab **Ubah Password**
4. Ganti dari `admin123` ke password yang kuat
5. Klik **Simpan Password**

---

## SELESAI 🎉

Aplikasi KreditPro Anda sekarang:
- ✅ Live di internet (URL Netlify)
- ✅ Data tersimpan di Supabase (cloud database)
- ✅ Bisa diakses dari HP, tablet, komputer manapun
- ✅ Backup otomatis oleh Supabase
- ✅ HTTPS (aman)

---

## Troubleshooting

**Error "Unauthorized" saat login:**
- Pastikan Environment Variables sudah di-set dan sudah trigger deploy ulang

**Data tidak muncul setelah import:**
- Coba refresh halaman (Ctrl+R)
- Cek Supabase Table Editor untuk pastikan data masuk

**Functions tidak jalan:**
- Pastikan `netlify.toml` ada di root folder
- Cek Netlify → Functions tab untuk lihat error log

**Lupa password admin:**
- Buka Supabase → Table Editor → tabel `auth_users`
- Update kolom `password_hash` dengan hash baru
- Hash bisa dibuat di browser console: jalankan fungsi `hashPassword('password_baru')`

---

## Biaya

| Layanan | Free Tier | Batas |
|---------|-----------|-------|
| Netlify | Gratis | 100GB bandwidth/bulan, 125K function calls/bulan |
| Supabase | Gratis | 500MB database, 2GB file storage |

Untuk bisnis skala ini, free tier sudah lebih dari cukup.
