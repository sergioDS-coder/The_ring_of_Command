import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    RebuildPageContainer,
    TextContainerProperty,
    TextContainerUpgrade,
    ImageContainerProperty,
    ImageRawDataUpdate,
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

// --- Image Helpers ---
class Painter {
    data: number[];
    width: number;
    height: number;

    constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.data = new Array(w * h).fill(0);
    }

    setPixel(x: number, y: number, color: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.data[y * this.width + x] = color;
    }

    drawRect(x: number, y: number, w: number, h: number, color: number, filled = true) {
        for (let i = x; i < x + w; i++) {
            for (let j = y; j < y + h; j++) {
                if (filled || i === x || i === x + w - 1 || j === y || j === y + h - 1) {
                    this.setPixel(i, j, color);
                }
            }
        }
    }

    drawCircle(cx: number, cy: number, r: number, color: number, filled = true) {
        const r2 = r * r;
        for (let x = cx - r; x <= cx + r; x++) {
            for (let y = cy - r; y <= cy + r; y++) {
                const d2 = (x - cx) ** 2 + (y - cy) ** 2;
                if (filled ? d2 <= r2 : Math.abs(d2 - r2) < r) {
                    this.setPixel(x, y, color);
                }
            }
        }
    }

    drawTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: number) {
        // Simple bounding box filling
        const minX = Math.min(x1, x2, x3), maxX = Math.max(x1, x2, x3);
        const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const b1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2) < 0;
                const b2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3) < 0;
                const b3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1) < 0;
                if ((b1 === b2) && (b2 === b3)) this.setPixel(x, y, color);
            }
        }
    }

    toPng(): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        const imageData = ctx.createImageData(this.width, this.height);
        for (let i = 0; i < this.data.length; i++) {
            const color = Math.min(15, this.data[i]) * 17;
            const idx = i * 4;
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = color;
            imageData.data[idx + 2] = 0;
            imageData.data[idx + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png').split(',')[1];
    }
}

