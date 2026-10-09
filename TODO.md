
## 12. Follow penulis
- [x] Pengguna yang masuk dapat mengikuti atau berhenti mengikuti penulis lain dari profil publik; tombol dan status mengikuti diperbarui sesudah tindakan, dan pengguna tidak dapat mengikuti dirinya sendiri.
- [x] Profil menampilkan ikon serta jumlah pengikut dan jumlah akun yang diikuti; jumlah dihitung dari relasi tersimpan, bukan angka statis.
- [x] Relasi follow disimpan dengan pasangan pengikut/diikuti unik agar aksi berulang tidak membuat relasi ganda.

## 13. Notifikasi apresiasi dan tanggapan
- [x] Jika pengguna lain menyukai atau memberi tanggapan pada puisi publik milik penulis, Stanza menyimpan notifikasi dengan identitas pelaku, jenis aktivitas, dan karya terkait; interaksi penulis pada karyanya sendiri tidak membuat notifikasi.
- [x] Ikon lonceng tersedia di bilah navigasi bawah di samping Profil, menampilkan penanda/jumlah belum dibaca, dan membuka halaman notifikasi.
- [x] Daftar notifikasi menampilkan aktivitas suka/tanggapan, status terbaca, serta pembaruan otomatis berkala ketika aplikasi terbuka.

## 14. Notifikasi follow
- [x] Saat pengguna baru mengikuti penulis, Stanza menyimpan notifikasi dengan identitas pelaku dan waktu; permintaan follow berulang saat relasi sudah ada tidak membuat notifikasi duplikat, dan unfollow tidak membuat notifikasi.
- [x] Notifikasi follow muncul dalam daftar dan badge belum dibaca, menampilkan siapa yang mengikuti, serta membuka profil pelaku; notifikasi suka/komentar dan tautan langsung ke puisi tetap berfungsi.

## 15. Copy aplikasi lebih natural
- [x] Teks utama Jelajah, editor, profil, komentar, notifikasi, pengaturan, dan autentikasi terdengar ringkas serta natural dalam Bahasa Indonesia dan English, tanpa slogan generik atau janji pembaca yang tidak dapat dipastikan.
- [x] Keterangan draf menjelaskan penyimpanan lokal sesuai perilaku editor; status penyimpanan lokal tidak ditampilkan saat mengedit puisi yang sudah terbit.
- [x] Alur aplikasi tidak menyediakan fitur AI untuk menghasilkan puisi; komponen AI pada showcase starter tidak terhubung ke rute aplikasi.

## 16. Kuesioner usability yang dapat dibagikan
- [x] Rute `/feedback` dapat dibuka langsung lewat tautan publik tanpa akun Stanza, tersedia dalam Bahasa Indonesia dan English, dan dapat dibagikan kepada penguji tanpa menerbitkan situs.
- [x] Kuesioner menanyakan perangkat dan apakah ini kunjungan pertama, serta meminta penguji menilai hasil 6 tugas: membuat/menyimpan draf; menerbitkan puisi; memberi apresiasi atau komentar pada puisi lain; mengikuti penulis dan menemukan notifikasinya; mengubah pengaturan profil/bahasa/tema; dan mengekspor PDF atau kartu sosial. Setiap tugas dapat ditandai selesai, tersendat, atau tidak dicoba.
- [x] Kuesioner menyertakan 10 pernyataan SUS baku dengan skala 1–5 dari sangat tidak setuju hingga sangat setuju, dan dua pertanyaan terbuka opsional tentang kebingungan serta perubahan yang paling membantu.
- [x] Submit mewajibkan persetujuan untuk menyimpan jawaban guna memperbaiki Stanza; instruksi meminta penguji tidak memasukkan nama, email, kata sandi, atau informasi pribadi ke kolom jawaban.
- [x] Jawaban disimpan di database proyek dalam tabel feedback tanpa akun pengguna, email, alamat IP, atau user-agent; penguji menerima konfirmasi setelah submit dan dapat melihat lokasi tabel untuk ekspor data setelah tes.
