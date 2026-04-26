import { Settings } from './settings.js';

/**
 * Sidebar Resizer - Draggable handle to resize the sidebar via --sidebar-width.
 *
 * V14 design principles (learned from dice-tray):
 * - Never cache DOM references; query ui.sidebar?.element fresh every time.
 * - Observe #ui-right to survive sidebar re-renders.
 * - Initialize width lazily on the FIRST expand event.
 * - When collapsed: grabber is hidden, drag is ignored, --sidebar-width is not touched.
 */
export class SidebarResizer {
  static MODULE_ID = 'xandra-panel-resizer';
  static MIN_WIDTH = 200;
  static MAX_WIDTH = 600;

  private static grabber: HTMLElement | null = null;
  private static isDragging = false;
  private static startX = 0;
  private static startWidth = 0;
  private static hasInitializedWidth = false;
  private static expandedObserver: MutationObserver | null = null;
  private static uiRightObserver: MutationObserver | null = null;

  /* ================================================================ */
  /*  Public API                                                      */
  /* ================================================================ */

  static init(): void {
    console.log('Xandra Panel Resizer | Initializing...');

    Hooks.once('ready', () => {
      if (!Settings.get<boolean>('enableResizer')) {
        console.log('Xandra Panel Resizer | Disabled in settings');
        return;
      }
      this.setup();
    });

    window.addEventListener('resize', () => {
      if (this.isExpanded()) this.updateGrabberPosition();
    });
  }

  /* ================================================================ */
  /*  Setup & Observers (dice-tray survival pattern)                  */
  /* ================================================================ */

  private static setup(): void {
    this.createGrabber();
    this.attachExpandedObserver();
    this.attachUiRightObserver();
    this.syncGrabberVisibility();

    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  /**
   * Watch #sidebar-content for .expanded class changes.
   */
  private static attachExpandedObserver(): void {
    const content = this.getSidebarContent();
    if (!content || this.expandedObserver) return;

    this.expandedObserver = new MutationObserver(() => this.syncGrabberVisibility());
    this.expandedObserver.observe(content, { attributes: true, attributeFilter: ['class'] });
  }

  /**
   * Watch #ui-right so we survive sidebar re-renders (ApplicationV2 render()
   * may replace the sidebar element).  This is the same tactic the dice-tray
   * uses to survive chat-form re-renders.
   */
  private static attachUiRightObserver(): void {
    const uiRight = document.getElementById('ui-right');
    if (!uiRight || this.uiRightObserver) return;

    this.uiRightObserver = new MutationObserver((mutations) => {
      let sidebarChanged = false;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (node.id === 'sidebar' || node.querySelector('#sidebar')) {
              sidebarChanged = true;
            }
          }
        }
      }
      if (sidebarChanged) {
        // Sidebar was re-rendered: reconnect observer and reset init flag
        this.expandedObserver?.disconnect();
        this.expandedObserver = null;
        this.hasInitializedWidth = false;
        this.attachExpandedObserver();
        this.syncGrabberVisibility();
      }
    });

    this.uiRightObserver.observe(uiRight, { childList: true, subtree: true });
  }

  /* ================================================================ */
  /*  Grabber                                                         */
  /* ================================================================ */

  private static createGrabber(): void {
    if (this.grabber) return;

    this.grabber = document.createElement('div');
    this.grabber.className = 'sp-sidebar-grabber';
    this.grabber.setAttribute('title', 'Drag to resize sidebar');
    this.grabber.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.body.appendChild(this.grabber);
  }

  private static syncGrabberVisibility(): void {
    if (!this.grabber) return;

    if (this.isExpanded()) {
      if (!this.hasInitializedWidth) {
        this.initializeWidth();
        this.hasInitializedWidth = true;
      }
      this.grabber.style.display = 'block';
      this.updateGrabberPosition();
    } else {
      this.grabber.style.display = 'none';
    }
  }

  private static updateGrabberPosition(): void {
    if (!this.grabber) return;

    const content = this.getSidebarContent();
    if (!content) return;

    const rect = content.getBoundingClientRect();
    const grabberWidth = 4;

    this.grabber.style.left = `${rect.left - grabberWidth}px`;
    this.grabber.style.top = `${rect.top}px`;
    this.grabber.style.height = `${rect.height}px`;
  }

  /* ================================================================ */
  /*  Width logic                                                     */
  /* ================================================================ */

  /**
   * Called once on the first expand.  Priority:
   * 1. Saved setting (sidebarWidth)
   * 2. Current computed --sidebar-width from the DOM
   */
  private static initializeWidth(): void {
    const sidebar = ui.sidebar?.element;
    if (!sidebar) return;

    const saved = Settings.get<number>('sidebarWidth');
    if (saved && saved >= this.MIN_WIDTH && saved <= this.MAX_WIDTH) {
      sidebar.style.setProperty('--sidebar-width', `${saved}px`);
      console.log(`Xandra Panel Resizer | Restored --sidebar-width: ${saved}px`);
      return;
    }

    const current = this.getSidebarWidth();
    if (current > 0) {
      // Store the DOM's default so next time we restore from setting
      Settings.set('sidebarWidth', current);
      console.log(`Xandra Panel Resizer | Captured DOM --sidebar-width: ${current}px`);
    }
  }

  /**
   * Set --sidebar-width.  Guarded: only applies when expanded.
   */
  private static setSidebarWidth(width: number): void {
    const sidebar = ui.sidebar?.element;
    if (!sidebar || !this.isExpanded()) return;

    sidebar.style.setProperty('--sidebar-width', `${width}px`);
    this.updateGrabberPosition();
  }

  private static getSidebarWidth(): number {
    const sidebar = ui.sidebar?.element;
    if (!sidebar) return 0;
    const raw = getComputedStyle(sidebar).getPropertyValue('--sidebar-width').trim();
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /* ================================================================ */
  /*  Drag handlers                                                   */
  /* ================================================================ */

  private static onMouseDown(e: MouseEvent): void {
    if (!this.isExpanded()) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.startX = e.clientX;
    this.startWidth = this.getSidebarWidth();

    document.body.classList.add('sp-sidebar-dragging');
  }

  private static onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const delta = this.startX - e.clientX;
    const newWidth = Math.max(this.MIN_WIDTH, Math.min(this.MAX_WIDTH, this.startWidth + delta));
    this.setSidebarWidth(newWidth);
  }

  private static onMouseUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    document.body.classList.remove('sp-sidebar-dragging');

    const width = this.getSidebarWidth();
    if (width > 0) {
      Settings.set('sidebarWidth', width);
      console.log(`Xandra Panel Resizer | Saved --sidebar-width: ${width}px`);
    }
  }

  /* ================================================================ */
  /*  Helpers                                                         */
  /* ================================================================ */

  private static isExpanded(): boolean {
    const content = this.getSidebarContent();
    return content?.classList.contains('expanded') ?? false;
  }

  private static getSidebarContent(): HTMLElement | null {
    return ui.sidebar?.element?.querySelector('#sidebar-content') as HTMLElement | null;
  }
}
