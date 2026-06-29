import React from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";

export const metadata = {
  title: "Terms of Service | Leiz Store",
  description: "Terms of Service for Leiz Store",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-white/50 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </Link>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 sm:p-12 backdrop-blur-sm">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Pendahuluan</h2>
            <p>
              Selamat datang di Leiz Store. Dengan mengakses dan menggunakan layanan kami, Anda menyetujui
              untuk terikat dengan Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan bagian mana pun
              dari syarat ini, Anda tidak diperkenankan untuk menggunakan layanan kami.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Layanan dan Produk</h2>
            <p>
              Leiz Store menyediakan layanan digital, top-up, dan akun premium. Semua produk digital yang
              telah berhasil dikirimkan ke pembeli tidak dapat dikembalikan (non-refundable) kecuali
              terdapat kesalahan teknis dari pihak kami yang tidak dapat diselesaikan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Pembayaran dan Verifikasi</h2>
            <p>
              Pembayaran dilakukan melalui transfer bank atau e-wallet (GoPay, DANA, dll) yang tersedia di
              halaman checkout. Pesanan hanya akan diproses setelah pembayaran berhasil diverifikasi oleh
              sistem kami atau admin melalui integrasi Discord. Anda wajib memberikan bukti transfer yang
              sah.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Kebijakan Anti-Kecurangan</h2>
            <p>
              Tindakan pemalsuan bukti transfer, percobaan penipuan, atau *chargeback* palsu akan berakibat
              pada pemblokiran permanen dari layanan kami, dan jika diperlukan, akan kami laporkan kepada
              pihak berwenang atau server Discord terkait.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Perubahan Syarat</h2>
            <p>
              Kami berhak untuk memodifikasi atau mengganti Syarat dan Ketentuan ini kapan saja. Setiap
              perubahan akan langsung berlaku setelah diterbitkan di halaman ini. Penggunaan berkelanjutan
              Anda atas layanan kami setelah perubahan merupakan bentuk persetujuan terhadap syarat yang baru.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Kontak Kami</h2>
            <p>
              Jika Anda memiliki pertanyaan tentang Syarat dan Ketentuan ini, silakan hubungi kami melalui
              server Discord kami atau informasi kontak yang tersedia di situs web.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-sm text-white/40">
          Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
        </div>
      </div>
    </main>
  );
}
