export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export const CANCELLABLE_STATUSES: OrderStatus[] = ['pending'];
