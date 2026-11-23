'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = (filename) => fs.readFileSync(path.join(root, 'js', filename), 'utf8');
let saved = new Map();
const ctx = {
  window: {
    localStorage: {getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
    dispatchEvent:()=>{},
    confirm:()=>true,
    alert:()=>{}
  },
  document: { readyState:'loading', addEventListener:()=>{}, body:null },
  CustomEvent: class CustomEvent { constructor(type,options){ this.type=type;this.detail=options.detail; } },
  MutationObserver: class MutationObserver {},
  NodeFilter: {SHOW_TEXT:4},
  Promise
};
vm.createContext(ctx);
vm.runInContext(source('i18n-en.js'),ctx,{filename:'i18n-en.js'});
vm.runInContext(source('i18n.js'),ctx,{filename:'i18n.js'});
const api=ctx.window.NXT_I18N;
assert.equal(api.getLanguage(),'de','German must be the default language');
assert.match(api.selector(),/data-nxt-language/);
for(const [de,en] of [
  ['Zentral verbunden','Connected to central database'],
  ['Personen','People'],
  ['Einstellungen','Settings'],
  ['Wie bewerten Sie die Anzahl der Orte für spontane Begegnungen an der Fakultät?','How would you rate the availability of places for spontaneous encounters within the school?'],
  ['Sehr schlecht','Very bad'],
  ['Sehr gut','Very good'],
  ['Interview zurücksetzen','Reset interview'],
  ['Team & Zugänge','Team & Access'],
  ['Geografische Ebene','Geographic Layer'],
  ['Mitarbeiterzahlen pro Gebäude','Employee counts by building'],
  ['5 von 38 Beziehungen markiert','5 of 38 relationships selected'],
  ['Bau 16','Building 16'],
  ['5 offene Interviews', '5 offene Interviews'] // unknown strings remain unchanged
]){
  assert.equal(api.translate(de),en,`English translation missing: ${de}`);
}
const src='  Bitte auswählen  ';
assert.equal(api.translate(src),'  Please select  ','surrounding whitespace preserved');
assert.equal(api.translate('Max Musterfrau'),'Max Musterfrau','personal data must remain unchanged');
api.setLanguage('en');
assert.equal(api.getLanguage(),'en');
assert.equal(saved.get('nxt.networkforschung.language.v1'),'en');
api.setLanguage('de');
assert.equal(api.getLanguage(),'de');
assert.equal(saved.get('nxt.networkforschung.language.v1'),'de');
console.log('PASS: German default, 12 English translations, live UI patterns, privacy-safe text, local choice.');