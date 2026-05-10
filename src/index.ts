import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    TextContainerUpgrade,
    OsEventTypeList,
    EvenAppBridge
} from '@evenrealities/even_hub_sdk';

// --- Game Engine Types ---
type Language = 'IT' | 'EN';
type Room = 'ENTRANCE' | 'HALL' | 'WELL' | 'ALTAR';

interface GameState {
    phase: 'LANG' | 'NAME' | 'PLAY' | 'DEAD' | 'WIN';
    lang: Language;
    name: string;
    hp: number;
    inventory: string[];
    room: Room;
    cursor: number;
    options: string[];
    showHelp: boolean;
    tempMsg: string;
}

// --- Narrative Data ---
const ROOMS: Record<Language, Record<Room, { title: string; desc: string; options: string[] }>> = {
    IT: {
        ENTRANCE: {
            title: "Il Cancello di Ferro",
            desc: "Sei davanti a un imponente cancello. L'aria è fredda e profuma di pino e avventura.",
            options: ["Entra nel Castello", "Esamina i dintorni"]
        },
        HALL: {
            title: "Atrio Oscuro",
            desc: "Un salone immenso. Torce spente pendono dai muri. Senti gocciolare dell'acqua a Ovest.",
            options: ["Vai a Ovest (Pozzo)", "Prosegui a Nord", "Torna indietro"]
        },
        WELL: {
            title: "Il Pozzo Antico",
            desc: "Un pozzo di pietra. Qualcosa brilla sul fondo. Hai un HP in meno per la fatica.",
            options: ["Esamina il pozzo", "Torna all'atrio"]
        },
        ALTAR: {
            title: "L'Altare G2",
            desc: "Una luce dorata illumina un altare. Al centro, un manufatto leggendario.",
            options: ["Prendi il Manufatto", "Recita una preghiera"]
        }
    },
    EN: {
        ENTRANCE: {
            title: "The Iron Gate",
            desc: "You stand before a massive gate. The air is cold, smelling of pine and adventure.",
            options: ["Enter the Castle", "Examine surroundings"]
        },
        HALL: {
            title: "Dark Hall",
            desc: "A vast hall. Unlit torches hang from the walls. You hear water dripping to the West.",
            options: ["Go West (Well)", "Proceed North", "Go back"]
        },
        WELL: {
            title: "The Ancient Well",
            desc: "A stone well. Something glimmers at the bottom. -1 HP from exhaustion.",
            options: ["Examine well", "Back to hall"]
        },
        ALTAR: {
            title: "The G2 Altar",
            desc: "Golden light illuminates an altar. At its center, a legendary artifact.",
            options: ["Take the Artifact", "Say a prayer"]
        }
    }
};

const HELP_TEXT: Record<Language, string> = {
    IT: "AIUTO:\nScorri: Naviga opzioni / cambia lettera.\nClick: Conferma azione.\nDoppio Click: Chiudi Aiuto.",
    EN: "HELP:\nScroll: Navigate options / change letter.\nClick: Confirm action.\nDouble Click: Close Help."
};

// --- Even SDK Wrapper (as requested) ---
let _bridge: EvenAppBridge | null = null;

const even = {
    showCard: async (title: string, description: string) => {
        if (!_bridge) return;
        try {
            await _bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 0,
                content: title
            }));
            await _bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 1,
                content: description
            }));
        } catch (e) {
            console.error("showCard error", e);
        }
    }
};

// --- Game State Machine ---
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_";

let gameState: GameState = {
    phase: 'LANG',
    lang: 'IT',
    name: '',
    hp: 10,
    inventory: [],
    room: 'ENTRANCE',
    cursor: 0,
    options: ['ITALIANO', 'ENGLISH'],
    showHelp: false,
    tempMsg: ''
};

let charIndex = 0;

function resetGame() {
    gameState = {
        phase: 'LANG',
        lang: 'IT',
        name: '',
        hp: 10,
        inventory: [],
        room: 'ENTRANCE',
        cursor: 0,
        options: ['ITALIANO', 'ENGLISH'],
        showHelp: false,
        tempMsg: ''
    };
    charIndex = 0;
}

