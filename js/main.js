// Global variables
let scene, camera, renderer;
let starfield = [];
let xwing;
let deathStar;
let controls;
let isLoaded = false;
let engineLights = []; // Array to store engine lights
let lasers = []; // Array to store active lasers
let explosionParticles = []; // Array to store explosion particles
let tieFighters = []; // Array to store TIE Fighters
let tieFighterLasers = []; // Array to store TIE Fighter lasers
let lastTieFighterSpawnTime = 0;
const TIE_FIGHTER_SPAWN_INTERVAL = 5000; // 5 seconds in milliseconds
let approachEncountersTriggered = false; // Track if approach encounters have been triggered
const APPROACH_ENCOUNTER_DISTANCES = [700, 600, 500, 400, 300]; // Distances to trigger encounters

// Sound effects
const sounds = {
    explosion: new Audio('sounds/effects/explosion.mp3'),
    tieFighterBlast: new Audio('sounds/effects/tie-fighter-blast.mp3'),
    xWingBlast: new Audio('sounds/effects/x-wing-blast.mp3'),
    deathStarApproach: new Audio('sounds/effects/death-star-approach.mp3'),
    showdown: new Audio('sounds/music/showdown.mp3')
};

// Sound manager
const soundManager = {
    init() {
        // Preload all sounds
        Object.values(sounds).forEach(sound => {
            sound.load();
        });
        
        // Set volume levels
        sounds.explosion.volume = 0.8;
        sounds.tieFighterBlast.volume = 0.1; // Reduced from 0.5 to 0.1
        sounds.xWingBlast.volume = 0.1; // Reduced from 0.6 to 0.1
        sounds.deathStarApproach.volume = 0.4;
        sounds.showdown.volume = 0.3; // Set background music at moderate volume
        
        // Don't loop the approach sound - we'll play it once
        sounds.deathStarApproach.loop = false;
        
        // Set the showdown music to loop
        sounds.showdown.loop = true;
        
        // Track last played time for throttling
        this.lastPlayedTime = {
            tieFighterBlast: 0,
            xWingBlast: 0
        };
    },
    
    play(soundName) {
        if (sounds[soundName]) {
            const currentTime = Date.now();
            
            // Apply throttling for blast sounds (500ms)
            if (['tieFighterBlast', 'xWingBlast'].includes(soundName)) {
                if (currentTime - this.lastPlayedTime[soundName] < 500) {
                    // Skip playing if sound was played less than 500ms ago
                    return;
                }
                this.lastPlayedTime[soundName] = currentTime;
                
                // Create a clone for overlapping sounds
                const soundClone = sounds[soundName].cloneNode();
                soundClone.volume = sounds[soundName].volume;
                soundClone.play();
            } else {
                // For non-overlapping sounds, just play the original
                sounds[soundName].currentTime = 0;
                sounds[soundName].play();
            }
        }
    },
    
    stop(soundName) {
        if (sounds[soundName]) {
            sounds[soundName].pause();
            sounds[soundName].currentTime = 0;
        }
    }
};

// Game state
const GAME_STATE = {
    START: 'start',
    PLAY: 'play',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
};
let currentGameState = GAME_STATE.START;

// X-Wing properties
const XWING_MAX_HP = 100;
let xwingHP = XWING_MAX_HP;
let xwingHPIndicator;

// Death Star properties
const DEATH_STAR_MAX_HP = 100;
let deathStarHP = DEATH_STAR_MAX_HP;
let deathStarDestroyed = false;
let hpIndicator;

// Flight controls
let keys = {};
let speed = 0.01; // Start with a slow speed by default
const MAX_SPEED = 0.025; // Reduced by 50% from 0.05
const ACCELERATION = 0.0005;
const DECELERATION = 0.0003;
const TURN_SPEED = 0.005;
const PITCH_SPEED = 0.005;

// Laser settings
const LASER_SPEED = 1.0; // 20x faster than before (0.05 * 20 = 1.0)
const LASER_LIFETIME = 200; // Adjusted to travel ~200 units (LASER_SPEED * LASER_LIFETIME = 1.0 * 200 = 200)
const LASER_COOLDOWN = 20; // frames
let laserCooldown = 0;

// Ship physics
let velocity = new THREE.Vector3(0, 0, 0);
let rotation = new THREE.Vector3(0, 0, 0);
const ROTATION_DAMPING = 0.9;
const VELOCITY_DAMPING = 0.95;

// UI elements
let speedIndicator;
let distanceIndicator;

// Initialize the scene
function init() {
    // Create the scene
    scene = new THREE.Scene();
    
    // Create the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0.5, -2.5); // Zoomed in 50% from -5 to -2.5
    
    // Create the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    document.body.appendChild(renderer.domElement);
    
    // Initialize sound manager
    soundManager.init();
    
    // Create starfield
    createStarfield();
    
    // Create Death Star
    createDeathStar();
    
    // Load X-Wing model
    loadXWingModel();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    // Set up keyboard controls
    setupControls();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Hide loading indicator
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
        isLoaded = true;
        
        // Show start screen
        showStartScreen();
    }, 1000);
    
    // Add controls info to the UI
    addControlsInfo();
    
    // Start animation loop
    animate();
}

// Show start screen
function showStartScreen() {
    currentGameState = GAME_STATE.START;
    
    // Create start screen
    const startScreen = document.createElement('div');
    startScreen.id = 'start-screen';
    startScreen.innerHTML = `
        <div class="start-content">
            <h1>MISSION: DESTROY THE DEATH STAR</h1>
            <p>The fate of the galaxy rests in your hands. Destroy the Death Star before it's too late!</p>
            <button id="start-button">START MISSION</button>
        </div>
    `;
    document.body.appendChild(startScreen);
    
    // Add event listener to start button
    document.getElementById('start-button').addEventListener('click', startGame);
}

// Start the game
function startGame() {
    currentGameState = GAME_STATE.PLAY;
    
    // Play death star approach sound
    soundManager.play('deathStarApproach');
    
    // Play background music
    soundManager.play('showdown');
    
    // Remove start screen
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.remove();
    }
    
    // Reset game variables
    resetGame();
}

