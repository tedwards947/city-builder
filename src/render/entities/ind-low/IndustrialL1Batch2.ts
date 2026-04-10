import type { VectorEntity } from '../../SpriteTypes';
import { drawIndustrialBuilding } from './IndUtils';

export const IndL1_26: VectorEntity = {
  id: 'IndL1_26',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#533333', '#332020', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff8811'
    } as any);
  }
};

export const IndL1_27: VectorEntity = {
  id: 'IndL1_27',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#686868', '#484848', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'flat',
      accentColor: '#ff5500'
    } as any);
  }
};

export const IndL1_28: VectorEntity = {
  id: 'IndL1_28',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#925f5f', '#653f3f', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_29: VectorEntity = {
  id: 'IndL1_29',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#795240', '#523525', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_30: VectorEntity = {
  id: 'IndL1_30',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#606060', '#404040', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};

export const IndL1_31: VectorEntity = {
  id: 'IndL1_31',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6f4242', '#4a2c2c', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffdd00'
    } as any);
  }
};

export const IndL1_32: VectorEntity = {
  id: 'IndL1_32',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#a57575', '#785252', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'peaked',
      accentColor: '#dd6600'
    } as any);
  }
};

export const IndL1_33: VectorEntity = {
  id: 'IndL1_33',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4f4f4f', '#2f2f2f', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_34: VectorEntity = {
  id: 'IndL1_34',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8c5545', '#5e3830', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_35: VectorEntity = {
  id: 'IndL1_35',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#525252', '#323232', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};

export const IndL1_36: VectorEntity = {
  id: 'IndL1_36',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#724040', '#4d2a2a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffaa22'
    } as any);
  }
};

export const IndL1_37: VectorEntity = {
  id: 'IndL1_37',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#585858', '#383838', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'sawtooth',
      accentColor: '#cc5500'
    } as any);
  }
};

export const IndL1_38: VectorEntity = {
  id: 'IndL1_38',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#987070', '#6a4d4d', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_39: VectorEntity = {
  id: 'IndL1_39',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#6d5545', '#473528', {
      buildingStyle: 'storage',
      tankCount: 4
    } as any);
  }
};

export const IndL1_40: VectorEntity = {
  id: 'IndL1_40',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5f5f5f', '#3f3f3f', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'peaked'
    } as any);
  }
};

export const IndL1_41: VectorEntity = {
  id: 'IndL1_41',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5a3535', '#3a2222', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ff9922'
    } as any);
  }
};

export const IndL1_42: VectorEntity = {
  id: 'IndL1_42',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#616161', '#414141', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 3,
      roofStyle: 'flat',
      accentColor: '#ff7711'
    } as any);
  }
};

export const IndL1_43: VectorEntity = {
  id: 'IndL1_43',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#b07f7f', '#835b5b', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 2,
      hasChimney: true
    } as any);
  }
};

export const IndL1_44: VectorEntity = {
  id: 'IndL1_44',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#855e50', '#5a4038', {
      buildingStyle: 'storage',
      tankCount: 2
    } as any);
  }
};

export const IndL1_45: VectorEntity = {
  id: 'IndL1_45',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#5c5c5c', '#3c3c3c', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      windowCount: 4,
      hasParking: true,
      roofStyle: 'sawtooth'
    } as any);
  }
};

export const IndL1_46: VectorEntity = {
  id: 'IndL1_46',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#674242', '#442a2a', {
      buildingStyle: 'warehouse',
      hasParking: true,
      accentColor: '#ffcc11'
    } as any);
  }
};

export const IndL1_47: VectorEntity = {
  id: 'IndL1_47',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#8e5858', '#613c3c', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 2,
      hasLoadingDock: true,
      windowCount: 2,
      roofStyle: 'peaked',
      accentColor: '#ee5500'
    } as any);
  }
};

export const IndL1_48: VectorEntity = {
  id: 'IndL1_48',
  type: 'ZONE_3_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#575757', '#373737', {
      buildingStyle: 'plant',
      hasTanks: true,
      tankCount: 3,
      hasChimney: true
    } as any);
  }
};

export const IndL1_49: VectorEntity = {
  id: 'IndL1_49',
  type: 'ZONE_3_1',
  tags: ['industrial', 'corporate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#9a6a5a', '#6c4a3d', {
      buildingStyle: 'storage',
      tankCount: 3
    } as any);
  }
};

export const IndL1_50: VectorEntity = {
  id: 'IndL1_50',
  type: 'ZONE_3_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawIndustrialBuilding(ctx, ts, t, p, vibe, '#4c4c4c', '#2c2c2c', {
      buildingStyle: 'factory',
      hasSmokestack: true,
      smokestackCount: 1,
      windowCount: 5,
      hasParking: true,
      roofStyle: 'flat'
    } as any);
  }
};
