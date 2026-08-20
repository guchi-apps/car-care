-- CreateTable
CREATE TABLE `zaim_connections` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `zaim_user_id` VARCHAR(191) NULL,
    `zaim_user_name` VARCHAR(191) NULL,
    `access_token` TEXT NOT NULL,
    `access_token_secret` TEXT NOT NULL,
    `auto_register` BOOLEAN NOT NULL DEFAULT true,
    `category_id` VARCHAR(191) NULL,
    `category_name` VARCHAR(191) NULL,
    `genre_id` VARCHAR(191) NULL,
    `genre_name` VARCHAR(191) NULL,
    `account_id` VARCHAR(191) NULL,
    `account_name` VARCHAR(191) NULL,
    `last_registered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `zaim_connections_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `zaim_connections` ADD CONSTRAINT `zaim_connections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `fuel_logs` ADD COLUMN `zaim_money_id` VARCHAR(191) NULL,
    ADD COLUMN `zaim_registered_at` DATETIME(3) NULL;
