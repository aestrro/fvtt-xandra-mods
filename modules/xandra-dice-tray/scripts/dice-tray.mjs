/**
 * Xandra's Dice Tray - Production-ready Foundry VTT v14.360 module
 * A modern, lightweight dice tray and calculator with full system integration
 */

const MODULE_ID = 'xandra-dice-tray';
const MODULE_PATH = `modules/${MODULE_ID}`;

/**
 * Configuration constants
 */
const CONFIG = {
  DICE_TYPES: [
    { type: 'd4', icon: 'fa-dice-d4', label: 'd4', sides: 4 },
    { type: 'd6', icon: 'fa-dice-d6', label: 'd6', sides: 6 },
    { type: 'd8', icon: 'fa-dice-d8', label: 'd8', sides: 8 },
    { type: 'd10', icon: 'fa-dice-d10', label: 'd10', sides: 10 },
    { type: 'd12', icon: 'fa-dice-d12', label: 'd12', sides: 12 },
    { type: 'd20', icon: 'fa-dice-d20', label: 'd20', sides: 20 },
    { type: 'd100', icon: null, label: 'd%', sides: 100 }
  ],
  MODIFIERS: [
    { id: 'advantage', label: 'Adv', icon: 'fa-arrow-up', formula: '2d20kh', tooltip: 'Advantage (2d20 keep highest)' },
    { id: 'disadvantage', label: 'Dis', icon: 'fa-arrow-down', formula: '2d20kl', tooltip: 'Disadvantage (2d20 keep lowest)' },
    { id: 'kh', label: 'KH', icon: 'fa-caret-up', formula: 'kh', tooltip: 'Keep Highest' },
    { id: 'kl', label: 'KL', icon: 'fa-caret-down', formula: 'kl', tooltip: 'Keep Lowest' }
  ]
};

/**
 * Main Dice Tray Controller
 */
class DiceTray {
  constructor() {
    this.settings = {};
    this.calculator = null;
    this._trayInjected = false;
    this.queue = {};
    CONFIG.DICE_TYPES.forEach(d => this.queue[d.type] = 0);
  }

  /**
   * Initialize module
   */
  static init() {
    console.log(`${MODULE_ID} | Initializing Xandra's Dice Tray v${game.modules.get(MODULE_ID).version}`);

    game.diceTray = new DiceTray();

    // Register settings first
    game.diceTray._registerSettings();

    // Setup hooks
    Hooks.on('renderChatLog', game.diceTray._onRenderChatLog.bind(game.diceTray));
    Hooks.on('renderChatControls', game.diceTray._onRenderChatControls.bind(game.diceTray));

    // System-specific hooks
    Hooks.on('diceSoNiceInit', game.diceTray._onDiceSoNiceInit.bind(game.diceTray));

    // Fallback: inject tray if chat log already rendered
    game.diceTray._injectTrayIfReady();
  }

  /**
   * Register module settings
   * @private
   */
  _registerSettings() {
    game.settings.register(MODULE_ID, 'showTray', {
      name: 'DICE_TRAY.Settings.ShowTray.Name',
      hint: 'DICE_TRAY.Settings.ShowTray.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => this._refreshTray()
    });

    game.settings.register(MODULE_ID, 'enableCalculator', {
      name: 'DICE_TRAY.Settings.EnableCalculator.Name',
      hint: 'DICE_TRAY.Settings.EnableCalculator.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true
    });

    game.settings.register(MODULE_ID, 'autoRoll', {
      name: 'DICE_TRAY.Settings.AutoRoll.Name',
      hint: 'DICE_TRAY.Settings.AutoRoll.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: false
    });

    this.settings = {
      showTray: game.settings.get(MODULE_ID, 'showTray'),
      enableCalculator: game.settings.get(MODULE_ID, 'enableCalculator'),
      autoRoll: game.settings.get(MODULE_ID, 'autoRoll')
    };
  }

  /**
   * Refresh tray visibility based on settings
   * @private
   */
  _refreshTray() {
    const tray = document.querySelector('.dice-tray-panel');
    if (tray) {
      tray.style.display = game.settings.get(MODULE_ID, 'showTray') ? 'flex' : 'none';
    }
  }

