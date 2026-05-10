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
 * Hardware Compatibility Version:
 * - Ensures Title and Desc containers are created during startup.
 * - Uses consistent container IDs.
 * - Handles bridge initialization robustly.
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

// --- Content Data ---

const NAMES = ["Alaric", "Elara", "Kaelen", "Morgath", "Valerius"];

const ROOMS: Record<string, Room> = {
  forest: {
    title: { it: "Foresta di Smeraldo", en: "Emerald Forest" },
    desc: {
      it: "Alberi secolari svettano verso il cielo. Una fitta nebbia copre il suolo.\n\nA nord senti il soffio freddo di una grotta.\nA est brilla una luce mistica.",
      en: "Ancient trees tower toward the sky. A thick mist covers the ground.\n\nTo the North, you feel a cold breeze from a cave.\nTo the East, a mystic light shines."
    },
    options: (state) => [
      { label: { it: "Vai a Nord (Grotta)", en: "Go North (Cave)" }, onSelect: () => move('cave') },
      { label: { it: "Vai a Est (Altare)", en: "Go East (Altar)" }, onSelect: () => move('altar') },
      { label: { it: "Esamina il terreno", en: "Examine ground" }, onSelect: () => {
          if (!state.inventory.includes("Pietra")) {
            state.inventory.push("Pietra");
            setMessage("Hai trovato una Pietra focaia.", "You found a Flint Stone.");
          } else {
            setMessage("Non c'è altro qui.", "Nothing else here.");
          }
      }},
    ]
  },
  cave: {
    title: { it: "Grotta Oscura", en: "Dark Cave" },
    desc: {
      it: "L'umidità gocciola dalle pareti. Un crepaccio profondo blocca il sentiero a ovest.\n\nUno scrigno d'argento giace nell'angolo.",
      en: "Moisture drips from the walls. A deep crevice blocks the path to the West.\n\nA silver chest lies in the corner."
    },
    options: (state) => [
      { label: { it: "Apri lo scrigno", en: "Open the chest" }, onSelect: () => {
          if (!state.inventory.includes("Medaglione")) {
            state.inventory.push("Medaglione");
            state.hp += 20;
            setMessage("Trovato Medaglione Antico! +20 HP", "Found Ancient Medallion! +20 HP");
          } else {
            setMessage("Lo scrigno è vuoto.", "The chest is empty.");
          }
      }},
      { label: { it: "Salta il crepaccio", en: "Jump the crevice" }, onSelect: () => {
          if (Math.random() > 0.5) {
            move('ruins');
            setMessage("Salto riuscito!", "Successful jump!");
          } else {
            state.hp -= 30;
            setMessage("Sei caduto! -30 HP", "You fell! -30 HP");
            if (state.hp <= 0) state.stage = 'DEAD';
          }
      }},
      { label: { it: "Torna alla foresta", en: "Return to forest" }, onSelect: () => move('forest') },
    ]
  },
  altar: {
    title: { it: "Altare G2", en: "G2 Altar" },
    desc: {
      it: "Un monolite di vetro brilla di una luce verde pulsante. Senti una voce nella tua testa.\n\n'Presenta l'artefatto per procedere'.",
      en: "A glass monolith glows with a pulsing green light. You hear a voice in your head.\n\n'Present the artifact to proceed'."
    },
    options: (state) => [
      { label: { it: "Tocca il monolite", en: "Touch monolith" }, onSelect: () => {
          if (state.inventory.includes("Medaglione")) {
            state.stage = 'WIN';
          } else {
            setMessage("Il monolite ti respinge.", "The monolith repels you.");
            state.hp -= 10;
            if (state.hp <= 0) state.stage = 'DEAD';
          }
      }},
      { label: { it: "Torna alla foresta", en: "Return to forest" }, onSelect: () => move('forest') },
    ]
  },
  ruins: {
    title: { it: "Rovine Perdute", en: "Lost Ruins" },
    desc: {
      it: "Mura di pietra crollate testimoniano una civiltà dimenticata. Vedi un'uscita a sud.",
      en: "Crumbled stone walls bear witness to a forgotten civilization. You see an exit to the South."
    },
    options: (state) => [
      { label: { it: "Vai a Sud (Foresta)", en: "Go South (Forest)" }, onSelect: () => move('forest') },
      { label: { it: "Cerca tesori", en: "Search for treasure" }, onSelect: () => {
          setMessage("Trovi solo polvere e ricordi.", "You find only dust and memories.");
      }},
    ]
  }
};

// --- Global State ---

let state: GameState = {
  language: 'en',
  stage: 'LANG_SELECT',
  playerName: '',
  room: 'forest',
  hp: 100,
  inventory: [],
  selectedIndex: 0,
  message: null
};

let bridge: EvenAppBridge;

// --- Helper Functions ---

function setMessage(it: string, en: string) {
  state.message = { it, en };
}

function move(room: string) {
  state.room = room;
  state.selectedIndex = 0;
  state.message = null;
}

// --- UI Wrapper ---

