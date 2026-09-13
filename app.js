const KEY = "drappy_v3";
const ORIGINAL_BG = "#07111f";

// --- Push (notifications même app fermée) ------------------------------
// Renseigne ces deux valeurs une fois ton backend déployé (voir backend/README.md).
const VAPID_PUBLIC_KEY = "BIFTKmPOhX77M0Fae3Y500668LYfEh8oRGqx0XB0ZUrBSVmKYos3JFqokXYq74y5lC12nbGUqHMpA_T9oFK2b8c";
const BACKEND_URL = ""; // ex. "https://drappy-backend.vercel.app" — vide = push désactivé

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function getDeviceId() {
  let id = localStorage.getItem("drappy_device_id");
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
    localStorage.setItem("drappy_device_id", id);
  }
  return id;
}

// Envoie (ou renvoie) l'abonnement push au backend avec l'état actuel du
// cycle, pour que la vérification périodique côté serveur sache quand
// notifier. Ne fait rien si aucun backend n'est configuré.
async function syncPushSubscription() {
  if (!BACKEND_URL || !state.notifications) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        subscription: sub,
        interval: state.interval,
        lastChanged: state.lastChanged
      })
    });
  } catch (err) {
    console.error("Abonnement push impossible :", err);
  }
}

async function removePushSubscription() {
  if (!BACKEND_URL) return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() })
    });
  } catch (err) {
    console.error("Désabonnement push impossible :", err);
  }
}
// -------------------------------------------------------------------------

const defaults = {
  name: "",
  interval: 21,
  notifications: false,
  bg: ORIGINAL_BG,
  lastChanged: null,
  snoozeUntil: null,
  history: []
};

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) return normalize(saved);

    const legacy = JSON.parse(
      localStorage.getItem("drappy_v2") ||
      localStorage.getItem("drappy_v1") ||
      "null"
    );
    return legacy ? normalize(legacy) : {...defaults};
  } catch {
    return {...defaults};
  }
}

function normalize(data) {
  const clean = {...defaults, ...(data || {})};
  delete clean.sheet;
  clean.history = Array.isArray(clean.history) ? clean.history : [];
  clean.interval = Math.max(1, Math.min(365, Number(clean.interval) || 21));
  return clean;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  render();
}

function daysAgo(date) {
  return date
    ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
    : 0;
}

function fmt(date) {
  return date
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date(date))
    : "—";
}

function deadline() {
  if (!state.lastChanged) return null;
  const d = new Date(state.lastChanged);
  d.setDate(d.getDate() + Number(state.interval));
  return d;
}

function due() {
  const d = deadline();
  const snooze = state.snoozeUntil ? new Date(state.snoozeUntil) : null;
  return d &&
    Date.now() >= d.getTime() &&
    (!snooze || Date.now() >= snooze.getTime());
}

