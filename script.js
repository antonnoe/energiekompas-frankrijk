// ============================================================================
// ENERGIEKOMPAS FRANKRIJK v2.0
// Volledige herziening: betere UX, Franse context, educatieve laag
// ============================================================================

(function () {
  "use strict";
  
  const { useEffect, useMemo, useState, useCallback, useRef } = React;

  const TOOL = {
    name: "Energiekompas Frankrijk",
    version: "2.0",
    source: "https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"
  };

  // ==========================================================================
  // KLIMAATZONES
  // ==========================================================================
  const ZONES = [
    { id: "med", name: "Méditerranée", desc: "Kust + achterland", hdd: 1400, pvYield: 1450 },
    { id: "ouest", name: "Atlantisch / Zuid-West", desc: "Bordeaux, Bretagne", hdd: 1900, pvYield: 1250 },
    { id: "paris", name: "Île-de-France / Noord", desc: "Parijs, Lille", hdd: 2200, pvYield: 1150 },
    { id: "centre", name: "Centraal / Bourgogne", desc: "Lyon, Dijon", hdd: 2500, pvYield: 1200 },
    { id: "est", name: "Oost / Elzas", desc: "Straatsburg, Nancy", hdd: 2800, pvYield: 1150 },
    { id: "mont", name: "Bergen", desc: "Alpen, Pyrénées", hdd: 3400, pvYield: 1100 }
  ];

  const DEPT_TO_ZONE = {
    "04":"med","05":"med","06":"med","11":"med","13":"med","30":"med","34":"med",
    "66":"med","83":"med","84":"med","20":"med",
    "16":"ouest","17":"ouest","24":"ouest","33":"ouest","40":"ouest","47":"ouest",
    "64":"ouest","79":"ouest","85":"ouest","86":"ouest","87":"ouest","44":"ouest",
    "56":"ouest","29":"ouest","22":"ouest","35":"ouest","49":"ouest","50":"ouest",
    "14":"ouest","53":"ouest","72":"ouest","41":"ouest","37":"ouest",
    "09":"mont","12":"mont","15":"mont","19":"mont","31":"mont","32":"mont",
    "38":"mont","42":"mont","43":"mont","46":"mont","48":"mont","63":"mont",
    "65":"mont","73":"mont","74":"mont","81":"mont","82":"mont",
    "08":"est","10":"est","25":"est","39":"est","52":"est","54":"est","55":"est",
    "57":"est","67":"est","68":"est","70":"est","88":"est","90":"est","21":"est","71":"est",
    "75":"paris","77":"paris","78":"paris","91":"paris","92":"paris","93":"paris",
    "94":"paris","95":"paris","59":"paris","62":"paris","60":"paris","80":"paris",
    "02":"paris","51":"paris","76":"paris","27":"paris","28":"paris","45":"paris"
  };

  function zoneFromPostalCode(cp) {
    if (!cp || !/^\d{5}$/.test(cp)) return null;
    return DEPT_TO_ZONE[cp.slice(0,2)] || "centre";
  }

  // ==========================================================================
  // WONINGTYPES - Franse context
  // ==========================================================================
  const WONING_TYPES = {
    pierre: {
      key: "pierre", label: "Oude stenen woning", periode: "vóór 1948",
      desc: "Dikke natuurstenen muren", icon: "🏚️",
      defaults: { wallU:2.0, roofU:3.0, winU:5.8, floorU:1.2, ach:0.8 },
      info: {
        title: "Oude stenen woningen",
        text: "Muren van 50-80 cm natuursteen lijken goed te isoleren, maar hebben slechts R≈0,8 m²·K/W. Ze zijn traag in opwarmen én afkoelen.",
        link: "https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"
      },
      areaFactors: { win:0.12, roof:0.55, wall:1.4, floor:0.55 }
    },
    pavillon: {
      key: "pavillon", label: "Traditioneel huis", periode: "1948–1990",
      desc: "Parpaing of baksteen", icon: "🏠",
      defaults: { wallU:1.2, roofU:1.5, winU:2.9, floorU:0.8, ach:0.6 },
      info: {
        title: "Huizen 1948-1990",
        text: "Parpaings (betonblokken) isoleren slecht: R=0,22 voor 20cm. Vaak later wat isolatie toegevoegd.",
        link: "https://infofrankrijk.com/de-isolatie-van-het-franse-huis/"
      },
      areaFactors: { win:0.15, roof:0.50, wall:1.2, floor:0.50 }
    },
    recent: {
      key: "recent", label: "Recenter huis", periode: "1990–2012",
      desc: "RT1990/2000/2005 norm", icon: "🏡",
      defaults: { wallU:0.5, roofU:0.3, winU:1.8, floorU:0.5, ach:0.5 },
      info: { title: "Huizen 1990-2012", text: "Eerste generatie thermische regelgeving.", link: null },
      areaFactors: { win:0.16, roof:0.50, wall:1.1, floor:0.50 }
    },
    moderne: {
      key: "moderne", label: "Moderne woning", periode: "na 2012",
      desc: "RT2012 of RE2020", icon: "🏢",
      defaults: { wallU:0.25, roofU:0.18, winU:1.4, floorU:0.3, ach:0.4 },
      info: { title: "RT2012/RE2020", text: "Strenge isolatie-eisen, zeer energiezuinig.", link: null },
      areaFactors: { win:0.18, roof:0.50, wall:1.0, floor:0.50 }
    },
    appartement: {
      key: "appartement", label: "Appartement", periode: "wisselend",
      desc: "Minder buitenoppervlak", icon: "🏬",
      defaults: { wallU:1.0, roofU:0.5, winU:2.5, floorU:0.5, ach:0.5 },
      info: { title: "Appartementen", text: "Minder warmteverlies door gedeelde muren/vloeren.", link: null },
      areaFactors: { win:0.12, roof:0.15, wall:0.6, floor:0.15 }
    }
  };

  // ==========================================================================
  // ISOLATIE-OPTIES
  // ==========================================================================
  const ISOLATIE = {
    ramen: [
      { key:"enkel", label:"Enkel glas", u:5.8, desc:"1 glaslaag", info:"Laat ~6× meer warmte door dan HR++." },
      { key:"dubbel_oud", label:"Dubbel glas (oud)", u:2.9, desc:"Vóór 2000", info:"Al veel beter, maar 2× slechter dan HR++." },
      { key:"dubbel_hr", label:"HR / HR+", u:1.8, desc:"Na ~2000", info:"Coating houdt warmte tegen." },
      { key:"hr_plus", label:"HR++ / Triple", u:1.2, desc:"Modern", info:"Huidige standaard nieuwbouw." }
    ],
    dak: [
      { key:"geen", label:"Geen isolatie", u:3.0, desc:"Ongeïsoleerd", info:"Grootste bron warmteverlies." },
      { key:"matig", label:"Matig (5-10 cm)", u:0.8, desc:"Dunne laag", info:"Helpt al enorm." },
      { key:"goed", label:"Goed (15-20 cm)", u:0.3, desc:"R≈5", info:"Renovatiestandaard." },
      { key:"zeer_goed", label:"Zeer goed (>25 cm)", u:0.18, desc:"R>6", info:"Nieuwbouwniveau." }
    ],
    muren: [
      { key:"geen", label:"Geen isolatie", u:2.0, desc:"Kaal steen/beton", info:"Parpaing 20cm: R=0,22." },
      { key:"matig", label:"Matig (3-6 cm)", u:0.8, desc:"Dunne isolatie", info:"4cm piepschuim verdubbelt R-waarde." },
      { key:"goed", label:"Goed (10-15 cm)", u:0.35, desc:"R≈3,5", info:"Huidige standaard." },
      { key:"zeer_goed", label:"Zeer goed (>18 cm)", u:0.20, desc:"R>5", info:"Nieuwbouwniveau." }
    ],
    vloer: [
      { key:"geen", label:"Geen isolatie", u:1.2, desc:"Direct op grond", info:"Vaak vergeten, wel belangrijk voor comfort." },
      { key:"matig", label:"Matig", u:0.5, desc:"Basis isolatie", info:"Geïsoleerde kruipruimte." },
      { key:"goed", label:"Goed", u:0.25, desc:"R≈4", info:"Moderne vloerisolatie." }
    ]
  };

  // ==========================================================================
  // VERWARMINGSSYSTEMEN
  // ==========================================================================
  const VERWARMING_HOOFD = [
    { key:"warmtepomp_lucht", label:"Warmtepomp (lucht/water)", type:"elec", scop:3.2, subsidie:true,
      info:"SCOP 3,2 = voor 1 kWh stroom krijgt u 3,2 kWh warmte." },
    { key:"warmtepomp_grond", label:"Warmtepomp (bodem)", type:"elec", scop:4.0, subsidie:true,
      info:"Efficiënter maar duurder in aanschaf." },
    { key:"elec_direct", label:"Elektrisch (convectoren)", type:"elec", scop:1.0, subsidie:false,
      info:"1-op-1 omzetting, relatief duur in gebruik." },
    { key:"gas", label:"Aardgas (cv-ketel)", type:"gas", eta:0.92, subsidie:false,
      info:"In Frankrijk minder gebruikelijk dan in NL." },
    { key:"fioul", label:"Stookolie (fioul)", type:"fioul", eta:0.85, subsidie:false,
      info:"Gebruikelijk op platteland. Nieuwbouw verboden sinds 2022." },
    { key:"pellet_ketel", label:"Pelletketel", type:"pellet", eta:0.90, subsidie:true,
      info:"Duurzaam alternatief met automatische aanvoer." },
    { key:"hout", label:"Houtkachel", type:"hout", eta:0.65, subsidie:true,
      info:"Gezellig maar minder efficiënt. Insert: 75-85%." },
    { key:"propaan", label:"Propaan (tank)", type:"propaan", eta:0.90, subsidie:false,
      info:"Optie waar geen aardgasnet is." }
  ];

  const VERWARMING_BIJ = [
    { key:"geen", label:"Geen bijverwarming", share:0 },
    { key:"hout", label:"Houtkachel", type:"hout", eta:0.70, share:0.15 },
    { key:"pellet", label:"Pelletkachel", type:"pellet", eta:0.85, share:0.15 },
    { key:"elec", label:"Elektrisch", type:"elec", scop:1.0, share:0.10 }
  ];

  // ==========================================================================
  // ENERGIEPRIJZEN
  // ==========================================================================
  const ENERGIE = {
    elec:    { default:0.25, unit:"kWh", label:"Elektriciteit", kwhPer:1 },
    gas:     { default:1.20, unit:"m³", label:"Aardgas", kwhPer:10 },
    fioul:   { default:1.10, unit:"L", label:"Stookolie", kwhPer:10 },
    pellet:  { default:0.38, unit:"kg", label:"Pellets", kwhPer:4.8 },
    hout:    { default:85, unit:"stère", label:"Hout", kwhPer:1800 },
    propaan: { default:2.10, unit:"L", label:"Propaan", kwhPer:7.1 }
  };

  // ==========================================================================
  // DPE
  // ==========================================================================
  const DPE_GRENZEN = [
    { letter:"A", max:70, color:"#2ecc71", desc:"Zeer energiezuinig" },
    { letter:"B", max:110, color:"#7bed9f", desc:"Energiezuinig" },
    { letter:"C", max:180, color:"#f1c40f", desc:"Redelijk" },
    { letter:"D", max:250, color:"#f39c12", desc:"Gemiddeld" },
    { letter:"E", max:330, color:"#e67e22", desc:"Energieverslindend" },
    { letter:"F", max:420, color:"#e74c3c", desc:"Zeer energieverslindend" },
    { letter:"G", max:999, color:"#b71c1c", desc:"Extreem" }
  ];

  const DPE_VERHUUR = {
    G: "Vanaf 1-1-2025 niet meer verhuurbaar",
    F: "Vanaf 1-1-2028 niet meer verhuurbaar",
    E: "Vanaf 1-1-2034 niet meer verhuurbaar"
  };

  // ==========================================================================
  // SUBSIDIES (MaPrimeRénov')
  // ==========================================================================
  const SUBSIDIES = {
    dakisolatie: { label:"Dakisolatie", bedrag:"€15–25/m²" },
    muurisolatie_binnen: { label:"Muurisolatie (binnen)", bedrag:"€15–25/m²" },
    muurisolatie_buiten: { label:"Muurisolatie (buiten)", bedrag:"€40–75/m²" },
    warmtepomp_lucht: { label:"Warmtepomp lucht/water", bedrag:"€2.000–5.000" },
    warmtepomp_grond: { label:"Warmtepomp bodem", bedrag:"€5.000–11.000" },
    beglazing: { label:"HR++ beglazing", bedrag:"€40–100/raam" },
    pelletketel: { label:"Pelletketel", bedrag:"€1.500–5.500" },
    houtkachel: { label:"Houtkachel (insert)", bedrag:"€800–2.500" }
  };

  const PV_ORIENT = [
    { key:"Z", label:"Zuid", factor:1.00 },
    { key:"ZO", label:"Zuid-Oost", factor:0.95 },
    { key:"ZW", label:"Zuid-West", factor:0.95 },
    { key:"O", label:"Oost", factor:0.85 },
    { key:"W", label:"West", factor:0.85 },
    { key:"NO", label:"Noord-Oost", factor:0.70 },
    { key:"NW", label:"Noord-West", factor:0.70 },
    { key:"N", label:"Noord", factor:0.55 }
  ];

  const STOOKGEDRAG = [
    { key:"continu", label:"Continu aan", factor:1.0 },
    { key:"dag_nacht", label:"Dag/nacht regeling", factor:0.90 },
    { key:"spaarzaam", label:"Spaarzaam", factor:0.80 },
    { key:"minimaal", label:"Vorstvrij / vakantie", factor:0.65 }
  ];

  const AANWEZIGHEID = [
    { key:"permanent", label:"Permanent bewoond", factor:1.0 },
    { key:"veel_thuis", label:"Veel thuis", factor:0.95 },
    { key:"werkend", label:"Werkend", factor:0.85 },
    { key:"vakantiewoning", label:"Vakantiewoning", factor:0.50 }
  ];

  // ==========================================================================
  // HULPFUNCTIES
  // ==========================================================================
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const num = (v, d=0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const formatEuro = (v) => num(v).toLocaleString("nl-NL", { style:"currency", currency:"EUR", maximumFractionDigits:0 });
  const formatNum = (v, d=0) => num(v).toLocaleString("nl-NL", { minimumFractionDigits:d, maximumFractionDigits:d });

  function schatOppervlakken(m2, verd, type) {
    const t = WONING_TYPES[type] || WONING_TYPES.pavillon;
    const f = t.areaFactors;
    const fp = m2 / Math.max(1, verd);
    return {
      ramen: Math.round(m2 * f.win),
      dak: Math.round(fp * f.roof),
      muren: Math.round(m2 * f.wall),
      vloer: Math.round(fp * f.floor)
    };
  }

  function berekenWarmtevraag(p) {
    const z = ZONES.find(x => x.id === p.zone) || ZONES[2];
    const Htr = (p.uW.ramen * p.opp.ramen) + (p.uW.dak * p.opp.dak) + 
                (p.uW.muren * p.opp.muren) + (p.uW.vloer * p.opp.vloer);
    const Hvent = 0.34 * p.ach * p.volume;
    const Htot = Htr + Hvent;
    const Q = (Htot * z.hdd * 24) / 1000;
    const stook = STOOKGEDRAG.find(x => x.key === p.stook) || STOOKGEDRAG[1];
    const aanw = AANWEZIGHEID.find(x => x.key === p.aanw) || AANWEZIGHEID[0];
    return { warmte: Q * stook.factor * aanw.factor, Htot, Htr, Hvent, hdd: z.hdd, raw: Q };
  }

  function berekenKosten(p) {
    const bijv = VERWARMING_BIJ.find(x => x.key === p.bijverw) || VERWARMING_BIJ[0];
    const warmteHoofd = p.warmte * (1 - bijv.share);
    const warmteBij = p.warmte * bijv.share;
    const hoofd = VERWARMING_HOOFD.find(x => x.key === p.hoofdverw) || VERWARMING_HOOFD[0];

    let kwhHoofd, kostenHoofd;
    if (hoofd.type === "elec") {
      kwhHoofd = warmteHoofd / (hoofd.scop || 1);
      kostenHoofd = kwhHoofd * p.prijzen.elec;
    } else {
      const br = ENERGIE[hoofd.type];
      const inp = warmteHoofd / (hoofd.eta || 0.9);
      kwhHoofd = inp;
      kostenHoofd = (inp / br.kwhPer) * p.prijzen[hoofd.type];
    }

    let kwhBij = 0, kostenBij = 0;
    if (bijv.key !== "geen") {
      if (bijv.type === "elec") {
        kwhBij = warmteBij / (bijv.scop || 1);
        kostenBij = kwhBij * p.prijzen.elec;
      } else {
        const br = ENERGIE[bijv.type];
        const inp = warmteBij / (bijv.eta || 0.8);
        kwhBij = inp;
        kostenBij = (inp / br.kwhPer) * p.prijzen[bijv.type];
      }
    }

    const kostenBasis = p.basisElec * p.prijzen.elec;

    let pvOpbr = 0, pvBesp = 0;
    if (p.pv && p.pv.kWp > 0) {
      const z = ZONES.find(x => x.id === p.zone) || ZONES[2];
      const o = PV_ORIENT.find(x => x.key === p.pv.orient) || PV_ORIENT[0];
      pvOpbr = p.pv.kWp * z.pvYield * o.factor;
      const eigen = Math.min(pvOpbr * 0.65, kwhHoofd + kwhBij + p.basisElec);
      pvBesp = eigen * p.prijzen.elec;
    }

    let zwembadKwh = 0, zwembadKost = 0;
    if (p.zwembad && p.zwembad.actief) {
      zwembadKwh = (p.zwembad.volume || 50) * 20;
      zwembadKost = zwembadKwh * p.prijzen.elec;
    }

    const totaal = kostenHoofd + kostenBij + kostenBasis + zwembadKost - pvBesp;
    const totaalKwh = p.warmte + p.basisElec + zwembadKwh;

    return {
      verw: { hoofd: kostenHoofd, bij: kostenBij },
      elec: { basis: kostenBasis, zwembad: zwembadKost },
      pv: { opbr: pvOpbr, besp: pvBesp },
      totaal, totaalKwh
    };
  }

  function bepaalDPE(kwhM2) {
    for (const g of DPE_GRENZEN) if (kwhM2 <= g.max) return g;
    return DPE_GRENZEN[6];
  }

  // ==========================================================================
  // REACT COMPONENTEN
  // ==========================================================================

  // Info button [?]
  function Info({ title, children, link }) {
    const [open, setOpen] = useState(false);
    return React.createElement("span", { className: "ek-info-wrap" },
      React.createElement("button", {
        type: "button", className: "ek-info-btn",
        onClick: () => setOpen(!open), "aria-label": "Info"
      }, "?"),
      open && React.createElement("div", { className: "ek-info-popup" },
        title && React.createElement("div", { className: "ek-info-title" }, title),
        React.createElement("div", { className: "ek-info-text" }, children),
        link && React.createElement("a", { href: link, target: "_blank", rel: "noopener", className: "ek-info-link" },
          "📖 Meer lezen op InfoFrankrijk →")
      )
    );
  }

  // Nummer input (geen agressieve clamp)
  function NumInput({ value, onChange, min, max, suffix, placeholder }) {
    const [local, setLocal] = useState(String(value));
    const ref = useRef(null);

    useEffect(() => {
      if (document.activeElement !== ref.current) setLocal(String(value));
    }, [value]);

    const handleChange = (e) => {
      const raw = e.target.value;
      setLocal(raw);
      const n = parseFloat(raw);
      if (Number.isFinite(n)) onChange(n);
    };

    const handleBlur = () => {
      let n = parseFloat(local);
      if (!Number.isFinite(n)) n = min || 0;
      if (min !== undefined) n = Math.max(min, n);
      if (max !== undefined) n = Math.min(max, n);
      setLocal(String(n));
      onChange(n);
    };

    return React.createElement("div", { className: "ek-num-wrap" },
      React.createElement("input", {
        ref, type: "text", inputMode: "decimal", className: "ek-input",
        value: local, onChange: handleChange, onBlur: handleBlur, placeholder
      }),
      suffix && React.createElement("span", { className: "ek-suffix" }, suffix)
    );
  }

  // Kaarten voor woningtype
  function Kaarten({ opties, waarde, onChange }) {
    return React.createElement("div", { className: "ek-kaarten" },
      opties.map(o => React.createElement("button", {
        key: o.key, type: "button",
        className: "ek-kaart" + (waarde === o.key ? " actief" : ""),
        onClick: () => onChange(o.key)
      },
        o.icon && React.createElement("span", { className: "ek-kaart-icon" }, o.icon),
        React.createElement("span", { className: "ek-kaart-label" }, o.label),
        o.periode && React.createElement("small", null, o.periode)
      ))
    );
  }

  // Voortgangsbalk
  function Voortgang({ stap }) {
    return React.createElement("div", { className: "ek-voortgang" },
      [1,2,3].map(n => React.createElement("div", {
        key: n,
        className: "ek-vg-stap" + (n < stap ? " done" : (n === stap ? " actief" : ""))
      },
        React.createElement("div", { className: "ek-vg-num" }, n),
        React.createElement("div", { className: "ek-vg-label" },
          n === 1 ? "Woning" : (n === 2 ? "Verwarming" : "Resultaat"))
      ))
    );
  }

  // DPE balk
  function DPEBalk({ letter, waarde }) {
    const idx = DPE_GRENZEN.findIndex(g => g.letter === letter);
    const pos = ((idx + 0.5) / 7) * 100;
    return React.createElement("div", { className: "ek-dpe-bar-wrap" },
      React.createElement("div", { className: "ek-dpe-bar" },
        DPE_GRENZEN.map(g => React.createElement("div", {
          key: g.letter, className: "ek-dpe-seg", style: { backgroundColor: g.color }
        })),
        React.createElement("div", { className: "ek-dpe-ptr", style: { left: pos + "%" } })
      ),
      React.createElement("div", { className: "ek-dpe-labels" },
        DPE_GRENZEN.map(g => React.createElement("span", { key: g.letter }, g.letter))
      )
    );
  }

  // Kostenbar
  function Kostenbar({ kosten, onz }) {
    const lo = kosten * (1 - onz), hi = kosten * (1 + onz);
    return React.createElement("div", { className: "ek-kostenbar" },
      React.createElement("div", { className: "ek-kb-inner" },
        React.createElement("span", { className: "ek-kb-label" }, "Geschatte energiekosten:"),
        React.createElement("span", { className: "ek-kb-bedrag" }, formatEuro(lo), " – ", formatEuro(hi), " / jaar"),
        React.createElement("span", { className: "ek-kb-maand" }, formatEuro(lo/12), " – ", formatEuro(hi/12), " / maand")
      )
    );
  }

  // ==========================================================================
  // HOOFDCOMPONENT
  // ==========================================================================
  function App() {
    const [stap, setStap] = useState(1);

    // Stap 1
    const [postcode, setPostcode] = useState("");
    const [zone, setZone] = useState("centre");
    const [zoneLock, setZoneLock] = useState(false);
    const [woningType, setWoningType] = useState("pavillon");
    const [m2, setM2] = useState(120);
    const [verd, setVerd] = useState(1);

    const [isoRamen, setIsoRamen] = useState("dubbel_oud");
    const [isoDak, setIsoDak] = useState("matig");
    const [isoMuren, setIsoMuren] = useState("matig");
    const [isoVloer, setIsoVloer] = useState("geen");

    const [oppEdit, setOppEdit] = useState(false);
    const [oppR, setOppR] = useState(0);
    const [oppD, setOppD] = useState(0);
    const [oppM, setOppM] = useState(0);
    const [oppV, setOppV] = useState(0);

    // Stap 2
    const [hoofdverw, setHoofdverw] = useState("elec_direct");
    const [bijverw, setBijverw] = useState("geen");
    const [stook, setStook] = useState("dag_nacht");
    const [aanw, setAanw] = useState("permanent");
    const [basisElec, setBasisElec] = useState(3500);

    const [pvAan, setPvAan] = useState(false);
    const [pvKWp, setPvKWp] = useState(3);
    const [pvOrient, setPvOrient] = useState("Z");

    const [zwembadAan, setZwembadAan] = useState(false);
    const [zwembadVol, setZwembadVol] = useState(50);

    const [prijzen, setPrijzen] = useState(
      Object.fromEntries(Object.entries(ENERGIE).map(([k,v]) => [k, v.default]))
    );

    const [toonPrijzen, setToonPrijzen] = useState(false);
    const [toonSubsidies, setToonSubsidies] = useState(false);
    const [toonGrond, setToonGrond] = useState(false);

    // Auto zone
    useEffect(() => {
      if (!zoneLock) {
        const z = zoneFromPostalCode(postcode);
        if (z && z !== zone) setZone(z);
      }
    }, [postcode, zoneLock]);

    // Auto oppervlakken
    useEffect(() => {
      if (!oppEdit) {
        const s = schatOppervlakken(m2, verd, woningType);
        setOppR(s.ramen); setOppD(s.dak); setOppM(s.muren); setOppV(s.vloer);
      }
    }, [m2, verd, woningType, oppEdit]);

    // Auto isolatie uit type
    useEffect(() => {
      const t = WONING_TYPES[woningType];
      if (!t) return;
      const find = (arr, u) => arr.reduce((b, x) => Math.abs(x.u - u) < Math.abs(b.u - u) ? x : b, arr[0]).key;
      setIsoRamen(find(ISOLATIE.ramen, t.defaults.winU));
      setIsoDak(find(ISOLATIE.dak, t.defaults.roofU));
      setIsoMuren(find(ISOLATIE.muren, t.defaults.wallU));
      setIsoVloer(find(ISOLATIE.vloer, t.defaults.floorU));
    }, [woningType]);

    // Berekeningen
    const uW = useMemo(() => ({
      ramen: ISOLATIE.ramen.find(x => x.key === isoRamen)?.u || 2.9,
      dak: ISOLATIE.dak.find(x => x.key === isoDak)?.u || 1.5,
      muren: ISOLATIE.muren.find(x => x.key === isoMuren)?.u || 1.0,
      vloer: ISOLATIE.vloer.find(x => x.key === isoVloer)?.u || 0.8
    }), [isoRamen, isoDak, isoMuren, isoVloer]);

    const opp = useMemo(() => ({ ramen: oppR, dak: oppD, muren: oppM, vloer: oppV }), [oppR, oppD, oppM, oppV]);
    const ach = useMemo(() => WONING_TYPES[woningType]?.defaults.ach || 0.6, [woningType]);
    const volume = m2 * 2.5 * verd;

    const warmte = useMemo(() => berekenWarmtevraag({
      zone, uW, opp, ach, volume, stook, aanw
    }), [zone, uW, opp, ach, volume, stook, aanw]);

    const kosten = useMemo(() => berekenKosten({
      warmte: warmte.warmte, hoofdverw, bijverw, prijzen, basisElec, zone,
      pv: pvAan ? { kWp: pvKWp, orient: pvOrient } : null,
      zwembad: zwembadAan ? { actief: true, volume: zwembadVol } : null
    }), [warmte.warmte, hoofdverw, bijverw, prijzen, basisElec, zone, pvAan, pvKWp, pvOrient, zwembadAan, zwembadVol]);

    const dpe = useMemo(() => {
      const kwhM2 = kosten.totaalKwh / Math.max(m2, 20);
      return { ...bepaalDPE(kwhM2), waarde: Math.round(kwhM2) };
    }, [kosten.totaalKwh, m2]);

    const stap1OK = postcode.length === 5 && m2 >= 20;
    const onz = stap < 3 ? 0.20 : 0.12;

    const zoneInfo = ZONES.find(z => z.id === zone) || ZONES[2];
    const typeInfo = WONING_TYPES[woningType] || WONING_TYPES.pavillon;
    const hoofdInfo = VERWARMING_HOOFD.find(x => x.key === hoofdverw);

    // =======================================================================
    // STAP 1
    // =======================================================================
    const renderStap1 = () => React.createElement("div", { className: "ek-stap" },
      // Locatie
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "📍 Locatie",
          React.createElement(Info, { title: "Klimaatzones", link: TOOL.source },
            "Frankrijk heeft grote klimaatverschillen. De Méditerranée heeft ~1400 graaddagen/jaar, de bergen tot 3400.")),
        React.createElement("div", { className: "ek-row" },
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Postcode"),
            React.createElement("input", {
              type: "text", className: "ek-input", value: postcode, maxLength: 5,
              inputMode: "numeric", placeholder: "bijv. 33100",
              onChange: e => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 5))
            }),
            React.createElement("small", null, postcode.length === 5 ? "✓ " + zoneInfo.name : "Vul 5 cijfers in")
          ),
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Klimaatzone"),
            React.createElement("select", {
              className: "ek-select", value: zone,
              onChange: e => { setZone(e.target.value); setZoneLock(true); }
            }, ZONES.map(z => React.createElement("option", { key: z.id, value: z.id }, z.name + " – " + z.desc)))
          )
        )
      ),

      // Woningtype
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🏠 Type woning",
          React.createElement(Info, { title: "Woningtypes", link: TOOL.source },
            "Het bouwjaar bepaalt grotendeels de isolatiekwaliteit.")),
        React.createElement(Kaarten, {
          opties: Object.values(WONING_TYPES), waarde: woningType, onChange: setWoningType
        }),
        typeInfo.info && React.createElement("div", { className: "ek-type-info" },
          React.createElement("strong", null, typeInfo.info.title),
          React.createElement("p", null, typeInfo.info.text),
          typeInfo.info.link && React.createElement("a", { href: typeInfo.info.link, target: "_blank" }, "📖 Meer lezen →")
        )
      ),

      // Afmetingen
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "📐 Afmetingen"),
        React.createElement("div", { className: "ek-row" },
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Woonoppervlak"),
            React.createElement(NumInput, { value: m2, onChange: setM2, min: 20, max: 600, suffix: "m²" })
          ),
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Verdiepingen"),
            React.createElement("select", { className: "ek-select", value: verd, onChange: e => setVerd(+e.target.value) },
              [1,2,3,4].map(n => React.createElement("option", { key: n, value: n }, n)))
          )
        )
      ),

      // Isolatie
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🧱 Isolatie",
          React.createElement(Info, { title: "U-waarden", link: TOOL.source },
            "Hoe lager de U-waarde, hoe beter geïsoleerd. Ongeïsoleerd: U≈2, goed: U≈0,3.")),

        ["ramen", "dak", "muren", "vloer"].map(cat => {
          const opts = ISOLATIE[cat];
          const val = cat === "ramen" ? isoRamen : cat === "dak" ? isoDak : cat === "muren" ? isoMuren : isoVloer;
          const setVal = cat === "ramen" ? setIsoRamen : cat === "dak" ? setIsoDak : cat === "muren" ? setIsoMuren : setIsoVloer;
          const label = cat === "ramen" ? "Ramen" : cat === "dak" ? "Dak / zolder" : cat === "muren" ? "Buitenmuren" : "Vloer";

          return React.createElement("div", { key: cat, className: "ek-iso-groep" },
            React.createElement("label", null, label,
              React.createElement(Info, null, opts.find(x => x.key === val)?.info || "")),
            React.createElement("div", { className: "ek-radio-groep" },
              opts.map(o => React.createElement("label", {
                key: o.key, className: "ek-radio" + (val === o.key ? " actief" : "")
              },
                React.createElement("input", {
                  type: "radio", name: "iso-" + cat, checked: val === o.key,
                  onChange: () => setVal(o.key)
                }),
                React.createElement("span", null, o.label),
                React.createElement("small", null, o.desc)
              ))
            )
          );
        })
      ),

      // Oppervlakken
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "📐 Geschatte oppervlakken",
          React.createElement(Info, null, "Op basis van woningtype en m² schatten we de oppervlakken. Deze bepalen het warmteverlies.")),
        React.createElement("div", { className: "ek-opp-grid" },
          [["Ramen", oppR], ["Dak", oppD], ["Muren", oppM], ["Vloer", oppV]].map(([l, v]) =>
            React.createElement("div", { key: l, className: "ek-opp-item" },
              React.createElement("span", null, l), React.createElement("strong", null, v + " m²")))
        ),
        React.createElement("button", {
          type: "button", className: "ek-link-btn", onClick: () => setOppEdit(!oppEdit)
        }, oppEdit ? "✓ Automatisch schatten" : "✎ Aanpassen"),
        oppEdit && React.createElement("div", { className: "ek-row ek-opp-edit" },
          React.createElement(NumInput, { value: oppR, onChange: setOppR, min: 0, suffix: "m² ramen" }),
          React.createElement(NumInput, { value: oppD, onChange: setOppD, min: 0, suffix: "m² dak" }),
          React.createElement(NumInput, { value: oppM, onChange: setOppM, min: 0, suffix: "m² muren" }),
          React.createElement(NumInput, { value: oppV, onChange: setOppV, min: 0, suffix: "m² vloer" })
        )
      ),

      // Nav
      React.createElement("div", { className: "ek-nav" },
        React.createElement("div"),
        React.createElement("button", {
          className: "ek-btn primary", disabled: !stap1OK, onClick: () => setStap(2)
        }, "Volgende →")
      )
    );

    // =======================================================================
    // STAP 2
    // =======================================================================
    const renderStap2 = () => React.createElement("div", { className: "ek-stap" },
      // Hoofdverwarming
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🔥 Hoofdverwarming",
          React.createElement(Info, null, "Het type bepaalt de efficiëntie. Warmtepomp SCOP 3-4 is 3-4× efficiënter dan direct elektrisch.")),
        React.createElement("select", {
          className: "ek-select groot", value: hoofdverw, onChange: e => setHoofdverw(e.target.value)
        }, VERWARMING_HOOFD.map(v => React.createElement("option", { key: v.key, value: v.key }, v.label))),
        hoofdInfo && React.createElement("div", { className: "ek-verw-info" },
          React.createElement("p", null, hoofdInfo.info),
          hoofdInfo.subsidie && React.createElement("span", { className: "ek-badge groen" }, "💶 MaPrimeRénov' mogelijk")
        )
      ),

      // Bijverwarming
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🪵 Bijverwarming"),
        React.createElement("select", {
          className: "ek-select", value: bijverw, onChange: e => setBijverw(e.target.value)
        }, VERWARMING_BIJ.map(v => React.createElement("option", { key: v.key, value: v.key }, v.label)))
      ),

      // Stookgedrag
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🌡️ Stookgedrag"),
        React.createElement("div", { className: "ek-row" },
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Verwarming"),
            React.createElement("select", { className: "ek-select", value: stook, onChange: e => setStook(e.target.value) },
              STOOKGEDRAG.map(s => React.createElement("option", { key: s.key, value: s.key }, s.label)))
          ),
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Aanwezigheid"),
            React.createElement("select", { className: "ek-select", value: aanw, onChange: e => setAanw(e.target.value) },
              AANWEZIGHEID.map(a => React.createElement("option", { key: a.key, value: a.key }, a.label)))
          )
        )
      ),

      // Basis elektra
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "⚡ Overig elektriciteit",
          React.createElement(Info, null, "Verlichting, koelkast, etc. Gemiddeld: 2.500-4.500 kWh/jaar.")),
        React.createElement(NumInput, { value: basisElec, onChange: setBasisElec, min: 500, max: 15000, suffix: "kWh/jaar" })
      ),

      // PV
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "☀️ Zonnepanelen"),
        React.createElement("label", { className: "ek-checkbox" },
          React.createElement("input", { type: "checkbox", checked: pvAan, onChange: e => setPvAan(e.target.checked) }),
          "Ik heb zonnepanelen"
        ),
        pvAan && React.createElement("div", { className: "ek-row sub" },
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Vermogen"),
            React.createElement(NumInput, { value: pvKWp, onChange: setPvKWp, min: 0.5, max: 20, suffix: "kWp" })
          ),
          React.createElement("div", { className: "ek-veld" },
            React.createElement("label", null, "Oriëntatie"),
            React.createElement("select", { className: "ek-select", value: pvOrient, onChange: e => setPvOrient(e.target.value) },
              PV_ORIENT.map(o => React.createElement("option", { key: o.key, value: o.key }, o.label)))
          )
        )
      ),

      // Zwembad
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("h3", null, "🏊 Zwembad"),
        React.createElement("label", { className: "ek-checkbox" },
          React.createElement("input", { type: "checkbox", checked: zwembadAan, onChange: e => setZwembadAan(e.target.checked) }),
          "Ik heb een verwarmd zwembad"
        ),
        zwembadAan && React.createElement("div", { className: "ek-row sub" },
          React.createElement(NumInput, { value: zwembadVol, onChange: setZwembadVol, min: 10, max: 200, suffix: "m³" })
        )
      ),

      // Prijzen
      React.createElement("div", { className: "ek-sectie" },
        React.createElement("button", {
          type: "button", className: "ek-accordion", onClick: () => setToonPrijzen(!toonPrijzen)
        }, React.createElement("span", null, "💶 Energieprijzen aanpassen"), React.createElement("span", null, toonPrijzen ? "−" : "+")),
        toonPrijzen && React.createElement("div", { className: "ek-prijzen-grid" },
          Object.entries(ENERGIE).map(([k, v]) => React.createElement("div", { key: k, className: "ek-prijs-veld" },
            React.createElement("label", null, v.label),
            React.createElement(NumInput, {
              value: prijzen[k], onChange: x => setPrijzen(p => ({ ...p, [k]: x })),
              min: 0, suffix: "€/" + v.unit
            })
          ))
        )
      ),

      // Nav
      React.createElement("div", { className: "ek-nav" },
        React.createElement("button", { className: "ek-btn", onClick: () => setStap(1) }, "← Terug"),
        React.createElement("button", { className: "ek-btn primary", onClick: () => setStap(3) }, "Bekijk resultaat →")
      )
    );

    // =======================================================================
    // STAP 3
    // =======================================================================
    const renderStap3 = () => {
      const verhuurWarn = DPE_VERHUUR[dpe.letter];

      return React.createElement("div", { className: "ek-stap" },
        // Kosten
        React.createElement("div", { className: "ek-sectie result" },
          React.createElement("h3", null, "💰 Energiekosten per jaar"),
          React.createElement("div", { className: "ek-kosten-detail" },
            React.createElement("div", { className: "ek-kost-regel" },
              React.createElement("span", null, "Verwarming (hoofd)"), React.createElement("span", null, formatEuro(kosten.verw.hoofd))),
            bijverw !== "geen" && React.createElement("div", { className: "ek-kost-regel" },
              React.createElement("span", null, "Verwarming (bij)"), React.createElement("span", null, formatEuro(kosten.verw.bij))),
            React.createElement("div", { className: "ek-kost-regel" },
              React.createElement("span", null, "Elektriciteit overig"), React.createElement("span", null, formatEuro(kosten.elec.basis))),
            zwembadAan && React.createElement("div", { className: "ek-kost-regel" },
              React.createElement("span", null, "Zwembad"), React.createElement("span", null, formatEuro(kosten.elec.zwembad))),
            pvAan && React.createElement("div", { className: "ek-kost-regel groen" },
              React.createElement("span", null, "PV besparing"), React.createElement("span", null, "− " + formatEuro(kosten.pv.besp))),
            React.createElement("div", { className: "ek-kost-regel totaal" },
              React.createElement("span", null, "Totaal"), React.createElement("span", null, formatEuro(kosten.totaal)))
          ),
          React.createElement("div", { className: "ek-band" },
            "Bandbreedte: ", formatEuro(kosten.totaal * (1 - onz)), " – ", formatEuro(kosten.totaal * (1 + onz)), " / jaar")
        ),

        // DPE
        React.createElement("div", { className: "ek-sectie result" },
          React.createElement("h3", null, "📊 DPE-indicatie",
            React.createElement(Info, { title: "Wat is DPE?" },
              "De DPE is verplicht bij verkoop/verhuur in Frankrijk. Deze tool geeft een indicatie – een officiële DPE vereist een gecertificeerde expert.")),
          React.createElement("div", { className: "ek-dpe-result" },
            React.createElement("div", { className: "ek-dpe-letter", style: { backgroundColor: dpe.color } }, dpe.letter),
            React.createElement("div", null,
              React.createElement("strong", null, dpe.desc),
              React.createElement("div", null, dpe.waarde, " kWh/m²/jaar"))
          ),
          React.createElement(DPEBalk, { letter: dpe.letter, waarde: dpe.waarde }),
          verhuurWarn && React.createElement("div", { className: "ek-warn" }, "⚠️ ", verhuurWarn),
          React.createElement("div", { className: "ek-dpe-info" },
            React.createElement("strong", null, "Verhuurverboden:"),
            React.createElement("ul", null,
              React.createElement("li", null, "G: vanaf 1-1-2025"),
              React.createElement("li", null, "F: vanaf 1-1-2028"),
              React.createElement("li", null, "E: vanaf 1-1-2034"))
          )
        ),

        // Subsidies
        React.createElement("div", { className: "ek-sectie" },
          React.createElement("button", {
            type: "button", className: "ek-accordion", onClick: () => setToonSubsidies(!toonSubsidies)
          }, React.createElement("span", null, "💶 MaPrimeRénov' subsidies"), React.createElement("span", null, toonSubsidies ? "−" : "+")),
          toonSubsidies && React.createElement("div", { className: "ek-subsidies" },
            React.createElement("p", null, "Op basis van DPE ", dpe.letter, " komt u mogelijk in aanmerking voor subsidies. Bedragen hangen af van inkomenscategorie."),
            React.createElement("table", { className: "ek-tabel" },
              React.createElement("thead", null,
                React.createElement("tr", null,
                  React.createElement("th", null, "Maatregel"),
                  React.createElement("th", null, "Indicatief"))),
              React.createElement("tbody", null,
                Object.values(SUBSIDIES).map(s =>
                  React.createElement("tr", { key: s.label },
                    React.createElement("td", null, s.label),
                    React.createElement("td", null, s.bedrag))))),
            React.createElement("p", null, React.createElement("strong", null, "Belangrijk:"), " Werk moet via RGE-gecertificeerde vakman."),
            React.createElement("div", { className: "ek-links" },
              React.createElement("a", { href: "https://www.maprimerenov.gouv.fr", target: "_blank" }, "🔗 MaPrimeRénov' aanvragen"),
              React.createElement("a", { href: "https://france-renov.gouv.fr/annuaire-rge", target: "_blank" }, "🔗 RGE-vakman zoeken"))
          )
        ),

        // Grondslagen
        React.createElement("div", { className: "ek-sectie" },
          React.createElement("button", {
            type: "button", className: "ek-accordion", onClick: () => setToonGrond(!toonGrond)
          }, React.createElement("span", null, "📋 Grondslagen"), React.createElement("span", null, toonGrond ? "−" : "+")),
          toonGrond && React.createElement("div", { className: "ek-grond" },
            React.createElement("pre", null,
`Zone: ${zoneInfo.name} (${warmte.hdd} graaddagen)
Type: ${typeInfo.label}
Oppervlak: ${m2} m² × ${verd} verdieping(en) = ${volume} m³

U-waarden: ramen ${uW.ramen}, dak ${uW.dak}, muren ${uW.muren}, vloer ${uW.vloer}
Oppervlakken: ramen ${opp.ramen}m², dak ${opp.dak}m², muren ${opp.muren}m², vloer ${opp.vloer}m²

Htr: ${formatNum(warmte.Htr, 1)} W/K
Hvent: ${formatNum(warmte.Hvent, 1)} W/K
Htot: ${formatNum(warmte.Htot, 1)} W/K

Warmtevraag: ${formatNum(warmte.warmte, 0)} kWh/jaar
DPE: ${dpe.waarde} kWh/m²/jaar → ${dpe.letter}`
            ),
            React.createElement("a", { href: TOOL.source, target: "_blank" }, "📖 Meer over de berekeningen →")
          )
        ),

        // Nav
        React.createElement("div", { className: "ek-nav" },
          React.createElement("button", { className: "ek-btn", onClick: () => setStap(2) }, "← Terug"),
          React.createElement("button", { className: "ek-btn primary", onClick: () => window.print() }, "🖨️ Afdrukken")
        ),

        React.createElement("div", { className: "ek-disclaimer" },
          "Oriëntatiehulpmiddel – geen gecertificeerde DPE-audit. Officiële audits vereisen gevalideerde software en een gecertificeerde diagnostiqueur.")
      );
    };

    // =======================================================================
    // RENDER
    // =======================================================================
    return React.createElement("div", { className: "ek-app" },
      // Header
      React.createElement("header", { className: "ek-header" },
        React.createElement("div", { className: "ek-header-inner" },
          React.createElement("div", { className: "ek-logo" },
            React.createElement("span", { className: "ek-dot" }),
            React.createElement("span", null, TOOL.name)),
          React.createElement("span", { className: "ek-versie" }, "v" + TOOL.version)
        )
      ),

      // Kostenbar
      stap1OK && React.createElement(Kostenbar, { kosten: kosten.totaal, onz }),

      // Main
      React.createElement("main", { className: "ek-main" },
        React.createElement("div", { className: "ek-container" },
          React.createElement("h1", null, "Energiekompas Frankrijk"),
          React.createElement("p", { className: "ek-sub" },
            "Bereken de energiekosten en DPE-indicatie van uw (toekomstige) woning in Frankrijk"),
          React.createElement(Voortgang, { stap }),
          stap === 1 && renderStap1(),
          stap === 2 && renderStap2(),
          stap === 3 && renderStap3()
        )
      ),

      // Footer
      React.createElement("footer", { className: "ek-footer" },
        React.createElement("p", null,
          "© ", new Date().getFullYear(), " ",
          React.createElement("a", { href: "https://infofrankrijk.com", target: "_blank" }, "InfoFrankrijk.com"),
          " · ",
          React.createElement("a", { href: TOOL.source, target: "_blank" }, "Achtergrond isolatie"))
      )
    );
  }

  // Mount
  ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App));
})();
