type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  extratags?: Record<string, string>;
  address?: Record<string, string>;
};

export type GasStationSearchResult = {
  id: number;
  name: string;
  brand: string | null;
  address: string | null;
  distanceMeters: number;
  lat: number;
  lon: number;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const OVERPASS_USER_AGENT = "CarCareApp/1.0 (car-care)";

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

function getBoundingViewbox(lat: number, lon: number, radiusMeters: number): string {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));

  const minLon = lon - lonDelta;
  const maxLon = lon + lonDelta;
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;

  return `${minLon},${maxLat},${maxLon},${minLat}`;
}

function getStationNameFromTags(tags: Record<string, string> | undefined): string {
  if (!tags) {
    return "名称不明のスタンド";
  }

  return (
    tags.name ??
    tags["name:ja"] ??
    tags.brand ??
    tags.operator ??
    "名称不明のスタンド"
  );
}

function getOverpassCoordinates(
  element: OverpassElement,
): { lat: number; lon: number } | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lon: element.lon };
  }

  if (element.center) {
    return element.center;
  }

  return null;
}

function getAddressFromTags(tags: Record<string, string> | undefined): string | null {
  if (!tags) {
    return null;
  }

  const fullAddress = tags["addr:full"];
  if (fullAddress) {
    return fullAddress;
  }

  const joinedAddress = [
    tags["addr:province"],
    tags["addr:city"],
    tags["addr:street"],
  ]
    .filter(Boolean)
    .join("");

  return joinedAddress || null;
}

function getAddressFromNominatim(result: NominatimResult): string | null {
  if (!result.address) {
    return null;
  }

  const joinedAddress = [
    result.address.state,
    result.address.city ?? result.address.town ?? result.address.village,
    result.address.road,
    result.address.house_number,
  ]
    .filter(Boolean)
    .join("");

  return joinedAddress || null;
}

function getNominatimStationName(result: NominatimResult): string {
  const parts = result.display_name
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  while (parts.length > 1) {
    const lastPart = parts[parts.length - 1];

    if (lastPart === "日本" || lastPart === "Japan" || /^\d{3}-?\d{4}$/.test(lastPart)) {
      parts.pop();
      continue;
    }

    break;
  }

  if (parts.length >= 2) {
    return parts.slice(0, Math.min(parts.length - 1, 3)).join(" ");
  }

  return result.name ?? parts[0] ?? "名称不明のスタンド";
}

function buildStationDisplayName(
  name: string,
  brand: string | null,
  address: string | null,
): string {
  if (!address || name.includes(address)) {
    return name;
  }

  const isGenericName =
    name === "名称不明のスタンド" ||
    (brand != null && (name === brand || name.includes(brand)));

  if (isGenericName || name.length <= 8) {
    return `${name}（${address}）`;
  }

  return name;
}

function deduplicateStationsByLocation(
  stations: GasStationSearchResult[],
): GasStationSearchResult[] {
  const seenLocations = new Set<string>();
  const deduped: GasStationSearchResult[] = [];

  for (const station of stations) {
    const locationKey = `${station.lat.toFixed(5)},${station.lon.toFixed(5)}`;

    if (seenLocations.has(locationKey)) {
      continue;
    }

    seenLocations.add(locationKey);
    deduped.push(station);
  }

  return deduped;
}

function sortStationsWithinRadius(
  stations: GasStationSearchResult[],
  radius: number,
  limit?: number,
): GasStationSearchResult[] {
  const sorted = [...stations]
    .filter((station) => station.distanceMeters <= radius)
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  const deduped = deduplicateStationsByLocation(sorted);

  if (limit == null || limit <= 0) {
    return deduped;
  }

  return deduped.slice(0, limit);
}

async function fetchOverpassEndpoint(
  endpoint: string,
  body: string,
): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": OVERPASS_USER_AGENT,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status}`);
  }

  return (await response.json()) as OverpassResponse;
}

async function fetchOverpassData(query: string): Promise<OverpassResponse | null> {
  const body = `data=${encodeURIComponent(query.trim())}`;

  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map((endpoint) => fetchOverpassEndpoint(endpoint, body)),
    );
  } catch {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        return await fetchOverpassEndpoint(endpoint, body);
      } catch {
        continue;
      }
    }
  }

  return null;
}

