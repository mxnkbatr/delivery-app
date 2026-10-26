'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            toast.error('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Шинэ нууц үг таарахгүй байна');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/user/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                toast.success(data.message || 'Нууц үг амжилттай солигдлоо');
            } else {
                toast.error(data.error || 'Алдаа гарлаа');
            }
        } catch {
            toast.error('Сервертэй холбогдож чадсангүй');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans pb-10">
            {/* Header */}
            <div className="bg-white h-[56px] flex items-center px-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sticky top-0 z-50">
                <Link href="/settings/security" className="p-2 -ml-2 text-[#1A1A1A]">
                    <ChevronLeft className="w-6 h-6" strokeWidth={2} />
                </Link>
                <h1 className="flex-1 text-center text-[16px] font-bold text-[#1A1A1A] pr-8">
                    Нууц үг солих
                </h1>
            </div>

            <div className="p-4 mt-4 space-y-6">

                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-[14px] px-4 py-3 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <p className="text-[14px] text-green-700 font-medium">Нууц үг амжилттай солигдлоо!</p>
                    </div>
                )}

                {/* Info card */}
                <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#FFF3E8] flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-[#FF6B00]" />
                    </div>
                    <div>
                        <p className="text-[14px] font-bold text-[#1A1A1A]">Нууцлалаа хамгаалаарай</p>
                        <p className="text-[12px] text-[#999999] mt-0.5">Хамгийн багадаа 6 тэмдэгт, том жижиг үсэг оруулахыг зөвлөж байна</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">

                    {/* Current password */}
                    <div>
                        <label className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2 block">
                            Одоогийн нууц үг
                        </label>
                        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 h-[56px] flex items-center gap-3">
                            <Lock className="w-[18px] h-[18px] text-[#CCCCCC] shrink-0" strokeWidth={1.5} />
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Одоогийн нууц үгээ оруулна уу"
                                required
                                className="flex-1 text-[15px] text-[#1A1A1A] placeholder-[#CCCCCC] bg-transparent outline-none"
                            />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="p-1 text-[#CCCCCC]">
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New password */}
                    <div>
                        <label className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2 block">
                            Шинэ нууц үг
                        </label>
                        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 h-[56px] flex items-center gap-3">
                            <Lock className="w-[18px] h-[18px] text-[#CCCCCC] shrink-0" strokeWidth={1.5} />
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Шинэ нууц үг"
                                required
                                className="flex-1 text-[15px] text-[#1A1A1A] placeholder-[#CCCCCC] bg-transparent outline-none"
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} className="p-1 text-[#CCCCCC]">
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {newPassword && newPassword.length < 6 && (
                            <p className="text-[12px] text-red-500 ml-4 mt-1">Хамгийн багадаа 6 тэмдэгт байх ёстой</p>
                        )}
                    </div>

                    {/* Confirm new password */}
                    <div>
                        <label className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2 block">
                            Нууц үг давтах
                        </label>
                        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 h-[56px] flex items-center gap-3">
                            <Lock className="w-[18px] h-[18px] text-[#CCCCCC] shrink-0" strokeWidth={1.5} />
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Шинэ нууц үгээ дахин оруулна уу"
                                required
                                className="flex-1 text-[15px] text-[#1A1A1A] placeholder-[#CCCCCC] bg-transparent outline-none"
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="p-1 text-[#CCCCCC]">
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-[12px] text-red-500 ml-4 mt-1">Нууц үг таарахгүй байна</p>
                        )}
                        {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                            <p className="text-[12px] text-green-500 ml-4 mt-1">✓ Нууц үг таарч байна</p>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[52px] bg-[#FF6B00] text-white font-bold text-[16px] rounded-[14px] flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : 'Нууц үг солих'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
