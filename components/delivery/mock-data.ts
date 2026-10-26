export type DeliveryStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED_DELIVERY'
  | 'CANCELLED'
  | 'RETURN_REQUESTED';

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  CREATED: 'Бэлтгэгдэж байна',
  ASSIGNED: 'Томилогдсон',
  ACCEPTED: 'Хүлээн авсан',
  PICKED_UP: 'Авсан',
  IN_TRANSIT: 'Замд явж байна',
  DELIVERED: 'Хүргэгдсэн',
  FAILED_DELIVERY: 'Амжилтгүй',
  CANCELLED: 'Цуцлагдсан',
  RETURN_REQUESTED: 'Буцаалт',
};

export interface MockDeliveryOrder {
  id: string;
  code: string;
  status: DeliveryStatus;
  customerName: string;
  customerPhone: string;
  pickup: { text: string; lat: number; lng: number };
  dropoff: { text: string; lat: number; lng: number };
  distanceKm: number;
  etaMinutes: number;
  estimatedPrice: number;
  payout: number;
  itemsSummary: string;
  timeline: { status: DeliveryStatus; at: string }[];
  courier?: { name: string; phone: string; rating: number; vehicle: string };
}

export interface MockCourier {
  id: string;
  name: string;
  status: 'OFFLINE' | 'ONLINE' | 'ON_DELIVERY';
  zone: string;
  lat: number;
  lng: number;
  rating: number;
  activeOrderId: string | null;
  vehicleType: 'motorbike' | 'car' | 'foot';
}

export const MOCK_ACTIVE_ORDER: MockDeliveryOrder = {
  id: 'ord_88421',
  code: 'SD-88421',
  status: 'IN_TRANSIT',
  customerName: 'Бат-Эрдэнэ С.',
  customerPhone: '9911-2244',
  pickup: {
    text: 'Soyol Hub · БЗД, 15-р хороо',
    lat: 47.918,
    lng: 106.917,
  },
  dropoff: {
    text: 'Хан-Уул, 11-р хороо, 42-р байр, 8 давхар',
    lat: 47.886,
    lng: 106.905,
  },
  distanceKm: 6.4,
  etaMinutes: 14,
  estimatedPrice: 8500,
  payout: 6200,
  itemsSummary: '2 бараа · 1.8 кг',
  timeline: [
    { status: 'CREATED', at: '13:02' },
    { status: 'ASSIGNED', at: '13:04' },
    { status: 'ACCEPTED', at: '13:05' },
    { status: 'PICKED_UP', at: '13:18' },
    { status: 'IN_TRANSIT', at: '13:19' },
  ],
  courier: {
    name: 'Төгсжаргал М.',
    phone: '8800-1122',
    rating: 4.9,
    vehicle: 'Мотоцикл',
  },
};

export const MOCK_INCOMING: MockDeliveryOrder = {
  id: 'ord_88455',
  code: 'SD-88455',
  status: 'ASSIGNED',
  customerName: 'Сараа Д.',
  customerPhone: '9900-7788',
  pickup: {
    text: 'Soyol Hub · БЗД',
    lat: 47.918,
    lng: 106.917,
  },
  dropoff: {
    text: 'СБД, 1-р хороо · Peace Avenue 18',
    lat: 47.921,
    lng: 106.927,
  },
  distanceKm: 3.1,
  etaMinutes: 18,
  estimatedPrice: 5500,
  payout: 4100,
  itemsSummary: '1 бараа · хөнгөн',
  timeline: [
    { status: 'CREATED', at: '13:40' },
    { status: 'ASSIGNED', at: '13:41' },
  ],
};

export const MOCK_HISTORY: MockDeliveryOrder[] = [
  {
    ...MOCK_ACTIVE_ORDER,
    id: 'ord_88301',
    code: 'SD-88301',
    status: 'DELIVERED',
    dropoff: { text: 'Баянзүрх, 26-р хороо', lat: 47.93, lng: 106.94 },
    payout: 5800,
    etaMinutes: 0,
    timeline: [
      { status: 'CREATED', at: '09:10' },
      { status: 'DELIVERED', at: '09:42' },
    ],
  },
  {
    ...MOCK_ACTIVE_ORDER,
    id: 'ord_88288',
    code: 'SD-88288',
    status: 'DELIVERED',
    customerName: 'Мөнхзул Т.',
    payout: 7200,
    dropoff: { text: 'Чингэлтэй, 5-р хороо', lat: 47.92, lng: 106.91 },
    timeline: [
      { status: 'CREATED', at: '11:02' },
      { status: 'DELIVERED', at: '11:38' },
    ],
  },
];

export const MOCK_COURIERS: MockCourier[] = [
  {
    id: 'c1',
    name: 'Төгсжаргал М.',
    status: 'ON_DELIVERY',
    zone: 'Хан-Уул',
    lat: 47.9,
    lng: 106.91,
    rating: 4.9,
    activeOrderId: 'ord_88421',
    vehicleType: 'motorbike',
  },
  {
    id: 'c2',
    name: 'Энхбат Б.',
    status: 'ONLINE',
    zone: 'СБД',
    lat: 47.92,
    lng: 106.93,
    rating: 4.7,
    activeOrderId: null,
    vehicleType: 'motorbike',
  },
  {
    id: 'c3',
    name: 'Номин-Эрдэнэ',
    status: 'ONLINE',
    zone: 'БЗД',
    lat: 47.915,
    lng: 106.95,
    rating: 4.8,
    activeOrderId: null,
    vehicleType: 'car',
  },
  {
    id: 'c4',
    name: 'Ганзориг',
    status: 'OFFLINE',
    zone: 'Баянгол',
    lat: 47.91,
    lng: 106.88,
    rating: 4.6,
    activeOrderId: null,
    vehicleType: 'motorbike',
  },
];

export const MOCK_DISPATCH_QUEUE: MockDeliveryOrder[] = [
  MOCK_INCOMING,
  {
    ...MOCK_INCOMING,
    id: 'ord_88460',
    code: 'SD-88460',
    customerName: 'Ариунболд',
    distanceKm: 8.2,
    etaMinutes: 28,
    payout: 7800,
    dropoff: { text: 'Налайх зам · 12 км', lat: 47.87, lng: 107.1 },
  },
  MOCK_ACTIVE_ORDER,
];
