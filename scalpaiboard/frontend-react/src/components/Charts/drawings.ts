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
      const x0 = fns.timeToX(p.time) ?? 0
      if (distToSegment(mouseX, mouseY, x0, y, 1e9, y) <= thresholdPx) return d
    }

    if (d.type === 'line') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) continue
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) continue

      // Infinite line distance via segment approximation on screen.
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      if (len2 === 0) continue
      const t = ((mouseX - ax) * dx + (mouseY - ay) * dy) / len2
      const cx = ax + t * dx
      const cy = ay + t * dy
      if (Math.hypot(mouseX - cx, mouseY - cy) <= thresholdPx) return d
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
  preview?: { type: Drawing['type']; points: DrawingPoint[]; label?: string } | null
) => {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const canvasW = ctx.canvas.width / dpr
  const canvasH = ctx.canvas.height / dpr

  ctx.clearRect(0, 0, canvasW, canvasH)

  const drawOne = (d: { type: Drawing['type']; points: DrawingPoint[]; label?: string }, alpha = 1) => {
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
      const x0 = fns.timeToX(p.time) ?? 0
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(canvasW, y)
      ctx.stroke()
      return
    }

    if (d.type === 'line') {
      const a = d.points[0]
      const b = d.points[1]
      if (!a || !b) return
      const ax = fns.timeToX(a.time)
      const ay = fns.priceToY(a.price)
      const bx = fns.timeToX(b.time)
      const by = fns.priceToY(b.price)
      if (ax == null || ay == null || bx == null || by == null) return

      ctx.setLineDash([])

      // Extend line to the screen bounds.
      const dx = bx - ax
      const dy = by - ay
      if (dx === 0 && dy === 0) return

      const xLeft = 0
      const xRight = canvasW

      const yLeft = dx === 0 ? ay : ay + ((xLeft - ax) * dy) / dx
      const yRight = dx === 0 ? by : ay + ((xRight - ax) * dy) / dx

      ctx.beginPath()
      ctx.moveTo(xLeft, yLeft)
      ctx.lineTo(xRight, yRight)
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

      if (d.label) {
        const lines = String(d.label).split('\n')
        ctx.setLineDash([])
        ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI'
        const padX = 8
        const padY = 6
        const lineH = 16
        const textW = Math.max(...lines.map((l) => ctx.measureText(l).width))
        const boxW = textW + padX * 2
        const boxH = lines.length * lineH + padY * 2

        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

        const bx0 = clamp(right + 10, 6, canvasW - boxW - 6)
        const by0 = clamp(top + 6, 6, canvasH - boxH - 6)

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
        ctx.lineWidth = 1
        const rr = (x: number, y: number, w2: number, h2: number, r: number) => {
          const r2 = Math.min(r, w2 / 2, h2 / 2)
          ctx.beginPath()
          ctx.moveTo(x + r2, y)
          ctx.lineTo(x + w2 - r2, y)
          ctx.arcTo(x + w2, y, x + w2, y + r2, r2)
          ctx.lineTo(x + w2, y + h2 - r2)
          ctx.arcTo(x + w2, y + h2, x + w2 - r2, y + h2, r2)
          ctx.lineTo(x + r2, y + h2)
          ctx.arcTo(x, y + h2, x, y + h2 - r2, r2)
          ctx.lineTo(x, y + r2)
          ctx.arcTo(x, y, x + r2, y, r2)
          ctx.closePath()
        }

        rr(bx0, by0, boxW, boxH, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = 'rgba(226, 232, 240, 0.95)'
        for (let i = 0; i < lines.length; i += 1) {
          ctx.fillText(lines[i]!, bx0 + padX, by0 + padY + (i + 1) * lineH - 4)
        }
      }

      return
    }
  }

  for (const d of drawings) drawOne(d, 1)
  if (preview) drawOne(preview, 0.7)
}
