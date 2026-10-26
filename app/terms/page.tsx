'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--soyol-canvas)] pb-10 font-sans text-[var(--soyol-ink)]">
      <div className="sticky top-0 z-50 flex h-[56px] items-center border-b border-[var(--soyol-line)] bg-[var(--soyol-surface)]/95 px-4 backdrop-blur-sm">
        <Link href="/welcome" className="p-2 -ml-2 text-[var(--soyol-ink)]">
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 pr-8 text-center text-[16px] font-bold">Үйлчилгээний нөхцөл</h1>
      </div>

      <div className="p-4">
        <p className="mb-4 text-center text-[12px] font-medium text-[var(--soyol-muted)]">
          Soyol Delivery · Сүүлд шинэчлэгдсэн: 2026.10.26
        </p>

        <div className="space-y-6 rounded-[14px] bg-[var(--soyol-surface)] p-5 text-[14px] leading-[1.65] text-[var(--soyol-muted)] shadow-sm">
          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">1. Ерөнхий нөхцөл</h2>
            <p>
              Энэхүү нөхцөл нь Soyol Delivery (багцын ID: mn.delivery.app) мобайл апп болон холбогдох
              веб үйлчилгээг ашиглахтай холбоотой харилцааг зохицуулна. Апп-д бүртгүүлж, нэвтэрч
              ашигласнаар та эдгээр нөхцөлийг зөвшөөрсөнд тооцно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">2. Үйлчилгээний зориулалт</h2>
            <p>
              Soyol Delivery нь захиалагч, хүргэгч, диспетчер/админ хооронд хүргэлтийн захиалга
              бүртгэх, оноох, хянах, OTP-аар хүлээн авах, байршил/мэдэгдэл дамжуулах үйлчилгээ юм.
              Худалдааны дэлгүүр (Soyol Shop) тусдаа бүтээгдэхүүн бөгөөд энэхүү Delivery апп-ын
              нөхцөлөөс ялгаатай байж болно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">3. Бүртгэл ба данс</h2>
            <p>
              Та утасны дугаар, нэр, нууц үг зэрэг үнэн зөв мэдээлэл өгөх үүрэгтэй. Дансны нууцлалыг
              өөрөө хариуцна. Бүртгэл үүсгэх боломжтой тул апп доторх «Бүртгэл устгах» үйлдлээр
              дансаа устгах эрхтэй. Устгасны дараа профайл, холбоотой мэдэгдэл устгагдах бөгөөд
              үйлдлийг буцаах боломжгүй.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">4. Хэрэглэгч, хүргэгч, админ</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Хэрэглэгч: захиалга харах, хүргэлт хянах, OTP өгөх.</li>
              <li>Хүргэгч: бэлэн захиалга авах, хүргэх, байршил шинэчлэх.</li>
              <li>Админ/диспетчер: захиалга оноох, хянах, мэдэгдэл илгээх.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">5. Байршил ба мэдэгдэл</h2>
            <p>
              Хүргэлтийн явцад байршлын мэдээллийг зөвхөн захиалга гүйцэтгэх, хянах зорилгоор
              ашиглана. Push мэдэгдлийг захиалгын төлөв, шинэ ажил, аюулгүй байдлын мэдээлэлд
              ашиглаж болно. Тохиргооноос хязгаарлах боломжтой.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">6. Төлбөр ба хариуцлага</h2>
            <p>
              Хүргэлтийн төлбөр, курьер орлого нь захиалгын нөхцөл, платформын тохиргооноос
              хамаарна. Хүчинтэй бус мэдээлэл өгөх, гуравдагч этгээдийн эрх зөрчих, үйлчилгээг
              буруугаар ашиглахыг хориглоно. Ийм тохиолдолд данс хаах эрхтэй.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">7. Нууцлал</h2>
            <p>
              Хувийн мэдээллийн цуглуулалт, ашиглалтын дэлгэрэнгүйг{' '}
              <Link href="/privacy" className="font-bold text-[var(--soyol-brand)]">
                Нууцлалын бодлого
              </Link>
              -оос үзнэ үү.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[16px] font-bold text-[var(--soyol-ink)]">8. Холбоо барих</h2>
            <p>Асуулт, санал: support@soyol.mn</p>
          </section>
        </div>
      </div>
    </div>
  );
}