// Reset game to initial state
function resetGame() {
    // Reset X-Wing HP
    xwingHP = XWING_MAX_HP;
    updateXWingHPIndicator();
    
    // Reset Death Star HP
    deathStarHP = DEATH_STAR_MAX_HP;
    deathStarDestroyed = false;
    updateHPIndicator();
    
    // Make Death Star visible again
    if (deathStar) {
        deathStar.visible = true;
    }
    
    // Reset X-Wing position
    if (xwing) {
        xwing.position.set(0, 0, 0);
        xwing.rotation.set(0, 0, 0);
    }
    
    // Reset speed
    speed = 0.01;
    updateSpeedIndicator();
    
    // Clear all lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        scene.remove(lasers[i].mesh);
    }
    lasers = [];
    
    // Clear all TIE Fighter lasers
    for (let i = tieFighterLasers.length - 1; i >= 0; i--) {
        scene.remove(tieFighterLasers[i].mesh);
    }
    tieFighterLasers = [];
    
    // Clear all TIE Fighters
    for (let i = tieFighters.length - 1; i >= 0; i--) {
        scene.remove(tieFighters[i].mesh);
    }
    tieFighters = [];
    
    // Reset TIE Fighter spawn time
    lastTieFighterSpawnTime = Date.now();
    
    // Reset approach encounters
    approachEncountersTriggered = false;
    // Reset encounter distances
    APPROACH_ENCOUNTER_DISTANCES.length = 0;
    APPROACH_ENCOUNTER_DISTANCES.push(700, 600, 500, 400, 300);
    
    // Remove any game over or victory messages
    const gameOverMessage = document.getElementById('game-over-message');
    if (gameOverMessage) {
        gameOverMessage.remove();
    }
    
    const victoryContainer = document.getElementById('victory-container');
    if (victoryContainer) {
        victoryContainer.remove();
    }
    
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.remove();
    }
    
    // Reset sounds - stop any playing sounds
    soundManager.stop('explosion');
    // We don't need to restart the approach sound here since it's played once in startGame
}

// Create starfield background
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
    });
    
    const starVertices = [];
    
    // Create 1000 stars randomly positioned in 3D space
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starfield.push(stars);
}

// Create Death Star
function createDeathStar() {
    // Create a group for the Death Star
    deathStar = new THREE.Group();
    
    // Main sphere
    const radius = 20;
    const deathStarGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const deathStarMaterial = new THREE.MeshPhongMaterial({
        color: 0x8a8a8a,
        shininess: 10,
        flatShading: true
    });
    const deathStarSphere = new THREE.Mesh(deathStarGeometry, deathStarMaterial);
    deathStar.add(deathStarSphere);
    
    // Superlaser dish (the iconic concave dish on the Death Star)
    const dishRadius = radius * 0.25;
    const dishDepth = radius * 0.1;
    const dishGeometry = new THREE.SphereGeometry(dishRadius, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        shininess: 5,
        flatShading: true
    });
    const dish = new THREE.Mesh(dishGeometry, dishMaterial);
    dish.position.set(0, 0, -radius + dishDepth);
    dish.rotation.x = Math.PI;
    deathStar.add(dish);
    
    // Superlaser center (the green laser emitter)
    const laserCenterGeometry = new THREE.CircleGeometry(dishRadius * 0.2, 16);
    const laserCenterMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const laserCenter = new THREE.Mesh(laserCenterGeometry, laserCenterMaterial);
    laserCenter.position.set(0, 0, -radius - 0.01);
    deathStar.add(laserCenter);
    
    // Add some surface details (random small boxes to simulate the Death Star's complex surface)
    const detailsMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    
    // Add equatorial trench
    const trenchGeometry = new THREE.BoxGeometry(radius * 2.1, radius * 0.1, radius * 0.1);
    const trench = new THREE.Mesh(trenchGeometry, detailsMaterial);
    deathStar.add(trench);
    
    // Add random surface details
    for (let i = 0; i < 100; i++) {
        const size = Math.random() * radius * 0.1;
        const detailGeometry = new THREE.BoxGeometry(size, size, size * 0.5);
        const detail = new THREE.Mesh(detailGeometry, detailsMaterial);
        
        // Generate random position on sphere surface
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        // Don't place details on the superlaser dish
        if (z > -radius * 0.8) {
            detail.position.set(x, y, z);
            
            // Orient the detail to be tangent to the sphere surface
            detail.lookAt(0, 0, 0);
            
            deathStar.add(detail);
        }
    }
    
    // Position the Death Star in the distance
    deathStar.position.set(0, 0, 800); // Changed from 100 to 800
    
    // Add to scene
    scene.add(deathStar);
}

// Load X-Wing model
function loadXWingModel() {
    // Create a group for the entire ship
    const shipGroup = new THREE.Group();
    
    // Create the main body (fuselage)
    const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    // Rotate to align with z-axis
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);
    
    // Create the cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.3, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0, -0.5);
    cockpit.rotation.x = Math.PI;
    shipGroup.add(cockpit);
    
    // Create the nose
    const noseGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
    const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0, 1.2);
    nose.rotation.x = -Math.PI / 2;
    shipGroup.add(nose);
    
    // Create the four wings in X configuration
    const wingGeometry = new THREE.BoxGeometry(1.5, 0.05, 0.3);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xdddddd });
    
    // Top-right wing
    const topRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topRightWing.position.set(0.8, 0.8, 0.2);
    topRightWing.rotation.z = Math.PI / 4;
    shipGroup.add(topRightWing);
    
    // Top-left wing
    const topLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topLeftWing.position.set(-0.8, 0.8, 0.2);
    topLeftWing.rotation.z = -Math.PI / 4;
    shipGroup.add(topLeftWing);
    
    // Bottom-right wing
    const bottomRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomRightWing.position.set(0.8, -0.8, 0.2);
    bottomRightWing.rotation.z = -Math.PI / 4;
    shipGroup.add(bottomRightWing);
    
    // Bottom-left wing
    const bottomLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomLeftWing.position.set(-0.8, -0.8, 0.2);
    bottomLeftWing.rotation.z = Math.PI / 4;
    shipGroup.add(bottomLeftWing);
    
    // Add wing-tip lasers (small red cylinders)
    const laserGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const laserMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    
    // Add lasers to each wing tip
    const positions = [
        [1.4, 1.4, 0.2],  // Top-right
        [-1.4, 1.4, 0.2], // Top-left
        [1.4, -1.4, 0.2], // Bottom-right
        [-1.4, -1.4, 0.2] // Bottom-left
    ];
    
    // Create references to the lasers for later updating
    const wingTipLasers = [];
    
    positions.forEach(pos => {
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        laser.position.set(pos[0], pos[1], pos[2]);
        laser.rotation.x = Math.PI / 2;
        shipGroup.add(laser);
        wingTipLasers.push(laser);
    });
    
    // Add engines (small blue cylinders)
    const engineGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const engineMaterial = new THREE.MeshPhongMaterial({ color: 0x3366ff });
    
    // Add four engines
    const enginePositions = [
        [0.3, 0.3, -0.8],  // Top-right
        [-0.3, 0.3, -0.8], // Top-left
        [0.3, -0.3, -0.8], // Bottom-right
        [-0.3, -0.3, -0.8] // Bottom-left
    ];
    
    enginePositions.forEach(pos => {
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.position.set(pos[0], pos[1], pos[2]);
        engine.rotation.x = Math.PI / 2;
        shipGroup.add(engine);
        
        // Add engine glow (point light)
        const engineLight = new THREE.PointLight(0x00aaff, 1, 0.5);
        engineLight.position.set(pos[0], pos[1], pos[2] - 0.2);
        shipGroup.add(engineLight);
        engineLights.push(engineLight);
    });
    
    // Scale the entire ship - make it smaller
    shipGroup.scale.set(0.2, 0.2, 0.2);
    
    // Add to scene
    scene.add(shipGroup);
    xwing = shipGroup;
    
    // Position the ship at the origin, facing the Death Star
    shipGroup.position.set(0, 0, 0);
    shipGroup.rotation.set(0, 0, 0);
}

