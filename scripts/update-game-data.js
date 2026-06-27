const fs = require("fs");

const DATA_FILE = "game-data.json";
const BWIKI_Genshin_BANNER_URL = "https://wiki.biligame.com/ys/%E5%8D%A1%E6%B1%A0%E8%AE%A1%E6%97%B6%E5%99%A8";

const fallbackGames = [
  {
    name: "原神",
    aliases: ["Genshin Impact", "Genshin"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前角色卡池",
    bannerEndDate: "",
    bannerEndTime: "17:59",
    versionEventDone: false
  },
  {
    name: "崩壞：星穹鐵道",
    aliases: ["星鐵", "崩鐵", "Honkai: Star Rail", "HSR"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前角色卡池",
    bannerEndDate: "",
    bannerEndTime: "11:59",
    versionEventDone: false
  },
  {
    name: "絕區零",
    aliases: ["絕區", "ZZZ", "Zenless Zone Zero"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前角色卡池",
    bannerEndDate: "",
    bannerEndTime: "11:59",
    versionEventDone: false
  },
  {
    name: "鳴潮",
    aliases: ["Wuthering Waves", "WuWa"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前角色卡池",
    bannerEndDate: "",
    bannerEndTime: "23:59",
    versionEventDone: false
  },
  {
    name: "明日方舟：終末地",
    aliases: ["終末地", "明日方舟終末地", "Arknights: Endfield", "Endfield", "Arknights"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前卡池或活動",
    bannerEndDate: "",
    bannerEndTime: "23:59",
    versionEventDone: false
  },
  {
    name: "異環",
    aliases: ["Ananta"],
    versionName: "請填目前版本",
    versionEndDate: "",
    bannerName: "請填目前活動或卡池",
    bannerEndDate: "",
    bannerEndTime: "23:59",
    versionEventDone: false
  }
];

function readCurrentData() {
  if (!fs.existsSync(DATA_FILE)) return { games: [] };

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.warn(`Cannot read ${DATA_FILE}: ${error.message}`);
    return { games: [] };
  }
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function sameGame(left, right) {
  return normalizeName(left) === normalizeName(right);
}

function mergeGame(base, update) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(update || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
    )
  };
}

function findCurrentGame(currentGames, game) {
  const names = [game.name, ...(game.aliases || [])];
  return currentGames.find((current) => {
    const currentNames = [current.name, ...(current.aliases || [])];
    return names.some((name) => currentNames.some((currentName) => sameGame(name, currentName)));
  });
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 game-daily-checklist/1.0",
        "Accept": "text/html,application/xhtml+xml,*/*"
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToLines(html) {
  const text = decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "\n");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isCharacterNameLine(line) {
  if (!line || line.length > 12) return false;
  if (/^(UP|Image|计时|正在进行|五星|四星|复刻|排序|注：|卡池|本文|测试|展开|折叠)/.test(line)) return false;
  if (/[：:\/\\{}|[\]]/.test(line)) return false;
  return /[\u4e00-\u9fff]/.test(line);
}

function parseRemainingTime(line) {
  const match = String(line || "").match(/剩余(?:(\d+)天)?(?:(\d+)小时)?(?:(\d+)分钟)?/);
  if (!match) return null;

  return {
    days: Number(match[1] || 0),
    hours: Number(match[2] || 0),
    minutes: Number(match[3] || 0)
  };
}

function formatTaipeiDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`
  };
}

function parseBwikiGenshinBanner(html) {
  const lines = htmlToLines(html);
  const currentEntries = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("正在进行")) continue;

    const remaining = parseRemainingTime(lines[index]);
    const window = lines.slice(index + 1, index + 18);
    const name = window.find(isCharacterNameLine);
    const version = window.find((line) => line.startsWith("UP版本"))?.replace(/^UP版本[：:]\s*/, "");
    const startDate = window.find((line) => line.startsWith("UP时间"))?.replace(/^UP时间[：:]\s*/, "");

    if (name) currentEntries.push({ name, version, startDate, remaining });
  }

  if (!currentEntries.length) {
    console.warn("BWIKI Genshin banner: no current entries found.");
    return null;
  }

  const names = [...new Set(currentEntries.map((entry) => entry.name))];
  const version = currentEntries.find((entry) => entry.version)?.version;
  const firstRemaining = currentEntries.find((entry) => entry.remaining)?.remaining;
  const update = {
    name: "原神",
    versionName: version,
    bannerName: `${version ? `${version}：` : ""}${names.join(" / ")}`
  };

  if (firstRemaining) {
    const end = new Date(
      Date.now() +
        firstRemaining.days * 24 * 60 * 60 * 1000 +
        firstRemaining.hours * 60 * 60 * 1000 +
        firstRemaining.minutes * 60 * 1000
    );
    const formatted = formatTaipeiDateTime(end);
    update.bannerEndDate = formatted.date;
    update.bannerEndTime = formatted.time;
  }

  console.log(`BWIKI Genshin current banner: ${update.bannerName}`);
  if (update.bannerEndDate) console.log(`BWIKI Genshin banner ends: ${update.bannerEndDate} ${update.bannerEndTime}`);
  return update;
}

async function fetchGenshinUpdate() {
  try {
    const html = await fetchText(BWIKI_Genshin_BANNER_URL);
    return parseBwikiGenshinBanner(html);
  } catch (error) {
    console.warn(`BWIKI Genshin fetch failed: ${error.message}`);
    return null;
  }
}

async function buildGameData() {
  const currentData = readCurrentData();
  const currentGames = Array.isArray(currentData.games) ? currentData.games : [];
  const updates = [];

  const genshinUpdate = await fetchGenshinUpdate();
  if (genshinUpdate) updates.push(genshinUpdate);

  const games = fallbackGames.map((fallback) => {
    const current = findCurrentGame(currentGames, fallback) || {};
    const update = updates.find((item) => sameGame(item.name, fallback.name)) || {};
    return mergeGame(mergeGame(fallback, current), update);
  });

  return {
    updatedAt: new Date().toISOString(),
    note: "這份資料由 GitHub Actions 自動更新。原神目前嘗試從 BWIKI 卡池計時器抓取。",
    games
  };
}

buildGameData()
  .then((output) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");
    console.log(`Updated ${DATA_FILE}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
