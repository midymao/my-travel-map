export interface DeckSlide { src: string; aspectRatio: number; href: string; title: string }

export class PhotoDeckState {
  coverIndex: number;
  selectedIndex: number;
  isOpen = false;
  readonly slides: DeckSlide[];
  readonly slots: number[];

  constructor(slides: DeckSlide[], random = Math.random) {
    if (!slides.length) throw new Error('A photo deck needs at least one photograph.');
    this.slides = slides;
    const landscape = slides.flatMap((slide, index) => slide.aspectRatio >= 1.2 ? [index] : []);
    const candidates = landscape.length ? landscape : [0];
    this.coverIndex = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
    this.selectedIndex = this.coverIndex;
    let slot = 0;
    this.slots = slides.map((_, index) => index === this.coverIndex ? -1 : slot++);
  }

  get visibleIndex() { return this.isOpen ? this.selectedIndex : this.coverIndex; }
  open() { this.isOpen = true; }
  close() { this.coverIndex = this.selectedIndex; this.isOpen = false; }
  select(index: number) {
    if (!this.isOpen || !Number.isInteger(index) || index < 0 || index >= this.slides.length || index === this.selectedIndex) return;
    // Exchange positions rather than reshuffling every card under the pointer.
    this.slots[this.selectedIndex] = this.slots[index];
    this.slots[index] = -1;
    this.selectedIndex = index;
  }
  activateMain() {
    if (!this.isOpen) { this.open(); return null; }
    return this.slides[this.selectedIndex].href;
  }
}
