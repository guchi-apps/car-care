import { getCurrentUser } from "@/lib/auth-user";
import { formatDistanceMeters } from "@/lib/fuel-display";
import { searchNearbyGasStations, lookupGasStationByOsmId } from "@/lib/gas-stations-search";

export type GasStationResult = {
  id: number;
  name: string;
  brand: string | null;
  address: string | null;
  distanceMeters: number;
  lat: number;
  lon: number;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const osmId = searchParams.get("osmId")?.trim();

  if (osmId) {
    try {
      const station = await lookupGasStationByOsmId(osmId);

      if (!station) {
        return Response.json({ error: "店舗の位置情報が見つかりません" }, { status: 404 });
      }

      return Response.json({
        station: {
          ...station,
          distanceLabel: formatDistanceMeters(station.distanceMeters),
        },
      });
    } catch {
      return Response.json(
        { error: "店舗の位置情報の取得に失敗しました" },
        { status: 502 },
      );
    }
  }

  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius") ?? "1000");
  const limitParam = searchParams.get("limit");
  const limit =
    limitParam == null || limitParam === "0"
      ? undefined
      : Number(limitParam);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "位置情報が不正です" }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "位置情報が不正です" }, { status: 400 });
  }

  const safeRadius = Number.isFinite(radius)
    ? Math.min(Math.max(radius, 500), 10_000)
    : 1000;
  const safeLimit =
    limit != null && Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 100)
      : undefined;

  try {
    const stations = await searchNearbyGasStations(
      lat,
      lon,
      safeRadius,
      safeLimit,
    );

    if (!stations) {
      return Response.json(
        { error: "ガソリンスタンドの検索に失敗しました" },
        { status: 502 },
      );
    }

    return Response.json({
      stations: stations.map((station) => ({
        ...station,
        distanceLabel: formatDistanceMeters(station.distanceMeters),
      })),
    });
  } catch {
    return Response.json(
      { error: "ガソリンスタンドの検索に失敗しました" },
      { status: 502 },
    );
  }
}
