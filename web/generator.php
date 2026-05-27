<?php
require_once __DIR__ . '/includes/auth.php';
requireLogin();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Random Mazes — Les fantômes d'Ombrequatre</title>
<link rel="stylesheet" href="css/style.css?v=5">
</head>
<body class="generator-body">
<div class="vignette"></div>

<header class="page-topbar">
    <h1 class="page-title">RANDOM MAZES</h1>
    <a href="menu.php" class="nav-btn">MENU</a>
</header>

<main class="generator-main panel">
    <section class="generator-intro">
        <h2>RANDOM LEVEL</h2>
        <p>Choose a difficulty — the solver checks every generated level
           in under <strong>15 seconds</strong> before you can play.</p>
    </section>

    <div class="diff-selector">
        <button type="button" class="menu-btn diff-btn" data-diff="easy">EASY</button>
        <button type="button" class="menu-btn diff-btn active" data-diff="medium">MEDIUM</button>
        <button type="button" class="menu-btn diff-btn" data-diff="hard">HARD</button>
    </div>
    <p id="diffDesc" class="editor-hint center"></p>

    <div class="generator-actions">
        <button type="button" class="menu-btn primary" id="generateBtn">GENERATE A MAZE</button>
        <button type="button" class="menu-btn" id="playBtn" disabled>PLAY THIS LEVEL</button>
    </div>

    <div id="genPreview" class="gen-preview"></div>
    <div id="genStatus" class="editor-status"></div>
</main>

<div id="solverOverlay" class="solver-overlay" hidden></div>

<script src="js/level-utils.js?v=5"></script>
<script src="js/game.js?v=5"></script>
<script src="js/solver-bridge.js?v=5"></script>
<script src="js/generator.js?v=5"></script>
</body>
</html>
