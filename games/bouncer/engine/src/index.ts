export type EngineSnapshot = {
  tick: number;
};

export function createEngine() {
  let tick = 0;
  return {
    step() {
      tick += 1;
    },
    getSnapshot(): EngineSnapshot {
      return { tick };
    },
  };
}