function daysUntil() {
  const d = deadline();
  return d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return {r: 7, g: 17, b: 31};
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function rgb(r, g, b) {
  return `rgb(${r} ${g} ${b})`;
}

function setThemeColor(hex) {
  const meta = document.getElementById("themeColorMeta");
  if (meta) meta.setAttribute("content", hex);
}

function harmonizeTheme(hex) {
  setThemeColor(hex);
  const {r, g, b} = hexToRgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const cardFactor = lum > 0.55 ? 0.80 : 1.48;
  const lineFactor = lum > 0.55 ? 0.58 : 1.75;

  document.documentElement.style.setProperty(
    "--card",
    rgb(
      Math.min(255, Math.round(r * cardFactor)),
      Math.min(255, Math.round(g * cardFactor)),
      Math.min(255, Math.round(b * cardFactor))
    )
  );

  document.documentElement.style.setProperty(
    "--line",
    rgb(
      Math.min(255, Math.round(r * lineFactor)),
      Math.min(255, Math.round(g * lineFactor)),
      Math.min(255, Math.round(b * lineFactor))
    )
  );

  document.documentElement.style.setProperty(
    "--soft",
    rgb(mix(r, 255, .08), mix(g, 255, .08), mix(b, 255, .08))
  );

  document.documentElement.style.setProperty(
    "--accent",
    rgb(mix(r, 255, .84), mix(g, 255, .84), mix(b, 255, .84))
  );

  document.documentElement.style.setProperty(
    "--accentText",
    "#07111f"
  );

  // The settings panel and its controls follow the same selected background hue.
  const panelFactor = lum > 0.55 ? 0.88 : 1.28;
  const inputFactor = lum > 0.55 ? 0.96 : 1.48;
  const switchFactor = lum > 0.55 ? 0.70 : 1.95;

  document.documentElement.style.setProperty(
    "--panel",
    rgb(
      Math.min(255, Math.round(r * panelFactor)),
      Math.min(255, Math.round(g * panelFactor)),
      Math.min(255, Math.round(b * panelFactor))
    )
  );

  document.documentElement.style.setProperty(
    "--input",
    rgb(
      Math.min(255, Math.round(r * inputFactor)),
      Math.min(255, Math.round(g * inputFactor)),
      Math.min(255, Math.round(b * inputFactor))
    )
  );

  document.documentElement.style.setProperty(
    "--switch",
    rgb(
      Math.min(255, Math.round(r * switchFactor)),
      Math.min(255, Math.round(g * switchFactor)),
      Math.min(255, Math.round(b * switchFactor))
    )
  );
}

// Géométrie du lit (voir styles.css) : la progression "monte" sur toute la
// hauteur du lit, de sorte que le remplissage atteigne aussi le drap du
// dessous et les oreillers en toute fin de cycle.
const MAIN_BED_GEO = {
  total: 230,
  coverH: 203, coverGap: 0,
  pillowH: 35, pillowGap: 195,
  frameH: 210, frameGap: 8
};
const PREVIEW_BED_GEO = {
  total: 173,
  coverH: 152, coverGap: 0,
  pillowH: 26, pillowGap: 147,
  frameH: 158, frameGap: 5
};

function bedFillHeights(pct, geo) {
  const waterline = Math.min(1, Math.max(0, pct / 100)) * geo.total;
  return {
    cover: Math.min(geo.coverH, Math.max(0, waterline - geo.coverGap)),
    pillow: Math.min(geo.pillowH, Math.max(0, waterline - geo.pillowGap)),
    frame: Math.min(geo.frameH, Math.max(0, waterline - geo.frameGap))
  };
}

function applyBedFill(ids, pct, geo) {
  const { cover, pillow, frame } = bedFillHeights(pct, geo);
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.style.height = `${value}px`;
  };
  set(ids.cover, cover);
  set(ids.pillowA, pillow);
  set(ids.pillowB, pillow);
  set(ids.frame, frame);
}

