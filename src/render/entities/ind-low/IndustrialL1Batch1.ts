import type { VectorEntity } from '../../SpriteTypes';
import { drawIndustrialBuilding } from './IndUtils';

export const IndL1_01: VectorEntity = {
  id: 'IndL1_01',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#7a4040', '#4a2828', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'flat',
      accentColor: '#ff6600'
    } as any);
  }
};

export const IndL1_02: VectorEntity = {
  id: 'IndL1_02',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#555555', '#3a3a3a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffd700'
    } as any);
  }
};

export const IndL1_03: VectorEntity = {
  id: 'IndL1_03',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8b5a4a', '#5a3a2a', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_04: VectorEntity = {
  id: 'IndL1_04',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#9b6b6b', '#6a4545', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_05: VectorEntity = {
  id: 'IndL1_05',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5a5a5a', '#3f3f3f', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_06: VectorEntity = {
  id: 'IndL1_06',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6b3a3a', '#4a2525', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'sawtooth',
      accentColor: '#ff8800'
    } as any);
  }
};

export const IndL1_07: VectorEntity = {
  id: 'IndL1_07',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5a4838', '#3a2a1a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffcc00'
    } as any);
  }
};

export const IndL1_08: VectorEntity = {
  id: 'IndL1_08',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#a87878', '#7a5050', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_09: VectorEntity = {
  id: 'IndL1_09',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#545454', '#343434', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 5,
      roofStyle: 'peaked',
      hasParking: true
    } as any);
  }
};

export const IndL1_10: VectorEntity = {
  id: 'IndL1_10',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#996655', '#6a4535', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_11: VectorEntity = {
  id: 'IndL1_11',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5d3232', '#3d2020', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff9900'
    } as any);
  }
};

export const IndL1_12: VectorEntity = {
  id: 'IndL1_12',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#676767', '#474747', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'flat',
      accentColor: '#cc6600'
    } as any);
  }
};

export const IndL1_13: VectorEntity = {
  id: 'IndL1_13',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#b58585', '#8a5e5e', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_14: VectorEntity = {
  id: 'IndL1_14',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6b5848', '#4a3828', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};

export const IndL1_15: VectorEntity = {
  id: 'IndL1_15',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#754545', '#4d2e2e', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_16: VectorEntity = {
  id: 'IndL1_16',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#565656', '#363636', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffaa00'
    } as any);
  }
};

export const IndL1_17: VectorEntity = {
  id: 'IndL1_17',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8a5555', '#5d3838', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'peaked',
      accentColor: '#ff7700'
    } as any);
  }
};

export const IndL1_18: VectorEntity = {
  id: 'IndL1_18',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4e4e4e', '#2e2e2e', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_19: VectorEntity = {
  id: 'IndL1_19',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#9d7070', '#6f4a4a', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_20: VectorEntity = {
  id: 'IndL1_20',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#7f5a48', '#5a3d30', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_21: VectorEntity = {
  id: 'IndL1_21',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5e5e5e', '#3e3e3e', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffbb00'
    } as any);
  }
};

export const IndL1_22: VectorEntity = {
  id: 'IndL1_22',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#653838', '#452525', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'sawtooth',
      accentColor: '#ee6600'
    } as any);
  }
};

export const IndL1_23: VectorEntity = {
  id: 'IndL1_23',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#aa8080', '#7d5a5a', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_24: VectorEntity = {
  id: 'IndL1_24',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4c4c4c', '#2c2c2c', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'peaked'
    } as any);
  }
};

export const IndL1_25: VectorEntity = {
  id: 'IndL1_25',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8d5e4e', '#5e3f2f', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};
