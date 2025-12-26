import type { Drawing, DrawingPoint } from '../../store/drawingsStore'

export type CoordFns = {
  timeToX: (time: number) => number | null
  priceToY: (price: number) => number | null
}

const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay

  const abLen2 = abx * abx + aby * aby
  if (abLen2 === 0) return Math.hypot(px - ax, py - ay)

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}

export const hitTestDrawing = (drawings: Drawing[], mouseX: number, mouseY: number, fns: CoordFns, thresholdPx = 6) => {
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const d = drawings[i]

    if (d.type === 'ray') {
      const p = d.points[0]
      if (!p) continue
      const y = fns.priceToY(p.price)
      if (y == null) continue
      if (Math.abs(mouseY - y) <= thresholdPx) return d
    }

    if (d.type === 'trendline') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) continue
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) continue
      if (distToSegment(mouseX, mouseY, ax, ay, bx, by) <= thresholdPx) return d
    }

    if (d.type === 'rect') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) continue
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) continue
      const left = Math.min(ax, bx)
      const right = Math.max(ax, bx)
      const top = Math.min(ay, by)
      const bottom = Math.max(ay, by)
      const onEdge =
        (mouseX >= left - thresholdPx && mouseX <= right + thresholdPx && (Math.abs(mouseY - top) <= thresholdPx || Math.abs(mouseY - bottom) <= thresholdPx)) ||
        (mouseY >= top - thresholdPx && mouseY <= bottom + thresholdPx && (Math.abs(mouseX - left) <= thresholdPx || Math.abs(mouseX - right) <= thresholdPx))
      if (onEdge) return d
    }
  }

  return null
}

export const drawAll = (
  ctx: CanvasRenderingContext2D,
  drawings: Drawing[],
  fns: CoordFns,
  preview?: { type: Drawing['type']; points: DrawingPoint[] } | null
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const drawOne = (d: { type: Drawing['type']; points: DrawingPoint[] }, alpha = 1) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'

    if (d.type === 'ray') {
      const p = d.points[0]
      if (!p) return
      const y = fns.priceToY(p.price)
      if (y == null) return
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(ctx.canvas.width, y)
      ctx.stroke()
      return
    }

    if (d.type === 'trendline') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) return
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) return
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      return
    }

    if (d.type === 'rect') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) return
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) return

      const left = Math.min(ax, bx)
      const right = Math.max(ax, bx)
      const top = Math.min(ay, by)
      const bottom = Math.max(ay, by)

      ctx.setLineDash([])
      ctx.fillRect(left, top, right - left, bottom - top)
      ctx.strokeRect(left, top, right - left, bottom - top)
      return
    }
  }

  for (const d of drawings) drawOne(d, 1)
  if (preview) drawOne(preview, 0.7)
}
