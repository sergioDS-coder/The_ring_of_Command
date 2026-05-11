import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    RebuildPageContainer,
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

const DEFAULT_TEXT_PROPS = {
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
    isEventCapture: 0
};
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
    phase: 'MENU' | 'LANG' | 'NAME' | 'PLAY' | 'DEAD' | 'WIN';
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

const ROOMS: Record<Language, Record<Room, { title: string; desc: string; options: string[]; art: string }>> = {
    IT: {
        ENTRANCE: {
            art: "  /|__\n /   |\n|  G2 |",
            title: "Il Cancello",
            desc: "Un cancello imponente. L'aria profuma di pino.",
            options: ["Entra", "Esamina", "Aiuto"]
        },
        HALL: {
            art: " |   |\n | o |",
            title: "Atrio",
            desc: "Un salone immenso. Senti acqua a Ovest.",
            options: ["Ovest (Pozzo)", "Nord", "Indietro", "Aiuto"]
        },
        WELL: {
            art: "  [ ]\n ( o )\n  ~~~",
            title: "Il Pozzo",
            desc: "Un pozzo di pietra. Qualcosa brilla.",
            options: ["Esamina", "Torna all'atrio", "Aiuto"]
        },
        ALTAR: {
            art: "  _A_\n /| |\\\n  ---",
            title: "L'Altare",
            desc: "Luce dorata. Un manufatto al centro.",
            options: ["Prendi", "Prega", "Aiuto"]
        }
    },
    EN: {
        ENTRANCE: {
            art: "  /|__\n /   |\n|  G2 |",
            title: "The Gate",
            desc: "A massive gate. Smells of pine.",
            options: ["Enter", "Examine", "Help"]
        },
        HALL: {
            art: " |   |\n | o |",
            title: "The Hall",
            desc: "A vast hall. Water drips to the West.",
            options: ["West (Well)", "North", "Go back", "Help"]
        },
        WELL: {
            art: "  [ ]\n ( o )\n  ~~~",
            title: "The Well",
            desc: "A stone well. Something glimmers.",
            options: ["Examine", "Back to hall", "Help"]
        },
        ALTAR: {
            art: "  _A_\n /| |\\\n  ---",
            title: "The Altar",
            desc: "Golden light. An artifact lies here.",
            options: ["Take", "Pray", "Help"]
        }
    }
};

const HELP_TEXT: Record<Language, string> = {
    IT: "AIUTO:\nScorri: Naviga opzioni.\nClick: Conferma.\nDoppio Click: Esci.",
    EN: "HELP:\nScroll: Navigate options.\nClick: Confirm.\nDouble Click: Exit."
};

let gameState: GameState = {
    phase: 'MENU', lang: 'IT', name: '', hp: 10, inventory: [], room: 'ENTRANCE', cursor: 0, options: [], showHelp: false, tempMsg: ''
};

async function saveGame() {
    if (!_bridge) return;
    try {
        await _bridge.setLocalStorage('g2_lang', gameState.lang);
        await _bridge.setLocalStorage('g2_name', gameState.name);
        await _bridge.setLocalStorage('g2_room', gameState.room);
        await _bridge.setLocalStorage('g2_hp', String(gameState.hp));
        await _bridge.setLocalStorage('g2_inv', JSON.stringify(gameState.inventory));
        log("Game Saved");
    } catch (e) { log("Save Error: " + e); }
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let charIndex = 0;

// --- Requested 'even' wrapper ---
const even = {
    showCard: async (title: string, desc: string, forceRebuild = false) => {
        if (!_bridge) return;
        log(`Showing Card: ${title} (rebuild=${forceRebuild})`);
        try {
            if (forceRebuild) {
                const layout = new RebuildPageContainer({
                    containerTotalNum: 2,
                    textObject: [
                        new TextContainerProperty({ ...DEFAULT_TEXT_PROPS, containerID: 0, xPosition: 40, yPosition: 16, width: 496, height: 56, content: title }),
                        new TextContainerProperty({ ...DEFAULT_TEXT_PROPS, containerID: 1, xPosition: 40, yPosition: 80, width: 496, height: 192, content: desc, isEventCapture: 1 })
                    ]
                });
                await _bridge.rebuildPageContainer(layout);
            } else {
                await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 0, content: title }));
                await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, content: desc }));
            }
        } catch (e) { log("showCard Error: " + e); }
    }
};

