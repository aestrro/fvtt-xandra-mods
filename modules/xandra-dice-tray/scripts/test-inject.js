(() => {
  const MODULE_ID = 'xandra-dice-tray';

  // Remove existing tray if any
  const existing = document.querySelector('.dice-tray-panel');
  if (existing) existing.remove();

  // Build tray
  const panel = document.createElement('div');
  panel.className = 'dice-tray-panel';
  panel.setAttribute('role', 'toolbar');
  panel.setAttribute('aria-label', 'Dice Tray');
  panel.innerHTML = `
    <div class="dice-tray-row">
      <button type="button" class="dice-tray-button" data-dice="d4" data-sides="4"><i class="fas fa-dice-d4"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d6" data-sides="6"><i class="fas fa-dice-d6"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d8" data-sides="8"><i class="fas fa-dice-d8"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d10" data-sides="10"><i class="fas fa-dice-d10"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d12" data-sides="12"><i class="fas fa-dice-d12"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d20" data-sides="20"><i class="fas fa-dice-d20"></i><span class="dice-count">0</span></button>
      <button type="button" class="dice-tray-button" data-dice="d100" data-sides="100">d%<span class="dice-count">0</span></button>
    </div>
    <div class="dice-tray-row actions">
      <button type="button" class="action-button roll-button"><i class="fas fa-dice-d20"></i> Roll</button>
      <button type="button" class="action-button clear-button"><i class="fas fa-times"></i> Clear</button>
    </div>
  `;

  // Find form inside ui.sidebar.element (V14 API)
  const sidebar = ui.sidebar?.element;
  if (!sidebar) {
    console.error('[%s] ui.sidebar.element not available', MODULE_ID);
    return;
  }
  const chatForm = sidebar.querySelector('form.chat-form');
  if (!chatForm) {
    console.error('[%s] form.chat-form not found inside ui.sidebar.element', MODULE_ID);
    return;
  }
  console.log('[%s] Found chat form:', MODULE_ID, chatForm);

  // Find chat-message
  const chatMessage = chatForm.querySelector('#chat-message');
  if (!chatMessage) {
    console.error('[%s] #chat-message not found inside form', MODULE_ID);
    return;
  }
  console.log('[%s] Found #chat-message:', MODULE_ID, chatMessage);

  // Find menu-container
  const menuContainer = chatMessage.querySelector('.menu-container');
  if (!menuContainer) {
    console.error('[%s] .menu-container not found inside #chat-message', MODULE_ID);
    return;
  }
  console.log('[%s] Found .menu-container:', MODULE_ID, menuContainer);

  // Inject before menu-container
  menuContainer.before(panel);
  console.log('[%s] Tray injected before .menu-container', MODULE_ID);
  console.log('[%s] Resulting DOM:', MODULE_ID, chatMessage.innerHTML.substring(0, 200) + '...');
})();
