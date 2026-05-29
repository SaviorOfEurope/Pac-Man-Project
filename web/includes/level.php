<?php
/**
 * Fonctions utilitaires partagées entre save_level.php et submit_level.php.
 * Centralisées ici pour éviter la duplication de logique.
 */

// Calcule le score maximum d'un niveau à partir du contenu de sa carte.
// . = gemme (10 pts), o = potion sacrée (50 pts), c = montre chronos (30 pts)
function computeScoreMax(string $map): int {
    return substr_count($map, '.') * 10
         + substr_count($map, 'o') * 50
         + substr_count($map, 'c') * 30;
}

// Compte le nombre total de collectibles dans une carte (gemmes + potions + montres).
// Utilisé pour valider le nombre de gemmes soumis par le client.
function countCollectibles(string $map): int {
    return substr_count($map, '.')
         + substr_count($map, 'o')
         + substr_count($map, 'c');
}

// Estime la difficulté (1–5) d'un niveau d'après le nombre de mouvements optimaux.
function computeDifficulte(int $moves): int {
    if ($moves >= 40) return 5;
    if ($moves >= 25) return 4;
    if ($moves >= 15) return 3;
    if ($moves >= 8)  return 2;
    return 1;
}
