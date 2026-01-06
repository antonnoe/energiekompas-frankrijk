// ENERGIEKOMPAS FRANKRIJK v2.1 - Franse Huizenmatrix
(function(){
"use strict";
const{useEffect,useMemo,useState,useRef}=React;
const TOOL={name:"Energiekompas Frankrijk",version:"2.1",source:"https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"};

const ZONES=[
{id:"med",name:"Méditerranée",desc:"Côte d'Azur, Provence",hdd:1400,pv:1450},
{id:"ouest",name:"Atlantisch/Zuid-West",desc:"Bordeaux, Bretagne",hdd:1900,pv:1250},
{id:"paris",name:"Île-de-France/Noord",desc:"Parijs, Lille",hdd:2200,pv:1150},
{id:"centre",name:"Centraal",desc:"Bourgogne, Loire",hdd:2500,pv:1200},
{id:"est",name:"Oost/Elzas",desc:"Straatsburg",hdd:2800,pv:1150},
{id:"mont",name:"Bergen",desc:"Alpen, Pyrénées",hdd:3400,pv:1100}
];

const DEPT_ZONE={"04":"med","05":"mont","06":"med","11":"med","13":"med","30":"med","34":"med","66":"med","83":"med","84":"med","20":"med","16":"ouest","17":"ouest","24":"ouest","33":"ouest","40":"ouest","47":"ouest","64":"ouest","79":"ouest","85":"ouest","86":"ouest","87":"ouest","44":"ouest","56":"ouest","29":"ouest","22":"ouest","35":"ouest","49":"ouest","50":"ouest","14":"ouest","53":"ouest","72":"ouest","41":"centre","37":"centre","09":"mont","12":"mont","15":"mont","19":"centre","31":"ouest","32":"ouest","38":"mont","42":"centre","43":"mont","46":"centre","48":"mont","63":"mont","65":"mont","73":"mont","74":"mont","81":"ouest","82":"ouest","08":"est","10":"est","25":"est","39":"est","52":"est","54":"est","55":"est","57":"est","67":"est","68":"est","70":"est","88":"est","90":"est","21":"est","71":"centre","75":"paris","77":"paris","78":"paris","91":"paris","92":"paris","93":"paris","94":"paris","95":"paris","59":"paris","62":"paris","60":"paris","80":"paris","02":"paris","51":"paris","76":"paris","27":"paris","28":"paris","45":"centre","18":"centre","36":"centre","23":"centre","03":"centre","58":"centre","89":"centre","26":"med","07":"centre","69":"centre","01":"est"};
const zoneFromCP=cp=>cp&&cp.length===5?(DEPT_ZONE[cp.slice(0,2)]||"centre"):null;

const HUIZEN={
longere:{id:"longere",naam:"La Longère / Le Mas",subtitel:"Natuurstenen woning",periode:"Vóór 1948",icon:"🏚️",
beschrijving:"Dikke muren (50-80cm) graniet, kalksteen of breuksteen. Geen spouw.",
isolatie:1,massa:5,vochtAdvies:"ademend",
U:{muur:2.5,dak:3.5,vloer:1.5,raam:5.8},ach:0.9,
opp:{raam:0.10,dak:0.60,muur:1.5,vloer:0.60},
warnings:[{icon:"💧",titel:"Ademende isolatie verplicht",tekst:"Dampdichte isolatie veroorzaakt vochtproblemen. Gebruik kalkhennep of houtvezel."},{icon:"🧱",titel:"Lange opwarmtijd",tekst:"Reken op 2-3 dagen om op temperatuur te komen."}],
link:"https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"},

colombage:{id:"colombage",naam:"Colombage / Vakwerk",subtitel:"Hout met leem/stro",periode:"Tot ~1900",icon:"🏡",
beschrijving:"Houten skelet met torchis (leem, stro, kalk). Normandië, Elzas, Bourgogne.",
isolatie:2,massa:3,vochtAdvies:"hygroscopisch",
U:{muur:1.5,dak:2.5,vloer:1.2,raam:5.8},ach:0.7,
opp:{raam:0.12,dak:0.55,muur:1.3,vloer:0.55},
warnings:[{icon:"💧",titel:"Nooit dichtcementen",tekst:"Leem reguleert vocht. Cement veroorzaakt houtrot."}],
link:"https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"},

parpaing:{id:"parpaing",naam:"Le Pavillon Parpaing",subtitel:"Ongeïsoleerde betonblokken",periode:"1950–1975",icon:"🏠",
beschrijving:"Ongeïsoleerde grijze betonblok. Energetisch een lek mandje.",
isolatie:1,massa:2,vochtAdvies:"condensrisico",
U:{muur:2.8,dak:3.0,vloer:1.2,raam:4.0},ach:0.8,
opp:{raam:0.14,dak:0.50,muur:1.2,vloer:0.50},
warnings:[{icon:"🛡️",titel:"Amper isolatie",tekst:"Parpaing 20cm: R=0,22. Huidige norm: R>3,7."},{icon:"💶",titel:"Groot besparingspotentieel",tekst:"Binnenisolatie kan stookkosten halveren."}],
link:"https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"},

placo:{id:"placo",naam:"Placo-Polystyrène",subtitel:"Betonblok + binnenisolatie",periode:"1975–1990",icon:"🏘️",
beschrijving:"Betonblok met 4-10cm piepschuim en gipsplaat. Vol koudebruggen.",
isolatie:2,massa:1,vochtAdvies:"koudebruggen",
U:{muur:0.8,dak:1.0,vloer:0.8,raam:2.9},ach:0.6,
opp:{raam:0.15,dak:0.50,muur:1.2,vloer:0.50},
warnings:[{icon:"🌡️",titel:"Koudebruggen",tekst:"Isolatie stopt bij vloer/plafond/kozijnen."}],
link:"https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"},

traditioneel_plus:{id:"traditioneel_plus",naam:"Traditioneel+",subtitel:"Moderne steenbouw",periode:"1990–2012",icon:"🏡",
beschrijving:"Spouwisolatie, dubbel glas. RT1990/2000/2005.",
isolatie:4,massa:2,vochtAdvies:null,
U:{muur:0.4,dak:0.3,vloer:0.4,raam:1.8},ach:0.5,
opp:{raam:0.16,dak:0.50,muur:1.1,vloer:0.50},
warnings:[{icon:"✓",titel:"Redelijk energiezuinig",tekst:"Verbeterpunten: ramen naar HR++ en dak extra isoleren."}],
link:null},

rt2012:{id:"rt2012",naam:"RT2012 / RE2020",subtitel:"Nieuwbouwnorm",periode:"Na 2012",icon:"🏢",
beschrijving:"Luchtdicht, balansventilatie, warmtepomp. Zeer energiezuinig.",
isolatie:5,massa:1,vochtAdvies:"ventilatie",
U:{muur:0.2,dak:0.15,vloer:0.2,raam:1.2},ach:0.3,
opp:{raam:0.18,dak:0.50,muur:1.0,vloer:0.50},
warnings:[{icon:"💨",titel:"Ventilatie cruciaal",tekst:"VMC nooit uitzetten."},{icon:"☀️",titel:"Oververhittingsrisico",tekst:"Zonwering nodig in de zomer."}],
link:null},

appartement_oud:{id:"appartement_oud",naam:"Appartement (oud)",subtitel:"Gebouw vóór 1975",periode:"Vóór 1975",icon:"🏬",
beschrijving:"Minder buitenoppervlak door gedeelde muren.",
isolatie:2,massa:3,vochtAdvies:null,
U:{muur:2.0,dak:0.5,vloer:0.5,raam:4.0},ach:0.6,
opp:{raam:0.12,dak:0.10,muur:0.5,vloer:0.10},
warnings:[],link:null},

appartement_recent:{id:"appartement_recent",naam:"Appartement (recent)",subtitel:"Gebouw na 1975",periode:"Na 1975",icon:"🏢",
beschrijving:"Enige isolatie en dubbel glas.",
isolatie:3,massa:2,vochtAdvies:null,
U:{muur:0.6,dak:0.3,vloer:0.3,raam:2.0},ach:0.5,
opp:{raam:0.12,dak:0.05,muur:0.4,vloer:0.05},
warnings:[],link:null}
};

const GROEPEN=[
{titel:"Traditionele Steenbouw",sub:"Bouwfysisch uitdagend",types:["longere"]},
{titel:"Vakwerk & Bio-based",sub:"Moet kunnen ademen",types:["colombage"]},
{titel:"Naoorlogse Bouw",sub:"De renovatie-objecten",types:["parpaing","placo"]},
{titel:"Moderne Bouw",sub:"Isolatie volgens normen",types:["traditioneel_plus","rt2012"]},
{titel:"Appartementen",sub:"Gedeelde muren",types:["appartement_oud","appartement_recent"]}
];

const ISO_RAMEN=[
{id:"enkel",naam:"Enkel glas",u:5.8,desc:"Eén laag"},
{id:"dubbel_oud",naam:"Dubbel (oud)",u:3.5,desc:"Vóór 1995"},
{id:"dubbel",naam:"Dubbel glas",u:2.9,desc:"1995-2005"},
{id:"hr",naam:"HR/HR+",u:1.8,desc:"Na 2005"},
{id:"hr_plus",naam:"HR++/Triple",u:1.2,desc:"Modern"}
];
const ISO_DAK=[
{id:"geen",naam:"Geen isolatie",u:3.5,desc:"Ongeïsoleerd"},
{id:"matig",naam:"Matig (5-10cm)",u:0.8,desc:"R≈1-2"},
{id:"goed",naam:"Goed (15-20cm)",u:0.3,desc:"R≈4-5"},
{id:"zeer_goed",naam:"Zeer goed (>25cm)",u:0.18,desc:"R>6"}
];
const ISO_MUUR=[
{id:"geen",naam:"Geen isolatie",u:2.5,desc:"Kaal"},
{id:"slecht",naam:"Minimaal",u:1.5,desc:"2-4cm"},
{id:"matig",naam:"Matig (5-8cm)",u:0.6,desc:"R≈1.5-2"},
{id:"goed",naam:"Goed (10-15cm)",u:0.35,desc:"R≈3-4"},
{id:"zeer_goed",naam:"Zeer goed",u:0.2,desc:"R>5"}
];
const ISO_VLOER=[
{id:"geen",naam:"Geen isolatie",u:1.5,desc:"Op grond"},
{id:"matig",naam:"Matig",u:0.6,desc:"Enige"},
{id:"goed",naam:"Goed",u:0.3,desc:"Modern"}
];

const VERWARMING=[
{id:"wp_lucht",naam:"Warmtepomp (lucht/water)",type:"elec",scop:3.2,subsidie:true},
{id:"wp_grond",naam:"Warmtepomp (bodem)",type:"elec",scop:4.0,subsidie:true},
{id:"elec",naam:"Elektrisch (convectoren)",type:"elec",scop:1.0,subsidie:false},
{id:"gas",naam:"Aardgas CV",type:"gas",eta:0.92,subsidie:false},
{id:"fioul",naam:"Stookolie (fioul)",type:"fioul",eta:0.85,subsidie:false},
{id:"pellet",naam:"Pelletketel",type:"pellet",eta:0.90,subsidie:true},
{id:"hout",naam:"Houtkachel/insert",type:"hout",eta:0.70,subsidie:true},
{id:"propaan",naam:"Propaan",type:"propaan",eta:0.90,subsidie:false}
];
const BIJVERW=[
{id:"geen",naam:"Geen",aandeel:0},
{id:"hout",naam:"Houtkachel",type:"hout",eta:0.70,aandeel:0.15},
{id:"pellet",naam:"Pelletkachel",type:"pellet",eta:0.85,aandeel:0.15},
{id:"elec",naam:"Elektrisch",type:"elec",scop:1.0,aandeel:0.10}
];

const BRANDSTOF={
elec:{prijs:0.2516,eenheid:"kWh",naam:"Elektriciteit",kwhPer:1},
gas:{prijs:1.20,eenheid:"m³",naam:"Aardgas",kwhPer:10},
fioul:{prijs:1.10,eenheid:"L",naam:"Stookolie",kwhPer:10},
pellet:{prijs:0.38,eenheid:"kg",naam:"Pellets",kwhPer:4.8},
hout:{prijs:85,eenheid:"stère",naam:"Hout",kwhPer:1800},
propaan:{prijs:2.10,eenheid:"L",naam:"Propaan",kwhPer:7.1}
};

const DPE=[
{letter:"A",max:70,kleur:"#319834",tekst:"Excellent"},
{letter:"B",max:110,kleur:"#33cc31",tekst:"Très performant"},
{letter:"C",max:180,kleur:"#cbfc32",tekst:"Performant"},
{letter:"D",max:250,kleur:"#fbfe06",tekst:"Moyen"},
{letter:"E",max:330,kleur:"#fbcc05",tekst:"Insuffisant"},
{letter:"F",max:420,kleur:"#f66c02",tekst:"Très insuffisant"},
{letter:"G",max:9999,kleur:"#fc0205",tekst:"Extrêmement insuffisant"}
];
const DPE_VERHUUR={G:"Sinds 1-1-2025 niet meer verhuurbaar",F:"Vanaf 1-1-2028 niet meer verhuurbaar",E:"Vanaf 1-1-2034 niet meer verhuurbaar"};

const STOOK=[
{id:"continu",naam:"Continu",factor:1.0,desc:"Hele dag"},
{id:"dag_nacht",naam:"Dag/nacht",factor:0.90,desc:"'s Nachts lager"},
{id:"spaarzaam",naam:"Spaarzaam",factor:0.80,desc:"Alleen als nodig"},
{id:"vakantie",naam:"Vakantiewoning",factor:0.50,desc:"Vorstvrij"}
];
const PV_ORIENT=[
{id:"Z",naam:"Zuid",factor:1.00},
{id:"ZO",naam:"Zuid-Oost",factor:0.95},
{id:"ZW",naam:"Zuid-West",factor:0.95},
{id:"O",naam:"Oost",factor:0.85},
{id:"W",naam:"West",factor:0.85}
];

const SUBSIDIES=[
{naam:"Dakisolatie",bedrag:"€15–25/m²",rel:h=>h.U.dak>0.5},
{naam:"Muurisolatie (binnen)",bedrag:"€15–25/m²",rel:h=>h.U.muur>0.5},
{naam:"Muurisolatie (buiten)",bedrag:"€40–75/m²",rel:h=>h.U.muur>0.5},
{naam:"HR++ beglazing",bedrag:"€40–100/raam",rel:h=>h.U.raam>2.0},
{naam:"Warmtepomp",bedrag:"€2.000–5.000",rel:()=>true},
{naam:"Pelletketel",bedrag:"€1.500–5.500",rel:()=>true}
];

// HULPFUNCTIES
const num=(v,d=0)=>{const n=parseFloat(v);return Number.isFinite(n)?n:d};
const euro=v=>num(v).toLocaleString("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmt=(v,d=0)=>num(v).toLocaleString("nl-NL",{minimumFractionDigits:d,maximumFractionDigits:d});

const schatOpp=(m2,verd,huisId)=>{
const h=HUIZEN[huisId];
if(!h)return{raam:20,dak:60,muur:120,vloer:60};
const fp=m2/Math.max(1,verd);
return{raam:Math.round(m2*h.opp.raam),dak:Math.round(fp*h.opp.dak),muur:Math.round(m2*h.opp.muur),vloer:Math.round(fp*h.opp.vloer)};
};

const berekenWarmte=p=>{
const z=ZONES.find(x=>x.id===p.zone)||ZONES[3];
const Htr=(p.U.raam*p.opp.raam)+(p.U.dak*p.opp.dak)+(p.U.muur*p.opp.muur)+(p.U.vloer*p.opp.vloer);
const Hvent=0.34*p.ach*p.volume;
const Htot=Htr+Hvent;
const stookF=STOOK.find(x=>x.id===p.stook)?.factor||1;
const Q=(Htot*z.hdd*24)/1000*stookF;
return{Htot,Htr,Hvent,hdd:z.hdd,Q};
};

const berekenKosten=p=>{
const bij=BIJVERW.find(x=>x.id===p.bijV)||BIJVERW[0];
const Qhoofd=p.Q*(1-bij.aandeel);
const Qbij=p.Q*bij.aandeel;
const hoofd=VERWARMING.find(x=>x.id===p.hoofdV)||VERWARMING[0];
let kostenHoofd=0;
if(hoofd.type==="elec"){kostenHoofd=(Qhoofd/hoofd.scop)*p.prijzen.elec;}
else{const b=BRANDSTOF[hoofd.type];kostenHoofd=(Qhoofd/hoofd.eta/b.kwhPer)*p.prijzen[hoofd.type];}
let kostenBij=0;
if(bij.id!=="geen"){
if(bij.type==="elec"){kostenBij=(Qbij/bij.scop)*p.prijzen.elec;}
else{const b=BRANDSTOF[bij.type];kostenBij=(Qbij/bij.eta/b.kwhPer)*p.prijzen[bij.type];}
}
const kostenElec=p.basisElec*p.prijzen.elec;
let pvBesp=0;
if(p.pv&&p.pv.kWp>0){
const z=ZONES.find(x=>x.id===p.zone)||ZONES[3];
const o=PV_ORIENT.find(x=>x.id===p.pv.orient)||PV_ORIENT[0];
const pvOpbr=p.pv.kWp*z.pv*o.factor;
pvBesp=Math.min(pvOpbr*0.65,p.basisElec+(Qhoofd/(hoofd.scop||1)))*p.prijzen.elec;
}
return{verwarming:kostenHoofd+kostenBij,elektra:kostenElec,pvBesp,totaal:kostenHoofd+kostenBij+kostenElec-pvBesp,totaalKwh:p.Q+p.basisElec};
};

const bepaalDPE=kwhM2=>{for(const d of DPE)if(kwhM2<=d.max)return d;return DPE[6];};

// COMPONENTEN
function Info({children,titel,link}){
const[open,setOpen]=useState(false);
return React.createElement("span",{className:"ek-info-wrap"},
React.createElement("button",{type:"button",className:"ek-info-btn",onClick:e=>{e.stopPropagation();setOpen(!open);}},"?"),
open&&React.createElement("div",{className:"ek-info-popup",onClick:e=>e.stopPropagation()},
titel&&React.createElement("strong",null,titel),
React.createElement("p",null,children),
link&&React.createElement("a",{href:link,target:"_blank",rel:"noopener"},"📖 Meer →"),
React.createElement("button",{className:"ek-info-sluit",onClick:()=>setOpen(false)},"×")));
}

function NumInput({value,onChange,min,max,suffix}){
const[local,setLocal]=useState(String(value));
const ref=useRef();
useEffect(()=>{if(document.activeElement!==ref.current)setLocal(String(value));},[value]);
return React.createElement("div",{className:"ek-num"},
React.createElement("input",{ref,type:"text",inputMode:"decimal",value:local,
onChange:e=>{setLocal(e.target.value);const n=parseFloat(e.target.value);if(Number.isFinite(n))onChange(n);},
onBlur:()=>{let n=parseFloat(local);if(!Number.isFinite(n))n=min||0;if(min!=null)n=Math.max(min,n);if(max!=null)n=Math.min(max,n);setLocal(String(n));onChange(n);}}),
suffix&&React.createElement("span",{className:"ek-num-suffix"},suffix));
}

function IsoInd({niveau,label}){
return React.createElement("div",{className:"ek-iso-ind"},
React.createElement("span",{className:"ek-iso-label"},label),
React.createElement("span",{className:"ek-iso-dots"},
Array.from({length:5},(_,i)=>React.createElement("span",{key:i,className:"ek-dot"+(i<niveau?" vol":"")}))));
}

function HuisKaart({huis,selected,onClick}){
const h=HUIZEN[huis];
return React.createElement("button",{type:"button",className:"ek-huis-kaart"+(selected?" actief":""),onClick},
React.createElement("div",{className:"ek-huis-icon"},h.icon),
React.createElement("div",{className:"ek-huis-tekst"},
React.createElement("div",{className:"ek-huis-naam"},h.naam),
React.createElement("div",{className:"ek-huis-periode"},h.periode)),
React.createElement("div",{className:"ek-huis-ind"},
React.createElement(IsoInd,{niveau:h.isolatie,label:"🛡️"}),
React.createElement(IsoInd,{niveau:h.massa,label:"🧱"})));
}

function DPEBalk({letter}){
const idx=DPE.findIndex(d=>d.letter===letter);
const pos=((idx+0.5)/7)*100;
return React.createElement("div",{className:"ek-dpe-balk-wrap"},
React.createElement("div",{className:"ek-dpe-balk"},
DPE.map(d=>React.createElement("div",{key:d.letter,className:"ek-dpe-seg",style:{background:d.kleur}})),
React.createElement("div",{className:"ek-dpe-ptr",style:{left:pos+"%"}})),
React.createElement("div",{className:"ek-dpe-letters"},
DPE.map(d=>React.createElement("span",{key:d.letter},d.letter))));
}

function Voortgang({stap}){
return React.createElement("div",{className:"ek-voortgang"},
["Woning","Energie","Resultaat"].map((label,i)=>{
const n=i+1;
return React.createElement("div",{key:n,className:"ek-vg-item "+(n<stap?"done":n===stap?"actief":"")},
React.createElement("div",{className:"ek-vg-num"},n<stap?"✓":n),
React.createElement("div",{className:"ek-vg-label"},label));
}));
}

function KostenBar({totaal,bb}){
const lo=totaal*(1-bb),hi=totaal*(1+bb);
return React.createElement("div",{className:"ek-kosten-bar"},
React.createElement("div",{className:"ek-kb-tekst"},
React.createElement("span",null,"Geschatte energiekosten: "),
React.createElement("strong",null,euro(lo)," – ",euro(hi),"/jaar")),
React.createElement("div",{className:"ek-kb-maand"},euro(lo/12)," – ",euro(hi/12),"/maand"));
}

// HOOFDAPP
function App(){
const[stap,setStap]=useState(1);
const[postcode,setPostcode]=useState("");
const[zone,setZone]=useState("centre");
const[zoneLock,setZoneLock]=useState(false);
const[huisType,setHuisType]=useState("parpaing");
const[m2,setM2]=useState(120);
const[verd,setVerd]=useState(1);
const[isoAuto,setIsoAuto]=useState(true);
const[isoRaam,setIsoRaam]=useState("dubbel_oud");
const[isoDak,setIsoDak]=useState("matig");
const[isoMuur,setIsoMuur]=useState("geen");
const[isoVloer,setIsoVloer]=useState("geen");
const[oppAuto,setOppAuto]=useState(true);
const[oppRaam,setOppRaam]=useState(15);
const[oppDak,setOppDak]=useState(60);
const[oppMuur,setOppMuur]=useState(120);
const[oppVloer,setOppVloer]=useState(60);
const[hoofdV,setHoofdV]=useState("elec");
const[bijV,setBijV]=useState("geen");
const[stook,setStook]=useState("dag_nacht");
const[basisElec,setBasisElec]=useState(3500);
const[pvAan,setPvAan]=useState(false);
const[pvKWp,setPvKWp]=useState(3);
const[pvOrient,setPvOrient]=useState("Z");
const[prijzen,setPrijzen]=useState(Object.fromEntries(Object.entries(BRANDSTOF).map(([k,v])=>[k,v.prijs])));
const[toonPrijzen,setToonPrijzen]=useState(false);
const[toonSubsidies,setToonSubsidies]=useState(false);
const[toonGrond,setToonGrond]=useState(false);

const huis=HUIZEN[huisType]||HUIZEN.parpaing;
const zoneInfo=ZONES.find(z=>z.id===zone)||ZONES[3];

useEffect(()=>{if(!zoneLock){const z=zoneFromCP(postcode);if(z)setZone(z);}},[postcode,zoneLock]);

useEffect(()=>{
if(isoAuto&&huis){
const matchU=(arr,target)=>arr.reduce((best,x)=>Math.abs(x.u-target)<Math.abs(best.u-target)?x:best).id;
setIsoRaam(matchU(ISO_RAMEN,huis.U.raam));
setIsoDak(matchU(ISO_DAK,huis.U.dak));
setIsoMuur(matchU(ISO_MUUR,huis.U.muur));
setIsoVloer(matchU(ISO_VLOER,huis.U.vloer));
}
},[huisType,isoAuto]);

useEffect(()=>{
if(oppAuto){const o=schatOpp(m2,verd,huisType);setOppRaam(o.raam);setOppDak(o.dak);setOppMuur(o.muur);setOppVloer(o.vloer);}
},[m2,verd,huisType,oppAuto]);

const U=useMemo(()=>({
raam:ISO_RAMEN.find(x=>x.id===isoRaam)?.u||2.9,
dak:ISO_DAK.find(x=>x.id===isoDak)?.u||1.5,
muur:ISO_MUUR.find(x=>x.id===isoMuur)?.u||1.5,
vloer:ISO_VLOER.find(x=>x.id===isoVloer)?.u||1.0
}),[isoRaam,isoDak,isoMuur,isoVloer]);

const opp={raam:oppRaam,dak:oppDak,muur:oppMuur,vloer:oppVloer};
const volume=m2*2.5*verd;
const ach=huis?.ach||0.6;

const warmte=useMemo(()=>berekenWarmte({zone,U,opp,ach,volume,stook}),[zone,U,opp,ach,volume,stook]);
const kosten=useMemo(()=>berekenKosten({Q:warmte.Q,hoofdV,bijV,prijzen,basisElec,zone,pv:pvAan?{kWp:pvKWp,orient:pvOrient}:null}),[warmte.Q,hoofdV,bijV,prijzen,basisElec,pvAan,pvKWp,pvOrient,zone]);
const dpe=useMemo(()=>{const kwhM2=kosten.totaalKwh/Math.max(m2,20);return{...bepaalDPE(kwhM2),waarde:Math.round(kwhM2)};},[kosten.totaalKwh,m2]);

const stap1OK=postcode.length===5&&m2>=20;
const bb=stap<3?0.20:0.12;

// STAP 1 RENDER
const renderStap1=()=>React.createElement("div",{className:"ek-stap"},
React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"📍 Locatie"),
React.createElement("div",{className:"ek-row"},
React.createElement("div",{className:"ek-veld"},
React.createElement("label",null,"Postcode"),
React.createElement("input",{type:"text",className:"ek-input",value:postcode,maxLength:5,inputMode:"numeric",placeholder:"bijv. 24200",onChange:e=>setPostcode(e.target.value.replace(/\D/g,"").slice(0,5))}),
postcode.length===5&&React.createElement("small",{className:"ek-hint ok"},"✓ ",zoneInfo.name)),
React.createElement("div",{className:"ek-veld"},
React.createElement("label",null,"Klimaatzone ",React.createElement(Info,{titel:"Klimaatzones"},"Méditerranée: ~1400 graaddagen. Bergen: ~3400.")),
React.createElement("select",{className:"ek-select",value:zone,onChange:e=>{setZone(e.target.value);setZoneLock(true);}},
ZONES.map(z=>React.createElement("option",{key:z.id,value:z.id},z.name+" — "+z.desc)))))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"🏠 Woningtype ",React.createElement(Info,{titel:"De Franse Huizenmatrix",link:TOOL.source},"🛡️ = isolatie, 🧱 = thermische massa.")),
GROEPEN.map(g=>React.createElement("div",{key:g.titel,className:"ek-huis-groep"},
React.createElement("div",{className:"ek-huis-groep-titel"},React.createElement("strong",null,g.titel),React.createElement("span",null,g.sub)),
React.createElement("div",{className:"ek-huis-kaarten"},
g.types.map(t=>React.createElement(HuisKaart,{key:t,huis:t,selected:huisType===t,onClick:()=>setHuisType(t)}))))),
huis&&React.createElement("div",{className:"ek-huis-detail"},
React.createElement("div",{className:"ek-huis-detail-kop"},
React.createElement("span",{className:"ek-huis-detail-icon"},huis.icon),
React.createElement("div",null,React.createElement("strong",null,huis.naam),React.createElement("span",null,huis.subtitel," · ",huis.periode))),
React.createElement("p",null,huis.beschrijving),
React.createElement("div",{className:"ek-huis-indicators"},
React.createElement("div",null,React.createElement(IsoInd,{niveau:huis.isolatie,label:"🛡️ Isolatie"})),
React.createElement("div",null,React.createElement(IsoInd,{niveau:huis.massa,label:"🧱 Massa"})),
huis.vochtAdvies&&React.createElement("div",{className:"ek-vocht-badge"},"💧 ",huis.vochtAdvies==="ademend"?"Moet ademen":huis.vochtAdvies==="hygroscopisch"?"Hygroscopisch":huis.vochtAdvies==="condensrisico"?"Condensrisico":huis.vochtAdvies==="koudebruggen"?"Koudebruggen":huis.vochtAdvies==="ventilatie"?"Ventilatie cruciaal":"")),
huis.warnings&&huis.warnings.length>0&&React.createElement("div",{className:"ek-warnings"},
huis.warnings.map((w,i)=>React.createElement("div",{key:i,className:"ek-warning"},
React.createElement("div",{className:"ek-warning-kop"},React.createElement("span",null,w.icon),React.createElement("strong",null,w.titel)),
React.createElement("p",null,w.tekst)))),
huis.link&&React.createElement("a",{href:huis.link,target:"_blank",className:"ek-meer-link"},"📖 Meer →"))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"📐 Afmetingen"),
React.createElement("div",{className:"ek-row"},
React.createElement("div",{className:"ek-veld"},React.createElement("label",null,"Woonoppervlak"),React.createElement(NumInput,{value:m2,onChange:setM2,min:20,max:600,suffix:"m²"})),
React.createElement("div",{className:"ek-veld"},React.createElement("label",null,"Verdiepingen"),React.createElement("select",{className:"ek-select",value:verd,onChange:e=>setVerd(parseInt(e.target.value))},[1,2,3,4].map(n=>React.createElement("option",{key:n,value:n},n)))))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"🧱 Isolatie ",React.createElement(Info,{titel:"U-waarden",link:TOOL.source},"Lager is beter. Ongeïsoleerd: ~2,5. Goed: ~0,3.")),
React.createElement("div",{className:"ek-iso-toggle"},React.createElement("label",null,React.createElement("input",{type:"checkbox",checked:!isoAuto,onChange:e=>setIsoAuto(!e.target.checked)})," Handmatig aanpassen")),
isoAuto?React.createElement("div",{className:"ek-iso-auto"},
React.createElement("p",null,"Op basis van ",React.createElement("strong",null,huis.naam),":"),
React.createElement("div",{className:"ek-iso-summary"},
React.createElement("span",null,"Ramen: ",ISO_RAMEN.find(x=>x.id===isoRaam)?.naam),
React.createElement("span",null,"Dak: ",ISO_DAK.find(x=>x.id===isoDak)?.naam),
React.createElement("span",null,"Muren: ",ISO_MUUR.find(x=>x.id===isoMuur)?.naam),
React.createElement("span",null,"Vloer: ",ISO_VLOER.find(x=>x.id===isoVloer)?.naam))):
React.createElement("div",{className:"ek-iso-manual"},
[["raam",ISO_RAMEN,isoRaam,setIsoRaam,"Ramen"],["dak",ISO_DAK,isoDak,setIsoDak,"Dak"],["muur",ISO_MUUR,isoMuur,setIsoMuur,"Muren"],["vloer",ISO_VLOER,isoVloer,setIsoVloer,"Vloer"]].map(([key,opts,val,setVal,label])=>
React.createElement("div",{key,className:"ek-iso-veld"},
React.createElement("label",null,label),
React.createElement("div",{className:"ek-iso-opties"},
opts.map(o=>React.createElement("button",{key:o.id,type:"button",className:"ek-iso-opt"+(val===o.id?" actief":""),onClick:()=>setVal(o.id)},React.createElement("span",null,o.naam),React.createElement("small",null,o.desc)))))))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"📐 Oppervlakken"),
React.createElement("div",{className:"ek-opp-grid"},
[["Ramen",oppRaam],["Dak",oppDak],["Muren",oppMuur],["Vloer",oppVloer]].map(([l,v])=>
React.createElement("div",{key:l,className:"ek-opp-item"},React.createElement("small",null,l),React.createElement("strong",null,v," m²")))),
React.createElement("button",{type:"button",className:"ek-link-btn",onClick:()=>setOppAuto(!oppAuto)},oppAuto?"✎ Aanpassen":"↺ Auto"),
!oppAuto&&React.createElement("div",{className:"ek-opp-edit"},
React.createElement(NumInput,{value:oppRaam,onChange:setOppRaam,min:0,suffix:"m² ramen"}),
React.createElement(NumInput,{value:oppDak,onChange:setOppDak,min:0,suffix:"m² dak"}),
React.createElement(NumInput,{value:oppMuur,onChange:setOppMuur,min:0,suffix:"m² muren"}),
React.createElement(NumInput,{value:oppVloer,onChange:setOppVloer,min:0,suffix:"m² vloer"}))),

