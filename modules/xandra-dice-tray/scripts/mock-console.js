(() => {
  const ID = 'xandra-dice-tray-mock';
  document.querySelectorAll('.dice-tray-panel, .dice-calculator-toggle, #' + ID).forEach(el => el.remove());

  const sidebar = document.querySelector('.chat-sidebar');
  if (!sidebar) { console.error('Open chat tab first'); return; }

  const chatForm = sidebar.querySelector('form.chat-form');
  if (!chatForm) { console.error('No chat form'); return; }

  const style = document.createElement('style');
  style.id = ID;
  style.textContent = `
    .mock-dice-row { display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; width:100%; align-items:center; justify-items:center; padding:4px 0; background:rgba(0,0,0,0.5); border-top:1px solid #555; }
    .mock-die { display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:1/1; min-height:28px; background:linear-gradient(135deg,#4b4a44,#3e3d38); border:1px solid #1a1a1a; border-radius:5px; color:#f0f0e0; cursor:pointer; font-size:0.75em; font-weight:700; position:relative; overflow:visible; transition:all 0.15s ease; }
    .mock-die:hover { background:linear-gradient(135deg,#5a5850,#4b4a44); border-color:#ff0000; box-shadow:0 2px 6px rgba(0,0,0,0.4); }
    .mock-die:active { box-shadow:inset 0 2px 6px rgba(0,0,0,0.6); }
    /* Tooltip uses Foundry's native data-tooltip system */
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'dice-tray-panel mock-dice-row';

  const appendToChat = (text) => {
    const pm = document.getElementById('chat-message');
    if (!pm) return;
    if (pm.editor?.view) {
      const view = pm.editor.view;
      const tr = view.state.tr.insertText(text + ' ');
      view.dispatch(tr);
      view.focus();
    } else {
      pm.value = (pm.value || '') + text + ' ';
      pm.focus();
    }
  };

  const doRoll = (formula) => {
    const roll = new Roll(formula);
    roll.evaluate().then(() => {
      let speaker = ChatMessage.getSpeaker();
      const selectedTokens = canvas?.tokens?.controlled ?? [];
      if (selectedTokens.length > 0) {
        const token = selectedTokens[0];
        speaker = {
          alias: token.name,
          actor: token.id
        };
      }
      roll.toMessage({ speaker, flavor: formula });
    });
  };

  const DICE = [
    { type: 'd4', icon: 'fa-dice-d4', label: 'd4' },
    { type: 'd6', icon: 'fa-dice-d6', label: 'd6' },
    { type: 'd8', icon: 'fa-dice-d8', label: 'd8' },
    { type: 'd10', icon: 'fa-dice-d10', label: 'd10' },
    { type: 'd12', icon: 'fa-dice-d12', label: 'd12' },
    { type: 'd20', icon: 'fa-dice-d20', label: 'd20' },
    { type: 'd100', icon: null, label: 'd%' }
  ];

  DICE.forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mock-die';
    if (d.icon) {
      btn.innerHTML = `<i class="fas ${d.icon}"></i>`;
    } else {
      btn.textContent = d.label;
    }
    btn.setAttribute('data-tooltip', d.label);
    btn.setAttribute('aria-label', `Roll ${d.label}`);
    btn.addEventListener('click', () => doRoll('1' + d.type));
    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); appendToChat('1' + d.type); });
    panel.appendChild(btn);
  });

  const chatControls = chatForm.querySelector('#chat-controls');
  if (chatControls) chatControls.before(panel);
  else chatForm.insertBefore(panel, chatForm.firstChild);

  if (chatControls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dice-calculator-toggle ui-control icon';
    btn.setAttribute('aria-label', 'Dice Calculator');
    btn.innerHTML = '<i class="fas fa-calculator"></i>';
    btn.addEventListener('click', () => alert('Calculator mock'));
    const controlButtons = chatControls.querySelector('.control-buttons');
    if (controlButtons) controlButtons.after(btn);
    else chatControls.appendChild(btn);
  }

  console.log('✅ Full-width mock injected');
})();
