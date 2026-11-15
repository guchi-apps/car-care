"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, TileLayer } from "leaflet";

import "leaflet/dist/leaflet.css";

import {
  getGeolocationBlockedMessage,
  getGeolocationErrorMessage,
  getGeolocationFallbackNotice,
  OSAKA_STATION_FALLBACK,
  type GeolocationFailureReason,
} from "@/lib/geolocation";
import {
  buildStationSelectionFromMap,
  matchGasStationBrand,
  type GasStation,
  type KnownGasStation,
} from "@/lib/gas-stations";
import {
  OTHER_GAS_STATION_BRAND_NAME,
  type GasStationBrandRecord,
} from "@/lib/gas-station-brand-types";

type GasStationMapPickerProps = {
  enabled?: boolean;
  selectedStationId: string | null;
  selectedStationKey?: string | null;
  gasStationBrands: GasStationBrandRecord[];
  knownStations?: KnownGasStation[];
  initialFocusOsmId?: string | null;
  initialFocusView?: { lat: number; lon: number } | null;
  initialFocusLabel?: string | null;
  onSelectStation: (station: {
    id: string;
    mapName: string;
    brandSelect: string;
    customBrand: string;
    storeName: string;
    registrationName: string;
    lat?: number;
    lon?: number;
  }) => void;
};

type MapCenter = {
  lat: number;
  lon: number;
  label: string;
  isFallback: boolean;
};

function createPinIcon(color: string, size: number, ringColor?: string) {
  const ringStyle = ringColor
    ? `box-shadow:0 0 0 3px ${ringColor};`
    : "box-shadow:0 2px 6px rgba(15,23,42,0.25);";

  return {
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;border:2px solid white;background:${color};${ringStyle}"></div>`,
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
  };
}

const GAS_STATION_PUMP_SVG =
  '<path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 0 0 2.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1h-8c-.55 0-1-.45-1-1V10c0-.55.45-1 1-1h1V5c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v4h1c.55 0 1 .45 1 1z"/>';

type GasStationIconVariant = "default" | "known" | "selected";

function createGasStationIcon(variant: GasStationIconVariant) {
  const palette: Record<
    GasStationIconVariant,
    { bg: string; ring?: string; size: number; iconSize: number }
  > = {
    default: { bg: "#f59e0b", size: 28, iconSize: 15 },
    known: { bg: "#7c3aed", ring: "#c4b5fd", size: 28, iconSize: 15 },
    selected: { bg: "#10b981", ring: "#6ee7b7", size: 32, iconSize: 17 },
  };
  const { bg, ring, size, iconSize } = palette[variant];
  const shadow = ring
    ? `box-shadow:0 0 0 3px ${ring};`
    : "box-shadow:0 2px 6px rgba(15,23,42,0.25);";

  return {
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:8px;border:2px solid white;background:${bg};${shadow}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white" aria-hidden="true">${GAS_STATION_PUMP_SVG}</svg>
    </div>`,
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
  };
}

function getGasStationIconVariant(
  isSelected: boolean,
  isKnown: boolean,
): GasStationIconVariant {
  if (isSelected) {
    return "selected";
  }

  if (isKnown) {
    return "known";
  }

  return "default";
}

function createPlusIcon(size: number, color: string, stroke: number) {
  const half = size / 2;
  const bar = `position:absolute;background:${color};border-radius:9999px;`;

  return {
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="${bar}top:50%;left:0;right:0;height:${stroke}px;transform:translateY(-50%);"></div>
      <div style="${bar}left:50%;top:0;bottom:0;width:${stroke}px;transform:translateX(-50%);"></div>
    </div>`,
    iconSize: [size, size] as [number, number],
    iconAnchor: [half, half] as [number, number],
  };
}

function createSearchCenterIcon() {
  return createPlusIcon(24, "#94a3b8", 2);
}

type LoadPhase = "pending" | "loading" | "error" | "ready";

function buildKnownStationMap(knownStations: KnownGasStation[]) {
  const byOsmId = new Map<string, KnownGasStation>();
  const byRegisteredName = new Map<string, KnownGasStation>();

  for (const station of knownStations) {
    if (station.osmId) {
      byOsmId.set(station.osmId, station);
    }

    byRegisteredName.set(station.registeredName, station);
  }

  return { byOsmId, byRegisteredName };
}

