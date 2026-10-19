import { layerModules } from './modules'

export function DataLayers() {
  return (
    <>
      {Object.entries(layerModules).map(([id, mod]) => (
        <mod.Layer key={id} />
      ))}
    </>
  )
}