  /**
   * Inject tray if chat interface already exists (fallback for late module init)
   * @private
   */
  /**
   * Wait for #chat-message to appear inside the form, then inject tray before .menu-container
   * @private
   */
  _waitAndInjectTray(chatForm) {
    const tray = this._createTrayElement();

    const doInject = (chatMessage) => {
      const mc = chatMessage.querySelector('.menu-container');
      if (mc && !mc.previousElementSibling?.classList.contains('dice-tray-panel')) {
        mc.before(tray);
        this._activateTrayListeners(tray);
        return true;
      }
      return false;
    };

    const chatMessage = chatForm.querySelector('#chat-message');
    if (chatMessage) {
      if (!doInject(chatMessage)) {
        const obs = new MutationObserver(() => { if (doInject(chatMessage)) obs.disconnect(); });
        obs.observe(chatMessage, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 3000);
      }
      return;
    }

    // #chat-message not rendered yet — watch the form until it appears
    const obs = new MutationObserver(() => {
      const cm = chatForm.querySelector('#chat-message');
      if (cm) {
        obs.disconnect();
        if (!doInject(cm)) {
          const obs2 = new MutationObserver(() => { if (doInject(cm)) obs2.disconnect(); });
          obs2.observe(cm, { childList: true, subtree: true });
          setTimeout(() => obs2.disconnect(), 3000);
        }
      }
    });
    obs.observe(chatForm, { childList: true });
    setTimeout(() => obs.disconnect(), 5000);
  }

  /**
   * Inject tray if chat interface already exists (fallback for late module init)
   * @private
   */
  _getSidebarElement() {
    return ui.sidebar?.element || document.getElementById('sidebar');
  }

  _injectTrayIfReady() {
    if (!game.settings.get(MODULE_ID, 'showTray')) return;

    const sidebar = this._getSidebarElement();
    if (!sidebar || sidebar.querySelector('.dice-tray-panel')) return;

    const chatForm = sidebar.querySelector('form.chat-form');
    if (chatForm) this._waitAndInjectTray(chatForm);
  }

  /**
   * Normalize Foundry's html argument to a plain HTMLElement
   * @private
   */
  _getElement(html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    if (typeof html === 'string') return document.querySelector(html);
    return null;
  }

  /**
   * Handle chat log render
   * @param {ChatLog} app - ChatLog application
   * @param {HTMLElement|jQuery} html - HTML element
   * @private
   */
  _onRenderChatLog(app, html) {
    const element = this._getElement(html);
    if (!element) return;

    const sidebar = this._getSidebarElement();
    if (!sidebar) return;

    // Inject dice tray before the chat message menu container so it
    // shows/hides with the prose-mirror editor as the sidebar expands/collapses
    if (game.settings.get(MODULE_ID, 'showTray') && !sidebar.querySelector('.dice-tray-panel')) {
      const chatForm = sidebar.querySelector('form.chat-form');
      if (chatForm) this._waitAndInjectTray(chatForm);
    }

    // Inject calculator button (fallback since renderChatControls hook may not exist in V14)
    if (game.settings.get(MODULE_ID, 'enableCalculator')) {
      const chatControls = sidebar.querySelector('#chat-controls');
      if (chatControls && !chatControls.querySelector('.dice-calculator-toggle')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dice-calculator-toggle ui-control icon';
        button.setAttribute('aria-label', 'Open Dice Calculator');
        button.setAttribute('data-tooltip', 'Dice Calculator');
        button.innerHTML = '<i class="fas fa-calculator"></i>';
        button.addEventListener('click', () => this._toggleCalculator());

        const controlButtons = chatControls.querySelector('.control-buttons');
        if (controlButtons) {
          controlButtons.after(button);
        } else {
          chatControls.appendChild(button);
        }
      }
    }
  }

