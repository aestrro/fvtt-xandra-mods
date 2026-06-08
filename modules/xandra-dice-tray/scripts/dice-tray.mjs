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
    this.rollMode = 'normal'; // 'normal' | 'advantage' | 'disadvantage'
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
    game.diceTray._attachExpandedObserver();
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
   * Inject tray as a sibling BEFORE the prose-mirror#chat-message element.
   * This keeps the tray outside the prose-mirror so it doesn't expand its height.
   * @private
   */
  _injectTrayIntoChatMessage(chatMessage) {
    const parent = chatMessage.parentElement;
    const existingTray = parent?.querySelector(':scope > .dice-tray-panel');
    if (existingTray) {
      this._syncTray(existingTray);
      return;
    }

    const tray = this._createTrayElement();
    chatMessage.before(tray);
    this._activateTrayListeners(tray);
    this._syncTray(tray);
    this._toggleTrayVisibility();
  }

  /**
   * Inject into every prose-mirror#chat-message found in the document
   * @private
   */
  _injectAllChatMessages() {
    document.querySelectorAll('prose-mirror#chat-message').forEach(pm => this._injectTrayIntoChatMessage(pm));
  }

  /**
   * Inject tray if chat interface already exists (fallback for late module init)
   * @private
   */
  _injectTrayIfReady() {
    if (!game.settings.get(MODULE_ID, 'showTray')) return;
    this._injectAllChatMessages();
    this._startTrayWatcher();
  }

  /**
   * Persistent watcher that re-injects the tray only when a prose-mirror is added
   * @private
   */
  _startTrayWatcher() {
    if (this._trayObserver) return;

    const onMutations = (mutations) => {
      if (!game.settings.get(MODULE_ID, 'showTray')) return;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement && (node.tagName === 'PROSE-MIRROR' || node.querySelector?.('prose-mirror#chat-message'))) {
            this._injectAllChatMessages();
            return;
          }
        }
      }
    };

    const target = document.getElementById('ui-right') || document.body;
    this._trayObserver = new MutationObserver(onMutations);
    this._trayObserver.observe(target, { childList: true, subtree: true });
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

    // Inject dice tray into every prose-mirror#chat-message (expanded + collapsed)
    if (game.settings.get(MODULE_ID, 'showTray')) {
      this._injectAllChatMessages();
    }
    // Ensure watcher is running
    this._startTrayWatcher();

    // Inject calculator button (fallback since renderChatControls hook may not exist in V14)
    if (game.settings.get(MODULE_ID, 'enableCalculator')) {
      const chatControls = document.querySelector('#chat-controls');
      if (chatControls && !chatControls.querySelector('.dice-calculator-toggle')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dice-calculator-toggle ui-control icon';
        button.setAttribute('aria-label', 'Open Dice Calculator');
        button.setAttribute('data-tooltip', 'Dice Calculator');
    button.setAttribute('data-tooltip-direction', 'UP');
        button.setAttribute('data-tooltip-direction', 'UP');
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
      btn.setAttribute('data-tooltip-direction', 'UP');

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

    // Actions container: two rows (buttons + clear link)
    const isDnd = game.system?.id === 'dnd5e';
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'dice-tray-actions';

    const actionsRow = document.createElement('div');
    actionsRow.className = 'dice-tray-row actions';
    if (isDnd) actionsRow.classList.add('has-advantage');

    if (isDnd) {
      const disBtn = document.createElement('button');
      disBtn.type = 'button';
      disBtn.className = 'action-button mode-button disadvantage-button';
      disBtn.dataset.mode = 'disadvantage';
      disBtn.setAttribute('data-tooltip', 'Disadvantage');
      disBtn.setAttribute('data-tooltip-direction', 'UP');
      disBtn.textContent = 'DIS';
      actionsRow.appendChild(disBtn);
    }

    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.className = 'action-button roll-button';
    rollBtn.innerHTML = '<i class="fas fa-dice-d20"></i> Roll';
    actionsRow.appendChild(rollBtn);

    if (isDnd) {
      const advBtn = document.createElement('button');
      advBtn.type = 'button';
      advBtn.className = 'action-button mode-button advantage-button';
      advBtn.dataset.mode = 'advantage';
      advBtn.setAttribute('data-tooltip', 'Advantage');
      advBtn.setAttribute('data-tooltip-direction', 'UP');
      advBtn.textContent = 'ADV';
      actionsRow.appendChild(advBtn);
    }

    const clearRow = document.createElement('div');
    clearRow.className = 'dice-tray-row clear-row';
    const clearLink = document.createElement('button');
    clearLink.type = 'button';
    clearLink.className = 'clear-rolls';
    clearLink.textContent = 'clear rolls';
    clearRow.appendChild(clearLink);

    actionsContainer.appendChild(actionsRow);
    actionsContainer.appendChild(clearRow);

    panel.appendChild(diceRow);
    panel.appendChild(actionsContainer);

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

    const clearLink = panel?.querySelector('.clear-rolls');
    if (clearLink) clearLink.addEventListener('click', () => this._clearQueue(panel));

    // Mode toggle buttons (advantage / disadvantage)
    panel?.querySelectorAll('.mode-button').forEach(btn => {
      btn.addEventListener('click', () => {
        this._setRollMode(btn.dataset.mode);
      });
    });

    // Sync mode buttons on this tray to current global state
    this._updateModeButtons(panel);
  }

  /**
   * Update the count badge on a die button
   * @private
   */
  _updateDieBadge(btn) {
    const dice = btn.dataset.dice;
    const count = this.queue[dice];
    const badge = btn.querySelector('.dice-count');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    }
    btn.classList.toggle('has-count', count > 0);
  }

  /**
   * Build formula from queue, optionally applying advantage/disadvantage
   * @private
   */
  _buildFormula() {
    const parts = [];
    for (const [type, count] of Object.entries(this.queue)) {
      if (count <= 0) continue;
      if (type === 'd20' && this.rollMode !== 'normal') {
        const keep = this.rollMode === 'advantage' ? 'kh' : 'kl';
        parts.push(`${count * 2}d20${keep}${count}`);
      } else {
        parts.push(`${count}${type}`);
      }
    }
    return parts.join(' + ');
  }

  /**
   * Roll all queued dice
   * @private
   */
  _rollQueue() {
    let formula = this._buildFormula();

    // In advantage/disadvantage mode with an empty queue, default to 2d20
    if (!formula && this.rollMode !== 'normal') {
      const keep = this.rollMode === 'advantage' ? 'kh' : 'kl';
      formula = `2d20${keep}`;
    }

    if (!formula) {
      ui.notifications.warn('No dice selected');
      return;
    }
    this._rollFormula(formula);
    this._clearQueue(document.querySelector('.dice-tray-panel'));
  }

  /**
   * Clear the queue, mode, and hide badges
   * @private
   */
  _clearQueue(panel) {
    CONFIG.DICE_TYPES.forEach(d => this.queue[d.type] = 0);
    this.rollMode = 'normal';
    document.querySelectorAll('.dice-tray-panel').forEach(p => {
      p.querySelectorAll('.dice-tray-button').forEach(btn => this._updateDieBadge(btn));
    });
    this._syncModeButtons();
  }

  /**
   * Toggle roll mode (advantage / disadvantage). Clicking same mode turns it off.
   * @private
   */
  _setRollMode(mode) {
    const wasActive = this.rollMode === mode;
    this.rollMode = wasActive ? 'normal' : mode;
    // Clear the entire queue whenever a mode is toggled
    CONFIG.DICE_TYPES.forEach(d => this.queue[d.type] = 0);
    // Queue a d20 when entering advantage/disadvantage mode
    if (!wasActive) this.queue['d20'] = 1;
    document.querySelectorAll('.dice-tray-panel').forEach(p => {
      p.querySelectorAll('.dice-tray-button').forEach(btn => this._updateDieBadge(btn));
    });
    this._syncModeButtons();
  }

  /**
   * Sync mode button visuals across all tray instances
   * @private
   */
  _syncModeButtons() {
    document.querySelectorAll('.dice-tray-panel').forEach(panel => {
      this._updateModeButtons(panel);
    });
  }

  /**
   * Sync tray state (badges + mode buttons) on an existing tray element
   * @private
   */
  _syncTray(tray) {
    tray.querySelectorAll('.dice-tray-button').forEach(btn => this._updateDieBadge(btn));
    this._updateModeButtons(tray);
  }

  /**
   * Show only the tray that matches the current sidebar state.
   * When expanded: show tray inside #sidebar-content, hide others.
   * When collapsed: show tray outside #sidebar-content, hide inside.
   * @private
   */
  _toggleTrayVisibility() {
    const sidebarContent = document.getElementById('sidebar-content');
    const isExpanded = sidebarContent?.classList.contains('expanded') ?? false;

    document.querySelectorAll('.dice-tray-panel').forEach(tray => {
      const isInsideExpanded = tray.closest('#sidebar-content') !== null;
      if (isExpanded) {
        tray.style.display = isInsideExpanded ? 'flex' : 'none';
      } else {
        tray.style.display = isInsideExpanded ? 'none' : 'flex';
      }
    });
  }

  /**
   * Watch sidebar-content for .expanded class and toggle tray visibility.
   * @private
   */
  _attachExpandedObserver() {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;

    this._toggleTrayVisibility();

    const observer = new MutationObserver(() => this._toggleTrayVisibility());
    observer.observe(sidebarContent, { attributes: true, attributeFilter: ['class'] });
  }

  /**
   * Update mode buttons on a single tray panel
   * @private
   */
  _updateModeButtons(panel) {
    if (!panel) return;
    const advBtn = panel.querySelector('.advantage-button');
    const disBtn = panel.querySelector('.disadvantage-button');
    const rollBtn = panel.querySelector('.roll-button');
    if (advBtn) advBtn.classList.toggle('active', this.rollMode === 'advantage');
    if (disBtn) disBtn.classList.toggle('active', this.rollMode === 'disadvantage');
    if (rollBtn) {
      rollBtn.classList.toggle('advantage-active', this.rollMode === 'advantage');
      rollBtn.classList.toggle('disadvantage-active', this.rollMode === 'disadvantage');
      let label = 'Roll';
      if (this.rollMode === 'advantage') label = 'Roll w/ Advantage';
      if (this.rollMode === 'disadvantage') label = 'Roll w/ Disadvantage';
      rollBtn.innerHTML = `<i class="fas fa-dice-d20"></i> ${label}`;
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

      // ChatMessage.getSpeaker() automatically uses the controlled token's
      // actor name if a character is selected, or the player's name if not.
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker(),
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
