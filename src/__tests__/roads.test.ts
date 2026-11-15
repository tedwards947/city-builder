import { describe, it, expect } from 'vitest';
import { roadTrafficCars, drawnRoadClass, trafficSpeed, CAR_COLOURS, type TrafficCar } from '../render/clay/roads';
import { ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY } from '../sim/constants';

const EW = [ROAD_NONE, ROAD_STREET, ROAD_NONE, ROAD_STREET]; // N, E, S, W
const cars = (load: number, time = 0, cls = ROAD_STREET, around = EW, goods = 0, tx = 5, ty = 7): TrafficCar[] => {
  const out: TrafficCar[] = [];
  const count = roadTrafficCars(tx, ty, cls, around, load, goods, time, out);
  return out.slice(0, count);
};
const average = (load: number, cls = ROAD_STREET, around = EW): number => {
  let n = 0;
  for (let tx = 0; tx < 200; tx++) n += cars(load, 3.7, cls, around, 0, tx, 7).length;
  return n / 200;
};

describe('road traffic cars', () => {
  it('shows nothing on an empty road or off a road', () => {
    expect(cars(0)).toEqual([]);
    expect(cars(0.02)).toEqual([]);
    expect(cars(1, 0, ROAD_NONE)).toEqual([]);
    expect(cars(1, 0, ROAD_STREET, [ROAD_NONE, ROAD_NONE, ROAD_NONE, ROAD_NONE])).toEqual([]);
  });

  it('shows more cars the busier the road, and the most when over capacity', () => {
    const quiet = average(0.2), busy = average(0.9), jammed = average(2);
    expect(quiet).toBeGreaterThan(0);
    expect(busy).toBeGreaterThan(quiet * 2);
    expect(jammed).toBeGreaterThan(busy);
  });

  it('is deterministic for a given time', () => {
    expect(cars(1.2, 12.5)).toEqual(cars(1.2, 12.5));
  });

  it('keeps cars on the tile, in lane, on the right, heading along the road', () => {
    for (let t = 0; t < 20; t += 0.37) {
      for (const car of cars(2, t)) {
        expect(car.x).toBeGreaterThanOrEqual(0); expect(car.x).toBeLessThan(1);
        expect(car.dy).toBe(0);
        // Eastbound traffic runs south of the centre line, westbound north of it.
        expect(Math.sign(car.y - 0.5)).toBe(car.dx);
        expect(car.colour).toBeLessThan(CAR_COLOURS.length);
      }
    }
  });

  it('brakes only when the road is over capacity', () => {
    expect(cars(0.9, 2).every((c) => !c.braking)).toBe(true);
    expect(cars(1.5, 2).every((c) => c.braking)).toBe(true);
  });

  it('gives an avenue more cars than a street at the same load, and none on a missing arm', () => {
    const avenue = [ROAD_NONE, ROAD_AVENUE, ROAD_NONE, ROAD_AVENUE];
    expect(average(1, ROAD_AVENUE, avenue)).toBeGreaterThan(average(1) * 1.5);
    // A dead end reaching only west: nothing on the east half.
    const deadEnd = [ROAD_NONE, ROAD_NONE, ROAD_NONE, ROAD_STREET];
    for (let tx = 0; tx < 50; tx++) for (const car of cars(2, 1.3, ROAD_STREET, deadEnd, 0, tx)) expect(car.x).toBeLessThan(0.5);
  });

  it('turns goods traffic into vans and trucks', () => {
    let trucks = 0, plain = 0;
    for (let tx = 0; tx < 100; tx++) {
      trucks += cars(1.5, 2, ROAD_STREET, EW, 0.8, tx).filter((c) => c.kind !== 0).length;
      plain += cars(1.5, 2, ROAD_STREET, EW, 0, tx).filter((c) => c.kind !== 0).length;
    }
    expect(trucks).toBeGreaterThan(plain * 3);
  });
});

