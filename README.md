# Portal API Kampus

Portal sederhana dengan API REST baca-publik untuk berita, fakultas, program studi, dan pengumuman. Mode lokal menggunakan PHP dan MySQL; deployment Vercel menggunakan Node.js Function dan MySQL kompatibel yang di-host terpisah. Data awal hanya contoh dan harus diganti dengan informasi yang Anda miliki atau berhak publikasikan.

## Menjalankan dengan XAMPP

1. Letakkan folder proyek di `C:\xampp\htdocs\Project`.
2. Jalankan Apache dan MySQL dari XAMPP Control Panel.
3. Impor `database/schema.sql` melalui phpMyAdmin. Skrip membuat database `kampus_api`, tabel, dan data contoh.
4. Buka `http://localhost/Project/` untuk halaman portal atau `http://localhost/Project/api/berita` untuk API.

Koneksi PHP default memakai MySQL lokal (`127.0.0.1`, database `kampus_api`, user `root`, password kosong). Untuk lingkungan lain, atur variabel lingkungan `CAMPUS_DB_HOST`, `CAMPUS_DB_NAME`, `CAMPUS_DB_USER`, dan `CAMPUS_DB_PASSWORD`.

## Menjalankan dengan file batch

Pastikan MySQL sudah aktif di XAMPP, lalu klik dua kali `start.bat`. Server PHP lokal berjalan di `http://localhost:8000`. File batch memakai PHP dari `C:\xampp\php\php.exe`; sesuaikan nilai `PHP_EXE` di `start.bat` jika XAMPP dipasang di lokasi berbeda. Tutup server dengan `Ctrl+C`.

## Deploy online ke Vercel

Vercel menjalankan endpoint online melalui Node.js Function. PHP lokal tetap dipakai untuk XAMPP dan file PHP dikecualikan dari deployment. Vercel tidak menjalankan MySQL lokal XAMPP; siapkan MySQL yang dapat diakses dari internet pada penyedia database terpisah.

1. Buat database MySQL managed yang mengizinkan koneksi dari Vercel. Jangan gunakan user `root` XAMPP atau database lokal sebagai database produksi.
2. Buat database kosong di penyedia tersebut lalu jalankan `database/vercel-schema.sql` melalui SQL console penyedia. File ini tidak berisi perintah `CREATE DATABASE` atau `USE`.
3. Push folder proyek ini ke repository GitHub.
4. Di Vercel, pilih **Add New → Project**, impor repository, lalu deploy. Vercel akan menginstal `mysql2` dari `package.json`.
5. Di **Project Settings → Environment Variables**, tambahkan:
   - `CAMPUS_DB_HOST`: hostname MySQL.
   - `CAMPUS_DB_PORT`: port MySQL, biasanya `3306`.
   - `CAMPUS_DB_NAME`: nama database.
   - `CAMPUS_DB_USER`: user database dengan akses minimum ke database tersebut.
   - `CAMPUS_DB_PASSWORD`: password database.
   - `CAMPUS_DB_SSL`: isi `true` jika penyedia mewajibkan TLS; selain itu `false`.
6. Redeploy setelah mengatur variabel. Buka domain Vercel untuk portal dan `/api/berita`, misalnya `https://nama-project.vercel.app/api/berita`.

Jangan commit kredensial database ke Git. Gunakan hanya Environment Variables Vercel, dan batasi izin user database ke database proyek. Jika database menolak koneksi, periksa pengaturan jaringan/allowlist dan TLS dari penyedia database.

## Endpoint

Semua endpoint hanya menerima `GET`. Daftar hanya menampilkan data yang berstatus terbit/publikasi. Ubah isi database langsung untuk mengelola data pada versi awal ini.

| Endpoint | Kegunaan |
| --- | --- |
| `/api/berita` | Daftar berita terbaru |
| `/api/berita/{id-atau-slug}` | Detail berita |
| `/api/fakultas` | Daftar fakultas |
| `/api/fakultas/{id-atau-slug}` | Detail fakultas |
| `/api/program-studi` | Daftar program studi beserta nama fakultas |
| `/api/program-studi/{id-atau-slug}` | Detail program studi |
| `/api/pengumuman` | Daftar pengumuman yang masih berlaku |
| `/api/pengumuman/{id-atau-slug}` | Detail pengumuman |

Parameter daftar:

- `page`: nomor halaman, mulai dari `1`.
- `per_page`: jumlah item per halaman, `1` sampai `100` (default `10`).
- `q`: pencarian teks.

Contoh:

```text
GET http://localhost/Project/api/berita?page=1&per_page=5
GET http://localhost/Project/api/program-studi?q=teknik
GET http://localhost/Project/api/berita/selamat-datang-di-portal-kampus
```

Untuk server batch, ganti `localhost/Project` pada contoh URL menjadi `localhost:8000`.

Daftar menggunakan format `{"data":[...],"meta":{"page":1,"per_page":10,"total":1,"total_pages":1}}`. Detail menggunakan format `{"data":{...}}`. Kesalahan menggunakan format `{"error":"..."}` dan status HTTP yang sesuai.

API ini tidak menyediakan autentikasi atau operasi tulis karena seluruh endpoint hanya-baca. Jangan menambahkan akses tulis publik; jika nanti diperlukan panel admin, tambahkan autentikasi dan otorisasi terlebih dahulu.
