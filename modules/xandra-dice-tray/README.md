# Xandra's Dice Tray

A modern, lightweight dice tray and calculator module for Foundry VTT v14.360+. This is a clean reimplementation inspired by the original fvtt-dice-tray by mclemente, optimized for the latest Foundry API.

## Features

- **Clean Dice Tray**: Elegant dice buttons below the chat interface for quick rolling (d4, d6, d8, d10, d12, d20, d100)
- **Dice Calculator**: Popup calculator for complex dice formulas with support for:
  - Standard dice notation (e.g., `2d6+3`)
  - Advantage/Disadvantage modifiers
  - Keep Highest/Lowest (kh/kl)
  - Mathematical operators (+, -, *, /)
  - Parentheses for grouping
- **Modern Architecture**: Built with Foundry V14's ESM module system
- **Accessibility**: Full keyboard navigation and ARIA labels
- **Responsive Design**: Works on various screen sizes

## Installation

### Method 1: Manifest URL
1. Open Foundry VTT Setup
2. Go to "Add-on Modules"
3. Click "Install Module"
4. Paste the manifest URL: `https://github.com/aestrro/fvtt-xandra-mods/releases/latest/download/module.json`

### Method 2: Manual Installation
1. Download the `module.zip` from the latest release
2. Extract to `{userData}/Data/modules/xandra-dice-tray/`
3. Enable the module in your world

## Compatibility

- **Foundry VTT**: v14.360+ (Stable)
- **Systems**: System-agnostic (works with any game system)
- **Browsers**: Chrome, Firefox, Edge, Safari (latest versions)

## Usage

### Dice Tray
Click any dice button in the tray below chat to add it to your message. The dice notation is inserted into the chat input.

**Modifier Buttons:**
- **Adv**: Rolls 2d20 and keeps the highest (advantage)
- **Dis**: Rolls 2d20 and keeps the lowest (disadvantage)
- **KH**: Adds "keep highest" to your roll
- **KL**: Adds "keep lowest" to your roll

### Dice Calculator
Click the calculator icon (next to the chat controls) to open the dice calculator. Build complex formulas using:
- Dice buttons (d4-d100)
- Number pad (0-9)
- Operators (+, -, *, /)
- Parentheses for grouping
- Special modifiers (kh, kl)

Press **Roll** or **Enter** to execute the roll and close the calculator.

## API

The module exposes a global API for developers:

```javascript
// Access the dice tray instance
game.diceTray

// Programmatically open/close calculator
game.diceTray._toggleCalculator()

// Dice Calculator class
DiceCalculator
```

## Development

### File Structure
```
fvtt-xandra-mods/
├── module.json          # Module manifest (V14 format)
├── scripts/
│   └── dice-tray.mjs    # Main ESM module
├── styles/
│   └── dice-tray.css    # Modern CSS with CSS variables
├── templates/
│   └── calculator.html  # Handlebars template
├── lang/
│   └── en.json          # Localization
└── README.md
```

### Key Improvements Over Original
1. **ESM Modules**: Uses modern ES modules instead of IIFE/UMD
2. **V14 API**: Leverages new V14 hooks and application classes
3. **CSS Variables**: Uses Foundry's theme CSS variables for automatic dark mode support
4. **Clean Architecture**: Separated concerns with distinct classes for Tray and Calculator
5. **Performance**: Efficient DOM manipulation with minimal jQuery usage
6. **Accessibility**: ARIA labels, keyboard navigation, focus management

## License

MIT License - See LICENSE file for details.

## Credits

- Inspired by [fvtt-dice-tray](https://github.com/mclemente/fvtt-dice-tray) by mclemente
- Original concept by Asacolips
