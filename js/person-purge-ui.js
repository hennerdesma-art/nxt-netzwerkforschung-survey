(function setupPersonPurgeModule(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val=v=>Math.max(0,Number(v)||0);
  async function open({personId,people,role,db,host,onDeleted,onError,onSuccess}){
    if(role!=='admin'){onError?.('Nur Administratoren dürfen Forschungspersonen löschen.');return;}
    const person=(people||[]).find(p=>p.id===personId);
    if(!person||!host||!db){onError?.('Forschungsperson nicht gefunden. Bitte Daten neu laden.');return;}
    let preview;
    try{
      const {data,error}=await db.rpc('preview_person_purge',{p_person_id:person.id});
      if(error)throw error;
      if(!data||data.person_id!==person.id||data.person_code!==person.code||data.full_name!==person.full_name)
        throw Error('Die Personendaten haben sich verändert. Bitte Seite aktualisieren.');
      preview=data;
    }catch(e){onError?.('Löschvorschau fehlgeschlagen: '+(e.message||String(e)));return;}
    const counts=[
      ['Eigene Interviews',preview.own_interviews],
      ['Eigene Antworten',preview.own_answers],
      ['Alle betroffenen Netzwerkkanten',preview.directed_edges],
      ['Davon Nennungen durch Dritte',preview.incoming_edges],
      ['Eigene Ortsdaten',preview.locations],
      ['Antwortfelder Dritter mit Namens-/ID-Bezug',preview.other_answers],
      ['Weitere Freitextfelder mit Bezug',preview.other_note_rows],
      ['Alte personenbezogene Reset-Protokolle',preview.old_reset_audits]
    ];
    host.innerHTML=`<div class="modal-backdrop"><div class="modal modal-wide nxt-purge-modal" role="dialog" aria-modal="true" aria-labelledby="nxt-purge-title">
      <div class="modal-head"><h2 id="nxt-purge-title">Forschungsperson vollständig löschen</h2><button type="button" class="icon-button" data-person-purge-action="cancel" aria-label="Schließen">×</button></div>
      <div class="modal-body">
        <div class="notice-box warn"><span><strong>${esc(person.full_name)} (${esc(person.code)})</strong> wird aus der aktiven Forschungsdatenbank gelöscht. Dieser Vorgang ist nicht rückgängig zu machen.</span></div>
        <p style="margin:16px 0 10px"><strong>Vorschau der betroffenen Datensätze</strong></p>
        <div class="table-wrap"><table class="data-table"><tbody>${counts.map(([name,count])=>`<tr><td>${esc(name)}</td><td style="text-align:right"><strong>${val(count)}</strong></td></tr>`).join('')}</tbody></table></div>
        <p style="font-size:12px;line-height:1.6;margin:14px 0">Die Interviews der anderen Personen bleiben bestehen, aber alle Kanten zur gelöschten Person und erkennbare Erwähnungen in Freitexten werden entfernt. Bereits exportierte Excel-Dateien und externe Backups werden nicht automatisch bereinigt.</p>
        <div class="field"><label for="nxt-purge-code">Personen-ID eingeben: <strong>${esc(person.code)}</strong></label><input id="nxt-purge-code" type="text" autocomplete="off" spellcheck="false" maxlength="40" placeholder="${esc(person.code)}"></div>
        <div class="field" style="margin-top:12px"><label for="nxt-purge-name">Vollständigen Namen eingeben: <strong>${esc(person.full_name)}</strong></label><input id="nxt-purge-name" type="text" autocomplete="off" spellcheck="false" maxlength="200"></div>
        <label class="q-toggle" style="margin-top:15px"><input id="nxt-purge-agree" type="checkbox"><span><strong>Ich bestätige die dauerhafte Löschung dieser Person, ihrer Angaben und aller im System erkannten Nennungen durch Dritte.</strong></span></label>
        <div class="form-error" id="nxt-purge-error" role="alert" hidden></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-light" data-person-purge-action="cancel">Abbrechen</button><button type="button" class="btn btn-danger" id="nxt-purge-confirm" data-person-purge-action="confirm" disabled>Person endgültig löschen</button></div>
    </div></div>`;
    const modal=host.querySelector('.nxt-purge-modal'),code=modal?.querySelector('#nxt-purge-code'),name=modal?.querySelector('#nxt-purge-name'),agree=modal?.querySelector('#nxt-purge-agree'),confirm=modal?.querySelector('#nxt-purge-confirm'),errorBox=modal?.querySelector('#nxt-purge-error');
    if(!modal||!code||!name||!agree||!confirm){onError?.('Löschdialog konnte nicht geladen werden.');return;}
    let busy=false;
    const controller=new AbortController();
    const close=()=>{if(busy)return;controller.abort();if(host.contains(modal))host.innerHTML='';};
    const update=()=>{confirm.disabled=busy||!(code.value.trim()===person.code&&name.value.trim()===person.full_name&&agree.checked);};
    modal.addEventListener('input',update,{signal:controller.signal});
    modal.addEventListener('change',update,{signal:controller.signal});
    modal.addEventListener('click',async event=>{
      const button=event.target.closest('[data-person-purge-action]');
      if(!button)return;
      if(button.dataset.personPurgeAction==='cancel'){close();return;}
      if(button.dataset.personPurgeAction!=='confirm'||confirm.disabled||busy)return;
      update();if(confirm.disabled)return;
      busy=true;confirm.disabled=true;confirm.textContent='Löschung wird geprüft …';
      errorBox.hidden=true;
      try{
        const {data,error}=await db.rpc('purge_person_record',{
          p_person_id:person.id,p_confirm_code:code.value.trim(),p_confirm_name:name.value.trim()
        });
        if(error)throw error;
        if(data?.deleted!==true)throw Error('Die Datenbank hat keine erfolgreiche Löschung bestätigt.');
        busy=false;close();
        let refreshWarning='';
        try { await onDeleted?.(data); }
        catch (refreshError) { refreshWarning=' Die Anzeige konnte nicht aktualisiert werden. Bitte Seite neu laden.'; }
        onSuccess?.('Person endgültig gelöscht. '+val(data.directed_edges)+' Netzwerkbeziehungen und '+val(data.other_answers)+' fremde Antwortfelder entfernt.'+refreshWarning);
      }catch(e){
        busy=false;confirm.textContent='Person endgültig löschen';update();
        errorBox.textContent='Löschung fehlgeschlagen: '+(e.message||String(e));errorBox.hidden=false;
      }
    },{signal:controller.signal});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}},{signal:controller.signal});
    code.focus();
  }
  window.NXTPersonPurge=Object.freeze({open});
})();
