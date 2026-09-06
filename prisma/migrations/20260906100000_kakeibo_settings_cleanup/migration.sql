-- OAuth 時代（#26）の残骸を片付ける（#146）。
-- car-care は Zaim へ直接書かなくなった（#141）ため、アクセストークン・カテゴリ・ジャンル・
-- 口座 ID・Zaim ユーザー情報はどこからも読み書きしていない。
-- AlterTable
ALTER TABLE `zaim_connections`
    DROP COLUMN `access_token`,
    DROP COLUMN `access_token_secret`,
    DROP COLUMN `category_id`,
    DROP COLUMN `category_name`,
    DROP COLUMN `genre_id`,
    DROP COLUMN `genre_name`,
    DROP COLUMN `account_id`,
    DROP COLUMN `zaim_user_id`,
    DROP COLUMN `zaim_user_name`;

-- 「Zaim へ登録する」ではなく「家計簿へ送る」が実態なので列名を合わせる。
-- MariaDB 10.5 未満でも通るよう RENAME COLUMN ではなく CHANGE COLUMN を使う。
-- AlterTable
ALTER TABLE `zaim_connections`
    CHANGE COLUMN `auto_register` `auto_send` BOOLEAN NOT NULL DEFAULT true,
    CHANGE COLUMN `last_registered_at` `last_sent_at` DATETIME(3) NULL;

-- テーブル名を実態に合わせる。index と外部キーの名前は Prisma が生成する規則に揃えるため
-- 張り直す（RENAME INDEX は MariaDB 10.5 未満で使えない）。
-- DropForeignKey
ALTER TABLE `zaim_connections` DROP FOREIGN KEY `zaim_connections_user_id_fkey`;

-- DropIndex
DROP INDEX `zaim_connections_user_id_key` ON `zaim_connections`;

-- RenameTable
RENAME TABLE `zaim_connections` TO `kakeibo_settings`;

-- CreateIndex
CREATE UNIQUE INDEX `kakeibo_settings_user_id_key` ON `kakeibo_settings`(`user_id`);

-- AddForeignKey
ALTER TABLE `kakeibo_settings` ADD CONSTRAINT `kakeibo_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 給油記録が家計簿へ送られた日時。`zaim_money_id` は #141 以前に Zaim API で登録した明細の
-- 実 ID なので、名前を変えずに残す。
-- AlterTable
ALTER TABLE `fuel_logs`
    CHANGE COLUMN `zaim_registered_at` `kakeibo_sent_at` DATETIME(3) NULL;
