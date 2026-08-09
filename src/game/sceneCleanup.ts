import Phaser from "phaser";

// Phaser only emits SHUTDOWN when a scene is stopped/switched; a full
// game.destroy() (React unmount / HMR) emits DESTROY instead. Window-level
// listeners must be released on whichever fires first or they leak and keep
// referencing the dead scene graph.
export function onSceneTeardown(scene: Phaser.Scene, cleanup: () => void) {
  let done = false;
  const run = () => {
    if (done) {
      return;
    }
    done = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, run);
    scene.events.off(Phaser.Scenes.Events.DESTROY, run);
    cleanup();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, run);
  scene.events.once(Phaser.Scenes.Events.DESTROY, run);
}
