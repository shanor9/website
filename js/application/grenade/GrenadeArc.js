export class GrenadeArc {
  constructor({ x, y, vx, vy, gravity = 540, lifeMs = 1800 }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.lifeMs = lifeMs;
    this.ageMs = 0;
  }

  step(deltaMs) {
    const deltaSeconds = deltaMs / 1000;

    this.x += this.vx * deltaSeconds;
    this.y += this.vy * deltaSeconds;
    this.vy += this.gravity * deltaSeconds;
    this.vx *= 0.999;
    this.ageMs += deltaMs;

    return this.ageMs < this.lifeMs;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }
}
