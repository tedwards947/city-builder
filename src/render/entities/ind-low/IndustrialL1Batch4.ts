import type { VectorEntity } from '../../SpriteTypes';
import { drawIndustrialBuilding } from './IndUtils';

export const IndL1_76: VectorEntity = {
  id: 'IndL1_76',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6a4343', '#482d2d', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffaa55'
    } as any);
  }
};

export const IndL1_77: VectorEntity = {
  id: 'IndL1_77',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5d5d5d', '#3d3d3d', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'peaked',
      accentColor: '#ee5522'
    } as any);
  }
};

export const IndL1_78: VectorEntity = {
  id: 'IndL1_78',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#946c6c', '#684c4c', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_79: VectorEntity = {
  id: 'IndL1_79',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8b6558', '#5f4540', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_80: VectorEntity = {
  id: 'IndL1_80',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5b5b5b', '#3b3b3b', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_81: VectorEntity = {
  id: 'IndL1_81',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5c3737', '#3c2424', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff8866'
    } as any);
  }
};

export const IndL1_82: VectorEntity = {
  id: 'IndL1_82',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#606060', '#404040', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'sawtooth',
      accentColor: '#dd6622'
    } as any);
  }
};

export const IndL1_83: VectorEntity = {
  id: 'IndL1_83',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#a87c7c', '#7b5858', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_84: VectorEntity = {
  id: 'IndL1_84',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#765a48', '#503d30', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_85: VectorEntity = {
  id: 'IndL1_85',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4f4f4f', '#2f2f2f', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'peaked'
    } as any);
  }
};

export const IndL1_86: VectorEntity = {
  id: 'IndL1_86',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#733f3f', '#4d2a2a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffbb66'
    } as any);
  }
};

export const IndL1_87: VectorEntity = {
  id: 'IndL1_87',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#525252', '#323232', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'flat',
      accentColor: '#cc5533'
    } as any);
  }
};

export const IndL1_88: VectorEntity = {
  id: 'IndL1_88',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#9f7575', '#725353', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_89: VectorEntity = {
  id: 'IndL1_89',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#886050', '#5d4238', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_90: VectorEntity = {
  id: 'IndL1_90',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#636363', '#434343', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};

export const IndL1_91: VectorEntity = {
  id: 'IndL1_91',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#603838', '#402525', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff9977'
    } as any);
  }
};

export const IndL1_92: VectorEntity = {
  id: 'IndL1_92',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5f5f5f', '#3f3f3f', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'peaked',
      accentColor: '#ee6633'
    } as any);
  }
};

export const IndL1_93: VectorEntity = {
  id: 'IndL1_93',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#b37e7e', '#865a5a', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_94: VectorEntity = {
  id: 'IndL1_94',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#916858', '#634840', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_95: VectorEntity = {
  id: 'IndL1_95',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#565656', '#363636', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_96: VectorEntity = {
  id: 'IndL1_96',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6c4040', '#482a2a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffcc77'
    } as any);
  }
};

export const IndL1_97: VectorEntity = {
  id: 'IndL1_97',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5c5c5c', '#3c3c3c', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'sawtooth',
      accentColor: '#dd5544'
    } as any);
  }
};

export const IndL1_98: VectorEntity = {
  id: 'IndL1_98',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#9b7070', '#6f4e4e', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_99: VectorEntity = {
  id: 'IndL1_99',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#7d5c4a', '#553f33', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_100: VectorEntity = {
  id: 'IndL1_100',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#575757', '#373737', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'peaked',
      accentColor: '#ff7744'
    } as any);
  }
};
