// --- ROBLOX STUDIO LITE: SCRIPT.JS ---
// Simulating ServerScriptService and LocalScripts

// Game Variables (Workspace Data)
let redBloodCells = 0;
const targetCells = 30;
let timeLeft = 10;
let gameInterval;
let isPlaying = false;

// UI References (StarterGui -> ScreenGui)
const statusText = document.getElementById('status-text');
const scoreLabel = document.getElementById('score');
const timerLabel = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const pumpBtn = document.getElementById('pump-btn');
const statsContainer = document.getElementById('stats-container');

// Event Listeners (Simulating MouseButton1Click / TouchTap)
startBtn.addEventListener('click', startGame);
pumpBtn.addEventListener('click', pumpBlood);

function startGame() {
    // Reset workspace variables
    redBloodCells = 0;
    timeLeft = 10;
    isPlaying = true;
    
    // Update UI
    scoreLabel.innerText = redBloodCells;
    timerLabel.innerText = timeLeft;
    statusText.innerText = "Keep Pumping!";
    
    // Toggle visibility
    startBtn.classList.add('hidden');
    pumpBtn.classList.remove('hidden');
    statsContainer.classList.remove('hidden');
    
    // Start game loop (Simulating RunService.Heartbeat / Wait)
    gameInterval = setInterval(updateTimer, 1000);
}

function pumpBlood() {
    if (!isPlaying) return;
    
    // Add points
    redBloodCells += 1;
    scoreLabel.innerText = redBloodCells;
    
    // Visual feedback for tapping
    pumpBtn.style.backgroundColor = "#ff4d4d";
    setTimeout(() => {
        pumpBtn.style.backgroundColor = "#d71c1c";
    }, 50);
    
    // Check Win Condition
    if (redBloodCells >= targetCells) {
        endGame(true);
    }
}

function updateTimer() {
    if (!isPlaying) return;
    
    timeLeft -= 1;
    timerLabel.innerText = timeLeft;
    
    // Check Lose Condition
    if (timeLeft <= 0) {
        endGame(false);
    }
}

function endGame(didWin) {
    isPlaying = false;
    clearInterval(gameInterval); // Stop loop
    
    // Hide game buttons, show start menu
    pumpBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    startBtn.innerText = "Play Again";
    
    // Update Status
    if (didWin) {
        statusText.innerText = "VICTORY! Body Supplied!";
        statusText.style.color = "#4caf50"; // Green
    } else {
        statusText.innerText = "OUT OF TIME!";
        statusText.style.color = "#ff4d4d"; // Red
    }
    
    // Reset color after a few seconds
    setTimeout(() => {
        statusText.style.color = "#ffffff";
    }, 2000);
}
