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
        const maxLimit = 1000000;
        while (head < tail && limit < maxLimit) {
          limit++;
          const cur = queue[head++];
          const cx = cur % width;
          const cy = (cur - cx) / width;
          
          const checkAndEnqueue = (ni: number) => {
            if (roadClass[ni] !== ROAD_NONE && roadNet[ni] === 0) {
              if (tail < queue.length) {
                roadNet[ni] = id;
                queue[tail++] = ni;
              } else {
                console.error('NetworkSystem queue overflow at', ni);
              }
            }
          };

          if (cx > 0) checkAndEnqueue(cur - 1);
          if (cx < width - 1) checkAndEnqueue(cur + 1);
          if (cy > 0) checkAndEnqueue(cur - width);
          if (cy < height - 1) checkAndEnqueue(cur + width);
        }
        if (limit >= maxLimit) {
          console.warn(`NetworkSystem BFS limit reached for network ${id} starting at ${start}. Network may be incomplete.`);
        }
      }
    }
  }
}
