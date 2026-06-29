import React from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";

export const metadata = {
  title: "Privacy Policy | Leiz Store",
  description: "Privacy Policy for Leiz Store",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Informasi yang Kami Kumpulkan</h2>
            <p>
              Saat Anda menggunakan layanan Leiz Store, kami dapat mengumpulkan beberapa informasi pribadi,
              termasuk namun tidak terbatas pada: nama Discord, ID Discord, alamat email (jika diberikan),
              serta riwayat transaksi dan detail pesanan Anda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Bagaimana Kami Menggunakan Informasi Anda</h2>
            <p>
              Informasi yang kami kumpulkan digunakan semata-mata untuk memproses pesanan Anda, mengirimkan
              notifikasi terkait status pesanan melalui Discord bot kami, dan untuk kepentingan pencatatan
              (log) internal yang membantu kami mencegah penipuan serta meningkatkan kualitas layanan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Keamanan Data</h2>
            <p>
              Kami sangat menghargai privasi Anda dan menggunakan standar keamanan enkripsi terkini (melalui
              infrastruktur Supabase dan Vercel) untuk melindungi data pribadi dan pesanan Anda. Kami tidak
              menyimpan informasi sensitif seperti nomor PIN atau *password* akun bank Anda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Berbagi Informasi Pihak Ketiga</h2>
            <p>
              Kami tidak pernah menjual, menyewakan, atau memperdagangkan informasi identitas pribadi Anda
              kepada pihak ketiga. Kami hanya membagikan informasi pesanan ke Discord untuk notifikasi yang
              esensial, dan mungkin membagikan data kepada pihak penegak hukum jika terjadi percobaan
              penipuan (fraud) tingkat tinggi sesuai dengan peraturan yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Discord Integration</h2>
            <p>
              Karena kami sangat bergantung pada layanan pihak ketiga yakni Discord, kebijakan privasi kami
              juga tunduk pada Kebijakan Privasi Discord. Data ID Anda diproses secara aman menggunakan bot
              resmi untuk mempermudah alur notifikasi pembayaran.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Perubahan pada Kebijakan Ini</h2>
            <p>
              Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Kami mengimbau Anda untuk
              meninjau halaman ini secara berkala agar Anda mengetahui perubahan apa pun. Penggunaan
              layanan kami yang berkelanjutan dianggap sebagai persetujuan Anda atas kebijakan privasi kami.
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
