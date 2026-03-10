import { SnakeSimulation } from "./application/snake/SnakeSimulation.js";
import { prefersReducedMotion } from "./infrastructure/browser/motion.js";
import { GrenadeLauncherController } from "./presentation/hero/GrenadeLauncherController.js";
import { SnakeCanvasController } from "./presentation/snake/SnakeCanvasController.js";

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
  const muzzleAnchor = button?.querySelector(".tee-muzzle-anchor") ?? null;
  if (!button || !fxLayer) return;

  const controller = new GrenadeLauncherController({ button, fxLayer, muzzleAnchor });
  controller.mount();
}

bootstrapSnake();
bootstrapGrenadeLauncher();
