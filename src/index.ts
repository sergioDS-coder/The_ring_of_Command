import {
  waitForEvenAppBridge,
  EvenAppBridge,
  OsEventTypeList,
  StartUpPageCreateResult,
} from '@evenrealities/even_hub_sdk';

/**
 * THE G2 CHRONICLES
 * Optimized for G2 Hardware Stability
 */

// --- Game Logic ---

type Language = 'it' | 'en';

interface GameState {
  language: Language;
  stage: 'LANG' | 'NAME' | 'PLAY' | 'HELP' | 'DEAD' | 'WIN';
  playerName: string;
  room: string;
  hp: number;
  inventory: string[];
  selectedIndex: number;
  lastMessage: { it: string, en: string } | null;
}

const NAMES = ["Alaric", "Elara", "Kaelen", "Valerius"];

const ROOMS: Record<string, { title: any, desc: any, options: any }> = {
  entrance: {
    title: { it: "Ingresso", en: "Entrance" },
    desc: { it: "Rovine antiche. Uno scrigno ai tuoi piedi. Nord: Oscurita'.", en: "Ancient ruins. A chest at your feet. North: Darkness." },
    options: (s: any) => [
      { label: { it: "Nord", en: "North" }, act: () => move('dark') },
      { label: { it: "Apri scrigno", en: "Open chest" }, act: () => {
          if (!s.inventory.includes("Torcia")) { s.inventory.push("Torcia"); msg("Hai preso una Torcia.", "You got a Torch."); }
          else msg("Vuoto.", "Empty.");
      }},
    ]
  },
  dark: {
    title: { it: "Sala Oscura", en: "Dark Hall" },
    desc: { it: "Buio pesto. Senti acqua a Est.", en: "Pitch black. You hear water East." },
    options: (s: any) => [
      { label: { it: "Est", en: "East" }, act: () => move('well') },
      { label: { it: "Usa Torcia", en: "Use Torch" }, act: () => {
          if (s.inventory.includes("Torcia")) { msg("Vedi una porta a Nord.", "You see a door North."); s.inventory.push("Luce"); }
          else msg("Non vedi nulla.", "Can't see anything.");
      }},
      { label: { it: "Nord", en: "North" }, act: () => {
          if (s.inventory.includes("Luce")) move('altar');
          else { s.hp -= 20; msg("-20 HP! Troppo buio.", "-20 HP! Too dark."); if (s.hp <= 0) s.stage = 'DEAD'; }
      }},
      { label: { it: "Sud", en: "South" }, act: () => move('entrance') },
    ]
  },
  well: {
    title: { it: "Il Pozzo", en: "The Well" },
    desc: { it: "Acqua magica. Un riflesso dorato sul fondo.", en: "Magic water. Golden glint at the bottom." },
    options: (s: any) => [
      { label: { it: "Bevi", en: "Drink" }, act: () => { s.hp = 100; msg("HP al massimo!", "Full HP!"); }},
      { label: { it: "Cerca", en: "Search" }, act: () => {
          if (!s.inventory.includes("Medaglione")) { s.inventory.push("Medaglione"); msg("Preso Medaglione!", "Got Medallion!"); }
          else msg("Niente.", "Nothing.");
      }},
      { label: { it: "Ovest", en: "West" }, act: () => move('dark') },
    ]
  },
  altar: {
    title: { it: "Altare G2", en: "G2 Altar" },
    desc: { it: "L'energia vibra. Serve una chiave circolare.", en: "Energy vibrates. Needs a circular key." },
    options: (s: any) => [
      { label: { it: "Usa Medaglione", en: "Use Medallion" }, act: () => {
          if (s.inventory.includes("Medaglione")) s.stage = 'WIN';
          else msg("Non succede nulla.", "Nothing happens.");
      }},
      { label: { it: "Sud", en: "South" }, act: () => move('dark') },
    ]
  }
};

let state: GameState = {
  language: 'it',
  stage: 'LANG',
  playerName: '',
  room: 'entrance',
  hp: 100,
  inventory: [],
  selectedIndex: 0,
  lastMessage: null
};

function msg(it: string, en: string) { state.lastMessage = { it, en }; }
function move(r: string) { state.room = r; state.selectedIndex = 0; state.lastMessage = null; }

function getOptions(): { label: any, act: any }[] {
  if (state.stage === 'LANG') return [
    { label: { it: "Italiano", en: "Italian" }, act: () => { state.language = 'it'; state.stage = 'NAME'; } },
    { label: { it: "English", en: "English" }, act: () => { state.language = 'en'; state.stage = 'NAME'; } }
  ];
  if (state.stage === 'NAME') return NAMES.map(n => ({ label: { it: n, en: n }, act: () => { state.playerName = n; state.stage = 'PLAY'; } }));
  if (state.stage === 'PLAY') return ROOMS[state.room].options(state);
  if (state.stage === 'HELP') return [{ label: { it: "Torna", en: "Back" }, act: () => { state.stage = 'PLAY'; } }];
  return [{ label: { it: "Ricomincia", en: "Restart" }, act: () => {
    state.stage = 'LANG'; state.hp = 100; state.inventory = []; state.room = 'entrance'; state.lastMessage = null; state.selectedIndex = 0;
  } }];
}

