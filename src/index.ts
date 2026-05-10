import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    TextContainerUpgrade,
    OsEventTypeList,
    EvenAppBridge,
    EvenHubEvent
} from '@evenrealities/even_hub_sdk';

// --- Global UI Helper ---
declare global {
    interface Window { logToUI: (msg: string) => void; }
}
const log = (msg: string) => {
    console.log(msg);
    if (window.logToUI) window.logToUI(msg);
};

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
            options: ["Entra nel Castello", "Esamina i dintorni", "Aiuto"]
        },
        HALL: {
            title: "Atrio Oscuro",
            desc: "Un salone immenso. Torce spente pendono dai muri. Senti gocciolare dell'acqua a Ovest.",
            options: ["Vai a Ovest (Pozzo)", "Prosegui a Nord", "Torna indietro", "Aiuto"]
        },
        WELL: {
            title: "Il Pozzo Antico",
            desc: "Un pozzo di pietra. Qualcosa brilla sul fondo. Hai un HP in meno per la fatica.",
            options: ["Esamina il pozzo", "Torna all'atrio", "Aiuto"]
        },
        ALTAR: {
            title: "L'Altare G2",
            desc: "Una luce dorata illumina un altare. Al centro, un manufatto leggendario.",
            options: ["Prendi il Manufatto", "Recita una preghiera", "Aiuto"]
        }
    },
    EN: {
        ENTRANCE: {
            title: "The Iron Gate",
            desc: "You stand before a massive gate. The air is cold, smelling of pine and adventure.",
            options: ["Enter the Castle", "Examine surroundings", "Help"]
        },
        HALL: {
            title: "Dark Hall",
            desc: "A vast hall. Unlit torches hang from the walls. You hear water dripping to the West.",
            options: ["Go West (Well)", "Proceed North", "Go back", "Help"]
        },
        WELL: {
            title: "The Ancient Well",
            desc: "A stone well. Something glimmers at the bottom. -1 HP from exhaustion.",
            options: ["Examine well", "Back to hall", "Help"]
        },
        ALTAR: {
            title: "The G2 Altar",
            desc: "Golden light illuminates an altar. At its center, a legendary artifact.",
            options: ["Take the Artifact", "Say a prayer", "Help"]
        }
    }
};

const HELP_TEXT: Record<Language, string> = {
    IT: "AIUTO:\nScorri: Naviga opzioni / cambia lettera.\nClick: Conferma azione.\nDoppio Click: Esci dal gioco.",
    EN: "HELP:\nScroll: Navigate options / change letter.\nClick: Confirm action.\nDouble Click: Exit game."
};

// --- Game Logic Instance ---
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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let charIndex = 0;

function getTitle() {
    if (gameState.showHelp) return "Help / Aiuto";
    if (gameState.phase === 'LANG') return "G2 Chronicles";
    if (gameState.phase === 'NAME') return (gameState.lang === 'IT' ? "Nome: " : "Name: ") + gameState.name + ALPHABET[charIndex];
    if (gameState.phase === 'DEAD') return gameState.lang === 'IT' ? "GAME OVER" : "YOU DIED";
    if (gameState.phase === 'WIN') return gameState.lang === 'IT' ? "VITTORIA!" : "VICTORY!";
    return ROOMS[gameState.lang][gameState.room].title;
}

function getDescription() {
    if (gameState.showHelp) return HELP_TEXT[gameState.lang] + "\n\n(Click per chiudere)";
    if (gameState.phase === 'LANG') return "Seleziona Lingua / Select Language\n\n" + (gameState.cursor === 0 ? "> ITALIANO" : "  ITALIANO") + "\n" + (gameState.cursor === 1 ? "> ENGLISH" : "  ENGLISH");
    if (gameState.phase === 'NAME') return (gameState.lang === 'IT' ? "Scorri per cambiare lettera.\nSeleziona '_' per confermare." : "Scroll to change letter.\nSelect '_' to confirm.");
    if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') return (gameState.phase === 'DEAD' ? (gameState.lang === 'IT' ? "La tua avventura finisce qui." : "Adventure ends here.") : (gameState.lang === 'IT' ? "Mondo salvo!" : "World saved!")) + (gameState.lang === 'IT' ? "\n\n> Ricomincia" : "\n\n> Restart");

    const room = ROOMS[gameState.lang][gameState.room];
    let d = (gameState.tempMsg ? gameState.tempMsg + "\n\n" : "") + room.desc + "\n\nHP: " + gameState.hp;
    if (gameState.inventory.length > 0) d += "\nInv: " + gameState.inventory.join(", ");
    d += "\n\n";
    room.options.forEach((opt, i) => { d += (i === gameState.cursor ? "> " : "  ") + opt + "\n"; });
    return d;
}

// --- Even SDK Logic ---
let _bridge: EvenAppBridge | null = null;

