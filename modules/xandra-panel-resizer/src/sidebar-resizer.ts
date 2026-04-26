import { Settings } from './settings.js';

/**
 * Sidebar Resizer - Draggable handle to resize the sidebar via --sidebar-width.
 * Only visible when #sidebar-content has the .expanded class.
 */
export class SidebarResizer {
  static MODULE_ID = 'xandra-panel-resizer';
  static MIN_WIDTH = 200;
  static MAX_WIDTH = 600;

  private static grabber: HTMLElement | null = null;
  private static isDragging = false;
  private static startX = 0;
  private static startWidth = 0;
  private static expandedObserver: MutationObserver | null = null;

  static init(): void {
    console.log('Xandra Panel Resizer | Initializing...');

    Hooks.once('ready', () => {
      this.setup();
    });

    window.addEventListener('resize', () => this.updateGrabberPosition());
  }

  private static setup(): void {
    if (!Settings.get<boolean>('enableResizer')) {
      console.log('Xandra Panel Resizer | Disabled in settings');
      return;
    }

    const sidebar = ui.sidebar?.element;
    if (!sidebar) {
      console.warn('Xandra Panel Resizer | ui.sidebar.element not available');
      return;
    }

    sidebar.classList.add('sp-sidebar-resizable');

    this.restoreWidth();
    this.createGrabber();
    this.syncGrabberVisibility();

    const content = sidebar.querySelector('#sidebar-content');
    if (content) {
      this.expandedObserver = new MutationObserver(() => this.syncGrabberVisibility());
      this.expandedObserver.observe(content, { attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

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

    const sidebar = ui.sidebar?.element;
    const content = sidebar?.querySelector('#sidebar-content');
    const isExpanded = content?.classList.contains('expanded');

    this.grabber.style.display = isExpanded ? 'block' : 'none';
    if (isExpanded) this.updateGrabberPosition();
  }

  private static updateGrabberPosition(): void {
    if (!this.grabber) return;

    const sidebar = ui.sidebar?.element;
    const content = sidebar?.querySelector('#sidebar-content') as HTMLElement | null;
    if (!content) return;

    const rect = content.getBoundingClientRect();
    const grabberWidth = 4;

    this.grabber.style.left = `${rect.left - grabberWidth}px`;
    this.grabber.style.top = `${rect.top}px`;
    this.grabber.style.height = `${rect.height}px`;
  }

  private static getSidebarWidth(): number {
    const sidebar = ui.sidebar?.element;
    if (!sidebar) return 0;
    const raw = getComputedStyle(sidebar).getPropertyValue('--sidebar-width').trim();
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private static restoreWidth(): void {
    const savedWidth = Settings.get<number>('sidebarWidth');
    if (savedWidth && savedWidth >= this.MIN_WIDTH && savedWidth <= this.MAX_WIDTH) {
      this.setSidebarWidth(savedWidth);
      console.log(`Xandra Panel Resizer | Restored --sidebar-width: ${savedWidth}px`);
    }
  }

  private static setSidebarWidth(width: number): void {
    const sidebar = ui.sidebar?.element;
    if (!sidebar) return;

    sidebar.style.setProperty('--sidebar-width', `${width}px`);
    this.updateGrabberPosition();
  }

  private static onMouseDown(e: MouseEvent): void {
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
}
