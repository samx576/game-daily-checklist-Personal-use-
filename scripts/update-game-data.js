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
  if (!fs.existsSync(DATA_FILE)) {
    return { games: [] };
  }

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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "game-daily-checklist/1.0",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function pickGenshinInfoFromAnnouncements(data) {
  const list =
    data?.data?.list ||
    data?.data?.announcements ||
    data?.list ||
    [];

  const items = Array.isArray(list)
    ? list.flatMap((group) => Array.isArray(group.list) ? group.list : [group])
    : [];

    const titles = items
    .map((item) => String(item.title || item.subtitle || item.name || "").trim())
    .filter(Boolean);

  console.log("Genshin announcement titles:");
  titles.slice(0, 30).forEach((title, index) => {
    console.log(`${index + 1}. ${title}`);
  });

  const versionTitle = titles.find((title) => /版本|Version/i.test(title));
  const bannerTitle = titles.find((title) => /祈願|角色|活動祈願|Wish|Banner/i.test(title));

  return {
    versionName: versionTitle || undefined,
    bannerName: bannerTitle || undefined
  };
}

async function fetchGenshinUpdate() {
  const urls = [
    "https://hk4e-api-os.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=zh-tw&bundle_id=hk4e_global&platform=pc&region=os_asia&level=60&uid=100000000",
    "https://hk4e-api-os.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=zh-cn&bundle_id=hk4e_global&platform=pc&region=os_asia&level=60&uid=100000000"
  ];

  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const picked = pickGenshinInfoFromAnnouncements(data);
      if (picked.versionName || picked.bannerName) {
        return {
          name: "原神",
          ...picked
        };
      }
    } catch (error) {
      console.warn(`Genshin fetch failed: ${error.message}`);
    }
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
