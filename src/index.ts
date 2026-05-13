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
        const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
        const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const b1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2) < 0;
                const b2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3) < 0;
                const b3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1) < 0;
                if ((b1 === b2) && (b2 === b3)) this.setPixel(x, y, color);
            }
        }
    }

    drawDitheredRect(x: number, y: number, w: number, h: number, color1: number, color2: number) {
        for (let i = x; i < x + w; i++) {
            for (let j = y; j < y + h; j++) {
                this.setPixel(i, j, (i + j) % 2 === 0 ? color1 : color2);
            }
        }
    }

    drawTexture(x: number, y: number, w: number, h: number, type: 'STONE' | 'WOOD' | 'SCALES' | 'LEAVES') {
        for (let i = x; i < x + w; i++) {
            for (let j = y; j < y + h; j++) {
                let color = 0;
                if (type === 'STONE') {
                    color = (i % 20 < 2 || j % 10 < 2) ? 2 : 5;
                } else if (type === 'WOOD') {
                    color = Math.abs(Math.sin(i / 4) * 2) + 3;
                } else if (type === 'SCALES') {
                    color = ((i + Math.sin(j/5)*5) % 10 < 2) ? 8 : 4;
                } else if (type === 'LEAVES') {
                    color = Math.random() > 0.7 ? 10 : 6;
                }
                this.setPixel(i, j, Math.floor(color));
            }
        }
    }

    // Bayer 4x4 Dithering matrix for smoother 4-bit gradients
    private static BAYER_4X4 = [
        [ 0, 8, 2, 10 ],
        [ 12, 4, 14, 6 ],
        [ 3, 11, 1, 9 ],
        [ 15, 7, 13, 5 ]
    ];

    drawGradient(x: number, y: number, w: number, h: number, colorTop: number, colorBottom: number) {
        for (let j = y; j < y + h; j++) {
            for (let i = x; i < x + w; i++) {
                const ratio = (j - y) / h;
                const exactColor = colorTop + (colorBottom - colorTop) * ratio;
                const floorColor = Math.floor(exactColor);
                const threshold = (exactColor - floorColor) * 16;
                const bay = Painter.BAYER_4X4[j % 4][i % 4];
                this.setPixel(i, j, Math.min(15, bay < threshold ? floorColor + 1 : floorColor));
            }
        }
    }

    drawIsoCube(x: number, y: number, size: number, colorFront: number, colorTop: number, colorSide: number) {
        const h = size * 0.5;
        // Front face
        this.drawRect(x, y, size, size, colorFront);
        // Top face (parallelogram)
        for (let j = 0; j < h; j++) {
            const offset = h - j;
            this.drawRect(x + offset, y - j, size, 1, colorTop);
        }
        // Side face (parallelogram)
        for (let i = 0; i < h; i++) {
            this.drawRect(x + size + i, y - i, 1, size, colorSide);
        }
    }

    drawCylinder(cx: number, cy: number, r: number, h: number, colorMain: number, colorShadow: number) {
        // Body with gradient
        for (let i = -r; i <= r; i++) {
            const shading = Math.abs(i) / r;
            const color = Math.floor(colorMain - (colorMain - colorShadow) * shading);
            this.drawRect(cx + i, cy - h, 1, h, color);
        }
        // Top ellipse
        this.drawCircle(cx, cy - h, r, colorMain);
    }

    drawShadedCircle(cx: number, cy: number, r: number, colorCenter: number, colorEdge: number) {
        const r2 = r * r;
        for (let x = cx - r; x <= cx + r; x++) {
            for (let y = cy - r; y <= cy + r; y++) {
                const d2 = (x - cx) ** 2 + (y - cy) ** 2;
                if (d2 <= r2) {
                    const dist = Math.sqrt(d2) / r;
                    const exactColor = colorCenter + (colorEdge - colorCenter) * dist;
                    const floorColor = Math.floor(exactColor);
                    const threshold = (exactColor - floorColor) * 16;
                    const bay = Painter.BAYER_4X4[y % 4][x % 4];
                    this.setPixel(x, y, Math.min(15, bay < threshold ? floorColor + 1 : floorColor));
                }
            }
        }
    }

    drawFog(density: number) {
        for (let i = 0; i < this.data.length; i++) {
            if (Math.random() < density) {
                const x = i % this.width;
                const y = Math.floor(i / this.width);
                const bay = Painter.BAYER_4X4[y % 4][x % 4];
                if (bay > 10) this.data[i] = Math.max(0, this.data[i] - 1);
                else if (bay < 4) this.data[i] = Math.min(15, this.data[i] + 1);
            }
        }
    }

    drawVines(x: number, y: number, length: number) {
        let curX = x;
        let curY = y;
        for (let i = 0; i < length; i++) {
            this.setPixel(curX, curY, 2);
            this.setPixel(curX + 1, curY, 1);
            curY++;
            curX += Math.sin(i / 2) > 0 ? 1 : -1;
            if (i % 5 === 0) this.drawCircle(curX, curY, 2, 3); // tiny leaves
        }
    }

    drawVignette() {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const maxDist = Math.sqrt(cx*cx + cy*cy);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const d = Math.sqrt((x - cx)**2 + (y - cy)**2);
                const factor = d / maxDist;
                if (factor > 0.6) {
                    const idx = y * this.width + x;
                    this.data[idx] = Math.max(0, this.data[idx] - Math.floor((factor - 0.6) * 10));
                }
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
        p.drawGradient(0, 0, 144, 144, 1, 4);
        p.drawIsoCube(40, 70, 44, 10, 8, 6);
        p.drawFog(0.1);
    } else if (type === 'FOREST') {
        p.drawGradient(0, 0, 144, 110, 1, 0);
        for (let i = -20; i < 160; i += 35) {
            p.drawTriangle(i, 120, i + 25, 20, i + 50, 120, 3);
        }
        p.drawFog(0.3);
        p.drawDitheredRect(0, 120, 144, 24, 1, 0);
    } else if (type === 'OAK') {
        p.drawGradient(0, 0, 144, 144, 2, 0);
        p.drawCylinder(72, 144, 15, 74, 3, 1);
        p.drawShadedCircle(72, 55, 50, 5, 2);
        p.drawVines(50, 30, 80);
        p.drawFog(0.2);
    } else if (type === 'ELF') {
        p.drawGradient(0, 0, 144, 144, 1, 4);
        p.drawTriangle(40, 144, 72, 35, 104, 144, 8);
        p.drawShadedCircle(72, 30, 20, 15, 10);
        p.drawFog(0.2);
    } else if (type === 'WITCH') {
        p.drawGradient(0, 0, 144, 144, 0, 3);
        p.drawCylinder(72, 140, 35, 45, 2, 0);
        p.drawVines(40, 40, 60);
        p.drawTriangle(55, 90, 72, 15, 89, 90, 2);
    } else if (type === 'CASTLE') {
        p.drawGradient(0, 0, 144, 144, 1, 3);
        p.drawTexture(0, 60, 144, 84, 'STONE');
        p.drawVines(20, 60, 70);
        p.drawIsoCube(15, 85, 35, 4, 6, 2);
        p.drawIsoCube(94, 85, 35, 4, 6, 2);
    } else if (type === 'HALL') {
        p.drawGradient(0, 0, 144, 144, 2, 0);
        p.drawTexture(20, 20, 20, 124, 'STONE');
        p.drawTexture(104, 20, 20, 124, 'STONE');
        p.drawFog(0.15);
    } else if (type === 'GATE') {
        p.drawGradient(0, 0, 144, 144, 3, 1);
        p.drawTexture(20, 40, 104, 104, 'STONE');
        p.drawShadedCircle(72, 60, 40, 0, 1);
        p.drawVines(30, 40, 50);
    } else if (type === 'TAVERN') {
        p.drawGradient(0, 0, 144, 144, 2, 0);
        p.drawIsoCube(35, 80, 54, 7, 10, 5);
        p.drawTexture(40, 85, 44, 40, 'WOOD');
        p.drawTriangle(15, 80, 65, 35, 115, 80, 3);
    } else if (type === 'FORGE') {
        p.drawGradient(0, 0, 144, 144, 1, 0);
        p.drawIsoCube(45, 90, 54, 2, 4, 1);
        p.drawShadedCircle(72, 60, 25, 15, 4); // Burning forge
        p.drawFog(0.2);
    } else if (type === 'BRIDGE') {
        p.drawGradient(0, 0, 144, 100, 2, 0);
        p.drawTexture(0, 80, 144, 15, 'STONE');
        for (let i = 25; i < 144; i += 45) p.drawCylinder(i, 144, 12, 64, 4, 1);
        p.drawFog(0.4);
    } else if (type === 'CAVE') {
        p.drawRect(0, 0, 144, 144, 1);
        p.drawCircle(72, 160, 120, 0);
        p.drawFog(0.2);
    } else if (type === 'MOUNTAIN') {
        p.drawGradient(0, 0, 144, 144, 1, 4);
        p.drawTriangle(10, 144, 72, 15, 134, 144, 2);
        p.drawFog(0.3);
    } else if (type === 'TOWER') {
        p.drawGradient(0, 0, 144, 144, 1, 0);
        p.drawCylinder(72, 144, 35, 110, 4, 1);
        p.drawVines(40, 50, 90);
        p.drawFog(0.2);
    } else if (type === 'THRONE') {
        p.drawGradient(0, 0, 144, 144, 2, 0);
        p.drawIsoCube(40, 90, 64, 1, 2, 0);
        p.drawFog(0.2);
    } else if (type === 'SKULL') {
        p.drawGradient(0, 0, 144, 144, 0, 1);
        p.drawShadedCircle(72, 72, 50, 10, 2);
        p.drawCylinder(72, 120, 20, 20, 8, 4);
        p.drawCircle(55, 65, 12, 0);
        p.drawCircle(89, 65, 12, 0);
        p.drawFog(0.15);
    } else if (type === 'CROWN') {
        p.drawGradient(0, 0, 144, 144, 4, 1);
        p.drawIsoCube(35, 70, 70, 15, 12, 10);
        p.drawCircle(70, 30, 10, 14); // Jewel top
    } else if (type === 'SWORD') {
        p.drawGradient(0, 0, 144, 144, 1, 0);
        p.drawTriangle(72, 10, 60, 100, 84, 100, 13); // 3D Broadsword
        p.drawCylinder(72, 135, 6, 35, 5, 2); // Round handle
    } else if (type === 'POTION') {
        p.drawGradient(0, 0, 144, 144, 1, 3);
        p.drawShadedCircle(72, 110, 40, 12, 4); // Rounder shaded bottle
        p.drawCylinder(72, 80, 12, 30, 8, 4); // Neck
        p.drawShadedCircle(72, 115, 25, 15, 8); // Glowing liquid core
    } else if (type === 'ORC') {
        p.drawCylinder(72, 110, 45, 75, 2, 0);
        p.drawCircle(72, 40, 28, 1);
        p.drawFog(0.3);
    } else if (type === 'DRAGON') {
        p.drawGradient(0, 0, 144, 144, 1, 0);
        p.drawTriangle(10, 85, 72, 5, 134, 85, 2);
        p.drawCylinder(72, 124, 48, 65, 4, 1);
        p.drawShadedCircle(115, 45, 22, 14, 2);
        p.drawCircle(115, 45, 5, 0);
        p.drawFog(0.3);
    } else if (type === 'PRINCESS') {
        p.drawTriangle(20, 144, 72, 45, 124, 144, 4);
        p.drawShadedCircle(72, 45, 25, 15, 0); // High contrast face
        p.drawCircle(65, 45, 3, 0); // Void eyes
        p.drawCircle(79, 45, 3, 0);
        p.drawVines(72, 60, 40);
        p.drawFog(0.2);
    } else if (type === 'MAP') {
        p.drawIsoCube(20, 45, 85, 8, 10, 6);
        p.drawFog(0.1);
    }
    p.drawVignette();
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
    ELF: generateProceduralImage('ELF'),
    WITCH: generateProceduralImage('WITCH'),
    CASTLE: generateProceduralImage('CASTLE'),
    HALL: generateProceduralImage('HALL'),
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
    'MISTY_PATH' | 'ELF_GROVE' | 'WITCH_HUT' | 'ORC_BRIDGE' | 'DARK_CAVE' | 'HIDDEN_LAKE' |
    'MOUNTAIN_BASE' | 'CASTLE_GATES' | 'CASTLE_HALL' | 'CRYPT' | 'DRAGON_TOWER' | 'THRONE_ROOM';

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
            desc: "L'aria è gelida. Alberi scheletrici sembrano artigliare il cielo plumbeo. Un senso di presagio ti opprime.",
            options: ["Vai a Nord (Quercia)", "Vai a Est (Villaggio)", "Aiuto"]
        }),
        OLD_OAK: (s) => {
            let d = "Un albero morente, le sue foglie sono nere come cenere. Sir Alistair è accasciato, lo sguardo fisso nel vuoto.";
            if (s.inventory.includes("Amuleto") || s.inventory.includes("Amulet")) {
                d = "Alistair sussulta: 'Quell'Amuleto... emana il freddo della tomba. La Principessa non è più chi credi.'";
            }
            return {
                image: "OAK",
                title: "Antica Quercia",
                desc: d,
                options: s.flags.met_knight ? ["Parla con Sir Alistair", "Vai a Sud", "Aiuto"] : ["Avvicinati al cavaliere", "Vai a Sud", "Aiuto"]
            };
        },
        VILLAGE_GATE: () => ({
            image: "GATE",
            title: "Porta di Oakhaven",
            desc: "Un ridente villaggio. Gli abitanti sembrano preoccupati per le voci di un drago.",
            options: ["Entra nella Locanda", "Visita il Fabbro", "Vai a Nord (Sentiero)", "Vai a Ovest", "Aiuto"]
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
            options: ["Vai a Nord (Ponte)", "Vai a Ovest (Bosco Elfi)", "Torna al Villaggio", "Aiuto"]
        }),
        ELF_GROVE: (s) => ({
            image: "ELF",
            title: "Bosco degli Elfi",
            desc: "Luce argentea tra i rami. Un'elfa custode ti osserva con sospetto.",
            options: s.flags.elf_trust ? ["Chiedi della Strega", "Torna al Sentiero", "Aiuto"] : ["Saluta l'Elfa", "Torna al Sentiero", "Aiuto"]
        }),
        WITCH_HUT: (s) => ({
            image: "WITCH",
            title: "Capanna della Strega",
            desc: "Fumo viola esce dal camino. Una strega sta mescolando un calderone gorgogliante.",
            options: s.flags.witch_met ? ["Chiedi del Castello", "Esci", "Aiuto"] : ["Entra con cautela", "Torna al bosco", "Aiuto"]
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
            desc: "Il vento ulula. A Est vedi le mura di un castello in rovina.",
            options: ["Scala la torre", "Vai al Castello", "Torna al lago", "Aiuto"]
        }),
        CASTLE_GATES: (_s) => ({
            image: "CASTLE",
            title: "Cancelli del Castello",
            desc: "Antiche mura di pietra. I cancelli sono socchiusi e cigolano nel vento.",
            options: ["Entra nel Salone", "Torna alla montagna", "Aiuto"]
        }),
        CASTLE_HALL: (s) => ({
            image: "HALL",
            title: "Grande Salone",
            desc: s.inventory.includes("Amuleto") ? "Il salone risplende alla luce dell'Amuleto. Il passaggio per la Torre è rivelato." : "Arazzi polverosi e armature silenziose. Senti un'energia magica nell'aria.",
            options: s.inventory.includes("Amuleto") ? ["Sali alla Torre", "Esci", "Aiuto"] : ["Cerca indizi", "Esci", "Aiuto"]
        }),
        DRAGON_TOWER: (s) => ({
            image: s.flags.dragon_dead ? "TOWER" : "DRAGON",
            title: "Torre del Drago",
            desc: s.flags.dragon_dead ? "Le fiamme si sono spente. Il drago è caduto." : "Un Drago Sputafuoco sorveglia l'ingresso. Il calore è insopportabile.",
            options: s.flags.dragon_dead ? ["Entra nella stanza", "Torna giù", "Aiuto"] : ["Sfida il Drago", "Usa la pozione", "Torna giù", "Aiuto"]
        }),
        CRYPT: (s) => ({
            image: "SKULL",
            title: "Cripta Dimenticata",
            desc: "L'odore di morte è soffocante. Lapidi infrante rivelano orrori che avrebbero dovuto restare sepolti.",
            options: s.flags.crypt_cleared ? ["Torna al Salone", "Aiuto"] : ["Esorcizza le Ombre", "Fuggi", "Aiuto"]
        }),
        THRONE_ROOM: (s) => ({
            image: "PRINCESS",
            title: s.flags.rescued ? "Sacrificio?" : "Sala del Vuoto",
            desc: s.flags.rescued
                ? "Le catene cadono, ma Lyra non sorride. I suoi occhi sono abissi neri. 'Il Vuoto ha bisogno di un nuovo corpo, Eroe.'"
                : "La Principessa Lyra è legata al trono. La sua pelle è pallida come il marmo. Qualcosa non va.",
            options: s.flags.rescued ? ["Accetta il Destino", "Aiuto"] : ["Libera Lyra", "Osserva i suoi occhi", "Aiuto"]
        })
    },
    EN: {
        FOREST_EDGE: () => ({
            image: "FOREST",
            title: "Edge of the Void",
            desc: "The air is freezing. Skeletal trees claw at a leaden sky. A sense of dread oppresses you.",
            options: ["Go North (Oak)", "Go East (Village)", "Help"]
        }),
        OLD_OAK: (s) => {
            let d = "A dying tree, its leaves black as ash. Sir Alistair is slumped, staring into nothingness.";
            if (s.inventory.includes("Amulet") || s.inventory.includes("Amuleto")) {
                d = "Alistair gasps: 'That Amulet... it radiates the cold of the grave. The Princess is no longer who you think.'";
            }
            return {
                image: "OAK",
                title: "Old Oak",
                desc: d,
                options: s.flags.met_knight ? ["Speak with Sir Alistair", "Go South", "Help"] : ["Approach the knight", "Go South", "Help"]
            };
        },
        VILLAGE_GATE: () => ({
            image: "GATE",
            title: "Oakhaven Gate",
            desc: "A peaceful village. Residents seem worried about dragon rumors.",
            options: ["Enter the Tavern", "Visit Blacksmith", "Go North (Path)", "Go West", "Help"]
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
            options: ["Go North (Bridge)", "Go West (Elf Grove)", "Back to Village", "Help"]
        }),
        ELF_GROVE: (s) => ({
            image: "ELF",
            title: "Elf Grove",
            desc: "Silvery light between branches. An elf guardian watches you suspiciously.",
            options: s.flags.elf_trust ? ["Ask about Witch", "Back to Path", "Help"] : ["Greet the Elf", "Back to Path", "Help"]
        }),
        WITCH_HUT: (s) => ({
            image: "WITCH",
            title: "Witch's Hut",
            desc: "Purple smoke rises from the chimney. A witch is stirring a bubbling cauldron.",
            options: s.flags.witch_met ? ["Ask about Castle", "Exit", "Help"] : ["Enter cautiously", "Back to grove", "Help"]
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
            desc: "Wind howls. To the East you see the walls of a ruined castle.",
            options: ["Climb the tower", "Go to Castle", "Back to lake", "Help"]
        }),
        CASTLE_GATES: (_s) => ({
            image: "CASTLE",
            title: "Castle Gates",
            desc: "Ancient stone walls. The gates are ajar and creaking in the wind.",
            options: ["Enter the Hall", "Back to mountain", "Help"]
        }),
        CASTLE_HALL: (s) => ({
            image: "HALL",
            title: "Great Hall",
            desc: s.inventory.includes("Amulet") ? "The hall glows with the Amulet's light. The path to the Tower is revealed." : "Dusty tapestries and silent armor. You feel magical energy in the air.",
            options: s.inventory.includes("Amulet") ? ["Climb to Tower", "Exit", "Help"] : ["Search for clues", "Exit", "Help"]
        }),
        DRAGON_TOWER: (s) => ({
            image: s.flags.dragon_dead ? "TOWER" : "DRAGON",
            title: "Dragon Tower",
            desc: s.flags.dragon_dead ? "The flames have died out. The dragon has fallen." : "A fire-breathing Dragon guards the entrance. Heat is unbearable.",
            options: s.flags.dragon_dead ? ["Enter the room", "Go down", "Help"] : ["Challenge Dragon", "Use potion", "Go down", "Help"]
        }),
        CRYPT: (s) => ({
            image: "SKULL",
            title: "Forgotten Crypt",
            desc: "The stench of decay is suffocating. Shattered tombs reveal horrors that should have stayed buried.",
            options: s.flags.crypt_cleared ? ["Back to Hall", "Help"] : ["Exorcise Shadows", "Flee", "Help"]
        }),
        THRONE_ROOM: (s) => ({
            image: "PRINCESS",
            title: s.flags.rescued ? "Sacrifice?" : "Void Hall",
            desc: s.flags.rescued
                ? "The chains fall, but Lyra does not smile. Her eyes are black abysses. 'The Void needs a new vessel, Hero.'"
                : "Princess Lyra is bound to the throne. Her skin is pale as marble. Something is wrong.",
            options: s.flags.rescued ? ["Accept Fate", "Help"] : ["Free Lyra", "Peer into her eyes", "Help"]
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
                        new TextContainerProperty({ ...DEFAULT_TEXT_PROPS, containerID: 1, xPosition: 208, yPosition: 80, width: 328, height: 192, content: desc, isEventCapture: 1 })
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
    if (gameState.phase === 'DEAD' || gameState.phase === 'WIN') {
        const IT = gameState.lang === 'IT';
        if (gameState.phase === 'DEAD') {
            return (IT ? "La tua avventura finisce qui. Le tenebre avvolgono il regno." : "Your adventure ends here. Darkness envelops the realm.") + (IT ? "\n\n> Ricomincia" : "\n\n> Restart");
        } else {
            return (IT ? "Hai liberato la Principessa e sconfitto il male! Il popolo di Oakhaven canterà le tue lodi per secoli.\nSei il leggendario Eroe delle G2 Chronicles." : "You freed the Princess and defeated the evil! The people of Oakhaven will sing your praises for centuries.\nYou are the legendary G2 Chronicles Hero.") + (IT ? "\n\n> Nuovo Gioco" : "\n\n> New Game");
        }
    }
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
                else if (gameState.cursor === 2) gameState.room = 'MISTY_PATH';
                else if (gameState.cursor === 3) gameState.room = 'FOREST_EDGE';
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
                else if (gameState.cursor === 1) gameState.room = 'ELF_GROVE';
                else if (gameState.cursor === 2) gameState.room = 'VILLAGE_GATE';
            } else if (gameState.room === 'ELF_GROVE') {
                if (gameState.cursor === 0) {
                    if (!gameState.flags.elf_trust) {
                        gameState.flags.elf_trust = true;
                        gameState.tempMsg = IT ? "'Non molti umani visitano il nostro bosco...'" : "'Not many humans visit our grove...'";
                    } else {
                        gameState.room = 'WITCH_HUT';
                    }
                } else if (gameState.cursor === 1) gameState.room = 'MISTY_PATH';
            } else if (gameState.room === 'WITCH_HUT') {
                if (gameState.cursor === 0) {
                    if (!gameState.flags.witch_met) {
                        gameState.flags.witch_met = true;
                        gameState.tempMsg = IT ? "La strega sorride: 'Il castello nasconde segreti...'" : "The witch smiles: 'The castle hides secrets...'";
                    } else {
                        gameState.tempMsg = IT ? "'Cerca nel castello l'Amuleto.'" : "'Search the castle for the Amulet.'";
                    }
                } else if (gameState.cursor === 1) gameState.room = 'ELF_GROVE';
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
                if (gameState.cursor === 0) {
                    gameState.tempMsg = IT ? "La torre è troppo liscia per essere scalata senza attrezzi." : "The tower is too smooth to climb without gear.";
                }
                else if (gameState.cursor === 1) gameState.room = 'CASTLE_GATES';
                else if (gameState.cursor === 2) gameState.room = 'HIDDEN_LAKE';
            } else if (gameState.room === 'CASTLE_GATES') {
                if (gameState.cursor === 0) gameState.room = 'CASTLE_HALL';
                else if (gameState.cursor === 1) gameState.room = 'MOUNTAIN_BASE';
            } else if (gameState.room === 'CASTLE_HALL') {
                if (gameState.cursor === 0) {
                    const amulet = IT ? "Amuleto" : "Amulet";
                    if (!gameState.inventory.includes(amulet)) {
                        gameState.room = 'CRYPT';
                    } else {
                        gameState.room = 'DRAGON_TOWER';
                    }
                } else if (gameState.cursor === 1) gameState.room = 'CASTLE_GATES';
            } else if (gameState.room === 'CRYPT') {
                if (gameState.cursor === 0) {
                    const amulet = IT ? "Amuleto" : "Amulet";
                    gameState.inventory.push(amulet);
                    gameState.flags.crypt_cleared = true;
                    gameState.tempMsg = IT ? "Hai strappato l'Amuleto alle Ombre!" : "You snatched the Amulet from the Shadows!";
                    gameState.room = 'CASTLE_HALL';
                } else if (gameState.cursor === 1) gameState.room = 'CASTLE_HALL';
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
                    if (!gameState.flags.rescued) {
                        gameState.flags.rescued = true;
                        gameState.tempMsg = IT ? "Le catene si spezzano!" : "The chains shatter!";
                    } else {
                        gameState.phase = 'WIN';
                        needsRebuild = true;
                    }
                } else if (gameState.cursor === 1 && !gameState.flags.rescued) {
                    gameState.tempMsg = IT ? "Vedi oro e antichi arazzi." : "You see gold and ancient tapestries.";
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

    // Clear session for testing if needed, or load persistent data
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
