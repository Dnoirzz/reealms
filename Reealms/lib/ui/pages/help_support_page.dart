import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class HelpSupportPage extends StatelessWidget {
  const HelpSupportPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          "Bantuan & Dukungan",
          style: GoogleFonts.outfit(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).primaryColor.withOpacity(0.05),
              Colors.black,
            ],
          ),
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            _SectionCard(
              title: "Butuh bantuan cepat?",
              child: Text(
                "Temukan jawaban umum di bawah ini. Jika masih ada kendala, hubungi tim dukungan kami.",
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 14),
            _SectionCard(
              title: "FAQ",
              child: Column(
                children: const [
                  _FaqItem(
                    question: "Kenapa video tidak bisa diputar?",
                    answer:
                        "Pastikan koneksi internet stabil, coba ganti kualitas video, lalu buka ulang episode.",
                  ),
                  _FaqItem(
                    question: "Kenapa episode tertentu terkunci?",
                    answer:
                        "Akun tamu memiliki batas akses konten. Login akun member untuk membuka episode penuh.",
                  ),
                  _FaqItem(
                    question: "Bagaimana cara memulihkan kata sandi?",
                    answer:
                        "Di halaman login, pilih 'Lupa Kata Sandi?' lalu cek email untuk link atur ulang kata sandi.",
                  ),
                  _FaqItem(
                    question: "Kenapa favorit saya tidak tersimpan?",
                    answer:
                        "Fitur favorit hanya tersedia untuk akun member (bukan akun tamu).",
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _SectionCard(
              title: "Kontak Dukungan",
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  _SupportRow(
                    icon: Icons.email_outlined,
                    label: "Email",
                    value: "support@reealms.app",
                  ),
                  SizedBox(height: 10),
                  _SupportRow(
                    icon: Icons.access_time_outlined,
                    label: "Jam Operasional",
                    value: "Setiap hari, 08.00 - 22.00 WIB",
                  ),
                  SizedBox(height: 10),
                  _SupportRow(
                    icon: Icons.info_outline,
                    label: "Catatan",
                    value:
                        "Sertakan email akun dan judul konten saat melapor agar penanganan lebih cepat.",
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _FaqItem extends StatelessWidget {
  final String question;
  final String answer;

  const _FaqItem({required this.question, required this.answer});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 10),
        iconColor: Colors.white70,
        collapsedIconColor: Colors.white54,
        title: Text(
          question,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              answer,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SupportRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: Colors.white70, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(color: Colors.white70, fontSize: 13),
              children: [
                TextSpan(
                  text: "$label: ",
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextSpan(text: value),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
