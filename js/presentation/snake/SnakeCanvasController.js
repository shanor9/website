export class SnakeCanvasController {
  constructor(canvas, simulation) {
    this.canvas = canvas;
    this.simulation = simulation;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.rafId = 0;

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
    this.rafId = window.requestAnimationFrame(this.loop);
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
    this.rafId = window.requestAnimationFrame(this.loop);
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