// Set up keyboard controls
function setupControls() {
    // Key down event
    window.addEventListener('keydown', (event) => {
        keys[event.key.toLowerCase()] = true;
        
        // Prevent default behavior for game control keys
        if (['w', 'a', 's', 'd', 'q', 'e', ' '].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }
    });
    
    // Key up event
    window.addEventListener('keyup', (event) => {
        keys[event.key.toLowerCase()] = false;
    });
}

// Add controls info to the UI
function addControlsInfo() {
    const controlsInfo = document.createElement('div');
    controlsInfo.id = 'controls-info';
    controlsInfo.innerHTML = `
        <div class="controls-panel">
            <h3>Controls:</h3>
            <p>W/S - Pitch</p>
            <p>A/D - Turn</p>
            <p>Q/E - Speed</p>
            <p>SPACE - Fire</p>
        </div>
    `;
    document.body.appendChild(controlsInfo);
    
    // Add speed indicator
    const speedPanel = document.createElement('div');
    speedPanel.id = 'speed-panel';
    speedPanel.innerHTML = `
        <div class="speed-indicator">
            <div class="speed-label">SPEED</div>
            <div class="speed-bar-container">
                <div class="speed-bar" id="speed-bar"></div>
            </div>
        </div>
    `;
    document.body.appendChild(speedPanel);
    
    // Store reference to speed bar
    speedIndicator = document.getElementById('speed-bar');
    
    // Add distance indicator
    const distancePanel = document.createElement('div');
    distancePanel.id = 'distance-panel';
    distancePanel.innerHTML = `
        <div class="distance-indicator">
            <div class="distance-label">DISTANCE TO TARGET</div>
            <div id="distance-value">100.0</div>
        </div>
    `;
    document.body.appendChild(distancePanel);
    
    // Store reference to distance value
    distanceIndicator = document.getElementById('distance-value');
    
    // Add combined HP indicator panel
    const combinedHPPanel = document.createElement('div');
    combinedHPPanel.id = 'combined-hp-panel';
    combinedHPPanel.innerHTML = `
        <div class="combined-hp-indicator">
            <div class="hp-section">
                <div class="hp-label xwing-label">X-WING INTEGRITY</div>
                <div class="hp-bar-container">
                    <div class="hp-bar xwing-hp-bar" id="xwing-hp-bar"></div>
                </div>
                <div id="xwing-hp-value">100%</div>
            </div>
            <div class="hp-section">
                <div class="hp-label deathstar-label">DEATH STAR INTEGRITY</div>
                <div class="hp-bar-container">
                    <div class="hp-bar deathstar-hp-bar" id="hp-bar"></div>
                </div>
                <div id="hp-value">100%</div>
            </div>
        </div>
    `;
    document.body.appendChild(combinedHPPanel);
    
    // Store references to HP bars
    hpIndicator = document.getElementById('hp-bar');
    xwingHPIndicator = document.getElementById('xwing-hp-bar');
}

// Handle ship controls
function handleControls() {
    if (!xwing || !isLoaded || currentGameState !== GAME_STATE.PLAY) return;
    
    // Speed control (Q/E)
    if (keys['q']) {
        speed = Math.max(0, speed - DECELERATION);
    }
    if (keys['e']) {
        speed = Math.min(MAX_SPEED, speed + ACCELERATION);
    }
    
    // Update speed indicator
    updateSpeedIndicator();
    
    // Calculate forward direction
    const forwardDirection = new THREE.Vector3(0, 0, 1);
    forwardDirection.applyQuaternion(xwing.quaternion);
    forwardDirection.multiplyScalar(speed);
    
    // Apply velocity with damping
    velocity.multiplyScalar(VELOCITY_DAMPING);
    velocity.add(forwardDirection);
    
    // Apply velocity to position
    xwing.position.add(velocity);
    
    // Turn left/right (A/D) - apply to rotation vector
    if (keys['a']) {
        rotation.y += TURN_SPEED;
    }
    if (keys['d']) {
        rotation.y -= TURN_SPEED;
    }
    
    // Pitch up/down (W/S) - apply to rotation vector
    if (keys['w']) {
        rotation.x += PITCH_SPEED;
    }
    if (keys['s']) {
        rotation.x -= PITCH_SPEED;
    }
    
    // Apply damping to rotation
    rotation.multiplyScalar(ROTATION_DAMPING);
    
    // Apply rotation to ship
    xwing.rotateX(rotation.x);
    xwing.rotateY(rotation.y);
    
    // Fire lasers (SPACE)
    if (keys[' ']) {
        fireLasers();
    }
    
    // Update camera position to follow the ship
    updateCameraPosition();
}

// Update camera position to follow the ship
function updateCameraPosition() {
    if (!xwing) return;
    
    // Get the ship's position
    const shipPosition = xwing.position.clone();
    
    // Calculate the forward direction of the ship (where the nose points)
    const forwardDirection = new THREE.Vector3(0, 0, 1);
    forwardDirection.applyQuaternion(xwing.quaternion);
    
    // Calculate a point in front of the ship to look at
    const lookAtPoint = shipPosition.clone().add(forwardDirection.clone().multiplyScalar(10));
    
    // Calculate camera position (closer to the back of the ship)
    const backwardDirection = forwardDirection.clone().negate();
    const cameraPosition = shipPosition.clone().add(backwardDirection.multiplyScalar(1.5));
    
    // Add a slight height offset
    cameraPosition.y += 0.3;
    
    // Apply smooth movement to camera
    camera.position.lerp(cameraPosition, 0.2);
    
    // Look in the direction the ship is facing
    camera.lookAt(lookAtPoint);
}

