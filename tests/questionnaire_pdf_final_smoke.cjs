/**
 * Regression checks for the 18 Nov 2026 PDF-final questionnaire.
 * Public code only; do not place real participant lists or interview data here.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(read('js/questionnaire.js'),context,{filename:'js/questionnaire.js'});
vm.runInContext(read('js/config.js'),context,{filename:'js/config.js'});
const Q=context.window.NXT_QUESTIONNAIRE,config=context.window.NXT_CONFIG;
const app=read('js/app.js'),network=read('js/network-tools.js'),campus=read('js/campus-data.js');
const html=read('index.html');
assert.match(Q.version,/PDF final/);
assert.ok(Q.greeting.some(s=>s.includes('maximal 20 Minuten')),'PDF duration');
assert.deepEqual(Array.from(Q.groups),[
 'Professor:in','Wissenschaftliche:r Mitarbeiter:in','Technische:r Mitarbeiter:in','Fakultätsmitarbeiter:in'
]);
assert.equal(Q.categories.length,7,'A2 has a seventh group');
assert.equal(Q.categories[6],'Sonstiges');
assert.equal(Q.questionsA.A3,'Welche Berufsbezeichnung verwenden Sie für sich selbst?');
assert.equal(Q.questionsA['A6.1'],'Falls ja, seit wann?');
assert.equal(Q.b2.length,7,'B2 needs every non-empty combination of three categories');
assert.deepEqual(Array.from(Q.b2.map(o=>o[0])),['F','L','SV','F+L','F+SV','L+SV','F+L+SV']);
assert.match(Q.b_intro,/organisatorischen Selbstverwaltung/);
assert.equal(Q.b7Scale.length,5);
assert.match(Q.b7_question,/fachübergreifende Austausch/);
for(const c of ['C9','C10','C11','C12','C13']){
 assert.ok(Q.questionsC[c],c+' question is present');
 assert.equal(Q.scalesC[c].length,5,c+' has five PDF-specific options');
}
assert.deepEqual(Array.from(Q.scalesC.C9),['Stark erschwerend','Eher erschwerend','Kein Einfluss','Eher erleichternd','Stark erleichternd']);
assert.deepEqual(Array.from(Q.scalesC.C10),['Nie','Selten','Manchmal','Oft','Sehr oft']);
assert.deepEqual(Array.from(Q.scalesC.C11),['Sehr schlecht','Eher schlecht','Teils / teils','Eher gut','Sehr gut']);
assert.deepEqual(Array.from(Q.scalesC.C12),['Sehr schlecht','Schlecht','Neutral','Gut','Sehr gut']);
assert.deepEqual(Array.from(Q.scalesC.C13),['Sehr schlecht','Schlecht','Neutral','Gut','Sehr gut']);
assert.ok(!('statementsC9' in Q),'Old attitude statements must not be used as C9–13');
assert.ok(Q.placesC7.some(x=>x[0]==='Sonstige')&&Q.placesC7.some(x=>x[0]==='Sonstige2'),'C7 has two optional places');
const keys=new Set(Q.codebook.map(row=>row[0]));
for(const key of ['Fragebogen_Version','A6_seit','B7_Wichtigkeit','C7_Sonstige2','C7_Sonstige2_Text',
  'C9','C10','C11','C12','C13','B2_Inhalt','B2_F','B2_L','B2_SV']){
 assert.ok(keys.has(key),'Codebook is missing '+key);
}
assert.ok(!keys.has('C9_1'),'Old C9 attitudes may not masquerade as new PDF C9');
assert.ok(!keys.has('B_Aussage_Austausch_wichtig'),'Old B attitude no longer used in new coded export');
assert.equal(config.TARGET_COUNT,44,'All P01–P44 are counted');
for(const fragment of [
 "topics_combo","normalizeB2Topics","b2ComboValue(edge.topics)",
 "key==='A6_vor_NXT'","B7_Wichtigkeit","Q.scalesC[key]","const textKey='C7_'+key+'_Text'",
 "B2_F:e?","B2_L:e?","B2_SV:e?","Fragebogen_Version:Q.version",
 "C9:Q.scalesC.C9","C13:Q.scalesC.C13"
])assert.ok(app.includes(fragment),'Form/exports missing '+fragment);
assert.ok(!app.includes('topics_single'),'Old single-category B2 selection must be gone');
assert.ok(!app.includes('Q.statementsC9'),'Old five-statement C9 flow must be gone');
assert.ok(network.includes("const topics={F:0,L:0,SV:0,unknown:0}"),'Network text analysis must count SV');
assert.ok(network.includes('normalizeTopics(edge.topics)'),'Multi-topic edges counted');
assert.ok(campus.includes("SV:'Selbstverwaltung'"),'Campus filter matches updated SV code');
assert.ok(html.includes('questionnaire.js'),'The final questionnaire loads through index.html');
// Interview overview: search is local, live, name-based and independent of the people-directory search.
assert.ok(app.includes('id="interview-search"'),'Interview overview needs a visible search field');
assert.ok(app.includes('aria-label="Interviews nach Name oder Personen-ID durchsuchen"'),'Search must be accessible');
assert.ok(app.includes("if(el.id==='interview-search'){state.interviewQuery=el.value;refreshInterviewTable();return;}"),'Typing must filter the table without rerendering the input');
assert.ok(app.includes("if(state.route==='interviews')refreshInterviewTable();"),'Search must be restored after data refresh');
const searchBegin=app.indexOf('function interviewSearchMatches(text,query){');
const searchEnd=app.indexOf('function refreshInterviewTable(){',searchBegin);
assert.ok(searchBegin>0&&searchEnd>searchBegin,'Interview filtering helper is present');
const searchContext={};
vm.createContext(searchContext);
vm.runInContext(app.slice(searchBegin,searchEnd),searchContext);
const matches=searchContext.interviewSearchMatches;
assert.equal(matches('Johanna Zieger P40','zieger'),true,'Search matches surname');
assert.equal(matches('Frauke Greiner P42','P42'),true,'Search matches person ID');
assert.equal(matches('Anja Freifrau von Richthofen P43','richthofen ANJA'),true,'Search matches multiple keywords in any order');
assert.equal(matches('Müller P11','muller'),true,'Search ignores umlaut marks');
assert.equal(matches('Doris Elfers P44','P41'),false,'Search excludes nonmatches');
assert.equal(matches('Agnieszka Grzesiak P41',''),true,'Empty query shows all people');

// C2: boolean checkbox and repeatable room locations; preserve old ja/nein + floor values.
for(const [key] of Q.spacesC2){
 assert.ok(Q.codebook.some(row=>row[0]==='C2_'+key+'_Standorte'),'Missing new C2 export key: '+key);
}
for(const token of ['data-c2-toggle=','data-c2-field="building"','data-c2-field="floor"',
 'data-action="c2-add"','data-action="c2-remove"','const placesC2=()']){
 assert.ok(app.includes(token),'C2 dynamic field missing '+token);
}
assert.ok(!app.includes("places(Q.spacesC2,'C2',true)"),'Previous C2 yes/no dropdown must be replaced');
assert.ok(app.includes("Häkchen = Ja · leer = Nein"),'Checkbox states must be unambiguous');
assert.ok(app.includes("z. B. EG oder OG 1"),'Etage / Flur example placeholder');
assert.ok(app.includes("c2SetOfficeBuilding(state.form,val)"),'Office building updates inherited locations');
assert.ok(app.includes("function c2SyncOldFloor(form,key)"),'First floor stays backward compatible');
assert.ok(app.includes("makeSheet(wb,'C2_Standorte'"),'Export repeated C2 locations as separate rows');
assert.ok(app.includes("answers[base+'_Standorte']=yes?rows.map("),'Store all repeated rooms in existing JSONB answers');
assert.ok(app.includes("Bei C2 bitte für jeden ausgewählten Standort ein Gebäude angeben."),'Completed interview requires locations');
const c2Start=app.indexOf("const c2IsChecked="),c2End=app.indexOf("const qYesNo =",c2Start);
assert.ok(c2Start>=0&&c2End>c2Start,'C2 data compatibility helpers exist');
const c2World={Q,form:{
 building:"16",
 answers:{C1_Gebaeude:"21",C2_Kueche:"ja",C2_Kueche_Etage:"OG1",
   C2_Drucker:"nein",C2_Meeting:true,C2_Meeting_Standorte:[
    {building:"5",floor:"EG",followOffice:false},{building:"21",floor:"OG 2",followOffice:true}
   ]}
}};
vm.createContext(c2World);
vm.runInContext(app.slice(c2Start,c2End),c2World);
vm.runInContext("c2EnsureAnswers(form)",c2World);
assert.equal(c2World.form.answers.C2_Kueche,true,'Legacy ja becomes checked');
assert.equal(c2World.form.answers.C2_Drucker,false,'Legacy nein becomes unchecked');
assert.equal(c2World.form.answers.C2_Kueche_Standorte[0].floor,"OG1",'Legacy floor is retained');
assert.equal(c2World.form.answers.C2_Kueche_Standorte[0].building,"21",'Legacy row inherits office building');
assert.equal(c2World.form.answers.C2_Meeting_Standorte.length,2,'Multiple locations are retained');
vm.runInContext('c2SetOfficeBuilding(form,"D (Alice-Salomon-Haus)")',c2World);
assert.equal(c2World.form.answers.C2_Kueche_Standorte[0].building,"D (Alice-Salomon-Haus)",
 'Auto-selected room building follows new C1 choice');
assert.equal(c2World.form.answers.C2_Meeting_Standorte[0].building,"5",
 'Manually chosen building must not be overwritten');
assert.equal(c2World.form.answers.C2_Meeting_Standorte[1].building,"D (Alice-Salomon-Haus)",
 'Only office-inherited entries should follow C1');


// C7: exactly the same checkbox semantics as C2, with two persistent custom-place inputs.
assert.equal(Q.placesC7.length,6,'C7 still contains the six original location types');
const c7Entries=Array.from(Q.placesC7.map(([key])=>key));
assert.deepEqual(c7Entries,['Mensa','Lernzentrum','RZ','Aula','Sonstige','Sonstige2']);
assert.ok(app.includes('data-c7-toggle='),'Every C7 location offers a checkbox');
assert.ok(app.includes('q-c2-checkbox'),'C7 reuses the existing NXT/C2 checkbox styling');
assert.ok(app.includes('const c7='),'C7 has its own reusable list layout');
assert.ok(!app.includes("qChoice('C7_'+k,'ja / nein'"),'C7 dropdowns have been removed');
assert.ok(app.includes("key.startsWith('Sonstige')"),'Both other-place fields remain');
assert.ok(app.includes("disabled aria-disabled="),'Other-place inputs are disabled while unchecked');
assert.ok(app.includes("state.form.answers['C7_'+key]=Boolean(el.checked)"),'Checked means true, unchecked means false');
assert.ok(app.includes("c7EnsureAnswers(state.form)"),'Legacy strings are converted when the interview opens');
assert.ok(app.includes("if(key.startsWith('Sonstige')&&!selected)answers[answerKey+'_Text']='';"),'Unchecked other places do not persist stale notes');
assert.ok(app.includes("return v===undefined?(status==='completed'?0:''):excelBinary(v)"),'Export counts untouched C7 boxes as no');
const c7Start=app.indexOf('const c7KnownKey='),c7End=app.indexOf('const qYesNo =',c7Start);
assert.ok(c7Start>0&&c7End>c7Start,'C7 compatibility helper is available');
const c7Env={Q,c2IsChecked:v=>v===true||v==='ja'||v==='Ja'||v===1,
 form:{answers:{C7_Mensa:'ja',C7_RZ:'nein',C7_Sonstige:'ja',C7_Sonstige_Text:'Garten',C7_Aula:false}}};
vm.createContext(c7Env);
vm.runInContext(app.slice(c7Start,c7End),c7Env);
vm.runInContext('c7EnsureAnswers(form)',c7Env);
assert.equal(c7Env.form.answers.C7_Mensa,true,'Legacy yes is selected');
assert.equal(c7Env.form.answers.C7_RZ,false,'Legacy no is unselected');
assert.equal(c7Env.form.answers.C7_Lernzentrum,false,'Missing answer is auto-no');
assert.equal(c7Env.form.answers.C7_Sonstige,true,'Legacy selected custom place remains selected');
assert.equal(c7Env.form.answers.C7_Sonstige_Text,'Garten','Existing custom place is retained');
assert.equal(c7Env.form.answers.C7_Sonstige2,false,'Second custom place is auto-no');

// Both updated scales use the exact same five numeric categories and preserve historic answers.
for(const key of ['C12','C13']){
 const item=Q.codebook.find(row=>row[0]===key);
 assert.equal(item[3],'1 = Sehr schlecht; 2 = Schlecht; 3 = Neutral; 4 = Gut; 5 = Sehr gut (historische Mengenangaben ordinal umkodiert; Originale separat gesichert)',
  key+' Excel codebook must be aligned with the dropdown');
}
const ratingStart=app.indexOf('const legacyC12C13='),ratingEnd=app.indexOf('const qChoice =',ratingStart);
assert.ok(ratingStart>=0&&ratingEnd>ratingStart,'Old values must be compatible with current form');
const ratingContext={Q};vm.createContext(ratingContext);
vm.runInContext(app.slice(ratingStart,ratingEnd),ratingContext);
assert.equal(vm.runInContext("normalizeC12C13('C12','Genau richtig')",ratingContext),'Neutral');
assert.equal(vm.runInContext("normalizeC12C13('C13','Eher zu viel')",ratingContext),'Gut');
assert.equal(vm.runInContext("normalizeC12C13('C12','Viel zu wenige')",ratingContext),'Sehr schlecht');
assert.equal(vm.runInContext("normalizeC12C13('C13','Sehr viel')",ratingContext),'Sehr gut');
assert.equal(vm.runInContext("normalizeC12C13('C12','Sehr wenig')",ratingContext),'Sehr schlecht');
assert.equal(vm.runInContext("normalizeC12C13('C13','Wenig')",ratingContext),'Schlecht');
assert.equal(vm.runInContext("normalizeC12C13('C13','Viel')",ratingContext),'Gut');
assert.match(app,/excelLookup\(normalizeC12C13\(key,v\),maps\[key\]\)/,
 'Excel numeric values must include historic answers');

console.log('PASS: PDF questionnaire A1–A6.1, B2 combinations, B7, C9–C13, export, cohort 44, network codes.');

assert.equal(Q.b4.find(([code])=>code==='B')[1],'beides');
assert.equal(Q.b5.find(([code])=>code==='B')[1],'beides');
assert.equal(Q.spacesC2.find(([code])=>code==='Sekretariat')[1],"Dekanat Sekretariat/ NXT Stop/ Postraum");
assert.equal(Q.encountersC8.find(([code])=>code==='Sekretariat')[1],'Sekretariat / Poststelle');