function getTitle() {
    if (gameState.showHelp) return "Help / Aiuto";
    if (gameState.phase === 'MENU') return "G2 Chronicles";
    if (gameState.phase === 'LANG') return (gameState.lang === 'IT' ? "Lingua" : "Language");
    if (gameState.phase === 'NAME') return (gameState.lang === 'IT' ? "Nome: " : "Name: ") + gameState.name + ALPHABET[charIndex];
    if (gameState.phase === 'DEAD') return gameState.lang === 'IT' ? "GAME OVER" : "YOU DIED";
    if (gameState.phase === 'WIN') return gameState.lang === 'IT' ? "VITTORIA!" : "VICTORY!";
    return ROOMS[gameState.lang][gameState.room].title;
}

function getDescription() {
    if (gameState.showHelp) {
        let help = HELP_TEXT[gameState.lang] + "\n\n(Click per chiudere)";
        help += gameState.lang === 'IT' ? "\n\n> Reset Dati" : "\n\n> Reset Data";
        return help;
    }
    if (gameState.phase === 'MENU') {
        const options = gameState.lang === 'IT' ? ["Inizia/Continua", "Cambia Lingua", "Cambia Nome"] : ["Start/Continue", "Change Language", "Change Name"];
        let d = (gameState.lang === 'IT' ? "Bentornato, " : "Welcome back, ") + (gameState.name || "Eroe") + "\n\n";
        options.forEach((opt, i) => { d += (i === gameState.cursor ? "> " : "  ") + opt + "\n"; });
        return d;
    }
    if (gameState.phase === 'LANG') return (gameState.lang === 'IT' ? "Seleziona Lingua" : "Select Language") + "\n\n" + (gameState.cursor === 0 ? "> ITALIANO" : "  ITALIANO") + "\n" + (gameState.cursor === 1 ? "> ENGLISH" : "  ENGLISH");
    if (gameState.phase === 'NAME') return (gameState.lang === 'IT' ? "Scorri per cambiare lettera.\nSeleziona '_' per confermare." : "Scroll to change letter.\nSelect '_' to confirm.");
    if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') return (gameState.phase === 'DEAD' ? (gameState.lang === 'IT' ? "La tua avventura finisce qui." : "Adventure ends here.") : (gameState.lang === 'IT' ? "Mondo salvo!" : "World saved!")) + (gameState.lang === 'IT' ? "\n\n> Ricomincia" : "\n\n> Restart");
    const room = ROOMS[gameState.lang][gameState.room];
    let d = room.art + "\n\n";
    d += (gameState.tempMsg ? gameState.tempMsg + "\n\n" : "") + room.desc + "\n\nHP: " + gameState.hp;
    if (gameState.inventory.length > 0) d += "\nInv: " + gameState.inventory.join(", ");
    d += "\n\n";
    room.options.forEach((opt, i) => { d += (i === gameState.cursor ? "> " : "  ") + opt + "\n"; });
    return d;
}

// --- Controller Logic ---
function onScroll(direction: 'UP' | 'DOWN') {
    if (gameState.showHelp) {
        const delta = direction === 'UP' ? -1 : 1;
        gameState.cursor = (gameState.cursor + delta + 2) % 2;
        return;
    }
    const delta = direction === 'UP' ? -1 : 1;

    if (gameState.phase === 'MENU') gameState.cursor = (gameState.cursor + delta + 3) % 3;
    else if (gameState.phase === 'LANG') gameState.cursor = (gameState.cursor + delta + 2) % 2;
    else if (gameState.phase === 'NAME') charIndex = (charIndex + delta + ALPHABET.length) % ALPHABET.length;
    else if (gameState.phase === 'PLAY') {
        const max = ROOMS[gameState.lang][gameState.room].options.length;
        gameState.cursor = (gameState.cursor + delta + max) % max;
    }
}