// Fire lasers
function fireLasers() {
    if (laserCooldown > 0) return; // Still in cooldown
    
    // Play X-Wing laser sound
    soundManager.play('xWingBlast');
    
    // Get the forward direction of the ship
    const forwardDirection = new THREE.Vector3(0, 0, 1);
    forwardDirection.applyQuaternion(xwing.quaternion);
    
    // Calculate wing tip positions based on current wing positions
    // This ensures lasers fire from the correct positions as wings move
    const closingFactor = speed / MAX_SPEED;
    const verticalOffset = 0.8 * (1 - closingFactor);
    
    // Wing tip positions relative to the ship center, adjusted for current wing positions
    const wingTips = [
        new THREE.Vector3(1.4, verticalOffset + 0.6, 0.2),   // Top-right
        new THREE.Vector3(-1.4, verticalOffset + 0.6, 0.2),  // Top-left
        new THREE.Vector3(1.4, -verticalOffset - 0.6, 0.2),  // Bottom-right
        new THREE.Vector3(-1.4, -verticalOffset - 0.6, 0.2)  // Bottom-left
    ];
    
    // Create a laser from each wing tip
    wingTips.forEach(wingTipLocal => {
        // Create a laser beam (using a group for better visual effect)
        const laserGroup = new THREE.Group();
        
        // Main laser beam
        const laserGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8); // Thinner lasers
        const laserMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, // Red lasers like in the movies
            transparent: true,
            opacity: 0.9
        });
        const laserBeam = new THREE.Mesh(laserGeometry, laserMaterial);
        laserGroup.add(laserBeam);
        
        // Add glow effect (slightly larger, more transparent cylinder)
        const glowGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3333, // Lighter red for glow
            transparent: true,
            opacity: 0.5
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        laserGroup.add(glow);
        
        // Convert local wing tip position to world position
        const wingTipWorld = wingTipLocal.clone();
        wingTipWorld.applyMatrix4(xwing.matrix);
        
        // Position the laser at the wing tip
        laserGroup.position.copy(wingTipWorld);
        
        // Rotate the laser to match the ship's orientation
        laserGroup.quaternion.copy(xwing.quaternion);
        laserGroup.rotateX(Math.PI / 2); // Align with forward direction
        
        // Add to scene and lasers array
        scene.add(laserGroup);
        lasers.push({
            mesh: laserGroup,
            direction: forwardDirection,
            lifetime: LASER_LIFETIME
        });
    });
    
    // Set cooldown
    laserCooldown = LASER_COOLDOWN;
}

// Update lasers
function updateLasers() {
    // Update laser cooldown
    if (laserCooldown > 0) {
        laserCooldown--;
    }
    
    // Skip laser updates if Death Star is destroyed
    if (deathStarDestroyed) return;
    
    // Update existing lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        
        // Move laser forward
        laser.mesh.position.add(laser.direction.clone().multiplyScalar(LASER_SPEED));
        
        // Check for collision with Death Star
        if (checkLaserHit(laser)) {
            // Remove the laser
            scene.remove(laser.mesh);
            lasers.splice(i, 1);
            continue;
        }
        
        // Check for collision with TIE Fighters
        if (checkLaserHitTieFighter(laser)) {
            // Remove the laser
            scene.remove(laser.mesh);
            lasers.splice(i, 1);
            continue;
        }
        
        // Decrease lifetime
        laser.lifetime--;
        
        // Remove if lifetime is over
        if (laser.lifetime <= 0) {
            scene.remove(laser.mesh);
            lasers.splice(i, 1);
        }
    }
}

// Check if a laser hits the Death Star
function checkLaserHit(laser) {
    if (!deathStar || deathStarDestroyed) return false;
    
    // Calculate distance from laser to Death Star center
    const distance = laser.mesh.position.distanceTo(deathStar.position);
    
    // Death Star radius is 20 units
    if (distance < 20) {
        // Hit detected!
        deathStarHP -= 10; // Each hit does 10 damage
        
        // Update HP indicator
        updateHPIndicator();
        
        // Create hit effect (small flash)
        createHitEffect(laser.mesh.position.clone());
        
        // Check if Death Star is destroyed
        if (deathStarHP <= 0) {
            destroyDeathStar();
        }
        
        return true;
    }
    
    return false;
}

// Create a hit effect at the specified position
function createHitEffect(position) {
    // Create a flash of light
    const hitLight = new THREE.PointLight(0xffff00, 2, 10);
    hitLight.position.copy(position);
    scene.add(hitLight);
    
    // Remove the light after a short time
    setTimeout(() => {
        scene.remove(hitLight);
    }, 100);
}

// Destroy the Death Star with a spectacular explosion
function destroyDeathStar() {
    deathStarDestroyed = true;
    currentGameState = GAME_STATE.VICTORY;
    
    // Play explosion sound
    soundManager.play('explosion');
    
    // Stop the death star approach sound
    soundManager.stop('deathStarApproach');
    
    // Stop the background music
    soundManager.stop('showdown');
    
    // Create explosion particles
    createExplosion(deathStar.position.clone(), 500, 30);
    
    // Hide the Death Star (we'll keep it in the scene but make it invisible)
    deathStar.visible = false;
    
    // Update UI
    updateHPIndicator();
    
    // Delay showing victory message and restart button by 5 seconds
    setTimeout(() => {
        // Create a container for victory elements
        const victoryContainer = document.createElement('div');
        victoryContainer.id = 'victory-container';
        
        // Display victory message
        const victoryMessage = document.createElement('div');
        victoryMessage.id = 'victory-message';
        victoryMessage.innerHTML = 'DEATH STAR<br>DESTROYED!';
        
        // Add restart button
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.innerHTML = 'RESTART MISSION';
        restartButton.addEventListener('click', startGame);
        
        // Add elements to the container
        victoryContainer.appendChild(victoryMessage);
        victoryContainer.appendChild(restartButton);
        
        // Add container to the document
        document.body.appendChild(victoryContainer);
    }, 5000); // 5 seconds delay
    
    // Play explosion sound (would be added in a later phase)
    console.log('BOOM!');
}

