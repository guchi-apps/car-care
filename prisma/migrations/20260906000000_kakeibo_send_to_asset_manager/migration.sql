-- 給油記録を Asset Manager へ送った結果（取り込み ID）を持つ（#141）。
-- AlterTable
ALTER TABLE `fuel_logs` ADD COLUMN `asset_manager_receipt_id` VARCHAR(191) NULL;

-- Zaim の OAuth アクセストークンは保持しなくなったため NULL を許す。
-- 列そのものは切り戻しの余地として残す（DROP は別 Issue）。
-- AlterTable
ALTER TABLE `zaim_connections` MODIFY `access_token` TEXT NULL,
    MODIFY `access_token_secret` TEXT NULL;
