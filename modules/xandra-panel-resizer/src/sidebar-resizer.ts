import { Settings } from './settings.js';

/**
 * Sidebar Resizer - Adds a draggable handle to resize the sidebar
 */
export class SidebarResizer {
  static MODULE_ID = 'xandra-panel-resizer';
  static MIN_WIDTH = 200;
  static MAX_WIDTH = 600;

  
  private static sidebar: HTMLElement | null = null;
  private static grabber: HTMLElement | null = null;
  private static isDragging = false;
  private static startX = 0;
  private static startWidth = 0;

  static init(): void {
    console.log('Xandra Panel Resizer | SidebarResizer initializing...');
    
    Hooks.on('renderSidebar', this.onSidebarRender.bind(this));
    
    Hooks.once('ready', () => {
      console.log('Xandra Panel Resizer | Setting up sidebar...');
      this.setupSidebar();
    });
    
    // Update grabber position on window resize
    window.addEventListener('resize', () => this.updateGrabberPosition());
  }

  private static setupSidebar(): void {
    const enabled = Settings.get<boolean>('enableResizer');
    if (!enabled) {
      console.log('Xandra Panel Resizer | Resizer disabled in settings');
      return;
    }

    this.sidebar = document.getElementById('sidebar');
    if (!this.sidebar) {
      console.warn('Xandra Panel Resizer | Sidebar element not found');
      return;
    }

    // Remove existing grabber if any
    if (this.grabber) {
      this.grabber.remove();
    }

    console.log('Xandra Panel Resizer | Adding resizer to sidebar');
    

    
    this.createGrabber();
    this.restoreWidth();
    this.setupGlobalEvents();
  }

  private static onSidebarRender(): void {
    this.setupSidebar();
  }

  private static createGrabber(): void {
    this.grabber = document.createElement('div');
    this.grabber.className = 'sp-sidebar-grabber';
    this.grabber.setAttribute('title', 'Drag to resize sidebar');
    
    this.grabber.addEventListener('mousedown', this.onMouseDown.bind(this));
    
    // Append to body for fixed positioning
    document.body.appendChild(this.grabber);
    
    this.updateGrabberPosition();
    
    console.log('Xandra Panel Resizer | Grabber created');
  }

  private static updateGrabberPosition(): void {
    if (!this.grabber || !this.sidebar) return;

    // Find sidebar-content element
    const sidebarContent = this.sidebar.querySelector('#sidebar-content') || this.sidebar.querySelector('.sidebar-content');
    if (!sidebarContent) return;

    const rect = sidebarContent.getBoundingClientRect();
    const grabberWidth = 4;
    
    // Position grabber ON the divider between tabs and content (not over content)
    this.grabber.style.left = `${rect.left - grabberWidth}px`;
    this.grabber.style.top = `${rect.top}px`;
    this.grabber.style.height = `${rect.height}px`;
  }

  private static restoreWidth(): void {
    if (!this.sidebar) return;

    const savedWidth = Settings.get<number>('sidebarWidth');
    if (savedWidth && savedWidth >= this.MIN_WIDTH && savedWidth <= this.MAX_WIDTH) {
      this.setSidebarWidth(savedWidth);
      console.log(`Xandra Panel Resizer | Restored sidebar width: ${savedWidth}px`);
    }
  }

  private static setSidebarWidth(width: number): void {
    if (!this.sidebar) return;
    
    // Only set the sidebar width - let Foundry handle the content sizing
    this.sidebar.style.width = `${width}px`;
    
    // Update grabber position
    this.updateGrabberPosition();
  }

  private static setupGlobalEvents(): void {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private static onMouseDown(e: MouseEvent): void {
    if (!this.sidebar) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    this.isDragging = true;
    this.startX = e.clientX;
    this.startWidth = this.sidebar.offsetWidth;
    
    document.body.classList.add('sp-sidebar-dragging');
    
    console.log('Xandra Panel Resizer | Drag started');
  }

  private static onMouseMove(e: MouseEvent): void {
    if (!this.isDragging || !this.sidebar) return;
    
    const delta = this.startX - e.clientX;
    const newWidth = Math.max(this.MIN_WIDTH, Math.min(this.MAX_WIDTH, this.startWidth + delta));
    
    this.setSidebarWidth(newWidth);
  }

  private static onMouseUp(): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    document.body.classList.remove('sp-sidebar-dragging');
    
    if (this.sidebar) {
      const width = parseInt(this.sidebar.style.width, 10);
      Settings.set('sidebarWidth', width);
      console.log(`Xandra Panel Resizer | Saved sidebar width: ${width}px`);
      this.setSidebarWidth(width);
    }
  }
}