React.createElement("div",{className:"ek-nav"},
React.createElement("div"),
React.createElement("button",{className:"ek-btn primary",disabled:!stap1OK,onClick:()=>setStap(2)},"Volgende →")));

// STAP 2 RENDER
const renderStap2=()=>{
const hoofdInfo=VERWARMING.find(x=>x.id===hoofdV);
return React.createElement("div",{className:"ek-stap"},
React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"🔥 Verwarming"),
React.createElement("div",{className:"ek-veld"},
React.createElement("label",null,"Hoofdverwarming"),
React.createElement("select",{className:"ek-select groot",value:hoofdV,onChange:e=>setHoofdV(e.target.value)},
VERWARMING.map(v=>React.createElement("option",{key:v.id,value:v.id},v.naam)))),
hoofdInfo?.subsidie&&React.createElement("div",{className:"ek-subsidie-hint"},"💶 MaPrimeRénov' mogelijk"),
React.createElement("div",{className:"ek-veld",style:{marginTop:12}},
React.createElement("label",null,"Bijverwarming"),
React.createElement("select",{className:"ek-select",value:bijV,onChange:e=>setBijV(e.target.value)},
BIJVERW.map(v=>React.createElement("option",{key:v.id,value:v.id},v.naam))))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"🌡️ Stookgedrag"),
React.createElement("div",{className:"ek-stook-opties"},
STOOK.map(s=>React.createElement("button",{key:s.id,type:"button",className:"ek-stook-opt"+(stook===s.id?" actief":""),onClick:()=>setStook(s.id)},
React.createElement("strong",null,s.naam),React.createElement("small",null,s.desc)))),
stook==="vakantie"&&huis.massa>=4&&React.createElement("div",{className:"ek-warning"},
React.createElement("div",{className:"ek-warning-kop"},React.createElement("span",null,"⚠️"),React.createElement("strong",null,"Lange opwarmtijd")),
React.createElement("p",null,"Dit huis heeft hoge massa. Reken op 2-3 dagen."))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"⚡ Elektriciteit"),
React.createElement("div",{className:"ek-veld"},
React.createElement("label",null,"Basisverbruik"),
React.createElement(NumInput,{value:basisElec,onChange:setBasisElec,min:500,max:15000,suffix:"kWh/jaar"}),
React.createElement("small",{className:"ek-hint"},"Gemiddeld: 2500-4500")),
React.createElement("label",{className:"ek-checkbox",style:{marginTop:12}},
React.createElement("input",{type:"checkbox",checked:pvAan,onChange:e=>setPvAan(e.target.checked)})," Zonnepanelen"),
pvAan&&React.createElement("div",{className:"ek-row",style:{marginTop:12}},
React.createElement("div",{className:"ek-veld"},React.createElement("label",null,"Vermogen"),React.createElement(NumInput,{value:pvKWp,onChange:setPvKWp,min:0.5,max:20,suffix:"kWp"})),
React.createElement("div",{className:"ek-veld"},React.createElement("label",null,"Oriëntatie"),React.createElement("select",{className:"ek-select",value:pvOrient,onChange:e=>setPvOrient(e.target.value)},
PV_ORIENT.map(o=>React.createElement("option",{key:o.id,value:o.id},o.naam+(o.factor<1?` (${Math.round(o.factor*100)}%)`:"")))))) ),