function onSelect(): boolean {
    let needsRebuild = false;
    if (gameState.showHelp) {
        if (gameState.cursor === 1) { // Reset Data
            if (_bridge) {
                _bridge.setLocalStorage('g2_lang', '');
                _bridge.setLocalStorage('g2_name', '');
                _bridge.setLocalStorage('g2_room', 'ENTRANCE');
                _bridge.setLocalStorage('g2_hp', '10');
                _bridge.setLocalStorage('g2_inv', '[]');
            }
            gameState.phase = 'LANG'; gameState.hp = 10; gameState.inventory = []; gameState.room = 'ENTRANCE'; gameState.cursor = 0; charIndex = 0; gameState.name = '';
            needsRebuild = true;
        }
        gameState.showHelp = false;
        gameState.cursor = 0;
    } else if (gameState.phase === 'MENU') {
        if (gameState.cursor === 0) {
            if (!gameState.name) { gameState.phase = 'LANG'; needsRebuild = true; }
            else { gameState.phase = 'PLAY'; needsRebuild = true; }
        } else if (gameState.cursor === 1) { gameState.phase = 'LANG'; needsRebuild = true; }
        else if (gameState.cursor === 2) { gameState.phase = 'NAME'; needsRebuild = true; }
        gameState.cursor = 0;
    } else if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
        gameState.phase = 'MENU'; gameState.hp = 10; gameState.inventory = []; gameState.room = 'ENTRANCE'; gameState.cursor = 0; charIndex = 0;
        needsRebuild = true;
        saveGame();
    } else if (gameState.phase === 'LANG') {
        gameState.lang = gameState.cursor === 0 ? 'IT' : 'EN';
        gameState.phase = 'NAME';
        needsRebuild = true;
        saveGame();
    } else if (gameState.phase === 'NAME') {
        const char = ALPHABET[charIndex];
        if (char === '_') {
            if (gameState.name.length > 0) {
                gameState.phase = 'MENU';
                gameState.cursor = 0;
                needsRebuild = true;
                saveGame();
            }
        } else if (gameState.name.length < 8) {
            gameState.name += char;
        }
    } else if (gameState.phase === 'PLAY') {
        const roomData = ROOMS[gameState.lang][gameState.room];
        const opt = roomData.options[gameState.cursor];
        if (opt === "Help" || opt === "Aiuto") {
            gameState.showHelp = true;
        } else {
            gameState.tempMsg = '';
            if (gameState.room === 'ENTRANCE') {
                if (gameState.cursor === 0) gameState.room = 'HALL';
                else gameState.tempMsg = gameState.lang === 'IT' ? "Nulla di interessante." : "Nothing interesting.";
            } else if (gameState.room === 'HALL') {
                if (gameState.cursor === 0) { gameState.room = 'WELL'; gameState.hp -= 1; }
                else if (gameState.cursor === 1) gameState.room = 'ALTAR';
                else if (gameState.cursor === 2) gameState.room = 'ENTRANCE';
            } else if (gameState.room === 'WELL') {
                if (gameState.cursor === 0) {
                    const i = gameState.lang === 'IT' ? "Torcia" : "Torch";
                    if (!gameState.inventory.includes(i)) {
                        gameState.inventory.push(i);
                        gameState.tempMsg = gameState.lang === 'IT' ? "Hai preso la torcia!" : "You got the torch!";
                    }
                } else if (gameState.cursor === 1) gameState.room = 'HALL';
            } else if (gameState.room === 'ALTAR') {
                if (gameState.cursor === 0) {
                    gameState.phase = 'WIN';
                    needsRebuild = true;
                } else if (gameState.cursor === 1) gameState.room = 'HALL';
            }
            if (gameState.hp <= 0) {
                gameState.phase = 'DEAD';
                needsRebuild = true;
            }
            gameState.cursor = 0;
            saveGame();
        }
    }
    return needsRebuild;
}

