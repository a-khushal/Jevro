import { timingSafeEqual } from "crypto";
import { Request, Response, Router } from "express";
import { ADMIN_UI_PASSWORD, ADMIN_UI_USERNAME } from "../config";

function secureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function isAuthorized(req: Request): boolean {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Basic ")) {
    return false;
  }

  const encoded = header.slice("Basic ".length).trim();
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) {
    return false;
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return secureEquals(username, ADMIN_UI_USERNAME) && secureEquals(password, ADMIN_UI_PASSWORD);
}

function unauthorized(res: Response): void {
  res.setHeader("www-authenticate", 'Basic realm="admin"');
  res.status(401).send("Authentication required");
}

const adminHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Control Console</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f3efe6;
      --panel: #fffdf8;
      --ink: #17120f;
      --muted: #6f645a;
      --accent: #006d5b;
      --accent-2: #c9692a;
      --line: #d7ccbd;
      --ok: #1e7f49;
      --bad: #a02623;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 10% 20%, rgba(201, 105, 42, 0.20), transparent 35%),
        radial-gradient(circle at 85% 10%, rgba(0, 109, 91, 0.20), transparent 40%),
        linear-gradient(145deg, #f8f4ec, var(--bg));
      min-height: 100vh;
    }
    .page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 60px; }
    .header {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 18px;
      padding: 18px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 8px 24px rgba(23, 18, 15, 0.08);
    }
    .title { margin: 0; font-size: 1.4rem; letter-spacing: 0.02em; }
    .sub { margin: 4px 0 0; color: var(--muted); font-size: 0.95rem; }
    .tenant {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .mono { font-family: "IBM Plex Mono", monospace; }
    input, select, button, textarea {
      font: inherit;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      background: #fff;
      color: var(--ink);
    }
    textarea { width: 100%; min-height: 74px; }
    button {
      cursor: pointer;
      border: none;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
      transition: transform 120ms ease, filter 120ms ease;
    }
    button:hover { transform: translateY(-1px); filter: brightness(1.06); }
    .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
    .tab { border: 1px solid var(--line); background: rgba(255,255,255,0.65); color: var(--ink); }
    .tab.active { background: var(--accent-2); color: #fff; border-color: transparent; }
    .panel {
      margin-top: 14px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      padding: 16px;
      box-shadow: 0 10px 28px rgba(23, 18, 15, 0.08);
      display: none;
    }
    .panel.active { display: block; }
    .grid { display: grid; gap: 12px; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .list {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 8px; vertical-align: top; }
    th { background: rgba(201, 105, 42, 0.08); }
    .status { margin-top: 10px; font-size: 0.9rem; color: var(--muted); }
    .status.ok { color: var(--ok); }
    .status.bad { color: var(--bad); }
    .pill { font-family: "IBM Plex Mono", monospace; font-size: 0.75rem; padding: 3px 6px; border-radius: 6px; background: rgba(0,109,91,0.08); }
    @media (max-width: 760px) {
      .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .header { padding: 14px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <h1 class="title">Agent Access Control Console</h1>
        <p class="sub">Manage agents, policies, approvals, and audit timeline from one panel.</p>
      </div>
      <div class="tenant">
        <label for="tenantId" class="mono">tenantId</label>
        <input id="tenantId" class="mono" value="acme" />
        <button id="refreshAll" type="button">Refresh</button>
      </div>
    </section>

    <div class="tabs">
      <button type="button" class="tab active" data-panel="agents">Agents</button>
      <button type="button" class="tab" data-panel="policies">Policies</button>
      <button type="button" class="tab" data-panel="approvals">Approvals</button>
      <button type="button" class="tab" data-panel="audit">Audit</button>
    </div>

    <section class="panel active" id="panel-agents">
      <div class="grid two">
        <div>
          <h3>Create agent</h3>
          <div class="row">
            <input id="agentName" placeholder="name" />
            <select id="agentEnv"><option>dev</option><option>staging</option><option selected>prod</option></select>
            <button id="createAgent" type="button">Create</button>
          </div>
        </div>
        <div>
          <h3>Agent inventory</h3>
          <p class="sub">Latest agents for current tenant.</p>
        </div>
      </div>
      <div class="list"><table id="agentsTable"></table></div>
    </section>

    <section class="panel" id="panel-policies">
      <div class="grid two">
        <div>
          <h3>Policy editor</h3>
          <div class="grid">
            <input id="policyAgentId" placeholder="agentId" class="mono" />
            <select id="policyConnector"><option>github</option><option>slack</option><option>jira</option><option>postgres</option></select>
            <input id="policyActions" placeholder="actions (comma-separated)" value="read_pr" />
            <select id="policyEnv"><option>dev</option><option>staging</option><option selected>prod</option></select>
            <select id="policyEffect"><option>allow</option><option>deny</option><option>require_approval</option></select>
            <button id="createPolicy" type="button">Save policy</button>
          </div>
        </div>
        <div>
          <h3>Policy preview</h3>
          <div class="grid">
            <input id="previewAgentId" placeholder="agentId" class="mono" />
            <input id="previewConnector" placeholder="connector" value="github" />
            <input id="previewAction" placeholder="action" value="read_pr" />
            <select id="previewEnv"><option>dev</option><option>staging</option><option selected>prod</option></select>
            <button id="previewPolicy" type="button">Run preview</button>
            <div id="previewResult" class="pill">No preview yet</div>
          </div>
        </div>
      </div>
      <div class="list"><table id="policiesTable"></table></div>
    </section>

    <section class="panel" id="panel-approvals">
      <div class="grid two">
        <div>
          <h3>Approvals queue</h3>
          <div class="row">
            <select id="approvalStatus"><option value="">all</option><option>pending</option><option>approved</option><option>rejected</option><option>consumed</option><option>expired</option></select>
            <button id="refreshApprovals" type="button">Refresh approvals</button>
          </div>
        </div>
        <div>
          <h3>Decision panel</h3>
          <div class="grid">
            <input id="decisionApprovalId" placeholder="approvalId" class="mono" />
            <input id="decisionApproverId" placeholder="approverId" value="sec-lead-1" />
            <select id="decisionValue"><option>approved</option><option>rejected</option></select>
            <button id="submitDecision" type="button">Submit decision</button>
          </div>
        </div>
      </div>
      <div class="list"><table id="approvalsTable"></table></div>
    </section>

    <section class="panel" id="panel-audit">
      <div class="row">
        <input id="auditEventType" placeholder="eventType (optional)" />
        <button id="refreshAudit" type="button">Refresh audit</button>
      </div>
      <div class="list"><table id="auditTable"></table></div>
    </section>

    <div id="status" class="status">Ready</div>
  </main>

  <script>
    const apiBase = '/v1';
    const statusEl = document.getElementById('status');

    function setStatus(message, level) {
      statusEl.textContent = message;
      statusEl.className = 'status' + (level ? ' ' + level : '');
    }

    function tenantId() {
      return document.getElementById('tenantId').value.trim();
    }

    async function api(path, init) {
      const response = await fetch(apiBase + path, {
        headers: { 'content-type': 'application/json' },
        ...init
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body.code || 'HTTP_ERROR') + ': ' + (body.error || response.statusText));
      }
      return body;
    }

    function renderTable(tableId, columns, rows) {
      const table = document.getElementById(tableId);
      const thead = '<thead><tr>' + columns.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows.map((row) => '<tr>' + columns.map((c) => '<td>' + (row[c] ?? '') + '</td>').join('') + '</tr>').join('') + '</tbody>';
      table.innerHTML = thead + tbody;
    }

    async function loadAgents() {
      const result = await api('/agents?tenantId=' + encodeURIComponent(tenantId()), { method: 'GET' });
      renderTable('agentsTable', ['id', 'name', 'environment', 'createdAt'], result.agents || []);
    }

    async function loadPolicies() {
      const result = await api('/policies?tenantId=' + encodeURIComponent(tenantId()), { method: 'GET' });
      const rows = (result.policies || []).map((p) => ({ ...p, actions: Array.isArray(p.actions) ? p.actions.join(', ') : '' }));
      renderTable('policiesTable', ['id', 'agentId', 'connector', 'actions', 'environment', 'effect', 'createdAt'], rows);
    }

    async function loadApprovals() {
      const status = document.getElementById('approvalStatus').value;
      const query = new URLSearchParams({ tenantId: tenantId() });
      if (status) query.set('status', status);
      const result = await api('/approvals?' + query.toString(), { method: 'GET' });
      renderTable('approvalsTable', ['id', 'agentId', 'connector', 'action', 'status', 'requestedAt', 'expiresAt', 'resolvedBy'], result.approvals || []);
    }

    async function loadAudit() {
      const eventType = document.getElementById('auditEventType').value.trim();
      const query = new URLSearchParams({ tenantId: tenantId() });
      if (eventType) query.set('eventType', eventType);
      const result = await api('/audit-events?' + query.toString(), { method: 'GET' });
      const rows = (result.events || []).map((e) => ({ ...e, details: JSON.stringify(e.details || {}) }));
      renderTable('auditTable', ['timestamp', 'eventType', 'agentId', 'connector', 'action', 'status', 'details'], rows);
    }

    async function refreshAll() {
      await Promise.all([loadAgents(), loadPolicies(), loadApprovals(), loadAudit()]);
    }

    document.getElementById('createAgent').addEventListener('click', async () => {
      try {
        await api('/agents', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenantId(),
            name: document.getElementById('agentName').value.trim(),
            environment: document.getElementById('agentEnv').value
          })
        });
        await loadAgents();
        setStatus('Agent created', 'ok');
      } catch (error) {
        setStatus(String(error), 'bad');
      }
    });

    document.getElementById('createPolicy').addEventListener('click', async () => {
      try {
        await api('/policies', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenantId(),
            agentId: document.getElementById('policyAgentId').value.trim(),
            connector: document.getElementById('policyConnector').value,
            actions: document.getElementById('policyActions').value.split(',').map((v) => v.trim()).filter(Boolean),
            environment: document.getElementById('policyEnv').value,
            effect: document.getElementById('policyEffect').value
          })
        });
        await loadPolicies();
        setStatus('Policy saved', 'ok');
      } catch (error) {
        setStatus(String(error), 'bad');
      }
    });

    document.getElementById('previewPolicy').addEventListener('click', async () => {
      try {
        const result = await api('/authorize', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenantId(),
            agentId: document.getElementById('previewAgentId').value.trim(),
            connector: document.getElementById('previewConnector').value.trim(),
            action: document.getElementById('previewAction').value.trim(),
            environment: document.getElementById('previewEnv').value
          })
        });
        document.getElementById('previewResult').textContent = 'Decision: ' + result.decision;
        setStatus('Preview complete', 'ok');
      } catch (error) {
        setStatus(String(error), 'bad');
      }
    });

    document.getElementById('submitDecision').addEventListener('click', async () => {
      try {
        const approvalId = document.getElementById('decisionApprovalId').value.trim();
        await api('/approvals/' + encodeURIComponent(approvalId) + '/decision', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenantId(),
            approverId: document.getElementById('decisionApproverId').value.trim(),
            decision: document.getElementById('decisionValue').value
          })
        });
        await loadApprovals();
        setStatus('Approval decision submitted', 'ok');
      } catch (error) {
        setStatus(String(error), 'bad');
      }
    });

    document.getElementById('refreshApprovals').addEventListener('click', () => loadApprovals().catch((error) => setStatus(String(error), 'bad')));
    document.getElementById('refreshAudit').addEventListener('click', () => loadAudit().catch((error) => setStatus(String(error), 'bad')));
    document.getElementById('refreshAll').addEventListener('click', () => refreshAll().then(() => setStatus('Data refreshed', 'ok')).catch((error) => setStatus(String(error), 'bad')));

    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = btn.getAttribute('data-panel');
        document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + panel).classList.add('active');
      });
    });

    refreshAll().then(() => setStatus('Loaded initial data', 'ok')).catch((error) => setStatus(String(error), 'bad'));
  </script>
</body>
</html>`;

export const adminRouter = Router();

adminRouter.get("/admin", (req, res) => {
  if (!isAuthorized(req)) {
    unauthorized(res);
    return;
  }

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).send(adminHtml);
});
