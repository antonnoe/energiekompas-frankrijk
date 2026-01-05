// script.js
(function () {
  const { useEffect, useMemo, useRef, useState } = React;

  const TOOL_NAME = "Energiekompas Frankrijk";
  const TOOL_VERSION = "v2.0";
  const BRAND = "#800000";

  // ---- Klimaatzones (label + indicatieve HDD) ----
  const ZONES = [
    { id: "med", name: "Méditerranée (zacht)", hdd: 1400 },
    { id: "ouest", name: "Zuid-West / Atlantisch", hdd: 1900 },
    { id: "paris", name: "Noord / Parijs (Île-de-France)", hdd: 2200 },
    { id: "centre", name: "Centraal / Bourgogne", hdd: 2500 },
    { id: "est", name: "Oost / Elzas-Lotharingen", hdd: 2800 },
    { id: "mont", name: "Bergen (koel)", hdd: 3400 },
  ];

  // ---- Aanwezigheidsprofielen ----
  const PRESENCE = [
    { key: "high", label: "Veel", factor: 1.00 },
    { key: "mid", label: "Gemiddeld", factor: 0.85 },
    { key: "low", label: "Weinig", factor: 0.70 },
  ];

  // ---- Bouwperiode -> warmtefactor (grof; bewust indicatief) ----
  const BUILD = [
    { key: "pre1948", label: "Voor 1948", heatFactor: 0.085 },
    { key: "1948_1974", label: "1948–1974", heatFactor: 0.075 },
    { key: "1975_1990", label: "1975–1990", heatFactor: 0.060 },
    { key: "1991_2005", label: "1991–2005", heatFactor: 0.050 },
    { key: "2006_2012", label: "2006–2012", heatFactor: 0.042 },
    { key: "2013plus", label: "2013+", heatFactor: 0.035 },
  ];

  // ---- Verwarming (vereenvoudigd) ----
  const HEAT = [
    { key: "hp", label: "Warmtepomp", scop: 3.2, energy: "elec" },
    { key: "elec", label: "Elektrisch (direct)", scop: 1.0, energy: "elec" },
    { key: "gas", label: "Aardgas (ketel)", eta: 0.92, energy: "gas" },
    { key: "fioul", label: "Fioul (olie)", eta: 0.85, energy: "fioul" },
    { key: "pellet", label: "Pelletkachel/ketel", eta: 0.85, energy: "pellet" },
    { key: "wood", label: "Hout (stère)", eta: 0.75, energy: "wood" },
    { key: "propaan", label: "Propaan", eta: 0.90, energy: "propaan" },
  ];

  // ---- Energieprijzen (defaults; later uitbreidbaar) ----
  const PRICE = {
    elec: 0.25,     // €/kWh
    gas: 1.20,      // €/m³ (≈ 10 kWh)
    fioul: 1.15,    // €/L  (≈ 10 kWh)
    pellet: 0.60,   // €/kg (≈ 5 kWh)
    wood: 85,       // €/stère (≈ 1800 kWh)
    propaan: 1.80,  // €/L  (≈ 7.1 kWh)
  };

  const KWH_PER_UNIT = {
    elec: 1,
    gas: 10,
    fioul: 10,
    pellet: 5,
    wood: 1800,
    propaan: 7.1,
  };

  // ---- Totale verbruiksslider (apparaten + warm water + overig) ----
  const SLIDER = { min: 1500, max: 9000, step: 100 };

  // ---- BAN autocomplete ----
  const BAN_ENDPOINT = "https://api-adresse.data.gouv.fr/search/";

  // ---- Helpers ----
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function round(n) { return Math.round(n); }
  function moneyEUR(v) {
    const n = Number.isFinite(v) ? v : 0;
    return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }
  function todayNL() {
    const d = new Date();
    return d.toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  }

  // ---- Postcode -> departement (incl. Corsica 20xxx) ----
  function zoneFromPostalCode(cp) {
    if (!cp || !/^\d{5}$/.test(cp)) return null;
    const dep2 = cp.slice(0, 2);
    if (dep2 === "20") return "med"; // Corsica
    const dep = dep2;

    // Mediterranée
    if (["04","05","06","11","13","30","34","66","83","84"].includes(dep)) return "med";

    // Atlantisch / Zuid-West
    if (["16","17","24","33","40","47","64","79","85","86","87","44","56","29","22","35","49","50","14"].includes(dep)) return "ouest";

    // Bergen (grof)
    if (["09","12","15","19","31","32","38","42","43","46","48","63","65","73","74"].includes(dep)) return "mont";

    // Oost (grof)
    if (["08","10","51","52","54","55","57","67","68","88","90","25","39","70","71","21"].includes(dep)) return "est";

    // Parijs/Noord (Île-de-France + noordelijke band grof)
    if (["75","77","78","91","92","93","94","95","59","62","60","80","02","51"].includes(dep)) return "paris";

    // Default
    return "centre";
  }

  // ---- Warmtevraag (indicatief) ----
  function computeHeatKwh({ m2, zoneId, buildKey, presenceKey }) {
    const z = ZONES.find(x => x.id === zoneId) || ZONES[2];
    const b = BUILD.find(x => x.key === buildKey) || BUILD[2];
    const p = PRESENCE.find(x => x.key === presenceKey) || PRESENCE[1];
    return m2 * z.hdd * b.heatFactor * p.factor;
  }

  function heatingInputAndCost({ heatKey, heatKwh, prices }) {
    const h = HEAT.find(x => x.key === heatKey) || HEAT[0];
    const unit = h.energy;
    const price = prices[unit];
    const kwhPerUnit = KWH_PER_UNIT[unit];

    let inputKwh;
    if (h.key === "hp") inputKwh = heatKwh / (h.scop || 3.2);
    else if (h.key === "elec") inputKwh = heatKwh;
    else inputKwh = heatKwh / (h.eta || 0.90);

    const units = inputKwh / kwhPerUnit;
    const cost = units * price;
    return { inputKwh, units, unit, cost };
  }

  // ---- DPE: indicatieve letter + band (bewust: positionering, geen claim) ----
  // We gebruiken een simpele intensiteit (kWh/m²/jaar proxy) uit modelresultaten.
  // Let op: dit is geen officiële DPE-methode, enkel "waarschijnlijke positie".
  const DPE_LETTERS = ["A","B","C","D","E","F","G"];

  function dpeFromIntensity(intensity) {
    // grenzen geïnspireerd op het bekende A..G patroon, maar dit blijft indicatief
    // A < 70, B < 110, C < 180, D < 250, E < 330, F < 420, G >= 420
    if (intensity < 70) return 0;
    if (intensity < 110) return 1;
    if (intensity < 180) return 2;
    if (intensity < 250) return 3;
    if (intensity < 330) return 4;
    if (intensity < 420) return 5;
    return 6;
  }

  function buildAdvice({ heatKey, buildKey, presenceKey, zoneId, m2 }) {
    // Twee sporen: besparing & DPE-optimalisering
    // Quick wins: altijd; structureel: afhankelijk van bouwperiode/verwarming
    const bIdx = BUILD.findIndex(x => x.key === buildKey);
    const heat = HEAT.find(x => x.key === heatKey) || HEAT[0];

    const quick = [
      "Instellingen optimaliseren (temperatuur, tijdschema, nachtverlaging waar passend).",
      "Sluipverbruik beperken en verbruiksprofiel kalibreren (één totale slider).",
      "Kleine kierdichting en eenvoudige verbeteringen (tocht, luiken, gordijnen)."
    ];

    const structural = [];
    if (bIdx <= 2) structural.push("Gebouwschil verbeteren: dak eerst, daarna muren/ramen (stap voor stap).");
    else structural.push("Gerichte isolatie-upgrades op zwakke plekken (dak/ramen) indien nog niet op orde.");
    if (heat.key === "elec") structural.push("Overweeg warmtepomp of hybride oplossing (comfort + kosten).");
    if (heat.key === "fioul") structural.push("Vervang fioul op termijn (kosten, CO₂, toekomstbestendigheid).");
    if (heat.key === "gas") structural.push("Optimaliseer ketelregeling of overweeg warmtepomp bij renovatie.");
    if (structural.length === 0) structural.push("Structureel: focus op isolatie en regeltechniek, pas daarna op installaties.");

    const dpe = [];
    dpe.push("DPE-klasse verbetert meestal het snelst via de gebouwschil (dak/ramen/isolatielekken).");
    dpe.push("Daarna: efficiëntere warmteopwekking (warmtepomp/ketelupgrade) en goede regeling.");
    dpe.push("Let op: maatregelen die € besparen en maatregelen die de DPE-klasse verbeteren zijn niet altijd dezelfde.");

    return { quick, structural, dpe };
  }

  // ---- Kopieerbaar rapport (postcode-only) ----
  function makeReport({ cp, zoneId, inputs, results, dpe, advice }) {
    const zone = ZONES.find(z => z.id === zoneId)?.name || "—";
    const build = BUILD.find(b => b.key === inputs.buildKey)?.label || "—";
    const pres = PRESENCE.find(p => p.key === inputs.presenceKey)?.label || "—";
    const heat = HEAT.find(h => h.key === inputs.heatKey)?.label || "—";

    const lines = [];
    lines.push(`${TOOL_NAME} – Samenvatting (indicatief)`);
    lines.push(`Postcode: ${cp || "—"}`);
    lines.push(`Datum: ${todayNL()}`);
    lines.push(`Toolversie: ${TOOL_VERSION}`);
    lines.push(``);
    lines.push(`1) Woningprofiel (invoer)`);
    lines.push(`- Woonoppervlak: ${inputs.m2} m²`);
    lines.push(`- Bouwperiode: ${build}`);
    lines.push(`- Aanwezigheid: ${pres}`);
    lines.push(`- Verwarming: ${heat}`);
    lines.push(`- Klimaatzone: ${zone} (automatisch bepaald op basis van postcode)`);
    lines.push(`- Totale elektra (slider): ${inputs.sliderKwh} kWh/jaar`);
    lines.push(``);
    lines.push(`2) Resultaten (indicatief)`);
    lines.push(`- Totale energiekosten: ${moneyEUR(results.totalCost)} / jaar`);
    lines.push(`- Per maand: ${moneyEUR(results.perMonth)} / maand`);
    lines.push(`- Warmtevraag: ${round(results.heatKwh)} kWh/jaar`);
    lines.push(`- Elektra totaal: ${round(results.elecKwh)} kWh/jaar`);
    lines.push(``);
    lines.push(`3) Waarschijnlijke DPE-positie (context)`);
    lines.push(`- Indicatieve DPE-klasse: ${dpe.letter}`);
    lines.push(`- Bandbreedte: ${dpe.bandLow} – ${dpe.bandHigh}`);
    lines.push(`Toelichting: deze inschatting combineert woningprofiel en regio (klimaat). Dit is geen officieel DPE-rapport.`);
    lines.push(``);
    lines.push(`4) Adviezen – twee sporen`);
    lines.push(`A) Besparingskansen (comfort & kosten)`);
    lines.push(`- Quick wins:`);
    advice.quick.forEach(x => lines.push(`  • ${x}`));
    lines.push(`- Structurele kansen:`);
    advice.structural.forEach(x => lines.push(`  • ${x}`));
    lines.push(``);
    lines.push(`B) DPE-optimalisering (label & toekomst)`);
    advice.dpe.forEach(x => lines.push(`  • ${x}`));
    lines.push(``);
    lines.push(`5) Grondslagen (samengevat)`);
    lines.push(`- Postcode → klimaatzone (klimaat beïnvloedt warmtevraag).`);
    lines.push(`- Warmtevraag (indicatief) → energie-input → kosten (met standaardprijzen).`);
    lines.push(`- DPE-positie is een contextuele indicatie (geen officiële methode).`);
    lines.push(``);
    lines.push(`Disclaimer: Dit hulpmiddel is bedoeld voor inzicht en vergelijking en vervangt geen gecertificeerde DPE-audit of energie-audit.`);

    return lines.join("\n");
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // ---- Component ----
  function App() {
    // context / BAN
    const [addressQuery, setAddressQuery] = useState("");
    const [banBusy, setBanBusy] = useState(false);
    const [banErr, setBanErr] = useState("");
    const [banHits, setBanHits] = useState([]);

    const [cp, setCp] = useState("");
    const [zoneId, setZoneId] = useState("paris");
    const [zoneLocked, setZoneLocked] = useState(false);

    // inputs
    const [m2, setM2] = useState(120);
    const [buildKey, setBuildKey] = useState("1975_1990");
    const [presenceKey, setPresenceKey] = useState("mid");
    const [sliderKwh, setSliderKwh] = useState(4200);
    const [heatKey, setHeatKey] = useState("hp");

    const [showRegionTip, setShowRegionTip] = useState(false);
    const [showGrounds, setShowGrounds] = useState(false);

    const [copyMsg, setCopyMsg] = useState("");

    const [prices] = useState({ ...PRICE });

    const searchTimer = useRef(null);

    // BAN autocomplete (debounced)
    useEffect(() => {
      setBanErr("");
      setBanHits([]);

      const q = (addressQuery || "").trim();
      if (q.length < 6) return;

      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        try {
          setBanBusy(true);
          const url = `${BAN_ENDPOINT}?q=${encodeURIComponent(q)}&limit=6`;
          const r = await fetch(url);
          if (!r.ok) throw new Error("BAN request failed");
          const j = await r.json();
          const feats = Array.isArray(j?.features) ? j.features : [];
          setBanHits(feats);
          setBanBusy(false);
        } catch (e) {
          setBanBusy(false);
          setBanErr("Adreszoeker tijdelijk niet beschikbaar. Vul dan alleen de postcode in.");
        }
      }, 250);

      return () => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
      };
    }, [addressQuery]);

    // postcode -> klimaatzone (auto), tenzij user zone expliciet lockt
    useEffect(() => {
      if (zoneLocked) return;
      const z = zoneFromPostalCode(cp);
      if (z && z !== zoneId) setZoneId(z);
    }, [cp, zoneLocked, zoneId]);

    function onPickAddress(f) {
      const props = f?.properties || {};
      const label = props.label || "";
      const postcode = (props.postcode || "").replace(/\D/g, "").slice(0, 5);

      setAddressQuery(label);
      setBanHits([]);
      setCp(postcode);
      setZoneLocked(false);
    }

    const inputs = useMemo(() => ({
      cp,
      zoneId,
      m2: clamp(Number(m2) || 0, 20, 600),
      buildKey,
      presenceKey,
      sliderKwh: clamp(Number(sliderKwh) || SLIDER.min, SLIDER.min, SLIDER.max),
      heatKey
    }), [cp, zoneId, m2, buildKey, presenceKey, sliderKwh, heatKey]);

    const results = useMemo(() => {
      const heatKwh = computeHeatKwh(inputs);
      const h = heatingInputAndCost({ heatKey: inputs.heatKey, heatKwh, prices });

      // totale elektra = slider + (warmtepomp/direct warmte-input)
      let elecKwh = inputs.sliderKwh;
      if (inputs.heatKey === "hp" || inputs.heatKey === "elec") {
        elecKwh += h.inputKwh;
      }

      const elecCost = elecKwh * prices.elec;
      const heatCost = (inputs.heatKey === "hp" || inputs.heatKey === "elec") ? 0 : h.cost;
      const totalCost = (inputs.heatKey === "hp" || inputs.heatKey === "elec") ? elecCost : elecCost + heatCost;

      return {
        heatKwh,
        heatInputKwh: h.inputKwh,
        elecKwh,
        elecCost,
        heatCost,
        totalCost,
        perMonth: totalCost / 12,
      };
    }, [inputs, prices]);

    const dpe = useMemo(() => {
      // intensiteit proxy: (warmtevraag + elektra) per m²
      // (bewust eenvoudig; doel: indicatieve positie)
      const m2safe = Math.max(20, inputs.m2);
      const intensity = (results.heatKwh + inputs.sliderKwh) / m2safe;

      const idx = dpeFromIntensity(intensity);
      const letter = DPE_LETTERS[idx];

      const lowIdx = clamp(idx - 1, 0, 6);
      const highIdx = clamp(idx + 1, 0, 6);

      return {
        idx,
        letter,
        bandLow: DPE_LETTERS[lowIdx],
        bandHigh: DPE_LETTERS[highIdx],
        intensity: Math.round(intensity)
      };
    }, [results.heatKwh, inputs.sliderKwh, inputs.m2]);

    const advice = useMemo(() => buildAdvice(inputs), [inputs]);

    const zoneName = useMemo(() => ZONES.find(z => z.id === zoneId)?.name || "—", [zoneId]);

    // DPE bar geometry
    const dpePointerPct = useMemo(() => {
      // center of segment
      const segW = 100 / 7;
      return (dpe.idx * segW) + (segW / 2);
    }, [dpe.idx]);

    const dpeBand = useMemo(() => {
      const segW = 100 / 7;
      const low = DPE_LETTERS.indexOf(dpe.bandLow);
      const high = DPE_LETTERS.indexOf(dpe.bandHigh);
      const left = (Math.min(low, high) * segW);
      const right = ((Math.max(low, high) + 1) * segW);
      return { left, width: Math.max(0, right - left) };
    }, [dpe.bandLow, dpe.bandHigh]);

    // V1 deep link (waarden meegeven via querystring; V1 kan dit later gaan lezen)
    const v1Url = useMemo(() => {
      const u = new URL("https://infofrankrijk.com/energieverbruik-en-warmteverliescalculator/");
      if (cp) u.searchParams.set("cp", cp);
      u.searchParams.set("zone", zoneId);
      u.searchParams.set("m2", String(inputs.m2));
      u.searchParams.set("build", buildKey);
      u.searchParams.set("presence", presenceKey);
      u.searchParams.set("heat", heatKey);
      u.searchParams.set("kwh", String(inputs.sliderKwh));
      return u.toString();
    }, [cp, zoneId, inputs.m2, buildKey, presenceKey, heatKey, inputs.sliderKwh]);

    async function onCopyReport() {
      setCopyMsg("");
      const report = makeReport({
        cp,
        zoneId,
        inputs,
        results,
        dpe,
        advice
      });

      const ok = await copyToClipboard(report);
      if (ok) {
        setCopyMsg("Gekopieerd. Plak dit in Word, Keep of e-mail.");
        setTimeout(() => setCopyMsg(""), 3500);
      } else {
        setCopyMsg("Kopiëren lukt niet automatisch in deze browser. Selecteer en kopieer de tekst handmatig in ‘Grondslagen’.");
      }
    }

    function downloadTxt() {
      const report = makeReport({ cp, zoneId, inputs, results, dpe, advice });
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `energiekompas_${cp || "postcode"}_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    // ---- UI ----
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
            { className: "brandBadge" },
            React.createElement("div", { className: "dot" }),
            React.createElement("div", { className: "brandTitle" }, TOOL_NAME)
          ),
          React.createElement("span", { className: "pill" }, `${TOOL_VERSION}`)
        )
      ),

      React.createElement(
        "div",
        { className: "wrap" },

        React.createElement("h1", null, "Energiekompas Frankrijk"),
        React.createElement("div", { className: "kicker" },
          "Context eerst (adres/postcode), daarna inzicht (kosten, waarschijnlijke DPE-positie) en adviezen. Indicatief hulpmiddel – geen gecertificeerde DPE-audit."
        ),

        React.createElement(
          "div",
          { className: "grid", style: { marginTop: 16 } },

          // LEFT
          React.createElement(
            "div",
            { className: "card" },

            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "1) Context"),
              React.createElement("span", { className: "pill" }, "Adres of postcode")
            ),

            React.createElement(
              "div",
              { className: "field" },
              React.createElement(
                "label",
                null,
                "Adres (BAN, optioneel)"
              ),
              React.createElement("input", {
                className: "input",
                value: addressQuery,
                onChange: (e) => {
                  setAddressQuery(e.target.value || "");
                  setBanHits([]);
                },
                placeholder: "Bijv. Rue Sem 33100 Bordeaux",
                "aria-label": "Adres zoeken"
              }),
              React.createElement("div", { className: "help" },
                "Als u geen exact adres heeft: vul alleen de postcode in. De klimaatzone wordt dan automatisch bepaald."
              )
            ),

            banErr ? React.createElement("div", { className: "help", style: { color: "#b00020", fontWeight: 900 } }, banErr) : null,
            banBusy ? React.createElement("div", { className: "help" }, "Zoeken…") : null,

            (banHits && banHits.length > 0) ? React.createElement(
              "div",
              { className: "suggestions" },
              banHits.map((f, idx) => {
                const p = f.properties || {};
                const pc = (p.postcode || "").toString();
                return React.createElement(
                  "div",
                  { key: idx, className: "sugItem", onClick: () => onPickAddress(f) },
                  React.createElement("div", { className: "sugMain" }, p.label || "Onbekend adres"),
                  React.createElement("div", { className: "sugSub" }, `Postcode: ${pc || "—"} · Gemeente: ${p.city || "—"}`)
                );
              })
            ) : null,

            React.createElement(
              "div",
              { className: "row row2" },
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Postcode"),
                React.createElement("input", {
                  className: "input",
                  value: cp,
                  onChange: (e) => {
                    const v = (e.target.value || "").replace(/\D/g, "").slice(0, 5);
                    setCp(v);
                  },
                  placeholder: "33100",
                  inputMode: "numeric",
                  "aria-label": "Postcode"
                }),
                React.createElement("div", { className: "help" },
                  "Postcode bepaalt automatisch de klimaatzone en wordt later gebruikt voor regionale benchmark."
                )
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
                  zoneLocked
                    ? "U heeft de klimaatzone handmatig aangepast. Als u wilt: pas de postcode aan om weer automatisch te bepalen."
                    : "Automatisch bepaald (op basis van postcode). U kunt dit aanpassen."
                )
              )
            ),

            showRegionTip ? React.createElement(
              "div",
              { className: "tipBox" },
              React.createElement("b", null, "Waarom speelt regio een rol?"),
              React.createElement("div", null,
                "De DPE-methode houdt rekening met klimaatverschillen. In koudere regio’s is de warmtevraag structureel hoger dan in mildere regio’s. ",
                "Daardoor kan dezelfde woning in een andere regio een andere (waarschijnlijke) DPE-positie hebben, zonder dat de woning zelf verandert. ",
                "Deze tool gebruikt de klimaatzone als contextvariabele. Dit blijft indicatief en vervangt geen officieel DPE."
              )
            ) : null,

            React.createElement("div", { className: "hr" }),

            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "2) Woningprofiel (snel)"),
              React.createElement("span", { className: "pill" }, "Geen details")
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
                  value: m2,
                  onChange: (e) => setM2(clamp(parseInt(e.target.value || "0", 10) || 0, 20, 600)),
                  type: "number",
                  min: 20,
                  max: 600
                }),
                React.createElement("div", { className: "help" }, "Alleen m². U-waarden, volume en ventilatie komen pas in de uitgebreide analyse.")
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Bouwperiode"),
                React.createElement(
                  "select",
                  { value: buildKey, onChange: (e) => setBuildKey(e.target.value) },
                  BUILD.map(b => React.createElement("option", { key: b.key, value: b.key }, b.label))
                )
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Aanwezigheid"),
                React.createElement(
                  "select",
                  { value: presenceKey, onChange: (e) => setPresenceKey(e.target.value) },
                  PRESENCE.map(p => React.createElement("option", { key: p.key, value: p.key }, p.label))
                )
              )
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
                  { value: heatKey, onChange: (e) => setHeatKey(e.target.value) },
                  HEAT.map(h => React.createElement("option", { key: h.key, value: h.key }, h.label))
                )
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Totale elektra (1 slider)"),
                React.createElement(
                  "div",
                  { className: "sliderWrap" },
                  React.createElement("input", {
                    className: "slider",
                    type: "range",
                    min: SLIDER.min,
                    max: SLIDER.max,
                    step: SLIDER.step,
                    value: sliderKwh,
                    onChange: (e) => setSliderKwh(parseInt(e.target.value, 10) || SLIDER.min)
                  }),
                  React.createElement(
                    "div",
                    { className: "sliderMeta" },
                    React.createElement("span", null, `Laag (${SLIDER.min} kWh)`),
                    React.createElement("span", null, `${sliderKwh} kWh/jaar`),
                    React.createElement("span", null, `Hoog (${SLIDER.max} kWh)`)
                  )
                ),
                React.createElement("div", { className: "help" },
                  "Deze slider vervangt losse apparatenposten. In de uitgebreide analyse kunt u dit verfijnen (PV, EV, zwembad, airco, etc.)."
                )
              )
            ),

            React.createElement("div", { className: "hr" }),

            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "3) Verdiepen"),
              React.createElement("span", { className: "pill" }, "Uitgebreide analyse")
            ),

            React.createElement("div", { className: "help" },
              "Wilt u deze analyse uitbreiden met isolatie per bouwdeel, ventilatie, zonnepanelen, zwembad en meer scenario’s? Dan kunt u doorgaan naar de uitgebreide warmteverliescalculator. Basiswaarden worden meegegeven waar mogelijk."
            ),

            React.createElement(
              "div",
              { className: "btnRow" },
              React.createElement(
                "a",
                { className: "btn btnGhost", href: v1Url, target: "_blank", rel: "noopener" },
                "Open uitgebreide analyse (V1)"
              )
            )
          ),

          // RIGHT (sticky)
          React.createElement(
            "div",
            { className: "stickyRight" },
            React.createElement(
              "div",
              { className: "cardWhite" },

              React.createElement(
                "div",
                { className: "sectionTitle" },
                React.createElement("h2", null, "Resultaat"),
                React.createElement("span", { className: "pill" }, "Indicatief")
              ),

              React.createElement(
                "div",
                { className: "resultHeader" },
                React.createElement(
                  "div",
                  null,
                  React.createElement("div", { className: "money" }, moneyEUR(results.totalCost)),
                  React.createElement("div", { className: "subMoney" }, `${moneyEUR(results.perMonth)} / maand`)
                ),
                React.createElement(
                  "div",
                  { className: "badge" },
                  React.createElement("span", { style: { color: BRAND, fontWeight: 900 } }, "Postcode:"),
                  React.createElement("span", null, cp || "—")
                )
              ),

              React.createElement("div", { className: "hr" }),

              // DPE slider (core)
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "sectionTitle", style: { marginBottom: 6 } },
                  React.createElement("h2", null, "Waarschijnlijke DPE-positie"),
                  React.createElement(
                    "span",
                    { className: "dpeChip" },
                    "Indicatief: ",
                    dpe.letter,
                    " (", dpe.bandLow, "–", dpe.bandHigh, ")"
                  )
                ),

                React.createElement(
                  "div",
                  { className: "dpeWrap" },
                  React.createElement(
                    "div",
                    { className: "dpeBar" },
                    // segments
                    React.createElement("div", { className: "dpeSeg", style: { background: "#2ecc71" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#7bed9f" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#f1c40f" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#f39c12" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#e67e22" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#e74c3c" } }),
                    React.createElement("div", { className: "dpeSeg", style: { background: "#b71c1c" } }),

                    React.createElement("div", {
                      className: "dpeBand",
                      style: { left: dpeBand.left + "%", width: dpeBand.width + "%" }
                    }),
                    React.createElement("div", {
                      className: "dpePointer",
                      style: { left: dpePointerPct + "%" }
                    })
                  ),
                  React.createElement(
                    "div",
                    { className: "dpeLabels" },
                    React.createElement("span", null, "A"),
                    React.createElement("span", null, "B"),
                    React.createElement("span", null, "C"),
                    React.createElement("span", null, "D"),
                    React.createElement("span", null, "E"),
                    React.createElement("span", null, "F"),
                    React.createElement("span", null, "G")
                  ),
                  React.createElement(
                    "div",
                    { className: "dpeMeta" },
                    React.createElement("span", { className: "badge badgeMuted" }, "Klimaatzone: ", zoneName),
                    React.createElement("span", { className: "badge badgeMuted" }, "Model-intensiteit: ~", dpe.intensity, " kWh/m²/jr")
                  ),
                  React.createElement("div", { className: "help" },
                    "Op basis van woningprofiel en regio (klimaatzone). Dit is context en vervangt geen officieel DPE-rapport."
                  )
                )
              ),

              React.createElement("div", { className: "hr" }),

              // Key numbers
              React.createElement(
                "div",
                { className: "sectionTitle", style: { marginBottom: 6 } },
                React.createElement("h2", null, "Kerncijfers"),
                React.createElement("span", { className: "pill" }, "kWh & €")
              ),
              React.createElement("div", { className: "help" }, `Warmtevraag (indicatief): ${round(results.heatKwh)} kWh/jaar · Elektra totaal: ${round(results.elecKwh)} kWh/jaar.`),

              React.createElement("div", { className: "hr" }),

              // Advice
              React.createElement(
                "div",
                { className: "sectionTitle", style: { marginBottom: 6 } },
                React.createElement("h2", null, "Adviezen"),
                React.createElement("span", { className: "pill" }, "2 sporen")
              ),

              React.createElement(
                "div",
                { className: "adviceGrid" },
                React.createElement(
                  "div",
                  { className: "adviceBox" },
                  React.createElement("div", { className: "adviceTitle" }, "Besparingskansen"),
                  React.createElement("div", { className: "adviceSub" }, "Quick wins"),
                  React.createElement(
                    "ul",
                    { className: "ul" },
                    advice.quick.map((x, i) => React.createElement("li", { key: i }, x))
                  ),
                  React.createElement("div", { className: "adviceSub" }, "Structurele kansen"),
                  React.createElement(
                    "ul",
                    { className: "ul" },
                    advice.structural.map((x, i) => React.createElement("li", { key: i }, x))
                  )
                ),
                React.createElement(
                  "div",
                  { className: "adviceBox" },
                  React.createElement("div", { className: "adviceTitle" }, "DPE-optimalisering"),
                  React.createElement(
                    "ul",
                    { className: "ul" },
                    advice.dpe.map((x, i) => React.createElement("li", { key: i }, x))
                  )
                )
              ),

              React.createElement("div", { className: "hr" }),

              // Grondslagen accordion + copy
              React.createElement(
                "button",
                {
                  className: "accordionBtn",
                  onClick: () => setShowGrounds(!showGrounds),
                  "aria-expanded": showGrounds ? "true" : "false"
                },
                React.createElement("span", null, "Grondslagen (invoer, waarden, logica)"),
                React.createElement("span", null, showGrounds ? "–" : "+")
              ),

              showGrounds ? React.createElement(
                "div",
                { className: "accordionBody" },

                React.createElement(
                  "div",
                  { className: "btnRow", style: { marginTop: 0 } },
                  React.createElement("button", { className: "btn", onClick: onCopyReport }, "Kopieer rapport"),
                  React.createElement("button", { className: "btn btnSoft", onClick: downloadTxt }, "Download .txt")
                ),
                copyMsg ? React.createElement("div", { className: "neonText", style: { marginTop: 8 } }, copyMsg) : null,

                React.createElement("div", { style: { marginTop: 12 } }),

                React.createElement("div", { className: "neonRow" },
                  React.createElement("div", { className: "neonLabel neonG" }, "GEBRUIKTE VARIABELEN"),
                  React.createElement("div", { className: "neonText" },
                    `Postcode: ${cp || "—"} · Klimaatzone: ${zoneName} · m²: ${inputs.m2} · Bouwperiode: ${BUILD.find(b=>b.key===buildKey)?.label || "—"} · Aanwezigheid: ${PRESENCE.find(p=>p.key===presenceKey)?.label || "—"} · Verwarming: ${HEAT.find(h=>h.key===heatKey)?.label || "—"} · Elektra-slider: ${inputs.sliderKwh} kWh/jaar`
                  ),

                  React.createElement("div", { className: "neonLabel neonY" }, "BEREKENING (SAMENGEVAT)"),
                  React.createElement("div", { className: "neonText" },
                    "1) Postcode → klimaatzone (klimaat beïnvloedt warmtevraag). 2) Warmtevraag (indicatief) op basis van m² × graaddagen × bouwperiodefactor × aanwezigheid. 3) Verwarming zet warmtevraag om naar energie-input (SCOP/η) en kosten (standaard energieprijzen). 4) DPE-positie is een contextuele indicatie (positie + bandbreedte), geen officieel label."
                  ),

                  React.createElement("div", { className: "neonLabel neonO" }, "WAARDEN & UITKOMSTEN"),
                  React.createElement("div", { className: "codeLine" },
                    `Kosten/jaar: ${moneyEUR(results.totalCost)}\nPer maand: ${moneyEUR(results.perMonth)}\nWarmtevraag: ${round(results.heatKwh)} kWh/jaar\nElektra totaal: ${round(results.elecKwh)} kWh/jaar\nDPE (indicatief): ${dpe.letter} (band: ${dpe.bandLow}-${dpe.bandHigh})\n`
                  ),

                  React.createElement("div", { className: "neonText", style: { marginTop: 10 } },
                    "Disclaimer: dit hulpmiddel is bedoeld voor inzicht en vergelijking en vervangt geen gecertificeerde DPE-audit of energie-audit."
                  )
                )
              ) : null,

              React.createElement("div", { className: "footerNote" },
                "Oriëntatietool — geen gecertificeerde DPE-audit. Officiële audits vereisen gevalideerde software en een gecertificeerde expert."
              )
            )
          )
        )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App));
})();
