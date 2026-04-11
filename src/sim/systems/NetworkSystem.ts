// Maintains road connected components via BFS flood fill.
// Every road tile gets a network ID. Zones can query whether their adjacent
// road is connected to a power plant.
// Currently rebuilds the whole network when any road changes (roadNetDirty).
// For 256×256 this is a few ms. Incremental updates are a future optimization.

import { World } from '../World';
import { ROAD_NONE } from '../constants';

export class NetworkSystem {
  update(world: World): void {
    if (!world.roadNetDirty) return;
    world.roadNetDirty = false;
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const roadNet = world.layers.roadNet;
    roadNet.fill(0);
    let nextId = 1;
    const queue = new Int32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const start = y * width + x;
        if (roadClass[start] === ROAD_NONE || roadNet[start] !== 0) continue;
        const id = nextId++;
        let head = 0, tail = 0;
        queue[tail++] = start;
        roadNet[start] = id;
        let limit = 0;
        while (head < tail && limit++ < 1000000) {
          const cur = queue[head++];
          const cx = cur % width;
          const cy = (cur - cx) / width;
          if (cx > 0) {
            const n = cur - 1;
            if (roadClass[n] !== ROAD_NONE && roadNet[n] === 0) { roadNet[n] = id; queue[tail++] = n; }
          }
          if (cx < width - 1) {
            const n = cur + 1;
            if (roadClass[n] !== ROAD_NONE && roadNet[n] === 0) { roadNet[n] = id; queue[tail++] = n; }
          }
          if (cy > 0) {
            const n = cur - width;
            if (roadClass[n] !== ROAD_NONE && roadNet[n] === 0) { roadNet[n] = id; queue[tail++] = n; }
          }
          if (cy < height - 1) {
            const n = cur + width;
            if (roadClass[n] !== ROAD_NONE && roadNet[n] === 0) { roadNet[n] = id; queue[tail++] = n; }
          }
        }
      }
    }
  }
}