function findKnownStation(
  maps: ReturnType<typeof buildKnownStationMap>,
  station: GasStation,
) {
  return (
    maps.byOsmId.get(toOsmId(station.id)) ??
    maps.byRegisteredName.get(station.name) ??
    null
  );
}

function toOsmId(id: number): string {
  return String(id);
}

function getStationDisplayInfo(
  station: GasStation,
  knownMaps: ReturnType<typeof buildKnownStationMap>,
  brands: GasStationBrandRecord[],
) {
  const known = findKnownStation(knownMaps, station);
  const rawBrand = known?.brand ?? station.brand;
  const matchedBrand = matchGasStationBrand(rawBrand, brands, [station.name]);
  const selection = buildStationSelectionFromMap(
    station.name,
    matchedBrand,
    rawBrand,
    brands,
    known?.registeredName,
  );

  return {
    ...selection,
    isKnown: Boolean(known),
  };
}

type StationDisplayInfo = ReturnType<typeof getStationDisplayInfo>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getEffectiveBrand(info: StationDisplayInfo): string {
  if (info.brandSelect === OTHER_GAS_STATION_BRAND_NAME) {
    return info.customBrand.trim();
  }

  return info.brandSelect.trim();
}

function buildStationPopupHtml(
  info: StationDisplayInfo,
  station: GasStation,
  isSelected = false,
) {
  const title =
    info.registrationName.trim() ||
    info.storeName.trim() ||
    info.mapName.trim() ||
    "名称不明";

  const statusBadge = info.isKnown
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:600;">★ 登録済み</span>`
    : `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#f1f5f9;color:#64748b;font-size:11px;">未登録</span>`;

  const selectedBadge = isSelected
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#d1fae5;color:#047857;font-size:11px;font-weight:600;">選択中</span>`
    : "";

  const parts = [
    `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:6px;">${statusBadge}${selectedBadge}</div>`,
    `<div style="font-weight:600;font-size:14px;line-height:1.35;">${escapeHtml(title)}</div>`,
  ];

  const brand = getEffectiveBrand(info) || station.brand?.trim();

  if (brand) {
    parts.push(
      `<div style="margin-top:6px;font-size:12px;color:#64748b;">ブランド: ${escapeHtml(brand)}</div>`,
    );
  }

  if (info.mapName.trim() && info.mapName !== title) {
    parts.push(
      `<div style="margin-top:4px;font-size:11px;color:#94a3b8;">地図上の名称: ${escapeHtml(info.mapName)}</div>`,
    );
  }

  if (station.address?.trim()) {
    parts.push(
      `<div style="margin-top:4px;font-size:11px;color:#94a3b8;">${escapeHtml(station.address)}</div>`,
    );
  }

  return `<div style="min-width:150px;max-width:220px;font-family:system-ui,-apple-system,sans-serif;line-height:1.4;color:#0f172a;">${parts.join("")}</div>`;
}

const MAP_SEARCH_RADIUS_METERS = 3_000;
const MAP_SEARCH_RESULT_LIMIT = 10;

