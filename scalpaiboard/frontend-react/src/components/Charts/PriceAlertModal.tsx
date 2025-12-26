import { useMemo, useState } from 'react'

import type { MarketItem } from '../../types'
import { createAlert } from '../../services/api'

type Props = {
  isOpen: boolean
  market: MarketItem | null
  defaultPrice?: number
  onClose: () => void
}

const conditions = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
  { value: 'cross', label: 'Cross' },
] as const

export default function PriceAlertModal({ isOpen, market, defaultPrice, onClose }: Props) {
  const [condition, setCondition] = useState<(typeof conditions)[number]['value']>('cross')
  const [price, setPrice] = useState(() => (typeof defaultPrice === 'number' ? String(defaultPrice) : ''))
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = useMemo(() => {
    if (!market) return 'Price alert'
    return `Price alert • ${market.symbol} • ${market.contractTag}`
  }, [market])

  if (!isOpen) return null

  const submit = async () => {
    if (!market?.coinId) {
      setError('This market has no coinId (backend mapping missing).')
      return
    }

    const v = Number(price)
    if (!Number.isFinite(v) || v <= 0) {
      setError('Enter a valid price')
      return
    }

    setCreating(true)
    setError(null)
    try {
      await createAlert({
        coinId: market.coinId,
        conditionType: condition,
        conditionValue: v,
        notificationType: 'telegram',
      })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create alert')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        onClose()
      }}
    >
      <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-md border border-dark-700 shadow-2xl">
        <div className="text-lg font-semibold text-white">{title}</div>
        <div className="text-xs text-dark-400 mt-1">
          Alerts are stored in backend; Telegram delivery requires bot integration.
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as any)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              {conditions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              placeholder="0"
            />
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="flex-1 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-200 hover:bg-dark-700"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 disabled:opacity-50"
            onClick={() => void submit()}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