function render() {
  document.documentElement.style.setProperty("--bg", state.bg);
  harmonizeTheme(state.bg);

  document.getElementById("welcome").textContent =
    state.name ? `Bienvenue sur Drappy, ${state.name}` : "Bienvenue sur Drappy";

  const elapsed = state.lastChanged ? daysAgo(state.lastChanged) : 0;
  const pct = state.lastChanged
    ? Math.min(100, Math.max(0, elapsed / Number(state.interval) * 100))
    : 0;

  applyBedFill(
    { cover: "bedFill", pillowA: "pillowFillA", pillowB: "pillowFillB", frame: "bedFrameFill" },
    pct, MAIN_BED_GEO
  );

  // Very subtle outline at the beginning; it becomes only slightly clearer over time.
  document.documentElement.style.setProperty(
    "--bed-opacity",
    (0.16 + pct / 100 * 0.20).toFixed(3)
  );

  // Keep the pillows unchanged until the white fill reaches their zone,
  // then progressively darken only their outlines so they remain legible.
  const pillowStart = 72;
  const pillowEnd = 91;
  const pillowContrast = Math.min(
    1,
    Math.max(0, (pct - pillowStart) / (pillowEnd - pillowStart))
  );
  document.documentElement.style.setProperty(
    "--pillow-contrast",
    pillowContrast.toFixed(3)
  );

  const pill = document.getElementById("statusPill");
  const title = document.getElementById("statusTitle");
  const st = document.getElementById("statusText");
  const nx = document.getElementById("nextText");

  st.textContent = state.lastChanged
    ? `Dernier changement : ${fmt(state.lastChanged)}`
    : "Dernier changement : pas encore enregistré";

  const remaining = daysUntil();

  if (due()) {
    pill.textContent = "À faire";
    title.textContent = "Il est temps de changer les draps";
    nx.textContent = `Le cycle de ${state.interval} jours est arrivé à échéance.`;
    document.getElementById("reminderCard").classList.remove("hidden");
  } else {
    document.getElementById("reminderCard").classList.add("hidden");

    if (!state.lastChanged) {
      pill.textContent = "Prêt";
      title.textContent = "Commence ton premier cycle";
      nx.textContent = "Appuie sur « Draps changés » après ton prochain changement.";
    } else if (remaining <= 0) {
      pill.textContent = "Reporté";
      title.textContent = "Rappel repoussé";
      nx.textContent = `Nouveau rappel : ${fmt(state.snoozeUntil)}`;
    } else {
      pill.textContent = "À jour";
      title.textContent = "Tes draps sont encore frais";
      nx.textContent =
        `Prochain changement : ${remaining} jour${remaining > 1 ? "s" : ""}`;
    }
  }

  const list = state.history || [];
  document.getElementById("historyList").innerHTML = list.length
    ? list.slice(0, 8).map((x, i) => `
      <div class="history-item">
        <span>Draps changés</span>
        <span class="history-date">
          <span>${fmt(x)}</span>
          <button class="delete-history" data-history="${i}"
            aria-label="Supprimer ce changement" title="Supprimer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/>
            </svg>
          </button>
        </span>
      </div>`).join("")
    : `<div class="history-item"><span>Aucun changement enregistré</span><span>—</span></div>`;

  document.querySelectorAll("[data-history]").forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.history);
      if (!Number.isInteger(index) || !state.history[index]) return;

      state.history.splice(index, 1);

      // The first item is the current reference. If it disappears,
      // the next recorded change automatically becomes the reference.
      if (index === 0) {
        state.lastChanged = state.history[0] || null;
        state.snoozeUntil = null;
      }

      save();
      toast("Changement supprimé");
    };
  });

  if (document.getElementById("settingsSheet").classList.contains("hidden")) {
    settingsDraftBg = state.bg;
    settingsDraftInterval = state.interval;
    const nameInput = document.getElementById("nameInput");
    if (nameInput) nameInput.value = state.name;
    document.getElementById("intervalInput").value = state.interval;
    document.getElementById("notifInput").checked = state.notifications;
  }
}

function markDone() {
  const now = new Date().toISOString();
  state.lastChanged = now;
  state.snoozeUntil = null;
  state.history = [now, ...(state.history || [])];
  save();
  toast("Draps enregistrés");
  syncPushSubscription();
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("Notifications non disponibles ici");
    return false;
  }

  const permission = await Notification.requestPermission();
  state.notifications = permission === "granted";
  return state.notifications;
}

function scheduleLocalHint() {
  if (
    state.notifications &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    due()
  ) {
    new Notification("Drappy", {
      body: "C’est le moment de changer tes draps."
    });
  }
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

document.getElementById("doneBtn").onclick = markDone;

function updateSwatchActive(hex) {
  const normalized = String(hex || "").toLowerCase();
  document.querySelectorAll(".swatch[data-color]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.color.toLowerCase() === normalized);
  });
}

function updateSettingsBedPreview() {
  const interval = Math.max(1, Math.min(365, Number(settingsDraftInterval) || 21));
  const elapsed = state.lastChanged ? daysAgo(state.lastChanged) : 0;
  const pct = state.lastChanged
    ? Math.min(100, Math.max(0, elapsed / interval * 100))
    : 0;
  applyBedFill(
    { cover: "settingsBedFill", pillowA: "previewPillowFillA", pillowB: "previewPillowFillB", frame: "settingsFrameFill" },
    pct, PREVIEW_BED_GEO
  );
}

function updatePillowContrast(pct) {
  const start = 72, end = 91;
  const value = Math.min(1, Math.max(0, (pct - start) / (end - start)));
  document.documentElement.style.setProperty("--pillow-contrast", value.toFixed(3));
}

