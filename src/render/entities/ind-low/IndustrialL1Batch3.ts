import type { VectorEntity } from '../../SpriteTypes';
import { drawIndustrialBuilding } from './IndUtils';

export const IndL1_51: VectorEntity = {
  id: 'IndL1_51',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#623838', '#422525', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffbb22'
    } as any);
  }
};

export const IndL1_52: VectorEntity = {
  id: 'IndL1_52',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#535353', '#333333', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'sawtooth',
      accentColor: '#cc6611'
    } as any);
  }
};

export const IndL1_53: VectorEntity = {
  id: 'IndL1_53',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#a06868', '#734848', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_54: VectorEntity = {
  id: 'IndL1_54',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8f6050', '#614030', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_55: VectorEntity = {
  id: 'IndL1_55',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4b4b4b', '#2b2b2b', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'peaked'
    } as any);
  }
};

export const IndL1_56: VectorEntity = {
  id: 'IndL1_56',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#704545', '#4a2e2e', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff8833'
    } as any);
  }
};

export const IndL1_57: VectorEntity = {
  id: 'IndL1_57',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#555555', '#353535', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'flat',
      accentColor: '#dd5511'
    } as any);
  }
};

export const IndL1_58: VectorEntity = {
  id: 'IndL1_58',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#ad7a7a', '#805656', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_59: VectorEntity = {
  id: 'IndL1_59',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#755848', '#4e3830', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_60: VectorEntity = {
  id: 'IndL1_60',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5a5a5a', '#3a3a3a', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};

export const IndL1_61: VectorEntity = {
  id: 'IndL1_61',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#583535', '#382222', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffdd33'
    } as any);
  }
};

export const IndL1_62: VectorEntity = {
  id: 'IndL1_62',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#965c5c', '#694040', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'peaked',
      accentColor: '#ee6611'
    } as any);
  }
};

export const IndL1_63: VectorEntity = {
  id: 'IndL1_63',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#585858', '#383838', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_64: VectorEntity = {
  id: 'IndL1_64',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#936555', '#654538', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_65: VectorEntity = {
  id: 'IndL1_65',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4d4d4d', '#2d2d2d', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_66: VectorEntity = {
  id: 'IndL1_66',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#774848', '#503030', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff9944'
    } as any);
  }
};

export const IndL1_67: VectorEntity = {
  id: 'IndL1_67',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#545454', '#343434', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'sawtooth',
      accentColor: '#cc5522'
    } as any);
  }
};

export const IndL1_68: VectorEntity = {
  id: 'IndL1_68',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#a17272', '#745050', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_69: VectorEntity = {
  id: 'IndL1_69',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#826050', '#594038', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_70: VectorEntity = {
  id: 'IndL1_70',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4e4e4e', '#2e2e2e', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'peaked'
    } as any);
  }
};

export const IndL1_71: VectorEntity = {
  id: 'IndL1_71',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#643c3c', '#432828', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffcc44'
    } as any);
  }
};

export const IndL1_72: VectorEntity = {
  id: 'IndL1_72',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#515151', '#313131', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'flat',
      accentColor: '#ff7722'
    } as any);
  }
};

export const IndL1_73: VectorEntity = {
  id: 'IndL1_73',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#b58080', '#885c5c', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_74: VectorEntity = {
  id: 'IndL1_74',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#7a5745', '#523a2e', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_75: VectorEntity = {
  id: 'IndL1_75',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#646464', '#444444', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};
