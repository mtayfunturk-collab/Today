/**
 * Today App — Sky Periods UI
 * NUT-016.5 — Önemli Dönemler
 *
 * Devam eden ve yaklaşan uzun dönem açı pencerelerini; başlangıç,
 * tam açı ve bitiş tarihleriyle gösterir. Astrolojik yorum üretmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID =
    "today:sky:periods-ui:nut-016.5";
  const PANEL_ID = "skyPeriodsPanel";

  let initialized = false;
  let openState = false;
  let panel = null;
  let content = null;
  let title = null;
  let skyView = null;
  let profileApi = null;
  let periodsCore = null;
  let onRequestHub = null;
  let onOpenBirth = null;
  let requestToken = 0;
  let lastStatus = "idle";
  let lastPeriodCount = 0;

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

    Object.entries(options.attributes || {})
      .forEach(([name, value]) => {
        element.setAttribute(name, String(value));
      });

    return element;
  }

  function installStyles() {
    if (
      document.getElementById(
        "todaySkyPeriodsStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "todaySkyPeriodsStyles";
    style.textContent = `
      .skyPeriodsPanel {
        width: 100%; min-width: 0; max-width: 100%;
        display: grid; gap: 14px; padding-top: 2px;
      }
      .skyPeriodsPanel[hidden] { display: none !important; }
      .skyPeriodsHeader { padding: 4px 4px 2px; text-align: center; }
      .skyPeriodsMark {
        width: 54px; height: 54px; display: grid; place-items: center;
        margin: 0 auto 11px; border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke));
        border-radius: 18px; background: color-mix(in srgb, var(--sky-accent) 13%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text)); font-size: 29px;
      }
      .skyPeriodsHeader h2 { margin: 0; font-size: 23px; line-height: 1.2; letter-spacing: -.02em; }
      .skyPeriodsHeader p { max-width: 40ch; margin: 7px auto 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .skyPeriodsContent { min-width: 0; display: grid; gap: 12px; }
      .skyPeriodsCard, .skyPeriodsItem {
        min-width: 0; border: 1px solid var(--stroke); border-radius: 20px;
        background: rgba(255,255,255,.035);
      }
      .skyPeriodsCard { padding: 16px; }
      .skyPeriodsAccent {
        border-color: color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        background: linear-gradient(145deg, color-mix(in srgb, var(--sky-accent) 16%, transparent), rgba(255,255,255,.035));
      }
      .skyPeriodsCard h3, .skyPeriodsSectionTitle { margin: 0; font-size: 16px; line-height: 1.25; }
      .skyPeriodsCard p, .skyPeriodsMuted { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
      .skyPeriodsBadges { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
      .skyPeriodsBadge {
        display: inline-flex; align-items: center; min-height: 28px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 34%, var(--stroke));
        border-radius: 999px; padding: 5px 9px; color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 10px; font-weight: 850;
      }
      .skyPeriodsScope { margin-top: 11px !important; overflow-wrap: anywhere; }
      .skyPeriodsSection { min-width: 0; display: grid; gap: 9px; }
      .skyPeriodsSectionHeader { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 3px 3px 0; }
      .skyPeriodsCount { color: var(--muted); font-size: 11px; }
      .skyPeriodsList { min-width: 0; display: grid; gap: 9px; }
      .skyPeriodsItem { overflow: hidden; }
      .skyPeriodsItem summary {
        display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px;
        align-items: center; padding: 14px 15px; cursor: pointer; list-style: none;
      }
      .skyPeriodsItem summary::-webkit-details-marker { display: none; }
      .skyPeriodsItem summary::after { content: "⌄"; color: var(--muted); font-size: 15px; }
      .skyPeriodsItem[open] summary::after { content: "⌃"; }
      .skyPeriodsItemTitle { min-width: 0; display: grid; gap: 4px; }
      .skyPeriodsItemTitle strong { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
      .skyPeriodsItemTitle span { color: var(--muted); font-size: 10px; }
      .skyPeriodsItemBody { padding: 0 15px 15px; }
      .skyPeriodsTimeline {
        min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px; margin-top: 2px;
      }
      .skyPeriodsDate {
        min-width: 0; border: 1px solid color-mix(in srgb, var(--stroke) 78%, transparent);
        border-radius: 14px; padding: 10px 9px; background: rgba(255,255,255,.02);
      }
      .skyPeriodsDate small { display: block; color: var(--muted); font-size: 9px; font-weight: 750; }
      .skyPeriodsDate strong { display: block; margin-top: 4px; font-size: 10px; line-height: 1.35; overflow-wrap: anywhere; }
      .skyPeriodsExactHits { display: grid; gap: 3px; }
      .skyPeriodsMeta { margin-top: 10px !important; }
      .skyPeriodsButton {
        margin-top: 13px; border: 1px solid color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        border-radius: 14px; padding: 10px 13px; background: color-mix(in srgb, var(--sky-accent) 14%, transparent);
        color: var(--text); font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
      }
      .skyPeriodsLoading { min-height: 118px; display: grid; place-items: center; text-align: center; }
      @media (max-width: 390px) {
        .skyPeriodsTimeline { grid-template-columns: minmax(0, 1fr); }
        .skyPeriodsDate { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: start; gap: 8px; }
        .skyPeriodsDate strong { margin-top: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .skyPeriodsItem, .skyPeriodsButton { scroll-behavior: auto; transition: none !important; }
      }
    `;
    document.head.append(style);
  }

  function buildPanel() {
    const root = createElement("section", {
      className: "skyPeriodsPanel",
      id: PANEL_ID,
      attributes: {
        hidden: "",
        "aria-labelledby": "skyPeriodsTitle"
      }
    });
    const header = createElement("header", {
      className: "skyPeriodsHeader"
    });

    header.append(
      createElement("div", {
        className: "skyPeriodsMark",
        text: "◌",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("h2", {
        id: "skyPeriodsTitle",
        text: "Önemli Dönemler",
        attributes: { tabindex: "-1" }
      }),
      createElement("p", {
        text:
          "Devam eden ve yaklaşan uzun dönem açı pencerelerini tarihlerle gör."
      })
    );

    content = createElement("div", {
      className: "skyPeriodsContent",
      id: "skyPeriodsContent",
      attributes: {
        "aria-live": "polite",
        "aria-busy": "false"
      }
    });
    root.append(header, content);
    title = header.querySelector("h2");
    return root;
  }

  function formatDate(isoValue, timezoneId) {
    if (!isoValue) return null;

    try {
      return new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: timezoneId
      }).format(new Date(isoValue));
    } catch (error) {
      return new Date(isoValue)
        .toISOString()
        .slice(0, 10);
    }
  }

  function formatOrb(value) {
    if (!Number.isFinite(value)) return "—";

    const degrees = Math.floor(value);
    const minutes = Math.round(
      (value - degrees) * 60
    );

    if (minutes === 60) {
      return `${degrees + 1}° 00′`;
    }

    return (
      `${degrees}° ` +
      `${String(minutes).padStart(2, "0")}′`
    );
  }

  function makeDateCell(label, contentValue) {
    const cell = createElement("div", {
      className: "skyPeriodsDate"
    });

    cell.append(
      createElement("small", { text: label }),
      createElement("strong", { text: contentValue })
    );
    return cell;
  }

  function makeExactCell(period, timezoneId) {
    const cell = createElement("div", {
      className: "skyPeriodsDate"
    });
    const hits = createElement("div", {
      className: "skyPeriodsExactHits"
    });

    cell.append(
      createElement("small", { text: "Tam açı" })
    );

    if (period.exactHits.length === 0) {
      hits.append(
        createElement("strong", {
          text: "Bu pencerede tam temas yok"
        })
      );
    } else {
      period.exactHits.forEach((hit, index) => {
        hits.append(
          createElement("strong", {
            text:
              period.exactHits.length > 1
                ? `${index + 1}. temas · ${formatDate(hit.at, timezoneId)}`
                : formatDate(hit.at, timezoneId)
          })
        );
      });
    }

    cell.append(hits);
    return cell;
  }

  function makePeriodItem(
    period,
    timezoneId,
    index
  ) {
    const details = createElement("details", {
      className: "skyPeriodsItem",
      attributes: {
        "data-sky-period": period.id
      }
    });
    const summary = createElement("summary");
    const copy = createElement("span", {
      className: "skyPeriodsItemTitle"
    });
    const statusLabel =
      period.status === "ongoing"
        ? "Devam ediyor"
        : "Yaklaşıyor";
    const focusLabel = formatDate(
      period.focusAt,
      timezoneId
    );

    copy.append(
      createElement("strong", {
        text:
          `${period.transit.symbol} ${period.transit.label} ` +
          `${period.aspect.label} natal ` +
          `${period.natal.symbol} ${period.natal.label}`
      }),
      createElement("span", {
        text: `${statusLabel} · ${focusLabel}`
      })
    );
    summary.append(copy);

    const body = createElement("div", {
      className: "skyPeriodsItemBody"
    });
    const timeline = createElement("div", {
      className: "skyPeriodsTimeline"
    });

    timeline.append(
      makeDateCell(
        "Başlangıç",
        period.start
          ? formatDate(period.start, timezoneId)
          : "Arama aralığından önce"
      ),
      makeExactCell(period, timezoneId),
      makeDateCell(
        "Bitiş",
        period.end
          ? formatDate(period.end, timezoneId)
          : "Arama aralığından sonra"
      )
    );

    const orbText =
      period.status === "ongoing"
        ? (
            `Şu anki orb ${formatOrb(period.currentOrb)} · ` +
            `dönem eşiği ${formatOrb(period.aspect.orbLimit)}`
          )
        : `Dönem eşiği ${formatOrb(period.aspect.orbLimit)}`;

    body.append(
      timeline,
      createElement("p", {
        className: "skyPeriodsMuted skyPeriodsMeta",
        text: orbText
      })
    );
    details.append(summary, body);

    if (index === 0 && period.status === "ongoing") {
      details.open = true;
    }

    return details;
  }

  function makeSection(
    titleText,
    periods,
    timezoneId
  ) {
    const section = createElement("section", {
      className: "skyPeriodsSection"
    });
    const header = createElement("div", {
      className: "skyPeriodsSectionHeader"
    });

    header.append(
      createElement("h3", {
        className: "skyPeriodsSectionTitle",
        text: titleText
      }),
      createElement("span", {
        className: "skyPeriodsCount",
        text: String(periods.length)
      })
    );

    const list = createElement("div", {
      className: "skyPeriodsList"
    });

    if (periods.length === 0) {
      const empty = createElement("article", {
        className: "skyPeriodsCard"
      });
      empty.append(
        createElement("p", {
          className: "skyPeriodsMuted",
          text:
            titleText === "Devam eden"
              ? "Tanımlı eşiklerde devam eden dönem yok."
              : "Önümüzdeki 12 ayda tanımlı eşiklere giren dönem yok."
        })
      );
      list.append(empty);
    } else {
      periods.forEach((period, index) => {
        list.append(
          makePeriodItem(
            period,
            timezoneId,
            index
          )
        );
      });
    }

    section.append(header, list);
    return section;
  }

  function renderLoading() {
    lastStatus = "loading";
    lastPeriodCount = 0;
    content.setAttribute("aria-busy", "true");
    content.replaceChildren();

    const card = createElement("article", {
      className:
        "skyPeriodsCard skyPeriodsAccent skyPeriodsLoading"
    });
    card.append(
      createElement("p", {
        text:
          "Uzun dönem açı pencereleri cihazında hesaplanıyor…"
      })
    );
    content.append(card);
  }

  function renderUnavailable(reason) {
    lastStatus = "profile_unavailable";
    lastPeriodCount = 0;
    content.setAttribute("aria-busy", "false");
    content.replaceChildren();

    const card = createElement("article", {
      className: "skyPeriodsCard skyPeriodsAccent"
    });
    const unknownTime =
      reason === "birth_time_unknown";

    card.append(
      createElement("h3", {
        text: unknownTime
          ? "Saat bilgisi gerekli"
          : "Doğum haritası hazır değil"
      }),
      createElement("p", {
        text: unknownTime
          ? "Dönem tarihlerini yanlış kesinlikle göstermemek için kesin veya yaklaşık doğum saati gerekir."
          : "Önemli Dönemler için hesaplanabilir doğum bilgilerini tamamla."
      }),
      createElement("button", {
        className: "skyPeriodsButton",
        text: "Doğum Bilgileri’ni aç",
        type: "button",
        attributes: {
          "data-sky-periods-action": "birth"
        }
      })
    );
    content.append(card);
  }

  function renderReady(result) {
    lastStatus = "ready";
    lastPeriodCount = result.periods.length;
    content.setAttribute("aria-busy", "false");
    content.replaceChildren();

    const ongoing = result.periods.filter(
      period => period.status === "ongoing"
    );
    const upcoming = result.periods.filter(
      period => period.status === "upcoming"
    );
    const intro = createElement("article", {
      className: "skyPeriodsCard skyPeriodsAccent"
    });

    intro.append(
      createElement("h3", {
        text: "12 aylık dönem görünümü"
      }),
      createElement("p", {
        text:
          "Jüpiter–Plüton ile doğum haritandaki kişisel noktalar arasındaki temel açı pencereleri."
      })
    );

    const badges = createElement("div", {
      className: "skyPeriodsBadges",
      attributes: {
        "aria-label": "Dönem özeti"
      }
    });
    badges.append(
      createElement("span", {
        className: "skyPeriodsBadge",
        text: `${ongoing.length} devam eden`
      }),
      createElement("span", {
        className: "skyPeriodsBadge",
        text: `${upcoming.length} yaklaşan`
      }),
      createElement("span", {
        className: "skyPeriodsBadge",
        text:
          result.precision === "approximate"
            ? "Doğum saati yaklaşık"
            : "Doğum saati kesin"
      })
    );
    intro.append(
      badges,
      createElement("p", {
        className: "skyPeriodsMuted skyPeriodsScope",
        text:
          `${result.location.label} · ${result.location.timezoneId}`
      })
    );

    const boundaryNote = createElement("article", {
      className: "skyPeriodsCard"
    });
    boundaryNote.append(
      createElement("h3", {
        text: "Nasıl okunur?"
      }),
      createElement("p", {
        text:
          "Başlangıç ve bitiş, tanımlı orb eşiğini; tam açı ise geometrik temas tarihini gösterir. Bunlar sembolik zaman göstergeleridir; olay öngörüsü veya nedensellik iddiası değildir."
      })
    );

    content.append(
      intro,
      makeSection(
        "Devam eden",
        ongoing,
        result.location.timezoneId
      ),
      makeSection(
        "Yaklaşan",
        upcoming,
        result.location.timezoneId
      ),
      boundaryNote
    );
  }

  function renderError() {
    lastStatus = "error";
    lastPeriodCount = 0;
    content.setAttribute("aria-busy", "false");
    content.replaceChildren();

    const card = createElement("article", {
      className: "skyPeriodsCard"
    });
    card.append(
      createElement("h3", {
        text: "Dönemler hesaplanamadı"
      }),
      createElement("p", {
        text: "Cihaz içi hesaplamayı yeniden dene."
      }),
      createElement("button", {
        className: "skyPeriodsButton",
        text: "Yeniden dene",
        type: "button",
        attributes: {
          "data-sky-periods-action": "retry"
        }
      })
    );
    content.append(card);
  }

  function refresh(options = {}) {
    if (!initialized) return false;

    const token = ++requestToken;
    renderLoading();

    window.setTimeout(() => {
      if (!openState || token !== requestToken) {
        return;
      }

      try {
        const result = periodsCore.calculate(
          profileApi.getProfile(),
          { at: options.at }
        );

        if (token !== requestToken) return;

        if (result.status === "profile_unavailable") {
          renderUnavailable(result.reason);
          return;
        }

        if (result.status !== "ready") {
          renderError();
          return;
        }

        renderReady(result);
      } catch (error) {
        if (token === requestToken) renderError();
      }
    }, 0);

    return true;
  }

  function bindInteractions() {
    panel.addEventListener("click", event => {
      const action = event.target
        .closest("[data-sky-periods-action]")
        ?.dataset.skyPeriodsAction;

      if (action === "birth") onOpenBirth?.();
      if (action === "retry") refresh();
      if (action === "hub") onRequestHub?.();
    });

    window.addEventListener(
      "today:sky-profile-change",
      () => {
        if (openState) refresh();
      }
    );

    window.addEventListener(
      "today:routechange",
      event => {
        if (
          openState &&
          event.detail?.to !== "sky"
        ) {
          close();
        }
      }
    );
  }

  function open(options = {}) {
    if (!initialized) return false;

    panel.hidden = false;
    openState = true;
    refresh({ at: options.at });

    if (options.focus !== false) {
      try {
        title?.focus?.({ preventScroll: true });
      } catch (error) {
        title?.focus?.();
      }
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

  function getState() {
    return Object.freeze({
      initialized,
      open: openState,
      panelId: PANEL_ID,
      status: lastStatus,
      periodCount: lastPeriodCount
    });
  }

  function init(options = {}) {
    if (initialized) return getState();

    skyView = options.skyView;
    const bottomNav = options.bottomNav;
    onRequestHub = options.onRequestHub;
    onOpenBirth = options.onOpenBirth;
    profileApi = window.TodaySkyBirthProfile;
    periodsCore = window.TodaySkyPeriodsCore;
    const ready = Boolean(
      skyView &&
      bottomNav &&
      typeof onRequestHub === "function" &&
      typeof onOpenBirth === "function" &&
      typeof profileApi?.getProfile === "function" &&
      typeof periodsCore?.calculate === "function"
    );

    if (!ready) {
      return Object.freeze({
        initialized: false,
        reason: "sky_periods_dependencies_missing"
      });
    }

    installStyles();
    panel = buildPanel();
    skyView.insertBefore(panel, bottomNav);
    bindInteractions();
    initialized = true;
    return getState();
  }

  window.TodaySkyPeriodsUI = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    open,
    close,
    refresh,
    getState
  });
})();