  /**
   * Handle chat controls render
   * @private
   */
  _onRenderChatControls(app, html) {
    if (!game.settings.get(MODULE_ID, 'enableCalculator')) return;

    const controls = this._getElement(html) || html[0] || html;
    if (!controls || controls.querySelector('.dice-calculator-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dice-calculator-toggle ui-control icon';
    button.setAttribute('aria-label', 'Open Dice Calculator');
    button.setAttribute('data-tooltip', 'Dice Calculator');
    button.innerHTML = '<i class="fas fa-calculator"></i>';
    button.addEventListener('click', () => this._toggleCalculator());

    const controlButtons = controls.querySelector('.control-buttons');
    if (controlButtons) {
      controlButtons.after(button);
    } else {
      controls.appendChild(button);
    }
  }

  /**
   * Create tray DOM element
   * @returns {HTMLElement}
   * @private
   */
  _createTrayElement() {
    const panel = document.createElement('div');
    panel.className = 'dice-tray-panel';
    panel.setAttribute('role', 'toolbar');
    panel.setAttribute('aria-label', 'Dice Tray');

    // Dice row
    const diceRow = document.createElement('div');
    diceRow.className = 'dice-tray-row';

    CONFIG.DICE_TYPES.forEach(die => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dice-tray-button';
      btn.dataset.dice = die.type;
      btn.dataset.sides = die.sides;
      btn.setAttribute('aria-label', `Roll ${die.label}`);
      btn.setAttribute('data-tooltip', die.label);

      if (die.icon) {
        btn.innerHTML = `<i class="fas ${die.icon}"></i>`;
      } else {
        btn.textContent = die.label;
      }

      const badge = document.createElement('span');
      badge.className = 'dice-count';
      badge.textContent = '0';
      btn.appendChild(badge);

      diceRow.appendChild(btn);
    });

    // Actions row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'dice-tray-row actions';

    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.className = 'action-button roll-button';
    rollBtn.innerHTML = '<i class="fas fa-dice-d20"></i> Roll';
    actionsRow.appendChild(rollBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'action-button clear-button';
    clearBtn.innerHTML = '<i class="fas fa-times"></i> Clear';
    actionsRow.appendChild(clearBtn);

    panel.appendChild(diceRow);
    panel.appendChild(actionsRow);

    return panel;
  }

  /**
   * Activate event listeners on tray
   * @param {HTMLElement} tray - Tray element
   * @private
   */
  _activateTrayListeners(tray) {
    const panel = tray.closest('.dice-tray-panel');

    // Dice buttons: left click increment, right click decrement
    tray.querySelectorAll('.dice-tray-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const dice = btn.dataset.dice;
        this.queue[dice]++;
        this._updateDieBadge(btn);
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const dice = btn.dataset.dice;
        this.queue[dice] = Math.max(0, this.queue[dice] - 1);
        this._updateDieBadge(btn);
      });
    });

    // Action buttons
    const rollBtn = panel?.querySelector('.roll-button');
    if (rollBtn) rollBtn.addEventListener('click', () => this._rollQueue());

    const clearBtn = panel?.querySelector('.clear-button');
    if (clearBtn) clearBtn.addEventListener('click', () => this._clearQueue(panel));
  }

  /**
   * Update the count badge on a die button
   * @private
   */
  _updateDieBadge(btn) {
    const dice = btn.dataset.dice;
    const badge = btn.querySelector('.dice-count');
    if (badge) {
      badge.textContent = this.queue[dice];
      badge.classList.toggle('visible', this.queue[dice] > 0);
    }
  }

  /**
   * Roll all queued dice
   * @private
   */
  _rollQueue() {
    const parts = [];
    for (const [type, count] of Object.entries(this.queue)) {
      if (count > 0) parts.push(`${count}${type}`);
    }
    if (parts.length === 0) {
      ui.notifications.warn('No dice selected');
      return;
    }
    const formula = parts.join(' + ');
    this._rollFormula(formula);
    this._clearQueue(document.querySelector('.dice-tray-panel'));
  }

  /**
   * Clear the queue and hide badges
   * @private
   */
  _clearQueue(panel) {
    CONFIG.DICE_TYPES.forEach(d => this.queue[d.type] = 0);
    if (panel) {
      panel.querySelectorAll('.dice-tray-button').forEach(btn => this._updateDieBadge(btn));
    }
  }

  /**
   * Append text to input with smart spacing
   * @private
   */
  _appendToInput(input, text) {
    const current = input.value;
    const endsWithOperator = /[\+\-\*\/\(]$/.test(current);
    const needsSpace = current.length > 0 && !current.endsWith(' ') && !endsWithOperator;

    // Check if we're modifying a dice roll (e.g., adding kh to 2d20)
    const diceMatch = current.match(/(\d+d\d+)$/);
    if (diceMatch && text.match(/^kh|kl$/)) {
      input.value = current + text;
    } else {
      input.value = current + (needsSpace ? ' + ' : ' ') + text;
    }

    // Auto-roll if enabled and valid formula
    if (game.settings.get(MODULE_ID, 'autoRoll') && this._isValidFormula(input.value)) {
      this._rollFormula(input.value);
      input.value = '';
    }
  }

  /**
   * Check if string is valid dice formula
   * @private
   */
  _isValidFormula(formula) {
    return /\d+d\d+/.test(formula) && !/[\+\-\*\/]$/.test(formula.trim());
  }

  /**
   * Execute roll formula
   * @private
   */
  async _rollFormula(formula) {
    try {
      const roll = new Roll(formula);

      // Build speaker from selected token, or fall back to default
      let speaker = ChatMessage.getSpeaker();
      const selectedTokens = canvas?.tokens?.controlled ?? [];
      if (selectedTokens.length > 0) {
        const token = selectedTokens[0];
        speaker = {
          alias: token.name,
          actor: token.id
        };
      }

      // Create chat message — toMessage handles evaluation and Dice So Nice automatically
      await roll.toMessage({
        speaker,
        flavor: formula
      }, {
        rollMode: game.settings.get('core', 'rollMode')
      });
    } catch (err) {
      console.error(`${MODULE_ID} | Roll error:`, err);
      ui.notifications.error(`Invalid roll formula: ${formula}`);
    }
  }

  /**
   * Toggle calculator popup
   * @private
   */
  _toggleCalculator() {
    if (this.calculator?.rendered) {
      this.calculator.close();
    } else {
      this.calculator = new DiceCalculator();
      this.calculator.render(true);
    }
  }

  /**
   * Handle Dice So Nice integration
   * @private
   */
  _onDiceSoNiceInit(dice3d) {
    console.log(`${MODULE_ID} | Dice So Nice integration active`);
  }
}

