import type { ArtifactId, Locale } from "./i18n";

export type CodexEntry = {
  id: ArtifactId;
  name: string;
  era: string;
  clue: string;
  exhibit: string;
  history: string;
};

const codexEntries: Record<ArtifactId, Record<Locale, Omit<CodexEntry, "id">>> = {
  "badang-stone": {
    zh: {
      name: "巴当巨石碎片",
      era: "河岸传说",
      clue: "力、石、潮三道纹路合拢后，石面像重新记起了投掷巨石的故事。",
      exhibit: "展柜入口用它开场：传说从人的力量开始，也从河岸的记忆开始。",
      history: "源自新加坡石（Singapore Stone）的传说。根据《马来纪年》记载，大力士巴当（Badang）曾在这里将巨石投入新加坡河口，以向外邦使者展示非凡神力并保卫国土。"
    },
    en: {
      name: "Badang Stone Shard",
      era: "River Legend",
      clue: "When strength, stone, and tide close together, the surface recalls the thrown-stone legend.",
      exhibit: "It opens the route: the legend begins with human strength and the river's memory.",
      history: "Originates from the legend of the Singapore Stone. According to the Malay Annals, the legendary strongman Badang threw a massive boulder into the mouth of the Singapore River to demonstrate his superhuman strength and protect the realm."
    }
  },
  "rune-plaque": {
    zh: {
      name: "狮门铭牌",
      era: "古文字碑",
      clue: "海、狮、门、月连成一句能读通的碑文，像给入口重新命名。",
      exhibit: "放在第二柜最清楚：游客能从文字转入地点，从地点转入仪式。",
      history: "铭刻着神秘文字的古老石碑。真实原型为新加坡石上的未解刻印，使用了古爪哇文或梵文，记录着苏门答腊巨港室利佛逝王朝时期的神圣誓言与地点变迁。"
    },
    en: {
      name: "Lion Gate Plaque",
      era: "Ancient Inscription",
      clue: "Sea, lion, gate, and moon become a readable inscription, as if the entrance has been named again.",
      exhibit: "It works best in the second case, guiding visitors from words to place, then to ritual.",
      history: "An ancient stone tablet inscribed with mysterious runes. The real-world inspiration is the Singapore Stone's undeciphered inscriptions, written in ancient Javanese or Sanskrit, recording sacred oaths and geographic changes during the Srivijaya dynasty."
    }
  },
  "harbor-seal": {
    zh: {
      name: "海门钥纹",
      era: "港口机关",
      clue: "朱、金、青、墨四印合一，机关里留下了通往灵界的钥纹。",
      exhibit: "第三柜承接机关线索，让展线从古碑进入真实的门。",
      history: "港口机关中的四色密钥。象征着满者伯夷王朝与室利佛逝王朝之间，针对淡马锡（古新加坡）控制权的激烈争夺与港口海防关锁。"
    },
    en: {
      name: "Harbor Gate Seal",
      era: "Harbor Mechanism",
      clue: "Cinnabar, gold, blue-green, and ink join into the key pattern left inside the lock.",
      exhibit: "The third case carries the mechanism clue, moving the route from plaque to real gate.",
      history: "A four-colored seal from the harbor locks. It represents the historical struggle between the Majapahit and Srivijaya empires for the control of ancient Temasek (early Singapore) and its defensive harbor gates."
    }
  },
  "spirit-chime": {
    zh: {
      name: "灵界清音",
      era: "净化仪式",
      clue: "竹铃声把墨雾震散，余音被收成一件能被展出的文物。",
      exhibit: "收在末柜最完整：传说被净化后，才变成可以分享的展览。",
      history: "利用东南亚传统竹筒制成的神圣风铃。在古老的岁月中，竹铃不仅是航海的水音标识，更在宗教仪式中用于驱散瘴气、净化心灵与指引迷途旅人。"
    },
    en: {
      name: "Spirit Chime",
      era: "Cleansing Rite",
      clue: "The bamboo chime scatters the ink fog, and its echo becomes an artifact that can be displayed.",
      exhibit: "It belongs in the final case: only after cleansing can the legend be shared.",
      history: "A sacred wind chime crafted from traditional Southeast Asian bamboo. In ancient times, bamboo chimes served as maritime acoustic markers and were used in religious rites to disperse miasma, cleanse spirits, and guide lost travelers."
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
