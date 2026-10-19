import { MapView } from './map/MapView'
import { TopBar } from './ui/TopBar'
import { Rail } from './ui/Rail'
import { LayerPanel } from './ui/LayerPanel'
import { DetailPanel } from './ui/DetailPanel'
import { Sources } from './ui/Sources'
import { DataLayers } from './layers/DataLayers'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <h1 className="sr-only">Pantau, live map of Indonesia</h1>
      <TopBar />
      <main className={styles.stage}>
        <MapView>
          <DataLayers />
        </MapView>
      </main>
      <Rail>
        <LayerPanel />
        <Sources />
      </Rail>
      <DetailPanel />
    </div>
  )
}
