const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get([
    'receiverUrl',
    'pairingToken',
    'optedInDomains',
  ]);
  $('receiver').value = cfg.receiverUrl || 'http://127.0.0.1:17654';
  $('token').value = cfg.pairingToken || '';
  $('domains').value = (cfg.optedInDomains || []).join('\n');

  chrome.runtime.sendMessage({ type: 'vopro:getConfig' }, (resp) => {
    if (resp) {
      $('status').textContent = `${resp.queued} events queued · receiver ${resp.cfg.receiverUrl}`;
    }
  });
}

$('save').addEventListener('click', async () => {
  const optedInDomains = $('domains')
    .value.split('\n')
    .map((d) => d.trim())
    .filter(Boolean);
  await chrome.storage.local.set({
    receiverUrl: $('receiver').value.trim() || 'http://127.0.0.1:17654',
    pairingToken: $('token').value.trim(),
    optedInDomains,
  });
  $('status').textContent = 'Saved.';
  $('status').className = 'status ok';
});

$('test').addEventListener('click', async () => {
  const url = $('receiver').value.trim() || 'http://127.0.0.1:17654';
  const token = $('token').value.trim();
  try {
    const res = await fetch(`${url}/pair`, {
      headers: { 'X-Vopro-Token': token },
    });
    if (res.ok) {
      const body = await res.json();
      $('status').textContent = `Paired with device ${body.deviceId.slice(0, 8)}…`;
      $('status').className = 'status ok';
    } else {
      $('status').textContent = `Agent rejected token (${res.status})`;
      $('status').className = 'status err';
    }
  } catch (err) {
    $('status').textContent = `Could not reach agent: ${err.message}`;
    $('status').className = 'status err';
  }
});

void load();
