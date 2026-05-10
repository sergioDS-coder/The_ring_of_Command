import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    TextContainerUpgrade,
    OsEventTypeList,
    EvenAppBridge
} from '@evenrealities/even_hub_sdk';

// --- Game Logic ---
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
}

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
    IT: "AIUTO:\nScorri (Top/Bottom): Naviga opzioni o cambia lettera.\nClick: Conferma azione.\nDoppio Click: Chiudi Aiuto.",
    EN: "HELP:\nScroll (Top/Bottom): Navigate options or change letter.\nClick: Confirm action.\nDouble Click: Close Help."
};

class G2Chronicles {
    public state: GameState = {
        phase: 'LANG',
        lang: 'IT',
        name: '',
        hp: 10,
        inventory: [],
        room: 'ENTRANCE',
        cursor: 0,
        options: ['ITALIANO', 'ENGLISH'],
        showHelp: false
    };

    private alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_";
    private charIndex = 0;

    getTitle(): string {
        if (this.state.showHelp) return "Help / Aiuto";
        if (this.state.phase === 'LANG') return "The G2 Chronicles";
        if (this.state.phase === 'NAME') return "Nome: " + this.state.name + this.alphabet[this.charIndex];
        if (this.state.phase === 'DEAD') return this.state.lang === 'IT' ? "GAME OVER" : "YOU DIED";
        if (this.state.phase === 'WIN') return this.state.lang === 'IT' ? "VITTORIA!" : "VICTORY!";
        return ROOMS[this.state.lang][this.state.room].title;
    }

    getDescription(): string {
        if (this.state.showHelp) return HELP_TEXT[this.state.lang];
        if (this.state.phase === 'LANG') return "Seleziona Lingua / Select Language";
        if (this.state.phase === 'NAME') return "Scorri per cambiare lettera.\nSeleziona '_' per confermare il nome.";
        if (this.state.phase === 'DEAD') return "La tua avventura finisce qui.";
        if (this.state.phase === 'WIN') return "Hai trovato le G2 leggendarie! Il mondo è salvo.";

        const room = ROOMS[this.state.lang][this.state.room];
        let d = room.desc + "\n\nHP: " + this.state.hp + "\n\n";
        room.options.forEach((opt, i) => {
            d += (i === this.state.cursor ? "> " : "  ") + opt + "\n";
        });
        return d;
    }

    handleScroll(dir: 'UP' | 'DOWN') {
        if (this.state.showHelp) return;
        if (this.state.phase === 'LANG' || this.state.phase === 'PLAY') {
            const max = this.state.options.length;
            if (dir === 'DOWN') this.state.cursor = (this.state.cursor + 1) % max;
            else this.state.cursor = (this.state.cursor - 1 + max) % max;
        } else if (this.state.phase === 'NAME') {
            const max = this.alphabet.length;
            if (dir === 'DOWN') this.charIndex = (this.charIndex + 1) % max;
            else this.charIndex = (this.charIndex - 1 + max) % max;
        }
    }

    handleSelect() {
        if (this.state.showHelp) {
            this.state.showHelp = false;
            return;
        }
        if (this.state.phase === 'LANG') {
            this.state.lang = this.state.cursor === 0 ? 'IT' : 'EN';
            this.state.phase = 'NAME';
        } else if (this.state.phase === 'NAME') {
            const char = this.alphabet[this.charIndex];
            if (char === '_') {
                if (this.state.name.length > 0) {
                    this.state.phase = 'PLAY';
                    this.updateRoom();
                }
            } else {
                if (this.state.name.length < 8) this.state.name += char;
            }
        } else if (this.state.phase === 'PLAY') {
            this.processAction();
        }
    }

    toggleHelp() {
        this.state.showHelp = !this.state.showHelp;
    }

    private updateRoom() {
        this.state.cursor = 0;
        this.state.options = ROOMS[this.state.lang][this.state.room].options;
    }

    private processAction() {
        const choice = this.state.cursor;
        if (this.state.room === 'ENTRANCE') {
            if (choice === 0) { this.state.room = 'HALL'; }
        } else if (this.state.room === 'HALL') {
            if (choice === 0) { this.state.room = 'WELL'; this.state.hp -= 1; }
            else if (choice === 1) { this.state.room = 'ALTAR'; }
            else if (choice === 2) { this.state.room = 'ENTRANCE'; }
        } else if (this.state.room === 'WELL') {
            if (choice === 0) { this.state.inventory.push("Torch"); }
            else { this.state.room = 'HALL'; }
        } else if (this.state.room === 'ALTAR') {
            if (choice === 0) { this.state.phase = 'WIN'; }
            else { this.state.room = 'HALL'; }
        }

        if (this.state.hp <= 0) this.state.phase = 'DEAD';
        if (this.state.phase === 'PLAY') this.updateRoom();
    }
}

// --- Bridge Integration ---

const game = new G2Chronicles();
const log = (msg: string) => {
    const el = document.getElementById('logs');
    if (el) el.innerHTML = `[${Date.now()}] ${msg}<br>` + el.innerHTML;
    console.log(msg);
};

async function render(bridge: EvenAppBridge) {
    const title = game.getTitle();
    const desc = game.getDescription();

    log(`UI: ${title.substring(0,10)}...`);

    try {
        await bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 10,
            content: title
        }));
        await bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 11,
            content: desc
        }));
    } catch (e) {
        log("Sync...");
    }
}

async function init() {
    log("Booting G2 Chronicles...");
    const bridge = await waitForEvenAppBridge();
    log("Bridge Ready.");

    await new Promise(r => setTimeout(r, 1000));

    const titleContainer = new TextContainerProperty({
        xPosition: 40,
        yPosition: 16,
        width: 496,
        height: 56,
        containerID: 10,
        containerName: "title",
        content: game.getTitle()
    });

    const descContainer = new TextContainerProperty({
        xPosition: 40,
        yPosition: 80,
        width: 496,
        height: 192,
        containerID: 11,
        containerName: "desc",
        content: game.getDescription(),
        isEventCapture: 1
    });

    const startUpLayout = new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [titleContainer, descContainer]
    });

    log("Creating Startup...");
    const res = await bridge.createStartUpPageContainer(startUpLayout);
    log(`Result: ${res}`);

    await render(bridge);

    bridge.onEvenHubEvent((event) => {
        const type = event.textEvent?.eventType;
        if (type === undefined) return;

        log(`Evt: ${type}`);

        if (type === OsEventTypeList.SCROLL_TOP_EVENT) {
            game.handleScroll('UP');
        } else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
            game.handleScroll('DOWN');
        } else if (type === OsEventTypeList.CLICK_EVENT) {
            game.handleSelect();
        } else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
            game.toggleHelp();
        }

        render(bridge);
    });
}

init().catch(err => log("Init Error: " + err));
