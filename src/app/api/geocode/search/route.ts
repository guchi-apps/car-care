import { getCurrentUser } from "@/lib/auth-user";
import { geocodePlaceName } from "@/lib/gas-stations-search";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ error: "検索キーワードが必要です" }, { status: 400 });
  }

  try {
    const location = await geocodePlaceName(query);

    if (!location) {
      return Response.json({ error: "位置情報が見つかりません" }, { status: 404 });
    }

    return Response.json({ location });
  } catch {
    return Response.json({ error: "位置情報の取得に失敗しました" }, { status: 502 });
  }
}
