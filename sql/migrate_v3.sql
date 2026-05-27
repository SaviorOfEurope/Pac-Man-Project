-- =========================================================
-- Migration v3 — Personal Levels (save_level, is_public)
-- Adds `name` and `is_public` columns to `niveau`.
-- Compatible MySQL 5.6+ / MariaDB.
--
-- Run in phpMyAdmin or:
--   mysql -u root -p basegrp5_4doigtsdelamain < sql/migrate_v3.sql
-- =========================================================

USE `basegrp5_4doigtsdelamain`;

DROP PROCEDURE IF EXISTS _migrate_v3;
DELIMITER //
CREATE PROCEDURE _migrate_v3()
BEGIN
    -- niveau.name : user-given display name for personal levels
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'name'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `name` VARCHAR(100) NULL DEFAULT NULL
            COMMENT 'User-given name for personal levels (NULL = campaign/community level)';
    END IF;

    -- niveau.is_public : 0 = personal draft, 1 = published to community campaign
    -- DEFAULT 1 so all existing rows (built-in campaign + already-submitted community
    -- levels) remain publicly visible. New personal saves via save_level.php explicitly
    -- set 0.
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'is_public'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `is_public` TINYINT(1) NOT NULL DEFAULT 1
            COMMENT '0 = personal draft, 1 = published to community campaign';
    END IF;
END //
DELIMITER ;

CALL _migrate_v3();
DROP PROCEDURE IF EXISTS _migrate_v3;
