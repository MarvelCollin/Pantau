import type { ComponentType } from 'react'
import type { LayerId } from './registry'
import { quakesModule } from './quakes'
import { flightsModule } from './flights'
import { volcanoesModule } from './volcanoes'
import { firesModule } from './fires'
import { reportsModule } from './reports'
import { karhutlaModule } from './karhutla'
import { smokeModule } from './smoke'
import { fireCrewsModule } from './firecrews'
import { airModule } from './air'
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
  karhutla: karhutlaModule,
  smoke: smokeModule,
  firecrews: fireCrewsModule,
  reports: reportsModule,
  weather: weatherModule,
  air: airModule,
  cameras: camerasModule,
}
