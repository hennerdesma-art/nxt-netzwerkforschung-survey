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
assert.deepEqual(Array.from(Q.scalesC.C12),['Viel zu wenige','Eher zu wenige','Genau richtig','Eher zu viele','Viel zu viele']);
assert.deepEqual(Array.from(Q.scalesC.C13),['Viel zu wenig','Eher zu wenig','Genau richtig','Eher zu viel','Viel zu viel']);
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
 "key==='A6_vor_NXT'","B7_Wichtigkeit","Q.scalesC[key]","C7_'+k+'_Text",
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

assert.ok(app.includes("Etage / Flur (UG, UG 2, EG, OG 1, OG 2, …)"),'Floor field format is visible next to the label');
assert.ok(app.includes("'z. B. EG oder OG 1'"),'All floor inputs show a consistent example placeholder');
console.log('PASS: PDF questionnaire A1–A6.1, B2 combinations, B7, C9–C13, export, cohort 44, network codes.');