function previewSettingsBg(value) {
  settingsDraftBg = value;
  document.documentElement.style.setProperty("--bg", settingsDraftBg);
  harmonizeTheme(settingsDraftBg);
  const bgInput = document.getElementById("bgInput");
  if (bgInput) bgInput.value = settingsDraftBg;
  updateSwatchActive(settingsDraftBg);
}

document.getElementById("settingsBtn").onclick = () => {
  settingsDraftBg = state.bg;
  settingsDraftInterval = state.interval;
  document.getElementById("nameInput").value = state.name;
  document.getElementById("intervalInput").value = state.interval;
  document.getElementById("notifInput").checked = state.notifications;
  document.getElementById("bgInput").value = state.bg;
  updateSwatchActive(state.bg);
  updateSettingsBedPreview();
  document.getElementById("settingsSheet").classList.remove("hidden");
};

document.getElementById("closeSettings").onclick = () => {
  settingsDraftBg = state.bg;
  settingsDraftInterval = state.interval;
  document.documentElement.style.setProperty("--bg", state.bg);
  harmonizeTheme(state.bg);
  document.getElementById("settingsSheet").classList.add("hidden");
};

document.querySelectorAll(".swatch[data-color]").forEach(btn => {
  btn.onclick = () => previewSettingsBg(btn.dataset.color);
});

document.getElementById("bgInput").addEventListener("input", e => {
  previewSettingsBg(e.target.value);
});

document.getElementById("resetBgBtn").onclick = () => {
  previewSettingsBg(ORIGINAL_BG);
  toast("Bleu minuit rétabli");
};

document.getElementById("intervalInput").addEventListener("input", e => {
  const value = Number(e.target.value);
  if (!Number.isFinite(value)) return;
  settingsDraftInterval = Math.max(1, Math.min(365, value));

  const elapsed = state.lastChanged ? daysAgo(state.lastChanged) : 0;
  const pct = state.lastChanged
    ? Math.min(100, Math.max(0, elapsed / settingsDraftInterval * 100))
    : 0;

  applyBedFill(
    { cover: "bedFill", pillowA: "pillowFillA", pillowB: "pillowFillB", frame: "bedFrameFill" },
    pct, MAIN_BED_GEO
  );
  updatePillowContrast(pct);
  updateSettingsBedPreview();
});

document.getElementById("saveSettings").onclick = async () => {
  state.name = document.getElementById("nameInput").value.trim();
  settingsDraftInterval = Math.max(
    1,
    Math.min(365, Number(document.getElementById("intervalInput").value) || state.interval || 21)
  );
  state.interval = settingsDraftInterval;
  state.bg = settingsDraftBg;

  const wantsNotifications =
    document.getElementById("notifInput").checked;

  if (wantsNotifications) {
    await enableNotifications();
    await syncPushSubscription();
  } else {
    if (state.notifications) await removePushSubscription();
    state.notifications = false;
  }

  save();
  document.getElementById("settingsSheet").classList.add("hidden");
  document.documentElement.style.setProperty("--bg", state.bg);
  harmonizeTheme(state.bg);
  toast("Réglages enregistrés");
};

document.querySelectorAll("[data-snooze]").forEach(button => {
  button.onclick = () => {
    const d = new Date();
    d.setDate(d.getDate() + Number(button.dataset.snooze));
    state.snoozeUntil = d.toISOString();
    save();
    toast(`Rappel repoussé de ${button.textContent}`);
  };
});

// Si l'app est ouverte via le raccourci NFC (URL suivie de ?nfc=draps),
// on enregistre le changement automatiquement, sans appui manuel.
function handleNfcTrigger() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("nfc") !== "draps") return;

  markDone();

  // Nettoie l'URL pour qu'un simple rechargement ne ré-enregistre pas.
  const url = new URL(window.location.href);
  url.searchParams.delete("nfc");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

window.addEventListener("load", () => {
  render();
  handleNfcTrigger();
  syncPushSubscription();
  setInterval(() => {
    render();
    scheduleLocalHint();
  }, 60000);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(reg => reg.update())
    .catch(() => {});
}

render();
