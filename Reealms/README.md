# Reealms

Reealms adalah aplikasi streaming yang menggabungkan konten Drama, Anime, dan Komik.

## Fitur
- Multi-source: Dramabox, Otakudesu, Komik.
- Continue watching.
- Sinkronisasi riwayat dan favorit menggunakan Supabase.
- Guest access.

## Persiapan Backend (Supabase)
Pastikan script SQL di `supabase_setup.md` sudah dijalankan di dashboard Supabase Anda.

## Konfigurasi Secret (Wajib)
Jangan simpan key/token langsung di source code.

1. Salin file contoh:
   ```bash
   copy secrets.example.json secrets.dev.json
   ```
2. Isi nilai asli di `secrets.dev.json`.
3. Jalankan dengan `--dart-define-from-file`:

```bash
flutter run --dart-define-from-file=secrets.dev.json
```

Nilai `AUTH_EMAIL_REDIRECT_TO` bersifat opsional, namun disarankan untuk
alur verifikasi email Supabase.

Contoh nilai yang direkomendasikan:
```json
"AUTH_EMAIL_REDIRECT_TO": "reealms://auth/callback"
```

## Setup Redirect URL di Supabase
Agar link verifikasi email kembali ke aplikasi:

1. Buka `Authentication -> URL Configuration`.
2. Tambahkan `reealms://auth/callback` ke `Additional Redirect URLs`.
3. Simpan perubahan.

## Build Android APK
```bash
flutter build apk --release --dart-define-from-file=secrets.dev.json
```

APK output: `build/app/outputs/flutter-apk/app-release.apk`
