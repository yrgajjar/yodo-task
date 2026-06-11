const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

// Port Vite runs on
const VITE_PORT = 5173;
let viteProcess = null;
let electronProcess = null;

function checkViteReady(callback) {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  
  socket.connect(VITE_PORT, '127.0.0.1');
}

function startVite() {
  console.log('Starting Vite development server...');
  
  // Determine command path for cross platform
  const isWin = process.platform === 'win32';
  const viteCmd = isWin ? 'npx.cmd' : 'npx';
  
  viteProcess = spawn(viteCmd, ['vite'], {
    stdio: 'pipe',
    shell: true
  });

  viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Vite] ${output.trim()}`);
  });

  viteProcess.stderr.on('data', (data) => {
    console.error(`[Vite Error] ${data.toString().trim()}`);
  });

  // Periodically check if Vite port is open
  const interval = setInterval(() => {
    checkViteReady((ready) => {
      if (ready) {
        clearInterval(interval);
        console.log('Vite is ready. Launching Electron...');
        startElectron();
      }
    });
  }, 500);
}

function startElectron() {
  const isWin = process.platform === 'win32';
  const electronCmd = isWin ? 'npx.cmd' : 'npx';
  
  electronProcess = spawn(electronCmd, ['electron', '.'], {
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('close', (code) => {
    console.log(`Electron closed with code ${code}. Stopping Vite...`);
    cleanup();
  });
}

function cleanup() {
  if (viteProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', viteProcess.pid, '/f', '/t']);
      } else {
        viteProcess.kill('SIGINT');
      }
    } catch (err) {
      console.error('Failed to terminate Vite process:', err);
    }
  }
  process.exit(0);
}

// Handle parent exit signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startVite();
