// The title screen: the game's name and three buttons over the live city
// (the markup and its plain placeholder look are in index.html, #title-screen).
// It covers the map, so nothing under it can be clicked; while it is up the
// page has the class `title-up`, which hides the HUD (all but the sound controls).

export interface TitleHooks {
  onContinue: () => void;
  onNew: () => void;
  onLoad: () => void;
  /** The player pressed, scrolled or typed anywhere: the camera tour should stop. */
  onTouch: () => void;
}

export class TitleScreen {
  private readonly el: HTMLElement;
  private readonly continueBtn: HTMLButtonElement;
  private readonly buttons: HTMLElement;
  private readonly loading: HTMLElement;
  private readonly hooks: TitleHooks;
  // A press on the sound controls (shown over the title) is not a wish to look around: the tour carries on.
  private readonly touch = (e: Event): void => {
    if (!this.visible) return;
    if (e.target instanceof Element && e.target.closest('#music-panel')) return;
    this.hooks.onTouch();
  };

  constructor(hooks: TitleHooks) {
    this.hooks = hooks;
    this.el = document.getElementById('title-screen')!;
    this.continueBtn = document.getElementById('title-continue') as HTMLButtonElement;
    this.buttons = document.getElementById('title-buttons')!;
    this.loading = document.getElementById('title-loading')!;
    this.continueBtn.addEventListener('click', () => hooks.onContinue());
    document.getElementById('title-new')!.addEventListener('click', () => hooks.onNew());
    document.getElementById('title-load')!.addEventListener('click', () => hooks.onLoad());
    // Capture phase, on the window: a press on a button or in a dialog over the title counts too.
    window.addEventListener('pointerdown', this.touch, true);
    window.addEventListener('wheel', this.touch, { capture: true, passive: true });
    window.addEventListener('keydown', this.touch, true);
  }

  get visible(): boolean { return !this.el.classList.contains('hidden'); }

  /** Put the title up at once, with the buttons held back until `ready` (the city is still loading behind it). */
  show(): void {
    this.el.classList.remove('hidden');
    document.body.classList.add('title-up');
    this.buttons.hidden = true;
    this.loading.hidden = false;
  }

  /** The city behind is loaded: show the buttons. Continue is offered only when there is a city to go back to. */
  ready(hasSave: boolean): void {
    this.continueBtn.hidden = !hasSave;
    this.buttons.hidden = false;
    this.loading.hidden = true;
    (hasSave ? this.continueBtn : document.getElementById('title-new') as HTMLButtonElement).focus({ preventScroll: true });
  }

  hide(): void {
    this.el.classList.add('hidden');
    document.body.classList.remove('title-up');
  }
}
