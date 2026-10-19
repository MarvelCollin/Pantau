import type { ComponentType } from 'react'
import type { LayerId } from './registry'
import { quakesModule } from './quakes'
import { flightsModule } from './flights'
import { volcanoesModule } from './volcanoes'
import { firesModule } from './fires'
import { reportsModule } from './reports'

export interface LayerModule {
  Layer: ComponentType
  Detail: ComponentType<{ id: string }>
}

export const layerModules: Partial<Record<LayerId, LayerModule>> = {
  flights: flightsModule,
  quakes: quakesModule,
  volcanoes: volcanoesModule,
  fires: firesModule,
  reports: reportsModule,
}
