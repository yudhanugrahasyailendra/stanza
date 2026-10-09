# Rencana Implementasi Stanza

## Ringkasan produk dan arsitektur
Stanza adalah ruang digital sastra untuk menulis, membaca, dan membagikan puisi dengan ritme yang sengaja tenang. Proyek memakai starter terkelola React + TypeScript, Tailwind CSS, Express, tRPC, Drizzle, dan MySQL. Setelah pengguna memilih opsi akun Stanza, login utama memakai email dan kata sandi (hash scrypt, token sesi acak yang hanya disimpan dalam bentuk hash); Manus OAuth tetap tersedia hanya sebagai jalur kompatibilitas akun lama. Feed dan profil dapat dibaca publik, sementara aksi akun memerlukan sesi. Data akun dan preferensi disimpan di database proyek.

## Sistem desain yang disetujui
- **Design movement:** editorial sastra kontemporer, terinspirasi tata letak majalah sastra independen dan materialitas kertas.
- **Prinsip inti:** ruang napas yang murah hati; hierarki tipografi puitis; interaksi hangat tanpa kompetisi popularitas; keterbacaan responsif.
- **Filosofi warna:** krem-kertas dan tinta arang menjadi kanvas tenang; hijau lumut adalah aksen khas yang terasa hidup namun tidak berteriak; sepia dan gelap tersedia sebagai suasana alternatif editor.
- **Paradigma tata letak:** kolom baca tunggal dengan lebar terkendali; editor sebagai kanvas pusat; navigasi ringkas di desktop dan bilah bawah pada ponsel. Pada layar ponsel, shortcut profil/pengaturan di header disembunyikan agar aksi utama tetap lapang; breadcrumb profil disembunyikan dan jarak atas dikurangi agar area profil tidak menyisakan ruang berlebih. Profil tetap tersedia lewat navigasi bawah dan pengaturan lewat profil pemilik.
- **Elemen khas:** wordmark huruf kecil dengan tanda bait; garis/ornamen kecil seperti jejak halaman; kartu puisi dengan banyak ruang kosong.
- **Filosofi interaksi:** apresiasi adalah ungkapan lembut, komentar berfokus pada isi; tidak menonjolkan views atau ranking manipulatif; kontrol dapat dijangkau keyboard dan sentuhan.
- **Animasi:** transisi opacity/geser ringan 160–220 ms saat perpindahan halaman atau membuka komentar; tanpa parallax/auto-scroll; hormati `prefers-reduced-motion`.
- **Tipografi:** Cormorant Garamond untuk puisi/judul, DM Sans untuk UI; hirarki judul editorial dengan nama profil yang diskalakan lebih kecil pada ponsel agar seimbang dengan avatar dan lebar layar, isi puisi lapang dan line-height yang dapat diatur.
- **Esensi merek:** rumah kecil bagi puisi dan pembacanya; tenang, peka, bersahaja.
- **Suara merek:** akrab, sederhana, dan tidak menggurui. Contoh: “Mulai dengan satu baris.” dan “Draf tersimpan di perangkat ini.”
- **Wordmark/logo:** “stanza” huruf kecil dengan motif garis/penanda bait yang berbeda; mark berupa dua garis pendek yang menandai jeda.
- **Warna merek:** hijau lumut khas dipakai selektif pada aksi utama dan penanda aktif.

## Struktur proyek
- `client/src/App.tsx`: shell navigasi dan routing `/`, `/explore`, `/write`, `/profile/:username`, `/notifications`, `/settings`, `/login`, dan `/feedback`.
- `client/src/pages/`: feed, editor, profil, kotak masuk notifikasi, pengaturan akun, autentikasi email/kata sandi, dan kuesioner uji kegunaan.
- `client/src/components/`: kartu puisi, dialog komentar/ekspor, avatar, komponen shell.
- `client/src/lib/`: helper pembuat kartu kutipan dan cetak PDF.
- `client/src/index.css` dan `client/src/contexts/`: token warna, tema terang/gelap/sistem, bahasa Indonesia/English, tipografi, breakpoint, dan gaya cetak.
- `drizzle/schema.ts` dan `drizzle/`: tabel `users`, `local_credentials`, `account_sessions`, `poems`, `likes`, `comments`, `follows`, `notifications`, dan `usability_feedback` serta migrasi aditif.
- `server/_core/localAuth.ts` dan `server/_core/passwords.ts`: sesi cookie same-site preview, pengelolaan token, dan hashing kata sandi; `server/routers.ts`: prosedur akun serta API tRPC untuk feed, karya, apresiasi, tanggapan, profil, follow, notifikasi, preferensi, keamanan akun, dan pengiriman feedback.
- `public/manus-routes.json`: deklarasi seluruh rute halaman.

