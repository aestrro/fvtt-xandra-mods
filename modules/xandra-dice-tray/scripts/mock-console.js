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
    .mock-dice-row { display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; width:100%; align-items:center; justify-items:center; }
    .mock-die { display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:1/1; min-height:28px; background:#4b4a44; border:none; border-radius:4px; color:#b5b3a4; cursor:pointer; font-size:0.75em; font-weight:700; position:relative; overflow:visible; transition:background 0.12s ease, box-shadow 0.12s ease; user-select:none; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06); }
    .mock-die:hover { background:#3e3d38; color:#f0f0e0; box-shadow:inset 0 0 0 1px #ff0000; }
    .mock-die:active { background:#2e2d29; box-shadow:inset 0 0 0 2px #ff0000; }
    .mock-die .die-count { position:absolute; top:2px; right:2px; background:#ff0000; color:#fff; font-size:1.1em; font-weight:700; padding:2px 5px; border-radius:3px; line-height:1; display:none; pointer-events:none; }
    .mock-die .die-count.visible { display:block; }
    .mock-actions { display:grid; grid-template-columns:2fr 1fr; gap:1px; width:100%; }
    .mock-action { display:flex; align-items:center; justify-content:center; gap:4px; padding:4px; border:none; border-radius:4px; cursor:pointer; font-size:0.75em; font-weight:700; transition:background 0.12s ease, box-shadow 0.12s ease; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06); }
    .mock-action:hover { color:#f0f0e0; }
    .mock-roll { background:#2a3a2a; color:#90e090; }
    .mock-roll:hover { background:#3a5d3a; box-shadow:inset 0 0 0 1px #90e090; }
    .mock-clear { background:#3a2a2a; color:#e09090; }
    .mock-clear:hover { background:#5d3a3a; box-shadow:inset 0 0 0 1px #e09090; }
    .mock-panel { display:flex; flex-direction:column; align-items:center; width:100%; padding:4px 0; background:rgba(0,0,0,0.5); border-top:1px solid #555; gap:2px; }
  `;
  document.head.appendChild(style);

  const queue = { d4:0, d6:0, d8:0, d10:0, d12:0, d20:0, d100:0 };

  const doRoll = (formula) => {
    const roll = new Roll(formula);
    let speaker = ChatMessage.getSpeaker();
    const selectedTokens = canvas?.tokens?.controlled ?? [];
    if (selectedTokens.length > 0) {
      const token = selectedTokens[0];
      speaker = { alias: token.name, actor: token.id };
    }
    roll.toMessage({ speaker, flavor: formula }, { rollMode: game.settings.get('core', 'rollMode') });
  };

  const panel = document.createElement('div');
  panel.className = 'dice-tray-panel mock-panel';

  const diceRow = document.createElement('div');
  diceRow.className = 'mock-dice-row';

  const DICE = [
    { type: 'd4', icon: 'fa-dice-d4', label: 'd4' },
    { type: 'd6', icon: 'fa-dice-d6', label: 'd6' },
    { type: 'd8', icon: 'fa-dice-d8', label: 'd8' },
    { type: 'd10', icon: 'fa-dice-d10', label: 'd10' },
    { type: 'd12', icon: 'fa-dice-d12', label: 'd12' },
    { type: 'd20', icon: 'fa-dice-d20', label: 'd20' },
    { type: 'd100', icon: null, label: 'd%' }
  ];

  const updateBadge = (btn, type) => {
    const badge = btn.querySelector('.die-count');
    if (badge) {
      badge.textContent = queue[type];
      badge.classList.toggle('visible', queue[type] > 0);
    }
  };

  DICE.forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mock-die';
    if (d.icon) btn.innerHTML = `<i class="fas ${d.icon}"></i>`;
    else btn.textContent = d.label;

    const badge = document.createElement('span');
    badge.className = 'die-count';
    badge.textContent = '0';
    btn.appendChild(badge);

    btn.setAttribute('data-tooltip', d.label);
    btn.setAttribute('aria-label', `Roll ${d.label}`);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      queue[d.type]++;
      updateBadge(btn, d.type);
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      queue[d.type] = Math.max(0, queue[d.type] - 1);
      updateBadge(btn, d.type);
    });

    diceRow.appendChild(btn);
  });

  const actionsRow = document.createElement('div');
  actionsRow.className = 'mock-actions';

  const rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.className = 'mock-action mock-roll';
  rollBtn.innerHTML = '<i class="fas fa-dice-d20"></i> Roll';
  rollBtn.addEventListener('click', () => {
    const parts = [];
    for (const [type, count] of Object.entries(queue)) {
      if (count > 0) parts.push(`${count}${type}`);
    }
    if (parts.length === 0) { ui.notifications.warn('No dice selected'); return; }
    doRoll(parts.join(' + '));
    DICE.forEach(d => { queue[d.type] = 0; updateBadge(diceRow.querySelector(`[data-tooltip="${d.label}"]`), d.type); });
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'mock-action mock-clear';
  clearBtn.innerHTML = '<i class="fas fa-times"></i> Clear';
  clearBtn.addEventListener('click', () => {
    DICE.forEach(d => { queue[d.type] = 0; updateBadge(diceRow.querySelector(`[data-tooltip="${d.label}"]`), d.type); });
  });

  actionsRow.appendChild(rollBtn);
  actionsRow.appendChild(clearBtn);

  panel.appendChild(diceRow);
  panel.appendChild(actionsRow);

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

  console.log('✅ Flat mock injected');
})();
