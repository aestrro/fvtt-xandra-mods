import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RoundTimeline from '../src/components/RoundTimeline';
import type { HistoryRound } from '../src/foundry/prepareViewModel';

beforeEach(() => {
  vi.stubGlobal('game', { i18n: { localize: (key: string) => key } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const history: HistoryRound[] = [{
  label: 'Round 1', isTie: false, winnerName: 'Alice', winnerValue: 18,
  rolls: [
    { userId: 'a', name: 'Alice', avatar: 'alice.png', value: 18, isWinner: true },
    { userId: 'b', name: 'Bob', avatar: 'bob.png', value: 4, isWinner: false }
  ]
}];

const props = {
  history, current: [], roundLabel: 'Round 2', isActive: true,
  isGM: true, isParticipant: true, onRollFor: vi.fn()
};

describe('RoundTimeline', () => {
  it('renders grouped portraits and results without winner icons', () => {
    render(<RoundTimeline {...props} />);
    expect(document.querySelectorAll('.xro-round-group--history')).toHaveLength(1);
    const historyGroup = document.querySelector('.xro-round-group--history');
    expect(historyGroup?.firstElementChild?.className).toBe('xro-round-title-row');
    expect(historyGroup?.firstElementChild?.nextElementSibling?.classList.contains('xro-round-scroller')).toBe(true);
    expect(document.querySelectorAll('.xro-scroll-stack .xro-avatar')).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByLabelText('XANDRA_ROLL_OFFS.Labels.Winner: 18')).toBeTruthy();
    expect(document.querySelector('.xro-roll-winner-mark, .xro-round-row .fa-trophy')).toBeNull();
  });

  it('keeps all 20 players in a keyboard-focusable, horizontally navigable history row', () => {
    const rolls = Array.from({ length: 20 }, (_, index) => ({
      userId: `p${index}`, name: `Player ${index + 1}`, avatar: `p${index}.png`, value: index + 1
    }));
    render(<RoundTimeline {...props} isActive={false} history={[{ ...history[0], rolls }]} />);
    const row = screen.getByRole('group', { name: 'Round 1' });
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.querySelectorAll('.xro-roll-pill')).toHaveLength(20);
    expect(row.querySelectorAll('img')).toHaveLength(20);
    Object.defineProperties(row, {
      scrollWidth: { value: 1800 }, clientWidth: { value: 400 }, scrollLeft: { value: 0, writable: true }
    });
    const scrollBy = vi.fn();
    row.scrollBy = scrollBy;
    fireEvent.scroll(row);
    const next = screen.getByRole('button', { name: 'Scroll round right' });
    expect(next.hasAttribute('disabled')).toBe(false);
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 288, behavior: 'smooth' });
    row.scrollLeft = 1400;
    fireEvent.scroll(row);
    expect(next.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Scroll round left' }).hasAttribute('disabled')).toBe(false);
  });

  it('removes arrow gutters when four players fit the full wrapper, even if existing gutters squeeze the row', () => {
    const rolls = Array.from({ length: 4 }, (_, index) => ({
      userId: `p${index}`, name: `Player ${index + 1}`, avatar: `p${index}.png`, value: index + 1
    }));
    render(<RoundTimeline {...props} isActive={false} history={[{ ...history[0], rolls }]} />);
    const row = screen.getByRole('group', { name: 'Round 1' });
    const wrapper = row.parentElement!;
    Object.defineProperties(row, {
      scrollWidth: { value: 328 }, clientWidth: { value: 300 }, scrollLeft: { value: 0 }
    });
    Object.defineProperty(wrapper, 'clientWidth', { value: 356, writable: true });
    fireEvent.scroll(row);
    expect(wrapper.classList.contains('xro-round-scroller--scrollable')).toBe(false);
    Object.defineProperty(wrapper, 'clientWidth', { value: 280 });
    fireEvent.scroll(row);
    expect(wrapper.classList.contains('xro-round-scroller--scrollable')).toBe(true);
    expect(screen.getByRole('button', { name: 'Scroll round right' }).hasAttribute('disabled')).toBe(false);
    Object.defineProperty(wrapper, 'clientWidth', { value: 356 });
    fireEvent.scroll(row);
    expect(wrapper.classList.contains('xro-round-scroller--scrollable')).toBe(false);
    expect(row.querySelectorAll('.xro-roll-pill')).toHaveLength(4);
  });

  it('pins the current round outside the history scroll while retaining portraits and GM roll actions', () => {
    const onRollFor = vi.fn();
    render(<RoundTimeline {...props} onRollFor={onRollFor} current={[
      { id: 'a', userId: 'a', name: 'Alice', avatar: 'alice.png', rolled: false, value: null }
    ]} />);
    expect(document.querySelectorAll('.xro-current-round .xro-avatar')).toHaveLength(1);
    const stack = document.querySelector('.xro-scroll-stack');
    const currentRound = document.querySelector('.xro-current-round');
    expect(stack?.contains(currentRound)).toBe(false);
    expect(stack?.nextElementSibling).toBe(currentRound);
    expect(stack?.parentElement).toBe(currentRound?.parentElement);
    expect(document.querySelectorAll('.xro-scroll-stack')).toHaveLength(1);
    const rollButton = screen.getByRole('button', { name: 'Roll for Alice' });
    expect(rollButton.textContent?.trim()).toBe('');
    expect(rollButton.getAttribute('title')).toBe('Roll for Alice');
    expect(rollButton.querySelector('.fa-dice-d20')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.Current')).toBeTruthy();
    const result = rollButton.parentElement;
    expect(result?.className).toBe('xro-player-result');
    expect(result?.previousElementSibling?.className).toBe('xro-avatar');
    fireEvent.click(rollButton);
    expect(onRollFor).toHaveBeenCalledWith('a');
  });

  it('labels tiebreak history and hides the live round after completion', () => {
    render(<RoundTimeline {...props} isActive={false} history={[{ ...history[0], isTie: true }]} />);
    expect(screen.getByText('XANDRA_ROLL_OFFS.Labels.Tiebreak')).toBeTruthy();
    expect(document.querySelector('.xro-current-round')).toBeNull();
  });

  it('follows newly appended rounds without pulling a user away from older rounds', () => {
    const { rerender } = render(<RoundTimeline {...props} />);
    const stack = document.querySelector('.xro-scroll-stack') as HTMLDivElement;
    Object.defineProperties(stack, {
      scrollHeight: { value: 1000, writable: true },
      clientHeight: { value: 300 },
      scrollTop: { value: 700, writable: true }
    });
    fireEvent.scroll(stack);
    Object.defineProperty(stack, 'scrollHeight', { value: 1200 });
    rerender(<RoundTimeline {...props} history={[...history, { ...history[0], label: 'Round 2' }]} roundLabel="Round 3" />);
    expect(stack.scrollTop).toBe(1200);
    stack.scrollTop = 100;
    fireEvent.scroll(stack);
    Object.defineProperty(stack, 'scrollHeight', { value: 1400 });
    rerender(<RoundTimeline {...props} history={[...history, { ...history[0], label: 'Round 2' }, { ...history[0], label: 'Round 3' }]} roundLabel="Round 4" />);
    expect(stack.scrollTop).toBe(100);
  });
});
