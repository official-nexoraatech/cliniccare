// Loaded via a data: URL (see main.ts) so no static-asset build step is needed —
// tsc already compiles this file like any other, the HTML just lives in a string.
export const SETUP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: #f3f4f6;
    color: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
  .card {
    width: 440px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: 28px;
  }
  h1 { font-size: 18px; margin: 0 0 4px; color: #0f766e; }
  p.sub { margin: 0 0 20px; font-size: 13px; color: #6b7280; }
  .option {
    width: 100%;
    text-align: left;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
  }
  .option:hover { border-color: #0f766e; background: #f0fdfa; }
  .option strong { display: block; font-size: 14px; color: #111827; margin-bottom: 2px; }
  .option span { font-size: 12px; color: #6b7280; }
  input {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    margin-bottom: 10px;
  }
  .row { display: flex; gap: 8px; }
  button.primary {
    flex: 1;
    background: #0f766e;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
  }
  button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary {
    background: #fff;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
  }
  .error { color: #dc2626; font-size: 12px; margin: -4px 0 10px; min-height: 14px; }
  .hidden { display: none; }
</style>
</head>
<body>
  <div class="card">
    <div id="step-role">
      <h1>ClinicCare Setup</h1>
      <p class="sub">Is this the Host machine or a Client machine?</p>
      <button class="option" id="btn-host">
        <strong>This is the Host</strong>
        <span>Runs the ClinicCare database and server. Keep this PC powered on during clinic hours.</span>
      </button>
      <button class="option" id="btn-client">
        <strong>This is a Client</strong>
        <span>Connects to the Host over your clinic's network.</span>
      </button>
    </div>

    <div id="step-client" class="hidden">
      <h1>Connect to Host</h1>
      <p class="sub">Enter the Host machine's network address (ask whoever set up the Host PC).</p>
      <input id="host-ip" placeholder="e.g. 192.168.1.50" autofocus />
      <p class="error" id="client-error"></p>
      <div class="row">
        <button class="secondary" id="btn-back">Back</button>
        <button class="primary" id="btn-connect">Connect</button>
      </div>
    </div>
  </div>

  <script>
    const stepRole = document.getElementById('step-role');
    const stepClient = document.getElementById('step-client');
    const hostIpInput = document.getElementById('host-ip');
    const clientError = document.getElementById('client-error');
    const connectBtn = document.getElementById('btn-connect');

    document.getElementById('btn-host').addEventListener('click', () => {
      window.clinicCareSetup.chooseHost();
    });

    document.getElementById('btn-client').addEventListener('click', () => {
      stepRole.classList.add('hidden');
      stepClient.classList.remove('hidden');
      hostIpInput.focus();
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      stepClient.classList.add('hidden');
      stepRole.classList.remove('hidden');
      clientError.textContent = '';
    });

    connectBtn.addEventListener('click', async () => {
      const ip = hostIpInput.value.trim();
      if (!ip) {
        clientError.textContent = 'Enter the Host machine\\'s IP address.';
        return;
      }
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';
      clientError.textContent = '';
      const ok = await window.clinicCareSetup.testConnection(ip);
      if (ok) {
        await window.clinicCareSetup.chooseClient(ip);
      } else {
        clientError.textContent = 'Could not reach that address. Check the Host PC is running ClinicCare and both PCs are on the same network.';
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
      }
    });

    hostIpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') connectBtn.click();
    });
  </script>
</body>
</html>`;
