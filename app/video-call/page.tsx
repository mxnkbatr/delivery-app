import { Suspense } from 'react';
import VideoCall from '@/components/VideoCall';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Видео дуудлага',
};

export default function VideoCallPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="animate-spin text-orange-500 w-8 h-8" />
        </div>
      }
    >
      <VideoCall />
    </Suspense>
  );
}
