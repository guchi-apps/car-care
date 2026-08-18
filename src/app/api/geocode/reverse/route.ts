import { getCurrentUser } from "@/lib/auth-user";
import { reverseGeocodeLabel } from "@/lib/gas-stations-search";

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

  const label = await reverseGeocodeLabel(lat, lon);

  return Response.json({
    label: label ?? "地図で指定した位置",
  });
}