// Create explosion particles
function createExplosion(position, particleCount, size) {
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xff5500,
        size: 0.5,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    
    // Create particles with random positions and velocities
    for (let i = 0; i < particleCount; i++) {
        // Random position within sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = Math.random() * size;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        particlePositions.push(x, y, z);
        
        // Random velocity outward from center
        const speed = 0.05 + Math.random() * 0.15; // Slower particles for longer-lasting explosion
        particleVelocities.push(
            x / radius * speed,
            y / radius * speed,
            z / radius * speed
        );
    }
    
    // Set particle positions
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    // Create particle system
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.position.copy(position);
    
    // Add to scene and explosion particles array
    scene.add(particleSystem);
    explosionParticles.push({
        system: particleSystem,
        velocities: particleVelocities,
        lifetime: 300, // Increased lifetime for Death Star explosion
        age: 0
    });
    
    // Add a bright flash at the center
    const explosionLight = new THREE.PointLight(0xffaa00, 10, 100);
    explosionLight.position.copy(position);
    scene.add(explosionLight);
    
    // Fade out the light more slowly
    const fadeLight = () => {
        explosionLight.intensity -= 0.05; // Slower fade
        if (explosionLight.intensity > 0) {
            setTimeout(fadeLight, 100); // Longer interval
        } else {
            scene.remove(explosionLight);
        }
    };
    
    fadeLight();
    
    // Create secondary explosions for more dramatic effect
    setTimeout(() => {
        createSecondaryExplosion(position.clone(), particleCount / 2, size * 0.7);
    }, 1000);
    
    setTimeout(() => {
        createSecondaryExplosion(position.clone(), particleCount / 3, size * 0.5);
    }, 2500);
}