async function fetchNearbyStations(lat: number, lon: number): Promise<GasStation[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(MAP_SEARCH_RADIUS_METERS),
    limit: String(MAP_SEARCH_RESULT_LIMIT),
  });
  const response = await fetch(`/api/gas-stations?${params.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "周辺スタンドの取得に失敗しました");
  }

  const data = (await response.json()) as { stations: GasStation[] };
  return data.stations;
}

async function fetchStationByOsmId(osmId: string): Promise<GasStation | null> {
  const response = await fetch(
    `/api/gas-stations?osmId=${encodeURIComponent(osmId)}`,
    { signal: AbortSignal.timeout(15_000) },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { station: GasStation };
  return data.station;
}

export function GasStationMapPicker({
  enabled = true,
  selectedStationId,
  gasStationBrands,
  knownStations = [],
  initialFocusOsmId = null,
  initialFocusView = null,
  initialFocusLabel = null,
  onSelectStation,
}: GasStationMapPickerProps) {
  const knownMaps = useMemo(
    () => buildKnownStationMap(knownStations),
    [knownStations],
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const centerMarkerRef = useRef<LeafletMarker | null>(null);
  const registeredCenterMarkerRef = useRef<LeafletMarker | null>(null);
  const stationMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [stations, setStations] = useState<GasStation[]>([]);
  const [phase, setPhase] = useState<LoadPhase>("pending");
  const [loadingMode, setLoadingMode] = useState<
    "awaiting-geolocation" | "searching-nearby"
  >("searching-nearby");
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<GeolocationFailureReason | null>(
    null,
  );
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const mapCenterRef = useRef(mapCenter);
  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);
  const [mapReady, setMapReady] = useState(false);
  const [isSearchingAtMapCenter, setIsSearchingAtMapCenter] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isRegisteringCenter, setIsRegisteringCenter] = useState(false);
  const [registeredCenterPin, setRegisteredCenterPin] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const activeRequestRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const shouldFitBoundsRef = useRef(true);
  const pendingFocusOsmIdRef = useRef<string | null>(null);
  const pendingFocusViewRef = useRef<{
    lat: number;
    lon: number;
    zoom: number;
  } | null>(null);
  const lastMapViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
    null,
  );

  const applyPendingMapView = useCallback(() => {
    const map = mapRef.current;
    const pendingView = pendingFocusViewRef.current;

    if (!map || !pendingView) {
      return;
    }

    map.setView([pendingView.lat, pendingView.lon], pendingView.zoom, {
      animate: false,
    });
    window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
    });
  }, []);

  const handleExpandMap = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      lastMapViewRef.current = {
        lat: center.lat,
        lng: center.lng,
        zoom: mapRef.current.getZoom(),
      };
    }

    setIsMapExpanded(true);
  }, []);

  const handleCollapseMap = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      lastMapViewRef.current = {
        lat: center.lat,
        lng: center.lng,
        zoom: mapRef.current.getZoom(),
      };
    }

    setIsMapExpanded(false);
  }, []);

  const loadStationsAt = useCallback(
    async (
      center: MapCenter,
      requestToken: number,
      notice: string | null,
      reason: GeolocationFailureReason | null,
      options?: { fitBounds?: boolean; ensureStation?: GasStation | null },
    ) => {
      if (options?.fitBounds != null) {
        shouldFitBoundsRef.current = options.fitBounds;
      }

      setMapCenter(center);
      setFallbackNotice(notice);
      setFailureReason(reason);
      setStations([]);

      try {
        let stationList = await fetchNearbyStations(center.lat, center.lon);

        if (requestToken !== activeRequestRef.current) {
          return;
        }

        if (
          options?.ensureStation &&
          !stationList.some(
            (station) => toOsmId(station.id) === toOsmId(options.ensureStation!.id),
          )
        ) {
          stationList = [options.ensureStation, ...stationList];
        }

        setStations(stationList);
        setPhase("ready");
      } catch (fetchError) {
        if (requestToken !== activeRequestRef.current) {
          return;
        }

        if (options?.ensureStation) {
          setStations([options.ensureStation]);
          setPhase("ready");
          setError(null);
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "周辺スタンドの取得に失敗しました",
        );
        setFailureReason("unknown");
        setPhase("error");
      } finally {
        if (requestToken === activeRequestRef.current) {
          setIsSearchingAtMapCenter(false);
        }
      }
    },
    [],
  );

  const loadNearbyStations = useCallback((options?: { notice?: string | null }) => {
    const requestToken = activeRequestRef.current + 1;
    activeRequestRef.current = requestToken;
    shouldFitBoundsRef.current = true;

    setPhase("loading");
    setLoadingMode("awaiting-geolocation");
    setError(null);
    setFallbackNotice(options?.notice ?? null);
    setFailureReason(null);
    setStations([]);

    const blockedMessage = getGeolocationBlockedMessage();

    if (blockedMessage) {
      const reason: GeolocationFailureReason = blockedMessage.includes("HTTPS")
        ? "insecure-context"
        : "unsupported";

      setLoadingMode("searching-nearby");

      void loadStationsAt(
        {
          lat: OSAKA_STATION_FALLBACK.lat,
          lon: OSAKA_STATION_FALLBACK.lon,
          label: OSAKA_STATION_FALLBACK.label,
          isFallback: true,
        },
        requestToken,
        options?.notice ?? getGeolocationFallbackNotice(reason),
        reason,
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestToken !== activeRequestRef.current) {
          return;
        }

        setLoadingMode("searching-nearby");

        void loadStationsAt(
          {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            label: "現在地",
            isFallback: false,
          },
          requestToken,
          options?.notice ?? null,
          null,
        );
      },
      (positionError) => {
        if (requestToken !== activeRequestRef.current) {
          return;
        }

        const { reason } = getGeolocationErrorMessage(positionError.code);

        setLoadingMode("searching-nearby");

        void loadStationsAt(
          {
            lat: OSAKA_STATION_FALLBACK.lat,
            lon: OSAKA_STATION_FALLBACK.lon,
            label: OSAKA_STATION_FALLBACK.label,
            isFallback: true,
          },
          requestToken,
          options?.notice ?? getGeolocationFallbackNotice(reason),
          reason,
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 300_000,
      },
    );
  }, [loadStationsAt]);

  const loadFocusedStation = useCallback(
    async (osmId: string) => {
      const requestToken = activeRequestRef.current + 1;
      activeRequestRef.current = requestToken;
      shouldFitBoundsRef.current = false;
      pendingFocusOsmIdRef.current = osmId;

      setPhase("loading");
      setLoadingMode("searching-nearby");
      setError(null);
      setFallbackNotice(null);
      setFailureReason(null);
      setStations([]);

      try {
        const focusedStation = await fetchStationByOsmId(osmId);

        if (requestToken !== activeRequestRef.current) {
          return;
        }

        if (!focusedStation) {
          pendingFocusOsmIdRef.current = osmId;
          pendingFocusViewRef.current = null;
          loadNearbyStations({
            notice:
              "登録店舗の地図データを取得できませんでした（現在地から遠いことが原因ではありません）。地図を移動して「この付近を再検索」から店舗を選び直してください。",
          });
          return;
        }

        pendingFocusViewRef.current = {
          lat: focusedStation.lat,
          lon: focusedStation.lon,
          zoom: 16,
        };
        applyPendingMapView();

        await loadStationsAt(
          {
            lat: focusedStation.lat,
            lon: focusedStation.lon,
            label: "登録店舗",
            isFallback: false,
          },
          requestToken,
          null,
          null,
          { fitBounds: false, ensureStation: focusedStation },
        );
      } catch (fetchError) {
        if (requestToken !== activeRequestRef.current) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "登録店舗の位置情報の取得に失敗しました",
        );
        setFailureReason("unknown");
        setPhase("error");
        pendingFocusOsmIdRef.current = null;
      }
    },
    [applyPendingMapView, loadNearbyStations, loadStationsAt],
  );

  const loadFocusedView = useCallback(
    async (view: { lat: number; lon: number }) => {
      const requestToken = activeRequestRef.current + 1;
      activeRequestRef.current = requestToken;
      shouldFitBoundsRef.current = false;

      setPhase("loading");
      setLoadingMode("searching-nearby");
      setError(null);
      setFallbackNotice(null);
      setFailureReason(null);
      setStations([]);

      pendingFocusViewRef.current = {
        lat: view.lat,
        lon: view.lon,
        zoom: 16,
      };
      applyPendingMapView();

      try {
        await loadStationsAt(
          {
            lat: view.lat,
            lon: view.lon,
            label: "登録店舗",
            isFallback: false,
          },
          requestToken,
          null,
          null,
          { fitBounds: false },
        );
      } catch (fetchError) {
        if (requestToken !== activeRequestRef.current) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "登録店舗の位置情報の取得に失敗しました",
        );
        setFailureReason("unknown");
        setPhase("error");
      }
    },
    [applyPendingMapView, loadStationsAt],
  );

  const focusViewLat = initialFocusView?.lat;
  const focusViewLon = initialFocusView?.lon;

  useEffect(() => {
    if (!enabled) {
      hasInitializedRef.current = false;
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (initialFocusOsmId) {
        void loadFocusedStation(initialFocusOsmId);
        return;
      }

      if (focusViewLat != null && focusViewLon != null) {
        void loadFocusedView({ lat: focusViewLat, lon: focusViewLon });
        return;
      }

      if (hasInitializedRef.current) {
        return;
      }

      hasInitializedRef.current = true;
      loadNearbyStations();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    focusViewLat,
    focusViewLon,
    initialFocusLabel,
    initialFocusOsmId,
    loadFocusedStation,
    loadFocusedView,
    loadNearbyStations,
  ]);

  useEffect(() => {
    if (!initialFocusView) {
      return;
    }

    pendingFocusViewRef.current = {
      lat: initialFocusView.lat,
      lon: initialFocusView.lon,
      zoom: 16,
    };
    applyPendingMapView();
  }, [initialFocusView, applyPendingMapView]);

  useEffect(() => {
    if (!isMapExpanded) {
      document.body.removeAttribute("data-map-expanded");
      return;
    }

    document.body.setAttribute("data-map-expanded", "");

    return () => {
      document.body.removeAttribute("data-map-expanded");
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (!isMapExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (!isMapExpanded) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCollapseMap();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCollapseMap, isMapExpanded]);

  useLayoutEffect(() => {
    const container = mapContainerRef.current;

    if (!container) {
      return;
    }

    const centerLat =
      pendingFocusViewRef.current?.lat ??
      mapCenterRef.current?.lat ??
      OSAKA_STATION_FALLBACK.lat;
    const centerLon =
      pendingFocusViewRef.current?.lon ??
      mapCenterRef.current?.lon ??
      OSAKA_STATION_FALLBACK.lon;
    const initialZoom = pendingFocusViewRef.current?.zoom ?? 14;
    const stationMarkers = stationMarkersRef.current;

    let disposed = false;

    centerMarkerRef.current?.remove();
    centerMarkerRef.current = null;
    registeredCenterMarkerRef.current?.remove();
    registeredCenterMarkerRef.current = null;
    stationMarkers.forEach((marker) => marker.remove());
    stationMarkers.clear();
    mapRef.current?.remove();
    mapRef.current = null;
    tileLayerRef.current = null;
    setMapReady(false);

    const initMap = () => {
      if (disposed || !mapContainerRef.current || !leafletRef.current) {
        return;
      }

      const L = leafletRef.current;
      const saved = lastMapViewRef.current;
      const lat = saved?.lat ?? centerLat;
      const lng = saved?.lng ?? centerLon;
      const zoom = saved?.zoom ?? initialZoom;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([lat, lng], zoom);

      const tileLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        },
      ).addTo(map);

      tileLayerRef.current = tileLayer;
      mapRef.current = map;

      map.whenReady(() => {
        if (disposed) {
          return;
        }

        map.invalidateSize({ animate: false, pan: false });
        tileLayer.redraw();
        setMapReady(true);
        applyPendingMapView();
      });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        void import("leaflet").then((leafletModule) => {
          if (disposed || !mapContainerRef.current) {
            return;
          }

          leafletRef.current =
            "default" in leafletModule
              ? (leafletModule as { default: typeof import("leaflet") }).default
              : leafletModule;

          initMap();
        });
      });
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      registeredCenterMarkerRef.current?.remove();
      registeredCenterMarkerRef.current = null;
      stationMarkers.forEach((marker) => marker.remove());
      stationMarkers.clear();
      tileLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [isMapExpanded, applyPendingMapView]);

  useEffect(() => {
    applyPendingMapView();
  }, [applyPendingMapView, mapCenter, stations]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;

    if (!map || !L || !mapCenter || !mapReady) {
      return;
    }

    const centerPoint = {
      lat: mapCenter.lat,
      lon: mapCenter.lon,
    };
    const isSearchCenter =
      mapCenter.label === "検索地点" || mapCenter.label === "指定した地点";
    const showCenterMarker =
      mapCenter.label === "現在地" ||
      mapCenter.isFallback ||
      isSearchCenter;

    if (!showCenterMarker) {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      return;
    }

    const centerLabel = mapCenter.label;

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([centerPoint.lat, centerPoint.lon]);
      centerMarkerRef.current.setPopupContent(centerLabel);
      centerMarkerRef.current.setIcon(
        L.divIcon(
          isSearchCenter
            ? createSearchCenterIcon()
            : createPinIcon(mapCenter.isFallback ? "#64748b" : "#2563eb", 16),
        ),
      );
      centerMarkerRef.current.setZIndexOffset(isSearchCenter ? 1100 : 1000);
    } else {
      centerMarkerRef.current = L.marker([centerPoint.lat, centerPoint.lon], {
        icon: L.divIcon(
          isSearchCenter
            ? createSearchCenterIcon()
            : createPinIcon(mapCenter.isFallback ? "#64748b" : "#2563eb", 16),
        ),
        zIndexOffset: isSearchCenter ? 1100 : 1000,
      })
        .addTo(map)
        .bindPopup(centerLabel);

      if (isSearchCenter) {
        centerMarkerRef.current.openPopup();
      }
    }
  }, [mapCenter, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;

    if (!map || !L || !mapReady) {
      return;
    }

    if (!registeredCenterPin) {
      registeredCenterMarkerRef.current?.remove();
      registeredCenterMarkerRef.current = null;
      return;
    }

    const popupLabel = registeredCenterPin.label || "登録した店舗";

    if (registeredCenterMarkerRef.current) {
      registeredCenterMarkerRef.current.setLatLng([
        registeredCenterPin.lat,
        registeredCenterPin.lon,
      ]);
      registeredCenterMarkerRef.current.setPopupContent(popupLabel);
      registeredCenterMarkerRef.current.setIcon(
        L.divIcon(createGasStationIcon("selected")),
      );
      registeredCenterMarkerRef.current.openPopup();
    } else {
      registeredCenterMarkerRef.current = L.marker(
        [registeredCenterPin.lat, registeredCenterPin.lon],
        {
          icon: L.divIcon(createGasStationIcon("selected")),
          zIndexOffset: 1300,
        },
      )
        .addTo(map)
        .bindPopup(popupLabel)
        .openPopup();
    }
  }, [registeredCenterPin, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;

    if (!map || !L || !mapCenter || !mapReady) {
      return;
    }

    const markers = stationMarkersRef.current;
    markers.forEach((marker) => marker.remove());
    markers.clear();

    for (const station of stations) {
      const info = getStationDisplayInfo(station, knownMaps, gasStationBrands);
      const isSelected = toOsmId(station.id) === selectedStationId;
      const marker = L.marker([station.lat, station.lon], {
        icon: L.divIcon(
          createGasStationIcon(getGasStationIconVariant(isSelected, info.isKnown)),
        ),
      })
        .addTo(map)
        .bindPopup(buildStationPopupHtml(info, station, isSelected), { maxWidth: 240 });

      marker.on("click", () => {
        const selected = getStationDisplayInfo(station, knownMaps, gasStationBrands);
        marker.setPopupContent(buildStationPopupHtml(selected, station, true));
        marker.openPopup();
        setRegisteredCenterPin(null);
        onSelectStation({
          id: toOsmId(station.id),
          mapName: selected.mapName,
          brandSelect: selected.brandSelect,
          customBrand: selected.customBrand,
          storeName: selected.storeName,
          registrationName: selected.registrationName,
          lat: station.lat,
          lon: station.lon,
        });
      });

      stationMarkersRef.current.set(toOsmId(station.id), marker);
    }

    if (stations.length > 0 && shouldFitBoundsRef.current) {
      const bounds = L.latLngBounds([
        [mapCenter.lat, mapCenter.lon],
        ...stations.map((station) => [station.lat, station.lon] as [number, number]),
      ]);
      map.fitBounds(bounds.pad(0.15));
      shouldFitBoundsRef.current = false;
    }

    const focusOsmId =
      pendingFocusOsmIdRef.current ?? selectedStationId ?? initialFocusOsmId;

    if (focusOsmId) {
      const focusedStation = stations.find(
        (station) => toOsmId(station.id) === focusOsmId,
      );

      if (focusedStation) {
        map.setView([focusedStation.lat, focusedStation.lon], 16, { animate: false });
        const marker = stationMarkersRef.current.get(focusOsmId);
        marker?.openPopup();
        pendingFocusOsmIdRef.current = null;
        pendingFocusViewRef.current = null;
      } else if (pendingFocusViewRef.current) {
        map.setView(
          [pendingFocusViewRef.current.lat, pendingFocusViewRef.current.lon],
          pendingFocusViewRef.current.zoom,
          { animate: false },
        );
      }
    }
  }, [
    stations,
    selectedStationId,
    onSelectStation,
    mapCenter,
    knownMaps,
    gasStationBrands,
    mapReady,
    initialFocusOsmId,
  ]);

  useEffect(() => {
    const L = leafletRef.current;

    if (!L || !mapReady) {
      return;
    }

    for (const station of stations) {
      const marker = stationMarkersRef.current.get(toOsmId(station.id));

      if (!marker) {
        continue;
      }

      const isSelected = toOsmId(station.id) === selectedStationId;
      const info = getStationDisplayInfo(station, knownMaps, gasStationBrands);

      marker.setIcon(
        L.divIcon(
          createGasStationIcon(
            getGasStationIconVariant(isSelected, info.isKnown),
          ),
        ),
      );
      marker.setPopupContent(buildStationPopupHtml(info, station, isSelected));
    }
  }, [selectedStationId, stations, knownMaps, gasStationBrands, mapReady]);

  function handleSelectFromList(station: GasStation) {
    const info = getStationDisplayInfo(station, knownMaps, gasStationBrands);
    setRegisteredCenterPin(null);
    onSelectStation({
      id: toOsmId(station.id),
      mapName: info.mapName,
      brandSelect: info.brandSelect,
      customBrand: info.customBrand,
      storeName: info.storeName,
      registrationName: info.registrationName,
      lat: station.lat,
      lon: station.lon,
    });

    mapRef.current?.setView([station.lat, station.lon], 15, { animate: true });
  }

  function getMapCenterCoordinates() {
    const map = mapRef.current;

    if (map) {
      const center = map.getCenter();
      return { lat: center.lat, lon: center.lng };
    }

    if (mapCenter) {
      return { lat: mapCenter.lat, lon: mapCenter.lon };
    }

    return null;
  }

  function handleSearchAtMapCenter() {
    const coordinates = getMapCenterCoordinates();

    if (!coordinates) {
      return;
    }

    const requestToken = activeRequestRef.current + 1;
    activeRequestRef.current = requestToken;

    setIsSearchingAtMapCenter(true);
    setPhase("loading");
    setLoadingMode("searching-nearby");
    setError(null);

    void loadStationsAt(
      {
        lat: coordinates.lat,
        lon: coordinates.lon,
        label: "検索地点",
        isFallback: false,
      },
      requestToken,
      null,
      null,
      { fitBounds: true },
    );
  }

  async function handleRegisterMapCenter() {
    const coordinates = getMapCenterCoordinates();

    if (!coordinates) {
      return;
    }

    setIsRegisteringCenter(true);

    try {
      const response = await fetch(
        `/api/geocode/reverse?lat=${coordinates.lat}&lon=${coordinates.lon}`,
      );
      const data = (await response.json().catch(() => null)) as {
        label?: string;
      } | null;
      const mapName = data?.label?.trim() || "地図で指定した位置";
      const matchedBrand = matchGasStationBrand(null, gasStationBrands, [mapName]);
      const selection = buildStationSelectionFromMap(
        mapName,
        matchedBrand,
        null,
        gasStationBrands,
      );

      onSelectStation({
        id: "",
        mapName: selection.mapName,
        brandSelect: selection.brandSelect,
        customBrand: selection.customBrand,
        storeName: selection.storeName,
        registrationName: selection.registrationName,
        lat: coordinates.lat,
        lon: coordinates.lon,
      });

      setRegisteredCenterPin({
        lat: coordinates.lat,
        lon: coordinates.lon,
        label: selection.registrationName || mapName,
      });
    } finally {
      setIsRegisteringCenter(false);
    }
  }

  function handleRetry() {
    loadNearbyStations();
  }

  const canRetryGeolocation =
    failureReason === "permission-denied" || failureReason === "timeout";

  const mapControlButtonClass =
    "pointer-events-auto rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="relative z-0 space-y-3">
      <div
        className={
          isMapExpanded
            ? "fixed inset-0 z-[500] flex h-[100dvh] flex-col bg-slate-100 dark:bg-slate-900"
            : "relative isolate z-0"
        }
      >
        {isMapExpanded && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              ガソリンスタンド地図
            </p>
            <button
              type="button"
              onClick={handleCollapseMap}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              閉じる
            </button>
          </div>
        )}

        <div
          className={
            isMapExpanded
              ? "relative isolate z-0 h-[calc(100dvh-53px)] w-full shrink-0"
              : "relative isolate z-0 h-96 w-full"
          }
        >
          <div
            ref={mapContainerRef}
            className={
              isMapExpanded
                ? "h-full w-full bg-slate-100 dark:bg-slate-800 [&_.leaflet-container]:!h-full [&_.leaflet-container]:!w-full [&_.leaflet-container]:!z-0 [&_.leaflet-control]:!z-[1]"
                : "h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 [&_.leaflet-container]:!h-full [&_.leaflet-container]:!w-full [&_.leaflet-container]:!z-0 [&_.leaflet-control]:!z-[1]"
            }
            aria-label="周辺のガソリンスタンド地図"
          />

          <div
            className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center text-2xl font-light leading-none text-slate-400/45 dark:text-slate-500/50"
            aria-hidden="true"
          >
            +
          </div>

          <div className="pointer-events-none absolute inset-0 z-[1000]">
            {mapReady && (
              <button
                type="button"
                onClick={handleSearchAtMapCenter}
                disabled={phase === "loading"}
                className={`${mapControlButtonClass} absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 text-sm font-medium`}
              >
                {phase === "loading" && isSearchingAtMapCenter
                  ? "検索中..."
                  : "この位置で再検索"}
              </button>
            )}

            {mapReady && !isMapExpanded && (
              <button
                type="button"
                onClick={handleExpandMap}
                className={`${mapControlButtonClass} absolute right-3 bottom-3 p-2.5`}
                aria-label="地図を全画面表示"
                title="全画面表示"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {isMapExpanded && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => void handleRegisterMapCenter()}
              disabled={isRegisteringCenter}
              className="app-btn-secondary w-full text-sm"
            >
              {isRegisteringCenter
                ? "位置を確認中..."
                : "地図の中心を店舗として登録"}
            </button>
          </div>
        )}
      </div>

      {mapReady && !isMapExpanded && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          地図中央の + が検索・登録の中心です。マークのない場所も「地図の中心を店舗として登録」で選べます。
        </p>
      )}

      {mapReady && !isMapExpanded && (
        <button
          type="button"
          onClick={() => void handleRegisterMapCenter()}
          disabled={isRegisteringCenter}
          className="app-btn-secondary w-full text-sm"
        >
          {isRegisteringCenter
            ? "位置を確認中..."
            : "地図の中心を店舗として登録"}
        </button>
      )}

      {phase !== "error" && phase !== "ready" && (
        <p className="text-sm text-slate-500">
          {loadingMode === "awaiting-geolocation"
            ? "現在地を取得中..."
            : "地図中心の周辺スタンドを読み込み中..."}
        </p>
      )}

      {fallbackNotice && phase !== "error" && (
        <div className="space-y-2">
          <p className="text-sm text-amber-800 dark:text-amber-200">{fallbackNotice}</p>
          {canRetryGeolocation && (
            <button
              type="button"
              onClick={handleRetry}
              className="app-btn-secondary text-sm"
            >
              現在地を再取得
            </button>
          )}
        </div>
      )}

      {phase === "error" && error && (
        <div className="space-y-3">
          <p className="app-alert-error">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="app-btn-secondary text-sm"
          >
            再読み込み
          </button>
        </div>
      )}

      {phase === "ready" && stations.length === 0 && (
        <p className="text-sm text-slate-500">
          半径3km以内にガソリンスタンドが見つかりませんでした。「地図の中心を店舗として登録」するか、ブランドと店舗名を直接入力してください。
        </p>
      )}

      {stations.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
            {stations.map((station) => {
              const isSelected = toOsmId(station.id) === selectedStationId;
              const { registrationName, mapName, isKnown } = getStationDisplayInfo(
                station,
                knownMaps,
                gasStationBrands,
              );

              return (
                <li key={station.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectFromList(station)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                        : isKnown
                          ? "border-violet-200 bg-violet-50/60 hover:border-violet-300 dark:border-violet-800 dark:bg-violet-950/20 dark:hover:border-violet-700"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isKnown && (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
                              ★ 登録済み
                            </span>
                          )}
                          <p className="break-words font-medium leading-snug text-slate-900 dark:text-slate-100">
                            {registrationName}
                          </p>
                        </div>
                        {isKnown && mapName !== registrationName && (
                          <p className="mt-1 break-words text-xs text-slate-500">
                            地図上の名称: {mapName}
                          </p>
                        )}
                        {station.brand && (
                          <p className="mt-1 break-words text-xs text-slate-500">
                            {station.brand}
                          </p>
                        )}
                        {station.address && !registrationName.includes(station.address) && (
                          <p className="mt-1 break-words text-xs text-slate-500">
                            {station.address}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {station.distanceLabel}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