React.createElement("section",{className:"ek-sectie"},
React.createElement("button",{type:"button",className:"ek-accordion",onClick:()=>setToonPrijzen(!toonPrijzen)},
React.createElement("span",null,"💶 Energieprijzen"),React.createElement("span",null,toonPrijzen?"−":"+")),
toonPrijzen&&React.createElement("div",{className:"ek-prijzen"},
Object.entries(BRANDSTOF).map(([k,v])=>React.createElement("div",{key:k,className:"ek-prijs-veld"},
React.createElement("label",null,v.naam),
React.createElement(NumInput,{value:prijzen[k],onChange:val=>setPrijzen(p=>({...p,[k]:val})),min:0,suffix:"€/"+v.eenheid}))))),

React.createElement("div",{className:"ek-nav"},
React.createElement("button",{className:"ek-btn",onClick:()=>setStap(1)},"← Terug"),
React.createElement("button",{className:"ek-btn primary",onClick:()=>setStap(3)},"Resultaat →")));
};

// STAP 3 RENDER
const renderStap3=()=>{
const verhuurWarn=DPE_VERHUUR[dpe.letter];
const relSubs=SUBSIDIES.filter(s=>s.rel(huis));
return React.createElement("div",{className:"ek-stap"},
React.createElement("section",{className:"ek-sectie licht"},
React.createElement("div",{className:"ek-result-huis"},
React.createElement("span",{className:"ek-result-icon"},huis.icon),
React.createElement("div",null,React.createElement("strong",null,huis.naam),React.createElement("span",null,m2," m² · ",zoneInfo.name)))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"💰 Energiekosten"),
React.createElement("div",{className:"ek-kosten-detail"},
React.createElement("div",{className:"ek-kost-regel"},React.createElement("span",null,"Verwarming"),React.createElement("span",null,euro(kosten.verwarming))),
React.createElement("div",{className:"ek-kost-regel"},React.createElement("span",null,"Elektriciteit"),React.createElement("span",null,euro(kosten.elektra))),
pvAan&&React.createElement("div",{className:"ek-kost-regel groen"},React.createElement("span",null,"PV besparing"),React.createElement("span",null,"− ",euro(kosten.pvBesp))),
React.createElement("div",{className:"ek-kost-regel totaal"},React.createElement("span",null,"Totaal"),React.createElement("span",null,euro(kosten.totaal)))),
React.createElement("div",{className:"ek-band"},"Bandbreedte: ",euro(kosten.totaal*(1-bb))," – ",euro(kosten.totaal*(1+bb)),"/jaar")),

React.createElement("section",{className:"ek-sectie"},
React.createElement("h3",null,"📊 DPE-indicatie ",React.createElement(Info,{titel:"Wat is DPE?"},"Verplicht bij verkoop/verhuur. Dit is een indicatie.")),
React.createElement("div",{className:"ek-dpe-result"},
React.createElement("div",{className:"ek-dpe-letter",style:{background:dpe.kleur}},dpe.letter),
React.createElement("div",{className:"ek-dpe-tekst"},React.createElement("strong",null,dpe.tekst),React.createElement("span",null,dpe.waarde," kWh/m²/jaar"))),
React.createElement(DPEBalk,{letter:dpe.letter}),
verhuurWarn&&React.createElement("div",{className:"ek-warning rood"},
React.createElement("div",{className:"ek-warning-kop"},React.createElement("span",null,"⚠️"),React.createElement("strong",null,"Verhuurverbod")),
React.createElement("p",null,verhuurWarn)),
React.createElement("div",{className:"ek-dpe-info"},
React.createElement("strong",null,"Verhuurverboden:"),
React.createElement("ul",null,
React.createElement("li",null,"G: sinds 1-1-2025"),
React.createElement("li",null,"F: vanaf 1-1-2028"),
React.createElement("li",null,"E: vanaf 1-1-2034")))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("button",{type:"button",className:"ek-accordion",onClick:()=>setToonSubsidies(!toonSubsidies)},
React.createElement("span",null,"💶 MaPrimeRénov'"),React.createElement("span",null,toonSubsidies?"−":"+")),
toonSubsidies&&React.createElement("div",{className:"ek-subsidies"},
React.createElement("table",{className:"ek-tabel"},
React.createElement("tbody",null,relSubs.map(s=>React.createElement("tr",{key:s.naam},React.createElement("td",null,s.naam),React.createElement("td",null,s.bedrag))))),
React.createElement("p",null,React.createElement("strong",null,"Let op:")," Via RGE-vakman."),
React.createElement("div",{className:"ek-links"},
React.createElement("a",{href:"https://www.maprimerenov.gouv.fr",target:"_blank"},"🔗 MaPrimeRénov'"),
React.createElement("a",{href:"https://france-renov.gouv.fr/annuaire-rge",target:"_blank"},"🔗 RGE-vakman")))),

React.createElement("section",{className:"ek-sectie"},
React.createElement("button",{type:"button",className:"ek-accordion",onClick:()=>setToonGrond(!toonGrond)},
React.createElement("span",null,"📋 Grondslagen"),React.createElement("span",null,toonGrond?"−":"+")),
toonGrond&&React.createElement("div",{className:"ek-grond"},
React.createElement("pre",null,
`WONING: ${huis.naam} (${huis.periode})
ZONE: ${zoneInfo.name} (${warmte.hdd} graaddagen)
OPPERVLAK: ${m2} m² × ${verd} = ${volume} m³

U-WAARDEN (W/m²·K)
Ramen: ${U.raam} (${opp.raam} m²)
Dak: ${U.dak} (${opp.dak} m²)
Muren: ${U.muur} (${opp.muur} m²)
Vloer: ${U.vloer} (${opp.vloer} m²)

WARMTEVERLIES
Htr: ${fmt(warmte.Htr,1)} W/K
Hvent: ${fmt(warmte.Hvent,1)} W/K
Htot: ${fmt(warmte.Htot,1)} W/K

ENERGIE
Warmtevraag: ${fmt(warmte.Q,0)} kWh/jaar
DPE: ${dpe.waarde} kWh/m²/jaar → ${dpe.letter}`),
React.createElement("a",{href:TOOL.source,target:"_blank",className:"ek-meer-link"},"📖 Meer →"))),

React.createElement("div",{className:"ek-nav"},
React.createElement("button",{className:"ek-btn",onClick:()=>setStap(2)},"← Terug"),
React.createElement("button",{className:"ek-btn primary",onClick:()=>window.print()},"🖨️ Print")),
React.createElement("p",{className:"ek-disclaimer"},"Oriëntatiehulpmiddel — geen gecertificeerde DPE-audit."));
};

// MAIN RENDER
return React.createElement("div",{className:"ek-app"},
React.createElement("header",{className:"ek-header"},
React.createElement("div",{className:"ek-header-inner"},
React.createElement("div",{className:"ek-logo"},
React.createElement("span",{className:"ek-logo-dot"}),
React.createElement("span",null,TOOL.name)),
React.createElement("span",{className:"ek-versie"},"v",TOOL.version))),

stap1OK&&React.createElement(KostenBar,{totaal:kosten.totaal,bb}),

React.createElement("main",{className:"ek-main"},
React.createElement("div",{className:"ek-container"},
React.createElement("h1",null,"Energiekompas Frankrijk"),
React.createElement("p",{className:"ek-intro"},"Bereken energiekosten en DPE-indicatie van uw woning"),
React.createElement(Voortgang,{stap}),
stap===1&&renderStap1(),
stap===2&&renderStap2(),
stap===3&&renderStap3())),

React.createElement("footer",{className:"ek-footer"},
"© ",new Date().getFullYear()," ",
React.createElement("a",{href:"https://infofrankrijk.com",target:"_blank"},"InfoFrankrijk.com"),
" · ",
React.createElement("a",{href:TOOL.source,target:"_blank"},"Achtergrond")));
}

ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App));
})();
