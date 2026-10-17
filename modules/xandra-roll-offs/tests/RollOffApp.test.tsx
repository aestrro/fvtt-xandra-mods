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
    i18n: { localize: (key: string) => key },
    settings: { get: () => true }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RollOffApp', () => {
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
  });
});
