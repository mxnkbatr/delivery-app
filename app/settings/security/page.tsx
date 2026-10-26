'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock, Eye, BarChart2, Smartphone, PauseCircle, Trash2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import toast from 'react-hot-toast';

export default function SecurityPage() {
  const [dataUsage, setDataUsage] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'УСТГА') {
      toast.error('Баталгаажуулах үг буруу байна');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await authFetch('/api/user/delete', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success('Бүртгэл амжилттай устгагдлаа');
        setShowDeleteModal(false);
        await logout();
        router.push('/welcome');
      } else {
        toast.error(data.error || 'Алдаа гарлаа');
      }
    } catch {
      toast.error('Сервертэй холбогдож чадсангүй');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans pb-10">
      {/* Header */}
      <div className="bg-white h-[56px] flex items-center px-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sticky top-0 z-50">
        <Link href="/profile" className="p-2 -ml-2 text-[#1A1A1A]">
          <ChevronLeft className="w-6 h-6" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-center text-[16px] font-bold text-[#1A1A1A] pr-8">
          Нууцлал & Аюулгүй байдал
        </h1>
      </div>

      <div className="p-4 space-y-6 mt-2">

        {/* Нууцлал */}
        <div>
          <h2 className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2">Нууцлал</h2>
          <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">

            <Link href="/settings/password" className="flex items-center justify-between px-4 h-[64px] active:bg-gray-50 transition-colors border-b border-[#F5F5F5]">
              <div className="flex items-center gap-4">
                <Lock className="w-[22px] h-[22px] text-[#444444]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#1A1A1A]">Нууц үг солих</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#CCCCCC]" strokeWidth={2} />
            </Link>

            <Link href="/settings/visibility" className="flex items-center justify-between px-4 h-[64px] active:bg-gray-50 transition-colors border-b border-[#F5F5F5]">
              <div className="flex items-center gap-4">
                <Eye className="w-[22px] h-[22px] text-[#444444]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#1A1A1A]">Профайл харагдах байдал</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#CCCCCC]" strokeWidth={2} />
            </Link>

            <div className="flex items-center justify-between px-4 h-[64px] border-b border-[#F5F5F5]">
              <div className="flex items-center gap-4">
                <BarChart2 className="w-[22px] h-[22px] text-[#444444]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#1A1A1A]">Мэдээлэл ашиглалт</span>
              </div>
              <button
                type="button"
                onClick={() => setDataUsage(!dataUsage)}
                className={`w-12 h-6 rounded-full transition-colors relative ${dataUsage ? 'bg-black' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dataUsage ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <Link href="/settings/sessions" className="flex items-center justify-between px-4 h-[64px] active:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <Smartphone className="w-[22px] h-[22px] text-[#444444]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#1A1A1A]">Идэвхтэй сессүүд</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#CCCCCC]" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Данс удирдлага */}
        <div>
          <h2 className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2">Данс удирдлага</h2>
          <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">

            <button
              type="button"
              className="w-full flex items-center justify-between px-4 h-[64px] active:bg-gray-50 transition-colors text-left border-b border-[#F5F5F5]"
              onClick={() => toast('Удахгүй нэмэгдэх болно')}
            >
              <div className="flex items-center gap-4">
                <PauseCircle className="w-[22px] h-[22px] text-[#FF6B00]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#FF6B00]">Данс түр зогсоох</span>
              </div>
            </button>

            <button
              type="button"
              className="w-full flex items-center justify-between px-4 h-[64px] active:bg-red-50 transition-colors text-left"
              onClick={() => setShowDeleteModal(true)}
            >
              <div className="flex items-center gap-4">
                <Trash2 className="w-[22px] h-[22px] text-[#FF3B30]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[#FF3B30]">Бүртгэл устгах</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#FF3B30]" strokeWidth={2} />
                </div>
                <h3 className="text-[18px] font-bold text-[#1A1A1A]">Бүртгэл устгах</h3>
              </div>
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} className="p-1">
                <X className="w-5 h-5 text-[#999]" />
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 space-y-2">
              <p className="text-[13px] font-bold text-[#FF3B30]">⚠️ Анхааруулга</p>
              <p className="text-[13px] text-[#666] leading-relaxed">
                Данс устгасан тохиолдолд таны бүх захиалга, хаяг, хадгалсан бараа бүрмөсөн устагдана. Энэ үйлдлийг буцаах боломжгүй.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-bold text-[#1A1A1A]">
                Баталгаажуулахын тулд <span className="text-[#FF3B30]">УСТГА</span> гэж бич:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="УСТГА"
                className="w-full border-2 border-[#F0F0F0] focus:border-[#FF3B30] rounded-2xl px-4 py-3 text-[15px] font-bold outline-none transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#F0F0F0] text-[15px] font-bold text-[#666]"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'УСТГА' || isDeleting}
                className="flex-1 py-3.5 rounded-2xl bg-[#FF3B30] text-white text-[15px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {isDeleting ? 'Устгаж байна...' : 'Устгах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
