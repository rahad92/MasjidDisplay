const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

let config;
let prayerSchedule = [];
let refreshTimer;

const $ = (id) => document.getElementById(id);

async function loadJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
}

function getNow() {
  return new Date();
}

function getDatePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function apiDate(date) {
  const parts = getDatePartsInTimezone(date, config.timezone);
  return `${parts.day}-${parts.month}-${parts.year}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: config.timeFormat !== "24h"
  }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function to12Hour(time24) {
  if (!time24 || !/^\d{1,2}:\d{2}/.test(time24)) return "--:--";

  const [hours, minutes] = time24.slice(0, 5).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parseDisplayTime(timeText, baseDate = getNow()) {
  if (!timeText) return null;

  const match = timeText.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3].toUpperCase();

  if (suffix === "PM" && hour !== 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;

  const parts = getDatePartsInTimezone(baseDate, config.timezone);

  // This creates a local Date representing the wall-clock time. Countdown math
  // remains correct for the display device when it is in the mosque's timezone.
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    minute,
    0,
    0
  );
}

function addMinutes(timeText, minutes) {
  const parsed = parseDisplayTime(timeText);
  if (!parsed) return "--:--";
  parsed.setMinutes(parsed.getMinutes() + Number(minutes || 0));

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(parsed);
}

function normalizeIqamah(iqamahPayload, adhanTimes) {
  const source = iqamahPayload?.iqamah ?? iqamahPayload ?? {};

  const result = {};

  for (const prayer of PRAYERS) {
    const key = prayer.toLowerCase();
    const setting = source[key] ?? {};

    if (setting.staticTime) {
      result[prayer] = setting.staticTime;
    } else if (setting.addMinutes !== undefined) {
      result[prayer] = addMinutes(adhanTimes[prayer], setting.addMinutes);
    } else {
      result[prayer] = "--:--";
    }
  }

  result.Jumuah =
    source.jumuah?.staticTime ??
    (source.jumuah?.addMinutes !== undefined
      ? addMinutes(adhanTimes.Dhuhr, source.jumuah.addMinutes)
      : "--:--");

  return result;
}

function renderTimes(adhan, iqamah) {
  for (const prayer of PRAYERS) {
    $(`${prayer}-adhan`).textContent = adhan[prayer] ?? "--:--";
    $(`${prayer}-iqamah`).textContent = iqamah[prayer] ?? "--:--";
  }

  $("Sunrise-adhan").textContent = adhan.Sunrise ?? "--:--";
  $("Jumuah-iqamah").textContent = iqamah.Jumuah ?? "--:--";

  prayerSchedule = PRAYERS.map((name) => ({
    name,
    timeText: adhan[name],
    date: parseDisplayTime(adhan[name])
  })).filter((item) => item.date);
}

function renderDates(apiData) {
  $("gregorianDate").textContent = formatLongDate(getNow());

  const hijri = apiData?.date?.hijri;
  if (hijri) {
    $("hijriDate").textContent =
      `${hijri.weekday?.en ?? ""} • ${hijri.day} ${hijri.month?.en} ${hijri.year} AH`;
  }
}

function updateClock() {
  const now = getNow();
  $("clock").textContent = formatClock(now);
  $("gregorianDate").textContent = formatLongDate(now);
  updateNextPrayer(now);
}

function updateNextPrayer(now) {
  if (!prayerSchedule.length) return;

  document.querySelectorAll(".prayer-row[data-prayer]").forEach((row) => {
    row.classList.remove("next");
  });

  let next = prayerSchedule.find((item) => item.date > now);

  if (!next) {
    next = {
      ...prayerSchedule[0],
      date: new Date(prayerSchedule[0].date.getTime() + 24 * 60 * 60 * 1000)
    };
  }

  const difference = Math.max(0, next.date - now);
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  const seconds = Math.floor((difference % 60_000) / 1_000);

  $("nextPrayer").textContent = next.name;
  $("nextPrayerTime").textContent = next.timeText;
  $("countdown").textContent =
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;

  document
    .querySelector(`.prayer-row[data-prayer="${next.name}"]`)
    ?.classList.add("next");
}

async function loadAnnouncements() {
  try {
    const data = await loadJson("data/announcements.json");
    const messages = data.announcements?.filter(Boolean) ?? [];
    $("ticker").textContent = messages.join("   •   ");
  } catch (error) {
    console.warn("Announcements could not be loaded.", error);
  }
}

async function refreshPrayerData() {
  const status = $("status");

  try {
    status.textContent = "Updating…";
    status.className = "status";

    const date = apiDate(getNow());
    const adhanUrl =
      `${config.adhanApiBaseUrl}/${date}` +
      `?city=${encodeURIComponent(config.city)}` +
      `&country=${encodeURIComponent(config.country)}` +
      `&method=${encodeURIComponent(config.calculationMethod)}`;

    const [adhanResponse, iqamahResponse] = await Promise.all([
      loadJson(adhanUrl),
      loadJson(config.iqamahApiUrl)
    ]);

    const timings24 = adhanResponse?.data?.timings;
    if (!timings24) {
      throw new Error("Adhan API response did not contain timings.");
    }

    const adhan = {
      Fajr: to12Hour(timings24.Fajr),
      Sunrise: to12Hour(timings24.Sunrise),
      Dhuhr: to12Hour(timings24.Dhuhr),
      Asr: to12Hour(timings24.Asr),
      Maghrib: to12Hour(timings24.Maghrib),
      Isha: to12Hour(timings24.Isha)
    };

    const iqamah = normalizeIqamah(iqamahResponse, adhan);

    renderTimes(adhan, iqamah);
    renderDates(adhanResponse.data);
    updateNextPrayer(getNow());

    const refreshedAt = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(getNow());

    status.textContent = `Live • Updated ${refreshedAt}`;
    status.className = "status ok";

    localStorage.setItem(
      "masjidDisplayLastData",
      JSON.stringify({ adhan, iqamah, apiData: adhanResponse.data })
    );
  } catch (error) {
    console.error(error);
    status.textContent = "Offline • showing last saved schedule";
    status.className = "status error";

    const cached = localStorage.getItem("masjidDisplayLastData");
    if (cached) {
      const { adhan, iqamah, apiData } = JSON.parse(cached);
      renderTimes(adhan, iqamah);
      renderDates(apiData);
    }
  }
}

async function init() {
  try {
    config = await loadJson("config/config.json");

    const mosqueNameElement = $("mosqueName");
    const mosqueSubtitleElement = $("mosqueSubtitle");

    if (mosqueNameElement) {
      mosqueNameElement.textContent = config.mosqueName;
    }

    if (mosqueSubtitleElement) {
      mosqueSubtitleElement.textContent = config.mosqueSubtitle ?? "";
    }

    await loadAnnouncements();
    await refreshPrayerData();

    updateClock();
    window.setInterval(updateClock, 1000);

    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(
      refreshPrayerData,
      Math.max(1, Number(config.refreshMinutes || 5)) * 60_000
    );

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshPrayerData();
    });
  } catch (error) {
    console.error(error);
    $("status").textContent = "Configuration error";
    $("status").className = "status error";
  }
}

init();
