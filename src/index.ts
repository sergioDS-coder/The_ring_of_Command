import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  EvenAppBridge,
  OsEventTypeList,
  StartUpPageCreateResult,
} from '@evenrealities/even_hub_sdk';

/**
 * THE G2 CHRONICLES
 * A Pure Text Adventure for Even Realities G2
 */

// --- Types ---

type Language = 'it' | 'en';

interface GameOption {
  label: { [key in Language]: string };
  onSelect: () => void;
}

interface Room {
  title: { [key in Language]: string };
  desc: { [key in Language]: string };
  options: (state: GameState) => GameOption[];
}

interface GameState {
  language: Language;
  stage: 'LANG_SELECT' | 'NAME_SELECT' | 'ADVENTURE' | 'HELP' | 'DEAD' | 'WIN';
  playerName: string;
  room: string;
  hp: number;
  inventory: string[];
  selectedIndex: number;
  message: { [key in Language]: string } | null;
}

// --- Data ---

const NAMES = ["Alaric", "Elara", "Kaelen", "Valerius"];

const ROOMS: Record<string, Room> = {
  entrance: {
    title: { it: "Ingresso Rovine", en: "Ruins Entrance" },
    desc: {
      it: "Ti trovi davanti a un'imponente arcata di pietra. Il vento ulula tra le fessure. A nord l'oscurità inghiotte il sentiero.\n\nUno scrigno consumato dal tempo giace ai tuoi piedi.",
      en: "You stand before a massive stone archway. The wind howls through the cracks. To the North, darkness swallows the path.\n\nA time-worn chest lies at your feet."
    },
    options: (state) => [
      { label: { it: "Vai a Nord (Oscurità)", en: "Go North (Darkness)" }, onSelect: () => move('dark_hall') },
      { label: { it: "Apri lo scrigno", en: "Open the chest" }, onSelect: () => {
          if (!state.inventory.includes("Torcia")) {
            state.inventory.push("Torcia");
            setMessage("Hai trovato una Torcia spenta.", "You found an unlit Torch.");
          } else {
            setMessage("Lo scrigno è vuoto.", "The chest is empty.");
          }
      }},
      { label: { it: "Guarda verso Ovest", en: "Look West" }, onSelect: () => setMessage("Vedi solo le montagne lontane.", "You see only distant mountains.") },
    ]
  },
  dark_hall: {
    title: { it: "Sala Oscura", en: "Dark Hall" },
    desc: {
      it: "L'aria è fredda e ferma. Senza una luce non puoi vedere dove metti i piedi.\n\nSenti un rumore di acqua che scorre verso Est.",
      en: "The air is cold and still. Without a light, you cannot see where you step.\n\nYou hear the sound of running water to the East."
    },
    options: (state) => [
      { label: { it: "Vai a Est (Acqua)", en: "Go East (Water)" }, onSelect: () => move('well') },
      { label: { it: "Usa la Torcia", en: "Use Torch" }, onSelect: () => {
          if (state.inventory.includes("Torcia")) {
            setMessage("La torcia illumina una porta segreta a Nord!", "The torch reveals a secret door to the North!");
            if (!state.inventory.includes("Luce")) state.inventory.push("Luce");
          } else {
            setMessage("Non hai nulla per illuminare.", "You have nothing to light the way.");
          }
      }},
      { label: { it: "Procedi a Nord", en: "Go North" }, onSelect: () => {
          if (state.inventory.includes("Luce")) {
            move('altar');
          } else {
            state.hp -= 20;
            setMessage("Inciampi nel buio! -20 HP", "You trip in the dark! -20 HP");
            if (state.hp <= 0) state.stage = 'DEAD';
          }
      }},
      { label: { it: "Torna a Sud", en: "Go South" }, onSelect: () => move('entrance') },
    ]
  },
  well: {
    title: { it: "Il Pozzo", en: "The Well" },
    desc: {
      it: "Un antico pozzo di pietra occupa il centro della stanza. L'acqua brilla di un blu innaturale.\n\nUn'iscrizione recita: 'Solo il puro può bere'.",
      en: "An ancient stone well occupies the center of the room. The water glows with an unnatural blue.\n\nAn inscription reads: 'Only the pure may drink'."
    },
    options: (state) => [
      { label: { it: "Bevi l'acqua", en: "Drink water" }, onSelect: () => {
          state.hp = Math.min(100, state.hp + 30);
          setMessage("L'acqua ti rigenera. +30 HP", "The water regenerates you. +30 HP");
      }},
      { label: { it: "Esamina il pozzo", en: "Examine well" }, onSelect: () => {
          if (!state.inventory.includes("Medaglione")) {
            state.inventory.push("Medaglione");
            setMessage("Hai trovato un Medaglione d'oro sul fondo!", "You found a golden Medallion at the bottom!");
          } else {
            setMessage("Non vedi altro nel pozzo.", "You see nothing else in the well.");
          }
      }},
      { label: { it: "Torna a Ovest", en: "Go West" }, onSelect: () => move('dark_hall') },
    ]
  },
  altar: {
    title: { it: "Altare G2", en: "G2 Altar" },
    desc: {
      it: "Un maestoso altare di cristallo vibra di energia. Una fessura circolare attende un oggetto.\n\nQuesto sembra il cuore delle Cronache.",
      en: "A majestic crystal altar vibrates with energy. A circular slot awaits an object.\n\nThis feels like the heart of the Chronicles."
    },
    options: (state) => [
      { label: { it: "Inserisci Medaglione", en: "Insert Medallion" }, onSelect: () => {
          if (state.inventory.includes("Medaglione")) {
            state.stage = 'WIN';
          } else {
            setMessage("Non hai nulla che si adatti.", "You have nothing that fits.");
            state.hp -= 10;
            if (state.hp <= 0) state.stage = 'DEAD';
          }
      }},
      { label: { it: "Torna a Sud", en: "Go South" }, onSelect: () => move('dark_hall') },
    ]
  }
};