// Create secondary explosion for more dramatic effect
function createSecondaryExplosion(position, particleCount, size) {
    // Add random offset to position
    position.x += (Math.random() - 0.5) * size * 0.5;
    position.y += (Math.random() - 0.5) * size * 0.5;
    position.z += (Math.random() - 0.5) * size * 0.5;
    
    // Create particle material with random color variation
    const hue = 0.05 + Math.random() * 0.1; // Orange to yellow range
    const color = new THREE.Color().setHSL(hue, 1, 0.5);
    
    const particleMaterial = new THREE.PointsMaterial({
        color: color,
        size: 0.4,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    
    // Create particles with random positions and velocities
    for (let i = 0; i < particleCount; i++) {
        // Random position within sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = Math.random() * size;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        particlePositions.push(x, y, z);
        
        // Random velocity outward from center
        const speed = 0.1 + Math.random() * 0.2;
        particleVelocities.push(
            x / radius * speed,
            y / radius * speed,
            z / radius * speed
        );
    }
    
    // Set particle positions
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    // Create particle system
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.position.copy(position);
    
    // Add to scene and explosion particles array
    scene.add(particleSystem);
    explosionParticles.push({
        system: particleSystem,
        velocities: particleVelocities,
        lifetime: 200,
        age: 0
    });
    
    // Add a bright flash at the center
    const explosionLight = new THREE.PointLight(color, 5, 50);
    explosionLight.position.copy(position);
    scene.add(explosionLight);
    
    // Fade out the light
    const fadeLight = () => {
        explosionLight.intensity -= 0.1;
        if (explosionLight.intensity > 0) {
            setTimeout(fadeLight, 50);
        } else {
            scene.remove(explosionLight);
        }
    };
    
    fadeLight();
}

// Update explosion particles
function updateExplosionParticles() {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const explosion = explosionParticles[i];
        
        // Update particle positions based on velocities
        const positions = explosion.system.geometry.attributes.position.array;
        
        for (let j = 0; j < positions.length; j += 3) {
            positions[j] += explosion.velocities[j];
            positions[j + 1] += explosion.velocities[j + 1];
            positions[j + 2] += explosion.velocities[j + 2];
        }
        
        explosion.system.geometry.attributes.position.needsUpdate = true;
        
        // Update material properties based on age
        explosion.age++;
        
        // Fade out particles
        if (explosion.age > 100) {
            explosion.system.material.opacity = 1 - (explosion.age - 100) / 100;
        }
        
        // Remove if lifetime is over
        if (explosion.age >= explosion.lifetime) {
            scene.remove(explosion.system);
            explosionParticles.splice(i, 1);
        }
    }
}

// Update HP indicator
function updateHPIndicator() {
    if (hpIndicator) {
        const percentage = Math.max(0, (deathStarHP / DEATH_STAR_MAX_HP) * 100);
        hpIndicator.style.width = `${percentage}%`;
        
        // Update text value
        const hpValue = document.getElementById('hp-value');
        if (hpValue) {
            hpValue.textContent = `${Math.ceil(percentage)}%`;
        }
        
        // Change color based on HP
        if (percentage < 25) {
            hpIndicator.style.backgroundColor = '#e74c3c'; // Red for low HP
        } else if (percentage < 50) {
            hpIndicator.style.backgroundColor = '#f39c12'; // Orange for medium HP
        } else {
            hpIndicator.style.backgroundColor = '#2ecc71'; // Green for high HP
        }
    }
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Handle ship controls (only in PLAY state)
    if (currentGameState === GAME_STATE.PLAY) {
        handleControls();
        
        // Update lasers
        updateLasers();
        
        // Spawn TIE Fighters automatically
        spawnTieFighters();
        
        // Update TIE Fighters
        updateTieFighters();
        
        // Update TIE Fighter lasers
        updateTieFighterLasers();
    }
    
    // Update explosion particles (always update for visual effects)
    updateExplosionParticles();
    
    // Animate starfield (subtle rotation)
    if (starfield.length > 0) {
        starfield[0].rotation.x += 0.0001;
        starfield[0].rotation.y += 0.0001;
    }
    
    // Animate Death Star (slow rotation)
    if (deathStar && !deathStarDestroyed) {
        deathStar.rotation.y += 0.0005;
    }
    
    // Animate X-Wing (engine lights only, movement is now controlled by player)
    if (xwing && isLoaded) {
        // S-foil movement is now tied to speed
        if (xwing.children.length >= 7) { // Make sure wings exist
            // Invert the wing angle calculation - wings close as speed increases
            // At max speed, wings are fully closed (horizontal)
            // At min speed, wings are fully open in X formation
            const closingFactor = speed / MAX_SPEED; // 0 to 1 based on current speed
            const wingAngle = Math.PI / 4 * (1 - closingFactor); // From π/4 (45°) to 0 as speed increases
            
            // Calculate vertical position adjustment - wings move toward center line as they close
            const verticalOffset = 0.8 * (1 - closingFactor); // From 0.8 to 0 as speed increases
            
            // Top-right wing - from 45° angle to 0° (horizontal) and move down
            xwing.children[3].rotation.z = wingAngle;
            xwing.children[3].position.set(0.8, verticalOffset, 0.2);
            
            // Top-left wing - from -45° angle to 0° (horizontal) and move down
            xwing.children[4].rotation.z = -wingAngle;
            xwing.children[4].position.set(-0.8, verticalOffset, 0.2);
            
            // Bottom-right wing - from -45° angle to 0° (horizontal) and move up
            xwing.children[5].rotation.z = -wingAngle;
            xwing.children[5].position.set(0.8, -verticalOffset, 0.2);
            
            // Bottom-left wing - from 45° angle to 0° (horizontal) and move up
            xwing.children[6].rotation.z = wingAngle;
            xwing.children[6].position.set(-0.8, -verticalOffset, 0.2);
            
            // Update wing-tip lasers to follow the wings (they are children 7-10)
            if (xwing.children.length >= 11) {
                // Top-right laser
                xwing.children[7].position.set(1.4, verticalOffset + 0.6, 0.2);
                // Top-left laser
                xwing.children[8].position.set(-1.4, verticalOffset + 0.6, 0.2);
                // Bottom-right laser
                xwing.children[9].position.set(1.4, -verticalOffset - 0.6, 0.2);
                // Bottom-left laser
                xwing.children[10].position.set(-1.4, -verticalOffset - 0.6, 0.2);
            }
        }
        
        // Animate engine lights (pulsing effect tied to speed)
        engineLights.forEach(light => {
            light.intensity = 0.5 + speed * 10 + Math.sin(Date.now() * 0.01) * 0.2;
        });
        
        // Update distance to Death Star
        updateDistanceIndicator();
    }
    
    // Update X-Wing HP indicator
    updateXWingHPIndicator();
    
    // Render the scene
    renderer.render(scene, camera);
}

// Update speed indicator
function updateSpeedIndicator() {
    if (speedIndicator) {
        const percentage = (speed / MAX_SPEED) * 100;
        speedIndicator.style.width = `${percentage}%`;
        
        // Change color based on speed
        if (percentage < 30) {
            speedIndicator.style.backgroundColor = '#3498db'; // Blue for low speed
        } else if (percentage < 70) {
            speedIndicator.style.backgroundColor = '#2ecc71'; // Green for medium speed
        } else {
            speedIndicator.style.backgroundColor = '#e74c3c'; // Red for high speed
        }
    }
}

// Update distance indicator
function updateDistanceIndicator() {
    if (distanceIndicator && xwing && deathStar) {
        const distance = xwing.position.distanceTo(deathStar.position);
        distanceIndicator.textContent = distance.toFixed(1);
        
        // Change color based on distance
        if (distance < 30) {
            distanceIndicator.style.color = '#e74c3c'; // Red for close
        } else if (distance < 60) {
            distanceIndicator.style.color = '#f39c12'; // Orange for medium
        } else {
            distanceIndicator.style.color = '#2ecc71'; // Green for far
        }
        
        // Check for approach encounters
        if (currentGameState === GAME_STATE.PLAY && !approachEncountersTriggered) {
            checkApproachEncounters(distance);
        }
    }
}

// Check for approach encounters based on distance to Death Star
function checkApproachEncounters(currentDistance) {
    // Check each encounter distance
    for (let i = 0; i < APPROACH_ENCOUNTER_DISTANCES.length; i++) {
        const encounterDistance = APPROACH_ENCOUNTER_DISTANCES[i];
        
        // If we're close to an encounter point (within 10 units)
        if (Math.abs(currentDistance - encounterDistance) < 10) {
            // Spawn a group of TIE Fighters for this encounter
            spawnApproachEncounter(encounterDistance, i);
            
            // Remove this encounter so it doesn't trigger again
            APPROACH_ENCOUNTER_DISTANCES.splice(i, 1);
            i--; // Adjust index after removal
            
            // If no more encounters, mark as triggered
            if (APPROACH_ENCOUNTER_DISTANCES.length === 0) {
                approachEncountersTriggered = true;
            }
            
            break; // Only trigger one encounter at a time
        }
    }
}

// Spawn a group of TIE Fighters for an approach encounter
function spawnApproachEncounter(distance, encounterIndex) {
    // Number of TIE Fighters increases as you get closer to the Death Star
    const numTieFighters = Math.min(2 + encounterIndex, 4); // 2 to 4 TIE Fighters
    
    // Check if we can spawn more TIE Fighters (respect max limit of 10)
    if (tieFighters.length >= 10) {
        console.log("Maximum TIE Fighter limit reached, not spawning more");
        return;
    }
    
    // Only spawn as many as we can without exceeding the limit
    const actualNumToSpawn = Math.min(numTieFighters, 10 - tieFighters.length);
    
    console.log(`Spawning approach encounter at distance ${distance} with ${actualNumToSpawn} TIE Fighters`);
    
    // Spawn TIE Fighters from the Death Star
    for (let i = 0; i < actualNumToSpawn; i++) {
        // Calculate a random position near the Death Star
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = 30 + Math.random() * 10; // 30-40 units from Death Star center
        
        // Position relative to Death Star
        const x = deathStar.position.x + Math.cos(randomAngle) * randomRadius;
        const y = deathStar.position.y + (Math.random() - 0.5) * 20; // Random height
        const z = deathStar.position.z + Math.sin(randomAngle) * randomRadius;
        
        // Create the TIE Fighter
        const tieFighter = createTieFighter(new THREE.Vector3(x, y, z));
        
        // Make the TIE Fighter face toward the player initially
        tieFighter.lookAt(xwing.position);
        
        // Set a higher speed for this TIE Fighter to approach more aggressively
        const tieFighterData = tieFighters[tieFighters.length - 1];
        tieFighterData.speed = 0.3 + Math.random() * 0.15; // Faster speed (0.3-0.45 instead of 0.15-0.25)
        tieFighterData.behaviorState = 'pursue'; // Force pursuit behavior initially
        tieFighterData.behaviorTimer = 100 + Math.random() * 50; // Longer initial pursuit
    }
}

// Create a TIE Fighter
function createTieFighter(position) {
    // Create a group for the TIE Fighter
    const tieFighter = new THREE.Group();
    
    // Create the cockpit (sphere)
    const cockpitGeometry = new THREE.SphereGeometry(0.5, 16, 16); // Increased from 0.4 to 0.5
    const cockpitMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    tieFighter.add(cockpit);
    
    // Create the wing panels (hexagonal)
    const wingGeometry = new THREE.BoxGeometry(1.5, 1.5, 0.1); // Increased from 1.2 to 1.5
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-1.0, 0, 0); // Adjusted from -0.8 to -1.0 to account for larger wings
    leftWing.rotation.y = Math.PI / 2;
    tieFighter.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(1.0, 0, 0); // Adjusted from 0.8 to 1.0 to account for larger wings
    rightWing.rotation.y = Math.PI / 2;
    tieFighter.add(rightWing);
    
    // Position the TIE Fighter
    tieFighter.position.copy(position);
    
    // Scale the entire TIE Fighter to make it 20% larger
    tieFighter.scale.set(1.2, 1.2, 1.2);
    
    // Add to scene and TIE Fighters array
    scene.add(tieFighter);
    tieFighters.push({
        mesh: tieFighter,
        speed: 0.15 + Math.random() * 0.1, // Random speed between 0.15 and 0.25
        lastFireTime: 0, // Track when this TIE Fighter last fired
        fireInterval: 1000 + Math.random() * 500, // Random interval between 1-1.5 seconds
        behaviorState: 'pursue', // Initial behavior state: 'pursue', 'strafe', or 'evade'
        behaviorTimer: Math.random() * 100, // Timer for behavior changes
        strafeDirection: new THREE.Vector3(), // Direction for strafing runs
        evadeOffset: new THREE.Vector3() // Offset for evasive maneuvers
    });
    
    return tieFighter;
}

