import type { Metadata } from 'next';
import './delivery.css';

export const metadata: Metadata = {
  title: {
    default: 'Soyol Delivery',
    template: '%s · Soyol Delivery',
  },
  description: 'Хүргэлтийн платформ — хүргэгч, диспетчер, захиалагчийн tracking.',
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <div className="dl-root min-h-screen">{children}</div>;
}
