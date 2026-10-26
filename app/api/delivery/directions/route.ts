import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy Mapbox Directions so the client gets road geometry (not air lines).
 * GET ?fromLng=&fromLat=&toLng=&toLat=
 */
export async function GET(req: NextRequest) {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Mapbox token алга' }, { status: 500 });
    }

    const sp = req.nextUrl.searchParams;
    const fromLng = Number(sp.get('fromLng'));
    const fromLat = Number(sp.get('fromLat'));
    const toLng = Number(sp.get('toLng'));
    const toLat = Number(sp.get('toLat'));

    if (![fromLng, fromLat, toLng, toLat].every((n) => Number.isFinite(n))) {
      return NextResponse.json({ error: 'Буруу координат' }, { status: 400 });
    }

    // Same point → empty
    if (Math.abs(fromLng - toLng) < 1e-6 && Math.abs(fromLat - toLat) < 1e-6) {
      return NextResponse.json({
        coordinates: [[fromLng, fromLat]],
        distanceM: 0,
        durationSec: 0,
      });
    }

    const profile = 'mapbox/driving';
    const url =
      `https://api.mapbox.com/directions/v5/${profile}/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${token}`;

    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[directions]', res.status, text.slice(0, 200));
      return NextResponse.json(
        { error: 'Directions амжилтгүй', status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json({ error: 'Маршрут олдсонгүй' }, { status: 404 });
    }

    return NextResponse.json({
      coordinates,
      distanceM: Math.round(route.distance || 0),
      durationSec: Math.round(route.duration || 0),
    });
  } catch (error) {
    console.error('[directions]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
