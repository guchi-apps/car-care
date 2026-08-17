import { getCurrentUser } from "@/lib/auth-user";
import { formatDistanceMeters } from "@/lib/fuel-display";
import { lookupGasStationsByOsmIds } from "@/lib/gas-stations-search";
import { prisma } from "@/lib/prisma";
import { listRegisteredGasStationsForUser } from "@/lib/registered-gas-stations";

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "位置情報が不正です" }, { status: 400 });
  }

  const stations = (await listRegisteredGasStationsForUser(user.id)).filter(
    (station) => !station.hiddenFromPicker,
  );
  const osmIds = stations
    .filter(
      (station) =>
        station.osmId &&
        (station.latitude == null || station.longitude == null),
    )
    .map((station) => station.osmId!);
  const coordinates = await lookupGasStationsByOsmIds(osmIds);

  const withDistance = await Promise.all(
    stations.map(async (station) => {
      const base = {
        id: station.id,
        osmId: station.osmId,
        registeredName: station.registeredName,
        brand: station.brand,
        displayOrder: station.displayOrder,
      };

      let pointLat = station.latitude;
      let pointLon = station.longitude;

      if ((pointLat == null || pointLon == null) && station.osmId) {
        const point =
          coordinates.get(station.osmId) ??
          coordinates.get(String(Number(station.osmId)));

        if (point) {
          pointLat = point.lat;
          pointLon = point.lon;
        }
      }

      if (pointLat == null || pointLon == null) {
        return {
          ...base,
          distanceMeters: null,
          distanceLabel: null,
          isNearby: false,
        };
      }

      if (
        station.latitude == null ||
        station.longitude == null
      ) {
        void prisma.registeredGasStation
          .update({
            where: { id: station.id },
            data: { latitude: pointLat, longitude: pointLon },
          })
          .catch(() => {});
      }

      const distanceMeters = haversineDistanceMeters(
        lat,
        lon,
        pointLat,
        pointLon,
      );

      return {
        ...base,
        distanceMeters,
        distanceLabel: formatDistanceMeters(distanceMeters),
        isNearby: distanceMeters <= 100,
      };
    }),
  );

  withDistance.sort((left, right) => {
    if (left.distanceMeters == null && right.distanceMeters == null) {
      return (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
    }

    if (left.distanceMeters == null) {
      return 1;
    }

    if (right.distanceMeters == null) {
      return -1;
    }

    return left.distanceMeters - right.distanceMeters;
  });

  return Response.json({ stations: withDistance });
}
