/**
 * Seed mock delivery orders ONLY for courier phone 99111111.
 * Run: npx tsx scripts/seed-courier-mock.ts
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const PHONE = '99111111';
const MOCK_TAG = 'courier_mock_99111111';

function digits(p: string) {
  return String(p || '').replace(/\D/g, '');
}

function phoneMatch(p: unknown) {
  const d = digits(String(p || ''));
  return d === PHONE || d.endsWith(PHONE) || d === `976${PHONE}`;
}

const districts = [
  {
    district: 'Хан-Уул',
    khoroo: '11',
    street: '42-р байр',
    entrance: 'А',
    floor: '8',
    door: '84',
    lat: 47.905,
    lng: 106.89,
  },
  {
    district: 'Сүхбаатар',
    khoroo: '1',
    street: 'Peace Avenue 18',
    entrance: 'Б',
    floor: '3',
    door: '12',
    lat: 47.918,
    lng: 106.917,
  },
  {
    district: 'Баянзүрх',
    khoroo: '5',
    street: '13-р хороолол, 7-р байр',
    entrance: '1',
    floor: '5',
    door: '51',
    lat: 47.93,
    lng: 106.94,
  },
  {
    district: 'Баянгол',
    khoroo: '3',
    street: '6-р хороолол',
    entrance: 'В',
    floor: '2',
    door: '7',
    lat: 47.91,
    lng: 106.87,
  },
  {
    district: 'Чингэлтэй',
    khoroo: '4',
    street: 'Olympic street 9',
    entrance: 'Г',
    floor: '12',
    door: '1204',
    lat: 47.925,
    lng: 106.905,
  },
];

const customers = [
  { name: 'Бат-Эрдэнэ С.', phone: '99112233' },
  { name: 'Оюунчимэг Д.', phone: '88776655' },
  { name: 'Төмөрбаатар Н.', phone: '99001122' },
  { name: 'Сарантуяа Б.', phone: '95123456' },
  { name: 'Энхбат Г.', phone: '88112233' },
  { name: 'Мөнхцэцэг А.', phone: '94111222' },
  { name: 'Болд-Эрдэнэ Т.', phone: '96667788' },
  { name: 'Нарантуяа Х.', phone: '90998877' },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI алга (.env.local)');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'Soyloo');
  const users = db.collection('users');
  const couriers = db.collection('couriers');
  const orders = db.collection('orders');

  const allUsers = await users.find({}).project({ phone: 1, role: 1, name: 1, roles: 1 }).toArray();
  const user = allUsers.find((u) => phoneMatch(u.phone));
  if (!user) {
    console.error(`Хэрэглэгч олдсонгүй: ${PHONE}`);
    console.log(
      'Ойролцоо утаснууд:',
      allUsers
        .map((u) => u.phone)
        .filter(Boolean)
        .slice(0, 20)
    );
    await client.close();
    process.exit(1);
  }

  const userId = user._id.toString();
  console.log('Found user:', userId, user.phone, user.role || user.roles);

  // Ensure courier role
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        role: 'courier',
        updatedAt: new Date(),
      },
      $addToSet: { roles: 'courier' },
    }
  );

  const existingCourier =
    (await couriers.findOne({ userId: user._id })) ||
    (await couriers.findOne({ userId })) ||
    (await couriers.findOne({ phone: PHONE }));

  if (!existingCourier) {
    await couriers.insertOne({
      userId: user._id,
      phone: PHONE,
      name: user.name || 'Mock Courier',
      vehicleType: 'motorbike',
      status: 'active',
      acceptanceRate: 96,
      acceptedCount: 48,
      rejectedCount: 2,
      totalDeliveries: 42,
      totalEarnings: 185000,
      rating: 4.9,
      lastLocation: { lat: 47.9184, lng: 106.9177, at: new Date() },
      createdAt: new Date(),
      updatedAt: new Date(),
      mockSeed: MOCK_TAG,
    });
    console.log('Courier profile created');
  } else {
    await couriers.updateOne(
      { _id: existingCourier._id },
      {
        $set: {
          vehicleType: existingCourier.vehicleType || 'motorbike',
          status: 'active',
          acceptanceRate: 96,
          acceptedCount: Math.max(Number(existingCourier.acceptedCount) || 0, 48),
          rejectedCount: Number(existingCourier.rejectedCount) || 2,
          totalDeliveries: Math.max(Number(existingCourier.totalDeliveries) || 0, 42),
          totalEarnings: Math.max(Number(existingCourier.totalEarnings) || 0, 185000),
          rating: 4.9,
          lastLocation: {
            lat: 47.9184,
            lng: 106.9177,
            at: new Date(),
          },
          updatedAt: new Date(),
          mockSeed: MOCK_TAG,
        },
      }
    );
    console.log('Courier profile updated');
  }

  // Remove previous mock for this phone
  const del = await orders.deleteMany({ mockSeed: MOCK_TAG });
  console.log('Removed old mock orders:', del.deletedCount);

  const now = new Date();
  const hour = (h: number) => {
    const d = new Date(now);
    d.setHours(h, 15 + (h % 3) * 7, 0, 0);
    return d;
  };
  const daysAgo = (n: number, h = 14) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(h, 20, 0, 0);
    return d;
  };

  const baseShipping = (i: number, c: (typeof customers)[0], loc: (typeof districts)[0]) => ({
    fullName: c.name,
    name: c.name,
    phone: c.phone,
    city: 'Улаанбаатар',
    district: loc.district,
    khoroo: loc.khoroo,
    street: loc.street,
    entrance: loc.entrance,
    floor: loc.floor,
    door: loc.door,
    address: `${loc.khoroo}-р хороо, ${loc.street}, Орц: ${loc.entrance}, Давхар: ${loc.floor}, Хаалга: ${loc.door}`,
    lat: loc.lat,
    lng: loc.lng,
  });

  const docs: Record<string, unknown>[] = [];

  // —— Ready queue (exclusive to this courier) ——
  // No deliveryVehicleType → any courier vehicle can see them
  for (let i = 0; i < 7; i++) {
    const c = customers[i % customers.length];
    const loc = districts[i % districts.length];
    const payout = [6600, 5200, 6100, 4500, 7200, 5800, 3900][i];
    docs.push({
      mockSeed: MOCK_TAG,
      exclusiveCourierId: userId,
      readyForDelivery: true,
      readyForDeliveryAt: new Date(now.getTime() - i * 4 * 60_000),
      status: 'processing',
      deliveryMethod: 'delivery',
      courierPayout: payout,
      courierTip: i === 2 ? 500 : 0,
      courierBonus: i === 4 ? 1000 : 0,
      shippingCost: payout,
      packageCount: i % 3 === 0 ? 2 : 1,
      packageSize: i === 4 ? 'large' : i >= 2 ? 'medium' : 'small',
      packageCategory: (['general', 'food', 'electronics', 'general', 'food', 'general', 'electronics'] as const)[i],
      packageHandling: [
        { upright: true, nonBreakable: true },
        { coldChain: true },
        { fragile: true, upright: true },
        { horizontal: true },
        { coldChain: true, fragile: true },
        { upright: true },
        { fragile: true },
      ][i],
      phone: c.phone,
      shipping: baseShipping(i, c, loc),
      items: [{ name: 'Нууцлагдсан бараа', quantity: 1 }],
      total: 45000 + i * 3000,
      createdAt: new Date(now.getTime() - (i + 1) * 3600_000),
      updatedAt: now,
      manualDelivery: false,
      adminNote: 'Mock demo order',
    });
  }

  // —— Active / accepted (mine) ——
  for (let i = 0; i < 2; i++) {
    const c = customers[5 + i];
    const loc = districts[(i + 2) % districts.length];
    const payout = [5500, 4800][i];
    docs.push({
      mockSeed: MOCK_TAG,
      exclusiveCourierId: userId,
      readyForDelivery: true,
      readyForDeliveryAt: daysAgo(0, 10),
      status: 'shipped',
      deliveryMethod: 'delivery',
      deliveryVehicleType: 'motorbike',
      courierId: userId,
      courierAcceptedAt: hour(11 + i),
      courierFlowStep: i === 0 ? 'en_route' : 'accepted',
      courierEnRouteAt: i === 0 ? hour(11) : null,
      courierPayout: payout,
      courierTip: 0,
      courierBonus: 0,
      shippingCost: payout,
      packageCount: 1,
      packageSize: 'medium',
      phone: c.phone,
      shipping: baseShipping(i, c, loc),
      items: [{ name: 'Нууцлагдсан бараа', quantity: 1 }],
      total: 52000,
      createdAt: daysAgo(0, 9),
      updatedAt: now,
    });
  }

  // —— Delivered today (earnings / dashboard) ——
  for (let i = 0; i < 4; i++) {
    const c = customers[i];
    const loc = districts[i % districts.length];
    const payout = [4200, 5100, 3900, 6400][i];
    const tip = i === 1 ? 1000 : 0;
    const bonus = i === 3 ? 800 : 0;
    docs.push({
      mockSeed: MOCK_TAG,
      exclusiveCourierId: userId,
      readyForDelivery: true,
      status: 'delivered',
      deliveryMethod: 'delivery',
      deliveryVehicleType: 'motorbike',
      courierId: userId,
      courierAcceptedAt: hour(8 + i),
      courierFlowStep: 'completing',
      courierPayout: payout,
      courierTip: tip,
      courierBonus: bonus,
      shippingCost: payout,
      deliveredAt: hour(9 + i),
      packageCount: 1,
      packageSize: 'small',
      phone: c.phone,
      shipping: baseShipping(i, c, loc),
      items: [{ name: 'Нууцлагдсан бараа', quantity: 1 }],
      total: 38000 + i * 2000,
      createdAt: hour(7 + i),
      updatedAt: hour(9 + i),
    });
  }

  // —— Delivered earlier this week ——
  for (let i = 0; i < 3; i++) {
    const c = customers[(i + 3) % customers.length];
    const loc = districts[(i + 1) % districts.length];
    const payout = [4700, 5300, 4100][i];
    docs.push({
      mockSeed: MOCK_TAG,
      exclusiveCourierId: userId,
      readyForDelivery: true,
      status: 'delivered',
      deliveryMethod: 'delivery',
      deliveryVehicleType: 'motorbike',
      courierId: userId,
      courierAcceptedAt: daysAgo(i + 1, 12),
      courierPayout: payout,
      courierTip: i === 0 ? 300 : 0,
      courierBonus: 0,
      shippingCost: payout,
      deliveredAt: daysAgo(i + 1, 13),
      packageCount: 1,
      phone: c.phone,
      shipping: baseShipping(i, c, loc),
      items: [{ name: 'Нууцлагдсан бараа', quantity: 1 }],
      total: 41000,
      createdAt: daysAgo(i + 1, 11),
      updatedAt: daysAgo(i + 1, 13),
    });
  }

  // —— Cancelled ——
  {
    const c = customers[7];
    const loc = districts[0];
    docs.push({
      mockSeed: MOCK_TAG,
      exclusiveCourierId: userId,
      readyForDelivery: false,
      status: 'cancelled',
      deliveryMethod: 'delivery',
      deliveryVehicleType: 'motorbike',
      courierId: userId,
      courierAcceptedAt: daysAgo(1, 16),
      courierPayout: 4000,
      shippingCost: 4000,
      phone: c.phone,
      shipping: baseShipping(0, c, loc),
      items: [{ name: 'Нууцлагдсан бараа', quantity: 1 }],
      total: 22000,
      createdAt: daysAgo(1, 15),
      updatedAt: daysAgo(1, 17),
    });
  }

  const result = await orders.insertMany(docs);
  console.log(`Inserted ${result.insertedCount} mock orders for ${PHONE} (user ${userId})`);

  // In-app notifications for ready mock offers
  const notifications = db.collection('notifications');
  await notifications.deleteMany({ mockSeed: MOCK_TAG, userId });
  const readyIds = Object.values(result.insertedIds).slice(0, 7);
  const notifDocs = readyIds.map((oid, i) => {
    const code = `SD-${oid.toString().slice(-5).toUpperCase()}`;
    const payout = [6600, 5200, 6100, 4500, 7200, 5800, 3900][i];
    return {
      mockSeed: MOCK_TAG,
      userId,
      title: i === 0 ? '🚚 Шинэ хүргэлтийн захиалга' : '📦 Хүргэхэд бэлэн бараа',
      message: `${code} · Орлого ₮${payout.toLocaleString('mn-MN')} · Ойрхон захиалга`,
      type: 'delivery_ready',
      isRead: i > 2,
      link: '/work',
      orderId: oid.toString(),
      createdAt: new Date(now.getTime() - i * 90_000),
    };
  });
  if (notifDocs.length) {
    await notifications.insertMany(notifDocs);
    console.log(`Inserted ${notifDocs.length} delivery notifications`);
  }

  console.log('  — 7 бэлэн (зөвхөн таньд)');
  console.log('  — 2 идэвхтэй хүргэлт');
  console.log('  — 4 өнөөдөр хүргэсэн + 3 7 хоногийн + 1 цуцлагдсан');
  console.log('Done. /work · /history · самбар дээр харагдана.');

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