async function syncUI() {
    if (!_bridge) return;
    const title = getTitle();
    const desc = getDescription();
    log(`Syncing UI: ${title.substring(0, 20)}...`);
    try {
        await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 0, content: title }));
        await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, content: desc }));
    } catch (e) { log("Sync Error: " + e); }
}

function handleScroll(dir: 'UP' | 'DOWN') {
    if (gameState.showHelp) return;
    if (gameState.phase === 'LANG') {
        gameState.cursor = (gameState.cursor + (dir === 'DOWN' ? 1 : -1) + 2) % 2;
    } else if (gameState.phase === 'NAME') {
        charIndex = (charIndex + (dir === 'DOWN' ? 1 : -1) + ALPHABET.length) % ALPHABET.length;
    } else if (gameState.phase === 'PLAY') {
        const max = ROOMS[gameState.lang][gameState.room].options.length;
        gameState.cursor = (gameState.cursor + (dir === 'DOWN' ? 1 : -1) + max) % max;
    }
    syncUI();
}

function handleSelect() {
    log("Select trigger triggered");
    gameState.tempMsg = '';
    if (gameState.showHelp) {
        gameState.showHelp = false;
        syncUI();
        return;
    }

    if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
        gameState.phase = 'LANG';
        gameState.hp = 10;
        gameState.inventory = [];
        gameState.room = 'ENTRANCE';
        gameState.cursor = 0;
        charIndex = 0;
        gameState.name = '';
    } else if (gameState.phase === 'LANG') {
        gameState.lang = gameState.cursor === 0 ? 'IT' : 'EN';
        gameState.phase = 'NAME';
    } else if (gameState.phase === 'NAME') {
        const char = ALPHABET[charIndex];
        if (char === '_') {
            if (gameState.name.length > 0) { gameState.phase = 'PLAY'; gameState.cursor = 0; }
        } else if (gameState.name.length < 8) { gameState.name += char; }
    } else if (gameState.phase === 'PLAY') {
        const roomData = ROOMS[gameState.lang][gameState.room];
        const optionText = roomData.options[gameState.cursor];
        if (optionText === "Help" || optionText === "Aiuto") {
            gameState.showHelp = true;
        } else {
            if (gameState.room === 'ENTRANCE') {
                if (gameState.cursor === 0) gameState.room = 'HALL';
                else gameState.tempMsg = gameState.lang === 'IT' ? "Nulla." : "Nothing.";
            } else if (gameState.room === 'HALL') {
                if (gameState.cursor === 0) { gameState.room = 'WELL'; gameState.hp -= 1; }
                else if (gameState.cursor === 1) gameState.room = 'ALTAR';
                else if (gameState.cursor === 2) gameState.room = 'ENTRANCE';
            } else if (gameState.room === 'WELL') {
                if (gameState.cursor === 0) {
                    const item = gameState.lang === 'IT' ? "Torcia" : "Torch";
                    if (!gameState.inventory.includes(item)) gameState.inventory.push(item);
                } else if (gameState.cursor === 1) gameState.room = 'HALL';
            } else if (gameState.room === 'ALTAR') {
                if (gameState.cursor === 0) gameState.phase = 'WIN';
                else if (gameState.cursor === 1) gameState.room = 'HALL';
            }
            if (gameState.hp <= 0) gameState.phase = 'DEAD';
            gameState.cursor = 0;
        }
    }
    syncUI();
}

async function init() {
    log("Init starting...");
    _bridge = await waitForEvenAppBridge();
    log("Bridge ready");

    const tProp = new TextContainerProperty({
        xPosition: 40, yPosition: 16, width: 496, height: 56,
        containerID: 0, containerName: "t", content: getTitle(),
        isEventCapture: 1
    });
    const dProp = new TextContainerProperty({
        xPosition: 40, yPosition: 80, width: 496, height: 192,
        containerID: 1, containerName: "d", content: getDescription(),
        isEventCapture: 1
    });

    const res = await _bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [tProp, dProp]
    }));
    log("Layout Created: " + res);

    _bridge.onEvenHubEvent((event: EvenHubEvent) => {
        // DETAILED LOGGING FOR TROUBLESHOOTING
        log(`Event: sys=${event.sysEvent?.eventType}, text=${event.textEvent?.eventType}, list=${event.listEvent?.eventType}`);

        const type = event.sysEvent?.eventType ?? event.textEvent?.eventType ?? event.listEvent?.eventType;

        // CLICK_EVENT is 0, so we must check for undefined explicitly
        if (type === undefined) return;

        if (type === OsEventTypeList.SCROLL_TOP_EVENT) {
            handleScroll('UP');
        } else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
            handleScroll('DOWN');
        } else if (type === OsEventTypeList.CLICK_EVENT) {
            handleSelect();
        } else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
            log("Exiting App...");
            if (_bridge) _bridge.shutDownPageContainer(1);
        }
    });

    // Forced initial sync to be sure
    await syncUI();
}

init().catch(e => log("Init Error: " + e));
