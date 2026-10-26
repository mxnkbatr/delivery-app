import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

const VEHICLES = new Set(['motorbike', 'car', 'foot']);

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    const users = await getCollection('users');
    const couriers = await getCollection('couriers');

    const courierUsers = await users
      .find({ role: 'courier' }, { projection: { name: 1, phone: 1, createdAt: 1, status: 1 } })
      .sort({ createdAt: -1 })
      .toArray();

    const courierDocs = await couriers.find({}).toArray();
    const byUserId = new Map(courierDocs.map((c) => [c.userId?.toString?.() || String(c.userId), c]));

    let list = courierUsers.map((u) => {
      const doc = byUserId.get(u._id.toString());
      return {
        id: u._id.toString(),
        name: u.name || 'Хүргэгч',
        phone: u.phone || '',
        status: doc?.status || 'OFFLINE',
        vehicleType: doc?.vehicleType || 'motorbike',
        zone: doc?.zone || 'Улаанбаатар',
        rating: doc?.rating ?? 5,
        totalDeliveries: doc?.totalDeliveries ?? 0,
        totalEarnings: Number(doc?.totalEarnings) || 0,
        totalTips: Number(doc?.totalTips) || 0,
        totalBonus: Number(doc?.totalBonus) || 0,
        activeOrderId: doc?.activeOrderId || null,
        lastLocation:
          doc?.lastLocation?.lat != null
            ? {
                lat: Number(doc.lastLocation.lat),
                lng: Number(doc.lastLocation.lng),
                updatedAt: doc.lastLocation.updatedAt || null,
              }
            : null,
        createdAt: u.createdAt,
      };
    });

    // Couriers collection entries without matching user role
    for (const doc of courierDocs) {
      const uid = doc.userId?.toString?.() || String(doc.userId);
      if (!list.find((c) => c.id === uid)) {
        list.push({
          id: uid,
          name: 'Хүргэгч',
          phone: '',
          status: doc.status || 'OFFLINE',
          vehicleType: doc.vehicleType || 'motorbike',
          zone: doc.zone || 'Улаанбаатар',
          rating: doc.rating ?? 5,
          totalDeliveries: doc.totalDeliveries ?? 0,
          totalEarnings: Number(doc.totalEarnings) || 0,
          totalTips: Number(doc.totalTips) || 0,
          totalBonus: Number(doc.totalBonus) || 0,
          activeOrderId: doc.activeOrderId || null,
          lastLocation:
            doc.lastLocation?.lat != null
              ? {
                  lat: Number(doc.lastLocation.lat),
                  lng: Number(doc.lastLocation.lng),
                  updatedAt: doc.lastLocation.updatedAt || null,
                }
              : null,
          createdAt: doc.createdAt,
        });
      }
    }

    if (q) {
      list = list.filter((c) => {
        const name = String(c.name || '')
          .toLowerCase()
          .replace(/\s+/g, '');
        const phone = String(c.phone || '').replace(/\D/g, '');
        const qDigits = q.replace(/\D/g, '');
        return (
          name.includes(q) ||
          phone.includes(qDigits || q) ||
          String(c.phone || '').toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({ couriers: list, total: list.length });
  } catch (error) {
    console.error('[admin/couriers GET]', error);
    return NextResponse.json({ error: 'Failed to load couriers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json();
    const {
      phone,
      password,
      name,
      vehicleType = 'motorbike',
      zone = 'Улаанбаатар',
    } = body;

    if (!phone || !password || !name) {
      return NextResponse.json({ error: 'Нэр, утас, нууц үг заавал' }, { status: 400 });
    }
    if (String(phone).length < 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу' }, { status: 400 });
    }
    if (!VEHICLES.has(vehicleType)) {
      return NextResponse.json({ error: 'Тээврийн төрөл буруу' }, { status: 400 });
    }
    if (String(password).length < 4) {
      return NextResponse.json({ error: 'Нууц үг хэт богино' }, { status: 400 });
    }

    const users = await getCollection('users');
    const couriers = await getCollection('couriers');
    const existing = await users.findOne({ phone: String(phone) });
    const now = new Date();

    if (existing) {
      if (existing.role === 'courier') {
        return NextResponse.json({ error: 'Энэ утас аль хэдийн хүргэгч' }, { status: 409 });
      }
      if (existing.role === 'admin') {
        return NextResponse.json({ error: 'Админ эрхтэй хэрэглэгч' }, { status: 403 });
      }

      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            role: 'courier',
            name: String(name).trim(),
            password: await bcrypt.hash(String(password), 10),
            updatedAt: now,
          },
        }
      );

      const courierDoc = await couriers.findOne({ userId: existing._id });
      if (!courierDoc) {
        await couriers.insertOne({
          userId: existing._id,
          courierType: 'internal',
          status: 'OFFLINE',
          lastLocation: { lat: 47.918, lng: 106.917, updatedAt: now },
          zone: String(zone),
          activeOrderId: null,
          batchOrderIds: [],
          vehicleType,
          rating: 5,
          totalDeliveries: 0,
          createdAt: now,
          updatedAt: now,
          createdByAdmin: true,
        });
      }

      return NextResponse.json({
        success: true,
        upgraded: true,
        courier: {
          id: existing._id.toString(),
          name: String(name).trim(),
          phone: existing.phone,
          vehicleType,
          zone,
        },
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const result = await users.insertOne({
      phone: String(phone),
      password: hashedPassword,
      name: String(name).trim(),
      role: 'courier',
      status: 'available',
      createdAt: now,
      updatedAt: now,
    });

    await couriers.insertOne({
      userId: result.insertedId,
      courierType: 'internal',
      status: 'OFFLINE',
      lastLocation: { lat: 47.918, lng: 106.917, updatedAt: now },
      zone: String(zone),
      activeOrderId: null,
      batchOrderIds: [],
      vehicleType,
      rating: 5,
      totalDeliveries: 0,
      createdAt: now,
      updatedAt: now,
      createdByAdmin: true,
    });

    return NextResponse.json({
      success: true,
      created: true,
      courier: {
        id: result.insertedId.toString(),
        name: String(name).trim(),
        phone: String(phone),
        vehicleType,
        zone,
      },
    });
  } catch (error) {
    console.error('[admin/couriers POST]', error);
    return NextResponse.json({ error: 'Failed to create courier' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json();
    const { id, status, zone, vehicleType } = body;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const couriers = await getCollection('couriers');
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (status) $set.status = status;
    if (zone) $set.zone = zone;
    if (vehicleType && VEHICLES.has(vehicleType)) $set.vehicleType = vehicleType;

    await couriers.updateOne({ userId: new ObjectId(id) }, { $set }, { upsert: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/couriers PATCH]', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
