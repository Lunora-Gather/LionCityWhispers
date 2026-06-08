export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

type TextByLocale = Record<Locale, string>;

export type ArtifactId =
  | "badang-stone"
  | "rune-plaque"
  | "harbor-seal"
  | "spirit-chime";

export type SceneKey =
  | "boot"
  | "world"
  | "jigsaw"
  | "runes"
  | "lock"
  | "rhythm"
  | "museum"
  | "dialogue"
  | "paused";

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

export function text(copy: TextByLocale, locale: Locale) {
  return copy[locale];
}

export const shellCopy = {
  zh: {
    brand: "狮城秘语",
    brandMark: "狮",
    subtitle: "Lion City Whispers",
    gameAria: "狮城秘语游戏",
    gameTitleAria: "游戏标题",
    currentObjective: "当前目标",
    nextStep: "下一步",
    controls: "游戏控制",
    codex: "线索册",
    difficultyEasy: "舒缓节奏",
    difficultyStandard: "标准节奏",
    audioOn: "开启音量",
    audioOff: "关闭音量",
    resume: "继续",
    pause: "暂停",
    restart: "重新开始",
    settings: "设置",
    progress: "进度",
    puzzles: "谜题",
    spiritClean: "灵障已净化",
    spiritBlocked: "灵障未净化",
    visitors: "游客",
    exhibitionComplete: "展览完成",
    inventory: "背包",
    inventoryEmpty: "背包空",
    resetAria: "确认重新开始",
    resetWarning: "重新开始会清空当前存档。",
    cancel: "取消",
    confirmReset: "确认重置",
    closeSettings: "关闭设置",
    difficulty: "难度",
    easy: "舒缓",
    standard: "标准",
    language: "语言",
    zh: "中文",
    en: "English",
    volume: "音量",
    masterVolume: "主音量",
    effectsVolume: "音效",
    ambientVolume: "环境声",
    mute: "静音",
    reduceMotion: "减少动画",
    performance: "性能",
    inputLatency: "本地响应",
    worstInputLatency: "最差响应",
    longFrames: "长帧",
    keyBindings: "键位",
    setKey: "设置",
    waitingKey: "按一个键",
    resetKeys: "恢复默认键位",
    moveUpBinding: "上移",
    moveDownBinding: "下移",
    moveLeftBinding: "左移",
    moveRightBinding: "右移",
    actionBinding: "交互",
    rhythmBinding: "节奏",
    chapter: "回访",
    river: "河岸",
    gallery: "展厅",
    ritual: "仪式",
    closeCodex: "关闭线索册",
    lockedArtifact: "未发现文物",
    lockedEra: "线索未收集",
    lockedClue: "展柜仍空着。",
    achievements: "成就",
    touchControls: "触控操作",
    rhythmControls: "节奏触控",
    moveUp: "上移",
    moveLeft: "左移",
    moveDown: "下移",
    moveRight: "右移",
    interact: "交互",
    lane: "轨",
    achievementLabels: {
      repaired: "完整修复",
      perfect: "满分展陈",
      ritual: "清障仪式",
      fullSet: "全套文物"
    },
    loading: "载入狮城展线",
    loadingReady: "准备进入",
    guidance: {
      start: "先靠近河岸中段的巨石碎片，修复第一件文物。",
      runes: "前往古文字碑，把碑文排回能读通的顺序。",
      lock: "调查海门机关，按色印线索打开最后一道锁。",
      ritual: "线索足够后进入灵界入口，完成竹铃仪式。",
      museum: "回到博物馆，把四件文物放入展柜形成展线。",
      complete: "展览已开幕，可在线索册查看完整修复成果。"
    },
    settingsSections: {
      experience: "体验",
      audio: "声音",
      accessibility: "辅助",
      performance: "性能",
      controls: "控制",
      revisit: "回访"
    },
    keySetNotice: "{action} 已设为 {key}。",
    keySwapNotice: "{action} 已设为 {key}，并与 {other} 交换键位。",
    ritualPaused: "仪式已暂停",
    updateReady: "新版本已缓存",
    updateNow: "立即刷新",
    endingTitle: "展览开幕",
    endingSummary: "文物、仪式和展线已经闭环。"
  },
  en: {
    brand: "Lion City Whispers",
    brandMark: "LC",
    subtitle: "狮城秘语",
    gameAria: "Lion City Whispers game",
    gameTitleAria: "Game title",
    currentObjective: "Current Objective",
    nextStep: "Next Step",
    controls: "Game Controls",
    codex: "Codex",
    difficultyEasy: "Relaxed Tempo",
    difficultyStandard: "Standard Tempo",
    audioOn: "Turn Audio On",
    audioOff: "Turn Audio Off",
    resume: "Resume",
    pause: "Pause",
    restart: "Restart",
    settings: "Settings",
    progress: "Progress",
    puzzles: "Puzzles",
    spiritClean: "Barrier Cleared",
    spiritBlocked: "Barrier Active",
    visitors: "Visitors",
    exhibitionComplete: "Exhibition Complete",
    inventory: "Inventory",
    inventoryEmpty: "Inventory Empty",
    resetAria: "Confirm Restart",
    resetWarning: "Restarting will clear the current save.",
    cancel: "Cancel",
    confirmReset: "Confirm Reset",
    closeSettings: "Close Settings",
    difficulty: "Difficulty",
    easy: "Relaxed",
    standard: "Standard",
    language: "Language",
    zh: "中文",
    en: "English",
    volume: "Volume",
    masterVolume: "Master",
    effectsVolume: "Effects",
    ambientVolume: "Ambience",
    mute: "Mute",
    reduceMotion: "Reduce Motion",
    performance: "Performance",
    inputLatency: "Local Response",
    worstInputLatency: "Worst Response",
    longFrames: "Long Frames",
    keyBindings: "Keys",
    setKey: "Set",
    waitingKey: "Press a key",
    resetKeys: "Reset Keys",
    moveUpBinding: "Move Up",
    moveDownBinding: "Move Down",
    moveLeftBinding: "Move Left",
    moveRightBinding: "Move Right",
    actionBinding: "Interact",
    rhythmBinding: "Rhythm",
    chapter: "Revisit",
    river: "River",
    gallery: "Gallery",
    ritual: "Ritual",
    closeCodex: "Close Codex",
    lockedArtifact: "Undiscovered Artifact",
    lockedEra: "Clue not collected",
    lockedClue: "The case is still empty.",
    achievements: "Achievements",
    touchControls: "Touch Controls",
    rhythmControls: "Rhythm Controls",
    moveUp: "Move Up",
    moveLeft: "Move Left",
    moveDown: "Move Down",
    moveRight: "Move Right",
    interact: "Interact",
    lane: "lane",
    achievementLabels: {
      repaired: "Full Restoration",
      perfect: "Perfect Exhibit",
      ritual: "Barrier Rite",
      fullSet: "Complete Set"
    },
    loading: "Loading exhibition route",
    loadingReady: "Ready",
    guidance: {
      start: "Begin at the stone shards near the middle of the riverbank.",
      runes: "Move to the ancient plaque and rebuild a readable inscription.",
      lock: "Investigate the harbor lock and follow the color-seal clue.",
      ritual: "When enough clues are restored, enter the spirit gate for the chime rite.",
      museum: "Return to the museum and place all four artifacts into the cases.",
      complete: "The exhibition is open. Review the restored route in the codex."
    },
    settingsSections: {
      experience: "Experience",
      audio: "Audio",
      accessibility: "Accessibility",
      performance: "Performance",
      controls: "Controls",
      revisit: "Revisit"
    },
    keySetNotice: "{action} is now {key}.",
    keySwapNotice: "{action} is now {key}; swapped with {other}.",
    ritualPaused: "Rite Paused",
    updateReady: "New version cached",
    updateNow: "Refresh",
    endingTitle: "Exhibition Open",
    endingSummary: "Artifacts, rite, and gallery route are now complete."
  }
} satisfies Record<Locale, Record<string, unknown>>;

