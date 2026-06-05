import type { ArtifactId, Locale } from "./i18n";

export type CodexEntry = {
  id: ArtifactId;
  name: string;
  era: string;
  clue: string;
  exhibit: string;
};

const codexEntries: Record<ArtifactId, Record<Locale, Omit<CodexEntry, "id">>> = {
  "badang-stone": {
    zh: {
      name: "巴当巨石碎片",
      era: "河岸传说",
      clue: "力、石、潮三道纹路合拢后，石面像重新记起了投掷巨石的故事。",
      exhibit: "展柜入口用它开场：传说从人的力量开始，也从河岸的记忆开始。"
    },
    en: {
      name: "Badang Stone Shard",
      era: "River Legend",
      clue: "When strength, stone, and tide close together, the surface recalls the thrown-stone legend.",
      exhibit: "It opens the route: the legend begins with human strength and the river's memory."
    }
  },
  "rune-plaque": {
    zh: {
      name: "狮门铭牌",
      era: "古文字碑",
      clue: "海、狮、门、月连成一句能读通的碑文，像给入口重新命名。",
      exhibit: "放在第二柜最清楚：游客能从文字转入地点，从地点转入仪式。"
    },
    en: {
      name: "Lion Gate Plaque",
      era: "Ancient Inscription",
      clue: "Sea, lion, gate, and moon become a readable inscription, as if the entrance has been named again.",
      exhibit: "It works best in the second case, guiding visitors from words to place, then to ritual."
    }
  },
  "harbor-seal": {
    zh: {
      name: "海门钥纹",
      era: "港口机关",
      clue: "朱、金、青、墨四印合一，机关里留下了通往灵界的钥纹。",
      exhibit: "第三柜承接机关线索，让展线从古碑进入真实的门。"
    },
    en: {
      name: "Harbor Gate Seal",
      era: "Harbor Mechanism",
      clue: "Cinnabar, gold, blue-green, and ink join into the key pattern left inside the lock.",
      exhibit: "The third case carries the mechanism clue, moving the route from plaque to real gate."
    }
  },
  "spirit-chime": {
    zh: {
      name: "灵界清音",
      era: "净化仪式",
      clue: "竹铃声把墨雾震散，余音被收成一件能被展出的文物。",
      exhibit: "收在末柜最完整：传说被净化后，才变成可以分享的展览。"
    },
    en: {
      name: "Spirit Chime",
      era: "Cleansing Rite",
      clue: "The bamboo chime scatters the ink fog, and its echo becomes an artifact that can be displayed.",
      exhibit: "It belongs in the final case: only after cleansing can the legend be shared."
    }
  }
};

export function getCodexEntries(locale: Locale): CodexEntry[] {
  return (Object.keys(codexEntries) as ArtifactId[]).map((id) => ({
    id,
    ...codexEntries[id][locale]
  }));
}

export function getEndingCopy(locale: Locale) {
  return locale === "en"
    ? {
        repaired:
          "With all four artifacts placed in legend order, river, plaque, harbor gate, and spirit realm form a complete exhibition route.",
        perfect:
          "Visitors pause at the Badang Stone, Lion Gate Plaque, Harbor Gate Seal, and Spirit Chime in order. The gallery route reaches full strength."
      }
    : {
        repaired: "四件文物按传说顺序入柜后，河岸、古碑、海门和灵界被串成一条完整展线。",
        perfect: "游客沿着巴当巨石、狮门铭牌、海门钥纹、灵界清音停留，展厅动线达到满分。"
      };
}
