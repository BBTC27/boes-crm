/* Boes & Boes CRM — RFP Pipeline Live Sync add-on
   Injects a read-only nav item + view that fetches pipeline-status.json
   from this repo. Does NOT touch DB, localStorage, or any existing CRM
   function. Safe to remove by deleting this <script> include. */
(function () {
  function addNavItem() {
    var navSection = document.querySelector('#sidebar .nav-section-label:nth-of-type(3)');
    var gmailItem = Array.prototype.find.call(
      document.querySelectorAll('#sidebar .nav-item'),
      function (el) { return el.getAttribute('onclick') === "navigate('gmail')"; }
    );
    if (!gmailItem) return;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('onclick', "navigate('rfp-sync')");
    item.innerHTML = '<span class="nav-icon">\uD83D\uDCE1</span> RFP Pipeline (Live) <span class="nav-badge" id="badge-rfp-sync" style="display:none">0</span>';
    gmailItem.parentNode.insertBefore(item, gmailItem.nextSibling);
  }

  function addView() {
    var content = document.getElementById('content');
    if (!content) return;
    var view = document.createElement('div');
    view.id = 'view-rfp-sync';
    view.className = 'view';
    view.innerHTML =
      '<div class="section-title">\uD83D\uDCE1 RFP Pipeline (Live Sync)</div>' +
      '<div class="card" style="margin-bottom:16px;">' +
        '<div class="card-body">' +
          '<p style="font-size:13px;color:var(--text-muted);margin:0 0 8px 0;">Read-only status feed maintained by Claude during RFP triage &amp; proposal work. Source: <code>pipeline-status.json</code> in this repo. Separate from your Pipeline deals \u2014 does not read or write local deal records.</p>' +
          '<button class="btn btn-outline" onclick="loadRfpSync()">\uD83D\uDD04 Refresh</button>' +
          '<span id="rfp-sync-updated" style="font-size:12px;color:var(--text-muted);margin-left:10px;"></span>' +
        '</div>' +
      '</div>' +
      '<div id="rfp-sync-list"></div>';
    content.appendChild(view);
  }

  window.loadRfpSync = function () {
    var el = document.getElementById('rfp-sync-list');
    if (!el) return;
    el.innerHTML = '<div class="card"><div class="card-body">Loading\u2026</div></div>';
    fetch('https://raw.githubusercontent.com/BBTC27/boes-crm/main/pipeline-status.json?_=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' \u2014 file may not exist yet'); return r.json(); })
      .then(window.renderRfpSync)
      .catch(function (err) {
        el.innerHTML = '<div class="card"><div class="card-body" style="color:var(--danger);">Could not load pipeline-status.json \u2014 ' + err.message + '</div></div>';
      });
  };

  window.renderRfpSync = function (data) {
    var el = document.getElementById('rfp-sync-list');
    if (!el) return;
    var items = (data && data.rfps) || [];
    var updEl = document.getElementById('rfp-sync-updated');
    if (updEl) updEl.textContent = data && data.updatedAt ? ('Last updated: ' + data.updatedAt) : '';
    if (!items.length) { el.innerHTML = '<div class="card"><div class="card-body">No active RFPs in the feed.</div></div>'; return; }
    var tagColors = { Green: '#66CC33', Yellow: '#f59e0b', Red: '#e53935', Black: '#333' };
    el.innerHTML = items.map(function (r) {
      var tagColor = tagColors[r.tag] || '#999';
      return '<div class="card" style="margin-bottom:12px;">' +
        '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<h3>' + (r.name || r.id || 'Untitled RFP') + '</h3>' +
        (r.tag ? '<span style="background:' + tagColor + ';color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">' + r.tag + '</span>' : '') +
        '</div>' +
        '<div class="card-body">' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Stage:</strong> ' + (r.stage || '\u2014') + '</p>' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Decision:</strong> ' + (r.decision || '\u2014') + '</p>' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Deadline:</strong> ' + (r.deadline || '\u2014') + '</p>' +
        (r.notes ? '<p style="margin:0;font-size:13px;color:var(--text-muted);">' + r.notes + '</p>' : '') +
        '</div></div>';
    }).join('');
  };

  // Wrap navigate() so our view participates in the existing nav system
  // without editing navigate() itself.
  function wrapNavigate() {
    if (typeof window.navigate !== 'function' || window.navigate.__rfpSyncWrapped) return;
    var original = window.navigate;
    var wrapped = function (view) {
      original(view);
      if (view === 'rfp-sync') {
        document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
        var el = document.getElementById('view-rfp-sync');
        if (el) el.classList.add('active');
        var titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = 'RFP Pipeline (Live)';
        document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        document.querySelectorAll('.nav-item').forEach(function (n) {
          if (n.getAttribute('onclick') === "navigate('rfp-sync')") n.classList.add('active');
        });
        window.loadRfpSync();
      }
    };
    wrapped.__rfpSyncWrapped = true;
    window.navigate = wrapped;
  }

  document.addEventListener('DOMContentLoaded', function () {
    addNavItem();
    addView();
    wrapNavigate();
  });
  // In case this script loads after DOMContentLoaded already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    addNavItem();
    addView();
    wrapNavigate();
  }
})();
