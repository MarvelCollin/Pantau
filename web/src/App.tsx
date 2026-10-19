import { lazy, Suspense } from 'react'
import { TopBar } from './ui/TopBar'
import { Rail } from './ui/Rail'
import { LayerPanel } from './ui/LayerPanel'
import { DetailPanel } from './ui/DetailPanel'
import { Sources } from './ui/Sources'
import { Latest } from './ui/Latest'
import { DataLayers } from './layers/DataLayers'
import { PointWeather } from './layers/weather'
import { Search } from './ui/Search'
import { Telemetry } from './ui/Telemetry'
import { FilterBar } from './ui/FilterBar'
import styles from './App.module.css'

const MapView = lazy(() => import('./map/MapView').then((m) => ({ default: m.MapView })))

function MapFallback() {
  return <div className={styles.mapFallback} aria-hidden="true" />
}

export default function App() {
  return (
    <div className={styles.app}>
      <a className="skip-link" href="#rail-body">Skip to layers</a>
      <h1 className="sr-only">Pantau, live map of Indonesia</h1>
      <TopBar>
        <Search />
      </TopBar>
      <main className={styles.stage}>
        <Suspense fallback={<MapFallback />}>
          <MapView>
            <DataLayers />
            <FilterBar />
          </MapView>
        </Suspense>
      </main>
      <Rail>
        <LayerPanel />
        <Latest />
        <Sources />
      </Rail>
      <DetailPanel PointDetail={PointWeather} />
      <Telemetry />
    </div>
  )
}
