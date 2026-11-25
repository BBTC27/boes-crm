/* Boes & Boes CRM — RFP Pipeline Live Sync add-on
   Injects a read-only nav item + view that reads the pipeline_status
   table with the signed-in Supabase session (the `sb` client index.html
   creates). Does not read or write local CRM records. Safe to remove by
   deleting this <script> include.

   Writers outside this repo must stop committing pipeline-status.json.
   That file is gitignored. Save the same document ({ updatedAt, rfps })
   with a team-member session:

     sb.from('pipeline_status').upsert(
       { id: 'current', data: feed },
       { onConflict: 'id' }
     )

   Row level security allows select, insert, and update only when
   is_team_member() is true. There is no delete policy. */
(function () {
  function addNavItem() {
    var gmailItem = Array.prototype.find.call(
      document.querySelectorAll('#sidebar .nav-item'),
      function (el) { return el.getAttribute('onclick') === "navigate('gmail')"; }
    );
    if (!gmailItem || document.querySelector(".nav-item[onclick=\"navigate('rfp-sync')\"]")) return;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('onclick', "navigate('rfp-sync')");
    item.innerHTML = '<span class="nav-icon">\uD83D\uDCE1</span> RFP Pipeline (Live) <span class="nav-badge" id="badge-rfp-sync" style="display:none">0</span>';
    gmailItem.parentNode.insertBefore(item, gmailItem.nextSibling);
  }

  function addView() {
    var content = document.getElementById('content');
    if (!content || document.getElementById('view-rfp-sync')) return;
    var view = document.createElement('div');
    view.id = 'view-rfp-sync';
    view.className = 'view';
    view.innerHTML =
      '<div class="section-title">\uD83D\uDCE1 RFP Pipeline (Live Sync)</div>' +
      '<div class="card" style="margin-bottom:16px;">' +
        '<div class="card-body">' +
          '<p style="font-size:13px;color:var(--text-muted);margin:0 0 8px 0;">Read-only status feed for RFP triage and proposal work. Loaded from Supabase with your signed-in session. Separate from your Pipeline deals \u2014 does not read or write local deal records.</p>' +
          '<button class="btn btn-outline" onclick="loadRfpSync()">\uD83D\uDD04 Refresh</button>' +
          '<span id="rfp-sync-updated" style="font-size:12px;color:var(--text-muted);margin-left:10px;"></span>' +
        '</div>' +
      '</div>' +
      '<div id="rfp-sync-list"></div>';
    content.appendChild(view);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showRfpNote(message, isError) {
    var el = document.getElementById('rfp-sync-list');
    if (!el) return;
    var color = isError ? 'var(--danger)' : 'var(--text-muted)';
    el.innerHTML = '<div class="card"><div class="card-body" style="color:' + color + ';">' + esc(message) + '</div></div>';
    var upd = document.getElementById('rfp-sync-updated');
    if (upd) upd.textContent = '';
  }

  function rfpFeedError(err) {
    var code = err && (err.code || '');
    var msg = (err && (err.message || err.details || err.hint)) || 'Unknown error';
    var text = String(msg);
    if (code === 'PGRST205' || code === '42P01' || code === 'PGRST204' || /schema cache/i.test(text) || /does not exist/i.test(text) || /Could not find the table/i.test(text)) {
      return {
        message: 'The RFP pipeline feed is not available yet. The pipeline_status table is missing. Run the SQL migration in the Supabase SQL editor, then save the feed into that table.',
        error: false
      };
    }
    if (code === 'PGRST301' || code === 401 || /JWT/i.test(text) || /not authenticated/i.test(text)) {
      return { message: 'Sign in to view the RFP pipeline.', error: false };
    }
    return { message: 'Could not load the RFP pipeline feed. ' + text, error: true };
  }

  function rfpClient() {
    if (typeof sb !== 'undefined' && sb && typeof sb.from === 'function' && sb.auth) return sb;
    return null;
  }

  window.loadRfpSync = function () {
    var el = document.getElementById('rfp-sync-list');
    if (!el) return;
    el.innerHTML = '<div class="card"><div class="card-body">Loading\u2026</div></div>';
    var client = rfpClient();
    if (!client) {
      showRfpNote('Sign in to view the RFP pipeline.', false);
      return;
    }
    client.auth.getSession().then(function (res) {
      if (res && res.error) throw res.error;
      var session = res && res.data && res.data.session;
      if (!session) {
        showRfpNote('Sign in to view the RFP pipeline.', false);
        return null;
      }
      return client.from('pipeline_status').select('id, data, updated_at').eq('id', 'current').maybeSingle();
    }).then(function (res) {
      if (!res) return;
      if (res.error) {
        var info = rfpFeedError(res.error);
        showRfpNote(info.message, info.error);
        return;
      }
      var raw = res.data && res.data.data;
      if (raw == null || raw === '') {
        showRfpNote('The RFP pipeline feed is empty, or this sign-in is not a team member. A team member needs to save the current feed into Supabase.', false);
        return;
      }
      var feed = raw;
      if (typeof feed === 'string') {
        try { feed = JSON.parse(feed); }
        catch (e) {
          showRfpNote('The RFP pipeline feed is stored in an unexpected format.', true);
          return;
        }
      }
      if (!feed || typeof feed !== 'object') {
        showRfpNote('The RFP pipeline feed is empty, or this sign-in is not a team member. A team member needs to save the current feed into Supabase.', false);
        return;
      }
      window.renderRfpSync(feed);
    }).catch(function (err) {
      var info = rfpFeedError(err);
      showRfpNote(info.message, info.error);
    });
  };

  window.renderRfpSync = function (data) {
    var el = document.getElementById('rfp-sync-list');
    if (!el) return;
    var items = (data && data.rfps) || [];
    var updEl = document.getElementById('rfp-sync-updated');
    if (updEl) updEl.textContent = data && data.updatedAt ? ('Last updated: ' + data.updatedAt) : '';
    if (!items.length) {
      el.innerHTML = '<div class="card"><div class="card-body">No active RFPs in the feed.</div></div>';
      return;
    }
    var tagColors = { Green: '#66CC33', Yellow: '#f59e0b', Red: '#e53935', Black: '#333' };
    el.innerHTML = items.map(function (r) {
      var tagColor = tagColors[r.tag] || '#999';
      return '<div class="card" style="margin-bottom:12px;">' +
        '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<h3>' + esc(r.name || r.id || 'Untitled RFP') + '</h3>' +
        (r.tag ? '<span style="background:' + tagColor + ';color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">' + esc(r.tag) + '</span>' : '') +
        '</div>' +
        '<div class="card-body">' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Stage:</strong> ' + esc(r.stage || '\u2014') + '</p>' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Decision:</strong> ' + esc(r.decision || '\u2014') + '</p>' +
        '<p style="margin:0 0 6px 0;font-size:13px;"><strong>Deadline:</strong> ' + esc(r.deadline || '\u2014') + '</p>' +
        (r.notes ? '<p style="margin:0;font-size:13px;color:var(--text-muted);">' + esc(r.notes) + '</p>' : '') +
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

  function bootRfpSync() {
    addNavItem();
    addView();
    wrapNavigate();
  }

  document.addEventListener('DOMContentLoaded', bootRfpSync);
  // In case this script loads after DOMContentLoaded already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootRfpSync();
  }
})();