/**
 * Dice Calculator Application
 * Advanced calculator for complex dice formulas
 */
class DiceCalculator extends Application {
  constructor(options = {}) {
    super(options);
    this.formula = '';
    this.history = [];
    this.historyIndex = -1;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dice-calculator',
      template: `${MODULE_PATH}/templates/calculator.html`,
      title: 'Dice Calculator',
      width: 340,
      height: 'auto',
      classes: ['dice-tray-calculator'],
      resizable: false,
      minimizable: false
    });
  }

  getData() {
    return {
      formula: this.formula,
      dice: CONFIG.DICE_TYPES.map(d => d.type),
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      operators: ['+', '-', '*', '/'],
      hasHistory: this.history.length > 0
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const element = html[0];

    // Display input
    this.display = element.querySelector('.calc-display');

    // Button handlers
    element.querySelectorAll('.calc-dice').forEach(btn => {
      btn.addEventListener('click', () => this._append(btn.dataset.value));
    });

    element.querySelectorAll('.calc-num').forEach(btn => {
      btn.addEventListener('click', () => this._append(btn.dataset.value));
    });

    element.querySelectorAll('.calc-op').forEach(btn => {
      btn.addEventListener('click', () => this._append(btn.dataset.value));
    });

    element.querySelector('.calc-clear')?.addEventListener('click', () => this._clear());
    element.querySelector('.calc-backspace')?.addEventListener('click', () => this._backspace());
    element.querySelector('.calc-roll')?.addEventListener('click', () => this._roll());
    element.querySelector('.calc-history')?.addEventListener('click', () => this._showHistory());

    // Keyboard support
    element.addEventListener('keydown', (e) => this._onKeyDown(e));

    // Focus display
    setTimeout(() => this.display?.focus(), 100);
  }

  _append(value) {
    // Prevent consecutive operators
    const lastChar = this.formula.slice(-1);
    const operators = ['+', '-', '*', '/'];

    if (operators.includes(value) && operators.includes(lastChar)) {
      this.formula = this.formula.slice(0, -1) + value;
    } else {
      this.formula += value;
    }

    this._updateDisplay();
  }

  _clear() {
    this.formula = '';
    this._updateDisplay();
  }

  _backspace() {
    this.formula = this.formula.slice(0, -1);
    this._updateDisplay();
  }

  _updateDisplay() {
    if (this.display) {
      this.display.value = this.formula;
    }
  }

  _onKeyDown(event) {
    // Allow typing directly in display
    if (event.key === 'Enter') {
      event.preventDefault();
      this._roll();
    } else if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowUp' && this.history.length) {
      this._cycleHistory(-1);
    } else if (event.key === 'ArrowDown' && this.history.length) {
      this._cycleHistory(1);
    }
  }

  _cycleHistory(direction) {
    if (!this.history.length) return;

    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = this.history.length - 1;
    if (this.historyIndex >= this.history.length) this.historyIndex = 0;

    this.formula = this.history[this.historyIndex];
    this._updateDisplay();
  }

  async _roll() {
    if (!this.formula) return;

    try {
      // Add to history
      if (!this.history.includes(this.formula)) {
        this.history.unshift(this.formula);
        if (this.history.length > 10) this.history.pop();
      }

      // Set in chat input and submit
      const input = document.getElementById('chat-message');
      if (input) {
        input.value = this.formula;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }

      this.close();
    } catch (err) {
      ui.notifications.error('Invalid formula');
    }
  }

  _showHistory() {
    // Could implement a dropdown history menu here
    console.log('History:', this.history);
  }
}

// Initialize when Foundry is ready
Hooks.once('ready', DiceTray.init);

// Exports for developers
export { DiceTray, DiceCalculator, CONFIG };
