import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getAuthCookieOptions, AUTH_JWT_EXPIRY } from '@/lib/authCookie';
import { ObjectId } from 'mongodb';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env variable is not set');
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const VEHICLES = new Set(['motorbike', 'car', 'foot']);

async function issueCourierSession(user: {
  _id: ObjectId;
  phone: string;
  role: string;
  status?: string;
  name?: string;
  image?: string;
}) {
  const token = await new SignJWT({
    sub: user._id.toString(),
    phone: user.phone,
    role: 'courier',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(AUTH_JWT_EXPIRY)
    .sign(JWT_SECRET);

  const response = NextResponse.json({
    success: true,
    upgraded: true,
    token,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      role: 'courier',
      status: user.status || 'available',
      name: user.name,
      image: user.image,
    },
  });
  response.cookies.set('auth_token', token, getAuthCookieOptions());
  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, password, name, vehicleType = 'motorbike', zone = 'Улаанбаатар' } = body;

    if (!phone || !password) {
      return NextResponse.json({ error: 'Утас, нууц үг заавал' }, { status: 400 });
    }
    if (String(phone).length < 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу' }, { status: 400 });
    }
    if (!VEHICLES.has(vehicleType)) {
      return NextResponse.json({ error: 'Тээврийн төрөл буруу' }, { status: 400 });
    }

    const users = await getCollection('users');
    const couriers = await getCollection('couriers');
    const existing = await users.findOne({ phone: String(phone) });
    const now = new Date();

    // Existing Soyol Shop user → upgrade to courier (same phone/password)
    if (existing) {
      if (existing.role === 'courier') {
        return NextResponse.json(
          { error: 'Та аль хэдийн хүргэгчээр бүртгэлтэй. Нэвтэрнэ үү.' },
          { status: 409 }
        );
      }
      if (existing.role === 'admin') {
        return NextResponse.json(
          { error: 'Админ эрхтэй хэрэглэгч. Админ панел ашиглана уу.' },
          { status: 403 }
        );
      }
      if (!existing.password) {
        return NextResponse.json(
          { error: 'Энэ бүртгэлд нууц үг байхгүй. OTP-оор нэвтэрээд дараа бүртгүүлнэ үү.' },
          { status: 400 }
        );
      }

      const ok = await bcrypt.compare(password, existing.password);
      if (!ok) {
        return NextResponse.json(
          { error: 'Soyol Shop нууц үг буруу байна' },
          { status: 401 }
        );
      }

      const displayName = String(name || existing.name || '').trim();
      if (!displayName) {
        return NextResponse.json({ error: 'Нэр оруулна уу' }, { status: 400 });
      }

      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            role: 'courier',
            name: displayName,
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
        });
      }

      return issueCourierSession({
        _id: existing._id,
        phone: existing.phone,
        role: 'courier',
        status: existing.status,
        name: displayName,
        image: existing.image,
      });
    }

    // Brand-new courier (no shop account yet)
    if (!name) {
      return NextResponse.json({ error: 'Нэр оруулна уу' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      phone: String(phone),
      password: hashedPassword,
      name: String(name).trim(),
      role: 'courier' as const,
      status: 'available' as const,
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(newUser);
    const userId = result.insertedId;

    await couriers.insertOne({
      userId,
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
    });

    return issueCourierSession({
      _id: userId,
      phone: newUser.phone,
      role: 'courier',
      status: newUser.status,
      name: newUser.name,
    });
  } catch (error) {
    console.error('[register-courier]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