export const sceneCopy: Record<Locale, Record<SceneKey, string>> = {
  zh: {
    boot: "启程",
    world: "河岸",
    jigsaw: "拼图",
    runes: "符文",
    lock: "机关",
    rhythm: "仪式",
    museum: "博物馆",
    dialogue: "对话",
    paused: "暂停"
  },
  en: {
    boot: "Opening",
    world: "River",
    jigsaw: "Mosaic",
    runes: "Runes",
    lock: "Harbor Lock",
    rhythm: "Ritual",
    museum: "Museum",
    dialogue: "Dialogue",
    paused: "Paused"
  }
};

export const sceneAliases: Record<string, SceneKey> = {
  MainScene: "boot",
  WorldScene: "world",
  JigsawPuzzle: "jigsaw",
  RunesPuzzle: "runes",
  LockPuzzle: "lock",
  RhythmScene: "rhythm",
  MuseumScene: "museum",
  启程: "boot",
  河岸: "world",
  拼图: "jigsaw",
  符文: "runes",
  机关: "lock",
  仪式: "rhythm",
  博物馆: "museum",
  对话: "dialogue",
  暂停: "paused"
};

export function sceneName(scene: string | SceneKey, locale: Locale) {
  const key = sceneAliases[scene] ?? (scene as SceneKey);
  return sceneCopy[locale][key] ?? scene;
}

