import { ReactMountRegistry } from '@xandra/foundry-react';
import { DiceTray } from '../../components';
import { SELECTORS } from '../../constants';
import type { DiceRollHandler, DiceTrayLabels, DiceTrayStore } from '../../types';

const EXPANDED_MOUNT_KEY = 'dice-tray:expanded';
const COLLAPSED_MOUNT_KEY = 'dice-tray:collapsed';

interface MountDiceTrayOptions {
  isEnabled: () => boolean;
  labels: DiceTrayLabels;
  onEmptyQueue: () => void;
  onRoll: DiceRollHandler;
  store: DiceTrayStore;
  supportsRollModes: () => boolean;
}

export interface DiceTrayMountController {
  destroy: () => void;
  refresh: () => void;
}

export const findChatMessage = (insideSidebar: boolean): Element | null =>
  [...document.querySelectorAll(SELECTORS.CHAT_MESSAGE)].find(
    (element) => Boolean(element.closest(SELECTORS.SIDEBAR_CONTENT)) === insideSidebar
  ) ?? null;

export const isExpandedSidebar = (): boolean =>
  document.querySelector(SELECTORS.SIDEBAR_CONTENT)?.classList.contains('expanded') ?? false;

const isRelevantMutation = (mutations: MutationRecord[]): boolean =>
  mutations.some((mutation) =>
    [...mutation.addedNodes].some(
      (node) =>
        node instanceof Element &&
        (node.matches(SELECTORS.CHAT_MESSAGE) ||
          node.matches('#sidebar, #sidebar-content') ||
          Boolean(node.querySelector(`${SELECTORS.CHAT_MESSAGE}, #sidebar, #sidebar-content`)))
    )
  );

const mountDiceTray = (options: MountDiceTrayOptions): DiceTrayMountController => {
  const registry = new ReactMountRegistry();
  let sidebarObserver: MutationObserver | null = null;
  let observedSidebar: Element | null = null;
  let uiObserver: MutationObserver | null = null;
  let refreshQueued = false;

  const isVisible = (mountKey: string) =>
    mountKey === EXPANDED_MOUNT_KEY ? isExpandedSidebar() : !isExpandedSidebar();

  const renderTray = (mountKey: string) => (
    <DiceTray
      store={options.store}
      labels={options.labels}
      visible={isVisible(mountKey)}
      supportsRollModes={options.supportsRollModes()}
      onRoll={options.onRoll}
      onEmptyQueue={options.onEmptyQueue}
    />
  );

  registry.register({
    key: EXPANDED_MOUNT_KEY,
    className: 'xdt-react-root',
    resolveAnchor: () => findChatMessage(true),
    shouldMount: options.isEnabled,
    render: () => renderTray(EXPANDED_MOUNT_KEY)
  });

  registry.register({
    key: COLLAPSED_MOUNT_KEY,
    className: 'xdt-react-root',
    resolveAnchor: () => findChatMessage(false),
    shouldMount: options.isEnabled,
    render: () => renderTray(COLLAPSED_MOUNT_KEY)
  });

  const attachSidebarObserver = () => {
    const sidebar = document.querySelector(SELECTORS.SIDEBAR_CONTENT);
    if (sidebar === observedSidebar && sidebar?.isConnected) return;

    sidebarObserver?.disconnect();
    sidebarObserver = null;
    observedSidebar = sidebar;

    if (!sidebar) return;
    sidebarObserver = new MutationObserver(() => scheduleRefresh());
    sidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class']
    });
  };

  const refresh = () => {
    attachSidebarObserver();
    registry.reconcile();
  };

  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refresh();
    });
  };

  const observerTarget = document.querySelector(SELECTORS.UI_RIGHT) ?? document.body;
  uiObserver = new MutationObserver((mutations) => {
    if (isRelevantMutation(mutations)) scheduleRefresh();
  });
  uiObserver.observe(observerTarget, { childList: true, subtree: true });

  refresh();

  return {
    refresh: scheduleRefresh,
    destroy: () => {
      sidebarObserver?.disconnect();
      uiObserver?.disconnect();
      registry.destroy();
      observedSidebar = null;
    }
  };
};

export default mountDiceTray;