// Spawn TIE Fighters automatically
function spawnTieFighters() {
    const currentTime = Date.now();
    
    // Check if it's time to spawn new TIE Fighters and we haven't reached the maximum
    if (currentTime - lastTieFighterSpawnTime > TIE_FIGHTER_SPAWN_INTERVAL && tieFighters.length < 10) {
        // Spawn 1 TIE Fighter instead of 3
        // Spawn a TIE Fighter at a random position near the Death Star
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = 30 + Math.random() * 20; // 30-50 units from Death Star center
        
        const x = deathStar.position.x + Math.cos(randomAngle) * randomRadius;
        const y = deathStar.position.y + (Math.random() - 0.5) * 20; // Random height
        const z = deathStar.position.z + Math.sin(randomAngle) * randomRadius;
        
        const tieFighter = createTieFighter(new THREE.Vector3(x, y, z));
        
        // Make the TIE Fighter face toward the player initially
        tieFighter.lookAt(xwing.position);
        
        // Set a higher speed for this TIE Fighter to approach more aggressively
        const tieFighterData = tieFighters[tieFighters.length - 1];
        tieFighterData.speed = 0.25 + Math.random() * 0.15; // Faster speed (0.25-0.4 instead of 0.15-0.25)
        
        // Update last spawn time
        lastTieFighterSpawnTime = currentTime;
    }
}

// TIE Fighter fires a laser
function fireTieFighterLaser(tieFighter) {
    // Play TIE fighter laser sound
    soundManager.play('tieFighterBlast');
    
    // Create a laser beam
    const laserGroup = new THREE.Group();
    
    // Main laser beam
    const laserGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const laserMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, // Red for TIE Fighter lasers
        transparent: true,
        opacity: 0.9
    });
    const laserBeam = new THREE.Mesh(laserGeometry, laserMaterial);
    laserGroup.add(laserBeam);
    
    // Add glow effect
    const glowGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333, // Lighter red for glow
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    laserGroup.add(glow);
    
    // Calculate direction to player
    const direction = new THREE.Vector3();
    direction.subVectors(xwing.position, tieFighter.mesh.position).normalize();
    
    // Position the laser at the TIE Fighter
    const laserPosition = tieFighter.mesh.position.clone();
    laserGroup.position.copy(laserPosition);
    
    // Rotate the laser to face the player
    laserGroup.lookAt(xwing.position);
    laserGroup.rotateX(Math.PI / 2); // Align with forward direction
    
    // Add to scene and lasers array
    scene.add(laserGroup);
    tieFighterLasers.push({
        mesh: laserGroup,
        direction: direction,
        lifetime: 200 // Same lifetime as player lasers
    });
}

// Update TIE Fighter lasers
function updateTieFighterLasers() {
    // Update existing lasers
    for (let i = tieFighterLasers.length - 1; i >= 0; i--) {
        const laser = tieFighterLasers[i];
        
        // Move laser forward
        laser.mesh.position.add(laser.direction.clone().multiplyScalar(LASER_SPEED));
        
        // Check for collision with player
        if (checkTieFighterLaserHit(laser)) {
            // Remove the laser
            scene.remove(laser.mesh);
            tieFighterLasers.splice(i, 1);
            continue;
        }
        
        // Decrease lifetime
        laser.lifetime--;
        
        // Remove if lifetime is over
        if (laser.lifetime <= 0) {
            scene.remove(laser.mesh);
            tieFighterLasers.splice(i, 1);
        }
    }
}

// Check if a TIE Fighter laser hits the player
function checkTieFighterLaserHit(laser) {
    if (!xwing) return false;
    
    // Calculate distance from laser to player
    const distance = laser.mesh.position.distanceTo(xwing.position);
    
    // Player hit box radius (adjust as needed)
    const hitBoxRadius = 0.5;
    
    if (distance < hitBoxRadius) {
        // Hit detected!
        xwingHP -= 1; // Each hit does 1 damage
        
        // Update HP indicator
        updateXWingHPIndicator();
        
        // Create hit effect
        createHitEffect(laser.mesh.position.clone());
        
        // Check if player is destroyed
        if (xwingHP <= 0) {
            // Game over
            gameOver();
            xwingHP = 0; // Prevent negative HP
        }
        
        return true;
    }
    
    return false;
}