function generateProceduralImage(type: string): string {
    const p = new Painter(144, 144);
    if (type === 'MENU') {
        for (let i = 0; i < 144; i += 8) p.drawRect(i, 0, 1, 144, 2);
        for (let i = 0; i < 144; i += 8) p.drawRect(0, i, 144, 1, 2);
        p.drawRect(20, 20, 104, 104, 1, true);
    } else if (type === 'FOREST') {
        p.drawRect(0, 100, 144, 44, 2); // Ground
        for (let i = 10; i < 144; i += 30) {
            p.drawTriangle(i, 110, i + 15, 40, i + 30, 110, 5); // Trees
            p.drawRect(i + 12, 110, 6, 20, 3); // Trunks
        }
    } else if (type === 'OAK') {
        p.drawRect(64, 80, 16, 60, 4); // Trunk
        p.drawCircle(72, 60, 45, 8); // Canopy
        p.drawCircle(60, 50, 10, 10); // Detail
        p.drawCircle(85, 55, 8, 10);
    } else if (type === 'GATE') {
        p.drawRect(20, 40, 104, 104, 6); // Wall
        p.drawRect(40, 60, 64, 84, 0); // Arch
        for (let i = 20; i < 124; i += 10) p.drawRect(i, 40, 1, 104, 8); // Bricks
    } else if (type === 'TAVERN') {
        p.drawRect(10, 40, 124, 104, 4); // Building
        p.drawRect(30, 10, 84, 30, 8); // Roof
        p.drawRect(60, 90, 24, 54, 2); // Door
        p.drawRect(30, 60, 20, 20, 12); // Window
    } else if (type === 'FORGE') {
        p.drawRect(0, 0, 144, 144, 1);
        p.drawCircle(72, 100, 40, 3); // Furnace
        p.drawCircle(72, 100, 25, 14); // Fire
    } else if (type === 'BRIDGE') {
        p.drawRect(0, 80, 144, 30, 6); // Bridge side
        for (let i = 0; i < 144; i += 20) p.drawRect(i, 80, 5, 64, 4); // Pillars
    } else if (type === 'CAVE') {
        p.drawRect(0, 0, 144, 144, 2);
        p.drawCircle(72, 144, 100, 0); // Entrance
        for (let i = 0; i < 10; i++) p.drawCircle(Math.random()*144, Math.random()*144, 2, 8); // Rocks
    } else if (type === 'MOUNTAIN') {
        p.drawTriangle(0, 144, 72, 20, 144, 144, 4); // Main peak
        p.drawTriangle(72, 20, 60, 40, 84, 40, 15); // Snow cap
    } else if (type === 'TOWER') {
        p.drawRect(50, 20, 44, 124, 7); // Main tower
        p.drawRect(45, 10, 54, 15, 9); // Battlement
        p.drawRect(65, 40, 14, 20, 0); // Window
    } else if (type === 'THRONE') {
        p.drawRect(40, 60, 64, 84, 8); // Throne back
        p.drawRect(40, 110, 64, 34, 6); // Seat
        p.drawRect(30, 100, 10, 44, 10); // Armrest
        p.drawRect(104, 100, 10, 44, 10);
    } else if (type === 'SKULL') {
        p.drawCircle(72, 72, 40, 15); // Head
        p.drawCircle(55, 65, 10, 0); // Eye L
        p.drawCircle(89, 65, 10, 0); // Eye R
        p.drawRect(62, 100, 20, 15, 12); // Teeth
    } else if (type === 'CROWN') {
        p.drawRect(30, 60, 84, 30, 15); // Base
        p.drawTriangle(30, 60, 45, 30, 60, 60, 15); // Point 1
        p.drawTriangle(60, 60, 72, 20, 84, 60, 15); // Point 2
        p.drawTriangle(84, 60, 99, 30, 114, 60, 15); // Point 3
    } else if (type === 'SWORD') {
        p.drawRect(70, 20, 4, 100, 12); // Blade
        p.drawRect(52, 100, 40, 4, 8); // Crossguard
        p.drawRect(68, 110, 8, 24, 4); // Handle
        p.drawCircle(72, 134, 6, 10); // Pommel
    } else if (type === 'POTION') {
        p.drawCircle(72, 100, 35, 6); // Bottle
        p.drawRect(72 - 35, 100, 70, 35, 14); // Liquid
        p.drawRect(64, 40, 16, 30, 4); // Neck
    } else if (type === 'ORC') {
        p.drawCircle(72, 60, 30, 4); // Head
        p.drawRect(40, 90, 64, 54, 2); // Body
        p.drawRect(50, 50, 10, 5, 15); // Tusk L
        p.drawRect(84, 50, 10, 5, 15); // Tusk R
    } else if (type === 'DRAGON') {
        p.drawTriangle(10, 72, 72, 20, 134, 72, 9); // Wings
        p.drawCircle(72, 80, 40, 12); // Body
        p.drawCircle(100, 60, 15, 6); // Head
        p.drawTriangle(115, 60, 140, 50, 140, 70, 14); // Fire
    } else if (type === 'PRINCESS') {
        p.drawTriangle(42, 144, 72, 60, 102, 144, 10); // Dress
        p.drawCircle(72, 50, 20, 14); // Head
        p.drawTriangle(62, 35, 72, 15, 82, 35, 15); // Crown
    } else if (type === 'MAP') {
        p.drawRect(20, 20, 104, 104, 13); // Paper
        p.drawRect(25, 25, 94, 94, 0, false); // Border
        p.drawRect(40, 60, 60, 2, 0); // Path
    }
    return p.toPng();
}

