import { GrenadeArc } from "../../application/grenade/GrenadeArc.js";

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

const PROJECTILE_WIDTH = 24;
const PROJECTILE_HEIGHT = (PROJECTILE_WIDTH * 36) / 64;

export class GrenadeLauncherController {
  constructor({ button, fxLayer, muzzleAnchor = null }) {
    this.button = button;
    this.fxLayer = fxLayer;
    this.muzzleAnchor = muzzleAnchor;
    this.projectiles = [];
    this.rafId = 0;
    this.previousFrameTime = 0;

    this.handleShoot = this.handleShoot.bind(this);
    this.loop = this.loop.bind(this);
  }

  mount() {
    if (!this.button || !this.fxLayer) return;

    this.button.addEventListener("click", this.handleShoot);
  }

  handleShoot() {
    const originRect = this.muzzleAnchor
      ? this.muzzleAnchor.getBoundingClientRect()
      : this.button.getBoundingClientRect();
    const launchX = originRect.left + originRect.width * 0.5;
    const launchY = originRect.top + originRect.height * 0.5;

    const projectileNode = document.createElement("img");
    projectileNode.className = "grenade-projectile";
    projectileNode.src = "assets/grenade.png";
    projectileNode.alt = "";
    this.fxLayer.appendChild(projectileNode);

    const projectile = new GrenadeArc({
      x: launchX,
      y: launchY,
      vx: randomRange(330, 415),
      vy: randomRange(-150, -108),
      gravity: randomRange(430, 520),
      lifeMs: randomRange(1300, 1800),
    });

    this.projectiles.push({ model: projectile, node: projectileNode });

    this.button.classList.remove("is-firing");
    void this.button.offsetWidth;
    this.button.classList.add("is-firing");

    if (!this.rafId) {
      this.previousFrameTime = 0;
      this.rafId = window.requestAnimationFrame(this.loop);
    }
  }

  loop(timestamp) {
    if (!this.previousFrameTime) {
      this.previousFrameTime = timestamp;
    }

    const deltaMs = Math.min(34, timestamp - this.previousFrameTime || 16.67);
    this.previousFrameTime = timestamp;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    this.projectiles = this.projectiles.filter((entry) => {
      const isAlive = entry.model.step(deltaMs);
      const { x, y } = entry.model.getPosition();

      const angle = Math.atan2(entry.model.vy, entry.model.vx) * (180 / Math.PI);
      entry.node.style.transform = `translate(${x - PROJECTILE_WIDTH / 2}px, ${
        y - PROJECTILE_HEIGHT / 2
      }px) rotate(${angle}deg)`;

      const inViewport = x > -30 && x < viewportWidth + 30 && y > -30 && y < viewportHeight + 30;
      const keep = isAlive && inViewport;

      if (!keep) {
        entry.node.remove();
      }

      return keep;
    });

    if (!this.projectiles.length) {
      this.rafId = 0;
      this.previousFrameTime = 0;
      return;
    }

    this.rafId = window.requestAnimationFrame(this.loop);
  }
}
