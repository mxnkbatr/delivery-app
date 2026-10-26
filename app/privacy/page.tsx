export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 pb-32">
      <h1 className="text-2xl font-black text-[#1C1C1E] mb-2">Нууцлалын бодлого</h1>
      <p className="text-sm text-gray-400 mb-8">Soyol Delivery — mn.delivery.app</p>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">1. Цуглуулах мэдээлэл</h2>
        <p className="text-sm text-gray-600 leading-relaxed">Бид дараах мэдээллийг цуглуулна: нэр, утасны дугаар, хүргэлтийн хаяг, захиалгын түүх. Гуравдагч этгээдэд зарагдахгүй.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">2. Камер</h2>
        <p className="text-sm text-gray-600 leading-relaxed">Камерын эрхийг зөвхөн профайл зураг авахад ашиглана. Зураг Cloudinary серверт хадгалагдана. Хэрэглэгчийн зөвшөөрөлгүйгээр камер ажиллахгүй.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">3. Микрофон</h2>
        <p className="text-sm text-gray-600 leading-relaxed">Микрофоны эрхийг зөвхөн борлуулагчтай видео дуудлага хийхэд ашиглана. Дуу бичлэг хадгалагдахгүй.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">4. Push мэдэгдэл</h2>
        <p className="text-sm text-gray-600 leading-relaxed">Захиалгын төлөв, хүргэлтийн мэдэгдэл илгээхэд ашиглана. Тохиргооноос хаах боломжтой.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">5. Бүртгэл устгах</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Апп доторх Профайл → «Бүртгэл устгах» товчоор дансаа устгаж болно. Устгасны дараа профайл болон
          холбоотой мэдэгдэл устана.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold text-[#1C1C1E] mb-2">6. Холбоо барих</h2>
        <p className="text-sm text-gray-600 leading-relaxed">Асуулт байвал: support@soyol.mn</p>
      </section>

      <p className="text-xs text-gray-400">Сүүлд шинэчлэгдсэн: 2026.10.26</p>
    </div>
  );
}
