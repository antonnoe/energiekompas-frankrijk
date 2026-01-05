// script.js (100% copy/paste – vervang uw huidige script.js volledig)
(function () {
  const { useEffect, useMemo, useState } = React;

  const TOOL = { name: "Energiekompas Frankrijk", version: "Werkversie (tabs)" };

  // --- Klimaatzones (HDD indicatief; later vervangbaar door API/datafile) ---
  const ZONES = [
    { id: "med", name: "Méditerranée (zacht)", hdd: 1400 },
    { id: "ouest", name: "Zuid-West / Atlantisch", hdd: 1900 },
    { id: "paris", name: "Noord / Parijs (Île-de-France)", hdd: 2200 },
    { id: "centre", name: "Centraal / Bourgogne", hdd: 2500 },
    { id: "est", name: "Oost / Elzas-Lotharingen", hdd: 2800 },
    { id: "mont", name: "Bergen (koel)", hdd: 3400 },
  ];

  // postcode -> zone (grof maar transparant; later verfijnen per departement/altitude)
  function zoneFromPostalCode(cp) {
    if (!cp || !/^\d{5}$/.test(cp)) return null;
    const dep2 = cp.slice(0, 2);
    if (dep2 === "20") return "med"; // Corsica

    // Méditerranée
    if (["04","05","06","11","13","30","34","66","83","84"].includes(dep2)) return "med";

    // Atlantisch / Zuid-West
    if (["16","17","24","33","40","47","64","79","85","86","87","44","56","29","22","35","49","50","14"].includes(dep2)) return "ouest";

    // Bergen (grof)
    if (["09","12","15","19","31","32","38","42","43","46","48","63","65","73","74"].includes(dep2)) return "mont";

    // Oost (grof)
    if (["08","10","25","39","52","54","55","57","67","68","70","71","88","90","21"].includes(dep2)) return "est";

    // Parijs/Noord (Île-de-France + noord band grof)
    if (["75","77","78","91","92","93","94","95","59","62","60","80","02","51"].includes(dep2)) return "paris";

    return "centre";
  }

  // --- Casco presets: U-waarden per “perceptie” (indicatief, uitlegbaar) ---
  const U_PRESETS = {
    win: { single: 5.8, double: 2.9, hr: 1.6 },
    roof: { none: 3.0, mid: 0.5, good: 0.2 },
    wall: { none: 2.0, mid: 0.8, good: 0.4 },
    floor:{ none: 1.2, mid: 0.5, good: 0.3 },
  };

  const PERCEPTION = {
    win: [
      { key: "single", label: "Enkel glas", u: U_PRESETS.win.single },
      { key: "double", label: "Dubbel glas (ouder)", u: U_PRESETS.win.double },
      { key: "hr", label: "HR(+) / modern", u: U_PRESETS.win.hr },
    ],
    roof: [
      { key: "none", label: "Geen / onbekend", u: U_PRESETS.roof.none },
      { key: "mid", label: "Matig", u: U_PRESETS.roof.mid },
      { key: "good", label: "Goed", u: U_PRESETS.roof.good },
    ],
    wall: [
      { key: "none", label: "Geen / onbekend", u: U_PRESETS.wall.none },
      { key: "mid", label: "Matig", u: U_PRESETS.wall.mid },
      { key: "good", label: "Goed", u: U_PRESETS.wall.good },
    ],
    floor: [
      { key: "none", label: "Geen / onbekend", u: U_PRESETS.floor.none },
      { key: "mid", label: "Matig", u: U_PRESETS.floor.mid },
      { key: "good", label: "Goed", u: U_PRESETS.floor.good },
    ],
  };

  // --- Installaties (vereenvoudigd maar open voor combinaties) ---
  const HEAT_MAIN = [
    { key: "hp", label: "Warmtepomp", type: "elec", scop: 3.2 },
    { key: "elec", label: "Elektrisch (direct)", type: "elec", scop: 1.0 },
    { key: "gas", label: "Aardgas (cv-ketel)", type: "gas", eta: 0.92 },
    { key: "fioul", label: "Fioul (olie)", type: "fioul", eta: 0.85 },
    { key: "pellet", label: "Pellet (ketel/kachel)", type: "pellet", eta: 0.85 },
    { key: "wood", label: "Hout (stère)", type: "wood", eta: 0.75 },
    { key: "propaan", label: "Propaan", type: "propaan", eta: 0.90 },
  ];

  const HEAT_AUX = [
    { key: "none", label: "Geen bijverwarming" },
    { key: "wood", label: "Houtkachel" },
    { key: "pellet", label: "Pelletkachel" },
    { key: "elec", label: "Elektrisch (bijverw.)" },
  ];

  const PV_ORIENT = [
    { key: "S", label: "Zuid (optimaal)", factor: 1.00 },
    { key: "SE", label: "Zuid-Oost", factor: 0.95 },
    { key: "SW", label: "Zuid-West", factor: 0.95 },
    { key: "E", label: "Oost", factor: 0.85 },
    { key: "W", label: "West", factor: 0.85 },
    { key: "NE", label: "Noord-Oost", factor: 0.70 },
    { key: "NW", label: "Noord-West", factor: 0.70 },
    { key: "N", label: "Noord", factor: 0.55 },
  ];

  // PV yield per zone (kWh/kWp/jaar, indicatief)
  const PV_YIELD = { med: 1450, ouest: 1250, paris: 1150, centre: 1200, est: 1150, mont: 1100 };

  // --- Energieprijzen (defaults; gebruiker kan aanpassen) ---
  const PRICE_DEFAULTS = {
    elec: 0.25,     // €/kWh
    gas: 1.20,      // €/m³ (≈ 10 kWh)
    fioul: 1.15,    // €/L  (≈ 10 kWh)
    pellet: 0.60,   // €/kg (≈ 5 kWh)
    wood: 85,       // €/stère (≈ 1800 kWh)
    propaan: 1.80,  // €/L  (≈ 7.1 kWh)
  };
  const KWH_PER_UNIT = { elec: 1, gas: 10, fioul: 10, pellet: 5, wood: 1800, propaan: 7.1 };
  const UNIT_LABEL = { elec: "€/kWh", gas: "€/m³", fioul: "€/L", pellet: "€/kg", wood: "€/stère", propaan: "€/L" };

  // --- Gedrag ---
  const HEAT_SCHEDULE = [
    { key: "always", label: "Dag en nacht aan", factor: 1.00 },
    { key: "daynight", label: "Dag/nacht (lager ’s nachts)", factor: 0.92 },
    { key: "frost", label: "Alleen vorstbeveiliging / laag setpoint", factor: 0.80 },
  ];
  const ABSENCE = [
    { key: "low", label: "Weinig afwezig (<15 dagen)", winterDays: 10, factor: 0.98 },
    { key: "mid", label: "Gemiddeld (16–90 dagen)", winterDays: 60, factor: 0.88 },
    { key: "high", label: "Veel (>120 dagen)", winterDays: 140, factor: 0.70 },
  ];

  // --- DPE band (indicatief) ---
  const DPE_LETTERS = ["A","B","C","D","E","F","G"];
  function dpeIndexFromIntensity(intensity) {
    // proxy thresholds (indicatief) – altijd als bandbreedte tonen
    if (intensity < 70) return 0;
    if (intensity < 110) return 1;
    if (intensity < 180) return 2;
    if (intensity < 250) return 3;
    if (intensity < 330) return 4;
    if (intensity < 420) return 5;
    return 6;
  }

  // --- Helpers ---
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function n2(x, def=0){ const v = Number(x); return Number.isFinite(v) ? v : def; }
  function moneyEUR(v) {
    const n = Number.isFinite(v) ? v : 0;
    return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }
  function todayNL(){
    return new Date().toLocaleDateString("nl-NL", { year:"numeric", month:"long", day:"numeric" });
  }

  // Estimate envelope areas if user wants (simple heuristics)
  function estimateAreas(m2, floors){
    const f = Math.max(1, n2(floors,1));
    const footprint = m2 / f;
    const side = Math.sqrt(Math.max(20, footprint));
    const perimeter = 4 * side;
    const height = 2.5 * f; // average
    const wallArea = perimeter * height;
    const winArea = Math.max(12, Math.min(0.18 * m2, 40));
    const roofArea = footprint;
    const floorArea = footprint;
    return {
      wallA: Math.round(wallArea),
      winA: Math.round(winArea),
      roofA: Math.round(roofArea),
      floorA: Math.round(floorArea),
    };
  }

  // Core physics-lite model (transparent & conservative)
  function computeHeatDemandKwh({ zoneId, m2, m3, floors, exposureKey, envelope, behavior }) {
    const z = ZONES.find(x => x.id === zoneId) || ZONES[2];
    const f = Math.max(1, n2(floors, 1));
    const vol = m3 && m3 > 0 ? m3 : (m2 * 2.5 * f);

    // Ventilation/infiltration baseline
    let ach = 0.6; // default
    if (exposureKey === "sheltered") ach *= 0.90;
    if (exposureKey === "windy") ach *= 1.15;

    // Ventilation loss coefficient (W/K)
    const Hvent = 0.34 * ach * vol;

    // Transmission loss coefficient (W/K) from Σ(U*A)
    const Htr =
      envelope.winU * envelope.winA +
      envelope.roofU * envelope.roofA +
      envelope.wallU * envelope.wallA +
      envelope.floorU * envelope.floorA;

    // Total heat loss coefficient
    const H = Hvent + Htr;

    // Behavior factors
    const sched = HEAT_SCHEDULE.find(x => x.key === behavior.scheduleKey) || HEAT_SCHEDULE[1];
    const abs = ABSENCE.find(x => x.key === behavior.absenceKey) || ABSENCE[1];

    // Heat demand (kWh/year)
    const E = H * z.hdd * 24 / 1000;

    // Apply behavior
    const E2 = E * sched.factor * abs.factor;

    return { heatKwh: E2, H, Hvent, Htr, ach, vol, hdd: z.hdd };
  }

  function energyCostFromHeating({ heatKwh, mainKey, prices }) {
    const main = HEAT_MAIN.find(x => x.key === mainKey) || HEAT_MAIN[0];
    const fuel = main.type;
    const kwhPerUnit = KWH_PER_UNIT[fuel] || 1;
    const price = prices[fuel];

    let inputKwh = heatKwh;
    if (fuel === "elec") inputKwh = heatKwh / (main.scop || 1);
    else inputKwh = heatKwh / (main.eta || 0.90);

    const units = inputKwh / kwhPerUnit;
    const cost = units * price;
    return { fuel, inputKwh, units, cost };
  }

  function computePV({ zoneId, kWp, orientKey }) {
    const k = Math.max(0, n2(kWp,0));
    const y = PV_YIELD[zoneId] || 1200;
    const o = PV_ORIENT.find(x => x.key === orientKey) || PV_ORIENT[0];
    return k * y * (o.factor || 1.0);
  }

  // --- App ---
  function App() {
    const [tab, setTab] = useState(1);

    // confirm state: which step is awaiting confirmation (1->2, 2->3, 3->4)
    const [confirmStep, setConfirmStep] = useState(null);

    // Tab1: ligging/casco
    const [cp, setCp] = useState("");
    const [zoneId, setZoneId] = useState("paris");
    const [zoneLocked, setZoneLocked] = useState(false);

    const [m2, setM2] = useState(120);
    const [ceilH, setCeilH] = useState(""); // optional
    const [floors, setFloors] = useState(1);
    const [exposureKey, setExposureKey] = useState("mid"); // sheltered/mid/windy

    // envelope perceptions + areas
    const [winKey, setWinKey] = useState("double");
    const [roofKey, setRoofKey] = useState("mid");
    const [wallKey, setWallKey] = useState("mid");
    const [floorKey, setFloorKey] = useState("mid");

    const [winA, setWinA] = useState(20);
    const [roofA, setRoofA] = useState(90);
    const [wallA, setWallA] = useState(160);
    const [floorA, setFloorA] = useState(90);

    const [showRegionTip, setShowRegionTip] = useState(false);

    // Tab2: installaties & niet-casco
    const [mainHeatKey, setMainHeatKey] = useState("hp");
    const [auxHeatKey, setAuxHeatKey] = useState("none");

    const [pvOn, setPvOn] = useState(false);
    const [pvKWp, setPvKWp] = useState(3);
    const [pvOrient, setPvOrient] = useState("S");

    const [poolOn, setPoolOn] = useState(false);
    const [poolHeated, setPoolHeated] = useState(false); // placeholder for later

    const [evOn, setEvOn] = useState(false);
    const [evKm, setEvKm] = useState(12000);
    const [evKwhPer100, setEvKwhPer100] = useState(18);
    const [evLoss, setEvLoss] = useState(10);

    const [baseElecKwh, setBaseElecKwh] = useState(3500);

    const [prices, setPrices] = useState({ ...PRICE_DEFAULTS });

    // Tab3: gedrag
    const [scheduleKey, setScheduleKey] = useState("daynight");
    const [absenceKey, setAbsenceKey] = useState("mid");

    // Grondslagen panel
    const [showGrounds, setShowGrounds] = useState(false);
    const [copyMsg, setCopyMsg] = useState("");

    // --- Auto zone from postcode ---
    useEffect(() => {
      if (zoneLocked) return;
      const z = zoneFromPostalCode(cp);
      if (z && z !== zoneId) setZoneId(z);
    }, [cp, zoneLocked, zoneId]);

    const zoneName = useMemo(() => ZONES.find(z => z.id === zoneId)?.name || "—", [zoneId]);

    // --- Derived envelope values ---
    const envelope = useMemo(() => {
      const winU = PERCEPTION.win.find(x => x.key === winKey)?.u ?? U_PRESETS.win.double;
      const roofU = PERCEPTION.roof.find(x => x.key === roofKey)?.u ?? U_PRESETS.roof.mid;
      const wallU = PERCEPTION.wall.find(x => x.key === wallKey)?.u ?? U_PRESETS.wall.mid;
      const floorU = PERCEPTION.floor.find(x => x.key === floorKey)?.u ?? U_PRESETS.floor.mid;

      return {
        winU, roofU, wallU, floorU,
        winA: clamp(n2(winA,0), 0, 200),
        roofA: clamp(n2(roofA,0), 0, 600),
        wallA: clamp(n2(wallA,0), 0, 900),
        floorA: clamp(n2(floorA,0), 0, 600),
      };
    }, [winKey, roofKey, wallKey, floorKey, winA, roofA, wallA, floorA]);

    // --- Minimal completeness gates ---
    const tab1Ready = useMemo(() => {
      const cpOk = /^\d{5}$/.test(cp);
      const m2Ok = n2(m2,0) >= 20 && n2(m2,0) <= 600;
      const areasOk = (envelope.winA > 0 && envelope.roofA > 0 && envelope.wallA > 0 && envelope.floorA > 0);
      const perceptionsOk = !!winKey && !!roofKey && !!wallKey && !!floorKey;
      return cpOk && m2Ok && areasOk && perceptionsOk;
    }, [cp, m2, envelope, winKey, roofKey, wallKey, floorKey]);

    const tab2Ready = useMemo(() => {
      // installaties: minimaal hoofdverwarming + basis-elektra
      const baseOk = n2(baseElecKwh,0) >= 500 && n2(baseElecKwh,0) <= 12000;
      const mainOk = !!mainHeatKey;
      return tab1Ready && baseOk && mainOk;
    }, [tab1Ready, baseElecKwh, mainHeatKey]);

    const tab3Ready = useMemo(() => {
      return tab2Ready && !!scheduleKey && !!absenceKey;
    }, [tab2Ready, scheduleKey, absenceKey]);

    // --- Calculations (only meaningful when gates satisfied) ---
    const calc = useMemo(() => {
      const m2v = clamp(n2(m2,120), 20, 600);
      const floorsV = clamp(n2(floors,1), 1, 6);
      const m3 = n2(ceilH, 0) > 0 ? (m2v * n2(ceilH,2.5) * floorsV) : 0;

      const exposure = exposureKey === "sheltered" ? "sheltered" : (exposureKey === "windy" ? "windy" : "mid");
      const behavior = { scheduleKey, absenceKey };

      const { heatKwh, H, Hvent, Htr, ach, vol, hdd } = computeHeatDemandKwh({
        zoneId, m2: m2v, m3, floors: floorsV, exposureKey: exposure, envelope, behavior
      });

      const heatCost = energyCostFromHeating({ heatKwh, mainKey: mainHeatKey, prices });

      // auxiliary heating: crude share model (optional; conservative)
      let auxShare = 0;
      if (auxHeatKey === "wood" || auxHeatKey === "pellet") auxShare = 0.12;
      if (auxHeatKey === "elec") auxShare = 0.08;
      if (auxHeatKey === "none") auxShare = 0;

      const heatKwhAux = heatKwh * auxShare;
      const heatKwhMain = heatKwh * (1 - auxShare);

      const mainCost = energyCostFromHeating({ heatKwh: heatKwhMain, mainKey: mainHeatKey, prices });

      // Aux cost (simplified)
      let auxCost = 0;
      if (auxHeatKey === "wood") {
        const units = heatKwhAux / KWH_PER_UNIT.wood;
        auxCost = units * prices.wood;
      } else if (auxHeatKey === "pellet") {
        const units = heatKwhAux / KWH_PER_UNIT.pellet;
        auxCost = units * prices.pellet;
      } else if (auxHeatKey === "elec") {
        auxCost = heatKwhAux * prices.elec;
      }

      // Base electricity + EV + Pool (pool placeholder minimal)
      let evKwh = 0;
      if (evOn) {
        const km = Math.max(0, n2(evKm,0));
        const kwh100 = clamp(n2(evKwhPer100,18), 10, 30);
        const loss = clamp(n2(evLoss,10), 0, 30) / 100;
        evKwh = (km * (kwh100/100)) * (1 + loss);
      }

      let poolKwh = 0;
      if (poolOn && poolHeated) {
        // placeholder: conservative fixed value; later vervangen door zwembadmodule
        poolKwh = 1800;
      }

      const baseKwh = clamp(n2(baseElecKwh,3500), 500, 12000);
      const elecGross = baseKwh + evKwh + poolKwh;

      // PV
      const pvKwh = pvOn ? computePV({ zoneId, kWp: pvKWp, orientKey: pvOrient }) : 0;
      const selfUse = 0.60; // transparant startpunt; later per profiel
      const pvSelf = Math.min(elecGross, pvKwh * selfUse);
      const pvNet = Math.max(0, elecGross - pvSelf);

      const elecCost = pvNet * prices.elec;

      // Total cost (heating main+aux + electricity)
      const total = (mainCost.cost + auxCost + elecCost);

      // Uncertainty bands (range)
      // After Tab2: ±20%; after Tab3: ±12%
      const range = tab3Ready ? 0.12 : (tab2Ready ? 0.20 : 0.0);

      const low = total * (1 - range);
      const high = total * (1 + range);

      // DPE proxy intensity (kWh/m²/yr) using heat demand + base electricity (not official)
      const intensity = (heatKwh + baseKwh) / Math.max(20, m2v);
      const idx = dpeIndexFromIntensity(intensity);
      const midLetter = DPE_LETTERS[idx];
      const loLetter = DPE_LETTERS[clamp(idx - 1, 0, 6)];
      const hiLetter = DPE_LETTERS[clamp(idx + 1, 0, 6)];

      return {
        heatKwh,
        heatMainKwh: heatKwhMain,
        heatAuxKwh,
        H, Hvent, Htr, ach, vol, hdd,
        mainCost,
        auxCost,
        baseKwh,
        evKwh,
        poolKwh,
        pvKwh,
        pvSelf,
        pvNet,
        elecCost,
        total,
        range,
        low,
        high,
        dpe: { intensity: Math.round(intensity), idx, midLetter, loLetter, hiLetter }
      };
    }, [
      zoneId, m2, ceilH, floors, exposureKey, envelope,
      scheduleKey, absenceKey,
      mainHeatKey, auxHeatKey,
      baseElecKwh,
      evOn, evKm, evKwhPer100, evLoss,
      poolOn, poolHeated,
      pvOn, pvKWp, pvOrient,
      prices,
      tab2Ready, tab3Ready
    ]);

    // --- Floating bar allowed after Tab2 ---
    const floatingAllowed = tab2Ready;

    // --- DPE allowed after Tab3 ---
    const dpeAllowed = tab3Ready;

    // --- DPE bar geometry ---
    const dpePointerPct = useMemo(() => {
      const segW = 100 / 7;
      return (calc.dpe.idx * segW) + (segW / 2);
    }, [calc.dpe.idx]);

    const dpeBand = useMemo(() => {
      const segW = 100 / 7;
      const low = DPE_LETTERS.indexOf(calc.dpe.loLetter);
      const high = DPE_LETTERS.indexOf(calc.dpe.hiLetter);
      const left = Math.min(low, high) * segW;
      const right = (Math.max(low, high) + 1) * segW;
      return { left, width: Math.max(0, right - left) };
    }, [calc.dpe.loLetter, calc.dpe.hiLetter]);

    // --- Confirmation summaries ---
    function summaryTab1() {
      return [
        `Postcode: ${cp || "—"} → ${zoneName}`,
        `Woonoppervlak: ${clamp(n2(m2,120),20,600)} m²`,
        `Verdiepingen: ${clamp(n2(floors,1),1,6)}`,
        `Ligging wind: ${exposureKey === "sheltered" ? "beschut" : exposureKey === "windy" ? "vol in de wind" : "gemiddeld"}`,
        `Isolatie (indicatief): ramen=${PERCEPTION.win.find(x=>x.key===winKey)?.label || "—"}, dak=${PERCEPTION.roof.find(x=>x.key===roofKey)?.label || "—"}, muren=${PERCEPTION.wall.find(x=>x.key===wallKey)?.label || "—"}, vloer=${PERCEPTION.floor.find(x=>x.key===floorKey)?.label || "—"}`,
        `Oppervlakken (m²): ramen=${envelope.winA}, dak=${envelope.roofA}, muren=${envelope.wallA}, vloer=${envelope.floorA}`,
      ];
    }

    function summaryTab2() {
      const main = HEAT_MAIN.find(x=>x.key===mainHeatKey)?.label || "—";
      const aux = HEAT_AUX.find(x=>x.key===auxHeatKey)?.label || "—";
      const pv = pvOn ? `${Math.max(0,n2(pvKWp,0))} kWp, ${PV_ORIENT.find(x=>x.key===pvOrient)?.label || "—"}` : "nee";
      const ev = evOn ? `${Math.max(0,n2(evKm,0)).toLocaleString("nl-NL")} km/jaar` : "nee";
      const pool = poolOn ? (poolHeated ? "ja (verwarmd)" : "ja (onverwarmd)") : "nee";
      return [
        `Hoofdverwarming: ${main}`,
        `Bijverwarming: ${aux}`,
        `Huishoud-elektra (basis): ${Math.round(clamp(n2(baseElecKwh,3500),500,12000))} kWh/jaar`,
        `PV: ${pv}`,
        `EV: ${ev}`,
        `Zwembad: ${pool}`,
        `Energieprijzen: elec ${prices.elec} €/kWh, gas ${prices.gas} €/m³, fioul ${prices.fioul} €/L, pellet ${prices.pellet} €/kg, hout ${prices.wood} €/stère`,
      ];
    }

    function summaryTab3() {
      const sch = HEAT_SCHEDULE.find(x=>x.key===scheduleKey)?.label || "—";
      const abs = ABSENCE.find(x=>x.key===absenceKey)?.label || "—";
      return [
        `Verwarming: ${sch}`,
        `Afwezigheid winter: ${abs}`,
        `Opmerking: gedrag beïnvloedt vooral kosten; de woning zelf verandert hierdoor niet.`,
      ];
    }

    // --- Confirm flow ---
    function requestNext(fromTab) {
      if (fromTab === 1) {
        if (!tab1Ready) return;
        setConfirmStep("1to2");
      } else if (fromTab === 2) {
        if (!tab2Ready) return;
        setConfirmStep("2to3");
      } else if (fromTab === 3) {
        if (!tab3Ready) return;
        setConfirmStep("3to4");
      }
    }

    function confirmGo() {
      if (confirmStep === "1to2") { setConfirmStep(null); setTab(2); return; }
      if (confirmStep === "2to3") { setConfirmStep(null); setTab(3); return; }
      if (confirmStep === "3to4") { setConfirmStep(null); setTab(4); return; }
      setConfirmStep(null);
    }

    function confirmEdit() {
      setConfirmStep(null);
    }

    // --- Copy helpers ---
    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    function buildPrintableSummary() {
      const lines = [];
      lines.push(`${TOOL.name} – Samenvatting (indicatief)`);
      lines.push(`Datum: ${todayNL()}`);
      lines.push(`Versie: ${TOOL.version}`);
      lines.push("");
      lines.push("1) Ligging & woning (casco)");
      summaryTab1().forEach(x => lines.push(`- ${x}`));
      lines.push("");
      lines.push("2) Installaties & niet-casco");
      summaryTab2().forEach(x => lines.push(`- ${x}`));
      lines.push("");
      lines.push("3) Gedrag");
      summaryTab3().forEach(x => lines.push(`- ${x}`));
      lines.push("");

      if (tab2Ready) {
        lines.push("4) Kosten (bandbreedte)");
        lines.push(`- Totale energiekosten: ${moneyEUR(calc.low)} – ${moneyEUR(calc.high)} per jaar`);
        lines.push(`- Per maand: ${moneyEUR(calc.low/12)} – ${moneyEUR(calc.high/12)} per maand`);
        lines.push(`- (bandbreedte door onzekerheden in invoer; geen offerte of garantie)`);
        lines.push("");
      } else {
        lines.push("4) Kosten");
        lines.push("- Nog niet beschikbaar: vul Tab 1 en Tab 2 in en bevestig.");
        lines.push("");
      }

      if (tab3Ready) {
        lines.push("5) Waarschijnlijke DPE-positie (indicatief)");
        lines.push(`- Bandbreedte: ${calc.dpe.loLetter} – ${calc.dpe.hiLetter}`);
        lines.push(`- Context-intensiteit: ~${calc.dpe.intensity} kWh/m²/jaar (proxy; geen officiële DPE-berekening)`);
        lines.push("");
      } else {
        lines.push("5) DPE");
        lines.push("- Nog niet beschikbaar: vul Tab 3 in en bevestig.");
        lines.push("");
      }

      lines.push("6) Grondslagen (samengevat)");
      lines.push("- Klimaatzone komt uit postcode (klimaat beïnvloedt warmtevraag).");
      lines.push("- Warmtevraag is indicatief: transmissie (U·A) + ventilatie (ACH·volume) op basis van graaddagen.");
      lines.push("- Kosten zijn gebaseerd op uw energieprijzen en systeemrendement (SCOP/η).");
      lines.push("- DPE is een bandbreedte op basis van woningprofiel + regio (context), geen officieel label.");
      lines.push("");
      lines.push("Disclaimer");
      lines.push("Deze tool is een oriëntatie- en analysetool en vervangt geen gecertificeerde DPE/audit of diagnose ter plaatse.");

      return lines.join("\n");
    }

    async function onCopySummary() {
      setCopyMsg("");
      const txt = buildPrintableSummary();
      const ok = await copyToClipboard(txt);
      if (ok) {
        setCopyMsg("Gekopieerd. Plak dit in Word, Keep of e-mail.");
        setTimeout(() => setCopyMsg(""), 3500);
      } else {
        setCopyMsg("Kopiëren lukt niet automatisch in deze browser. Selecteer en kopieer de tekst handmatig.");
      }
    }

    // --- UI helpers ---
    function TabButtons() {
      const canGo = (t) => {
        if (t === 1) return true;
        if (t === 2) return tab1Ready && confirmStep === null;
        if (t === 3) return tab2Ready && confirmStep === null;
        if (t === 4) return tab3Ready && confirmStep === null;
        if (t === 5) return tab3Ready && confirmStep === null;
        if (t === 6) return tab3Ready && confirmStep === null;
        return false;
      };

      const clickTab = (t) => {
        // do not allow skipping confirmations
        if (!canGo(t)) return;
        setTab(t);
      };

      return (
        React.createElement("div", { className: "tabsRow" },
          [1,2,3,4,5,6].map((t) => {
            const label =
              t===1 ? "1. Woning" :
              t===2 ? "2. Installaties" :
              t===3 ? "3. Gedrag" :
              t===4 ? "4. Besparingen" :
              t===5 ? "5. DPE" :
              "6. Print";
            return React.createElement("button", {
              key: t,
              className: "tabBtn",
              onClick: () => clickTab(t),
              disabled: !canGo(t),
              "aria-selected": tab === t ? "true" : "false",
              "aria-label": label
            }, label);
          })
        )
      );
    }

    function ConfirmPanel() {
      if (!confirmStep) return null;

      let title = "";
      let items = [];
      let note = "";
      if (confirmStep === "1to2") {
        title = "Controleer uw woninggegevens (Tab 1)";
        items = summaryTab1();
        note = "Deze gegevens vormen de basis voor alle volgende berekeningen.";
      } else if (confirmStep === "2to3") {
        title = "Controleer installaties & verbruik (Tab 2)";
        items = summaryTab2();
        note = "Deze gegevens bepalen vooral uw energiekosten. Controleer voordat u doorgaat.";
      } else if (confirmStep === "3to4") {
        title = "Controleer gedrag & aanwezigheid (Tab 3)";
        items = summaryTab3();
        note = "Gedrag beïnvloedt vooral kosten; de woning zelf verandert hierdoor niet.";
      }

      return React.createElement(
        "div",
        { className: "confirmBox" },
        React.createElement("div", { className: "confirmTitle" }, title),
        React.createElement("ul", { className: "confirmList" }, items.map((x,i)=>React.createElement("li", { key:i }, x))),
        React.createElement("div", { className: "confirmFooter" }, note),
        React.createElement(
          "div",
          { className: "btnRow" },
          React.createElement("button", { className: "btn btnGhost", onClick: confirmEdit }, "Wijzigen"),
          React.createElement("button", { className: "btn", onClick: confirmGo }, "Akkoord, ga verder")
        )
      );
    }

    function RightPanel() {
      return React.createElement(
        "div",
        { className: "stickyRight" },
        React.createElement(
          "div",
          { className: "cardWhite" },

          React.createElement(
            "div",
            { className: "sectionTitle" },
            React.createElement("h2", null, "Status"),
            React.createElement("span", { className: "pill" }, "Betrouwbaarheid")
          ),

          React.createElement("div", { className: "help" },
            React.createElement("span", { className: tab1Ready ? "statusOk" : "statusNo" }, tab1Ready ? "Tab 1 OK" : "Tab 1 nog niet compleet"),
            " · ",
            React.createElement("span", { className: tab2Ready ? "statusOk" : "statusNo" }, tab2Ready ? "Tab 2 OK" : "Tab 2 nog niet compleet"),
            " · ",
            React.createElement("span", { className: tab3Ready ? "statusOk" : "statusNo" }, tab3Ready ? "Tab 3 OK" : "Tab 3 nog niet compleet")
          ),

          React.createElement("div", { className: "hr" }),

          React.createElement(
            "div",
            { className: "sectionTitle" },
            React.createElement("h2", null, "Context"),
            React.createElement("span", { className: "badge" }, "Zone: ", zoneName)
          ),
          React.createElement("div", { className: "help" },
            `Postcode: ${cp || "—"} · Klimaatzone: ${zoneName}`
          ),

          showRegionTip ? React.createElement(
            "div",
            { className: "tipBox" },
            React.createElement("b", null, "Waarom speelt regio een rol?"),
            React.createElement("div", null,
              "Klimaatverschillen beïnvloeden de warmtevraag. In koudere regio’s is de warmtevraag structureel hoger dan in mildere regio’s. ",
              "Daarom kan dezelfde woning in een andere regio een andere (waarschijnlijke) DPE-positie hebben. ",
              "Deze tool gebruikt de klimaatzone als contextvariabele en toont DPE altijd als bandbreedte (indicatief)."
            )
          ) : null,

          React.createElement("div", { className: "hr" }),

          React.createElement(
            "div",
            { className: "sectionTitle" },
            React.createElement("h2", null, "Kerncijfers (indicatief)"),
            React.createElement("span", { className: "pill" }, "kWh")
          ),
          React.createElement("div", { className: "help" },
            `Warmtevraag: ${Math.round(calc.heatKwh)} kWh/jaar · Basis elec: ${Math.round(calc.baseKwh)} kWh/jaar`,
            (pvOn ? ` · PV: ${Math.round(calc.pvKwh)} kWh/jaar` : ""),
            (evOn ? ` · EV: ${Math.round(calc.evKwh)} kWh/jaar` : "")
          ),

          React.createElement("div", { className: "hr" }),

          React.createElement(
            "div",
            { className: "sectionTitle" },
            React.createElement("h2", null, "DPE (indicatief)"),
            React.createElement(
              "span",
              { className: "dpeChip" },
              dpeAllowed ? `Band: ${calc.dpe.loLetter}–${calc.dpe.hiLetter}` : "Nog niet beschikbaar"
            )
          ),

          !dpeAllowed ? React.createElement(
            "div",
            { className: "help" },
            "Vul Tab 3 (gedrag) in en bevestig. Daarna tonen we een waarschijnlijke DPE-bandbreedte (geen officiële DPE)."
          ) : React.createElement(
            "div",
            { className: "dpeWrap" },
            React.createElement(
              "div",
              { className: "dpeBar" },
              React.createElement("div", { className: "dpeSeg", style: { background: "#2ecc71" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#7bed9f" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#f1c40f" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#f39c12" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#e67e22" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#e74c3c" } }),
              React.createElement("div", { className: "dpeSeg", style: { background: "#b71c1c" } }),
              React.createElement("div", { className: "dpeBand", style: { left: dpeBand.left + "%", width: dpeBand.width + "%" } }),
              React.createElement("div", { className: "dpePointer", style: { left: dpePointerPct + "%" } })
            ),
            React.createElement(
              "div",
              { className: "dpeLabels" },
              ["A","B","C","D","E","F","G"].map(x => React.createElement("span", { key:x }, x))
            ),
            React.createElement(
              "div",
              { className: "help" },
              `Context-intensiteit (proxy): ~${calc.dpe.intensity} kWh/m²/jaar. Bandbreedte is indicatief en vervangt geen officiële DPE-diagnose.`
            )
          )
        )
      );
    }

    // --- Tab content ---
    function Tab1() {
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 1 — Woning (casco & ligging)"),
          React.createElement("span", { className: "pill" }, "Basis voor alles")
        ),

        React.createElement("div", { className: "help" },
          "Vul de casco-gegevens zo goed mogelijk in. Perfect hoeft niet; indicatieve keuzes zijn prima. Belangrijk: u bevestigt straks zelf dat dit klopt."
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Postcode (5 cijfers)"),
            React.createElement("input", {
              className: "input",
              value: cp,
              onChange: (e) => {
                const v = (e.target.value || "").replace(/\D/g, "").slice(0, 5);
                setCp(v);
              },
              placeholder: "33100",
              inputMode: "numeric"
            }),
            React.createElement("div", { className: "help" }, "De klimaatzone wordt automatisch bepaald op basis van de postcode.")
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement(
              "label",
              null,
              "Klimaatzone",
              React.createElement("span", {
                className: "iconHelp",
                role: "button",
                tabIndex: 0,
                title: "Waarom speelt regio een rol?",
                onClick: () => setShowRegionTip(!showRegionTip)
              }, "?")
            ),
            React.createElement(
              "select",
              {
                value: zoneId,
                onChange: (e) => { setZoneId(e.target.value); setZoneLocked(true); }
              },
              ZONES.map(z => React.createElement("option", { key: z.id, value: z.id }, z.name))
            ),
            React.createElement("div", { className: "help" },
              zoneLocked ? "U heeft de klimaatzone handmatig aangepast." : "Automatisch (u kunt dit aanpassen)."
            )
          )
        ),

        React.createElement(
          "div",
          { className: "row row3" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Woonoppervlak (m²)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 20,
              max: 600,
              step: 1,
              value: m2,
              onChange: (e) => setM2(clamp(parseInt(e.target.value || "0", 10) || 0, 20, 600))
            }),
            React.createElement("div", { className: "help" }, "Vrij invulbaar. We begrenzen alleen tegen extreme invoer.")
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Gemiddelde plafondhoogte (optioneel, m)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              step: 0.1,
              value: ceilH,
              onChange: (e) => setCeilH(e.target.value)
            }),
            React.createElement("div", { className: "help" }, "Laat leeg als u het niet weet. We nemen dan 2,5 m per verdieping.")
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Aantal verdiepingen"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 1,
              max: 6,
              step: 1,
              value: floors,
              onChange: (e) => setFloors(clamp(parseInt(e.target.value || "1", 10) || 1, 1, 6))
            })
          )
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Ligging t.o.v. wind"),
            React.createElement(
              "select",
              { value: exposureKey, onChange: (e) => setExposureKey(e.target.value) },
              React.createElement("option", { value: "sheltered" }, "Beschut (vallei / luw)"),
              React.createElement("option", { value: "mid" }, "Gemiddeld"),
              React.createElement("option", { value: "windy" }, "Vol in de wind (heuvel / open)"),
            ),
            React.createElement("div", { className: "help" }, "Dit beïnvloedt de ventilatie-/infiltratiecomponent (indicatief).")
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Schat casco-oppervlakken"),
            React.createElement(
              "button",
              {
                className: "btn btnSoft",
                type: "button",
                onClick: () => {
                  const est = estimateAreas(clamp(n2(m2,120),20,600), clamp(n2(floors,1),1,6));
                  setWallA(est.wallA);
                  setWinA(est.winA);
                  setRoofA(est.roofA);
                  setFloorA(est.floorA);
                }
              },
              "Vul schatting in"
            ),
            React.createElement("div", { className: "help" }, "Optioneel hulpmiddel: vult redelijke startwaarden in. U kunt daarna corrigeren.")
          )
        ),

        React.createElement("div", { className: "hr" }),

        React.createElement("h3", null, "Isolatie (indicatief) + oppervlakken (m²)"),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Ramen (kwaliteit)"),
            React.createElement(
              "select",
              { value: winKey, onChange: (e) => setWinKey(e.target.value) },
              PERCEPTION.win.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Ramen (oppervlak m²)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 1,
              value: winA,
              onChange: (e) => setWinA(e.target.value)
            })
          )
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Dak (isolatie)"),
            React.createElement(
              "select",
              { value: roofKey, onChange: (e) => setRoofKey(e.target.value) },
              PERCEPTION.roof.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Dak (oppervlak m²)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 1,
              value: roofA,
              onChange: (e) => setRoofA(e.target.value)
            })
          )
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Muren (isolatie)"),
            React.createElement(
              "select",
              { value: wallKey, onChange: (e) => setWallKey(e.target.value) },
              PERCEPTION.wall.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Muren (oppervlak m²)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 1,
              value: wallA,
              onChange: (e) => setWallA(e.target.value)
            })
          )
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Vloer (isolatie)"),
            React.createElement(
              "select",
              { value: floorKey, onChange: (e) => setFloorKey(e.target.value) },
              PERCEPTION.floor.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Vloer (oppervlak m²)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 1,
              value: floorA,
              onChange: (e) => setFloorA(e.target.value)
            })
          )
        ),

        !tab1Ready ? React.createElement("div", { className: "help helpWarn" },
          "Tab 1 nog niet compleet: postcode (5 cijfers), woonoppervlak en alle vier de oppervlakken moeten > 0 zijn."
        ) : null,

        React.createElement(
          "div",
          { className: "btnRow" },
          React.createElement("button", { className: "btn", disabled: !tab1Ready || confirmStep !== null, onClick: () => requestNext(1) }, "Volgende: Tab 2 (met bevestiging)")
        ),

        React.createElement(ConfirmPanel, null)
      );
    }

    function Tab2() {
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 2 — Installaties & niet-casco"),
          React.createElement("span", { className: "pill" }, "Kostencomponenten")
        ),
        React.createElement("div", { className: "help" },
          "Hier bepaalt u systemen en extra verbruik (PV/EV/zwembad). U bevestigt straks de invoer voordat u naar Tab 3 gaat."
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Hoofdverwarming"),
            React.createElement(
              "select",
              { value: mainHeatKey, onChange: (e) => setMainHeatKey(e.target.value) },
              HEAT_MAIN.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Bijverwarming"),
            React.createElement(
              "select",
              { value: auxHeatKey, onChange: (e) => setAuxHeatKey(e.target.value) },
              HEAT_AUX.map(x => React.createElement("option", { key: x.key, value: x.key }, x.label))
            ),
            React.createElement("div", { className: "help" }, "Bijverwarming wordt conservatief als klein aandeel gemodelleerd (indicatief).")
          )
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Huishoud-elektra (basis, kWh/jaar)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 500,
              max: 12000,
              step: 50,
              value: baseElecKwh,
              onChange: (e) => setBaseElecKwh(e.target.value)
            }),
            React.createElement("div", { className: "help" }, "Dit vervangt losse apparatenlijsten. U kunt dit later verfijnen.")
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Zonnepanelen (PV)"),
            React.createElement(
              "select",
              { value: pvOn ? "yes" : "no", onChange: (e) => setPvOn(e.target.value === "yes") },
              React.createElement("option", { value: "no" }, "Geen PV"),
              React.createElement("option", { value: "yes" }, "PV aanwezig")
            )
          )
        ),

        pvOn ? React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "PV vermogen (kWp)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 0.5,
              value: pvKWp,
              onChange: (e) => setPvKWp(e.target.value)
            })
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Oriëntatie PV"),
            React.createElement(
              "select",
              { value: pvOrient, onChange: (e) => setPvOrient(e.target.value) },
              PV_ORIENT.map(o => React.createElement("option", { key:o.key, value:o.key }, o.label))
            ),
            React.createElement("div", { className: "help" },
              `Indicatieve opbrengst hangt af van regio en oriëntatie. (Later: meer detail via data/API.)`
            )
          )
        ) : null,

        React.createElement("div", { className: "hr" }),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Elektrische auto (EV)"),
            React.createElement(
              "select",
              { value: evOn ? "yes" : "no", onChange: (e) => setEvOn(e.target.value === "yes") },
              React.createElement("option", { value: "no" }, "Geen EV"),
              React.createElement("option", { value: "yes" }, "EV aanwezig")
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Zwembad"),
            React.createElement(
              "select",
              { value: poolOn ? "yes" : "no", onChange: (e) => setPoolOn(e.target.value === "yes") },
              React.createElement("option", { value: "no" }, "Geen zwembad"),
              React.createElement("option", { value: "yes" }, "Zwembad aanwezig")
            )
          )
        ),

        evOn ? React.createElement(
          "div",
          { className: "row row3" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "EV km/jaar"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              step: 500,
              value: evKm,
              onChange: (e) => setEvKm(e.target.value)
            })
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Verbruik (kWh/100km)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 10,
              max: 30,
              step: 1,
              value: evKwhPer100,
              onChange: (e) => setEvKwhPer100(e.target.value)
            })
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Laadverlies (%)"),
            React.createElement("input", {
              className: "input",
              type: "number",
              min: 0,
              max: 30,
              step: 1,
              value: evLoss,
              onChange: (e) => setEvLoss(e.target.value)
            })
          )
        ) : null,

        poolOn ? React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Zwembad verwarmen?"),
            React.createElement(
              "select",
              { value: poolHeated ? "yes" : "no", onChange: (e) => setPoolHeated(e.target.value === "yes") },
              React.createElement("option", { value: "no" }, "Nee"),
              React.createElement("option", { value: "yes" }, "Ja (indicatief model)")
            ),
            React.createElement("div", { className: "help" }, "Zwembadmodule is in deze werkversie nog conservatief vereenvoudigd.")
          ),
          React.createElement("div", null)
        ) : null,

        React.createElement("div", { className: "hr" }),

        React.createElement("h3", null, "Energieprijzen (aanpasbaar)"),
        React.createElement(
          "div",
          { className: "row row3" },
          Object.keys(prices).map((k) => {
            return React.createElement(
              "div",
              { className: "field", key: k },
              React.createElement("label", null, k.toUpperCase(), " (", UNIT_LABEL[k], ")"),
              React.createElement("input", {
                className: "input",
                type: "number",
                step: 0.01,
                value: prices[k],
                onChange: (e) => {
                  const v = e.target.value;
                  setPrices(prev => ({ ...prev, [k]: v === "" ? "" : Number(v) }));
                }
              })
            );
          })
        ),

        !tab2Ready ? React.createElement("div", { className: "help helpWarn" },
          "Tab 2 nog niet compleet: controleer hoofdverwarming en huishoud-elektra (basis)."
        ) : null,

        React.createElement(
          "div",
          { className: "btnRow" },
          React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(1), disabled: confirmStep !== null }, "Terug naar Tab 1"),
          React.createElement("button", { className: "btn", disabled: !tab2Ready || confirmStep !== null, onClick: () => requestNext(2) }, "Volgende: Tab 3 (met bevestiging)")
        ),

        React.createElement(ConfirmPanel, null)
      );
    }

    function Tab3() {
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 3 — Gedrag & aanwezigheid"),
          React.createElement("span", { className: "pill" }, "Kosten beïnvloeding")
        ),
        React.createElement("div", { className: "help" },
          "Gedrag beïnvloedt vooral de kosten. U bevestigt hierna de invoer, daarna tonen we resultaten (incl. DPE-bandbreedte)."
        ),

        React.createElement(
          "div",
          { className: "row row2" },
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Verwarming (gedrag)"),
            React.createElement(
              "select",
              { value: scheduleKey, onChange: (e) => setScheduleKey(e.target.value) },
              HEAT_SCHEDULE.map(x => React.createElement("option", { key:x.key, value:x.key }, x.label))
            )
          ),
          React.createElement(
            "div",
            { className: "field" },
            React.createElement("label", null, "Afwezigheid winter"),
            React.createElement(
              "select",
              { value: absenceKey, onChange: (e) => setAbsenceKey(e.target.value) },
              ABSENCE.map(x => React.createElement("option", { key:x.key, value:x.key }, x.label))
            )
          )
        ),

        React.createElement("div", { className: "help" },
          "Belangrijk: dit verandert niet de woningkwaliteit zelf, maar wel hoe vaak en hoe intensief u verwarmt."
        ),

        React.createElement(
          "div",
          { className: "btnRow" },
          React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(2), disabled: confirmStep !== null }, "Terug naar Tab 2"),
          React.createElement("button", { className: "btn", disabled: !tab3Ready || confirmStep !== null, onClick: () => requestNext(3) }, "Resultaten bekijken (met bevestiging)")
        ),

        React.createElement(ConfirmPanel, null)
      );
    }

    function Tab4() {
      // Besparingskansen: geen ROI, wel onderbouwde richting
      const quick = [
        "Regeling en setpoints optimaliseren (comfort vs verbruik): vooral effectief bij continue verwarming of hoge warmtevraag.",
        "Kierdichting en kleine luchtlekken aanpakken: effect groter bij ‘vol in de wind’.",
        "Energieprijzen instellen op uw contractniveau: dit bepaalt de kostenprojectie aanzienlijk."
      ];
      const structural = [
        "Dakisolatie is vaak de snelste structurele winst (warmte stijgt).",
        "Beglazing/ramen beïnvloeden comfort en piekverlies; effect afhankelijk van raamoppervlak.",
        "Daarna pas installaties upgraden: een goede schil maakt elk systeem effectiever."
      ];

      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 4 — Energiebesparingskansen (onderbouwd)"),
          React.createElement("span", { className: "pill" }, "Geen ROI-illusies")
        ),
        React.createElement("div", { className: "help" },
          "Hier geven we richting (quick wins en structureel) op basis van uw invoer. We tonen bewust geen ‘terugverdientijd in €’ zonder project-specifieke onderbouwing."
        ),

        React.createElement("h3", null, "Quick wins"),
        React.createElement("ul", null, quick.map((x,i)=>React.createElement("li",{key:i},x))),

        React.createElement("h3", null, "Structurele kansen"),
        React.createElement("ul", null, structural.map((x,i)=>React.createElement("li",{key:i},x))),

        React.createElement("div", { className: "btnRow" },
          React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(3) }, "Terug naar Tab 3"),
          React.createElement("button", { className: "btn", onClick: () => setTab(5) }, "Volgende: Tab 5 (DPE)")
        )
      );
    }

    function Tab5() {
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 5 — DPE (context, niet = euro’s)"),
          React.createElement("span", { className: "pill" }, "Bandbreedte")
        ),
        React.createElement("div", { className: "help" },
          "De DPE-positie is indicatief en wordt hier als bandbreedte getoond. Een officiële DPE vereist een gecertificeerde diagnose ter plaatse."
        ),
        React.createElement("div", { className: "dpeWrap" },
          React.createElement("div", { className: "sectionTitle", style:{marginBottom:6} },
            React.createElement("h3", null, "Waarschijnlijke DPE-positie"),
            React.createElement("span", { className: "dpeChip" }, `Band: ${calc.dpe.loLetter}–${calc.dpe.hiLetter}`)
          ),
          React.createElement("div", { className: "help" },
            `Op basis van woningprofiel en regio (klimaatzone). Proxy-intensiteit: ~${calc.dpe.intensity} kWh/m²/jaar.`
          ),
          React.createElement("div", { className: "help" },
            "Let op: maatregelen die € besparen en maatregelen die de DPE-klasse verbeteren zijn niet altijd dezelfde."
          )
        ),
        React.createElement("div", { className: "btnRow" },
          React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(4) }, "Terug naar Tab 4"),
          React.createElement("button", { className: "btn", onClick: () => setTab(6) }, "Volgende: Tab 6 (Print)")
        )
      );
    }

    function Tab6() {
      const txt = buildPrintableSummary();
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "sectionTitle" },
          React.createElement("h2", null, "Tab 6 — Printable summary"),
          React.createElement("span", { className: "pill" }, "Kopieerbaar")
        ),
        React.createElement("div", { className: "help" },
          "Dit blok is bedoeld om te kopiëren/plakken in Word, Keep of e-mail. Geen accounts, geen opslag."
        ),
        React.createElement("textarea", { className: "summary", readOnly: true, value: txt }),
        React.createElement("div", { className: "btnRow" },
          React.createElement("button", { className: "btn", onClick: onCopySummary }, "Kopieer"),
          React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(5) }, "Terug naar Tab 5")
        ),
        copyMsg ? React.createElement("div", { className: "help" }, copyMsg) : null,

        React.createElement("div", { className: "hr" }),

        React.createElement(
          "button",
          { className: "accordionBtn", onClick: () => setShowGrounds(!showGrounds), "aria-expanded": showGrounds ? "true" : "false" },
          React.createElement("span", null, "Grondslagen (invoer, waarden, logica)"),
          React.createElement("span", null, showGrounds ? "–" : "+")
        ),

        showGrounds ? React.createElement(
          "div",
          { className: "accordionBody" },
          React.createElement("div", { className: "neonLabel neonG" }, "GEBRUIKTE VARIABELEN"),
          React.createElement("div", { className: "neonText" },
            `Postcode: ${cp || "—"} · Zone: ${zoneName} · m²: ${clamp(n2(m2,120),20,600)} · verdiepingen: ${clamp(n2(floors,1),1,6)} · wind: ${exposureKey}`
          ),
          React.createElement("div", { className: "neonLabel neonY" }, "BEREKENING (SAMENGEVAT)"),
          React.createElement("div", { className: "neonText" },
            "Warmtevraag is indicatief: transmissie Σ(U·A) + ventilatie 0,34·ACH·V op basis van graaddagen. Kosten volgen uit systeemrendement (SCOP/η) en energieprijzen. DPE is een bandbreedte op basis van woningprofiel + regio (context), geen officieel label."
          ),
          React.createElement("div", { className: "neonLabel neonO" }, "WAARDEN & UITKOMSTEN"),
          React.createElement("div", { className: "codeLine" },
            `Htr (W/K): ${Math.round(calc.Htr)}\nHvent (W/K): ${Math.round(calc.Hvent)}\nH totaal (W/K): ${Math.round(calc.H)}\nWarmtevraag (kWh/j): ${Math.round(calc.heatKwh)}\nKosten band (€/j): ${moneyEUR(calc.low)} – ${moneyEUR(calc.high)}\nDPE band: ${calc.dpe.loLetter}-${calc.dpe.hiLetter} (proxy ${calc.dpe.intensity} kWh/m²/j)\n`
          )
        ) : null
      );
    }

    // --- Render current tab ---
    function LeftPanel() {
      return React.createElement(
        "div",
        { className: "card" },
        React.createElement(TabButtons, null),
        React.createElement("div", { className: "hr" }),
        tab === 1 ? React.createElement(Tab1, null) :
        tab === 2 ? React.createElement(Tab2, null) :
        tab === 3 ? React.createElement(Tab3, null) :
        tab === 4 ? React.createElement(Tab4, null) :
        tab === 5 ? React.createElement(Tab5, null) :
        React.createElement(Tab6, null)
      );
    }

    // Floating cost bar content
    function FloatingBar() {
      if (!floatingAllowed) return null;

      const year = `${moneyEUR(calc.low)} – ${moneyEUR(calc.high)} / jaar`;
      const month = `${moneyEUR(calc.low/12)} – ${moneyEUR(calc.high/12)} / maand`;
      const rangeNote = tab3Ready ? "Bandbreedte is smaller na Tab 3 (gedrag)." : "Bandbreedte is ruimer tot Tab 3 bevestigd is.";

      return React.createElement(
        "div",
        { className: "floatCost" },
        React.createElement(
          "div",
          { className: "floatCostInner" },
          React.createElement(
            "div",
            null,
            React.createElement("div", { className: "money" }, "Totale energiekosten (indicatief): ", year),
            React.createElement("div", { className: "moneySmall" }, month)
          ),
          React.createElement("div", { className: "floatHint" },
            "Geen schijnnauwkeurigheid: we tonen een bandbreedte. ",
            rangeNote
          ),
          React.createElement(
            "div",
            { className: "floatActions" },
            React.createElement("button", { className: "btn btnSoft", onClick: () => setTab(6), disabled: !tab3Ready || confirmStep !== null }, "Printable summary"),
            React.createElement("button", { className: "btn btnGhost", onClick: () => setTab(2), disabled: confirmStep !== null }, "Wijzig installaties")
          )
        )
      );
    }

    return React.createElement(
      React.Fragment,
      null,

      React.createElement(
        "div",
        { className: "topbar" },
        React.createElement(
          "div",
          { className: "topbarInner" },
          React.createElement(
            "div",
            { className: "brand" },
            React.createElement("div", { className: "dot" }),
            React.createElement("div", { className: "brandTitle" }, TOOL.name)
          ),
          React.createElement("span", { className: "pill" }, TOOL.version)
        )
      ),

      React.createElement(FloatingBar, null),

      React.createElement(
        "div",
        { className: "wrap" },
        React.createElement("h1", null, "Energiekompas Frankrijk"),
        React.createElement("div", { className: "kicker" },
          "Werkwijze: Tab 1 → Tab 2 → Tab 3 met bevestiging. Resultaten (kostenbandbreedte, DPE-band) pas daarna. Indicatief hulpmiddel – geen gecertificeerde DPE/audit."
        ),

        React.createElement(
          "div",
          { className: "grid" },
          React.createElement(LeftPanel, null),
          React.createElement(RightPanel, null)
        )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App));
})();
