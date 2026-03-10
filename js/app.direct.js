(function () {
  if (window.__shanorAppBooted) return;
  window.__shanorAppBooted = true;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerpAngle(current, target, factor) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * factor;
  }

  class SnakeSimulation {
    constructor(options) {
      const settings = options || {};
      this.segmentCount = settings.segments || 100;
      this.spacing = settings.spacing || 7;
      this.speed = settings.speed || 1.35;
      this.edge = settings.edge || 26;

      this.width = 0;
      this.height = 0;
      this.initialized = false;

      this.head = {
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
      };

      this.segments = Array.from({ length: this.segmentCount }, () => ({ x: 0, y: 0 }));

      this.turnDrift = 0;
      this.desiredDrift = 0;
      this.nextWanderAt = 0;
      this.accumulatedTurn = 0;
      this.previousAngle = this.head.angle;
      this.antiLoopUntil = 0;
      this.antiLoopBias = 0;

      this.pointer = {
        x: 0,
        y: 0,
        active: false,
      };

      this.fleeRadius = 180;
      this.fleeSpeedBoost = 0.45;
    }

    setPointer(x, y, isActive) {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.active = isActive;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;

      if (!this.initialized) {
        this.head.x = width * (0.2 + Math.random() * 0.6);
        this.head.y = height * (0.2 + Math.random() * 0.6);

        for (let index = 0; index < this.segments.length; index += 1) {
          this.segments[index].x = this.head.x - index * this.spacing;
          this.segments[index].y = this.head.y;
        }

        this.initialized = true;
      }
    }

    step(now) {
      if (!this.initialized) return;

      if (now > this.nextWanderAt) {
        this.desiredDrift = randomRange(-0.04, 0.04);
        this.nextWanderAt = now + randomRange(1800, 4200);
      }

      this.turnDrift += (this.desiredDrift - this.turnDrift) * 0.08;

      let steer = this.turnDrift + randomRange(-0.004, 0.004);
      if (now < this.antiLoopUntil) {
        steer += this.antiLoopBias;
      }

      this.head.angle += steer;

      const pointerIsActive = this.pointer.active;
      let fleeProximity = 0;
      if (pointerIsActive) {
        const fromPointerX = this.head.x - this.pointer.x;
        const fromPointerY = this.head.y - this.pointer.y;
        const distance = Math.hypot(fromPointerX, fromPointerY);
        if (distance < this.fleeRadius) {
          fleeProximity = 1 - distance / this.fleeRadius;
          const awayAngle =
            distance > 0.0001 ? Math.atan2(fromPointerY, fromPointerX) : this.head.angle + Math.PI;
          const turnFactor = 0.05 + fleeProximity * 0.22;
          this.head.angle = lerpAngle(this.head.angle, awayAngle, turnFactor);
        }
      }

      const angleStep = Math.atan2(
        Math.sin(this.head.angle - this.previousAngle),
        Math.cos(this.head.angle - this.previousAngle)
      );
      this.accumulatedTurn = this.accumulatedTurn * 0.985 + angleStep;
      this.previousAngle = this.head.angle;

      if (Math.abs(this.accumulatedTurn) > 1.35) {
        this.antiLoopUntil = now + randomRange(900, 1700);
        this.antiLoopBias = this.accumulatedTurn > 0 ? -0.05 : 0.05;
        this.desiredDrift *= 0.25;
        this.accumulatedTurn *= 0.2;
      }

      const centerAngle = Math.atan2(this.height * 0.5 - this.head.y, this.width * 0.5 - this.head.x);
      if (
        this.head.x < this.edge ||
        this.head.x > this.width - this.edge ||
        this.head.y < this.edge ||
        this.head.y > this.height - this.edge
      ) {
        this.head.angle = lerpAngle(this.head.angle, centerAngle, 0.09);
      }

      const speedMultiplier = 1 + fleeProximity * this.fleeSpeedBoost;
      const moveSpeed = this.speed * speedMultiplier;

      this.head.x += Math.cos(this.head.angle) * moveSpeed;
      this.head.y += Math.sin(this.head.angle) * moveSpeed;

      this.head.x = Math.max(0, Math.min(this.width, this.head.x));
      this.head.y = Math.max(0, Math.min(this.height, this.head.y));

      this.segments[0].x = this.head.x;
      this.segments[0].y = this.head.y;

      for (let index = 1; index < this.segments.length; index += 1) {
        const previous = this.segments[index - 1];
        const segment = this.segments[index];
        const dx = previous.x - segment.x;
        const dy = previous.y - segment.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const move = Math.max(0, distance - this.spacing);

        segment.x += (dx / distance) * move;
        segment.y += (dy / distance) * move;
      }
    }

    getSegments() {
      return this.segments;
    }

    getHead() {
      return this.head;
    }
  }

  class SnakeCanvasController {
    constructor(canvas, simulation) {
      this.canvas = canvas;
      this.simulation = simulation;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;

      this.handleResize = this.handleResize.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.loop = this.loop.bind(this);
    }

    mount() {
      this.ctx = this.canvas.getContext("2d", { alpha: true });
      if (!this.ctx) return;

      this.handleResize();
      window.addEventListener("resize", this.handleResize);
      window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
      document.addEventListener("pointerleave", this.handlePointerLeave);
      window.addEventListener("blur", this.handlePointerLeave);
      window.requestAnimationFrame(this.loop);
    }

    handlePointerMove(event) {
      this.simulation.setPointer(event.clientX, event.clientY, true);
    }

    handlePointerLeave() {
      this.simulation.setPointer(0, 0, false);
    }

    handleResize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;

      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.simulation.resize(this.width, this.height);
    }

    loop(now) {
      this.simulation.step(now);
      this.draw();
      window.requestAnimationFrame(this.loop);
    }

    draw() {
      const segments = this.simulation.getSegments();
      const head = this.simulation.getHead();

      this.ctx.clearRect(0, 0, this.width, this.height);
      if (segments.length < 2) return;

      const points = segments.slice().reverse();
      const traceBodyPath = () => {
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length - 1; index += 1) {
          const current = points[index];
          const next = points[index + 1];
          const midX = (current.x + next.x) * 0.5;
          const midY = (current.y + next.y) * 0.5;
          this.ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
        this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      };

      // Single continuous body: dark contour + light core.
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      traceBodyPath();
      this.ctx.lineWidth = 10.5;
      this.ctx.strokeStyle = "rgba(12, 12, 12, 0.95)";
      this.ctx.stroke();

      traceBodyPath();
      this.ctx.lineWidth = 7.4;
      this.ctx.strokeStyle = "rgba(242, 242, 242, 0.96)";
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(head.x, head.y, 4.6, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(244, 244, 244, 0.98)";
      this.ctx.fill();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "rgba(14, 14, 14, 0.92)";
      this.ctx.stroke();

      const eyeOffset = 2.1;
      const eyeSize = 1;
      const nx = Math.cos(head.angle + Math.PI / 2) * eyeOffset;
      const ny = Math.sin(head.angle + Math.PI / 2) * eyeOffset;

      this.ctx.fillStyle = "#101010";
      this.ctx.beginPath();
      this.ctx.arc(head.x + nx, head.y + ny, eyeSize, 0, Math.PI * 2);
      this.ctx.arc(head.x - nx, head.y - ny, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  class GrenadeArc {
    constructor(config) {
      this.x = config.x;
      this.y = config.y;
      this.vx = config.vx;
      this.vy = config.vy;
      this.gravity = config.gravity || 540;
      this.lifeMs = config.lifeMs || 1800;
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
  }

  const PROJECTILE_WIDTH = 24;
  const PROJECTILE_HEIGHT = (PROJECTILE_WIDTH * 36) / 64;

  class GrenadeLauncherController {
    constructor(config) {
      this.button = config.button;
      this.fxLayer = config.fxLayer;
      this.muzzleAnchor = config.muzzleAnchor || null;
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
        const angle = Math.atan2(entry.model.vy, entry.model.vx) * (180 / Math.PI);
        entry.node.style.transform =
          "translate(" +
          (entry.model.x - PROJECTILE_WIDTH / 2) +
          "px, " +
          (entry.model.y - PROJECTILE_HEIGHT / 2) +
          "px) rotate(" +
          angle +
          "deg)";

        const inViewport =
          entry.model.x > -30 &&
          entry.model.x < viewportWidth + 30 &&
          entry.model.y > -30 &&
          entry.model.y < viewportHeight + 30;
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

  function bootstrapSnake() {
    const canvas = document.getElementById("snake-layer");
    if (!canvas || prefersReducedMotion()) return;

    const simulation = new SnakeSimulation({
      segments: 100,
      spacing: 7,
      speed: 1.35,
      edge: 26,
    });

    const controller = new SnakeCanvasController(canvas, simulation);
    controller.mount();
  }

  function bootstrapGrenadeLauncher() {
    const button = document.querySelector(".tee-weapon-button");
    const fxLayer = document.getElementById("fx-layer");
    const muzzleAnchor = button ? button.querySelector(".tee-muzzle-anchor") : null;
    if (!button || !fxLayer) return;

    const controller = new GrenadeLauncherController({
      button: button,
      fxLayer: fxLayer,
      muzzleAnchor: muzzleAnchor,
    });
    controller.mount();
  }

  bootstrapSnake();
  bootstrapGrenadeLauncher();
})();