function mapOverpassElements(
  elements: OverpassElement[],
  originLat: number,
  originLon: number,
): GasStationSearchResult[] {
  const stations: GasStationSearchResult[] = [];

  for (const element of elements) {
    const coordinates = getOverpassCoordinates(element);

    if (!coordinates) {
      continue;
    }

    stations.push({
      id: element.id,
      name: buildStationDisplayName(
        getStationNameFromTags(element.tags),
        element.tags?.brand ?? element.tags?.operator ?? null,
        getAddressFromTags(element.tags),
      ),
      brand: element.tags?.brand ?? element.tags?.operator ?? null,
      address: getAddressFromTags(element.tags),
      distanceMeters: haversineDistanceMeters(
        originLat,
        originLon,
        coordinates.lat,
        coordinates.lon,
      ),
      lat: coordinates.lat,
      lon: coordinates.lon,
    });
  }

  return stations;
}

function buildOverpassFuelQuery(lat: number, lon: number, radius: number): string {
  const around = `(around:${radius},${lat},${lon})`;
  const fuelTags = [
    `node["amenity"="fuel"]${around}`,
    `way["amenity"="fuel"]${around}`,
    `relation["amenity"="fuel"]${around}`,
    `node["shop"="fuel"]${around}`,
    `way["shop"="fuel"]${around}`,
  ];

  return `[out:json][timeout:12];(${fuelTags.join(";")};);out center;`;
}

async function searchWithOverpass(
  lat: number,
  lon: number,
  radius: number,
): Promise<GasStationSearchResult[] | null> {
  const data = await fetchOverpassData(buildOverpassFuelQuery(lat, lon, radius));

  if (!data) {
    return null;
  }

  return mapOverpassElements(data.elements, lat, lon);
}