describe('drawnRoadClass', () => {
  it('draws a street laid across a wider road as that road, so it does not pinch', () => {
    expect(drawnRoadClass(ROAD_STREET, [ROAD_STREET, ROAD_AVENUE, ROAD_STREET, ROAD_AVENUE])).toBe(ROAD_AVENUE);
    expect(drawnRoadClass(ROAD_STREET, [ROAD_HIGHWAY, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_AVENUE])).toBe(ROAD_HIGHWAY);
  });

  it('leaves other tiles as they are', () => {
    expect(drawnRoadClass(ROAD_STREET, [ROAD_NONE, ROAD_STREET, ROAD_NONE, ROAD_STREET])).toBe(ROAD_STREET);
    // A wider road on one side only (a street ending at an avenue) does not widen the street.
    expect(drawnRoadClass(ROAD_STREET, [ROAD_AVENUE, ROAD_NONE, ROAD_STREET, ROAD_NONE])).toBe(ROAD_STREET);
    expect(drawnRoadClass(ROAD_AVENUE, [ROAD_STREET, ROAD_AVENUE, ROAD_STREET, ROAD_AVENUE])).toBe(ROAD_AVENUE);
  });
});

describe('trafficSpeed', () => {
  it('is slowest on streets and fastest on highways', () => {
    expect(trafficSpeed(ROAD_STREET, 0.5)).toBeGreaterThan(0);
    expect(trafficSpeed(ROAD_AVENUE, 0.5)).toBeGreaterThan(trafficSpeed(ROAD_STREET, 0.5));
    expect(trafficSpeed(ROAD_HIGHWAY, 0.5)).toBeGreaterThan(trafficSpeed(ROAD_AVENUE, 0.5));
  });

  it('crawls when the road is over capacity, and does not vary below that', () => {
    expect(trafficSpeed(ROAD_AVENUE, 1.5)).toBeLessThan(trafficSpeed(ROAD_AVENUE, 0.9) / 2);
    expect(trafficSpeed(ROAD_AVENUE, 0.2)).toBe(trafficSpeed(ROAD_AVENUE, 0.9));
    expect(trafficSpeed(ROAD_NONE, 1)).toBe(0);
  });

  it('moves cars: the same road shows different positions a moment later', () => {
    const at = (time: number): TrafficCar[] => { const out: TrafficCar[] = []; return out.slice(0, roadTrafficCars(5, 7, ROAD_HIGHWAY, [ROAD_NONE, ROAD_HIGHWAY, ROAD_NONE, ROAD_HIGHWAY], 0.9, 0, time, out)); };
    expect(at(1)).not.toEqual(at(1.1));
  });
});

describe('road traffic car pool', () => {
  it('reuses the objects in the pool and reports how many are in use', () => {
    const pool: TrafficCar[] = [];
    const busy = roadTrafficCars(5, 7, ROAD_STREET, EW, 2, 0, 1, pool);
    expect(busy).toBeGreaterThan(0);
    const first = pool[0], size = pool.length;
    const quiet = roadTrafficCars(5, 7, ROAD_STREET, EW, 0, 0, 1, pool);
    expect(quiet).toBe(0);
    expect(pool.length).toBe(size); // nothing dropped, nothing added
    expect(roadTrafficCars(5, 7, ROAD_STREET, EW, 2, 0, 1, pool)).toBe(busy);
    expect(pool[0]).toBe(first);
  });

  it('thins the cars by the density it is given', () => {
    let full = 0, half = 0;
    const pool: TrafficCar[] = [];
    for (let tx = 0; tx < 300; tx++) {
      full += roadTrafficCars(tx, 7, ROAD_STREET, EW, 1.5, 0, 2, pool, 1);
      half += roadTrafficCars(tx, 7, ROAD_STREET, EW, 1.5, 0, 2, pool, 0.5);
    }
    expect(half).toBeGreaterThan(full * 0.35);
    expect(half).toBeLessThan(full * 0.65);
  });
});
