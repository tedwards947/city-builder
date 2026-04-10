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