async function searchWithNominatim(
  lat: number,
  lon: number,
  radius: number,
): Promise<GasStationSearchResult[] | null> {
  const viewbox = getBoundingViewbox(lat, lon, radius);
  const params = new URLSearchParams({
    format: "json",
    amenity: "fuel",
    limit: "100",
    viewbox,
    bounded: "1",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": OVERPASS_USER_AGENT,
          "Accept-Language": "ja",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const results = (await response.json()) as NominatimResult[];
    const seenIds = new Set<number>();
    const stations: GasStationSearchResult[] = [];

    for (const result of results) {
      if (seenIds.has(result.osm_id)) {
        continue;
      }

      seenIds.add(result.osm_id);

      const stationLat = Number.parseFloat(result.lat);
      const stationLon = Number.parseFloat(result.lon);

      if (!Number.isFinite(stationLat) || !Number.isFinite(stationLon)) {
        continue;
      }

      const distanceMeters = haversineDistanceMeters(
          lat,
          lon,
          stationLat,
          stationLon,
        );

      if (distanceMeters > radius) {
        continue;
      }

      stations.push({
        id: result.osm_id,
        name: buildStationDisplayName(
          getNominatimStationName(result),
          result.extratags?.brand ?? result.extratags?.operator ?? null,
          getAddressFromNominatim(result),
        ),
        brand:
          result.extratags?.brand ??
          result.extratags?.operator ??
          null,
        address: getAddressFromNominatim(result),
        distanceMeters,
        lat: stationLat,
        lon: stationLon,
      });
    }

    return stations;
  } catch {
    return null;
  }
}

export async function searchNearbyGasStations(
  lat: number,
  lon: number,
  radius: number,
  limit?: number,
): Promise<GasStationSearchResult[] | null> {
  const overpassStations = await searchWithOverpass(lat, lon, radius);

  if (overpassStations !== null) {
    const withinRadius = sortStationsWithinRadius(overpassStations, radius, limit);

    if (withinRadius.length > 0) {
      return withinRadius;
    }
  }

  const nominatimStations = await searchWithNominatim(lat, lon, radius);

  if (!nominatimStations) {
    return overpassStations !== null
      ? sortStationsWithinRadius(overpassStations, radius, limit)
      : null;
  }

  return sortStationsWithinRadius(nominatimStations, radius, limit);
}

async function lookupGasStationFromNominatim(
  osmId: string,
): Promise<GasStationSearchResult | null> {
  for (const prefix of ["N", "W", "R"] as const) {
    const params = new URLSearchParams({
      format: "json",
      osm_ids: `${prefix}${osmId}`,
      addressdetails: "1",
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/lookup?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": OVERPASS_USER_AGENT,
            "Accept-Language": "ja",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) {
        continue;
      }

      const results = (await response.json()) as NominatimResult[];

      if (!results.length) {
        continue;
      }

      const result = results[0];
      const lat = Number.parseFloat(result.lat);
      const lon = Number.parseFloat(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }

      return {
        id: Number(osmId),
        name: getNominatimStationName(result),
        brand: result.extratags?.brand ?? result.extratags?.operator ?? null,
        address: getAddressFromNominatim(result),
        distanceMeters: 0,
        lat,
        lon,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function mapOverpassElementToStation(
  element: OverpassElement,
  osmId: string,
): GasStationSearchResult | null {
  const coordinates = getOverpassCoordinates(element);

  if (!coordinates) {
    return null;
  }

  return {
    id: Number(osmId),
    name: getStationNameFromTags(element.tags),
    brand: element.tags?.brand ?? element.tags?.operator ?? null,
    address: getAddressFromTags(element.tags),
    distanceMeters: 0,
    lat: coordinates.lat,
    lon: coordinates.lon,
  };
}

export async function lookupGasStationByOsmId(
  osmId: string,
): Promise<GasStationSearchResult | null> {
  const numericId = Number(osmId);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  const nominatimStation = await lookupGasStationFromNominatim(osmId);

  if (nominatimStation) {
    return nominatimStation;
  }

  const combinedQuery = `
    [out:json][timeout:10];
    (
      node(${numericId});
      way(${numericId});
      relation(${numericId});
    );
    out center;
  `;
  const combinedData = await fetchOverpassData(combinedQuery);

  if (combinedData?.elements.length) {
    for (const element of combinedData.elements) {
      const station = mapOverpassElementToStation(element, osmId);

      if (station) {
        return station;
      }
    }
  }

  const coordinates = await lookupGasStationsByOsmIds([osmId]);
  const point = coordinates.get(osmId) ?? coordinates.get(String(numericId));

  if (point) {
    return {
      id: numericId,
      name: "登録店舗",
      brand: null,
      address: null,
      distanceMeters: 0,
      lat: point.lat,
      lon: point.lon,
    };
  }

  return null;
}

export async function geocodePlaceName(
  query: string,
): Promise<{ lat: number; lon: number } | null> {
  const trimmed = query.trim();

  if (!trimmed) {
    return null;
  }

  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    limit: "1",
    countrycodes: "jp",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": OVERPASS_USER_AGENT,
          "Accept-Language": "ja",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const results = (await response.json()) as NominatimResult[];
    const first = results[0];

    if (!first) {
      return null;
    }

    const lat = Number.parseFloat(first.lat);
    const lon = Number.parseFloat(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return { lat, lon };
  } catch {
    return null;
  }
}

export async function reverseGeocodeLabel(
  lat: number,
  lon: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    format: "json",
    lat: String(lat),
    lon: String(lon),
    zoom: "18",
    addressdetails: "1",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": OVERPASS_USER_AGENT,
          "Accept-Language": "ja",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };

    const address = result.address;
    const shortLabel = [
      address?.road,
      address?.house_number,
      address?.neighbourhood ?? address?.suburb,
    ]
      .filter(Boolean)
      .join("");

    if (shortLabel) {
      return shortLabel;
    }

    const displayName = result.display_name?.split(",")[0]?.trim();
    return displayName || null;
  } catch {
    return null;
  }
}

function hasCoordinateForOsmId(
  coordinates: Map<string, { lat: number; lon: number }>,
  osmId: string,
): boolean {
  return (
    coordinates.has(osmId) ||
    coordinates.has(String(Number(osmId)))
  );
}

export async function lookupGasStationsByOsmIds(
  osmIds: string[],
): Promise<Map<string, { lat: number; lon: number }>> {
  const uniqueOsmIds = [
    ...new Set(
      osmIds.filter((id) => {
        const numericId = Number(id);
        return Number.isFinite(numericId) && numericId > 0;
      }),
    ),
  ];

  if (uniqueOsmIds.length === 0) {
    return new Map();
  }

  const numericIds = uniqueOsmIds.map((id) => Number(id));
  const idList = numericIds.join(",");
  const query = `
    [out:json][timeout:10];
  (
    node(id:${idList});
    way(id:${idList});
    relation(id:${idList});
  );
  out center;
  `;
  const data = await fetchOverpassData(query);
  const coordinates = new Map<string, { lat: number; lon: number }>();

  if (data) {
    for (const element of data.elements) {
      const point = getOverpassCoordinates(element);

      if (point) {
        coordinates.set(String(element.id), point);
      }
    }
  }

  for (const osmId of uniqueOsmIds) {
    if (hasCoordinateForOsmId(coordinates, osmId)) {
      continue;
    }

    const station = await lookupGasStationFromNominatim(osmId);

    if (station) {
      coordinates.set(osmId, { lat: station.lat, lon: station.lon });
    }
  }

  return coordinates;
}
