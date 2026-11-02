import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RollOffApp from '../src/components/RollOffApp';
import type { RollOffViewModel } from '../src/foundry/prepareViewModel';

const baseModel = (): RollOffViewModel => ({
  hasData: false, isActive: false, isGM: true, isParticipant: true,
  canCurrentUserRoll: false, roundComplete: false, roundLabel: '',
  roundResult: null, roundHistory: [], participantStatuses: [], tracker: [],
  sessionHistory: [], winner: null, winsNeeded: 0,
  dieChoices: [{ value: '1d20', label: 'd20' }], defaultDieType: '1d20', defaultWinsNeeded: 2,
  users: [
    { id: 'gm', name: 'GM', isGM: true, connected: true, avatar: 'gm.png' },
    { id: 'a', name: 'Alice', isGM: false, connected: true, avatar: 'alice.png' },
    { id: 'b', name: 'Bob', isGM: false, connected: false, avatar: 'bob.png' }
  ]
});

beforeEach(() => {
  vi.stubGlobal('game', {
    i18n: {
      localize: (key: string) => key,
      format: (key: string, values: Record<string, number>) => {
        if (key.endsWith('.FirstTo')) return `First to ${values.wins}`;
        if (key.endsWith('.PlayerCount')) return `${values.count} players`;
        if (key.endsWith('.SelectedCount')) return `${values.count} selected`;
        if (key.endsWith('.RollsReceived')) return `${values.count} / ${values.total} rolled`;
        return `${values.wins} / ${values.target} wins`;
      }
    },
    settings: { get: () => true }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RollOffApp', () => {
  it('shows the rolling identity with supporting round, target, roll count, and wins utility', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.roundLabel = 'Round 7';
    model.winsNeeded = 5;
    model.tracker = [
      { userId: 'a', name: 'Alice', isCurrentUser: true, wins: 2, slots: [] },
      { userId: 'b', name: 'Bob', isCurrentUser: false, wins: 1, slots: [] }
    ];
    model.participantStatuses = [
      { id: 'a', userId: 'a', name: 'Alice', avatar: 'a.png', rolled: true, value: 12 },
      { id: 'b', userId: 'b', name: 'Bob', avatar: 'b.png', rolled: false, value: null }
    ];
    const { rerender } = render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    const header = document.querySelector('.xro-live-banner');
    expect(header?.querySelector('svg, i')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Alice — Round 7' })).toBeTruthy();
    expect(header?.querySelector('.xro-header-eyebrow')?.textContent).toBe('Round 7');
    expect(header?.querySelector('.xro-header-character-name')?.textContent).toBe('Alice');
    expect(header?.querySelector('.xro-header-avatar')?.getAttribute('src')).toBe('a.png');
    expect(header?.textContent).not.toContain('LiveContest');
    expect(header?.querySelector('.xro-header-target')?.textContent).toBe('First to 5');
    expect(screen.getByText('1 / 2 rolled')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    const wins = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Labels.Wins' });
    expect(wins.closest('.xro-header-utility-row')?.querySelector('.xro-header-progress')).toBeTruthy();
    model.participantStatuses[1] = { ...model.participantStatuses[1], rolled: true, value: 18 };
    rerender(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByText('2 / 2 rolled')).toBeTruthy();
  });

  it('switches the header to a GM roll-for target and back when rolling as self', async () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.canCurrentUserRoll = true;
    model.roundLabel = 'Round 3';
    model.tracker = [
      { userId: 'gm', name: 'GM', isCurrentUser: true, wins: 0, slots: [] },
      { userId: 'a', name: 'Alice', isCurrentUser: false, wins: 0, slots: [] }
    ];
    model.participantStatuses = [
      { id: 'gm', userId: 'gm', name: 'GM', avatar: 'gm.png', rolled: false, value: null },
      { id: 'a', userId: 'a', name: 'Alice', avatar: 'alice.png', rolled: false, value: null }
    ];
    const onAction = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    render(<RollOffApp model={model} showHistory={false} onAction={onAction} />);
    expect(screen.getByRole('heading', { name: 'GM — Round 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Roll for Alice' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'GM — Round 3' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Roll for Alice' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alice — Round 3' })).toBeTruthy());
    expect(document.querySelector('.xro-header-avatar')?.getAttribute('src')).toBe('alice.png');
    await waitFor(() => expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Roll' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Roll' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'GM — Round 3' })).toBeTruthy());
  });

  it('does not invent a rolling identity for spectators', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.isParticipant = false;
    model.roundLabel = 'Round 7';
    model.tracker = [{ userId: 'a', name: 'Alice', isCurrentUser: false, wins: 0, slots: [] }];
    render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Round 7' })).toBeTruthy();
    expect(document.querySelector('.xro-header-round-number')?.textContent).toBe('07');
    expect(document.querySelector('.xro-header-avatar')).toBeNull();
  });

  it('preserves full tiebreak labels and completed winner names instead of splitting their numbers', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.roundLabel = 'Tie #2';
    const { rerender } = render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Tie #2' })).toBeTruthy();
    expect(document.querySelector('.xro-header-round-name')?.textContent).toBe('Tie #2');
    expect(document.querySelector('.xro-header-round-number')).toBeNull();
    model.isActive = false;
    model.winner = { id: 'a', name: 'Hero 7', score: 3, avatar: 'a.png' };
    rerender(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Hero 7' })).toBeTruthy();
    expect(document.querySelector('.xro-header-character-name')?.textContent).toBe('Hero 7');
    expect(document.querySelector('.xro-header-avatar')?.getAttribute('src')).toBe('a.png');
  });

  it('shows completed-session history even without active contest data', () => {
    const model = baseModel();
    model.sessionHistory = [{ id: 'session-1', winnerName: 'Alice', endedAt: '2026-01-01', endedLabel: 'Jan 1',
      dieType: '1d20', winsNeeded: 2, participants: ['a', 'b'], history: [] }];
    render(<RollOffApp model={model} showHistory onAction={vi.fn()} />);
    expect(screen.getByText('Contest complete')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Choose participants')).toBeNull();
  });

  it('keeps selected participants while configuring and submits one start request', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<RollOffApp model={baseModel()} showHistory={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Bob/ }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Start' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('start', {
      dieType: '1d20', winsNeeded: 3, participants: ['gm', 'a']
    }));
  });

  it('keeps setup selection and rules accessible for a 20-player roster with one selection mark per player', () => {
    const model = baseModel();
    model.users = Array.from({ length: 20 }, (_, index) => ({
      id: `p${index}`, name: `Player ${index + 1}`, avatar: `p${index}.png`, isGM: false, connected: true
    }));
    render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(document.querySelectorAll('.xro-gm-user-row')).toHaveLength(20);
    expect(document.querySelectorAll('.xro-gm-user-check')).toHaveLength(20);
    const roster = document.querySelector('.xro-gm-roster');
    expect(roster?.firstElementChild?.className).toBe('xro-gm-selection-actions');
    expect(roster?.lastElementChild?.className).toBe('xro-gm-user-list');
    expect(document.querySelector('.xro-gm-user-index')).toBeNull();
    expect(document.querySelector('.xro-gm-section-heading')).toBeNull();
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.StartHeading')).toBeTruthy();
    expect(document.querySelectorAll('.xro-setup-actionbar .xro-gm-field')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Start' }).closest('.xro-setup-actionbar')).not.toBeNull();
    expect(document.querySelector('.xro-setup-banner i')).toBeNull();
    expect(screen.getByText('20 selected')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'XANDRA_ROLL_OFFS.Labels.DieType' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'XANDRA_ROLL_OFFS.Labels.WinsNeeded' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Clear' }));
    expect(screen.getByText('0 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Start' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.SelectAll' }));
    expect(screen.getByText('20 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Start' }).hasAttribute('disabled')).toBe(false);
  });

  it('renders the active participant and GM action paths without duplicating roll handlers', async () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.canCurrentUserRoll = true;
    model.roundLabel = 'Round 1';
    model.participantStatuses = [{ id: 'a', userId: 'a', name: 'Alice', avatar: 'alice.png', rolled: false, value: null }];
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<RollOffApp model={model} showHistory={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll for Alice' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('rollFor', 'a'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('offers GM advancement only after the round is complete', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.roundComplete = true;
    model.roundResult = { type: 'tie', tieNames: 'Alice, Bob' };
    render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.NextRound' })).toBeTruthy();
    expect(screen.getByText('Alice, Bob')).toBeTruthy();
    expect(document.querySelector('.xro-round-result-modal')?.parentElement?.className).toBe('xro-round-stage');
    expect(document.querySelector('.xro-round-result-panel')?.classList.contains('xro-round-result-panel--tie')).toBe(true);
    expect(screen.queryByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.ForceResolve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Cancel' })).toBeTruthy();
  });

  it('keeps one primary roll action and separate, labeled GM utilities in the footer', async () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.canCurrentUserRoll = true;
    const onAction = vi.fn().mockResolvedValue(true);
    render(<RollOffApp model={model} showHistory={false} onAction={onAction} />);
    const roll = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Roll' });
    const missing = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.ForceResolve' });
    const cancel = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Cancel' });
    expect(roll.closest('.xro-footer-primary')).not.toBeNull();
    expect(missing.closest('.xro-footer-utilities')).not.toBeNull();
    expect(cancel.textContent?.trim()).toBe('');
    expect(cancel.getAttribute('title')).toBe('XANDRA_ROLL_OFFS.Actions.Cancel');
    fireEvent.click(roll);
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('roll', undefined));
    await waitFor(() => expect(missing.hasAttribute('disabled')).toBe(false));
    fireEvent.click(missing);
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('forceResolve', undefined));
    await waitFor(() => expect(cancel.hasAttribute('disabled')).toBe(false));
    fireEvent.click(cancel);
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('cancel', undefined));
    expect(onAction).toHaveBeenCalledTimes(3);
  });

  it('shows a player result or waiting status instead of disabled roll controls and hides GM utilities', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.isGM = false;
    model.tracker = [{ userId: 'a', name: 'Alice', wins: 0, isCurrentUser: true, slots: [] }];
    model.participantStatuses = [{ id: 'a', userId: 'a', name: 'Alice', avatar: 'a.png', rolled: true, value: 17 }];
    const { rerender } = render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(document.querySelector('.xro-footer-status strong')?.textContent).toBe('17');
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.Rolled')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Roll' })).toBeNull();
    expect(document.querySelector('.xro-footer-utilities')).toBeNull();
    model.participantStatuses = [];
    rerender(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.queryByText('XANDRA_ROLL_OFFS.Labels.Rolled')).toBeNull();
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.Waiting')).toBeTruthy();
    model.roundComplete = true;
    rerender(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.WaitingForGM')).toBeTruthy();
  });

  it('opens scores from the header without a bottom tracker and dismisses on Escape or outside click', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = false;
    model.isGM = true;
    model.isParticipant = true;
    model.roundComplete = true;
    model.roundResult = { type: 'winner', name: 'Alice' };
    model.winsNeeded = 3;
    model.tracker = [
      { userId: 'gm', name: 'Current hero', isCurrentUser: true, wins: 2, slots: [{ won: true }, { won: true }, { won: false }] },
      { userId: 'a', name: 'Alice with a long character name', isCurrentUser: false, wins: 1, slots: [{ won: true }, { won: false }, { won: false }] }
    ];
    render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.CloseRollOff' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Actions.Close' })).toBeTruthy();
    expect(document.querySelector('.xro-window-body--complete')).not.toBeNull();
    expect(document.querySelector('.xro-window-body--complete .xro-footer--complete')).not.toBeNull();
    expect(document.querySelector('.xro-completion-modal')).not.toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.querySelector('.xro-tracker')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Labels.Wins' });
    expect(toggle.closest('header')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'XANDRA_ROLL_OFFS.Labels.Wins' }).id).toBe(toggle.getAttribute('aria-controls'));
    expect(document.querySelectorAll('.xro-wins-player')).toHaveLength(2);
    expect(screen.getByText('2 / 3 wins')).toBeTruthy();
    expect(screen.getByText('1 / 3 wins')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('2 / 3 wins'));
    expect(screen.getByRole('region')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' });
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.querySelector('.xro-footer')).not.toBeNull();
  });

  it('shows all 20 player scores to non-GMs and keeps them updated while open', () => {
    const model = baseModel();
    model.hasData = true;
    model.isActive = true;
    model.isGM = false;
    model.winsNeeded = 5;
    model.tracker = Array.from({ length: 20 }, (_, index) => ({
      userId: `p${index}`, name: `Player ${index + 1}`, wins: 0, isCurrentUser: index === 0, slots: []
    }));
    const { rerender } = render(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'XANDRA_ROLL_OFFS.Labels.Wins' });
    fireEvent.click(toggle);
    expect(document.querySelectorAll('.xro-wins-player')).toHaveLength(20);
    model.tracker[0].wins = 2;
    rerender(<RollOffApp model={model} showHistory={false} onAction={vi.fn()} />);
    expect(screen.getByText('2 / 5 wins')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.click(toggle);
    fireEvent.focusIn(document.body);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
