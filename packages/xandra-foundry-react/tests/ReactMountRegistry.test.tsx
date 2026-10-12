import { act } from 'react';
import { describe, expect, it } from 'vitest';
import ReactMountRegistry from '../src/ReactMountRegistry';

const renderLabel = (label: string) => <span>{label}</span>;

describe('ReactMountRegistry', () => {
  it('mounts once and rerenders into the existing root', async () => {
    document.body.innerHTML = '<div id="anchor"></div>';
    const registry = new ReactMountRegistry();
    let label = 'first';

    registry.register({
      key: 'test',
      resolveAnchor: () => document.querySelector('#anchor'),
      render: () => renderLabel(label)
    });

    await act(async () => registry.reconcile());
    const firstContainer = document.querySelector('[data-xandra-react-mount="test"]');
    expect(firstContainer?.textContent).toBe('first');

    label = 'second';
    await act(async () => registry.reconcile());
    const containers = document.querySelectorAll('[data-xandra-react-mount="test"]');
    expect(containers).toHaveLength(1);
    expect(containers[0]).toBe(firstContainer);
    expect(containers[0]?.textContent).toBe('second');

    await act(async () => registry.destroy());
  });

  it('moves the root when Foundry replaces the anchor', async () => {
    document.body.innerHTML = '<div id="anchor"></div>';
    const registry = new ReactMountRegistry();

    registry.register({
      key: 'test',
      resolveAnchor: () => document.querySelector('#anchor'),
      render: () => renderLabel('mounted')
    });

    await act(async () => registry.reconcile());
    const oldContainer = document.querySelector('[data-xandra-react-mount="test"]');
    document.querySelector('#anchor')?.replaceWith(
      Object.assign(document.createElement('div'), { id: 'anchor' })
    );

    await act(async () => registry.reconcile());
    const newContainer = document.querySelector('[data-xandra-react-mount="test"]');
    expect(newContainer).not.toBe(oldContainer);
    expect(oldContainer?.isConnected).toBe(false);
    expect(newContainer?.textContent).toBe('mounted');

    await act(async () => registry.destroy());
  });

  it('unmounts when its predicate becomes false', async () => {
    document.body.innerHTML = '<div id="anchor"></div>';
    const registry = new ReactMountRegistry();
    let enabled = true;

    registry.register({
      key: 'test',
      resolveAnchor: () => document.querySelector('#anchor'),
      shouldMount: () => enabled,
      render: () => renderLabel('mounted')
    });

    await act(async () => registry.reconcile());
    expect(registry.isMounted('test')).toBe(true);

    enabled = false;
    await act(async () => registry.reconcile());
    expect(registry.isMounted('test')).toBe(false);
    expect(document.querySelector('[data-xandra-react-mount="test"]')).toBeNull();

    await act(async () => registry.destroy());
  });
});
