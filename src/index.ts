import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  EvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk';

/**
 * THE G2 CHRONICLES
 * A Pure Text Adventure for Even Realities G2
 *
 * Hardware Compatibility: Even Realities G2 + R1 Ring
 */

// --- Types & Interfaces ---

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

// --- Content Data (Zork Style) ---

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

// --- Global State ---

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

// --- UI Helpers ---

const TITLE_ID = 1;
const DESC_ID = 2;

function updateStatus(text: string) {
  const el = document.getElementById('status');
  if (el) el.innerText = text;
  console.log("Status:", text);
}

function setMessage(it: string, en: string) {
  state.message = { it, en };
}

function move(room: string) {
  state.room = room;
  state.selectedIndex = 0;
  state.message = null;
}

// --- SDK Wrapper ---

/**
 * even.showCard: User-requested interface for rendering game content.
 * Handles the mapping between the narrative and the Hub Bridge.
 */
const even = {
  showCard: async (title: string, description: string) => {
    if (!bridge) {
      console.warn("Bridge not ready for showCard");
      return;
    }

    try {
      await bridge.rebuildPageContainer(new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 30, yPosition: 20, width: 516, height: 40,
            containerID: TITLE_ID, containerName: 'title', content: title.toUpperCase(),
            borderColor: 8, borderWidth: 1, paddingLength: 4,
          }),
          new TextContainerProperty({
            xPosition: 30, yPosition: 70, width: 516, height: 208,
            containerID: DESC_ID, containerName: 'desc', content: description,
            isEventCapture: 1, paddingLength: 10,
          })
        ]
      }));
    } catch (e) {
      updateStatus(`Render Error: ${e}`);
    }
  }
};

async function render() {
  const lang = state.language;
  const options = getOptions();

  let title = "The G2 Chronicles";
  let content = "";

  if (state.stage === 'LANG_SELECT') {
    title = "The G2 Chronicles";
    content = "Seleziona Lingua / Select Language";
  } else if (state.stage === 'NAME_SELECT') {
    title = lang === 'it' ? "Scelta Eroe" : "Choose Hero";
    content = lang === 'it' ? "Scegli il tuo nome:" : "Pick your name:";
  } else if (state.stage === 'ADVENTURE') {
    const room = ROOMS[state.room];
    title = room.title[lang];
    content = room.desc[lang];

    if (state.message) {
      content = `[!] ${state.message[lang]}\n\n${content}`;
    }

    const statusLine = lang === 'it' ? `HP: ${state.hp} | Zaino: ${state.inventory.length}` : `HP: ${state.hp} | Inv: ${state.inventory.length}`;
    content += `\n\n${statusLine}\n---`;
  } else if (state.stage === 'HELP') {
    title = lang === 'it' ? "Aiuto" : "Help";
    content = lang === 'it' ? "Anello R1:\n- Scorrimento: Naviga\n- Click: Conferma\n- Doppio Click: Aiuto" : "R1 Ring:\n- Scroll: Navigate\n- Click: Confirm\n- Double Click: Help";
  } else if (state.stage === 'DEAD') {
    title = lang === 'it' ? "FINE" : "GAME OVER";
    content = lang === 'it' ? "Le tenebre ti hanno consumato." : "The darkness has consumed you.";
  } else if (state.stage === 'WIN') {
    title = lang === 'it' ? "VITTORIA" : "VICTORY";
    content = lang === 'it' ? `Eroe ${state.playerName}, hai sbloccato il potere dei G2!` : `Hero ${state.playerName}, you unlocked the power of G2!`;
  }

  // Append options
  content += "\n" + options.map((opt, i) => (i === state.selectedIndex ? `> ${opt.label[lang]}` : `  ${opt.label[lang]}`)).join("\n");

  updateStatus(`Rendering stage: ${state.stage}`);
  await even.showCard(title, content);
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

// --- Input Handling ---

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

async function main() {
  updateStatus("Waiting for Even Bridge...");

  try {
    bridge = await waitForEvenAppBridge();
    updateStatus("Bridge Connected. Starting G2 Chronicles...");

    // Initial container creation
    const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 30, yPosition: 20, width: 516, height: 40,
          containerID: TITLE_ID, containerName: 'title', content: 'G2 CHRONICLES',
        }),
        new TextContainerProperty({
          xPosition: 30, yPosition: 70, width: 516, height: 208,
          containerID: DESC_ID, containerName: 'desc', content: 'Inizializzazione...',
          isEventCapture: 1
        })
      ]
    }));

    if (result !== 0) {
      updateStatus(`SDK Init Error: ${result}`);
      return;
    }

    // Hardware Events (R1 Ring)
    // The SDK can deliver events via textEvent (for UI focus) or sysEvent (hardware direct)
    bridge.onEvenHubEvent((event) => {
      const hubEvent = event.textEvent || event.sysEvent || event.listEvent;
      if (hubEvent) {
        const type = hubEvent.eventType;

        // Log event for debugging if needed
        console.log(`Hardware Event: ${type}`);

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

    // Start
    await render();

  } catch (err) {
    updateStatus(`Initialization failed: ${err}`);
  }
}

main();
