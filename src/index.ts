import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    TextContainerUpgrade,
    OsEventTypeList,
    EvenAppBridge,
    EvenHubEvent
} from '@evenrealities/even_hub_sdk';

// --- Global UI Helpers ---
declare global {
    interface Window {
        logToUI: (msg: string) => void;
        setStatus: (status: string) => void;
    }
}
const log = (msg: string) => {
    console.log(msg);
    if (window.logToUI) window.logToUI(msg);
};
const updateStatus = (status: string) => {
    if (window.setStatus) window.setStatus(status);
};

// --- Game Engine ---
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
    IT: "AIUTO:\nScorri: Naviga opzioni.\nClick: Conferma.\nDoppio Click: Esci.",
    EN: "HELP:\nScroll: Navigate options.\nClick: Confirm.\nDouble Click: Exit."
};

let gameState: GameState = {
    phase: 'LANG', lang: 'IT', name: '', hp: 10, inventory: [], room: 'ENTRANCE', cursor: 0, options: [], showHelp: false, tempMsg: ''
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
    log(`Syncing UI: ${title}`);
    try {
        await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 0, content: title }));
        await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, content: desc }));
    } catch (e) { log("Sync Error: " + e); }
}

async function init() {
    updateStatus("Connecting to Bridge...");
    _bridge = await waitForEvenAppBridge();
    updateStatus("Bridge Connected!");
    log("Bridge ready. Creating Startup layout...");

    // Optimized layout: Multiples of 8, IDs 0 and 1
    const tProp = new TextContainerProperty({
        xPosition: 40, yPosition: 24, width: 496, height: 48,
        containerID: 0, containerName: "title", content: getTitle(),
        isEventCapture: 1
    });
    const dProp = new TextContainerProperty({
        xPosition: 40, yPosition: 88, width: 496, height: 176,
        containerID: 1, containerName: "desc", content: getDescription(),
        isEventCapture: 1
    });

    try {
        const res = await _bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
            containerTotalNum: 2,
            textObject: [tProp, dProp]
        }));
        log("Layout response: " + res);
        updateStatus("Display Active");
    } catch (e) {
        log("Layout Error: " + e);
        updateStatus("Layout Error");
    }

    _bridge.onEvenHubEvent((event: EvenHubEvent) => {
        const type = event.sysEvent?.eventType ?? event.textEvent?.eventType ?? event.listEvent?.eventType;
        log(`Event received: ${type}`);
        if (type === undefined) return;

        if (type === OsEventTypeList.SCROLL_TOP_EVENT) {
            if (!gameState.showHelp) {
                if (gameState.phase === 'LANG') gameState.cursor = (gameState.cursor - 1 + 2) % 2;
                else if (gameState.phase === 'NAME') charIndex = (charIndex - 1 + ALPHABET.length) % ALPHABET.length;
                else if (gameState.phase === 'PLAY') {
                    const max = ROOMS[gameState.lang][gameState.room].options.length;
                    gameState.cursor = (gameState.cursor - 1 + max) % max;
                }
            }
        } else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
            if (!gameState.showHelp) {
                if (gameState.phase === 'LANG') gameState.cursor = (gameState.cursor + 1) % 2;
                else if (gameState.phase === 'NAME') charIndex = (charIndex + 1) % ALPHABET.length;
                else if (gameState.phase === 'PLAY') {
                    const max = ROOMS[gameState.lang][gameState.room].options.length;
                    gameState.cursor = (gameState.cursor + 1) % max;
                }
            }
        } else if (type === OsEventTypeList.CLICK_EVENT) {
            if (gameState.showHelp) {
                gameState.showHelp = false;
            } else if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
                gameState.phase = 'LANG'; gameState.hp = 10; gameState.inventory = []; gameState.room = 'ENTRANCE'; gameState.cursor = 0; charIndex = 0; gameState.name = '';
            } else if (gameState.phase === 'LANG') {
                gameState.lang = gameState.cursor === 0 ? 'IT' : 'EN'; gameState.phase = 'NAME';
            } else if (gameState.phase === 'NAME') {
                const char = ALPHABET[charIndex];
                if (char === '_') { if (gameState.name.length > 0) { gameState.phase = 'PLAY'; gameState.cursor = 0; } }
                else if (gameState.name.length < 8) { gameState.name += char; }
            } else if (gameState.phase === 'PLAY') {
                const roomData = ROOMS[gameState.lang][gameState.room];
                const opt = roomData.options[gameState.cursor];
                if (opt === "Help" || opt === "Aiuto") { gameState.showHelp = true; }
                else {
                    if (gameState.room === 'ENTRANCE') { if (gameState.cursor === 0) gameState.room = 'HALL'; else gameState.tempMsg = gameState.lang === 'IT' ? "Nulla." : "Nothing."; }
                    else if (gameState.room === 'HALL') { if (gameState.cursor === 0) { gameState.room = 'WELL'; gameState.hp -= 1; } else if (gameState.cursor === 1) gameState.room = 'ALTAR'; else if (gameState.cursor === 2) gameState.room = 'ENTRANCE'; }
                    else if (gameState.room === 'WELL') { if (gameState.cursor === 0) { const i = gameState.lang === 'IT' ? "Torcia" : "Torch"; if (!gameState.inventory.includes(i)) gameState.inventory.push(i); } else if (gameState.cursor === 1) gameState.room = 'HALL'; }
                    else if (gameState.room === 'ALTAR') { if (gameState.cursor === 0) gameState.phase = 'WIN'; else if (gameState.cursor === 1) gameState.room = 'HALL'; }
                    if (gameState.hp <= 0) gameState.phase = 'DEAD';
                    gameState.cursor = 0;
                }
            }
        } else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
            log("Global Exit Dialogue...");
            if (_bridge) _bridge.shutDownPageContainer(1);
        }
        syncUI();
    });

    // Forced forced refresh after handshake
    setTimeout(() => syncUI(), 1000);
}

init().catch(e => { log("CRITICAL INIT ERROR: " + e); updateStatus("Fatal Error"); });
