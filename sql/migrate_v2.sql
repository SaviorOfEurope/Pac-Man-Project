-- =========================================================
-- Migration v2 — apply to existing databases
-- Run this if you already have the schema from v1 set up.
--
-- Compatible MySQL 5.6+ / MariaDB (uses stored procedures
-- instead of "ADD COLUMN IF NOT EXISTS" which needs MySQL 8+)
-- =========================================================

USE `basegrp5_4doigtsdelamain`;

-- ── Helper procedure: add columns only when missing ───────────────────────────
DROP PROCEDURE IF EXISTS _migrate_v2;
DELIMITER //
CREATE PROCEDURE _migrate_v2()
BEGIN
    -- in_game.temps_best
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'in_game'
          AND COLUMN_NAME  = 'temps_best'
    ) THEN
        ALTER TABLE `in_game`
            ADD COLUMN `temps_best` INT(11) NULL DEFAULT NULL
            COMMENT 'Best completion time in seconds (NULL if not completed yet)';
    END IF;

    -- in_game: index idx_joueur
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'in_game'
          AND INDEX_NAME   = 'idx_joueur'
    ) THEN
        ALTER TABLE `in_game` ADD KEY `idx_joueur` (`id_joueur`);
    END IF;

    -- niveau.solution_cache
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'solution_cache'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `solution_cache` TEXT NULL
            COMMENT 'Pre-computed optimal solution (string of U/D/L/R)';
    END IF;

    -- niveau.solution_safe
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'solution_safe'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `solution_safe` TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '1 if solution avoids all ghosts; 0 = gems-only path';
    END IF;

    -- niveau.auteur_id
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'auteur_id'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `auteur_id` INT(11) NULL DEFAULT NULL
            COMMENT 'User id who submitted this level (NULL = built-in campaign level)';
    END IF;

    -- niveau.created_at
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND COLUMN_NAME  = 'created_at'
    ) THEN
        ALTER TABLE `niveau`
            ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- niveau: index idx_auteur
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'niveau'
          AND INDEX_NAME   = 'idx_auteur'
    ) THEN
        ALTER TABLE `niveau` ADD KEY `idx_auteur` (`auteur_id`);
    END IF;
END //
DELIMITER ;

CALL _migrate_v2();
DROP PROCEDURE IF EXISTS _migrate_v2;
