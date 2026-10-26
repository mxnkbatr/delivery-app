/** Courier / delivery vehicle types */

export const DELIVERY_VEHICLES = ['motorbike', 'car', 'foot'] as const;
export type DeliveryVehicleType = (typeof DELIVERY_VEHICLES)[number];

export const VEHICLE_MN: Record<DeliveryVehicleType, string> = {
  motorbike: 'Мотоцикл',
  car: 'Машин',
  foot: 'Явган',
};

export function isDeliveryVehicle(v: unknown): v is DeliveryVehicleType {
  return typeof v === 'string' && (DELIVERY_VEHICLES as readonly string[]).includes(v);
}
