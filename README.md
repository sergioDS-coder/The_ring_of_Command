# The G2 Chronicles

**The G2 Chronicles** is a pure text-based fantasy adventure for the **Even Realities G2** smart glasses. Inspired by classics like Zork, it offers a branching narrative, RPG mechanics (HP and inventory), and full integration with the **R1 Ring**.

## Features

- 🖋️ **Atmospheric Narrative**: An epic fantasy branching story optimized for dual micro-LED displays.
- 🏰 **Persistent World**: Automatic saving of HP, Inventory, and Quest Flags via LocalStorage.
- 🐲 **Epic Encounters**: Fight orcs, challenge dragons, and rescue the princess.
- 🎨 **ASCII Art**: Visual storytelling using high-contrast ASCII graphics.
- 🇮🇹 🇬🇧 **Bilingual**: Full Italian and English support.
- 💍 **R1 Ring Integration**: Navigate choices via scroll gestures and confirm with a click.
- 🟢 **Monochrome UI**: High-contrast layout specifically designed for the G2's 4-bit greyscale display.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Even Hub CLI](https://www.npmjs.com/package/@evenrealities/evenhub-cli) (optional, for packaging)

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd the-g2-chronicles
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Development

### Running the Simulator

To preview the game without hardware, use the Even Hub Simulator:

1. **Start the local dev server**:
   ```bash
   npm run dev
   ```

2. **In a separate terminal, launch the simulator**:
   ```bash
   npx evenhub-simulator http://localhost:5173
   ```

### Testing on Hardware

To sideload the app on your Even Realities G2 glasses:

1. **Generate a QR code**:
   ```bash
   npx evenhub qr --url "http://<YOUR_IP_ADDRESS>:5173"
   ```
   *(Make sure your phone and computer are on the same Wi-Fi network)*

2. **Scan the QR code** using the Even Realities app on your phone.

## Build and Package

To create a production-ready `.ehpk` file for the Even Hub:

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Package the app**:
   ```bash
   npx evenhub pack app.json dist -o the-g2-chronicles.ehpk
   ```

## Controls (R1 Ring)

- **Scroll Down**: Navigate to the next option.
- **Scroll Up**: Navigate to the previous option.
- **Click**: Confirm selection / Advance dialogue.
- **Double Click**: Access the Help menu.

## Project Structure

- `src/index.ts`: Core game engine and narrative data.
- `app.json`: Manifest for the Even Hub platform.
- `index.html`: Entry point for the G2 WebView.
- `package.json`: Build scripts and dependencies.

---
*Made with ❤️ for the Even Realities community.*
