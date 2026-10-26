import {
  MOCK_ACTIVE_ORDER,
  MOCK_HISTORY,
  MOCK_INCOMING,
  STATUS_LABEL,
  type MockDeliveryOrder,
} from '@/components/delivery/mock-data';

/** Demo customer deliveries until Phase 1 API is wired */
export const CUSTOMER_ORDERS: MockDeliveryOrder[] = [
  {
    ...MOCK_ACTIVE_ORDER,
    customerName: 'Та',
  },
  {
    ...MOCK_INCOMING,
    id: 'ord_pending',
    code: 'SD-88455',
    status: 'ASSIGNED',
    customerName: 'Та',
  },
  ...MOCK_HISTORY.map((o) => ({ ...o, customerName: 'Та' })),
];

export function getCustomerOrder(id: string) {
  return CUSTOMER_ORDERS.find((o) => o.id === id || o.code === id);
}

export { STATUS_LABEL };