export const artifactCopy: Record<ArtifactId, Record<Locale, { name: string; detail: string }>> = {
  "badang-stone": {
    zh: {
      name: "巴当巨石碎片",
      detail: "带着海风盐痕的石片"
    },
    en: {
      name: "Badang Stone Shard",
      detail: "A salt-worn shard carrying the river legend."
    }
  },
  "rune-plaque": {
    zh: {
      name: "狮门铭牌",
      detail: "古文字重新排成故事"
    },
    en: {
      name: "Lion Gate Plaque",
      detail: "Ancient glyphs arranged back into a story."
    }
  },
  "harbor-seal": {
    zh: {
      name: "海门钥纹",
      detail: "朱金青墨四印合一"
    },
    en: {
      name: "Harbor Gate Seal",
      detail: "Four seal colors locked into one key pattern."
    }
  },
  "spirit-chime": {
    zh: {
      name: "灵界清音",
      detail: "仪式后留下的竹铃回响"
    },
    en: {
      name: "Spirit Chime",
      detail: "A bamboo chime echo left by the cleansing rite."
    }
  }
};

export function localizedArtifact(id: ArtifactId, locale: Locale) {
  return { id, ...artifactCopy[id][locale] };
}

export const artifactGlyphCopy: Record<ArtifactId, Record<Locale, string>> = {
  "badang-stone": { zh: "石", en: "ST" },
  "rune-plaque": { zh: "文", en: "RN" },
  "harbor-seal": { zh: "钥", en: "GT" },
  "spirit-chime": { zh: "铃", en: "CH" }
};

export const stateCopy = {
  opening: {
    zh: "馆内灯火刚亮，灵界的墨痕仍在河岸游移。",
    en: "The museum lights have just come on, and ink-like traces still drift along the river."
  },
  easyOn: {
    zh: "节奏仪式放慢了，竹铃声更容易听清。",
    en: "The ritual tempo has slowed, making the bamboo chimes easier to read."
  },
  easyOff: {
    zh: "仪式恢复标准速度，灵界的回声更紧。",
    en: "The ritual has returned to standard speed, and the echoes feel tighter."
  },
  languageZh: {
    zh: "语言已切换为中文。",
    en: "Language changed to Chinese."
  },
  languageEn: {
    zh: "语言已切换为英文。",
    en: "Language changed to English."
  }
} satisfies Record<string, TextByLocale>;

export const objectiveCopy = {
  museumComplete: {
    zh: "展览已经开幕，破碎的传说被重新讲述。",
    en: "The exhibition is open, and the broken legend has been told again."
  },
  returnToMuseum: {
    zh: "回到博物馆，把所有文物拖入展柜。",
    en: "Return to the museum and place every artifact in the display cases."
  },
  goRitual: {
    zh: "前往灵界入口，完成驱散灵障的节奏仪式。",
    en: "Go to the spirit gate and complete the rhythm rite to clear the barrier."
  },
  startJigsaw: {
    zh: "在河岸寻找巴当巨石碎片，并修复第一件文物。",
    en: "Search the riverbank for the Badang stone shard and restore the first artifact."
  },
  startRunes: {
    zh: "解读古文字碑，让失落的名字回到正确顺序。",
    en: "Read the ancient plaque and place the lost names in the right order."
  },
  startLock: {
    zh: "打开海门机关，取得最后一枚展览钥纹。",
    en: "Open the harbor lock and recover the final exhibition key pattern."
  },
  continueRiver: {
    zh: "继续调查河岸遗迹，收集足够线索后进入灵界入口。",
    en: "Keep investigating the river ruins until the spirit gate responds."
  }
} satisfies Record<string, TextByLocale>;