## Perilaku data
Pengguna dibuat melalui registrasi Stanza atau di-upsert dari callback OAuth lama. Profil menyediakan username unik, bio singkat, avatar, serta tanggal lahir yang hanya tampil di area akun privat. Pengaturan akun mengizinkan pemilik memperbarui nama, username, email (dengan kata sandi saat ini bila berubah), avatar, tanggal lahir, bahasa, dan tema. Bahasa Indonesia/English diterapkan lintas antarmuka; tampilan Terang/Gelap/Sistem mengikuti preferensi tersimpan dan perubahan warna sistem. Pengguna dapat membuat atau mengganti kata sandi, logout, atau menghapus akun setelah konfirmasi; penghapusan akun Stanza tidak menghapus akun Manus. Puisi memiliki status `draft`/`published`; feed dan portofolio hanya membaca status publik. Suka bersifat unik per pasangan pengguna/puisi; komentar menyimpan penulis, isi, dan waktu. Draft dapat diperbarui pemiliknya dan tidak dapat dilihat sebagai konten publik. Ekspor dijalankan di browser dan menulis watermark “Dibuat di Stanza oleh [Username]”.

## Batas implementasi
Database diinisialisasi pada layanan MySQL terkelola. Cookie sesi lokal memakai `HttpOnly`, `SameSite=None; Secure`, sementara mutasi tRPC dilindungi pasangan token CSRF cookie/header dan login/registrasi dibatasi percobaannya. OAuth Manus disimpan hanya untuk kompatibilitas akun lama. PDF memakai dialog cetak browser untuk “Simpan sebagai PDF”; kartu sosial dihasilkan sebagai PNG di canvas browser. Publikasi hosting tidak diminta, jadi hasil diserahkan sebagai Preview kecuali pengguna meminta penerbitan.

## Perubahan pemeliharaan karya
Pada kartu puisi, tombol Edit dan Hapus hanya dirender bagi pengguna yang ID-nya cocok dengan penulis. Edit membuka Zen Editor pada ID karya yang sama; endpoint revisi hanya menerima puisi berstatus terpublikasi milik pengguna tersebut dan mempertahankan publikasinya. Penghapusan diperiksa lagi di backend dan meminta konfirmasi bahwa puisi beserta apresiasi/komentar akan terhapus permanen; relasi basis data membersihkan interaksi melalui cascade. Setelah berhasil, feed dan profil di-refresh.

## Ekstensi follow dan notifikasi komunitas
Follow disimpan pada tabel `follows` dengan pasangan follower/following unik; halaman profil publik menampilkan tombol Ikuti/Mengikuti dan hitungan pengikut/mengikuti. Event suka dan komentar pada puisi pengguna masuk ke tabel `notifications`, tanpa pemberitahuan untuk interaksi diri sendiri. Bilah navigasi bawah menampilkan lonceng di samping Profil, halaman `/notifications` berisi aktivitas dan status belum dibaca, serta badge/list diperbarui otomatis setiap 8 detik ketika aplikasi aktif. Ini adalah notifikasi in-app near-real-time, bukan push notification OS/email. Skema ditambahkan melalui migrasi aditif pada MySQL terkelola.

## Ekstensi notifikasi follow
Notifikasi follow memakai tabel `notifications` yang sama dengan interaksi puisi. Baris follow menyimpan penerima, pelaku, jenis `follow`, dan waktu tanpa `poemId`; event dibuat secara atomik hanya ketika relasi follow baru benar-benar tercipta. Pembukaan notifikasi menautkan pembaca ke profil pelaku. Perubahan skema bersifat aditif dan mempertahankan notifikasi like/komentar serta tautan puisi yang sudah ada.

## Formulir uji kegunaan Stanza
Kuesioner berbagi lewat `/feedback` menggabungkan 6 hasil tugas produk, 10 pernyataan System Usability Scale (SUS) berskala 1–5, jenis perangkat, pengalaman pertama, dan dua pertanyaan terbuka. Halaman mengikuti pilihan bahasa Indonesia/English. Endpoint submit tRPC bersifat publik tanpa akun; server memvalidasi semua jawaban dan menyimpan respons anonim di tabel `usability_feedback` tanpa user ID, email, alamat IP, atau user-agent. Persetujuan eksplisit diwajibkan, dan penguji diminta tidak menulis informasi pribadi di jawaban bebas. Hasil tidak dipublikasikan untuk semua pengguna; pemilik dapat meminta ekspor CSV setelah pengujian.
