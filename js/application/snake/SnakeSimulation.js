function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function lerpAngle(current, target, factor) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * factor;
}

export class SnakeSimulation {
  constructor({ segments = 100, spacing = 7, speed = 1.35, edge = 26 } = {}) {
    this.segmentCount = segments;
    this.spacing = spacing;
    this.speed = speed;
    this.edge = edge;

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
