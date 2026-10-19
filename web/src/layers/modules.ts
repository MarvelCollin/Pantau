import type { ComponentType } from 'react'
import type { LayerId } from './registry'
import { quakesModule } from './quakes'

export interface LayerModule {
  Layer: ComponentType
  Detail: ComponentType<{ id: string }>
}

export const layerModules: Partial<Record<LayerId, LayerModule>> = {
  quakes: quakesModule,
}