export const worldCopy = {
  zh: {
    curator: "林馆长",
    jigsawPending: "巨石碎片",
    jigsawDone: "石片已复原",
    runesPending: "古文字碑",
    runesDone: "符文已归位",
    lockPending: "海门机关",
    lockDone: "海门已开",
    ritualPending: "灵界入口",
    ritualDone: "灵障已散",
    museum: "博物馆展厅",
    promptSuffix: "Space",
    jigsawDoneLine: "巴当巨石的裂痕已经合拢，石面浮出一段旧传说。",
    runesDoneLine: "碑面上的海、狮、门、月已经连成清晰句读。",
    lockDoneLine: "机关里只剩温热的金粉，钥纹已经收进背包。",
    ritualLockedLine: "入口仍被墨雾遮住。至少修复两段线索后，仪式才会回应。",
    ritualDoneLine: "竹铃声仍在入口回荡，灵障已经退到河面之外。",
    curatorMuseumDone: [
      "林馆长：展厅开幕了。游客不是只看见文物，也看见了它们彼此之间的顺序。",
      "林馆长：这次修复最重要的不是把碎片找回来，而是让传说重新能被讲清。"
    ],
    curatorRitualDone: [
      "林馆长：灵界入口的墨雾散了，最后一步是把四件文物放进展柜。",
      "林馆长：顺序会影响游客理解，先河岸，再碑文，再海门，最后清音。"
    ],
    curatorReadyRitual: [
      "林馆长：线索已经足够，灵界入口会回应竹铃。",
      "林馆长：别急着办展，先把墨雾驱散，否则最后一件文物不会留下。"
    ],
    curatorOnePuzzle: [
      "林馆长：第一件文物回来了，展线有了开头。",
      "林馆长：继续找碑文和机关，传说还缺能连接地点的证据。"
    ],
    curatorStart: [
      "林馆长：昨夜河岸送来三段异响，像是旧传说在敲展柜。",
      "林馆长：先从巨石碎片开始，找到第一件能放进展线的文物。"
    ]
  },
  en: {
    curator: "Curator Lin",
    jigsawPending: "Stone Shards",
    jigsawDone: "Stone Restored",
    runesPending: "Ancient Plaque",
    runesDone: "Runes Aligned",
    lockPending: "Harbor Lock",
    lockDone: "Gate Opened",
    ritualPending: "Spirit Gate",
    ritualDone: "Barrier Cleared",
    museum: "Museum Gallery",
    promptSuffix: "Space",
    jigsawDoneLine: "The Badang stone cracks have closed, and an old legend rises from the surface.",
    runesDoneLine: "Sea, lion, gate, and moon now read as a clear inscription.",
    lockDoneLine: "Only warm gold dust remains in the lock. The key pattern is in your inventory.",
    ritualLockedLine: "Ink fog still covers the gate. Restore at least two clues before the rite will answer.",
    ritualDoneLine: "The bamboo chime still rings at the gate. The barrier has retreated beyond the river.",
    curatorMuseumDone: [
      "Curator Lin: The exhibition is open. Visitors see not only artifacts, but the order between them.",
      "Curator Lin: The real restoration was not just finding fragments. It was making the legend readable again."
    ],
    curatorRitualDone: [
      "Curator Lin: The ink fog at the spirit gate is gone. Now place the four artifacts in their cases.",
      "Curator Lin: Order matters: river, inscription, harbor gate, then the final chime."
    ],
    curatorReadyRitual: [
      "Curator Lin: You have enough clues. The spirit gate will answer the bamboo chime.",
      "Curator Lin: Clear the ink fog before mounting the exhibition, or the last artifact will not remain."
    ],
    curatorOnePuzzle: [
      "Curator Lin: The first artifact is back, giving the exhibition a beginning.",
      "Curator Lin: Keep searching the plaque and the lock. The legend still needs evidence to connect its places."
    ],
    curatorStart: [
      "Curator Lin: Three echoes came from the river last night, like an old legend tapping on the cases.",
      "Curator Lin: Start with the stone shards. Find the first artifact that can anchor the exhibition."
    ]
  }
};

