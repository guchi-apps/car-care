-- 登録店舗の座標を OSM ID から引くとき、同じ番号の別種別の要素（海外の node など）を拾って
-- 保存していた（#223）。osmId がある行の座標は手入力ではなく必ず自動取得なので、一度消して
-- 給油所タグで絞った引き当てで取り直させる。
UPDATE `registered_gas_stations`
SET `latitude` = NULL, `longitude` = NULL, `geocode_failed_at` = NULL
WHERE `osm_id` IS NOT NULL;
