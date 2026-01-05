// script.js
/* Energiekompas Frankrijk (MVP)
   - Doel: extreem laagdrempelig, niet-overweldigend
   - Flow:
     1) Adres (BAN) óf Regio (klimaatzone) -> context
     2) Snelle invoer: m², bouwperiode, aanwezigheidprofiel, verbruiksslider, verwarmingsbron
     3) Resultaat: kosten + grootste verbeterknop
     4) Scenariomodus (wow): Baseline vs Scenario
*/

(function () {
  const { useEffect, useMemo, useRef, useState } = React;

  // -----------------------------
  // House constants / assumptions
  // -----------------------------
  const BRAND = "#800000";

  // Klimaatzones (zelfde als uw bestaande model; HDD indicatief)
  const ZONES = [
    { id: "med", name: "Méditerranée (zacht)", hdd: 1400 },
    { id: "ouest", name: "Zuid-West / Atlantisch", hdd: 1900 },
    { id: "paris", name: "Noord / Parijs (Île-de-France)", hdd: 2200 },
    { id: "centre", name: "Centraal / Bourgogne", hdd: 2500 },
    { id: "est", name: "Oost / Elzas-Lotharingen", hdd: 2800 },
    { id: "mont", name: "Bergen (koel)", hdd: 3400 },
  ];

  // Aanwezigheidsprofielen (geen dagen/jaar tonen)
  const PRESENCE = [
    { key: "high", label: "Veel", factor: 1.00 },
    { key: "mid", label: "Gemiddeld", factor: 0.85 },
    { key: "low", label: "Weinig", factor: 0.70 },
  ];

  // Bouwperiode -> globale warmteverliesfactor (zeer grof; Expert later)
  // factor vertaalt m² + HDD naar warmtevraag bandbreedte.
  const BUILD = [
    { key: "pre1948", label: "Voor 1948", heatFactor: 0.085 },
    { key: "1948_1974", label: "1948–1974", heatFactor: 0.075 },
    { key: "1975_1990", label: "1975–1990", heatFactor: 0.060 },
    { key: "1991_2005", label: "1991–2005", heatFactor: 0.050 },
    { key: "2006_2012", label: "2006–2012", heatFactor: 0.042 },
    { key: "2013plus", label: "2013+", heatFactor: 0.035 },
  ];

  // Verwarming (vereenvoudigd)
  const HEAT = [
    { key: "hp", label: "Warmtepomp", scop: 3.2, energy: "elec" },
    { key: "elec", label: "Elektrisch (direct)", scop: 1.0, energy: "elec" },
    { key: "gas", label: "Aardgas (ketel)", eta: 0.92, energy: "gas" },
    { key: "fioul", label: "Fioul (olie)", eta: 0.85, energy: "fioul" },
    { key: "pellet", label: "Pelletkachel/ketel", eta: 0.85, energy: "pellet" },
    { key: "wood", label: "Hout (stère)", eta: 0.75, energy: "wood" },
    { key: "propaan", label: "Propaan", eta: 0.90, energy: "propaan" },
  ];

  // Energieprijzen (default; gebruiker kan later uitbreiden)
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

  // Totale verbruiksslider: extra elektra bovenop basis (apparaten + warm water + evt. koken)
  // (MVP: zeer simpel; later detail)
  const SLIDER = { min: 1500, max: 9000, step: 100 };

  // BAN (Base Adresse Nationale) autocomplete
  // NB: endpoint is stabiel in de praktijk, maar u kunt later upgraden/aanpassen.
  const BAN_ENDPOINT = "https://api-adresse.data.gouv.fr/search/";

  // -----------------------------
  // Helpers
  // -----------------------------
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function round(n) { return Math.round(n); }
  function moneyEUR(v) {
    const n = Number.isFinite(v) ? v : 0;
    return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }
  function fmt1(v) { return (Number.isFinite(v) ? v : 0).toFixed(1); }

  function pickZoneByPostal(cp) {
    // MVP: eenvoudige heuristiek (u kunt later INSEE/geo koppelen).
    // Zonder externe geo: we laten BAN adres de keuze tonen, maar vragen zone expliciet bij twijfel.
    // Hier dus: return null => gebruiker kiest.
    return null;
  }

  function computeHeatKwh({ m2, zoneId, buildKey, presenceKey }) {
    const z = ZONES.find(x => x.id === zoneId) || ZONES[2];
    const b = BUILD.find(x => x.key === buildKey) || BUILD[2];
    const p = PRESENCE.find(x => x.key === presenceKey) || PRESENCE[1];

    // Warmtevraag (indicatief): kWh ≈ m² * HDD * heatFactor * presenceFactor
    // heatFactor is een empirische schaal om “realistische orde van grootte” te geven.
    return m2 * z.hdd * b.heatFactor * p.factor;
  }

  function heatingInputAndCost({ heatKey, heatKwh, prices }) {
    const h = HEAT.find(x => x.key === heatKey) || HEAT[0];
    const unit = h.energy;
    const price = prices[unit];
    const kwhPerUnit = KWH_PER_UNIT[unit];

    // Input energie in kWh-equivalent (brandstofenergie of elektra)
    let inputKwh;
    if (h.key === "hp") inputKwh = heatKwh / (h.scop || 3.2);
    else if (h.key === "elec") inputKwh = heatKwh;
    else inputKwh = heatKwh / (h.eta || 0.90);

    // Omrekenen naar “eenheden” voor prijs (m³/L/kg/stère)
    const units = inputKwh / kwhPerUnit;
    const cost = units * price;

    return { inputKwh, units, unit, cost };
  }

  function biggestImprovement({ base, scenario }) {
    // base/scenario hebben totalCost, heatCost, elecCost
    const delta = base.totalCost - scenario.totalCost;
    const heatDelta = base.heatCost - scenario.heatCost;
    const elecDelta = base.elecCost - scenario.elecCost;

    const candidates = [
      { key: "insul", label: "Isolatiepakket (dak/muren/ramen)", delta: heatDelta * 0.45 }, // proxy
      { key: "hp", label: "Warmtepomp i.p.v. direct elektrisch / oude ketel", delta: heatDelta * 0.35 }, // proxy
      { key: "pv", label: "Zonnepanelen (klein systeem)", delta: elecDelta * 0.25 }, // proxy
    ].sort((a, b) => b.delta - a.delta);

    const best = candidates[0];
    if (!best || best.delta < 60) {
      return { label: "Eerst: verfijn de basisgegevens (m², bouwperiode, verwarming)", saving: 0 };
    }
    return { label: best.label, saving: best.delta };
  }

  // Scenario-presets (wow toggle): we veranderen alleen parameters
  function applyScenarioPreset(state, presetKey) {
    // We blijven in MVP bewust “sober”: één knop -> duidelijke sprong
    // In latere versie: meerdere scenario’s + investeringskosten.
    const s = { ...state };

    if (presetKey === "comfort") {
      // “Comfort & zuinig”: betere warmtefactor + aanwezigheid iets hoger (thuis meer)
      s.buildKey = s.buildKey; // bouwperiode blijft; we nemen isolatie-effect via factor later
      s.sliderKwh = clamp(s.sliderKwh - 400, SLIDER.min, SLIDER.max);
      s.heatKey = "hp";
    }

    if (presetKey === "renov") {
      // “Renovatiepad”: reduceer warmtevraag door ‘virtual’ isolatie: we simuleren met virtuele bouwklasse + lagere warmtefactor
      // We mappen naar 1 stap nieuwer (tot max) als proxy voor isolatieverbetering.
      const idx = BUILD.findIndex(x => x.key === s.buildKey);
      const newIdx = clamp(idx + 1, 0, BUILD.length - 1);
      s.buildKey = BUILD[newIdx].key;
      s.sliderKwh = clamp(s.sliderKwh - 300, SLIDER.min, SLIDER.max);
    }

    if (presetKey === "pv") {
      // “PV-effect”: reduceer netto elektra (proxy) door 1200 kWh/jaar
      s.sliderKwh = clamp(s.sliderKwh - 1200, SLIDER.min, SLIDER.max);
    }

    return s;
  }

  // -----------------------------
  // Components
  // -----------------------------
  function App() {
    // Step 1: context
    const [addressQuery, setAddressQuery] = useState("");
    const [banBusy, setBanBusy] = useState(false);
    const [banErr, setBanErr] = useState("");
    const [banHits, setBanHits] = useState([]);
    const [selectedAddr, setSelectedAddr] = useState(null);

    const [zoneId, setZoneId] = useState("paris"); // fallback
    const [cp, setCp] = useState("");

    // Step 2: quick inputs
    const [m2, setM2] = useState(120);
    const [buildKey, setBuildKey] = useState("1975_1990");
    const [presenceKey, setPresenceKey] = useState("mid");
    const [sliderKwh, setSliderKwh] = useState(4200);
    const [heatKey, setHeatKey] = useState("hp");

    // Prices (later editable; MVP fixed but in state)
    const [prices] = useState({ ...PRICE });

    // Wow toggle: scenario compare
    const [scenarioOn, setScenarioOn] = useState(false);
    const [scenarioPreset, setScenarioPreset] = useState("renov");

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
          setBanErr("Adreszoeker tijdelijk niet beschikbaar. Kies dan een regio hieronder.");
        }
      }, 250);

      return () => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
      };
    }, [addressQuery]);

    function onPickAddress(f) {
      const props = f?.properties || {};
      const label = props.label || "";
      const postcode = props.postcode || "";
      setSelectedAddr({ label, postcode });
      setBanHits([]);
      setAddressQuery(label);
      setCp(postcode || "");
      const guessed = postcode ? pickZoneByPostal(postcode) : null;
      if (guessed) setZoneId(guessed);
      // Als geen guess: laat gebruiker zone kiezen; we tonen zone dropdown altijd, maar nu “ingevuld”
    }

    const contextReady = useMemo(() => {
      return !!zoneId && Number.isFinite(m2) && m2 > 10;
    }, [zoneId, m2]);

    const baseState = useMemo(() => ({
      zoneId,
      m2: clamp(Number(m2) || 0, 20, 600),
      buildKey,
      presenceKey,
      sliderKwh: clamp(Number(sliderKwh) || SLIDER.min, SLIDER.min, SLIDER.max),
      heatKey
    }), [zoneId, m2, buildKey, presenceKey, sliderKwh, heatKey]);

    const scenarioState = useMemo(() => {
      if (!scenarioOn) return null;
      return applyScenarioPreset(baseState, scenarioPreset);
    }, [scenarioOn, scenarioPreset, baseState]);

    const baseResults = useMemo(() => {
      const heatKwh = computeHeatKwh(baseState);
      const h = heatingInputAndCost({ heatKey: baseState.heatKey, heatKwh, prices });

      // MVP: totale elektra = sliderKwh (apparaten/tapwater/overig) + (warmtepomp/direct) deel als elec
      let elecKwh = baseState.sliderKwh;
      if (baseState.heatKey === "hp" || baseState.heatKey === "elec") {
        elecKwh += h.inputKwh;
      }

      // Elektra kosten
      const elecCost = elecKwh * prices.elec;

      // Warmtekosten:
      // - bij elec/hp zit warmte al in elecCost, dus heatCost tonen als “0” en elders tonen we warmte input kWh
      // - bij brandstoffen is heatCost apart
      const heatCost = (baseState.heatKey === "hp" || baseState.heatKey === "elec") ? 0 : h.cost;

      const totalCost = (baseState.heatKey === "hp" || baseState.heatKey === "elec")
        ? elecCost
        : elecCost + heatCost;

      return {
        heatKwh,
        heatInputKwh: h.inputKwh,
        elecKwh,
        elecCost,
        heatCost,
        totalCost,
        perMonth: totalCost / 12
      };
    }, [baseState, prices]);

    const scenarioResults = useMemo(() => {
      if (!scenarioState) return null;

      const heatKwh = computeHeatKwh(scenarioState);
      const h = heatingInputAndCost({ heatKey: scenarioState.heatKey, heatKwh, prices });

      let elecKwh = scenarioState.sliderKwh;
      if (scenarioState.heatKey === "hp" || scenarioState.heatKey === "elec") {
        elecKwh += h.inputKwh;
      }

      const elecCost = elecKwh * prices.elec;
      const heatCost = (scenarioState.heatKey === "hp" || scenarioState.heatKey === "elec") ? 0 : h.cost;
      const totalCost = (scenarioState.heatKey === "hp" || scenarioState.heatKey === "elec")
        ? elecCost
        : elecCost + heatCost;

      return {
        heatKwh,
        heatInputKwh: h.inputKwh,
        elecKwh,
        elecCost,
        heatCost,
        totalCost,
        perMonth: totalCost / 12
      };
    }, [scenarioState, prices]);

    const improvement = useMemo(() => {
      if (!scenarioOn || !scenarioResults) {
        // “Grootste verbeterknop” op basis van simpele heuristiek
        // We maken een virtueel scenario: 1 stap betere bouwklasse + hp als grootste driver
        const virt = applyScenarioPreset(baseState, "renov");
        const heatKwh = computeHeatKwh(virt);
        const h = heatingInputAndCost({ heatKey: virt.heatKey, heatKwh, prices });

        let elecKwh = virt.sliderKwh;
        if (virt.heatKey === "hp" || virt.heatKey === "elec") elecKwh += h.inputKwh;
        const elecCost = elecKwh * prices.elec;
        const heatCost = (virt.heatKey === "hp" || virt.heatKey === "elec") ? 0 : h.cost;
        const totalCost = (virt.heatKey === "hp" || virt.heatKey === "elec") ? elecCost : elecCost + heatCost;

        const virtRes = { totalCost, heatCost, elecCost };
        const baseResMini = { totalCost: baseResults.totalCost, heatCost: baseResults.heatCost, elecCost: baseResults.elecCost };
        return biggestImprovement({ base: baseResMini, scenario: virtRes });
      }

      const baseResMini = { totalCost: baseResults.totalCost, heatCost: baseResults.heatCost, elecCost: baseResults.elecCost };
      const scResMini = { totalCost: scenarioResults.totalCost, heatCost: scenarioResults.heatCost, elecCost: scenarioResults.elecCost };
      return biggestImprovement({ base: baseResMini, scenario: scResMini });
    }, [scenarioOn, scenarioResults, baseResults, baseState, prices]);

    // UI
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
            React.createElement("div", { className: "brandTitle" }, "Energiekompas Frankrijk"),
            React.createElement("span", { className: "pill" }, "MVP – Snel & overzichtelijk")
          ),
          React.createElement(
            "div",
            { className: "pill" },
            contextReady ? "Context: OK" : "Start met adres of regio"
          )
        )
      ),

      React.createElement(
        "div",
        { className: "wrap" },
        React.createElement("h1", null, "Energiekompas Frankrijk"),
        React.createElement(
          "div",
          { className: "kicker" },
          "Eerst context (adres/regio), daarna pas rekenen. Geen overweldiging: alleen de kern."
        ),

        React.createElement(
          "div",
          { className: "grid", style: { marginTop: 16 } },

          // Left: inputs
          React.createElement(
            "div",
            { className: "card" },
            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "1) Context: adres of regio"),
              React.createElement("span", { className: "badge badgeMuted" }, "Stap 1")
            ),

            // Address search
            React.createElement(
              "div",
              { className: "field" },
              React.createElement("label", null, "Adres (BAN)"),
              React.createElement("input", {
                className: "input",
                value: addressQuery,
                onChange: (e) => {
                  setAddressQuery(e.target.value || "");
                  setSelectedAddr(null);
                  setCp("");
                },
                placeholder: "Bijv. 12 rue de ... , 75008 Paris",
                "aria-label": "Adres zoeken"
              }),
              React.createElement(
                "div",
                { className: "help" },
                "Tip: als u geen exact adres weet, kies hieronder direct een klimaatzone."
              )
            ),

            banErr ? React.createElement("div", { className: "note", style: { color: "#b00020", fontWeight: 800 } }, banErr) : null,

            banBusy ? React.createElement("div", { className: "note" }, "Zoeken…") : null,

            (banHits && banHits.length > 0) ? React.createElement(
              "div",
              { className: "suggestions" },
              banHits.map((f, idx) => {
                const p = f.properties || {};
                return React.createElement(
                  "div",
                  { key: idx, className: "sugItem", onClick: () => onPickAddress(f) },
                  React.createElement("div", { className: "sugMain" }, p.label || "Onbekend adres"),
                  React.createElement("div", { className: "sugSub" }, `Postcode: ${p.postcode || "—"} · Gemeente: ${p.city || "—"}`)
                );
              })
            ) : null,

            React.createElement(
              "div",
              { className: "row row2" },
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Postcode (auto bij adres)"),
                React.createElement("input", {
                  className: "input",
                  value: cp,
                  onChange: (e) => setCp((e.target.value || "").replace(/\D/g, "").slice(0, 5)),
                  placeholder: "75008",
                  "aria-label": "Postcode"
                }),
                React.createElement("div", { className: "help" }, "Wordt gebruikt voor benchmark (later) en DPE-context (later).")
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Klimaatzone"),
                React.createElement(
                  "select",
                  { value: zoneId, onChange: (e) => setZoneId(e.target.value) },
                  ZONES.map(z => React.createElement("option", { key: z.id, value: z.id }, z.name))
                ),
                React.createElement("div", { className: "help" }, "Altijd zichtbaar: u weet meteen in welke klimaatzone u rekent.")
              )
            ),

            React.createElement("div", { className: "hr" }),

            // Quick inputs
            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "2) Snelle invoer (geen details)"),
              React.createElement("span", { className: "badge badgeMuted" }, "Stap 2")
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
                React.createElement("div", { className: "help" }, "Alleen m². Volume en U-waardes komen later in Expert.")
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Bouwperiode"),
                React.createElement(
                  "select",
                  { value: buildKey, onChange: (e) => setBuildKey(e.target.value) },
                  BUILD.map(b => React.createElement("option", { key: b.key, value: b.key }, b.label))
                ),
                React.createElement("div", { className: "help" }, "Bepaalt de startinschatting van warmteverlies (indicatief).")
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Aanwezigheid"),
                React.createElement(
                  "select",
                  { value: presenceKey, onChange: (e) => setPresenceKey(e.target.value) },
                  PRESENCE.map(p => React.createElement("option", { key: p.key, value: p.key }, p.label))
                ),
                React.createElement("div", { className: "help" }, "Geen dagen/jaar. Alleen een begrijpelijk profiel.")
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
                ),
                React.createElement("div", { className: "help" }, "In MVP rekenen we met redelijke standaard-SCOP/η (later verfijnbaar).")
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
                React.createElement("div", { className: "help" }, "Dit vervangt alle losse apparatenposten. Later kunt u verfijnen.")
              )
            ),

            React.createElement("div", { className: "hr" }),

            // Scenario toggle
            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "3) Wow: scenario-sprong"),
              React.createElement("span", { className: "badge badgeMuted" }, "Optioneel")
            ),
            React.createElement(
              "div",
              { className: "row row2" },
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Scenario vergelijken"),
                React.createElement(
                  "div",
                  { className: "btnRow" },
                  React.createElement("button", {
                    className: "btn " + (scenarioOn ? "btnSoft" : ""),
                    onClick: () => setScenarioOn(!scenarioOn)
                  }, scenarioOn ? "Scenario: AAN" : "Scenario: UIT"),
                  React.createElement("button", {
                    className: "btn btnGhost",
                    onClick: () => {
                      setScenarioOn(true);
                      setScenarioPreset("renov");
                    }
                  }, "Renovatiepad"),
                  React.createElement("button", {
                    className: "btn btnGhost",
                    onClick: () => {
                      setScenarioOn(true);
                      setScenarioPreset("pv");
                    }
                  }, "PV-sprong"),
                  React.createElement("button", {
                    className: "btn btnGhost",
                    onClick: () => {
                      setScenarioOn(true);
                      setScenarioPreset("comfort");
                    }
                  }, "Comfort & zuinig")
                ),
                React.createElement(
                  "div",
                  { className: "help" },
                  "Dit is bewust simpel: één klik → zichtbaar effect. Later maken we investeringen en kosten expliciet."
                )
              ),
              React.createElement(
                "div",
                { className: "field" },
                React.createElement("label", null, "Let op"),
                React.createElement(
                  "div",
                  { className: "note" },
                  "MVP-resultaten zijn indicatief: gericht op oriëntatie (koper/eigenaar). Geen officieel DPE of audit."
                )
              )
            )
          ),

          // Right: Results
          React.createElement(
            "div",
            { className: "cardWhite" },
            React.createElement(
              "div",
              { className: "sectionTitle" },
              React.createElement("h2", null, "Resultaat"),
              React.createElement("span", { className: "badge" }, "Kosten + beste stap")
            ),

            React.createElement(
              "div",
              { className: "resultBig" },
              React.createElement(
                "div",
                null,
                React.createElement("div", { className: "money" }, moneyEUR(baseResults.totalCost)),
                React.createElement("div", { className: "subMoney" }, `${moneyEUR(baseResults.perMonth)} / maand`)
              ),
              React.createElement(
                "div",
                { className: "badge" },
                React.createElement("span", { style: { color: BRAND, fontWeight: 900 } }, "Grootste stap:"),
                React.createElement("span", null, improvement.label),
                improvement.saving > 0 ? React.createElement("span", { style: { color: BRAND } }, `~${moneyEUR(improvement.saving)}/jr`) : null
              )
            ),

            React.createElement("div", { className: "hr" }),

            React.createElement(
              "div",
              { className: "scenarioGrid" },

              React.createElement(
                "div",
                { className: "scBox" },
                React.createElement("div", { className: "scTitle" }, "Baseline"),
                React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Warmtevraag"), React.createElement("span", null, `${round(baseResults.heatKwh)} kWh/jr`)),
                React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Warmte input"), React.createElement("span", null, `${round(baseResults.heatInputKwh)} kWh eq.`)),
                React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Elektra totaal"), React.createElement("span", null, `${round(baseResults.elecKwh)} kWh/jr`)),
                React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Totale kosten"), React.createElement("span", null, moneyEUR(baseResults.totalCost)))
              ),

              React.createElement(
                "div",
                { className: "scBox" },
                React.createElement("div", { className: "scTitle" }, scenarioOn && scenarioResults ? "Scenario" : "Scenario (uit)"),
                scenarioOn && scenarioResults
                  ? React.createElement(
                    React.Fragment,
                    null,
                    React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Warmtevraag"), React.createElement("span", null, `${round(scenarioResults.heatKwh)} kWh/jr`)),
                    React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Warmte input"), React.createElement("span", null, `${round(scenarioResults.heatInputKwh)} kWh eq.`)),
                    React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Elektra totaal"), React.createElement("span", null, `${round(scenarioResults.elecKwh)} kWh/jr`)),
                    React.createElement("div", { className: "scLine" }, React.createElement("span", null, "Totale kosten"), React.createElement("span", null, moneyEUR(scenarioResults.totalCost))),
                    React.createElement("div", { className: "hr" }),
                    React.createElement(
                      "div",
                      { className: "badge" },
                      React.createElement("span", { style: { color: BRAND, fontWeight: 900 } }, "Verschil:"),
                      React.createElement("span", null, moneyEUR(baseResults.totalCost - scenarioResults.totalCost)),
                      React.createElement("span", { className: "badgeMuted" }, "per jaar")
                    )
                  )
                  : React.createElement(
                    "div",
                    { className: "note" },
                    "Zet scenario aan om het ‘wow-effect’ te krijgen (sprong in kosten en verbruik)."
                  )
              )
            ),

            React.createElement("div", { className: "hr" }),

            React.createElement(
              "div",
              null,
              React.createElement("h2", null, "DPE (later)"),
              React.createElement(
                "div",
                { className: "note" },
                "U kiest nu eerst context (adres/regio). In de volgende iteratie koppelen we: (1) DPE-context per postcode (benchmark) en (2) een ‘prévisionnel’ bandbreedte op basis van uw model. Dit blijft indicatief en wordt duidelijk zo gelabeld."
              )
            )
          )
        ),

        React.createElement(
          "div",
          { style: { marginTop: 14 } },
          React.createElement(
            "small",
            null,
            "Bron adreszoeker: Base Adresse Nationale (BAN). De berekening is een oriëntatiemodel (koper/eigenaar) en vervangt geen officieel DPE of audit."
          )
        )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App));
})();