export const puzzleCopy = {
  zh: {
    backRiver: "返回河岸",
    jigsawTitle: "巴当巨石碎片",
    jigsawSubtitle: "把三片石纹拖回浅色轮廓。",
    jigsawClue: "石面线索：力、石、潮连成巴当传说的开端。",
    jigsawComplete: "巨石重新合拢，巴当传说的第一段被放回展柜名录。",
    jigsawReward: "文物修复完成：巴当巨石碎片",
    runesTitle: "古文字碑",
    runesSubtitle: "碑脚刻着一句话：潮来见狮，月照开门。",
    runesHint: "按环境线索把符文排成一句能读通的碑文。",
    runesEmpty: "未排序",
    runesWrong: "碑文顺序错开了，墨迹退回第一笔。",
    runesComplete: "古文字排回原位，狮门铭牌从碑心浮出。",
    runesReward: "获得文物：狮门铭牌",
    lockTitle: "海门机关",
    lockSubtitle: "门环上留着四道色印：朱、金、青、墨。",
    lockHint: "按色印从热到亮再入青墨：朱、金、青、墨。",
    lockTimeout: "机关沉入水声中，色印重新亮起。",
    lockWrong: "色印没有咬合，机关退回第一道。",
    lockComplete: "海门打开一线，朱金青墨合成了钥纹。",
    lockReward: "获得文物：海门钥纹",
    rhythmTitle: "灵界仪式",
    rhythmSubtitle: "竹铃落到判定线时按对应轨道。",
    rhythmHint: "连击会稳定灵障，错过会让清音退回。",
    rhythmEmpty: "空响",
    rhythmComplete: "竹铃声把灵障震散，清音化成可展出的灵界文物。仪式评级：{grade}。",
    rhythmReward: "仪式完成 {grade}：灵界清音已入背包",
    rhythmFail: "灵界受到干扰，竹铃需要重新对齐。",
    rhythmUnstable: "仪式未稳",
    rhythmRetry: "重试",
    museumTitle: "博物馆展厅",
    museumSubtitle: "把文物拖入发光展柜，让传说重新被看见。",
    museumEmpty: "背包里还没有可展文物",
    museumNoStory: "展厅还没有形成叙事动线。",
    museumStoryClear: "游客沿着传说顺序停留，展厅动线清晰。",
    museumStoryAdjust: "文物已经入柜，但故事顺序还可以再调整。",
    museumOpen: "所有文物入柜，狮城传说以展览的方式重新开幕。",
    museumStatusOpen: "展览开幕   游客 {visitors}",
    museumStatusCases: "展柜 {placed}/4   游客 {visitors}",
    museumVictory: "通关：狮城秘语已修复"
  },
  en: {
    backRiver: "Return to River",
    jigsawTitle: "Badang Stone Shard",
    jigsawSubtitle: "Place the three stone marks back into the pale outlines.",
    jigsawClue: "Stone clue: strength, stone, and tide begin the Badang legend.",
    jigsawComplete: "The great stone closes again, and the first Badang legend returns to the exhibition record.",
    jigsawReward: "Artifact Restored: Badang Stone Shard",
    runesTitle: "Ancient Plaque",
    runesSubtitle: "The foot of the plaque reads: tide reveals lion, moon opens gate.",
    runesHint: "Use the environment clues to arrange the glyphs into a readable inscription.",
    runesEmpty: "Unsorted",
    runesWrong: "The inscription slips out of order, and the ink retreats to the first stroke.",
    runesComplete: "The ancient glyphs return to order, and the Lion Gate Plaque rises from the stone.",
    runesReward: "Artifact Acquired: Lion Gate Plaque",
    lockTitle: "Harbor Lock",
    lockSubtitle: "Four seal colors remain on the ring: cinnabar, gold, blue-green, ink.",
    lockHint: "Press the seals from heat to light, then into blue-green and ink.",
    lockTimeout: "The lock sinks back into the water sound, and the seals light up again.",
    lockWrong: "The seals fail to catch, and the lock returns to the first mark.",
    lockComplete: "The harbor gate opens a crack, fusing the four colors into a key pattern.",
    lockReward: "Artifact Acquired: Harbor Gate Seal",
    rhythmTitle: "Spirit Rite",
    rhythmSubtitle: "Press the matching lane as each bamboo chime reaches the judgment line.",
    rhythmHint: "Combos stabilize the barrier; missed chimes pull the echo back.",
    rhythmEmpty: "EMPTY",
    rhythmComplete: "The bamboo chimes scatter the barrier, leaving a spirit artifact fit for display. Grade: {grade}.",
    rhythmReward: "Rite Complete {grade}: Spirit Chime added",
    rhythmFail: "The spirit realm is disturbed. The bamboo chimes need to align again.",
    rhythmUnstable: "Rite Unstable",
    rhythmRetry: "Retry",
    museumTitle: "Museum Gallery",
    museumSubtitle: "Place artifacts into the glowing cases so the legend can be seen again.",
    museumEmpty: "No display-ready artifacts in inventory",
    museumNoStory: "The gallery has not formed a story path yet.",
    museumStoryClear: "Visitors pause in story order. The exhibition route is clear.",
    museumStoryAdjust: "The artifacts are placed, but the story order can still improve.",
    museumOpen: "Every artifact is in its case. The Lion City legend reopens as an exhibition.",
    museumStatusOpen: "Exhibition Open   Visitors {visitors}",
    museumStatusCases: "Cases {placed}/4   Visitors {visitors}",
    museumVictory: "Complete: Lion City Whispers Restored"
  }
};

export function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}
