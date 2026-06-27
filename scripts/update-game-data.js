const fs = require("fs");

const DATA_FILE = "game-data.json";

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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 game-daily-checklist/1.0",
        "Accept": options.accept || "application/json,text/plain,*/*",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, { accept: "application/json,text/plain,*/*" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url, { accept: "text/html,application/xhtml+xml,*/*" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function extractAnnouncementTitlesFromJson(data) {
  const list = data?.data?.list || data?.data?.announcements || data?.list || [];
  const items = Array.isArray(list)
    ? list.flatMap((group) => Array.isArray(group.list) ? group.list : [group])
    : [];
  return unique(items.map((item) => item.title || item.subtitle || item.name));
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractAnnouncementTitlesFromHtml(html) {
  const text = decodeHtml(html);
  const titles = [];
  const titlePatterns = [
    /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/gi,
    /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi
  ];

  for (const pattern of titlePatterns) {
    for (const match of text.matchAll(pattern)) {
      const title = match[1]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\"/g, "\"")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (title && !/Genshin Impact|原神$|HoYoverse/i.test(title)) titles.push(title);
    }
  }

  return unique(titles);
}

function pickGenshinInfoFromTitles(titles) {
  console.log("Genshin announcement titles:");
  titles.slice(0, 30).forEach((title, index) => console.log(`${index + 1}. ${title}`));

  const versionTitle = titles.find((title) => /版本|Version|Version Update/i.test(title));
  const bannerTitle = titles.find((title) => /祈願|角色|活動祈願|Wish|Banner|Event Wish/i.test(title));

  return {
    versionName: versionTitle || undefined,
    bannerName: bannerTitle || undefined
  };
}

async function fetchGenshinAnnouncementApiUpdate() {
  const urls = [
    "https://hk4e-api-os.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=zh-tw&bundle_id=hk4e_global&platform=pc&region=os_asia&level=60&uid=100000000",
    "https://hk4e-api-os.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=zh-cn&bundle_id=hk4e_global&platform=pc&region=os_asia&level=60&uid=100000000"
  ];

  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const titles = extractAnnouncementTitlesFromJson(data);
      if (titles.length) return pickGenshinInfoFromTitles(titles);
    } catch (error) {
      console.warn(`Genshin API fetch failed: ${error.message}`);
    }
  }

  return null;
}

async function fetchGenshinNewsPageUpdate() {
  const urls = [
    "https://genshin.hoyoverse.com/zh-tw/news",
    "https://genshin.hoyoverse.com/en/news"
  ];

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const titles = extractAnnouncementTitlesFromHtml(html);
      if (titles.length) return pickGenshinInfoFromTitles(titles);
      console.warn(`Genshin news page had no extractable titles: ${url}`);
    } catch (error) {
      console.warn(`Genshin news page fetch failed: ${error.message}`);
    }
  }

  return null;
}

async function fetchGenshinUpdate() {
  const fromApi = await fetchGenshinAnnouncementApiUpdate();
  if (fromApi?.versionName || fromApi?.bannerName) {
    return { name: "原神", ...fromApi };
  }

  const fromNewsPage = await fetchGenshinNewsPageUpdate();
  if (fromNewsPage?.versionName || fromNewsPage?.bannerName) {
    return { name: "原神", ...fromNewsPage };
  }

  return null;
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
    note: "這份資料由 GitHub Actions 自動更新。抓不到資料時會保留現有資料。",
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
