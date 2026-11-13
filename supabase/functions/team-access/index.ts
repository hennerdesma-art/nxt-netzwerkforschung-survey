/**
 * NXT | Team & Zugänge – admin-only access administration.
 * Deploy with verify_jwt=false: we verify the Auth JWT with GoTrue ourselves,
 * then enforce active admin membership server-side before accessing privileged APIs.
 * Credentials are injected by the Edge runtime, NEVER shipped to GitHub Pages.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const APP_URL = 'https://hennerdesma-art.github.io/nxt-netzwerkforschung-survey/';
const ALLOWED_ORIGIN = 'https://hennerdesma-art.github.io';
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
};

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
function fail(message, status = 400, code = 'INVALID_REQUEST') {
  return response({ error: message, code }, status);
}
function tidy(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function isEmail(s) { return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
function getKeys() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
  return {
    url,
    secret: secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    publishable: publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY') || '',
  };
}
async function allUsers(admin) {
  const result = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    result.push(...(data?.users || []));
    if ((data?.users || []).length < 200) break;
  }
  return result;
}
async function logAction(admin, actorId, targetId, email, action, details = {}) {
  const { error } = await admin.from('team_access_audit').insert({
    actor_user_id: actorId,
    target_user_id: targetId,
    target_email: email,
    action,
    details,
  });
  if (error) throw error;
}
async function listMembers(admin) {
  const { data: members, error } = await admin.from('survey_members')
    .select('user_id,display_name,role,active,created_at').order('created_at', { ascending: true });
  if (error) throw error;
  const authUsers = await allUsers(admin);
  const authById = new Map(authUsers.map(u => [u.id, u]));
  return (members || []).map(m => {
    const auth = authById.get(m.user_id);
    return {
      ...m,
      email: auth?.email || '',
      email_confirmed: Boolean(auth?.email_confirmed_at),
      invited_at: auth?.invited_at || null,
      last_sign_in_at: auth?.last_sign_in_at || null,
    };
  });
}
async function guardAdmin(req, admin, publicClient) {
  const header = req.headers.get('Authorization') || '';
  const jwt = /^Bearer\s+(.+)$/i.exec(header)?.[1] || '';
  if (!jwt || jwt.length < 50) return { error: fail('Bitte erneut anmelden.', 401, 'UNAUTHORIZED') };
  const { data: auth, error: authError } = await publicClient.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return { error: fail('Anmeldung ungültig oder abgelaufen.', 401, 'UNAUTHORIZED') };
  const { data: member, error } = await admin.from('survey_members')
    .select('role,active').eq('user_id', auth.user.id).maybeSingle();
  if (error) throw error;
  if (member?.role !== 'admin' || member.active !== true)
    return { error: fail('Diese Funktion ist nur für aktive Administratoren freigegeben.', 403, 'ADMIN_REQUIRED') };
  return { user: auth.user };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const origin = req.headers.get('Origin');
  if (origin && origin !== ALLOWED_ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return fail('Ungültige Herkunft.', 403, 'ORIGIN_DENIED');
  if (req.method !== 'POST') return fail('Nur POST erlaubt.', 405);
  if ((Number(req.headers.get('Content-Length') || 0)) > 4096) return fail('Anfrage zu groß.', 413);

  try {
    const { url, secret, publishable } = getKeys();
    if (!url || !secret || !publishable) return fail('Serverkonfiguration fehlt.', 503, 'MISSING_CONFIGURATION');
    const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
    const admin = createClient(url, secret, options);
    const publicClient = createClient(url, publishable, options);
    const auth = await guardAdmin(req, admin, publicClient);
    if (auth.error) return auth.error;
    const actor = auth.user;

    let body;
    try { body = await req.json(); } catch { return fail('Ungültiges JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Ungültiger Anfragekörper.');
    const action = tidy(body.action, 30);

    if (action === 'list') {
      const members = await listMembers(admin);
      const { data: audits, error: auditError } = await admin.from('team_access_audit')
        .select('actor_user_id,target_email,action,details,created_at')
        .order('created_at', { ascending: false }).limit(20);
      if (auditError) throw auditError;
      return response({ members, audit: audits || [], current_user_id: actor.id });
    }

    if (action === 'invite') {
      const email = tidy(body.email, 255).toLowerCase();
      const displayName = tidy(body.display_name, 100);
      const role = tidy(body.role, 20) || 'interviewer';
      if (!isEmail(email)) return fail('Bitte eine gültige E-Mail-Adresse angeben.');
      if (displayName.length < 2) return fail('Bitte den Namen des Teammitglieds eingeben (mindestens 2 Zeichen).');
      if (!['interviewer','admin'].includes(role)) return fail('Ungültige Rolle.');

      const { count, error: limitError } = await admin.from('team_access_audit')
        .select('id', { count: 'exact', head: true })
        .eq('actor_user_id', actor.id).eq('action', 'invite')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());
      if (limitError) throw limitError;
      if ((count || 0) >= 10) return fail('Zu viele Einladungen. Bitte später erneut versuchen.', 429, 'RATE_LIMIT');

      // Existing accounts can be authorized without creating duplicate Auth users.
      const matching = (await allUsers(admin)).find(u => (u.email || '').toLowerCase() === email);
      if (matching) {
        const { data: already, error: memberError } = await admin.from('survey_members')
          .select('user_id').eq('user_id', matching.id).maybeSingle();
        if (memberError) throw memberError;
        if (already) return fail('Diese E-Mail-Adresse ist bereits als Teamzugang registriert.', 409, 'ALREADY_MEMBER');
        const { error: insertErr } = await admin.from('survey_members').insert({
          user_id: matching.id, display_name: displayName, role, active: true,
        });
        if (insertErr) throw insertErr;
        await logAction(admin, actor.id, matching.id, email, 'invite', { role, existing_account: true });
        return response({ status: 'existing', email, display_name: displayName,
          message: 'Das bestehende Supabase-Konto ist nun für das NXT-Team freigeschaltet. Es kann sich mit seinem bisherigen Passwort anmelden.' });
      }

      // No SMTP provider is required: generate a one-time invite hash, hand its
      // fragment-only link to the admin for secure delivery via Teams etc.
      const { data: generated, error: genErr } = await admin.auth.admin.generateLink({
        type: 'invite', email,
        options: { data: { name: displayName }, redirectTo: APP_URL },
      });
      if (genErr || !generated?.user?.id || !generated?.properties?.hashed_token)
        return fail(genErr?.message || 'Einladungslink konnte nicht erstellt werden.', 502, 'INVITE_FAILED');

      const userId = generated.user.id;
      const { error: membershipError } = await admin.from('survey_members').insert({
        user_id: userId, display_name: displayName, role, active: true,
      });
      if (membershipError) {
        // A newly created Auth user without an active membership should not
        // persist. Never remove an existing Auth user here.
        await admin.auth.admin.deleteUser(userId);
        throw membershipError;
      }
      await logAction(admin, actor.id, userId, email, 'invite', { role, mode: 'copy_link' });
      const inviteLink = APP_URL + '#nxt_invite=' + encodeURIComponent(generated.properties.hashed_token) + '&type=invite';
      return response({ status: 'invited', email, display_name: displayName, role, invite_link: inviteLink,
        message: 'Zugang angelegt. Den einmaligen Einladungslink sicher an das Teammitglied senden. Der Link verfällt nach der Supabase-OTP-Frist (standardmäßig etwa eine Stunde).' });
    }


    if (action === 'delete_user') {
      // Only delete the NXT team account. Interview participants and survey data
      // are separate records and must be preserved.
      const targetId = tidy(body.user_id, 40);
      const confirmEmail = tidy(body.confirm_email, 255).toLowerCase();
      if (!isUuid(targetId)) return fail('Ungültige Benutzer-ID.');
      if (targetId === actor.id)
        return fail('Dein eigenes Administratorkonto kannst du nicht löschen.', 403, 'SELF_DELETE_BLOCKED');

      const { data: target, error: lookupError } = await admin.from('survey_members')
        .select('user_id,display_name,active,role').eq('user_id', targetId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) return fail('Teamzugang nicht gefunden.', 404, 'NOT_FOUND');

      const user = (await allUsers(admin)).find(u => u.id === targetId);
      if (!user?.email) return fail('Zu diesem Teamzugang wurde kein Auth-Benutzer gefunden.', 409, 'AUTH_NOT_FOUND');
      const actualEmail = user.email.trim().toLowerCase();
      if (confirmEmail !== actualEmail)
        return fail('Zur Bestätigung muss die E-Mail-Adresse genau übereinstimmen.', 400, 'EMAIL_MISMATCH');

      if (target.active && target.role === 'admin') {
        const { count, error } = await admin.from('survey_members').select('user_id', { count:'exact', head:true })
          .eq('active', true).eq('role', 'admin');
        if (error) throw error;
        if ((count || 0) <= 1)
          return fail('Der letzte aktive Administrator darf nicht gelöscht werden.', 409, 'LAST_ADMIN');
      }

      // Hard delete (softDelete=false) removes the Auth identity and the
      // survey_members row via ON DELETE CASCADE. The same email can be invited again.
      // The research persons, interviews, answers and network edges remain untouched.
      const { error: deleteError } = await admin.auth.admin.deleteUser(targetId, false);
      if (deleteError) {
        console.error('team-access delete_user:', deleteError.message);
        return fail('Löschen fehlgeschlagen. Prüfe, ob dem Konto noch Supabase-Storage-Objekte zugeordnet sind.', 409, 'DELETE_FAILED');
      }

      // Write audit only after confirmed deletion. The deleted auth.users id
      // cannot be used as a target foreign key; retain only the restricted
      // admin-only audit record with the email and previous role.
      let auditWarning = false;
      try {
        await logAction(admin, actor.id, null, actualEmail, 'delete_user', {
          previous_role: target.role,
          previous_active: target.active,
          account_type: 'team_login',
        });
      } catch (auditError) {
        auditWarning = true;
        console.error('team-access deletion audit:', auditError instanceof Error ? auditError.message : 'Unknown error');
      }
      return response({
        status: 'deleted',
        email: actualEmail,
        message: 'Benutzerkonto endgültig gelöscht. Die E-Mail-Adresse kann jetzt erneut eingeladen werden.',
        audit_warning: auditWarning,
      });
    }

    if (action === 'set_active' || action === 'set_role') {
      const targetId = tidy(body.user_id, 40);
      if (!isUuid(targetId)) return fail('Ungültige Benutzer-ID.');
      if (targetId === actor.id) return fail('Dein eigenes Administratorkonto kannst du hier nicht verändern.', 403, 'SELF_CHANGE_BLOCKED');
      const { data: target, error: lookupError } = await admin.from('survey_members')
        .select('user_id,display_name,active,role').eq('user_id', targetId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) return fail('Zugang nicht gefunden.', 404);
      const patch = {};
      if (action === 'set_active') {
        if (typeof body.active !== 'boolean') return fail('Der Status muss aktiv oder inaktiv sein.');
        patch.active = body.active;
      } else {
        const role = tidy(body.role, 20);
        if (!['interviewer','admin'].includes(role)) return fail('Ungültige Rolle.');
        patch.role = role;
      }
      const wouldRemoveAdmin = target.active && target.role === 'admin' &&
        ((action === 'set_active' && patch.active === false) ||
         (action === 'set_role' && patch.role !== 'admin'));
      if (wouldRemoveAdmin) {
        const { count, error } = await admin.from('survey_members').select('user_id', { count:'exact',head:true })
          .eq('active',true).eq('role','admin');
        if (error) throw error;
        if ((count || 0) <= 1) return fail('Mindestens ein aktiver Administrator muss erhalten bleiben.', 409, 'LAST_ADMIN');
      }
      const { error: updateError } = await admin.from('survey_members').update(patch).eq('user_id', targetId);
      if (updateError) throw updateError;
      const users = await allUsers(admin);
      const targetEmail = (users.find(u => u.id === targetId)?.email || '').toLowerCase();
      await logAction(admin, actor.id, targetId, targetEmail || 'unbekannt', action, {
        previous: { role: target.role, active: target.active }, updated: patch,
      });
      return response({ status: 'updated', user_id: targetId, ...patch });
    }

    return fail('Unbekannte Aktion.', 400);
  } catch (error) {
    console.error('team-access error:', error instanceof Error ? error.message : 'Unknown error');
    return fail('Der Zugriff konnte nicht verarbeitet werden. Bitte die Supabase-Konfiguration und Berechtigungen prüfen.', 500, 'SERVER_ERROR');
  }
});