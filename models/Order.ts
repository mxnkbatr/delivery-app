export interface OrderFormData {
  fullName: string;
  phone: string;
  label?: string; // e.g. "Home", "Work"
  address: string;
  city: string;
  district: string;
  khoroo?: string;
  street?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  door?: string;
  notes?: string;
}

export interface Order extends OrderFormData {
  id: string;
  items: {
    id: string;
    productId?: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    variantId?: string;
    selectedOptions?: Record<string, string>;
  }[];
  totalPrice: number;
  total?: number; // fallback
  createdAt: string | Date;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  deliveryEstimate?: string; // e.g. "2 weeks", "2-5 days"
}
