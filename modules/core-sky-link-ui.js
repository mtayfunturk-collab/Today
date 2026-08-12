/**
 * Today App — Core–Sky Link UI
 * NUT-016.6 — isteğe bağlı, yorumsuz Core–Sky bağlantı yüzeyi
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID =
    "today:core-sky-link-ui:nut-016.6";
  const PANEL_ID = "skyCoreLinkPanel";
  const CORE_CARD_ID = "coreSkyLinkCard";
  const CHOICE_LABELS = Object.freeze({
    A: "Bir şey oldu ama adı yok",
    B: "Her şey çok net",
    C: "Zordu bugün"
  });
  const COLOR_LABELS = Object.freeze({
    navy: "Lacivert",
    orange: "Turuncu",
    red: "Kırmızı",
    blue: "Mavi",
    yellow: "Sarı",
    green: "Yeşil",
    deep: "Derin"
  });

  let initialized = false;
  let openState = false;
  let panel = null;
  let content = null;
  let title = null;
  let coreCard = null;
  let coreSummary = null;
  let coreAction = null;
  let skyView = null;
  let bridge = null;
  let dayApi = null;
  let storage = null;
  let momentCore = null;
  let onRequestHub = null;
  let onOpenToday = null;
  let onOpenCore = null;
  let onOpenSelf = null;
  let unlinkConfirmation = false;
  let interactionBound = false;
  let eventBound = false;
  let lastStatus = "unknown";

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
        "todayCoreSkyLinkStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "todayCoreSkyLinkStyles";
    style.textContent = `
      .coreSkyLinkCard {
        width: 100%; min-width: 0; display: grid; gap: 9px;
        margin-top: 14px; border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
        border-radius: 18px; padding: 14px; background: color-mix(in srgb, var(--accent) 9%, transparent);
      }
      .coreSkyLinkHead { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .coreSkyLinkTitle { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; }
      .coreSkyLinkMark { color: color-mix(in srgb, var(--accent) 72%, var(--text)); font-size: 16px; }
      .coreSkyLinkBadge {
        flex: 0 0 auto; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
        border-radius: 999px; padding: 4px 7px; color: var(--muted); font-size: 9px; font-weight: 800;
      }
      .coreSkyLinkSummary { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
      .coreSkyLinkAction {
        min-height: 40px; border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--line));
        border-radius: 13px; padding: 9px 12px; background: transparent; color: var(--text);
        font: inherit; font-size: 11px; font-weight: 850; cursor: pointer;
      }
      .skyCoreLinkPanel {
        width: 100%; min-width: 0; max-width: 100%; display: grid; gap: 14px; padding-top: 2px;
      }
      .skyCoreLinkPanel[hidden] { display: none !important; }
      .skyCoreLinkHeader { padding: 4px 4px 2px; text-align: center; }
      .skyCoreLinkMark {
        width: 54px; height: 54px; display: grid; place-items: center; margin: 0 auto 11px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke)); border-radius: 18px;
        background: color-mix(in srgb, var(--sky-accent) 13%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text)); font-size: 27px;
      }
      .skyCoreLinkHeader h2 { margin: 0; font-size: 23px; line-height: 1.2; letter-spacing: -.02em; }
      .skyCoreLinkHeader p { max-width: 38ch; margin: 7px auto 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .skyCoreLinkContent { min-width: 0; display: grid; gap: 12px; }
      .skyCoreLinkCard, .skyCoreLinkDisclosure {
        min-width: 0; border: 1px solid var(--stroke); border-radius: 20px; background: rgba(255,255,255,.035);
      }
      .skyCoreLinkCard { padding: 16px; }
      .skyCoreLinkAccent {
        border-color: color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        background: linear-gradient(145deg, color-mix(in srgb, var(--sky-accent) 16%, transparent), rgba(255,255,255,.035));
      }
      .skyCoreLinkCard h3, .skyCoreLinkSectionTitle { margin: 0; font-size: 16px; line-height: 1.25; }
      .skyCoreLinkCard p, .skyCoreLinkMuted { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
      .skyCoreLinkFacts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
      .skyCoreLinkFact {
        display: inline-flex; align-items: center; min-height: 26px; border: 1px solid color-mix(in srgb, var(--sky-accent) 30%, var(--stroke));
        border-radius: 999px; padding: 5px 8px; color: var(--muted); font-size: 10px; font-weight: 750;
      }
      .skyCoreLinkActions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
      .skyCoreLinkButton {
        min-height: 42px; border: 1px solid color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        border-radius: 14px; padding: 10px 13px; background: color-mix(in srgb, var(--sky-accent) 14%, transparent);
        color: var(--text); font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
      }
      .skyCoreLinkButtonSecondary { background: transparent; }
      .skyCoreLinkButtonDanger { border-color: color-mix(in srgb, #ff7676 44%, var(--stroke)); background: color-mix(in srgb, #ff7676 10%, transparent); }
      .skyCoreLinkRows { display: grid; margin-top: 11px; }
      .skyCoreLinkRow {
        min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px;
        padding: 10px 1px; border-top: 1px solid color-mix(in srgb, var(--stroke) 75%, transparent);
      }
      .skyCoreLinkRow:first-child { border-top: 0; }
      .skyCoreLinkRow strong { min-width: 0; font-size: 12px; overflow-wrap: anywhere; }
      .skyCoreLinkRow span { color: var(--muted); font-size: 11px; text-align: right; }
      .skyCoreLinkDisclosure { overflow: hidden; margin-top: 12px; }
      .skyCoreLinkDisclosure summary { padding: 13px 14px; cursor: pointer; font-size: 12px; font-weight: 850; }
      .skyCoreLinkDisclosureBody { padding: 0 14px 14px; }
      .skyCoreLinkHistory { display: grid; gap: 9px; }
      .skyCoreLinkHistoryItem {
        min-width: 0; border: 1px solid var(--stroke); border-radius: 16px; padding: 12px 13px;
        background: rgba(255,255,255,.025);
      }
      .skyCoreLinkHistoryItem summary { cursor: pointer; list-style-position: inside; font-size: 12px; font-weight: 850; }
      .skyCoreLinkHistoryMeta { margin: 7px 0 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
      .skyCoreLinkBoundary {
        border-style: dashed; background: transparent;
      }
      @media (max-width: 390px) {
        .skyCoreLinkActions { display: grid; grid-template-columns: minmax(0, 1fr); }
        .skyCoreLinkButton { width: 100%; }
        .skyCoreLinkRow { gap: 7px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .coreSkyLinkAction, .skyCoreLinkButton { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildCoreCard() {
    const card = createElement("section", {
      className: "coreSkyLinkCard",
      id: CORE_CARD_ID,
      attributes: {
        "aria-labelledby": "coreSkyLinkTitle"
      }
    });
    const head = createElement("div", {
      className: "coreSkyLinkHead"
    });
    const heading = createElement("strong", {
      className: "coreSkyLinkTitle",
      id: "coreSkyLinkTitle"
    });
    heading.append(
      createElement("span", {
        className: "coreSkyLinkMark",
        text: "✦",
        attributes: { "aria-hidden": "true" }
      }),
      document.createTextNode("Gökyüzü bağlantısı")
    );
    head.append(
      heading,
      createElement("span", {
        className: "coreSkyLinkBadge",
        text: "İsteğe bağlı"
      })
    );
    coreSummary = createElement("p", {
      className: "coreSkyLinkSummary",
      id: "coreSkyLinkSummary"
    });
    coreAction = createElement("button", {
      className: "coreSkyLinkAction",
      id: "btnCoreSkyLink",
      text: "Bağlantıyı yönet",
      type: "button"
    });
    card.append(head, coreSummary, coreAction);
    return card;
  }

  function buildPanel() {
    const root = createElement("section", {
      className: "skyCoreLinkPanel",
      id: PANEL_ID,
      attributes: {
        hidden: "",
        "aria-labelledby": "skyCoreLinkTitle"
      }
    });
    const header = createElement("header", {
      className: "skyCoreLinkHeader"
    });
    header.append(
      createElement("div", {
        className: "skyCoreLinkMark",
        text: "✦",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("h2", {
        id: "skyCoreLinkTitle",
        text: "Core–Sky Bağlantısı",
        attributes: { tabindex: "-1" }
      }),
      createElement("p", {
        text:
          "Core kaydına o anın hesaplanmış gökyüzünü, yalnız istersen bağla."
      })
    );
    content = createElement("div", {
      className: "skyCoreLinkContent",
      id: "skyCoreLinkContent",
      attributes: {
        "aria-live": "polite",
        "aria-atomic": "false"
      }
    });
    root.append(header, content);
    title = header.querySelector("h2");
    return root;
  }

  function formatDateKey(dateKey) {
    try {
      return dayApi.prettyTR(dateKey);
    } catch (error) {
      return dateKey;
    }
  }

  function formatDegree(value) {
    return momentCore.formatDegree(
      Number(value) || 0
    );
  }

  function formatPlacement(placement) {
    if (!placement) return "Kullanılamıyor";
    return [
      placement.signSymbol,
      placement.sign,
      formatDegree(placement.degreeInSign)
    ].filter(Boolean).join(" ");
  }

  function currentCoreRecord() {
    return storage.getDay(dayApi.todayKey()) || {};
  }

  function coreFacts(record) {
    const facts = [];
    if (record.choice) {
      facts.push(
        CHOICE_LABELS[record.choice] || record.choice
      );
    }
    if (record.color) {
      facts.push(
        `Renk: ${COLOR_LABELS[record.color] || record.color}`
      );
    }
    if (String(record.note || "").trim()) {
      facts.push("Not var");
    }
    return facts;
  }

  function renderCoreSummary() {
    if (!initialized || !coreCard) return false;
    const status = bridge.getStatus(
      dayApi.todayKey()
    );
    lastStatus = status.status;

    if (status.status === "linked") {
      const link = status.link;
      coreSummary.textContent =
        `${link.place.label} · ${link.sky.clock.localTime} · ` +
        "Hesaplanmış anlık görüntü bağlı. Yorum üretilmez.";
      coreAction.textContent = "Bağlantıyı gör";
      return true;
    }

    if (status.status === "missing_core_record") {
      coreSummary.textContent =
        "Önce bugüne bir seçim, renk veya not ekle. Bağlantı otomatik kurulmaz.";
      coreAction.textContent = "Nasıl çalıştığını gör";
      return true;
    }

    if (status.status === "missing_place") {
      coreSummary.textContent =
        "Core kaydı hazır. Bağlamak için Sky takip konumunu bir kez seçmen gerekir.";
      coreAction.textContent = "Bağlantıyı hazırla";
      return true;
    }

    if (status.status === "invalid_link") {
      coreSummary.textContent =
        "Kayıtlı bağlantı doğrulanamadı. Core kaydın korunuyor.";
      coreAction.textContent = "Bağlantıyı kontrol et";
      return true;
    }

    coreSummary.textContent =
      "Bugünkü kayda Sky verisi bağlanmadı. İstersen tek dokunuşla ekleyebilirsin.";
    coreAction.textContent = "İsteğe bağlı bağla";
    return true;
  }

  function appendAction(
    parent,
    action,
    label,
    options = {}
  ) {
    const button = createElement("button", {
      className: [
        "skyCoreLinkButton",
        options.secondary
          ? "skyCoreLinkButtonSecondary"
          : "",
        options.danger
          ? "skyCoreLinkButtonDanger"
          : ""
      ].filter(Boolean).join(" "),
      text: label,
      type: "button",
      attributes: {
        "data-core-sky-action": action
      }
    });
    parent.appendChild(button);
    return button;
  }

  function buildCoreRecordCard() {
    const record = currentCoreRecord();
    const card = createElement("article", {
      className: "skyCoreLinkCard",
      attributes: {
        "aria-labelledby": "skyCoreLinkRecordTitle"
      }
    });
    card.append(
      createElement("h3", {
        id: "skyCoreLinkRecordTitle",
        text: "Bugünün Core kaydı"
      }),
      createElement("p", {
        text: formatDateKey(dayApi.todayKey())
      })
    );
    const facts = coreFacts(record);

    if (facts.length === 0) {
      card.append(
        createElement("p", {
          text:
            "Henüz seçim, renk veya not yok. Gökyüzü ancak gerçek bir Core kaydına bağlanabilir."
        })
      );
      const actions = createElement("div", {
        className: "skyCoreLinkActions"
      });
      appendAction(
        actions,
        "open-core",
        "Core kaydı ekle"
      );
      card.appendChild(actions);
      return card;
    }

    const factsRoot = createElement("div", {
      className: "skyCoreLinkFacts",
      attributes: {
        "aria-label": "Core kayıt özeti"
      }
    });
    facts.forEach(fact => {
      factsRoot.appendChild(
        createElement("span", {
          className: "skyCoreLinkFact",
          text: fact
        })
      );
    });
    card.appendChild(factsRoot);
    return card;
  }

  function buildRows(placements) {
    const rows = createElement("div", {
      className: "skyCoreLinkRows"
    });
    placements.forEach(placement => {
      const row = createElement("div", {
        className: "skyCoreLinkRow"
      });
      row.append(
        createElement("strong", {
          text: `${placement.symbol || ""} ${placement.label || ""}`.trim()
        }),
        createElement("span", {
          text: formatPlacement(placement)
        })
      );
      rows.appendChild(row);
    });
    return rows;
  }

  function snapshotPlacements(link) {
    const planets = link.sky.planets;
    const ascendant = link.sky.angles.ascendant;
    return [
      ...(ascendant
        ? [{
            id: "ascendant",
            label: "Yükselen",
            symbol: "ASC",
            ...ascendant
          }]
        : []),
      ...bridge.PRIMARY_BODY_IDS
        .map(id =>
          planets.find(planet => planet.id === id)
        )
        .filter(Boolean)
    ];
  }

  function buildSnapshotCard(link, options = {}) {
    const card = createElement("article", {
      className:
        "skyCoreLinkCard skyCoreLinkAccent",
      attributes: options.history
        ? {}
        : {
            "aria-labelledby": "skyCoreLinkSnapshotTitle"
          }
    });
    card.append(
      createElement("h3", {
        id: options.history
          ? undefined
          : "skyCoreLinkSnapshotTitle",
        text: options.history
          ? formatDateKey(link.dateKey)
          : "Bağlı gökyüzü"
      }),
      createElement("p", {
        text:
          `${link.place.label} · ` +
          `${link.sky.clock.localDateKey} ${link.sky.clock.localTime} ` +
          `(${link.sky.clock.utcOffset})`
      }),
      buildRows(snapshotPlacements(link))
    );

    const details = createElement("details", {
      className: "skyCoreLinkDisclosure"
    });
    details.appendChild(
      createElement("summary", {
        text: "Tüm gezegenleri ve hesap kaydını gör"
      })
    );
    const detailBody = createElement("div", {
      className: "skyCoreLinkDisclosureBody"
    });
    detailBody.append(
      buildRows(link.sky.planets),
      createElement("p", {
        className: "skyCoreLinkMuted",
        text:
          `${link.metadata.engineId} · ${link.metadata.houseSystem} · ` +
          "yorum yok · nedensellik iddiası yok · AI işlemi yok"
      })
    );
    details.appendChild(detailBody);
    card.appendChild(details);
    return card;
  }

  function buildBoundaryCard() {
    const card = createElement("article", {
      className:
        "skyCoreLinkCard skyCoreLinkBoundary"
    });
    card.append(
      createElement("h3", {
        text: "Bu bağlantı ne yapar?"
      }),
      createElement("p", {
        text:
          "Core kaydına yalnız tarih, saat, kullanıcı seçimi konum ve hesaplanmış gezegen derecelerinin değişmez bir kopyasını ekler."
      }),
      createElement("p", {
        text:
          "Duygunun nedenini açıklamaz; olay öngörmez; yorum, öneri veya kişilik çıkarımı üretmez. Bunlar bu NUT’un dışında tutulur; ileride yalnız açık izinle AI Engine katmanında ele alınabilir."
      })
    );
    return card;
  }

  function buildReadyCard() {
    const card = createElement("article", {
      className:
        "skyCoreLinkCard skyCoreLinkAccent",
      attributes: {
        "aria-labelledby": "skyCoreLinkReadyTitle"
      }
    });
    card.append(
      createElement("h3", {
        id: "skyCoreLinkReadyTitle",
        text: "Bağlantı hazır"
      }),
      createElement("p", {
        text:
          "Dokunduğun anın Güneş–Plüton yerleşimleri, ASC/MC ve geometrik açıları bugünkü Core kaydına eklenir. Sonradan değişmez."
      })
    );
    const actions = createElement("div", {
      className: "skyCoreLinkActions"
    });
    appendAction(
      actions,
      "link",
      "Bugünkü kayda gökyüzünü bağla"
    );
    card.appendChild(actions);
    return card;
  }

  function buildMissingPlaceCard() {
    const card = createElement("article", {
      className: "skyCoreLinkCard skyCoreLinkAccent"
    });
    card.append(
      createElement("h3", {
        text: "Takip konumu gerekli"
      }),
      createElement("p", {
        text:
          "Yükselen ve evler konuma bağlıdır. Today konum izni istemez; şehir seçimini sen yaparsın."
      })
    );
    const actions = createElement("div", {
      className: "skyCoreLinkActions"
    });
    appendAction(
      actions,
      "open-today",
      "Bugünün Gökyüzü’nde konum seç"
    );
    card.appendChild(actions);
    return card;
  }

  function buildLinkedActions() {
    const card = createElement("article", {
      className: "skyCoreLinkCard"
    });
    card.append(
      createElement("h3", {
        text: unlinkConfirmation
          ? "Bağlantı kaldırılsın mı?"
          : "Bağlantı yönetimi"
      }),
      createElement("p", {
        text: unlinkConfirmation
          ? "Yalnız Sky anlık görüntüsü kaldırılır; Core seçimin, rengin ve notun korunur."
          : "Bağlı anlık görüntü otomatik güncellenmez. Böylece kaydedildiği an değişmeden kalır."
      })
    );
    const actions = createElement("div", {
      className: "skyCoreLinkActions"
    });

    if (unlinkConfirmation) {
      appendAction(
        actions,
        "confirm-unlink",
        "Evet, bağlantıyı kaldır",
        { danger: true }
      );
      appendAction(
        actions,
        "cancel-unlink",
        "Vazgeç",
        { secondary: true }
      );
    } else {
      appendAction(
        actions,
        "request-unlink",
        "Bağlantıyı kaldır",
        { secondary: true }
      );
    }
    card.appendChild(actions);
    return card;
  }

  function buildHistory() {
    const today = dayApi.todayKey();
    const links = bridge
      .listLinks({ limit: 8 })
      .filter(item => item.dateKey !== today)
      .slice(0, 7);

    if (links.length === 0) return null;

    const section = createElement("section", {
      className: "skyCoreLinkCard",
      attributes: {
        "aria-labelledby": "skyCoreLinkHistoryTitle"
      }
    });
    section.append(
      createElement("h3", {
        id: "skyCoreLinkHistoryTitle",
        text: "Önceki bağlantılar"
      }),
      createElement("p", {
        text:
          "Son yedi bağlantı yalnız görüntülenir; geçmiş kayıtlar değiştirilmez."
      })
    );
    const list = createElement("div", {
      className: "skyCoreLinkHistory"
    });

    links.forEach(item => {
      const details = createElement("details", {
        className: "skyCoreLinkHistoryItem"
      });
      const choice =
        CHOICE_LABELS[item.core.choice] ||
        "Core kaydı";
      details.append(
        createElement("summary", {
          text: `${formatDateKey(item.dateKey)} · ${choice}`
        }),
        createElement("p", {
          className: "skyCoreLinkHistoryMeta",
          text:
            `${item.link.place.label} · ${item.link.sky.clock.localTime}`
        }),
        buildRows(snapshotPlacements(item.link))
      );
      list.appendChild(details);
    });
    section.appendChild(list);
    return section;
  }

  function render() {
    if (!initialized || !content) return false;
    const status = bridge.getStatus(dayApi.todayKey());
    lastStatus = status.status;
    content.replaceChildren(
      buildCoreRecordCard()
    );

    if (status.status === "ready_to_link") {
      content.appendChild(buildReadyCard());
    }

    if (status.status === "missing_place") {
      content.appendChild(buildMissingPlaceCard());
    }

    if (status.status === "linked") {
      content.append(
        buildSnapshotCard(status.link),
        buildLinkedActions()
      );
    }

    if (status.status === "invalid_link") {
      const invalid = createElement("article", {
        className: "skyCoreLinkCard"
      });
      invalid.append(
        createElement("h3", {
          text: "Bağlantı doğrulanamadı"
        }),
        createElement("p", {
          text:
            "Core kaydın korunuyor. Geçersiz Sky kopyasını kaldırıp yeniden bağlayabilirsin."
        })
      );
      const actions = createElement("div", {
        className: "skyCoreLinkActions"
      });
      appendAction(
        actions,
        "request-unlink",
        "Geçersiz bağlantıyı temizle",
        { danger: true }
      );
      invalid.appendChild(actions);
      content.appendChild(invalid);
    }

    const history = buildHistory();
    if (history) content.appendChild(history);
    content.appendChild(buildBoundaryCard());
    renderCoreSummary();
    return true;
  }

  function announce(message) {
    const status = document.getElementById(
      "skyStatus"
    );
    if (status) status.textContent = message;
  }

  function handleAction(action) {
    const dateKey = dayApi.todayKey();

    if (action === "open-core") {
      onOpenCore?.();
      return;
    }
    if (action === "open-today") {
      onOpenToday?.();
      return;
    }
    if (action === "hub") {
      onRequestHub?.();
      return;
    }
    if (action === "link") {
      const result = bridge.link(dateKey, {
        userInitiated: true
      });
      unlinkConfirmation = false;
      render();
      announce(
        result.success
          ? "Gökyüzü bugünkü Core kaydına bağlandı."
          : "Gökyüzü bağlantısı kurulamadı."
      );
      return;
    }
    if (action === "request-unlink") {
      unlinkConfirmation = true;
      render();
      return;
    }
    if (action === "cancel-unlink") {
      unlinkConfirmation = false;
      render();
      return;
    }
    if (action === "confirm-unlink") {
      bridge.unlink(dateKey, {
        userInitiated: true
      });
      unlinkConfirmation = false;
      render();
      announce(
        "Sky bağlantısı kaldırıldı; Core kaydın korundu."
      );
    }
  }

  function bindInteractions() {
    if (interactionBound) return;

    coreAction.addEventListener("click", () => {
      onOpenSelf?.();
    });

    panel.addEventListener("click", event => {
      const trigger = event.target.closest(
        "[data-core-sky-action]"
      );
      if (!trigger || !panel.contains(trigger)) return;
      handleAction(trigger.dataset.coreSkyAction);
    });

    interactionBound = true;
  }

  function bindEvents() {
    if (eventBound) return;
    const refresh = () => {
      renderCoreSummary();
      if (openState) render();
    };

    [
      "today:core-state-saved",
      "today:core-sky-link-change",
      "today:sky-observation-change"
    ].forEach(name => {
      window.addEventListener(name, refresh);
    });

    window.addEventListener(
      "today:routechange",
      event => {
        if (event.detail?.to === "pick") {
          renderCoreSummary();
        }
      }
    );
    eventBound = true;
  }

  function open(options = {}) {
    if (!initialized) return false;
    openState = true;
    unlinkConfirmation = false;
    panel.hidden = false;
    render();

    if (options.focus !== false) {
      try {
        title.focus({ preventScroll: true });
      } catch (error) {
        title.focus();
      }
    }
    return true;
  }

  function close() {
    if (!initialized) return false;
    openState = false;
    unlinkConfirmation = false;
    panel.hidden = true;
    return true;
  }

  function refresh(options = {}) {
    if (!initialized) return false;
    renderCoreSummary();
    if (openState) render();
    if (openState && options.focus === true) {
      title.focus();
    }
    return true;
  }

  function getState() {
    return Object.freeze({
      initialized,
      open: openState,
      status: lastStatus,
      bridgeApiVersion:
        bridge?.API_VERSION || null,
      contractVersion:
        bridge?.CONTRACT_VERSION || null
    });
  }

  function init(options = {}) {
    if (initialized) return getState();

    skyView = options.skyView;
    const bottomNav = options.bottomNav;
    onRequestHub = options.onRequestHub;
    onOpenToday = options.onOpenToday;
    onOpenCore = options.onOpenCore;
    onOpenSelf = options.onOpenSelf;
    bridge = window.TodayCoreSkyLink;
    dayApi = window.TodayDay;
    storage = window.TodayStorage;
    momentCore = window.TodaySkyMomentCore;

    const valid = Boolean(
      skyView &&
      bottomNav &&
      bridge &&
      typeof bridge.getStatus === "function" &&
      typeof bridge.link === "function" &&
      typeof bridge.unlink === "function" &&
      typeof bridge.listLinks === "function" &&
      dayApi &&
      typeof dayApi.todayKey === "function" &&
      storage &&
      typeof storage.getDay === "function" &&
      momentCore &&
      typeof momentCore.formatDegree === "function" &&
      typeof onRequestHub === "function" &&
      typeof onOpenToday === "function" &&
      typeof onOpenCore === "function" &&
      typeof onOpenSelf === "function"
    );

    if (!valid) {
      return Object.freeze({
        initialized: false,
        reason: "core_sky_link_dependencies_missing"
      });
    }

    const noteWrap = document.querySelector(
      '[data-view="pick"] .noteWrap'
    );
    if (!noteWrap) {
      return Object.freeze({
        initialized: false,
        reason: "core_note_surface_missing"
      });
    }

    installStyles();
    coreCard = buildCoreCard();
    panel = buildPanel();
    noteWrap.insertAdjacentElement(
      "afterend",
      coreCard
    );
    skyView.insertBefore(panel, bottomNav);
    initialized = true;
    bindInteractions();
    bindEvents();
    renderCoreSummary();
    close();
    return getState();
  }

  window.TodayCoreSkyLinkUI = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    open,
    close,
    refresh,
    getState
  });
})();