const TITLE_ID = 1;
const DESC_ID = 2;

const even = {
  showCard: async (title: string, description: string) => {
    if (!bridge) {
      console.warn("Bridge not ready for render");
      return;
    }

    const formattedDesc = description.split('\n').join('\n\n');

    const titleText = new TextContainerProperty({
      xPosition: 30,
      yPosition: 20,
      width: 516,
      height: 40,
      containerID: TITLE_ID,
      containerName: 'title',
      content: title.toUpperCase(),
      borderColor: 8,
      borderWidth: 1,
      paddingLength: 4,
    });

    const descText = new TextContainerProperty({
      xPosition: 30,
      yPosition: 70,
      width: 516,
      height: 208,
      containerID: DESC_ID,
      containerName: 'desc',
      content: formattedDesc,
      isEventCapture: 1,
      paddingLength: 10,
    });

    try {
      await bridge.rebuildPageContainer(new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [titleText, descText],
      }));
    } catch (e) {
      console.error("Failed to rebuild container:", e);
    }
  }
};

// --- Game Logic Flow ---

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
    return [{ label: { it: "Torna al gioco", en: "Back to game" }, onSelect: () => { state.stage = 'ADVENTURE'; } }];
  }
  if (state.stage === 'DEAD' || state.stage === 'WIN') {
    return [{ label: { it: "Ricomincia", en: "Restart" }, onSelect: () => {
      state.stage = 'LANG_SELECT';
      state.hp = 100;
      state.inventory = [];
      state.room = 'forest';
      state.message = null;
      state.selectedIndex = 0;
    } }];
  }
  return [];
}

async function render() {
  const options = getOptions();
  let title = "The G2 Chronicles";
  let content = "";

  const lang = state.language;

  if (state.stage === 'LANG_SELECT') {
    title = "Language / Lingua";
    content = "Benvenuto in The G2 Chronicles.\nScegli la tua lingua:";
  } else if (state.stage === 'NAME_SELECT') {
    title = lang === 'it' ? "Selezione Eroe" : "Hero Selection";
    content = lang === 'it' ? "Scorri i nomi e conferma:" : "Scroll names and select:";
  } else if (state.stage === 'ADVENTURE') {
    const room = ROOMS[state.room];
    title = room.title[lang];
    content = room.desc[lang];

    if (state.message) {
      content = `[!] ${state.message[lang]}\n\n${content}`;
    }

    const status = lang === 'it' ? `HP: ${state.hp} | ZAINO: ${state.inventory.length}` : `HP: ${state.hp} | INV: ${state.inventory.length}`;
    content += `\n\n${status}\n---`;
  } else if (state.stage === 'HELP') {
    title = lang === 'it' ? "Aiuto" : "Help";
    content = lang === 'it' ? "R1 Ring:\n- Scorri: Naviga bivi\n- Click: Conferma\n- Doppio Click: Aiuto" : "R1 Ring:\n- Scroll: Navigate paths\n- Click: Confirm\n- Double Click: Help";
  } else if (state.stage === 'DEAD') {
    title = lang === 'it' ? "SEI MORTO" : "YOU ARE DEAD";
    content = lang === 'it' ? "La tua avventura finisce qui nelle tenebre." : "Your adventure ends here in darkness.";
  } else if (state.stage === 'WIN') {
    title = lang === 'it' ? "VITTORIA" : "VICTORY";
    content = lang === 'it' ? `Complimenti ${state.playerName}! Hai sbloccato il potere dei G2.` : `Well done ${state.playerName}! You unlocked the power of G2.`;
  }

  // Add options with visual selection
  content += "\n" + options.map((opt, i) => (i === state.selectedIndex ? `● ${opt.label[lang]}` : `○ ${opt.label[lang]}`)).join("\n");

  await even.showCard(title, content);
}

// --- Handlers ---

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

// --- Start ---

async function main() {
  console.log("Initializing G2 Chronicles...");

  try {
    bridge = await waitForEvenAppBridge();
    console.log("Bridge connected");

    // CRITICAL: Initialize both containers immediately during startup
    // to match the structure used in rebuildPageContainer.
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 30, yPosition: 20, width: 516, height: 40,
            containerID: TITLE_ID, containerName: 'title', content: 'LOADING...',
          }),
          new TextContainerProperty({
            xPosition: 30, yPosition: 70, width: 516, height: 208,
            containerID: DESC_ID, containerName: 'desc', content: 'Please wait...',
            isEventCapture: 1
          })
        ],
      })
    );

    console.log("Startup container result:", result);

    bridge.onEvenHubEvent((event) => {
      if (event.textEvent) {
        const type = event.textEvent.eventType;
        if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) handleScroll('down');
        else if (type === OsEventTypeList.SCROLL_TOP_EVENT) handleScroll('up');
        else if (type === OsEventTypeList.CLICK_EVENT || type === undefined) handleSelect();
        else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          state.stage = 'HELP';
          state.selectedIndex = 0;
          render();
        }
      }
    });

    // Start rendering the first game screen
    await render();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

main();