// --- UI Logic ---
function updateUI() {
    let title = "";
    let desc = "";

    if (gameState.showHelp) {
        title = "Help / Aiuto";
        desc = HELP_TEXT[gameState.lang];
    } else if (gameState.phase === 'LANG') {
        title = "The G2 Chronicles";
        desc = "Seleziona Lingua / Select Language\n\n" +
               (gameState.cursor === 0 ? "> ITALIANO" : "  ITALIANO") + "\n" +
               (gameState.cursor === 1 ? "> ENGLISH" : "  ENGLISH");
    } else if (gameState.phase === 'NAME') {
        title = (gameState.lang === 'IT' ? "Nome: " : "Name: ") + gameState.name + ALPHABET[charIndex];
        desc = (gameState.lang === 'IT' ? "Scorri per cambiare lettera.\nSeleziona '_' per confermare." : "Scroll to change letter.\nSelect '_' to confirm.");
    } else if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
        title = gameState.phase === 'DEAD' ? (gameState.lang === 'IT' ? "GAME OVER" : "YOU DIED") : (gameState.lang === 'IT' ? "VITTORIA!" : "VICTORY!");
        desc = (gameState.phase === 'DEAD' ?
                 (gameState.lang === 'IT' ? "La tua avventura finisce qui." : "Your adventure ends here.") :
                 (gameState.lang === 'IT' ? "Hai trovato le G2 leggendarie! Il mondo è salvo." : "You found the legendary G2! The world is saved.")) +
               (gameState.lang === 'IT' ? "\n\n> Ricomincia" : "\n\n> Restart");
    } else {
        const room = ROOMS[gameState.lang][gameState.room];
        title = room.title;
        desc = (gameState.tempMsg ? gameState.tempMsg + "\n\n" : "") + room.desc + "\n\nHP: " + gameState.hp;
        if (gameState.inventory.length > 0) {
            desc += "\nInv: " + gameState.inventory.join(", ");
        }
        desc += "\n\n";
        room.options.forEach((opt, i) => {
            desc += (i === gameState.cursor ? "> " : "  ") + opt + "\n";
        });
    }

    even.showCard(title, desc);
}

// --- Controls ---
function onScroll(dir: 'UP' | 'DOWN') {
    if (gameState.showHelp) return;

    if (gameState.phase === 'LANG') {
        gameState.cursor = (gameState.cursor + (dir === 'DOWN' ? 1 : -1) + 2) % 2;
    } else if (gameState.phase === 'NAME') {
        const max = ALPHABET.length;
        charIndex = (charIndex + (dir === 'DOWN' ? 1 : -1) + max) % max;
    } else if (gameState.phase === 'PLAY') {
        const max = ROOMS[gameState.lang][gameState.room].options.length;
        gameState.cursor = (gameState.cursor + (dir === 'DOWN' ? 1 : -1) + max) % max;
    }
    updateUI();
}

function onSelect() {
    gameState.tempMsg = '';
    if (gameState.showHelp) {
        gameState.showHelp = false;
        updateUI();
        return;
    }

    if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
        resetGame();
    } else if (gameState.phase === 'LANG') {
        gameState.lang = gameState.cursor === 0 ? 'IT' : 'EN';
        gameState.phase = 'NAME';
    } else if (gameState.phase === 'NAME') {
        const char = ALPHABET[charIndex];
        if (char === '_') {
            if (gameState.name.length > 0) {
                gameState.phase = 'PLAY';
                gameState.cursor = 0;
            }
        } else if (gameState.name.length < 8) {
            gameState.name += char;
        }
    } else if (gameState.phase === 'PLAY') {
        processAction();
    }
    updateUI();
}

function processAction() {
    const choice = gameState.cursor;
    const room = gameState.room;

    if (room === 'ENTRANCE') {
        if (choice === 0) gameState.room = 'HALL';
        else gameState.tempMsg = gameState.lang === 'IT' ? "Non trovi nulla." : "You find nothing.";
    } else if (room === 'HALL') {
        if (choice === 0) { gameState.room = 'WELL'; gameState.hp -= 1; }
        else if (choice === 1) gameState.room = 'ALTAR';
        else if (choice === 2) gameState.room = 'ENTRANCE';
    } else if (room === 'WELL') {
        if (choice === 0) {
            const item = gameState.lang === 'IT' ? "Torcia" : "Torch";
            if (!gameState.inventory.includes(item)) {
                gameState.inventory.push(item);
                gameState.tempMsg = gameState.lang === 'IT' ? "Hai preso la torcia!" : "You took the torch!";
            }
        } else gameState.room = 'HALL';
    } else if (room === 'ALTAR') {
        if (choice === 0) gameState.phase = 'WIN';
        else gameState.room = 'HALL';
    }

    if (gameState.hp <= 0) gameState.phase = 'DEAD';
    gameState.cursor = 0;
}

// --- Initialization ---
async function init() {
    _bridge = await waitForEvenAppBridge();

    const titleContainer = new TextContainerProperty({
        xPosition: 40, yPosition: 16, width: 496, height: 56,
        containerID: 0, containerName: "title", content: "The G2 Chronicles"
    });

    const descContainer = new TextContainerProperty({
        xPosition: 40, yPosition: 80, width: 496, height: 192,
        containerID: 1, containerName: "desc", content: "Loading...",
        isEventCapture: 1
    });

    await _bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [titleContainer, descContainer]
    }));

    updateUI();

    _bridge.onEvenHubEvent((event) => {
        const type = event.sysEvent?.eventType ?? event.textEvent?.eventType ?? event.listEvent?.eventType;
        if (type === undefined) return;

        if (type === OsEventTypeList.SCROLL_TOP_EVENT) onScroll('UP');
        else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) onScroll('DOWN');
        else if (type === OsEventTypeList.CLICK_EVENT) onSelect();
        else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
            gameState.showHelp = !gameState.showHelp;
            updateUI();
        }
    });
}

init().catch(console.error);
