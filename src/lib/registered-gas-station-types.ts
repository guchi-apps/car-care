import {
  OTHER_GAS_STATION_BRAND_NAME,
  type GasStationBrandRecord,
} from "@/lib/gas-station-brand-types";
import { extractStoreNamePart } from "@/lib/gas-stations";

export type RegisteredGasStationRecord = {
  id: string;
  osmId: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeFailedAt: Date | null;
  registeredName: string;
  brand: string | null;
  hiddenFromPicker: boolean;
  displayOrder: number;
};

function parseBrandAndStoreName(
  registeredName: string,
  brand: string | null,
  brands: GasStationBrandRecord[],
) {
  const effectiveBrand = brand?.trim() ?? "";
  const storeName = effectiveBrand
    ? extractStoreNamePart(registeredName, effectiveBrand, brands)
    : registeredName;

  return { effectiveBrand, storeName };
}

export function getRegisteredStationEditDefaults(
  station: RegisteredGasStationRecord,
  brands: GasStationBrandRecord[],
) {
  const { effectiveBrand, storeName } = parseBrandAndStoreName(
    station.registeredName,
    station.brand,
    brands,
  );

  const isPreset = brands.some((brand) => brand.name === effectiveBrand);
  const brandSelect = isPreset ? effectiveBrand : OTHER_GAS_STATION_BRAND_NAME;
  const customBrand =
    brandSelect === OTHER_GAS_STATION_BRAND_NAME ? effectiveBrand : "";

  return {
    brandSelect,
    customBrand,
    storeName,
  };
}
