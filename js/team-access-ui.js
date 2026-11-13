/* NXT | Team & Zugänge: secure, server-backed admin UI for Supabase Auth invitations.
 * No service/secret key is used here. All admin actions call the authenticated Edge Function.
 */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmt = v => {if (!v) return '–'; const d = new Date(v);return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('de-DE', { year:'numeric', month:'2-digit', day:'2-digit' });};
  let host = null, context = null, members = [], activity = [];
  let currentUserId = '', inviteResult = null, loading = true, busy = false, errorText = '', deleteTargetId = null, successText = '';

  function renderShell() {
    return '<section class="nxt-team" id="nxt-team-access" aria-label="Teammitglieder und Zugänge">'+
      '<div class="panel"><div class="panel-inner"><p class="muted">Teamverwaltung wird geladen …</p></div></div></section>';
  }
  function roleLabel(role) { return role === 'admin' ? 'Administrator' : 'Interviewer'; }
  function renderMember(member) {
    const isSelf = member.user_id === currentUserId;
    return `<tr><td><div class="nxt-team-user"><strong>${esc(member.display_name)}</strong><small>${esc(member.email || 'E-Mail nicht verfügbar')}</small></div></td>
      <td><select class="nxt-team-role-select" aria-label="Rolle von ${esc(member.display_name)}" data-team-role="${esc(member.user_id)}" ${isSelf || busy ? 'disabled' : ''}>
        <option value="interviewer" ${member.role !== 'admin' ? 'selected' : ''}>Interviewer</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Administrator</option></select></td>
      <td><span class="pill ${member.active ? 'green' : 'gray'}">${member.active ? 'Aktiv' : 'Deaktiviert'}</span>${!member.email_confirmed ? '<small class="nxt-team-state-note">Einladung noch nicht angenommen</small>' : ''}</td>
      <td>${fmt(member.last_sign_in_at)}</td><td><div class="nxt-team-row-actions"><button type="button" class="btn btn-sm ${member.active ? 'btn-light' : 'btn-primary'}" data-team-action="toggle-active" data-user="${esc(member.user_id)}" ${isSelf || busy ? 'disabled' : ''}>${member.active ? 'Deaktivieren' : 'Aktivieren'}</button><button type="button" class="btn btn-sm nxt-team-delete-button" data-team-action="prepare-delete" data-user="${esc(member.user_id)}" ${isSelf || busy || !member.email ? 'disabled' : ''} title="Anmeldung endgültig entfernen; später erneut einladbar">Löschen</button></div></td></tr>`;
  }
  function render() {
    if (!host) return;
    const enabled = members.filter(m => m.active).length;
    const deletingMember = members.find(m => m.user_id === deleteTargetId && m.user_id !== currentUserId);
    const deleteDialog = deletingMember ? `<div class="nxt-team-delete-backdrop"><section class="nxt-team-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="nxt-delete-title">
      <h2 id="nxt-delete-title">Teamzugang endgültig löschen?</h2>
      <p>Der persönliche Login von <strong>${esc(deletingMember.display_name)}</strong> wird aus Supabase Auth entfernt. Danach kannst du <strong>${esc(deletingMember.email)}</strong> erneut einladen.</p>
      <p class="nxt-team-delete-safe">Die 39 Forschungspersonen, bereits erfasste Interviews und Netzwerkdaten werden dabei nicht gelöscht.</p>
      <form id="nxt-team-delete-form"><input type="hidden" name="user_id" value="${esc(deletingMember.user_id)}">
        <div class="field"><label for="nxt-delete-email">Zur Bestätigung die vollständige E-Mail-Adresse eingeben:</label><input id="nxt-delete-email" type="text" name="confirm_email" autocomplete="off" spellcheck="false" placeholder="${esc(deletingMember.email)}" required></div>
        ${errorText ? `<p class="form-error" role="alert">${esc(errorText)}</p>` : ''}
        <div class="nxt-team-delete-actions"><button type="button" class="btn btn-light" data-team-action="cancel-delete" ${busy?'disabled':''}>Abbrechen</button><button type="submit" class="btn nxt-team-delete-confirm" ${busy?'disabled':''}>${busy?'Lösche Zugang …':'Benutzerkonto endgültig löschen'}</button></div>
      </form></section></div>` : '';
    const result = inviteResult ? `<div class="nxt-team-invite-result" role="status"><strong>${inviteResult.status === 'existing' ? 'Bestehender Zugang freigeschaltet' : 'Einladung erstellt'}</strong>
      <p>${esc(inviteResult.message || '')}</p>
      ${inviteResult.invite_link ? `<div class="nxt-team-link-row"><input readonly id="nxt-team-invite-link" aria-label="Einmaliger Einladungslink" type="text" value="${esc(inviteResult.invite_link)}"><button type="button" class="btn btn-primary btn-sm" data-team-action="copy-invite">Link kopieren</button></div><small>Der Link enthält einen einmaligen Zugangscode. Bitte nur der eingeladenen Person über einen sicheren Kanal (z. B. Microsoft Teams) senden. Er läuft nach der Auth-Einladungsfrist ab.</small>` : ''}
    </div>` : '';
    host.innerHTML = `<div class="nxt-team-grid"><section class="panel"><div class="panel-inner"><div class="panel-head"><div><h2>Neues Gruppenmitglied einladen</h2><small>Persönlicher Zugang über E-Mail und selbst gewähltes Passwort</small></div><span class="pill green">Admin</span></div>
      <form id="nxt-team-invite-form" class="nxt-team-invite-form"><div class="field"><label for="team-display-name">Name des Gruppenmitglieds</label><input id="team-display-name" name="display_name" placeholder="Vorname Nachname" autocomplete="off" minlength="2" maxlength="100" required></div>
        <div class="field"><label for="team-invite-email">E-Mail-Adresse</label><input id="team-invite-email" name="email" type="email" placeholder="vorname.nachname@reutlingen-university.de" autocomplete="off" maxlength="254" required></div>
        <div class="field"><label for="team-invite-role">Rolle</label><select id="team-invite-role" name="role"><option value="interviewer" selected>Interviewer (empfohlen)</option><option value="admin">Administrator</option></select></div>
        <button type="submit" class="btn btn-primary" ${busy ? 'disabled' : ''}>${busy ? 'Wird erstellt …' : 'Einladungslink erstellen'}</button></form>
      <p class="nxt-team-hint">Es wird kein gemeinsames Passwort vergeben. Neue Teammitglieder öffnen den Einladungslink, setzen ein eigenes Passwort und melden sich danach mit ihrer E-Mail an. <strong>Administratoren</strong> dürfen zusätzlich Benutzer und Interviews verwalten.</p>
      ${result}</div></section>
      <section class="panel"><div class="panel-inner"><div class="panel-head"><div><h2>Teamübersicht</h2><small>${loading ? 'Lade Team …' : `${enabled} aktive von ${members.length} Zugängen`}</small></div><button type="button" class="btn btn-light btn-sm" data-team-action="refresh" ${loading ? 'disabled' : ''}>Aktualisieren</button></div>
      ${errorText && !deletingMember ? `<div class="form-error" role="alert">${esc(errorText)}</div>` : ''}
      ${successText ? `<div class="nxt-team-delete-success" role="status">${esc(successText)}</div>` : ''}
      ${loading ? '<p class="muted">Zugänge werden sicher geladen …</p>' : members.length ? `<div class="table-wrap"><table class="data-table nxt-team-table"><thead><tr><th>Person / E-Mail</th><th>Rolle</th><th>Status</th><th>Letzter Login</th><th>Aktion</th></tr></thead><tbody>${members.map(renderMember).join('')}</tbody></table></div>` : '<p class="muted">Noch keine Teammitglieder vorhanden.</p>'}
      </div></section></div>
      <div class="panel nxt-team-audit-panel"><div class="panel-inner"><div class="panel-head"><h2>Änderungsprotokoll</h2><small>Die letzten administrativen Aktionen</small></div>
      ${activity.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Zeitpunkt</th><th>E-Mail-Adresse</th><th>Aktion</th></tr></thead><tbody>${activity.map(a => `<tr><td>${fmt(a.created_at)}</td><td>${esc(a.target_email)}</td><td>${esc(a.action === 'invite' ? 'Zugang eingeladen/freigegeben' : a.action === 'set_role' ? 'Rolle geändert' : a.action === 'delete_user' ? 'Benutzerkonto gelöscht' : 'Zugang aktiviert/deaktiviert')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Noch keine Änderungen protokolliert.</p>'}
      <div class="info-note" style="margin-top:16px">Nur aktive Administratoren sehen diese Verwaltung. Deaktivierte Zugänge verlieren durch serverseitige Berechtigungsregeln den Zugriff auf Forschungsdaten. Ein Einladungslink ist nur für die eingeladene Person bestimmt.</div></div></div>${deleteDialog}`;
  }
  async function api(payload) {
    if (!context?.db) throw Error('Keine Verbindung zur Datenbank.');
    const { data: auth, error: sessionError } = await context.db.auth.getSession();
    if (sessionError || !auth?.session?.access_token) throw Error('Bitte erneut anmelden.');
    const { data, error } = await context.db.functions.invoke('team-access', {
      body: payload,
      headers: { Authorization: 'Bearer ' + auth.session.access_token },
    });
    if (error) {
      let message = error.message || 'Serveranfrage fehlgeschlagen.';
      try { const details = await error.context?.json?.(); message = details?.error || message; } catch (_) { /* not JSON */ }
      throw Error(message);
    }
    if (data?.error) throw Error(data.error);
    return data;
  }
  async function refresh() {
    if (!host) return;
    loading = true; errorText = ''; render();
    try {
      const result = await api({ action:'list' });
      members = Array.isArray(result?.members) ? result.members : [];
      activity = Array.isArray(result?.audit) ? result.audit : [];
    } catch (err) { errorText = err?.message || 'Zugänge konnten nicht geladen werden.'; }
    finally { loading = false; render(); }
  }
  async function invite(form) {
    if (busy) return;
    const fd = new FormData(form);
    const display_name = String(fd.get('display_name') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const role = String(fd.get('role') || 'interviewer');
    if (display_name.length < 2 || !email.includes('@')) { errorText = 'Bitte Namen und gültige E-Mail-Adresse angeben.'; render(); return; }
    if (role === 'admin' && !window.confirm('Soll dieses Teammitglied wirklich Administratorrechte erhalten?')) return;
    busy = true; errorText = ''; inviteResult = null; render();
    try {
      inviteResult = await api({ action:'invite', display_name, email, role });
      const result = await api({ action:'list' });
      members = result?.members || []; activity = result?.audit || [];
    } catch (err) { errorText = err?.message || 'Einladung konnte nicht erstellt werden.'; }
    finally { busy = false; loading = false; render(); }
  }
  async function updateAccess(action, userId, value) {
    if (busy || userId === currentUserId) return;
    const member = members.find(m => m.user_id === userId);
    if (!member) return;
    const question = action === 'set_role'
      ? `Rolle von ${member.display_name} wirklich auf ${roleLabel(value)} ändern?`
      : `${member.display_name} ${value ? 'wieder aktivieren' : 'deaktivieren'}?`;
    if (!window.confirm(question)) return;
    busy = true; errorText = ''; render();
    try {
      await api(action === 'set_role' ? { action, user_id:userId, role:value } : { action, user_id:userId, active:value });
      const result = await api({ action:'list' });
      members = result?.members || []; activity = result?.audit || [];
    } catch (err) { errorText = err?.message || 'Änderung konnte nicht gespeichert werden.'; }
    finally { busy = false; render(); }
  }
  async function deleteAccess(form) {
    if (busy) return;
    const fd = new FormData(form);
    const userId = String(fd.get('user_id') || '');
    const email = String(fd.get('confirm_email') || '').trim().toLowerCase();
    const member = members.find(m => m.user_id === userId && userId !== currentUserId);
    if (!member || userId !== deleteTargetId) return;
    if (email !== String(member.email || '').trim().toLowerCase()) {
      errorText = 'Die eingegebene E-Mail-Adresse stimmt nicht überein.';
      render();
      host?.querySelector('#nxt-delete-email')?.focus();
      return;
    }
    busy = true; errorText = ''; successText = ''; render();
    try {
      const outcome = await api({ action:'delete_user', user_id:userId, confirm_email:email });
      deleteTargetId = null;
      inviteResult = null;
      successText = outcome?.message || 'Der Zugang wurde gelöscht und kann erneut eingeladen werden.';
      if (outcome?.audit_warning) successText += ' Hinweis: Der Protokolleintrag konnte nicht gespeichert werden.';
      try {
        const result = await api({ action:'list' });
        members = Array.isArray(result?.members) ? result.members : [];
        activity = Array.isArray(result?.audit) ? result.audit : [];
      } catch (refreshError) { errorText = 'Zugang gelöscht, Teamliste konnte jedoch nicht aktualisiert werden. Bitte aktualisieren.'; }
    } catch (err) { errorText = err?.message || 'Der Zugang konnte nicht gelöscht werden.'; }
    finally { busy = false; loading = false; render(); }
  }
  async function copyInvite() {
    if (!inviteResult?.invite_link) return;
    try {
      await navigator.clipboard.writeText(inviteResult.invite_link);
      const button = host?.querySelector('[data-team-action="copy-invite"]');
      if (button) button.textContent = 'Kopiert!';
    } catch (_) {
      const field = host?.querySelector('#nxt-team-invite-link');
      field?.select();
      window.alert('Einladungslink markieren und mit Strg+C kopieren.');
    }
  }
  function mount(element, ctx) {
    if (!element || !ctx?.db) return;
    host = element; context = ctx; currentUserId = ctx.currentUserId || '';
    inviteResult = null; errorText = ''; members = []; activity = []; loading = true; busy = false; deleteTargetId = null; successText = '';
    element.addEventListener('submit', event => {
      if (event.target?.id === 'nxt-team-delete-form') { event.preventDefault(); void deleteAccess(event.target); return; }
      if (event.target?.id !== 'nxt-team-invite-form') return;
      event.preventDefault(); void invite(event.target);
    });
    element.addEventListener('click', event => {
      const control = event.target.closest('[data-team-action]');
      if (!control || !element.contains(control)) return;
      const action = control.dataset.teamAction;
      if (action === 'refresh') { void refresh(); return; }
      if (action === 'copy-invite') { void copyInvite(); return; }
      if (action === 'prepare-delete') {
        const member = members.find(m => m.user_id === control.dataset.user);
        if (!member || busy || member.user_id === currentUserId || !member.email) return;
        deleteTargetId = member.user_id; errorText = ''; successText = ''; render();
        element.querySelector('#nxt-delete-email')?.focus();
        return;
      }
      if (action === 'cancel-delete' && !busy) { deleteTargetId = null; errorText = ''; render(); return; }
      if (action === 'toggle-active') {
        const member = members.find(m => m.user_id === control.dataset.user);
        if (member) void updateAccess('set_active', member.user_id, !member.active);
      }
    });
    element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && deleteTargetId && !busy) {
        deleteTargetId = null; errorText = ''; render();
      }
    });
    element.addEventListener('change', event => {
      const el = event.target.closest('[data-team-role]');
      if (!el || !element.contains(el)) return;
      const userId = el.dataset.teamRole;
      const member = members.find(m => m.user_id === userId);
      if (!member || member.role === el.value) return;
      void updateAccess('set_role', userId, el.value);
      el.value = member.role;
    });
    void refresh();
  }
  async function acceptInvite(db) {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hash.get('nxt_invite');
    if (!token) return null;
    // Fragments do not reach GitHub Pages servers. Clear them before making API calls.
    try { window.history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch (_) { window.location.hash = ''; }
    const { data, error } = await db.auth.verifyOtp({ token_hash:token, type:'invite' });
    if (error || !data?.user) throw Error('Der Einladungslink ist ungültig oder abgelaufen. Bitte einen neuen Einladungslink anfordern.');
    return { user:data.user };
  }
  function renderPasswordScreen(user, error = '') {
    return `<div class="auth-screen"><div class="auth-visual"><img class="brand-logo" src="./assets/nxt-logo.png" alt="NXT Hochschule Reutlingen"><div><span class="auth-tag">NXT | Netzwerkforschung</span><h1 class="auth-title">Dein Zugang.<br><span>Dein Passwort.</span></h1><p class="auth-sub">Du wurdest zur gemeinsamen Interviewerfassung eingeladen. Erstelle jetzt ein eigenes Passwort für deine E-Mail-Adresse.</p></div><small class="auth-foot">NXT | REUTLINGEN UNIVERSITY</small></div>
      <div class="auth-right"><div class="auth-card"><span class="auth-tag">Einladung angenommen</span><h2>Passwort festlegen</h2><p>Angemeldete E-Mail: <strong>${esc(user?.email || '')}</strong></p>
      <form id="nxt-team-password-form"><div class="field"><label for="nxt-new-password">Neues Passwort (mindestens 12 Zeichen)</label><input type="password" id="nxt-new-password" name="password" autocomplete="new-password" minlength="12" required></div>
      <div class="field"><label for="nxt-confirm-password">Passwort wiederholen</label><input type="password" id="nxt-confirm-password" name="confirm" autocomplete="new-password" minlength="12" required></div>
      ${error ? `<div class="form-error">${esc(error)}</div>` : ''}<button class="btn btn-primary" type="submit">Passwort speichern und anmelden</button></form>
      <div class="info-note">Das Passwort ist nur für dein persönliches Konto. Teile es nicht mit anderen Teammitgliedern.</div></div></div></div>`;
  }
  function mountPasswordForm(root, {db, user, onSuccess}) {
    const form = root?.querySelector('#nxt-team-password-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const password = String(form.querySelector('#nxt-new-password')?.value || '');
      const repeat = String(form.querySelector('#nxt-confirm-password')?.value || '');
      if (password.length < 12 || password !== repeat) {
        root.innerHTML = renderPasswordScreen(user, 'Das Passwort muss mindestens 12 Zeichen haben und in beiden Feldern übereinstimmen.');
        mountPasswordForm(root,{db,user,onSuccess}); return;
      }
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Wird gespeichert …'; }
      try {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        await onSuccess();
      } catch (err) {
        root.innerHTML = renderPasswordScreen(user, err?.message || 'Passwort konnte nicht gespeichert werden.');
        mountPasswordForm(root,{db,user,onSuccess});
      }
    });
    form.querySelector('#nxt-new-password')?.focus();
  }
  window.NXTTeamAccess = Object.freeze({ renderShell, mount, acceptInvite, renderPasswordScreen, mountPasswordForm });
})();