'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Heart, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import toast from 'react-hot-toast';
import UniversalProductCard from '@/components/UniversalProductCard';

export default function SavedItemsPage() {
  const { items, removeItem } = useWishlistStore();
  const { addItem } = useCartStore();

  const handleAddToCart = (item: any) => {
    addItem({ ...item, stockStatus: 'in-stock' });
    toast.success('Сагсанд нэмлээ');
  };

  const handleRemove = (id: string) => {
    removeItem(id);
    toast.success('Хүслээс хассан');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans pb-24">
      {/* Header */}
      <div className="bg-white h-[56px] flex items-center px-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sticky top-0 z-50">
        <Link href="/profile" className="p-2 -ml-2 text-[#1A1A1A]">
          <ChevronLeft className="w-6 h-6" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-center text-[16px] font-bold text-[#1A1A1A] pr-8">
          Хадгалсан бараа
        </h1>
        {items.length > 0 && (
          <span className="text-[13px] font-bold text-[#FF6B00]">{items.length} бараа</span>
        )}
      </div>

      <div className="p-4">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-1">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <UniversalProductCard product={item as any} index={index} disableInitialAnimation={true} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center px-4">
            <div className="w-[100px] h-[100px] rounded-full bg-white shadow-sm flex items-center justify-center mb-6 relative">
              <Heart className="w-12 h-12 text-[#FF6B00]" strokeWidth={1.5} />
              <div className="absolute -bottom-2 -right-2 bg-orange-100 rounded-full w-8 h-8 flex items-center justify-center border-2 border-white">
                <span className="text-orange-500 font-bold text-xs">0</span>
              </div>
            </div>
            <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-2">Хадгалсан бараа байхгүй байна</h3>
            <p className="text-[14px] text-[#999999] mb-8">Таалагдсан барааныхаа зүрхэн дээр дарж энд хадгалаарай.</p>
            <Link href="/" className="px-8 py-3.5 bg-gradient-to-r from-[#FF6B00] to-[#FF8C00] text-white text-[15px] font-bold rounded-xl shadow-[0_4px_12px_rgba(255,107,0,0.3)] active:opacity-90 transition-opacity">
              Дэлгүүр хэсэх
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