// Update TIE Fighters
function updateTieFighters() {
    const currentTime = Date.now();
    
    for (let i = tieFighters.length - 1; i >= 0; i--) {
        const tieFighter = tieFighters[i];
        
        // Calculate direction to player
        const directionToPlayer = new THREE.Vector3();
        directionToPlayer.subVectors(xwing.position, tieFighter.mesh.position).normalize();
        
        // Calculate distance to player
        const distanceToPlayer = tieFighter.mesh.position.distanceTo(xwing.position);
        
        // Update behavior timer and possibly change state
        tieFighter.behaviorTimer -= 1;
        
        if (tieFighter.behaviorTimer <= 0) {
            // Time to change behavior
            if (tieFighter.behaviorState === 'pursue' && distanceToPlayer < 25) { // Reduced from 30 to 25
                // If close enough, switch to strafing or evading
                tieFighter.behaviorState = Math.random() > 0.7 ? 'strafe' : 'evade'; // 30% chance of strafe, 70% evade
                
                if (tieFighter.behaviorState === 'strafe') {
                    // Set up strafing run - fly past the player
                    tieFighter.strafeDirection = directionToPlayer.clone();
                    // Add some randomness to strafe direction
                    tieFighter.strafeDirection.x += (Math.random() - 0.5) * 0.5;
                    tieFighter.strafeDirection.y += (Math.random() - 0.5) * 0.5;
                    tieFighter.strafeDirection.normalize();
                } else {
                    // Set up evasive maneuver
                    tieFighter.evadeOffset.set(
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2
                    );
                }
                
                // Set timer for this behavior (shorter for evasive maneuvers)
                tieFighter.behaviorTimer = tieFighter.behaviorState === 'evade' ? 
                    20 + Math.random() * 20 : // Reduced from 30+30 to 20+20
                    40 + Math.random() * 40;  // Reduced from 60+60 to 40+40
            } else {
                // Return to pursuit behavior
                tieFighter.behaviorState = 'pursue';
                tieFighter.behaviorTimer = 60 + Math.random() * 60; // Reduced from 100+100 to 60+60
            }
        }
        
        // Apply movement based on current behavior state
        let moveDirection = new THREE.Vector3();
        
        if (tieFighter.behaviorState === 'pursue') {
            // More aggressive pursuit behavior
            if (distanceToPlayer > 20) { // Reduced from 25 to 20
                // Move directly toward player if too far
                moveDirection = directionToPlayer;
            } else {
                // Circle around at optimal distance but more aggressively
                const circleDirection = new THREE.Vector3().crossVectors(
                    directionToPlayer,
                    new THREE.Vector3(0, 1, 0)
                ).normalize();
                
                // Mix of circling and maintaining distance (more direct approach)
                moveDirection.addVectors(
                    circleDirection.multiplyScalar(0.6), // Reduced from 0.8 to 0.6
                    directionToPlayer.multiplyScalar(distanceToPlayer > 25 ? 0.4 : -0.2) // Increased from 0.2 to 0.4
                ).normalize();
            }
        } else if (tieFighter.behaviorState === 'strafe') {
            // Continue on strafing path
            moveDirection = tieFighter.strafeDirection;
        } else if (tieFighter.behaviorState === 'evade') {
            // Evasive maneuvers - move in random direction plus some player tracking
            moveDirection.addVectors(
                directionToPlayer.multiplyScalar(0.3),
                tieFighter.evadeOffset.multiplyScalar(0.7)
            ).normalize();
        }
        
        // Apply movement
        tieFighter.mesh.position.add(moveDirection.multiplyScalar(tieFighter.speed));
        
        // Always face toward movement direction (with slight tracking of player)
        const lookDirection = new THREE.Vector3();
        lookDirection.addVectors(
            moveDirection.multiplyScalar(0.7), // Reduced from 0.8 to 0.7
            directionToPlayer.multiplyScalar(0.3)  // Increased from 0.2 to 0.3
        ).normalize();
        
        // Create a look target
        const lookTarget = tieFighter.mesh.position.clone().add(lookDirection);
        tieFighter.mesh.lookAt(lookTarget);
        
        // Check if it's time to fire - only fire when not evading and within firing range
        // More aggressive firing behavior
        if ((tieFighter.behaviorState !== 'evade' || Math.random() < 0.1) && // 10% chance to fire even when evading
            distanceToPlayer < 60 && // Increased from 50 to 60
            currentTime - tieFighter.lastFireTime > tieFighter.fireInterval * 0.8) { // 20% faster firing
            fireTieFighterLaser(tieFighter);
            tieFighter.lastFireTime = currentTime;
        }
    }
}

// Update X-Wing HP indicator
function updateXWingHPIndicator() {
    if (xwingHPIndicator) {
        const percentage = Math.max(0, (xwingHP / XWING_MAX_HP) * 100);
        xwingHPIndicator.style.width = `${percentage}%`;
        
        // Update text value
        const hpValue = document.getElementById('xwing-hp-value');
        if (hpValue) {
            hpValue.textContent = `${Math.ceil(percentage)}%`;
        }
        
        // Change color based on HP
        if (percentage < 25) {
            xwingHPIndicator.style.backgroundColor = '#e74c3c'; // Red for low HP
        } else if (percentage < 50) {
            xwingHPIndicator.style.backgroundColor = '#f39c12'; // Orange for medium HP
        } else {
            xwingHPIndicator.style.backgroundColor = '#2ecc71'; // Green for high HP
        }
    }
}

// Check if a laser hits a TIE Fighter
function checkLaserHitTieFighter(laser) {
    for (let i = tieFighters.length - 1; i >= 0; i--) {
        const tieFighter = tieFighters[i];
        
        // Calculate distance from laser to TIE Fighter
        const distance = laser.mesh.position.distanceTo(tieFighter.mesh.position);
        
        // TIE Fighter hit box radius
        const hitBoxRadius = 1.0; // Increased from 0.6 to 1.0
        
        if (distance < hitBoxRadius) {
            // Hit detected!
            
            // Create explosion effect
            createTieFighterExplosion(tieFighter.mesh.position.clone());
            
            // Remove the TIE Fighter
            scene.remove(tieFighter.mesh);
            tieFighters.splice(i, 1);
            
            return true;
        }
    }
    
    return false;
}

// Create TIE Fighter explosion
function createTieFighterExplosion(position) {
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xff5500,
        size: 0.1,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    
    // Create particles with random positions and velocities
    for (let i = 0; i < 50; i++) {
        // Random position within sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = Math.random() * 0.5;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        particlePositions.push(x, y, z);
        
        // Random velocity outward from center
        const speed = 0.02 + Math.random() * 0.04;
        particleVelocities.push(
            x / radius * speed,
            y / radius * speed,
            z / radius * speed
        );
    }
    
    // Set particle positions
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    // Create particle system
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.position.copy(position);
    
    // Add to scene and explosion particles array
    scene.add(particleSystem);
    explosionParticles.push({
        system: particleSystem,
        velocities: particleVelocities,
        lifetime: 60, // shorter lifetime for TIE Fighter explosions
        age: 0
    });
    
    // Add a bright flash at the center
    const explosionLight = new THREE.PointLight(0xffaa00, 2, 3);
    explosionLight.position.copy(position);
    scene.add(explosionLight);
    
    // Fade out the light
    const fadeLight = () => {
        explosionLight.intensity -= 0.2;
        if (explosionLight.intensity > 0) {
            setTimeout(fadeLight, 50);
        } else {
            scene.remove(explosionLight);
        }
    };
    
    fadeLight();
}

// Game over function
function gameOver() {
    // Set game over state
    currentGameState = GAME_STATE.GAME_OVER;
    
    // Stop the death star approach sound
    soundManager.stop('deathStarApproach');
    
    // Stop the background music
    soundManager.stop('showdown');
    
    // Display game over message
    const gameOverMessage = document.createElement('div');
    gameOverMessage.id = 'game-over-message';
    gameOverMessage.innerHTML = 'GAME OVER';
    document.body.appendChild(gameOverMessage);
    
    // Add restart button
    const restartButton = document.createElement('button');
    restartButton.id = 'restart-button';
    restartButton.innerHTML = 'RESTART MISSION';
    restartButton.addEventListener('click', startGame);
    document.body.appendChild(restartButton);
    
    // Stop spawning TIE Fighters
    lastTieFighterSpawnTime = Infinity;
}

// Initialize the application
init(); 