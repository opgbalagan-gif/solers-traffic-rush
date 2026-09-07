/** Swipes steer. A stationary hold enables nitro until release. */
export class RaceGestures {
  private pointer: number | null = null;
  private startX = 0;
  private startY = 0;
  private anchorX = 0;
  private startedAt = 0;
  private travelled = 0;
  private swiped = false;

  begin(id: number, x: number, y: number, time: number) {
    if (this.pointer !== null) return;
    this.pointer = id;
    this.startX = this.anchorX = x;
    this.startY = y;
    this.startedAt = time;
    this.travelled = 0;
    this.swiped = false;
  }

  move(id: number, x: number, y: number): -1 | 1 | null {
    if (id !== this.pointer) return null;
    this.travelled = Math.max(this.travelled, Math.hypot(x - this.startX, y - this.startY));
    const dx = x - this.anchorX;
    if (Math.abs(dx) < 28 || (!this.swiped && Math.abs(x - this.startX) < Math.abs(y - this.startY))) return null;
    this.anchorX = x;
    this.swiped = true;
    return dx > 0 ? 1 : -1;
  }

  holding(time: number) { return this.pointer !== null && !this.swiped && this.travelled < 15 && time - this.startedAt >= 180; }

  end(id: number) {
    if (id !== this.pointer) return false;
    this.cancel();
    return true;
  }

  cancel() { this.pointer = null; }
}