// --- Even SDK Logic ---
let _bridge: EvenAppBridge | null = null;

async function init() {
    updateStatus("Connecting...");
    _bridge = await waitForEvenAppBridge();
    updateStatus("Connected!");

    try {
        const lang = await _bridge.getLocalStorage('g2_lang');
        const name = await _bridge.getLocalStorage('g2_name');
        const room = await _bridge.getLocalStorage('g2_room');
        const hp = await _bridge.getLocalStorage('g2_hp');
        const inv = await _bridge.getLocalStorage('g2_inv');

        if (lang) gameState.lang = lang as Language;
        if (name) gameState.name = name;
        if (room) gameState.room = room as Room;
        if (hp) gameState.hp = Number(hp);
        if (inv) gameState.inventory = JSON.parse(inv);

        log(`Session Loaded: ${gameState.name} (${gameState.lang}) at ${gameState.room}`);
        gameState.phase = 'MENU';
    } catch (e) { log("Storage Load Error: " + e); }

    const tProp = new TextContainerProperty({
        ...DEFAULT_TEXT_PROPS,
        containerID: 0, xPosition: 40, yPosition: 16, width: 496, height: 56, content: getTitle()
    });

    const dProp = new TextContainerProperty({
        ...DEFAULT_TEXT_PROPS,
        containerID: 1, xPosition: 40, yPosition: 80, width: 496, height: 192, content: getDescription(), isEventCapture: 1
    });

    try {
        const layout = new CreateStartUpPageContainer({
            containerTotalNum: 2,
            textObject: [tProp, dProp]
        });

        const res = await _bridge.createStartUpPageContainer(layout);
        log("Layout Response: " + res);
        updateStatus(res === 0 ? "Display Active" : `Layout Error: ${res}`);
    } catch (e) {
        log("Init Exception: " + e);
        updateStatus("Init Exception");
    }

    _bridge.onEvenHubEvent((event: EvenHubEvent) => {
        log(`RAW: ${JSON.stringify(event)}`);

        let type: number | undefined = undefined;

        // Try to get type from typed events
        const anyEvent = (event.textEvent || event.sysEvent || event.listEvent) as any;
        if (anyEvent) {
            if (anyEvent.eventType !== undefined) {
                type = Number(anyEvent.eventType);
            } else if (anyEvent.eventSource !== undefined) {
                // In some cases, eventType: 0 (Click) might be omitted in JSON
                log("eventType missing, but eventSource exists. Assuming CLICK (0)");
                type = 0;
            }
        }

        // Fallback to jsonData if still undefined
        if (type === undefined && event.jsonData) {
            const data = event.jsonData;
            if (data.eventType !== undefined) type = Number(data.eventType);
            else if (data.sysEvent?.eventType !== undefined) type = Number(data.sysEvent.eventType);
            else if (data.textEvent?.eventType !== undefined) type = Number(data.textEvent.eventType);
        }

        if (type === undefined) return;

        let needsRebuild = false;

        // SCROLL_TOP (1)
        if (type === 1 || type === OsEventTypeList.SCROLL_TOP_EVENT) {
            onScroll('UP');
        }
        // SCROLL_BOTTOM (2)
        else if (type === 2 || type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
            onScroll('DOWN');
        }
        // CLICK (0)
        else if (type === 0 || type === OsEventTypeList.CLICK_EVENT) {
            needsRebuild = onSelect();
        }
        // DOUBLE CLICK (3)
        else if (type === 3 || type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
            log("Exit via Double Click");
            if (_bridge) _bridge.shutDownPageContainer(1);
        }

        even.showCard(getTitle(), getDescription(), needsRebuild);
    });

    setTimeout(() => even.showCard(getTitle(), getDescription()), 1000);
}

init().catch(e => log("Fatal: " + e));