// --- SDK Interface ---

let bridge: EvenAppBridge;
let isInitialized = false;

function updatePhoneStatus(text: string) {
  const el = document.getElementById('status');
  if (el) el.innerHTML += `<div>[${new Date().toLocaleTimeString().split(' ')[0]}] ${text}</div>`;
  console.log(text);
}

const even = {
  showCard: async (title: string, description: string) => {
    if (!bridge) return;

    // G2 Firmware Optimization: Use safe-zone coordinates and explicit property types
    const layout = {
      containerTotalNum: 2,
      textObject: [
        {
          xPosition: 40,
          yPosition: 20,
          width: 496,
          height: 40,
          containerID: 1,
          containerName: 'title_layer',
          content: title.toUpperCase(),
          borderColor: 7,
          borderWidth: 1,
          borderRadius: 4,
          paddingLength: 4,
          isEventCapture: 0
        },
        {
          xPosition: 40,
          yPosition: 70,
          width: 496,
          height: 200,
          containerID: 2,
          containerName: 'desc_layer',
          content: description,
          borderColor: 0,
          borderWidth: 0,
          borderRadius: 0,
          paddingLength: 8,
          isEventCapture: 1
        }
      ]
    };

    try {
      if (!isInitialized) {
        updatePhoneStatus("Sending Startup Container...");
        const res = await bridge.createStartUpPageContainer(layout as any);
        if (res === StartUpPageCreateResult.success) {
          isInitialized = true;
          updatePhoneStatus("Success.");
        } else {
          updatePhoneStatus(`Error: ${res}`);
          // Fallback: try rebuild anyway
          await bridge.rebuildPageContainer(layout as any);
          isInitialized = true;
        }
      } else {
        await bridge.rebuildPageContainer(layout as any);
      }
    } catch (e) {
      updatePhoneStatus(`SDK Error: ${e}`);
    }
  }
};

async function render() {
  const l = state.language;
  const opts = getOptions();
  let t = "G2 CHRONICLES";
  let d = "";

  if (state.stage === 'LANG') d = "Lingua / Language";
  else if (state.stage === 'NAME') d = l === 'it' ? "Scegli Eroe:" : "Pick Hero:";
  else if (state.stage === 'PLAY') {
    const r = ROOMS[state.room];
    t = r.title[l];
    d = (state.lastMessage ? `[!] ${state.lastMessage[l]}\n\n` : "") + r.desc[l];
    d += `\n\nHP: ${state.hp} | Inv: ${state.inventory.length}\n---`;
  } else if (state.stage === 'HELP') {
    t = l === 'it' ? "AIUTO" : "HELP";
    d = l === 'it' ? "R1 Ring:\n- Scorri: Naviga\n- Click: Conferma\n- Doppio: Aiuto" : "R1 Ring:\n- Scroll: Navigate\n- Click: Confirm\n- Double: Help";
  } else if (state.stage === 'DEAD') { t = "GAME OVER"; d = l === 'it' ? "Sei morto." : "You died."; }
  else if (state.stage === 'WIN') { t = "VITTORIA"; d = l === 'it' ? `Bravo ${state.playerName}!` : `Well done ${state.playerName}!`; }

  d += "\n" + opts.map((o, i) => (i === state.selectedIndex ? `> ${o.label[l]}` : `  ${o.label[l]}`)).join("\n");

  await even.showCard(t, d);
}

// --- Input ---

function handleScroll(dir: number) {
  const opts = getOptions();
  if (opts.length === 0) return;
  state.selectedIndex = (state.selectedIndex + dir + opts.length) % opts.length;
  render();
}

function handleSelect() {
  const opts = getOptions();
  if (opts[state.selectedIndex]) {
    opts[state.selectedIndex].act();
    render();
  }
}

// --- Initialization ---

async function init() {
  updatePhoneStatus("Booting...");

  try {
    // Resilient async load
    bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise<any>((_, rej) => setTimeout(() => rej("timeout"), 3000))
    ]).catch(() => {
      updatePhoneStatus("Bridge timeout, using Instance.");
      return EvenAppBridge.getInstance();
    });

    updatePhoneStatus("Bridge Ready.");

    bridge.onEvenHubEvent((ev) => {
      const event = ev.textEvent || ev.sysEvent || ev.listEvent;
      if (!event) return;

      const type = event.eventType;
      if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) handleScroll(1);
      else if (type === OsEventTypeList.SCROLL_TOP_EVENT) handleScroll(-1);
      else if (type === OsEventTypeList.CLICK_EVENT) handleSelect();
      else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        state.stage = 'HELP';
        state.selectedIndex = 0;
        render();
      }
    });

    await render();

  } catch (err) {
    updatePhoneStatus(`Fatal: ${err}`);
  }
}

window.onerror = (m, _u, l) => updatePhoneStatus(`ERR: ${m} (line ${l})`);
init();
