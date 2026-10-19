import type { ComponentType } from 'react'
import type { LayerId } from './registry'

export interface LayerModule {
  Layer: ComponentType
  Detail: ComponentType<{ id: string }>
}

export const layerModules: Partial<Record<LayerId, LayerModule>> = {}
