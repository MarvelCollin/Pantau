import type { ComponentType } from 'react'
import type { LayerId } from './registry'
import { quakesModule } from './quakes'
import { flightsModule } from './flights'
import { volcanoesModule } from './volcanoes'
import { firesModule } from './fires'
import { reportsModule } from './reports'
import { camerasModule } from './cameras'
import { satellitesModule } from './satellites'
import { weatherModule } from './weather'
import { shipsModule } from './ships'

export interface LayerModule {
  Layer: ComponentType
  Detail: ComponentType<{ id: string }>
}

export const layerModules: Partial<Record<LayerId, LayerModule>> = {
  flights: flightsModule,
  ships: shipsModule,
  satellites: satellitesModule,
  quakes: quakesModule,
  volcanoes: volcanoesModule,
  fires: firesModule,
  reports: reportsModule,
  weather: weatherModule,
  cameras: camerasModule,
}