// --- State ---

let state: GameState = {
  language: 'it',
  stage: 'LANG_SELECT',
  playerName: '',
  room: 'entrance',
  hp: 100,
  inventory: [],
  selectedIndex: 0,
  message: null
};

let bridge: EvenAppBridge;
let isStarted = false;

const TITLE_ID = 1;
const DESC_ID = 2;

// --- Helpers ---

function updateStatus(text: string) {
  const el = document.getElementById('status');
  if (el) {
    el.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${text}</div>`;
  }
  console.log(text);
}

function setMessage(it: string, en: string) {
  state.message = { it, en };
}

function move(room: string) {
  state.room = room;
  state.selectedIndex = 0;
  state.message = null;
}

function getOptions(): GameOption[] {
  if (state.stage === 'LANG_SELECT') {
    return [
      { label: { it: "Italiano", en: "Italian" }, onSelect: () => { state.language = 'it'; state.stage = 'NAME_SELECT'; state.selectedIndex = 0; } },
      { label: { it: "English", en: "English" }, onSelect: () => { state.language = 'en'; state.stage = 'NAME_SELECT'; state.selectedIndex = 0; } },
    ];
  }
  if (state.stage === 'NAME_SELECT') {
    return NAMES.map(name => ({
      label: { it: name, en: name },
      onSelect: () => { state.playerName = name; state.stage = 'ADVENTURE'; state.selectedIndex = 0; }
    }));
  }
  if (state.stage === 'ADVENTURE') {
    return ROOMS[state.room].options(state);
  }
  if (state.stage === 'HELP') {
    return [{ label: { it: "Torna", en: "Back" }, onSelect: () => { state.stage = 'ADVENTURE'; } }];
  }
  if (state.stage === 'DEAD' || state.stage === 'WIN') {
    return [{ label: { it: "Ricomincia", en: "Restart" }, onSelect: () => { 
      state.stage = 'LANG_SELECT'; 
      state.hp = 100; 
      state.inventory = []; 
      state.room = 'entrance'; 
      state.message = null;
      state.selectedIndex = 0;
    } }];
  }
  return [];
}

function getFrameContent() {
  const lang = state.language;
  const options = getOptions();
  
  let title = "THE G2 CHRONICLES";
  let content = "";

  if (state.stage === 'LANG_SELECT') {
    content = "Seleziona Lingua\nSelect Language";
  } else if (state.stage === 'NAME_SELECT') {
    title = lang === 'it' ? "SCELTA EROE" : "CHOOSE HERO";
    content = lang === 'it' ? "Scegli il tuo nome:" : "Pick your name:";
  } else if (state.stage === 'ADVENTURE') {
    const room = ROOMS[state.room];
    title = room.title[lang].toUpperCase();
    content = room.desc[lang];
    
    if (state.message) {
      content = `[!] ${state.message[lang]}\n\n${content}`;
    }

    const statusLine = lang === 'it' ? `HP: ${state.hp} | Zaino: ${state.inventory.length}` : `HP: ${state.hp} | Inv: ${state.inventory.length}`;
    content += `\n\n${statusLine}\n---`;
  } else if (state.stage === 'HELP') {
    title = lang === 'it' ? "AIUTO" : "HELP";
    content = lang === 'it' ? "Anello R1:\n- Scorri: Naviga\n- Click: Conferma\n- Doppio: Aiuto" : "R1 Ring:\n- Scroll: Navigate\n- Click: Confirm\n- Double: Help";
  } else if (state.stage === 'DEAD') {
    title = lang === 'it' ? "FINE" : "GAME OVER";
    content = lang === 'it' ? "Le tenebre ti hanno consumato." : "The darkness has consumed you.";
  } else if (state.stage === 'WIN') {
    title = lang === 'it' ? "VITTORIA" : "VICTORY";
    content = lang === 'it' ? `Eroe ${state.playerName}, hai sbloccato il potere dei G2!` : `Hero ${state.playerName}, you unlocked the power of G2!`;
  }

  // Options rendering
  content += "\n" + options.map((opt, i) => (i === state.selectedIndex ? `> ${opt.label[lang]}` : `  ${opt.label[lang]}`)).join("\n");

  return { title, content };
}

// --- SDK Logic & Wrapper ---

/**
 * Required even.showCard implementation
 */
const even = {
  showCard: async (title: string, content: string) => {
    if (!bridge) return;

    try {
      if (!isStarted) {
        updateStatus("First render: createStartUpPageContainer...");
        const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
          containerTotalNum: 2,
          textObject: [
            new TextContainerProperty({
              xPosition: 28, yPosition: 12, width: 520, height: 48,
              containerID: TITLE_ID, containerName: 'title', content: title.toUpperCase(),
              borderColor: 7, borderWidth: 1, paddingLength: 4,
            }),
            new TextContainerProperty({
              xPosition: 28, yPosition: 68, width: 520, height: 208,
              containerID: DESC_ID, containerName: 'desc', content: content,
              isEventCapture: 1, paddingLength: 8,
            })
          ]
        }));
        
        if (result === StartUpPageCreateResult.success) {
          isStarted = true;
          updateStatus("Display initialized.");
        } else {
          updateStatus(`Display init code: ${result}`);
          // Force isStarted true anyway to try rebuild as fallback
          isStarted = true;
        }
      } else {
        await bridge.rebuildPageContainer(new RebuildPageContainer({
          containerTotalNum: 2,
          textObject: [
            new TextContainerProperty({
              xPosition: 28, yPosition: 12, width: 520, height: 48,
              containerID: TITLE_ID, containerName: 'title', content: title.toUpperCase(),
            }),
            new TextContainerProperty({
              xPosition: 28, yPosition: 68, width: 520, height: 208,
              containerID: DESC_ID, containerName: 'desc', content: content,
              isEventCapture: 1
            })
          ]
        }));
      }
    } catch (err) {
      updateStatus(`Render error: ${err}`);
    }
  }
};

async function render() {
  const { title, content } = getFrameContent();
  await even.showCard(title, content);
}

function handleScroll(direction: 'up' | 'down') {
  const options = getOptions();
  if (options.length === 0) return;
  
  if (direction === 'down') {
    state.selectedIndex = (state.selectedIndex + 1) % options.length;
  } else {
    state.selectedIndex = (state.selectedIndex - 1 + options.length) % options.length;
  }
  render();
}

function handleSelect() {
  const options = getOptions();
  if (options[state.selectedIndex]) {
    options[state.selectedIndex].onSelect();
    render();
  }
}

// --- Main ---

async function start() {
  updateStatus("Application started. Searching for bridge...");
  
  // Resilient Bridge Handshake
  try {
    bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Bridge timeout")), 5000))
    ]);
    updateStatus("Bridge linked.");
  } catch (err) {
    updateStatus(`Bridge failed: ${err}. Attempting manual init...`);
    bridge = EvenAppBridge.getInstance();
  }

  // Setup Event Listeners
  bridge.onEvenHubEvent((event) => {
    // Log to phone for debugging
    if (event.sysEvent) updateStatus(`Sys Event: ${event.sysEvent.eventType}`);
    if (event.textEvent) updateStatus(`Text Event: ${event.textEvent.eventType}`);

    const hubEvent = event.textEvent || event.sysEvent || event.listEvent;
    if (hubEvent) {
      const type = hubEvent.eventType;
      if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        handleScroll('down');
      } else if (type === OsEventTypeList.SCROLL_TOP_EVENT) {
        handleScroll('up');
      } else if (type === OsEventTypeList.CLICK_EVENT) {
        handleSelect();
      } else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        state.stage = 'HELP';
        state.selectedIndex = 0;
        render();
      }
    }
  });

  // Initial render
  await render();
}

// Global error handler
window.onerror = (msg, _url, line) => {
  updateStatus(`GLOBAL ERROR: ${msg} at ${line}`);
  return false;
};

start();
