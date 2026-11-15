import { useState } from 'react';
import { CheckCircle2, ShoppingBag, Truck, X } from 'lucide-react';
import { BookItem, BOOKS } from '../data/academyData';
import { ResilientImage } from './ResilientImage';

const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'الشرقية',
  'الغربية',
  'القليوبية',
  'أسيوط',
  'المنيا',
];

export function BooksStoreSection() {
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [governorate, setGovernorate] = useState<string>(GOVERNORATES[0]);
  const [address, setAddress] = useState<string>('');
  const [orderDoneId, setOrderDoneId] = useState<string | null>(null);

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const randomOrderCode = `EZZ-BK-${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderDoneId(randomOrderCode);
  };

  return (
    <section id="books-section" className="py-16 lg:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              متجر الكتب والملازم الدراسية
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              اطلب كتب الشرح وبنوك أسئلة شوامل الأوائل مع أكواد التفعيل المطبوعة وتوصيل سريع لجميع محافظات مصر.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <Truck className="w-4 h-4 text-blue-700" />
            <span>الشحن خلال ٢ إلى ٤ أيام عمل لجميع المحافظات</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {BOOKS.map((book) => (
            <article
              key={book.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                  <ResilientImage
                    src={book.image}
                    alt={book.title}
                    fallbackTitle={book.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2.5">
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-blue-700">{book.grade}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{book.pagesCount} صفحة</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{book.subtitle}</p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {book.priceEgp} ج.م
                  </div>
                  {book.includesCode && (
                    <div className="text-[11px] text-emerald-700 font-medium">
                      شامل كود فيديو مجاني
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBook(book);
                    setOrderDoneId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>اطلب الآن</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {selectedBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-order-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-900">
                <ShoppingBag className="w-5 h-5 text-blue-700" />
                <h3 id="book-order-title" className="text-lg font-bold">
                  طلب توصيل كتاب
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="إغلاق"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderDoneId ? (
              <div className="py-4 space-y-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-lg font-bold text-slate-900">تم تسجيل طلبك بنجاح</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  سيتم التواصل معك على رقم{' '}
                  <span className="font-mono font-semibold" dir="ltr">
                    {phone}
                  </span>{' '}
                  لتأكيد شحن «{selectedBook.title}» إلى محافظة {governorate}.
                </p>
                <div className="text-xs font-mono text-slate-500">
                  رقم الطلب: {orderDoneId} · الدفع عند الاستلام ({selectedBook.priceEgp + 35} ج.م شامل الشحن)
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  تم
                </button>
              </div>
            ) : (
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{selectedBook.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{selectedBook.grade}</div>
                  </div>
                  <div className="text-sm font-bold text-blue-700 tabular-nums shrink-0">
                    {selectedBook.priceEgp} ج.م
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="book-recipient" className="block text-xs font-semibold text-slate-700 mb-1">
                      اسم المستلم
                    </label>
                    <input
                      id="book-recipient"
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="الاسم الكامل"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="book-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      رقم الموبايل (واتساب)
                    </label>
                    <input
                      id="book-phone"
                      type="tel"
                      dir="ltr"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="book-gov" className="block text-xs font-semibold text-slate-700 mb-1">
                      المحافظة
                    </label>
                    <select
                      id="book-gov"
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {GOVERNORATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="book-address" className="block text-xs font-semibold text-slate-700 mb-1">
                      العنوان بالتفصيل
                    </label>
                    <input
                      id="book-address"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الحي، الشارع، أقرب علامة"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
                  <span>تكلفة الشحن: ٣٥ ج.م (الدفع عند الاستلام)</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBook(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                    >
                      تأكيد الطلب
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