const IMAGES: Record<string, string> = {
    DEFAULT: generateProceduralImage('MENU'),
    FOREST: generateProceduralImage('FOREST'),
    OAK: generateProceduralImage('OAK'),
    GATE: generateProceduralImage('GATE'),
    TAVERN: generateProceduralImage('TAVERN'),
    FORGE: generateProceduralImage('FORGE'),
    PATH: generateProceduralImage('FOREST'),
    BRIDGE: generateProceduralImage('BRIDGE'),
    CAVE: generateProceduralImage('CAVE'),
    LAKE: generateProceduralImage('CAVE'),
    MOUNTAIN: generateProceduralImage('MOUNTAIN'),
    TOWER: generateProceduralImage('TOWER'),
    THRONE: generateProceduralImage('THRONE'),
    SKULL: generateProceduralImage('SKULL'),
    CROWN: generateProceduralImage('CROWN'),
    MENU: generateProceduralImage('MENU'),
    SWORD: generateProceduralImage('SWORD'),
    POTION: generateProceduralImage('POTION'),
    ORC: generateProceduralImage('ORC'),
    DRAGON: generateProceduralImage('DRAGON'),
    PRINCESS: generateProceduralImage('PRINCESS'),
    MAP: generateProceduralImage('MAP')
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
type Room =
    'FOREST_EDGE' | 'OLD_OAK' | 'VILLAGE_GATE' | 'TAVERN' | 'BLACKSMITH' |
    'MISTY_PATH' | 'ORC_BRIDGE' | 'DARK_CAVE' | 'HIDDEN_LAKE' |
    'MOUNTAIN_BASE' | 'DRAGON_TOWER' | 'THRONE_ROOM';

interface GameState {
    phase: 'MENU' | 'LANG' | 'NAME' | 'PLAY' | 'DEAD' | 'WIN';
    lang: Language;
    name: string;
    hp: number;
    inventory: string[];
    room: Room;
    flags: Record<string, boolean>;
    cursor: number;
    options: string[];
    showHelp: boolean;
    tempMsg: string;
}

const ROOMS: Record<Language, Record<Room, (state: GameState) => { title: string; desc: string; options: string[]; image: string }>> = {
    IT: {
        FOREST_EDGE: () => ({
            image: "FOREST",
            title: "Confine del Bosco",
            desc: "L'alba rischiara una foresta antica. Senti il richiamo dell'ignoto.",
            options: ["Vai a Nord (Quercia)", "Vai a Est (Villaggio)", "Aiuto"]
        }),
        OLD_OAK: (s) => ({
            image: "OAK",
            title: "Antica Quercia",
            desc: "Un albero millenario. Un vecchio cavaliere siede qui stanco.",
            options: s.flags.met_knight ? ["Parla con Sir Alistair", "Vai a Sud", "Aiuto"] : ["Avvicinati al cavaliere", "Vai a Sud", "Aiuto"]
        }),
        VILLAGE_GATE: () => ({
            image: "GATE",
            title: "Porta di Oakhaven",
            desc: "Un ridente villaggio. Gli abitanti sembrano preoccupati per le voci di un drago.",
            options: ["Entra nella Locanda", "Visita il Fabbro", "Vai a Ovest", "Aiuto"]
        }),
        TAVERN: (s) => ({
            image: s.flags.got_map ? "TAVERN" : "MAP",
            title: "Locanda 'Il Boccale'",
            desc: "Odore di stufato e birra. Un bardo canta la ballata della Principessa rapita.",
            options: s.flags.got_map ? ["Parla col Bardo", "Esci", "Aiuto"] : ["Chiedi della mappa", "Ascolta musica", "Esci", "Aiuto"]
        }),
        BLACKSMITH: (s) => ({
            image: "SWORD",
            title: "La Fucina",
            desc: "Il calore è intenso. Il fabbro batte il ferro con forza ritmica.",
            options: s.inventory.includes("Spada") ? ["Affila la spada", "Esci", "Aiuto"] : ["Compra una Spada", "Esci", "Aiuto"]
        }),
        MISTY_PATH: () => ({
            image: "PATH",
            title: "Sentiero Nebbioso",
            desc: "La visibilità è scarsa. Senti dei grugniti in lontananza.",
            options: ["Prosegui a Nord", "Torna al Villaggio", "Aiuto"]
        }),
        ORC_BRIDGE: (s) => ({
            image: s.flags.orc_dead ? "BRIDGE" : "ORC",
            title: "Ponte di Pietra",
            desc: s.flags.orc_dead ? "Il corpo dell'orco giace a terra. Il ponte è libero." : "Un enorme Orco blocca il passaggio brandendo una clava nodosa.",
            options: s.flags.orc_dead ? ["Attraversa il ponte", "Torna indietro", "Aiuto"] : ["Combatti l'Orco", "Tenta di sgattaiolare", "Torna indietro", "Aiuto"]
        }),
        DARK_CAVE: (s) => ({
            image: "CAVE",
            title: "Caverna Oscura",
            desc: "Gocce d'acqua cadono dal soffitto. Gli occhi di piccoli goblin brillano nel buio.",
            options: s.flags.cave_cleared ? ["Prosegui a Nord", "Esci", "Aiuto"] : ["Attacca i Goblin", "Cerca tesori", "Esci", "Aiuto"]
        }),
        HIDDEN_LAKE: () => ({
            image: "POTION",
            title: "Lago Nascosto",
            desc: "Un'oasi di pace. Un vecchio mercante offre oggetti rari.",
            options: ["Compra Pozione HP", "Vai a Nord", "Aiuto"]
        }),
        MOUNTAIN_BASE: () => ({
            image: "MOUNTAIN",
            title: "Piedi della Montagna",
            desc: "Il vento ulula. Sopra di te svetta la torre del drago.",
            options: ["Scala la torre", "Torna al lago", "Aiuto"]
        }),
        DRAGON_TOWER: (s) => ({
            image: s.flags.dragon_dead ? "TOWER" : "DRAGON",
            title: "Torre del Drago",
            desc: s.flags.dragon_dead ? "Le fiamme si sono spente. Il drago è caduto." : "Un Drago Sputafuoco sorveglia l'ingresso. Il calore è insopportabile.",
            options: s.flags.dragon_dead ? ["Entra nella stanza", "Torna giù", "Aiuto"] : ["Sfida il Drago", "Usa la pozione", "Torna giù", "Aiuto"]
        }),
        THRONE_ROOM: () => ({
            image: "PRINCESS",
            title: "Sala del Trono",
            desc: "La Principessa è incatenata al trono. Ti guarda con speranza.",
            options: ["Libera la Principessa", "Esamina tesori", "Aiuto"]
        })
    },
    EN: {
        FOREST_EDGE: () => ({
            image: "FOREST",
            title: "Forest Edge",
            desc: "Dawn breaks over an ancient forest. You feel the call of the unknown.",
            options: ["Go North (Oak)", "Go East (Village)", "Help"]
        }),
        OLD_OAK: (s) => ({
            image: "OAK",
            title: "Old Oak",
            desc: "A thousand-year-old tree. A tired old knight sits here.",
            options: s.flags.met_knight ? ["Speak with Sir Alistair", "Go South", "Help"] : ["Approach the knight", "Go South", "Help"]
        }),
        VILLAGE_GATE: () => ({
            image: "GATE",
            title: "Oakhaven Gate",
            desc: "A peaceful village. Residents seem worried about dragon rumors.",
            options: ["Enter the Tavern", "Visit Blacksmith", "Go West", "Help"]
        }),
        TAVERN: (s) => ({
            image: s.flags.got_map ? "TAVERN" : "MAP",
            title: "The Tankard Tavern",
            desc: "Smell of stew and ale. A bard sings of the kidnapped Princess.",
            options: s.flags.got_map ? ["Talk to Bard", "Exit", "Help"] : ["Ask for map", "Listen to music", "Exit", "Help"]
        }),
        BLACKSMITH: (s) => ({
            image: "SWORD",
            title: "The Forge",
            desc: "Intense heat. The smith strikes iron with rhythmic force.",
            options: s.inventory.includes("Sword") ? ["Sharpen sword", "Exit", "Help"] : ["Buy a Sword", "Exit", "Help"]
        }),
        MISTY_PATH: () => ({
            image: "PATH",
            title: "Misty Path",
            desc: "Visibility is low. You hear grunts in the distance.",
            options: ["Proceed North", "Back to Village", "Help"]
        }),
        ORC_BRIDGE: (s) => ({
            image: s.flags.orc_dead ? "BRIDGE" : "ORC",
            title: "Stone Bridge",
            desc: s.flags.orc_dead ? "The orc's body lies on the ground. The bridge is clear." : "A massive Orc blocks the way wielding a gnarled club.",
            options: s.flags.orc_dead ? ["Cross the bridge", "Go back", "Help"] : ["Fight the Orc", "Try to sneak", "Go back", "Help"]
        }),
        DARK_CAVE: (s) => ({
            image: "CAVE",
            title: "Dark Cave",
            desc: "Water drips from the ceiling. Small goblin eyes glint in the dark.",
            options: s.flags.cave_cleared ? ["Proceed North", "Exit", "Help"] : ["Attack Goblins", "Search for loot", "Exit", "Help"]
        }),
        HIDDEN_LAKE: () => ({
            image: "POTION",
            title: "Hidden Lake",
            desc: "An oasis of peace. An old merchant offers rare items.",
            options: ["Buy HP Potion", "Go North", "Help"]
        }),
        MOUNTAIN_BASE: () => ({
            image: "MOUNTAIN",
            title: "Mountain Base",
            desc: "Wind howls. Above you looms the dragon's tower.",
            options: ["Climb the tower", "Back to lake", "Help"]
        }),
        DRAGON_TOWER: (s) => ({
            image: s.flags.dragon_dead ? "TOWER" : "DRAGON",
            title: "Dragon Tower",
            desc: s.flags.dragon_dead ? "The flames have died out. The dragon has fallen." : "A fire-breathing Dragon guards the entrance. Heat is unbearable.",
            options: s.flags.dragon_dead ? ["Enter the room", "Go down", "Help"] : ["Challenge Dragon", "Use potion", "Go down", "Help"]
        }),
        THRONE_ROOM: () => ({
            image: "PRINCESS",
            title: "Throne Room",
            desc: "The Princess is chained to the throne. She looks at you with hope.",
            options: ["Free the Princess", "Examine treasures", "Help"]
        })
    }
};

const HELP_TEXT: Record<Language, string> = {
    IT: "AIUTO:\nScorri: Naviga opzioni.\nClick: Conferma.\nDoppio Click: Esci.",
    EN: "HELP:\nScroll: Navigate options.\nClick: Confirm.\nDouble Click: Exit."
};

let gameState: GameState = {
    phase: 'MENU', lang: 'IT', name: '', hp: 12, inventory: [], room: 'FOREST_EDGE', flags: {}, cursor: 0, options: [], showHelp: false, tempMsg: ''
};

async function saveGame() {
    if (!_bridge) return;
    try {
        await _bridge.setLocalStorage('g2_lang', gameState.lang);
        await _bridge.setLocalStorage('g2_name', gameState.name);
        await _bridge.setLocalStorage('g2_room', gameState.room);
        await _bridge.setLocalStorage('g2_hp', String(gameState.hp));
        await _bridge.setLocalStorage('g2_inv', JSON.stringify(gameState.inventory));
        await _bridge.setLocalStorage('g2_flags', JSON.stringify(gameState.flags));
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
                    containerTotalNum: 3,
                    textObject: [
                        new TextContainerProperty({ ...DEFAULT_TEXT_PROPS, containerID: 0, xPosition: 40, yPosition: 16, width: 496, height: 56, content: title }),
                        new TextContainerProperty({ ...DEFAULT_TEXT_PROPS, containerID: 1, xPosition: 200, yPosition: 80, width: 336, height: 192, content: desc, isEventCapture: 1 })
                    ],
                    imageObject: [
                        new ImageContainerProperty({ containerID: 2, xPosition: 40, yPosition: 80, width: 144, height: 144 })
                    ]
                });
                await _bridge.rebuildPageContainer(layout);
            } else {
                await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 0, content: title }));
                await _bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, content: desc }));
            }

            // Update Image based on phase/room
            let imgKey = "DEFAULT";
            if (gameState.phase === 'PLAY') {
                imgKey = ROOMS[gameState.lang][gameState.room](gameState).image;
            } else if (gameState.phase === 'MENU') {
                imgKey = "MENU";
            } else if (gameState.phase === 'DEAD') {
                imgKey = "SKULL";
            } else if (gameState.phase === 'WIN') {
                imgKey = "CROWN";
            }

            const imgData = IMAGES[imgKey] || IMAGES.DEFAULT;
            await _bridge.updateImageRawData(new ImageRawDataUpdate({
                containerID: 2,
                imageData: imgData
            }));
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
    return ROOMS[gameState.lang][gameState.room](gameState).title;
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
    const room = ROOMS[gameState.lang][gameState.room](gameState);
    let d = (gameState.tempMsg ? gameState.tempMsg + "\n\n" : "") + room.desc + "\n\nHP: " + gameState.hp;
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
        const max = ROOMS[gameState.lang][gameState.room](gameState).options.length;
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
                _bridge.setLocalStorage('g2_room', 'FOREST_EDGE');
                _bridge.setLocalStorage('g2_hp', '12');
                _bridge.setLocalStorage('g2_inv', '[]');
                _bridge.setLocalStorage('g2_flags', '{}');
            }
            gameState.phase = 'LANG'; gameState.hp = 12; gameState.inventory = []; gameState.room = 'FOREST_EDGE'; gameState.flags = {}; gameState.cursor = 0; charIndex = 0; gameState.name = '';
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
        gameState.phase = 'MENU'; gameState.hp = 12; gameState.inventory = []; gameState.room = 'FOREST_EDGE'; gameState.flags = {}; gameState.cursor = 0; charIndex = 0;
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
        const roomData = ROOMS[gameState.lang][gameState.room](gameState);
        const opt = roomData.options[gameState.cursor];
        if (opt === "Help" || opt === "Aiuto") {
            gameState.showHelp = true;
        } else {
            gameState.tempMsg = '';
            const IT = gameState.lang === 'IT';

            if (gameState.room === 'FOREST_EDGE') {
                if (gameState.cursor === 0) gameState.room = 'OLD_OAK';
                else if (gameState.cursor === 1) gameState.room = 'VILLAGE_GATE';
            } else if (gameState.room === 'OLD_OAK') {
                if (gameState.cursor === 0) {
                    if (!gameState.flags.met_knight) {
                        gameState.tempMsg = IT ? "Sir Alistair ti affida una missione." : "Sir Alistair entrusts you with a quest.";
                        gameState.flags.met_knight = true;
                    } else {
                        gameState.tempMsg = IT ? "'Trova la principessa, giovane!'" : "'Find the princess, youth!'";
                    }
                } else if (gameState.cursor === 1) gameState.room = 'FOREST_EDGE';
            } else if (gameState.room === 'VILLAGE_GATE') {
                if (gameState.cursor === 0) gameState.room = 'TAVERN';
                else if (gameState.cursor === 1) gameState.room = 'BLACKSMITH';
                else if (gameState.cursor === 2) gameState.room = 'FOREST_EDGE';
            } else if (gameState.room === 'TAVERN') {
                if (gameState.cursor === 0) {
                    if (!gameState.flags.got_map) {
                        gameState.tempMsg = IT ? "Hai ottenuto la mappa del Sentiero!" : "You got the Path map!";
                        gameState.flags.got_map = true;
                    } else gameState.tempMsg = IT ? "Il bardo sorride." : "The bard smiles.";
                } else if (gameState.cursor === 2 || (gameState.flags.got_map && gameState.cursor === 1)) {
                    gameState.room = 'VILLAGE_GATE';
                }
            } else if (gameState.room === 'BLACKSMITH') {
                if (gameState.cursor === 0) {
                    const sword = IT ? "Spada" : "Sword";
                    if (!gameState.inventory.includes(sword)) {
                        gameState.inventory.push(sword);
                        gameState.tempMsg = IT ? "Ora sei armato!" : "Now you are armed!";
                    } else gameState.tempMsg = IT ? "La spada brilla." : "The sword glints.";
                } else if (gameState.cursor === 1) gameState.room = 'VILLAGE_GATE';
            } else if (gameState.room === 'MISTY_PATH') {
                if (gameState.cursor === 0) gameState.room = 'ORC_BRIDGE';
                else if (gameState.cursor === 1) gameState.room = 'VILLAGE_GATE';
            } else if (gameState.room === 'ORC_BRIDGE') {
                if (gameState.flags.orc_dead) {
                    if (gameState.cursor === 0) gameState.room = 'DARK_CAVE';
                    else if (gameState.cursor === 1) gameState.room = 'MISTY_PATH';
                } else {
                    if (gameState.cursor === 0) {
                        if (gameState.inventory.includes("Spada") || gameState.inventory.includes("Sword")) {
                            gameState.tempMsg = IT ? "Uccidi l'Orco!" : "You kill the Orc!";
                            gameState.flags.orc_dead = true;
                        } else {
                            gameState.tempMsg = IT ? "L'Orco ti colpisce! Scappa!" : "The Orc hits you! Run!";
                            gameState.hp -= 3;
                        }
                    } else if (gameState.cursor === 1) {
                        if (Math.random() > 0.5) {
                            gameState.tempMsg = IT ? "Sgattaioli oltre." : "You sneak past.";
                            gameState.room = 'DARK_CAVE';
                        } else {
                            gameState.tempMsg = IT ? "L'Orco ti vede! -1 HP" : "The Orc sees you! -1 HP";
                            gameState.hp -= 1;
                        }
                    } else if (gameState.cursor === 2) gameState.room = 'MISTY_PATH';
                }
            } else if (gameState.room === 'DARK_CAVE') {
                if (gameState.flags.cave_cleared) {
                    if (gameState.cursor === 0) gameState.room = 'HIDDEN_LAKE';
                    else if (gameState.cursor === 1) gameState.room = 'ORC_BRIDGE';
                } else {
                    if (gameState.cursor === 0) {
                        gameState.tempMsg = IT ? "Goblin sconfitti!" : "Goblins defeated!";
                        gameState.flags.cave_cleared = true;
                    } else if (gameState.cursor === 2) gameState.room = 'ORC_BRIDGE';
                }
            } else if (gameState.room === 'HIDDEN_LAKE') {
                if (gameState.cursor === 0) {
                    gameState.hp = 12;
                    gameState.tempMsg = IT ? "Salute ripristinata!" : "Health restored!";
                } else if (gameState.cursor === 1) gameState.room = 'MOUNTAIN_BASE';
            } else if (gameState.room === 'MOUNTAIN_BASE') {
                if (gameState.cursor === 0) gameState.room = 'DRAGON_TOWER';
                else if (gameState.cursor === 1) gameState.room = 'HIDDEN_LAKE';
            } else if (gameState.room === 'DRAGON_TOWER') {
                if (gameState.flags.dragon_dead) {
                    if (gameState.cursor === 0) gameState.room = 'THRONE_ROOM';
                    else if (gameState.cursor === 1) gameState.room = 'MOUNTAIN_BASE';
                } else {
                    if (gameState.cursor === 0) {
                        if (gameState.inventory.includes("Spada") || gameState.inventory.includes("Sword")) {
                            gameState.tempMsg = IT ? "Battaglia epica! Il Drago cade." : "Epic battle! The Dragon falls.";
                            gameState.flags.dragon_dead = true;
                        } else {
                            gameState.tempMsg = IT ? "Il fuoco ti brucia! -5 HP" : "Fire burns you! -5 HP";
                            gameState.hp -= 5;
                        }
                    } else if (gameState.cursor === 2) gameState.room = 'MOUNTAIN_BASE';
                }
            } else if (gameState.room === 'THRONE_ROOM') {
                if (gameState.cursor === 0) {
                    gameState.phase = 'WIN';
                    needsRebuild = true;
                }
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
        const flags = await _bridge.getLocalStorage('g2_flags');

        if (lang) gameState.lang = lang as Language;
        if (name) gameState.name = name;
        if (room) gameState.room = room as Room;
        if (hp) gameState.hp = Number(hp);
        if (inv) gameState.inventory = JSON.parse(inv);
        if (flags) gameState.flags = JSON.parse(flags);

        log(`Session Loaded: ${gameState.name} (${gameState.lang}) at ${gameState.room}`);
        gameState.phase = 'MENU';
    } catch (e) { log("Storage Load Error: " + e); }

    const tProp = new TextContainerProperty({
        containerID: 0,
        xPosition: 40, yPosition: 16,
        width: 496, height: 56,
        content: getTitle(),
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 0, isEventCapture: 0
    });

    const dProp = new TextContainerProperty({
        containerID: 1,
        xPosition: 208, yPosition: 80,
        width: 328, height: 192,
        content: getDescription(),
        isEventCapture: 1,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 0
    });

    const iProp = new ImageContainerProperty({
        containerID: 2, xPosition: 40, yPosition: 80, width: 144, height: 144
    });

    try {
        // Attempt to create startup container
        const layout = new CreateStartUpPageContainer({
            containerTotalNum: 3,
            textObject: [tProp, dProp],
            imageObject: [iProp]
        });

        const startRes = await _bridge.createStartUpPageContainer(layout);
        log("Startup Layout Response: " + startRes);

        let success = startRes === 0;

        // If startup fails with 1 (already active), try rebuild
        if (!success) {
            log("Startup failed, attempting Rebuild...");
            const rebuildLayout = new RebuildPageContainer({
                containerTotalNum: 3,
                textObject: [tProp, dProp],
                imageObject: [iProp]
            });
            success = await _bridge.rebuildPageContainer(rebuildLayout);
            log("Rebuild Success: " + success);
        }

        updateStatus(success ? "Display Active" : `Layout Error: ${startRes}`);
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
