import { GOOGLE_MAPS_PLACE_URL } from '@/constants/config';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The one canonical share link format — see CLAUDE.md "Location URL Format". */
export function getLocationUrl(lat: number, lng: number): string {
  return `${GOOGLE_MAPS_PLACE_URL}/${lat},${lng}`;
}

/** Great-circle distance in kilometres (haversine). */
export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
