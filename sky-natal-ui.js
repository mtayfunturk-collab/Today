/**
 * Today App — Sky Natal UI
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - Kullanıcı onaylı doğum yeri eşleşmesini yönetmek
 * - Güneş, Ay, yükselen, gezegenler, evler ve temel açıları sade biçimde göstermek
 * - Hesaplanamayan veya belirsiz durumları açıkça anlatmak
 * - Astrolojik yorum, kehanet veya AI anlatısı üretmemek
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID =
    "today:sky:natal-ui:nut-016.3";
  const PANEL_ID = "skyNatalPanel";

  let initialized = false;
  let openState = false;
  let panel = null;
  let content = null;
  let title = null;
  let skyView = null;
  let onRequestHub = null;
  let onOpenBirth = null;
  let profileApi = null;
  let placeApi = null;
  let calculationApi = null;
  let requestToken = 0;
  let placeCandidates = new Map();

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) {
      element.className = options.className;
    }
    if (options.id) element.id = options.id;
    if (options.text !== undefined) {
      element.textContent = String(options.text);
    }
    if (options.type) element.type = options.type;

    Object.entries(options.attributes || {}).forEach(
      ([name, value]) => {
        element.setAttribute(name, String(value));
      }
    );

    return element;
  }

  function installStyles() {
    if (
      document.getElementById(
        "todaySkyNatalStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "todaySkyNatalStyles";
    style.textContent = `
      .skyNatalPanel {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        display: grid;
        gap: 14px;
        padding-top: 2px;
      }

      .skyNatalPanel[hidden] {
        display: none !important;
      }

      .skyNatalHeader {
        padding: 4px 4px 2px;
        text-align: center;
      }

      .skyNatalMark {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        margin: 0 auto 11px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke));
        border-radius: 18px;
        background: color-mix(in srgb, var(--sky-accent) 13%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text));
        font-size: 29px;
        line-height: 1;
      }

      .skyNatalHeader h2 {
        margin: 0;
        font-size: 23px;
        line-height: 1.2;
        letter-spacing: -.02em;
      }

      .skyNatalHeader p {
        max-width: 35ch;
        margin: 7px auto 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .skyNatalContent {
        min-width: 0;
        display: grid;
        gap: 12px;
      }

      .skyNatalCard,
      .skyNatalDisclosure {
        min-width: 0;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
      }

      .skyNatalCard {
        padding: 16px;
      }

      .skyNatalCardAccent {
        border-color: color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        background:
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--sky-accent) 16%, transparent),
            rgba(255,255,255,.035)
          );
      }

      .skyNatalCard h3,
      .skyNatalSectionTitle {
        margin: 0;
        font-size: 16px;
        line-height: 1.25;
      }

      .skyNatalCard > p,
      .skyNatalMuted {
        margin: 7px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .skyNatalStatusRow {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 12px;
      }

      .skyNatalBadge {
        display: inline-flex;
        align-items: center;
        min-height: 27px;
        max-width: 100%;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 34%, var(--stroke));
        border-radius: 999px;
        padding: 5px 9px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 10px;
        font-weight: 850;
        line-height: 1.25;
      }

      .skyNatalBigThree {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .skyNatalAnchor {
        min-width: 0;
        border: 1px solid var(--stroke);
        border-radius: 17px;
        padding: 13px 9px;
        background: rgba(255,255,255,.025);
        text-align: center;
      }

      .skyNatalAnchorSymbol {
        display: block;
        color: color-mix(in srgb, var(--sky-accent) 70%, var(--text));
        font-size: 24px;
        line-height: 1;
      }

      .skyNatalAnchor strong {
        display: block;
        margin-top: 8px;
        font-size: 12px;
      }

      .skyNatalAnchor span:last-child {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .skyNatalRows {
        display: grid;
        gap: 0;
        margin-top: 10px;
      }

      .skyNatalRow {
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        border-top: 1px solid color-mix(in srgb, var(--stroke) 72%, transparent);
        padding: 11px 1px;
      }

      .skyNatalRow:first-child {
        border-top: 0;
      }

      .skyNatalRowLabel {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 13px;
        font-weight: 780;
      }

      .skyNatalRowSymbol {
        width: 24px;
        flex: 0 0 24px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 18px;
        text-align: center;
      }

      .skyNatalRowValue {
        max-width: 180px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
        text-align: right;
      }

      .skyNatalDisclosure {
        overflow: hidden;
      }

      .skyNatalDisclosure summary {
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        cursor: pointer;
        list-style: none;
        font-size: 14px;
        font-weight: 850;
      }

      .skyNatalDisclosure summary::-webkit-details-marker {
        display: none;
      }

      .skyNatalDisclosure summary::after {
        content: "⌄";
        color: var(--muted);
        font-size: 18px;
        transition: transform .16s ease;
      }

      .skyNatalDisclosure[open] summary::after {
        transform: rotate(180deg);
      }

      .skyNatalDisclosureBody {
        border-top: 1px solid var(--stroke);
        padding: 4px 16px 10px;
      }

      .skyNatalForm {
        display: grid;
        gap: 9px;
        margin-top: 13px;
      }

      .skyNatalLabel {
        font-size: 12px;
        font-weight: 850;
      }

      .skyNatalSearchRow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
      }

      .skyNatalInput,
      .skyNatalButton,
      .skyNatalCandidate,
      .skyNatalBack {
        min-height: 46px;
        border-radius: 14px;
        font: inherit;
      }

      .skyNatalInput {
        min-width: 0;
        border: 1px solid var(--stroke);
        padding: 0 13px;
        background: rgba(255,255,255,.04);
        color: var(--text);
        font-size: 14px;
      }

      .skyNatalButton,
      .skyNatalBack {
        border: 1px solid color-mix(in srgb, var(--sky-accent) 42%, var(--stroke));
        padding: 0 14px;
        background: color-mix(in srgb, var(--sky-accent) 14%, transparent);
        color: var(--text);
        font-size: 12px;
        font-weight: 850;
        cursor: pointer;
      }

      .skyNatalButtonSecondary {
        border-color: var(--stroke);
        background: rgba(255,255,255,.035);
      }

      .skyNatalResults {
        display: grid;
        gap: 8px;
        margin-top: 11px;
      }

      .skyNatalCandidate {
        width: 100%;
        min-width: 0;
        height: auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--stroke);
        padding: 12px;
        background: rgba(255,255,255,.03);
        color: var(--text);
        text-align: left;
        cursor: pointer;
      }

      .skyNatalCandidate strong,
      .skyNatalCandidate span {
        display: block;
      }

      .skyNatalCandidate strong {
        font-size: 13px;
      }

      .skyNatalCandidate span {
        margin-top: 4px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.35;
      }

      .skyNatalCandidateAction {
        color: color-mix(in srgb, var(--sky-accent) 76%, var(--text)) !important;
        font-size: 11px !important;
        font-weight: 850;
        white-space: nowrap;
      }

      .skyNatalFeedback {
        min-height: 18px;
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.4;
      }

      .skyNatalFeedback[data-tone="error"] {
        color: #ff9b9b;
      }

      .skyNatalActionStack {
        display: grid;
        gap: 8px;
        margin-top: 13px;
      }

      .skyNatalActionStack .skyNatalButton {
        width: 100%;
      }

      .skyNatalNotice {
        border-left: 3px solid color-mix(in srgb, var(--sky-accent) 60%, var(--stroke));
        padding-left: 12px;
      }

      .skyNatalTechnical {
        color: var(--muted);
        font-size: 10px;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }

      .skyNatalTechnical a {
        color: color-mix(in srgb, var(--sky-accent) 74%, var(--text));
      }

      .skyNatalBack {
        width: 100%;
        margin-top: 1px;
      }

      .skyNatalLoading {
        padding: 24px 16px;
        text-align: center;
      }

      .skyNatalLoadingMark {
        display: block;
        margin-bottom: 9px;
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text));
        font-size: 24px;
      }

      .skyNatalInput:focus-visible,
      .skyNatalButton:focus-visible,
      .skyNatalCandidate:focus-visible,
      .skyNatalBack:focus-visible,
      .skyNatalDisclosure summary:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--sky-accent) 55%, transparent);
        outline-offset: 2px;
      }

      @media (max-width: 380px) {
        .skyNatalBigThree {
          grid-template-columns: 1fr;
        }

        .skyNatalAnchor {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          column-gap: 8px;
          text-align: left;
        }

        .skyNatalAnchorSymbol {
          grid-row: 1 / span 2;
          align-self: center;
          text-align: center;
        }

        .skyNatalAnchor strong,
        .skyNatalAnchor span:last-child {
          margin-top: 0;
        }

        .skyNatalSearchRow {
          grid-template-columns: 1fr;
        }

        .skyNatalRow {
          grid-template-columns: 1fr;
          gap: 4px;
        }

        .skyNatalRowValue {
          max-width: none;
          padding-left: 33px;
          text-align: left;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .skyNatalDisclosure summary::after {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildPanel() {
    const section = createElement("section", {
      className: "skyNatalPanel",
      id: PANEL_ID,
      attributes: {
        hidden: "",
        "aria-labelledby": "skyNatalTitle"
      }
    });
    const header = createElement("header", {
      className: "skyNatalHeader"
    });

    title = createElement("h2", {
      id: "skyNatalTitle",
      text: "Harita Özeti",
      attributes: { tabindex: "-1" }
    });

    header.append(
      createElement("div", {
        className: "skyNatalMark",
        text: "◎",
        attributes: { "aria-hidden": "true" }
      }),
      title,
      createElement("p", {
        text:
          "Temel doğum haritası verilerini sade ve doğrulanabilir biçimde gör."
      })
    );

    content = createElement("div", {
      className: "skyNatalContent",
      id: "skyNatalContent",
      attributes: {
        role: "region",
        "aria-label": "Natal harita özeti",
        "aria-live": "polite",
        "aria-atomic": "false"
      }
    });

    section.append(
      header,
      content,
      createElement("button", {
        className: "skyNatalBack",
        text: "Sky ana ekranına dön",
        type: "button",
        attributes: {
          "data-sky-natal-action": "hub"
        }
      })
    );

    return section;
  }

  function focusElement(element) {
    if (!element) return;

    window.requestAnimationFrame(() => {
      try {
        element.focus({ preventScroll: true });
      } catch (error) {
        element.focus();
      }
    });
  }

  function replaceContent(...elements) {
    content.replaceChildren(...elements);
  }

  function createActionButton(
    text,
    action,
    options = {}
  ) {
    return createElement("button", {
      className: `skyNatalButton${
        options.secondary
          ? " skyNatalButtonSecondary"
          : ""
      }`,
      text,
      type: "button",
      attributes: {
        "data-sky-natal-action": action,
        ...(options.attributes || {})
      }
    });
  }

  function renderLoading(message) {
    const card = createElement("div", {
      className:
        "skyNatalCard skyNatalCardAccent skyNatalLoading"
    });

    card.append(
      createElement("span", {
        className: "skyNatalLoadingMark",
        text: "✦",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("strong", {
        text: message
      })
    );

    replaceContent(card);
  }

  function renderMessage({
    title: messageTitle,
    description,
    actionText,
    action = "birth",
    retry = false
  }) {
    const card = createElement("div", {
      className:
        "skyNatalCard skyNatalCardAccent"
    });
    const actions = createElement("div", {
      className: "skyNatalActionStack"
    });

    card.append(
      createElement("h3", { text: messageTitle }),
      createElement("p", { text: description })
    );

    if (actionText) {
      actions.appendChild(
        createActionButton(actionText, action)
      );
    }

    if (retry) {
      actions.appendChild(
        createActionButton(
          "Yeniden dene",
          "retry",
          { secondary: true }
        )
      );
    }

    if (actions.childElementCount > 0) {
      card.appendChild(actions);
    }

    replaceContent(card);
  }

  function renderMissingProfile() {
    renderMessage({
      title: "Önce doğum bilgilerini ekle",
      description:
        "Harita özetini hazırlamak için doğum tarihi, saat doğruluğu ve doğum yeri gerekli.",
      actionText: "Doğum bilgilerini ekle"
    });
  }

  function renderPlaceResolver(profile) {
    placeCandidates = new Map();

    const card = createElement("div", {
      className:
        "skyNatalCard skyNatalCardAccent"
    });
    const form = createElement("form", {
      className: "skyNatalForm",
      id: "skyNatalPlaceForm"
    });
    const row = createElement("div", {
      className: "skyNatalSearchRow"
    });
    const input = createElement("input", {
      className: "skyNatalInput",
      id: "skyNatalPlaceQuery",
      type: "search",
      attributes: {
        value: profile.birthPlace.label,
        autocomplete: "off",
        minlength: "2",
        maxlength: "120",
        required: "",
        "aria-describedby":
          "skyNatalPlaceHelp skyNatalPlaceFeedback"
      }
    });

    input.value = profile.birthPlace.label;

    row.append(
      input,
      createElement("button", {
        className: "skyNatalButton",
        text: "Şehirleri bul",
        type: "submit"
      })
    );

    form.append(
      createElement("label", {
        className: "skyNatalLabel",
        text: "Doğum yerini doğrula",
        attributes: { for: "skyNatalPlaceQuery" }
      }),
      row,
      createElement("p", {
        className: "skyNatalMuted",
        id: "skyNatalPlaceHelp",
        text:
          "Yükselen ve evler için doğru şehir, koordinat ve tarihsel saat dilimi eşleşmesini seç. Arama cihazdan dışarı gönderilmez."
      }),
      createElement("p", {
        className: "skyNatalFeedback",
        id: "skyNatalPlaceFeedback"
      }),
      createElement("div", {
        className: "skyNatalResults",
        id: "skyNatalPlaceResults",
        attributes: {
          "aria-label": "Şehir eşleşmeleri"
        }
      })
    );

    card.append(
      createElement("h3", {
        text: "Bir kez şehir eşleşmesi seç"
      }),
      createElement("p", {
        text:
          `Kayıtlı yer: ${profile.birthPlace.label}`
      }),
      form
    );

    replaceContent(card);
    performPlaceSearch(profile.birthPlace.label, {
      focus: false
    });
  }

  function setPlaceFeedback(
    message = "",
    tone = ""
  ) {
    const feedback = document.getElementById(
      "skyNatalPlaceFeedback"
    );

    if (!feedback || !panel.contains(feedback)) {
      return;
    }

    feedback.textContent = message;
    if (tone) {
      feedback.dataset.tone = tone;
    } else {
      delete feedback.dataset.tone;
    }
  }

  function renderPlaceCandidates(candidates) {
    const results = document.getElementById(
      "skyNatalPlaceResults"
    );

    if (!results || !panel.contains(results)) {
      return;
    }

    results.replaceChildren();
    placeCandidates = new Map(
      candidates.map(candidate => [
        String(candidate.geonameId),
        candidate
      ])
    );

    candidates.forEach(candidate => {
      const button = createElement("button", {
        className: "skyNatalCandidate",
        type: "button",
        attributes: {
          "data-sky-natal-place-id":
            candidate.geonameId,
          "aria-label":
            `${candidate.label} şehrini seç`
        }
      });
      const copy = createElement("span");

      copy.append(
        createElement("strong", {
          text: candidate.label
        }),
        createElement("span", {
          text:
            `${candidate.timezoneId} · ${candidate.latitude.toFixed(3)}, ${candidate.longitude.toFixed(3)}`
        })
      );

      button.append(
        copy,
        createElement("span", {
          className: "skyNatalCandidateAction",
          text: "Seç"
        })
      );
      results.appendChild(button);
    });
  }

  async function performPlaceSearch(
    query,
    options = {}
  ) {
    const normalized = String(query || "").trim();
    const token = ++requestToken;

    if (normalized.length < 2) {
      setPlaceFeedback(
        "En az iki karakter gir.",
        "error"
      );
      return;
    }

    setPlaceFeedback("Cihazdaki şehir dizini aranıyor…");

    try {
      const candidates = await placeApi.search(
        normalized,
        { limit: 8 }
      );

      if (
        token !== requestToken ||
        !openState
      ) {
        return;
      }

      renderPlaceCandidates(candidates);
      setPlaceFeedback(
        candidates.length > 0
          ? `${candidates.length} eşleşme bulundu. Doğru şehri seç.`
          : "Eşleşme bulunamadı. Şehir adını sadeleştirerek yeniden dene.",
        candidates.length > 0 ? "" : "error"
      );

      if (options.focus !== false) {
        focusElement(
          document.querySelector(
            "#skyNatalPlaceResults .skyNatalCandidate"
          )
        );
      }
    } catch (error) {
      if (token !== requestToken) return;

      renderPlaceCandidates([]);
      setPlaceFeedback(
        "Şehir dizini açılamadı. Uygulama güncellemesini tamamlayıp yeniden dene.",
        "error"
      );
    }
  }

  async function confirmPlace(geonameId) {
    const candidate = placeCandidates.get(
      String(geonameId)
    );

    if (!candidate) {
      setPlaceFeedback(
        "Şehir eşleşmesi artık geçerli değil. Yeniden ara.",
        "error"
      );
      return;
    }

    setPlaceFeedback(
      `${candidate.label} kaydediliyor…`
    );

    try {
      profileApi.resolveBirthPlace(candidate, {
        userInitiated: true
      });
      await refresh({ focus: false });
    } catch (error) {
      setPlaceFeedback(
        error?.message ||
          "Şehir eşleşmesi kaydedilemedi.",
        "error"
      );
    }
  }

  function degreeText(position) {
    if (!position) return "—";

    let degrees = Math.floor(position.degreeInSign);
    let minutes = Math.round(
      (position.degreeInSign - degrees) * 60
    );

    if (minutes === 60) {
      degrees += 1;
      minutes = 0;
    }

    if (degrees === 30) degrees = 0;

    return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${position.sign}`;
  }

  function placementText(placement) {
    if (!placement) return "—";

    if (placement.kind === "daily_range") {
      const start = degreeText(placement.start);
      const end = degreeText(placement.end);

      return start === end
        ? start
        : `${start} – ${end}`;
    }

    const house = placement.house
      ? ` · ${placement.house}. ev`
      : "";

    return `${degreeText(placement)}${house}`;
  }

  function createAnchor({
    symbol,
    label,
    value
  }) {
    const card = createElement("div", {
      className: "skyNatalAnchor"
    });

    card.append(
      createElement("span", {
        className: "skyNatalAnchorSymbol",
        text: symbol,
        attributes: { "aria-hidden": "true" }
      }),
      createElement("strong", { text: label }),
      createElement("span", { text: value })
    );

    return card;
  }

  function createStatusCard(profile, result) {
    const card = createElement("div", {
      className:
        "skyNatalCard skyNatalCardAccent"
    });
    const row = createElement("div", {
      className: "skyNatalStatusRow"
    });
    const precisionLabels = {
      exact: "Saat kesin",
      approximate: "Saat yaklaşık",
      unknown: "Saat bilinmiyor"
    };

    row.append(
      createElement("span", {
        className: "skyNatalBadge",
        text: precisionLabels[
          profile.timePrecision
        ]
      }),
      createElement("span", {
        className: "skyNatalBadge",
        text: profile.birthPlace.timezoneId
      })
    );

    card.append(
      createElement("h3", {
        text: profile.birthPlace.label
      }),
      createElement("p", {
        text:
          result.status === "ready_date_range"
            ? `${profile.birthDate} günü içindeki olası konum aralıkları gösteriliyor.`
            : `${profile.birthDate} · ${profile.birthTime} yerel doğum saati`
      }),
      row
    );

    return card;
  }

  function createBigThree(result) {
    const grid = createElement("div", {
      className: "skyNatalBigThree",
      attributes: {
        "aria-label": "Temel üçlü"
      }
    });
    const sun = result.planets.find(
      planet => planet.id === "sun"
    );
    const moon = result.planets.find(
      planet => planet.id === "moon"
    );
    const ascendant = result.angles?.ascendant;

    grid.append(
      createAnchor({
        symbol: "☉",
        label: "Güneş",
        value: placementText(sun)
      }),
      createAnchor({
        symbol: "☽",
        label: "Ay",
        value: placementText(moon)
      }),
      createAnchor({
        symbol: "ASC",
        label: "Yükselen",
        value: ascendant
          ? `${degreeText(ascendant)}${
              result.timePrecision ===
              "approximate"
                ? " · yaklaşık"
                : ""
            }`
          : result.houses?.reason ===
              "birth_time_unknown"
            ? "Saat bilinmediği için gösterilmiyor"
            : "Bu enlemde hesaplanamıyor"
      })
    );

    return grid;
  }

  function createPlanetCard(result) {
    const card = createElement("div", {
      className: "skyNatalCard"
    });
    const rows = createElement("div", {
      className: "skyNatalRows"
    });

    result.planets.forEach(planet => {
      const row = createElement("div", {
        className: "skyNatalRow"
      });
      const label = createElement("div", {
        className: "skyNatalRowLabel"
      });

      label.append(
        createElement("span", {
          className: "skyNatalRowSymbol",
          text: planet.symbol,
          attributes: { "aria-hidden": "true" }
        }),
        createElement("span", {
          text: planet.label
        })
      );

      row.append(
        label,
        createElement("span", {
          className: "skyNatalRowValue",
          text: placementText(planet)
        })
      );
      rows.appendChild(row);
    });

    card.append(
      createElement("h3", {
        text: "Gezegen Yerleşimleri"
      }),
      createElement("p", {
        text:
          result.status === "ready_date_range"
            ? "Doğum saati bilinmediği için gün içindeki başlangıç ve bitiş aralığı gösterilir."
            : "Tropikal zodyakta Güneş’ten Plüton’a temel yerleşimler."
      }),
      rows
    );

    return card;
  }

  function createHousesDisclosure(result) {
    const details = createElement("details", {
      className: "skyNatalDisclosure"
    });
    const body = createElement("div", {
      className: "skyNatalDisclosureBody"
    });

    details.appendChild(
      createElement("summary", {
        text: "12 Ev Özeti"
      })
    );

    if (result.houses?.status !== "ready") {
      body.appendChild(
        createElement("p", {
          className: "skyNatalMuted",
          text:
            result.houses?.reason ===
            "birth_time_unknown"
              ? "Doğum saati bilinmediği için ASC, MC ve evler hesaplanmadı."
              : "Placidus ev sistemi bu enlemde güvenilir biçimde hesaplanamadı; başka bir sisteme sessizce geçilmedi."
        })
      );
    } else {
      const rows = createElement("div", {
        className: "skyNatalRows"
      });

      result.houses.cusps.forEach(cusp => {
        const row = createElement("div", {
          className: "skyNatalRow"
        });

        row.append(
          createElement("span", {
            className: "skyNatalRowLabel",
            text: `${cusp.house}. Ev`
          }),
          createElement("span", {
            className: "skyNatalRowValue",
            text: degreeText(cusp)
          })
        );
        rows.appendChild(row);
      });

      body.appendChild(rows);
    }

    details.appendChild(body);
    return details;
  }

  function createAspectsDisclosure(result) {
    const details = createElement("details", {
      className: "skyNatalDisclosure"
    });
    const body = createElement("div", {
      className: "skyNatalDisclosureBody"
    });

    details.appendChild(
      createElement("summary", {
        text: "En Yakın Temel Açılar"
      })
    );

    if (result.status === "ready_date_range") {
      body.appendChild(
        createElement("p", {
          className: "skyNatalMuted",
          text:
            "Doğum saati bilinmediği için açıları tek bir kesin an üzerinden sıralamıyoruz."
        })
      );
    } else if (result.aspects.length === 0) {
      body.appendChild(
        createElement("p", {
          className: "skyNatalMuted",
          text:
            "Tanımlı orb sınırları içinde temel açı bulunmadı."
        })
      );
    } else {
      const rows = createElement("div", {
        className: "skyNatalRows"
      });

      result.aspects.forEach(aspect => {
        const row = createElement("div", {
          className: "skyNatalRow"
        });

        row.append(
          createElement("span", {
            className: "skyNatalRowLabel",
            text:
              `${aspect.left.symbol} ${aspect.left.label} — ${aspect.right.symbol} ${aspect.right.label}`
          }),
          createElement("span", {
            className: "skyNatalRowValue",
            text:
              `${aspect.label} · orb ${aspect.orb.toFixed(2)}°`
          })
        );
        rows.appendChild(row);
      });

      body.appendChild(rows);
    }

    details.appendChild(body);
    return details;
  }

  function createTechnicalDisclosure(result) {
    const details = createElement("details", {
      className: "skyNatalDisclosure"
    });
    const body = createElement("div", {
      className:
        "skyNatalDisclosureBody skyNatalTechnical"
    });
    const metadata = result.metadata;
    const attribution = createElement("p");
    const sourceLink = createElement("a", {
      text: "GeoNames",
      attributes: {
        href: "https://www.geonames.org/",
        target: "_blank",
        rel: "noreferrer"
      }
    });
    const licenseLink = createElement("a", {
      text: "CC BY 4.0",
      attributes: {
        href:
          "https://creativecommons.org/licenses/by/4.0/",
        target: "_blank",
        rel: "noreferrer"
      }
    });

    attribution.append(
      "Şehir verisi: ",
      sourceLink,
      " · ",
      licenseLink
    );

    body.append(
      createElement("p", {
        text:
          `Gezegen motoru: Astronomy Engine ${metadata.astronomyEngine.version} · MIT`
      }),
      createElement("p", {
        text:
          `Ev motoru: ${metadata.houseEngine.engineId} ${metadata.houseEngine.engineVersion} · Placidus`
      }),
      createElement("p", {
        text:
          `Saat dilimi: Moment Timezone ${metadata.timezoneEngine.version} · IANA ${metadata.timezoneEngine.dataVersion || "—"}`
      }),
      createElement("p", {
        text:
          `Şehir dizini: ${metadata.placeDataVersion || "—"}`
      }),
      attribution
    );

    details.append(
      createElement("summary", {
        text: "Hesap ve Veri Bilgisi"
      }),
      body
    );

    return details;
  }

  function renderChart(profile, result) {
    const notice = createElement("div", {
      className: "skyNatalCard skyNatalNotice"
    });

    notice.append(
      createElement("h3", {
        text: "Hesap, yorum değil"
      }),
      createElement("p", {
        text:
          "Bu ekran astronomik konumları ve astrolojik harita geometrisini gösterir; anlam, kehanet veya AI yorumu üretmez."
      })
    );

    replaceContent(
      createStatusCard(profile, result),
      createBigThree(result),
      createPlanetCard(result),
      createHousesDisclosure(result),
      createAspectsDisclosure(result),
      createTechnicalDisclosure(result),
      notice
    );
  }

  function renderAmbiguousTime(profile, result) {
    const card = createElement("div", {
      className:
        "skyNatalCard skyNatalCardAccent"
    });
    const actions = createElement("div", {
      className: "skyNatalActionStack"
    });

    result.resolution.candidates.forEach(
      candidate => {
        actions.appendChild(
          createActionButton(
            candidate.key === "earlier"
              ? `İlk karşılık · ${candidate.offsetLabel}`
              : `İkinci karşılık · ${candidate.offsetLabel}`,
            "choose-time",
            {
              attributes: {
                "data-sky-natal-time-choice":
                  candidate.key
              },
              secondary:
                candidate.key === "later"
            }
          )
        );
      }
    );

    card.append(
      createElement("h3", {
        text: "Bu yerel saat iki kez yaşandı"
      }),
      createElement("p", {
        text:
          `${profile.birthDate} ${profile.birthTime}, ${profile.birthPlace.label} için yaz saati geçişi nedeniyle iki UTC karşılığı var. Doğum kaydına uygun olanı seç.`
      }),
      actions,
      createActionButton(
        "Doğum bilgilerini düzenle",
        "birth",
        { secondary: true }
      )
    );

    replaceContent(card);
  }

  function renderCalculationState(profile, result) {
    if (
      ["ready", "ready_date_range"].includes(
        result.status
      )
    ) {
      renderChart(profile, result);
      return;
    }

    if (result.status === "ambiguous_local_time") {
      renderAmbiguousTime(profile, result);
      return;
    }

    if (result.status === "nonexistent_local_time") {
      renderMessage({
        title: "Bu yerel saat takvimde yok",
        description:
          "Yaz saati geçişi nedeniyle girilen doğum saati o şehirde yaşanmadı. Saat bilgini kontrol edip düzenle.",
        actionText: "Doğum bilgilerini düzenle"
      });
      return;
    }

    renderMessage({
      title: "Harita özeti hazırlanamadı",
      description:
        "Doğum verisi veya hesap motoru doğrulanamadı. Bilgileri kontrol edip yeniden dene.",
      actionText: "Doğum bilgilerini düzenle",
      retry: true
    });
  }

  async function refresh(options = {}) {
    if (!initialized || !openState) {
      return false;
    }

    const token = ++requestToken;
    renderLoading("Harita özeti hazırlanıyor…");

    try {
      const profile = profileApi.getProfile();

      if (token !== requestToken || !openState) {
        return false;
      }

      if (!profile) {
        renderMissingProfile();
        return true;
      }

      if (
        !profileApi.inspectPlaceResolution(
          profile
        ).valid
      ) {
        renderPlaceResolver(profile);
        return true;
      }

      const result = calculationApi.calculate(
        profile
      );

      if (token !== requestToken || !openState) {
        return false;
      }

      renderCalculationState(profile, result);

      if (options.focus === true) {
        focusElement(title);
      }

      return true;
    } catch (error) {
      if (token !== requestToken) return false;

      renderMessage({
        title: "Harita özeti açılamadı",
        description:
          error?.message ||
          "Beklenmeyen bir hesaplama hatası oluştu.",
        retry: true
      });
      return false;
    }
  }

  function open(options = {}) {
    if (!initialized) return false;

    panel.hidden = false;
    openState = true;
    refresh({ focus: false });

    if (options.focus !== false) {
      focusElement(title);
    }

    return true;
  }

  function close() {
    if (!initialized) return false;

    requestToken += 1;
    openState = false;
    panel.hidden = true;
    return true;
  }

  function bindInteractions() {
    panel.addEventListener("submit", event => {
      if (event.target.id !== "skyNatalPlaceForm") {
        return;
      }

      event.preventDefault();
      const input = document.getElementById(
        "skyNatalPlaceQuery"
      );
      performPlaceSearch(input?.value || "");
    });

    panel.addEventListener("click", event => {
      const placeTrigger = event.target.closest(
        "[data-sky-natal-place-id]"
      );

      if (placeTrigger) {
        confirmPlace(
          placeTrigger.dataset.skyNatalPlaceId
        );
        return;
      }

      const actionTrigger = event.target.closest(
        "[data-sky-natal-action]"
      );

      if (!actionTrigger) return;

      const action =
        actionTrigger.dataset.skyNatalAction;

      if (action === "hub") {
        onRequestHub?.();
      }

      if (action === "birth") {
        onOpenBirth?.();
      }

      if (action === "retry") {
        refresh({ focus: true });
      }

      if (action === "choose-time") {
        const choice =
          actionTrigger.dataset.skyNatalTimeChoice;

        try {
          profileApi.setTimeDisambiguation(
            choice,
            { userInitiated: true }
          );
          refresh({ focus: true });
        } catch (error) {
          renderMessage({
            title: "Saat karşılığı kaydedilemedi",
            description:
              error?.message ||
              "Seçimi yeniden dene.",
            retry: true
          });
        }
      }
    });
  }

  function getState() {
    return Object.freeze({
      initialized,
      open: openState,
      panelId: PANEL_ID,
      placeCatalogStatus:
        placeApi?.getStatus?.().status || null
    });
  }

  function init(options = {}) {
    if (initialized) return getState();

    skyView = options.skyView;
    const bottomNav = options.bottomNav;
    onRequestHub = options.onRequestHub;
    onOpenBirth = options.onOpenBirth;
    profileApi = window.TodaySkyBirthProfile;
    placeApi = window.TodaySkyPlaceCatalog;
    calculationApi =
      window.TodaySkyCalculationCore;

    const dependenciesReady = Boolean(
      skyView &&
      bottomNav &&
      typeof onRequestHub === "function" &&
      typeof onOpenBirth === "function" &&
      typeof profileApi?.getProfile ===
        "function" &&
      typeof profileApi?.inspectPlaceResolution ===
        "function" &&
      typeof profileApi?.resolveBirthPlace ===
        "function" &&
      typeof profileApi?.setTimeDisambiguation ===
        "function" &&
      typeof placeApi?.search === "function" &&
      typeof calculationApi?.calculate ===
        "function"
    );

    if (!dependenciesReady) {
      return Object.freeze({
        initialized: false,
        reason: "sky_natal_dependencies_missing"
      });
    }

    installStyles();
    panel = buildPanel();
    skyView.insertBefore(panel, bottomNav);
    bindInteractions();
    initialized = true;

    return getState();
  }

  window.TodaySkyNatalUI = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    open,
    close,
    refresh,
    getState
  });
})();
