/** Mapbox style URLs for Soyol Delivery maps */

export const MAP_STYLE_LIGHT = 'mapbox://styles/mapbox/streets-v12';

/**
 * Dark app chrome still uses a bright street basemap.
 * Mapbox dark-v11 looks too “game-like” (flat black + thin roads).
 * Streets stays readable: roads, labels, parks — like Google Maps.
 */
export const MAP_STYLE_DARK = 'mapbox://styles/mapbox/streets-v12';

export function getMapboxStyle(_isDark: boolean) {
  return MAP_STYLE_LIGHT;
}

/** Flatter camera in dark UI — less 3D / game feel */
export function getMapPitch(isDark: boolean) {
  return isDark ? 12 : 42;
}

export function getMapBearing(isDark: boolean) {
  return isDark ? -8 : -18;
}
