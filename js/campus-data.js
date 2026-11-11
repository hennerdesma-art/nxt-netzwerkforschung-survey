/* NXT campus spatial layer (concept coordinate reference v1).
   The units below are IMAGE COORDINATES (0..1000 X, 0..563 Y), NOT meters or GPS.
   Pins were aligned manually against the generated 2.5D illustration (1672x941 px).
   Building heights / storeys are placeholders pending verified architectural plans.
   No building footprint, elevation, route distance or meeting-place location is claimed to be surveyed. */
(() => {
  'use strict';
  const data = {
    version: '2026-11-11-concept-v1', width:1000, height:563, baseWidth:1672, baseHeight:941,
    coordinateSystem:'NXT-IMG-1000', geographic:false, spatialAccuracy:'illustration-only',
    artwork:'./assets/nxt-campus-2_5d.webp',
    referencePlan:'./assets/nxt-lageplan.png',
    buildings:[
      {id:'21',label:'Gebäude 21',x:328,y:58,estimatedStoreys:2,basement:'assumed',heightM:7,source:'Konzeptkarte, Gebäudehöhe geschätzt',emphasis:'research'},
      {id:'5',label:'Gebäude 5',x:482,y:154,estimatedStoreys:2,basement:'assumed',heightM:7,source:'Konzeptkarte, Gebäudehöhe geschätzt',emphasis:'research'},
      {id:'16',label:'Gebäude 16',x:553,y:385,estimatedStoreys:2,basement:'assumed',heightM:7,source:'Konzeptkarte, Gebäudehöhe geschätzt',emphasis:'research'},
      {id:'17',label:'Gebäude 17',x:485,y:392,estimatedStoreys:2,basement:'assumed',heightM:7,source:'Konzeptkarte, Gebäudehöhe geschätzt',emphasis:'research'},
      {id:'D',label:'Gebäude D',x:815,y:394,estimatedStoreys:2,basement:'assumed',heightM:7,source:'Konzeptkarte, Gebäudehöhe geschätzt',emphasis:'research'}
    ],
    // These are marked as *conceptual candidates*. Named facilities in C7/C8 have no verified x/y positions.
    meetingCandidates:[
      // Source labels are taken from the campus plan (stand 07/2025) used by questionnaire C.
      // XY positions are manually re-plotted on the *artistic* 2.5D rendering; NOT surveyed.
      {id:'site-6',label:'Interimsmensa (Bau 11)',number:'6',x:678,y:208,kind:'social',verified:false,questionKeys:['C7_Mensa','C8_Mensa'],source:'Original-Lageplan Nummer 6; 2,5D-Bildposition geschätzt'},
      {id:'site-7',label:'Lernzentrum / Verwaltung (Bau 3)',number:'7',x:433,y:212,kind:'social',verified:false,questionKeys:['C7_Lernzentrum','C8_Lernzentrum'],source:'Original-Lageplan Nummer 7; 2,5D-Bildposition geschätzt'},
      {id:'site-8',label:'Rechen- und Medienzentrum (Bau 8)',number:'8',x:536,y:164,kind:'social',verified:false,questionKeys:['C7_RZ','C8_RZ'],source:'Original-Lageplan Nummer 8; 2,5D-Bildposition geschätzt'},
      {id:'site-9',label:'Aula (Bau 6)',number:'9',x:527,y:253,kind:'social',verified:false,questionKeys:['C7_Aula','C8_Aula'],source:'Original-Lageplan Nummer 9; 2,5D-Bildposition geschätzt'},
      {id:'site-10',label:'Großer Parkplatz Südwest',number:'10',x:264,y:366,kind:'arrival',verified:false,questionKeys:['C8_Parkplatz'],source:'Original-Lageplan Nummer 10; C8 Parken nicht punktgenau zugeordnet'},
      {id:'site-11',label:'Parkplatz Mitte',number:'11',x:679,y:303,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 11; 2,5D-Bildposition geschätzt'},
      {id:'site-12',label:'Parkplatz Ost',number:'12',x:741,y:235,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 12; 2,5D-Bildposition geschätzt'},
      {id:'site-13',label:'Fahrradparkplatz',number:'13',x:361,y:325,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 13; 2,5D-Bildposition geschätzt'},
      {id:'site-14',label:'Bushaltestelle Ost',number:'14',x:813,y:214,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 14; 2,5D-Bildposition geschätzt'},
      {id:'site-15',label:'Bushaltestelle Südost',number:'15',x:850,y:475,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 15; 2,5D-Bildposition geschätzt'},
      {id:'site-16',label:'Bushaltestelle Süd',number:'16',x:461,y:500,kind:'arrival',verified:false,questionKeys:[],source:'Original-Lageplan Nummer 16; 2,5D-Bildposition geschätzt'}
    ],
    meetingQuestions:[
      {key:'C8_Parkplatz',label:'Parkplatz / Haltestelle',group:'Begegnungsort (C8)'},
      {key:'C8_Buero',label:'Eigenes Büro',group:'Begegnungsort (C8)'},
      {key:'C8_Mensa',label:'Interimsmensa (Geb. 11)',group:'Begegnungsort (C8)'},
      {key:'C8_Lernzentrum',label:'Lernzentrum / Verwaltung (Geb. 3)',group:'Begegnungsort (C8)'},
      {key:'C8_RZ',label:'Rechen- und Medienzentrum (Geb. 8)',group:'Begegnungsort (C8)'},
      {key:'C8_Aula',label:'Aula (Geb. 6)',group:'Begegnungsort (C8)'},
      {key:'C8_Flure',label:'Flure / Treppenhaus',group:'Begegnungsort (C8)'},
      {key:'C8_Kueche',label:'Küche / Teeküche',group:'Begegnungsort (C8)'},
      {key:'C8_Digital',label:'Digitaler Austausch',group:'Begegnungsort (C8)'},
      {key:'C7_Mensa',label:'Interimsmensa (Geb. 11)',group:'Campusorte (C7)'},
      {key:'C7_Lernzentrum',label:'Lernzentrum / Verwaltung (Geb. 3)',group:'Campusorte (C7)'},
      {key:'C7_RZ',label:'Rechen- und Medienzentrum (Geb. 8)',group:'Campusorte (C7)'},
      {key:'C7_Aula',label:'Aula (Geb. 6)',group:'Campusorte (C7)'},
      {key:'C2_Kueche',label:'Küche / Teeküche',group:'Geteilte Infrastruktur (C2)'},
      {key:'C2_Drucker',label:'Drucker / Kopierer',group:'Geteilte Infrastruktur (C2)'},
      {key:'C2_Sekretariat',label:'Sekretariat / Postfächer',group:'Geteilte Infrastruktur (C2)'},
      {key:'C2_Meeting',label:'Meetingräume',group:'Geteilte Infrastruktur (C2)'}
    ],
    topicLabels:{F:'Forschung',L:'Lehre',S:'Selbstverwaltung',A:'Anderes'},
    // No metric shortest paths until a surveyed, entrance-to-entrance route graph has been provided.
    distanceModel:{status:'not_calibrated',unit:null,method:'pending door-to-door routing'}
  };
  Object.freeze(data);
  window.NXTCampusData = data;
})();
