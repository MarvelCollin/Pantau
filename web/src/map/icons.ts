import type { Map as MapLibre } from 'maplibre-gl'

const SIZE = 64

type Draw = (ctx: CanvasRenderingContext2D) => void

const shapes: Record<string, Draw> = {
  plane: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(32, 4)
    ctx.lineTo(36, 22)
    ctx.lineTo(58, 36)
    ctx.lineTo(58, 41)
    ctx.lineTo(36, 34)
    ctx.lineTo(35, 50)
    ctx.lineTo(43, 56)
    ctx.lineTo(43, 60)
    ctx.lineTo(32, 57)
    ctx.lineTo(21, 60)
    ctx.lineTo(21, 56)
    ctx.lineTo(29, 50)
    ctx.lineTo(28, 34)
    ctx.lineTo(6, 41)
    ctx.lineTo(6, 36)
    ctx.lineTo(28, 22)
    ctx.closePath()
    ctx.fill()
  },
  ship: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(32, 6)
    ctx.lineTo(48, 52)
    ctx.lineTo(32, 44)
    ctx.lineTo(16, 52)
    ctx.closePath()
    ctx.fill()
  },
  triangle: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(32, 8)
    ctx.lineTo(58, 54)
    ctx.lineTo(6, 54)
    ctx.closePath()
    ctx.fill()
  },
  square: (ctx) => {
    ctx.fillRect(12, 16, 40, 32)
    ctx.clearRect(18, 22, 28, 20)
    ctx.fillRect(24, 27, 16, 10)
  },
  diamond: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(32, 8)
    ctx.lineTo(56, 32)
    ctx.lineTo(32, 56)
    ctx.lineTo(8, 32)
    ctx.closePath()
    ctx.fill()
  },
  drop: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(32, 6)
    ctx.bezierCurveTo(32, 6, 52, 30, 52, 40)
    ctx.arc(32, 40, 20, 0, Math.PI)
    ctx.bezierCurveTo(12, 30, 32, 6, 32, 6)
    ctx.fill()
  },
}

export function registerIcons(map: MapLibre) {
  for (const [name, draw] of Object.entries(shapes)) {
    if (map.hasImage(name)) continue
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    draw(ctx)
    map.addImage(name, ctx.getImageData(0, 0, SIZE, SIZE), { sdf: true, pixelRatio: 2 })
  }
}
