/**
 * Today App — Bugünün Gökyüzü UI
 * NUT-016.4 — canlı yerel saat + an haritası
 *
 * Ana yüzeyde ASC ile Güneş, Ay, Merkür, Venüs ve Mars'ı gösterir.
 * Jüpiter–Plüton ayrıntılı an haritasında kalır. Astrolojik yorum üretmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID = "today:sky:today-ui:nut-016.4";
  const PANEL_ID = "skyTodayPanel";
  const DIAL_LANE_SEPARATION = Object.freeze([
    13,
    15,
    18,
    23
  ]);

  let initialized = false;
  let openState = false;
  let panel = null;
  let content = null;
  let title = null;
  let skyView = null;
  let contextApi = null;
  let profileApi = null;
  let placeApi = null;
  let momentCore = null;
  let onRequestHub = null;
  let timer = null;
  let lastMinuteKey = null;
  let placeCandidates = new Map();
  let requestToken = 0;

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.text !== undefined) {
      element.textContent = String(options.text);
    }
    if (options.type) element.type = options.type;
    Object.entries(options.attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });
    return element;
  }

  function installStyles() {
    if (document.getElementById("todaySkyTodayStyles")) return;
    const style = document.createElement("style");
    style.id = "todaySkyTodayStyles";
    style.textContent = `
      .skyTodayPanel {
        width: 100%; min-width: 0; max-width: 100%;
        display: grid; gap: 14px; padding-top: 2px;
      }
      .skyTodayPanel[hidden] { display: none !important; }
      .skyTodayHeader { padding: 4px 4px 2px; text-align: center; }
      .skyTodayMark {
        width: 54px; height: 54px; display: grid; place-items: center;
        margin: 0 auto 11px; border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke));
        border-radius: 18px; background: color-mix(in srgb, var(--sky-accent) 13%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text)); font-size: 29px;
      }
      .skyTodayHeader h2 { margin: 0; font-size: 23px; line-height: 1.2; letter-spacing: -.02em; }
      .skyTodayHeader p { max-width: 38ch; margin: 7px auto 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .skyTodayContent { min-width: 0; display: grid; gap: 12px; }
      .skyTodayCard, .skyTodayDisclosure {
        min-width: 0; border: 1px solid var(--stroke); border-radius: 20px;
        background: rgba(255,255,255,.035);
      }
      .skyTodayCard { padding: 16px; }
      .skyTodayAccent {
        border-color: color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        background: linear-gradient(145deg, color-mix(in srgb, var(--sky-accent) 16%, transparent), rgba(255,255,255,.035));
      }
      .skyTodayCard h3, .skyTodaySectionTitle { margin: 0; font-size: 16px; line-height: 1.25; }
      .skyTodayCard p, .skyTodayMuted { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
      .skyTodayDial {
        position: relative; width: min(100%, 310px); aspect-ratio: 1;
        margin: 14px auto 4px; border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke));
        border-radius: 50%; background:
          radial-gradient(circle at center, color-mix(in srgb, var(--sky-accent) 13%, transparent) 0 30%, transparent 31% 55%, rgba(255,255,255,.035) 56% 72%, transparent 73%),
          repeating-conic-gradient(from -1deg, color-mix(in srgb, var(--sky-accent) 30%, transparent) 0 1deg, transparent 1deg 30deg);
        overflow: hidden;
      }
      .skyTodayDial::after {
        content: ""; position: absolute; inset: 17%; border: 1px solid color-mix(in srgb, var(--sky-accent) 24%, var(--stroke)); border-radius: 50%; pointer-events: none;
      }
      .skyTodayZodiac, .skyTodayMarker {
        position: absolute; left: 50%; top: 50%; display: grid; place-items: center; transform:
          rotate(var(--angle)) translateY(var(--radius)) rotate(var(--counter-angle));
      }
      .skyTodayZodiac {
        --radius: -136px; width: 28px; height: 28px; margin: -14px;
        color: var(--muted); font-size: 15px;
      }
      .skyTodayMarker {
        --radius: -98px; z-index: 2; width: 20px; height: 20px; margin: -10px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 48%, var(--stroke));
        border-radius: 50%; background: color-mix(in srgb, var(--bg0) 92%, var(--sky-accent));
        color: var(--text); font-size: 13px; font-weight: 900; box-shadow: 0 3px 10px rgba(0,0,0,.22);
      }
      .skyTodayMarker[data-dial-lane="0"] { --radius: -116px; }
      .skyTodayMarker[data-dial-lane="1"] { --radius: -98px; }
      .skyTodayMarker[data-dial-lane="2"] { --radius: -80px; }
      .skyTodayMarker[data-dial-lane="3"] { --radius: -62px; }
      .skyTodayMarker[data-marker="ascendant"] { color: #ffcf77; font-size: 8px; letter-spacing: -.04em; }
      .skyTodayClock {
        position: absolute; z-index: 3; inset: 34%; display: flex; flex-direction: column;
        align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, var(--sky-accent) 30%, var(--stroke));
        border-radius: 50%; background: color-mix(in srgb, var(--bg0) 90%, transparent); text-align: center;
      }
      .skyTodayClockTime { font-size: clamp(18px, 6.4vw, 28px); font-weight: 900; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
      .skyTodayClockDate { margin-top: 3px; color: var(--muted); font-size: 9px; }
      .skyTodayPlaceLine { margin-top: 11px !important; text-align: center; overflow-wrap: anywhere; }
      .skyTodayLegend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 10px; }
      .skyTodayBadge {
        display: inline-flex; align-items: center; min-height: 26px; border: 1px solid color-mix(in srgb, var(--sky-accent) 34%, var(--stroke));
        border-radius: 999px; padding: 5px 8px; color: color-mix(in srgb, var(--sky-accent) 72%, var(--text)); font-size: 10px; font-weight: 800;
      }
      .skyTodayRows { display: grid; margin-top: 10px; }
      .skyTodayRow { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 10px 1px; border-top: 1px solid color-mix(in srgb, var(--stroke) 75%, transparent); }
      .skyTodayRow:first-child { border-top: 0; }
      .skyTodayRow strong { min-width: 0; font-size: 12px; overflow-wrap: anywhere; }
      .skyTodayRow span { color: var(--muted); font-size: 11px; text-align: right; }
      .skyTodayDisclosure { overflow: hidden; }
      .skyTodayDisclosure summary { padding: 15px 16px; cursor: pointer; font-size: 14px; font-weight: 850; }
      .skyTodayDisclosureBody { padding: 0 16px 16px; }
      .skyTodayForm { display: grid; gap: 9px; margin-top: 12px; }
      .skyTodayFormRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
      .skyTodayInput { min-width: 0; border: 1px solid var(--stroke); border-radius: 14px; padding: 11px 12px; background: rgba(255,255,255,.03); color: var(--text); font: inherit; font-size: 13px; }
      .skyTodayButton { border: 1px solid color-mix(in srgb, var(--sky-accent) 38%, var(--stroke)); border-radius: 14px; padding: 10px 13px; background: color-mix(in srgb, var(--sky-accent) 14%, transparent); color: var(--text); font: inherit; font-size: 12px; font-weight: 850; cursor: pointer; }
      .skyTodayButtonSecondary { background: transparent; }
      .skyTodayCandidates { display: grid; gap: 7px; margin-top: 9px; }
      .skyTodayCandidate { width: 100%; display: grid; gap: 3px; border: 1px solid var(--stroke); border-radius: 14px; padding: 10px 11px; background: rgba(255,255,255,.025); color: var(--text); text-align: left; cursor: pointer; }
      .skyTodayCandidate strong { font-size: 12px; }
      .skyTodayCandidate span { color: var(--muted); font-size: 10px; }
      .skyTodayFeedback { min-height: 17px; margin: 8px 1px 0; color: var(--muted); font-size: 11px; line-height: 1.4; }
      .skyTodayActions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      @media (max-width: 390px) {
        .skyTodayZodiac { --radius: -116px; }
        .skyTodayMarker[data-dial-lane="0"] { --radius: -104px; }
        .skyTodayMarker[data-dial-lane="1"] { --radius: -88px; }
        .skyTodayMarker[data-dial-lane="2"] { --radius: -72px; }
        .skyTodayMarker[data-dial-lane="3"] { --radius: -56px; }
        .skyTodayFormRow { grid-template-columns: minmax(0, 1fr); }
      }
      @media (prefers-reduced-motion: reduce) {
        .skyTodayMarker { transition: none !important; }
      }
    `;
    document.head.append(style);
  }

  function buildPanel() {
    const root = createElement("section", {
      className: "skyTodayPanel",
      id: PANEL_ID,
      attributes: { hidden: "", "aria-labelledby": "skyTodayTitle" }
    });
    const header = createElement("header", { className: "skyTodayHeader" });
    header.append(
      createElement("div", { className: "skyTodayMark", text: "✦", attributes: { "aria-hidden": "true" } }),
      createElement("h2", { id: "skyTodayTitle", text: "Bugünün Gökyüzü", attributes: { tabindex: "-1" } }),
      createElement("p", { text: "Yerel saat ve o ana ait gökyüzü, tek sade görünümde." })
    );
    content = createElement("div", { className: "skyTodayContent", id: "skyTodayContent", attributes: { "aria-live": "polite" } });
    root.append(header, content);
    title = header.querySelector("h2");
    return root;
  }

  function formatPlacement(placement) {
    if (!placement) return "Kullanılamıyor";
    return `${placement.signSymbol} ${placement.sign} ${momentCore.formatDegree(placement.degreeInSign)}`;
  }

  function circularDistance(left, right) {
    const difference = Math.abs(left - right) % 360;
    return difference > 180 ? 360 - difference : difference;
  }

  function assignDialLanes(markers) {
    const assigned = [];
    markers.forEach(marker => {
      const laneOrder = marker.id === "ascendant"
        ? [0, 1, 2, 3]
        : [1, 2, 0, 3];
      const laneScores = laneOrder.map(lane => {
        const sameLane = assigned.filter(item => item.lane === lane);
        const minimumDistance = sameLane.length
          ? Math.min(...sameLane.map(item => circularDistance(item.longitude, marker.longitude)))
          : Infinity;
        return { lane, minimumDistance };
      });
      const available = laneScores.find(item =>
        item.minimumDistance >= DIAL_LANE_SEPARATION[item.lane]
      );
      const selected = available || laneScores.reduce((best, current) =>
        current.minimumDistance > best.minimumDistance ? current : best
      );
      assigned.push({
        id: marker.id,
        longitude: marker.longitude,
        lane: selected.lane
      });
    });
    return new Map(assigned.map(item => [item.id, item.lane]));
  }

  function buildLocationPicker(options = {}) {
    const card = createElement(options.disclosure ? "div" : "article", {
      className: options.disclosure ? "skyTodayDisclosureBody" : "skyTodayCard"
    });
    if (!options.disclosure) {
      card.append(
        createElement("h3", { text: "Takip konumunu seç" }),
        createElement("p", { text: "Yükselen ve evler bulunduğun konuma göre değişir. Konum izni istenmez; şehir seçimini sen yaparsın." })
      );
    }

    const profile = profileApi.getProfile();
    const birthPlaceReady = profileApi.inspectPlaceResolution(profile).valid;
    if (birthPlaceReady) {
      const birthButton = createElement("button", {
        className: "skyTodayButton skyTodayButtonSecondary",
        text: `Doğum yerini kullan · ${profile.birthPlace.label}`,
        type: "button",
        attributes: { "data-sky-today-action": "use-birth-place" }
      });
      card.append(birthButton);
    }

    const form = createElement("form", { className: "skyTodayForm", id: "skyTodayPlaceForm" });
    const row = createElement("div", { className: "skyTodayFormRow" });
    row.append(
      createElement("input", {
        className: "skyTodayInput", id: "skyTodayPlaceQuery",
        attributes: { type: "search", autocomplete: "off", placeholder: "Şehir ara", "aria-label": "Takip şehri" }
      }),
      createElement("button", { className: "skyTodayButton", text: "Ara", type: "submit" })
    );
    form.append(row);
    card.append(
      form,
      createElement("div", { className: "skyTodayCandidates", id: "skyTodayCandidates" }),
      createElement("p", { className: "skyTodayFeedback", id: "skyTodayPlaceFeedback", text: "Şehir dizini cihaz içinde aranır." })
    );
    return card;
  }

  function renderMissingContext() {
    content.replaceChildren();
    const intro = createElement("article", { className: "skyTodayCard skyTodayAccent" });
    intro.append(
      createElement("h3", { text: "Canlı gökyüzü için konum gerekli" }),
      createElement("p", { text: "Gezegenler aynı anda dünya genelinde aynı derecelerdedir; yükselen ve evler ise takip konumuna göre hesaplanır." })
    );
    content.append(intro, buildLocationPicker());
  }

  function makeDial(result) {
    const dial = createElement("div", { className: "skyTodayDial", attributes: { role: "img", "aria-label": "Yerel saat, yükselen ve kişisel gezegenlerin canlı kadranı" } });
    window.TodaySkyCalculationCore.ZODIAC_SIGNS.forEach((sign, index) => {
      const marker = createElement("span", { className: "skyTodayZodiac", text: sign.symbol, attributes: { title: sign.label, "aria-hidden": "true" } });
      marker.style.setProperty("--angle", `${index * 30}deg`);
      marker.style.setProperty("--counter-angle", `${index * -30}deg`);
      dial.append(marker);
    });

    const dialLanes = assignDialLanes(result.dial.markers);
    result.dial.markers.forEach(item => {
      const marker = createElement("span", {
        className: "skyTodayMarker",
        text: item.id === "ascendant" ? "ASC" : item.symbol,
        attributes: {
          "data-marker": item.id,
          "data-dial-lane": dialLanes.get(item.id),
          title: `${item.label}: ${formatPlacement(item)}`,
          "aria-label": `${item.label}, ${formatPlacement(item)}`
        }
      });
      marker.style.setProperty("--angle", `${item.longitude}deg`);
      marker.style.setProperty("--counter-angle", `${item.longitude * -1}deg`);
      dial.append(marker);
    });

    const clock = createElement("div", { className: "skyTodayClock" });
    clock.append(
      createElement("span", { className: "skyTodayClockTime", id: "skyTodayClockTime", text: result.clock.time }),
      createElement("span", { className: "skyTodayClockDate", id: "skyTodayClockDate", text: result.clock.date })
    );
    dial.append(clock);
    return dial;
  }

  function buildPrimaryRows(result) {
    const card = createElement("article", { className: "skyTodayCard" });
    card.append(
      createElement("h3", { text: "Kadrandaki göstergeler" }),
      createElement("p", { text: "Ana yüz yalnız yükseleni ve hızlı/kişisel göstergeleri taşır." })
    );
    const rows = createElement("div", { className: "skyTodayRows" });
    const indicators = [
      { label: "Yükselen", symbol: "ASC", placement: result.angles.ascendant },
      ...result.primaryPlacements.map(placement => ({ label: placement.label, symbol: placement.symbol, placement }))
    ];
    indicators.forEach(item => {
      const row = createElement("div", { className: "skyTodayRow" });
      row.append(
        createElement("strong", { text: `${item.symbol} ${item.label}` }),
        createElement("span", { text: formatPlacement(item.placement) })
      );
      rows.append(row);
    });
    card.append(rows);
    return card;
  }

  function buildFullChart(result) {
    const details = createElement("details", { className: "skyTodayDisclosure", attributes: { "data-sky-today-detail": "full-chart" } });
    details.append(createElement("summary", { text: "Tam an haritası" }));
    const body = createElement("div", { className: "skyTodayDisclosureBody" });
    body.append(createElement("p", { className: "skyTodayMuted", text: "Ağır ve jenerasyon gezegenleri ana kadranı kalabalıklaştırmaz; burada eksiksiz görünür." }));
    const rows = createElement("div", { className: "skyTodayRows" });
    result.planets.forEach(planet => {
      const row = createElement("div", { className: "skyTodayRow" });
      row.append(
        createElement("strong", { text: `${planet.symbol} ${planet.label}` }),
        createElement("span", { text: `${formatPlacement(planet)}${planet.house ? ` · ${planet.house}. ev` : ""}` })
      );
      rows.append(row);
    });
    body.append(rows);
    if (result.angles.midheaven) {
      const angles = createElement("p", { className: "skyTodayMuted", text: `ASC ${formatPlacement(result.angles.ascendant)} · MC ${formatPlacement(result.angles.midheaven)}` });
      body.append(angles);
    }
    if (result.aspects.length) {
      const aspectTitle = createElement("h3", { className: "skyTodaySectionTitle", text: "En yakın temel açılar" });
      aspectTitle.style.marginTop = "16px";
      const aspectRows = createElement("div", { className: "skyTodayRows" });
      result.aspects.forEach(aspect => {
        const row = createElement("div", { className: "skyTodayRow" });
        row.append(
          createElement("strong", { text: `${aspect.left.symbol} ${aspect.left.label} — ${aspect.right.symbol} ${aspect.right.label}` }),
          createElement("span", { text: `${aspect.label} · ${momentCore.formatDegree(aspect.orb)}` })
        );
        aspectRows.append(row);
      });
      body.append(aspectTitle, aspectRows);
    }
    details.append(body);
    return details;
  }

  function buildNatalTransits(result) {
    const card = createElement("article", { className: "skyTodayCard" });
    card.append(
      createElement("h3", { text: "Haritana göre" }),
      createElement("p", { text: "Güncel gökyüzü ile doğum haritan arasındaki en yakın beş temel açı. Yorum veya nedensellik iddiası içermez." })
    );
    if (result.natal.status !== "ready") {
      card.append(createElement("p", { className: "skyTodayMuted", text: "Bu görünüm için kesin saatli ve hesaplanabilir doğum haritası gerekir." }));
      return card;
    }
    if (!result.natal.transits.length) {
      card.append(createElement("p", { className: "skyTodayMuted", text: "Tanımlı orb sınırlarında temel açı bulunmuyor." }));
      return card;
    }
    const rows = createElement("div", { className: "skyTodayRows" });
    result.natal.transits.forEach(transit => {
      const row = createElement("div", { className: "skyTodayRow", attributes: { "data-sky-natal-transit": transit.id } });
      row.append(
        createElement("strong", { text: `${transit.current.symbol} ${transit.current.label} — natal ${transit.natal.symbol} ${transit.natal.label}` }),
        createElement("span", { text: `${transit.label} · ${momentCore.formatDegree(transit.orb)}` })
      );
      rows.append(row);
    });
    card.append(rows);
    return card;
  }

  function renderLive(result) {
    content.replaceChildren();
    const liveCard = createElement("article", { className: "skyTodayCard skyTodayAccent" });
    liveCard.append(
      createElement("h3", { text: "Şu an" }),
      createElement("p", { text: "Normal yerel saat ile gökyüzü aynı anı gösterir." }),
      makeDial(result),
      createElement("p", { className: "skyTodayMuted skyTodayPlaceLine", text: `${result.location.label} · ${result.clock.timezoneId} · UTC${result.clock.utcOffset}` })
    );
    const legend = createElement("div", { className: "skyTodayLegend", attributes: { "aria-label": "Kadran kapsamı" } });
    ["ASC", "☉", "☽", "☿", "♀", "♂"].forEach(label => legend.append(createElement("span", { className: "skyTodayBadge", text: label })));
    liveCard.append(legend);

    const locationDetails = createElement("details", { className: "skyTodayDisclosure" });
    locationDetails.append(createElement("summary", { text: "Takip konumunu değiştir" }), buildLocationPicker({ disclosure: true }));
    content.append(
      liveCard,
      buildPrimaryRows(result),
      buildNatalTransits(result),
      buildFullChart(result),
      locationDetails
    );
  }

  function renderError(message) {
    content.replaceChildren();
    const card = createElement("article", { className: "skyTodayCard" });
    card.append(
      createElement("h3", { text: "Canlı gökyüzü açılamadı" }),
      createElement("p", { text: message || "Beklenmeyen bir hesaplama hatası oluştu." }),
      createElement("button", { className: "skyTodayButton", text: "Yeniden dene", type: "button", attributes: { "data-sky-today-action": "retry" } })
    );
    content.append(card);
  }

  function refresh(options = {}) {
    if (!initialized) return false;
    const context = contextApi.getContext();
    if (!context) {
      lastMinuteKey = null;
      renderMissingContext();
      return true;
    }
    try {
      const result = momentCore.calculate(context.place, {
        at: options.at,
        natalProfile: profileApi.getProfile()
      });
      if (result.status !== "ready") {
        renderError("Takip konumu için an haritası hesaplanamadı.");
        return false;
      }
      lastMinuteKey = result.clock.minuteKey;
      renderLive(result);
      return true;
    } catch (error) {
      renderError(error?.message);
      return false;
    }
  }

  function tick() {
    if (!openState) return;
    const context = contextApi.getContext();
    if (!context) return;
    const zoned = window.moment().tz(context.place.timezoneId);
    const nextMinuteKey = zoned.format("YYYY-MM-DDTHH:mm");
    if (nextMinuteKey !== lastMinuteKey) {
      refresh();
      return;
    }
    const time = document.getElementById("skyTodayClockTime");
    const date = document.getElementById("skyTodayClockDate");
    if (time) time.textContent = zoned.format("HH:mm:ss");
    if (date) date.textContent = zoned.format("DD.MM.YYYY");
  }

  function startTimer() {
    stopTimer();
    timer = window.setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  }

  async function searchPlaces(query) {
    const token = ++requestToken;
    const feedback = document.getElementById("skyTodayPlaceFeedback");
    const candidatesRoot = document.getElementById("skyTodayCandidates");
    if (!feedback || !candidatesRoot) return;
    candidatesRoot.replaceChildren();
    placeCandidates.clear();
    if (String(query || "").trim().length < 2) {
      feedback.textContent = "En az iki karakter yaz.";
      return;
    }
    feedback.textContent = "Şehir dizini aranıyor…";
    try {
      const candidates = await placeApi.search(query, { limit: 6 });
      if (token !== requestToken) return;
      if (!candidates.length) {
        feedback.textContent = "Eşleşen şehir bulunamadı.";
        return;
      }
      candidates.forEach(candidate => {
        placeCandidates.set(String(candidate.geonameId), candidate);
        const button = createElement("button", { className: "skyTodayCandidate", type: "button", attributes: { "data-sky-today-place-id": candidate.geonameId } });
        button.append(
          createElement("strong", { text: candidate.label }),
          createElement("span", { text: candidate.timezoneId })
        );
        candidatesRoot.append(button);
      });
      feedback.textContent = `${candidates.length} eşleşme bulundu. Doğru şehri seç.`;
    } catch (error) {
      if (token === requestToken) feedback.textContent = "Şehir dizini açılamadı. Yeniden dene.";
    }
  }

  function selectPlace(id) {
    const candidate = placeCandidates.get(String(id));
    if (!candidate) return;
    contextApi.savePlace(candidate, { userInitiated: true });
  }

  function useBirthPlace() {
    const profile = profileApi.getProfile();
    if (!profileApi.inspectPlaceResolution(profile).valid) return;
    contextApi.useBirthPlace(profile, { userInitiated: true });
  }

  function bindInteractions() {
    panel.addEventListener("submit", event => {
      if (event.target.id !== "skyTodayPlaceForm") return;
      event.preventDefault();
      searchPlaces(document.getElementById("skyTodayPlaceQuery")?.value || "");
    });
    panel.addEventListener("click", event => {
      const place = event.target.closest("[data-sky-today-place-id]");
      if (place) {
        selectPlace(place.dataset.skyTodayPlaceId);
        return;
      }
      const action = event.target.closest("[data-sky-today-action]")?.dataset.skyTodayAction;
      if (action === "use-birth-place") useBirthPlace();
      if (action === "retry") refresh({ focus: true });
      if (action === "hub") onRequestHub?.();
    });
    window.addEventListener("today:sky-observation-change", () => {
      if (openState) refresh();
    });
    window.addEventListener("today:routechange", event => {
      if (openState && event.detail?.to !== "sky") {
        close();
      }
    });
  }

  function open(options = {}) {
    if (!initialized) return false;
    panel.hidden = false;
    openState = true;
    refresh();
    startTimer();
    if (options.focus !== false) title?.focus?.({ preventScroll: true });
    return true;
  }

  function close() {
    if (!initialized) return false;
    requestToken += 1;
    openState = false;
    stopTimer();
    panel.hidden = true;
    return true;
  }

  function getState() {
    return Object.freeze({
      initialized,
      open: openState,
      panelId: PANEL_ID,
      contextStatus: contextApi?.getStatus?.().status || null,
      timerActive: timer !== null,
      lastMinuteKey
    });
  }

  function init(options = {}) {
    if (initialized) return getState();
    skyView = options.skyView;
    const bottomNav = options.bottomNav;
    onRequestHub = options.onRequestHub;
    contextApi = window.TodaySkyObservationContext;
    profileApi = window.TodaySkyBirthProfile;
    placeApi = window.TodaySkyPlaceCatalog;
    momentCore = window.TodaySkyMomentCore;
    const ready = Boolean(
      skyView && bottomNav && typeof onRequestHub === "function" &&
      typeof contextApi?.getContext === "function" &&
      typeof contextApi?.savePlace === "function" &&
      typeof profileApi?.getProfile === "function" &&
      typeof placeApi?.search === "function" &&
      typeof momentCore?.calculate === "function"
    );
    if (!ready) return Object.freeze({ initialized: false, reason: "sky_today_dependencies_missing" });
    installStyles();
    panel = buildPanel();
    skyView.insertBefore(panel, bottomNav);
    bindInteractions();
    initialized = true;
    return getState();
  }

  window.TodaySkyTodayUI = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    open,
    close,
    refresh,
    getState
  });
})();
