import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAlert, deleteAlert, getAlerts, updateAlert } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCoinStore } from '../../store/coinStore';
import type { Alert } from '../../types';


const CONDITION_TYPES = [
  { value: 'price_above', label: 'Price Above', icon: '📈' },
  { value: 'price_below', label: 'Price Below', icon: '📉' },
  { value: 'volume_above', label: 'Volume Above', icon: '📊' },
  { value: 'price_change_above', label: 'Price Change % Above', icon: '🚀' },
  { value: 'price_change_below', label: 'Price Change % Below', icon: '💔' },
];

const NOTIFICATION_TYPES = [
  { value: 'in_app', label: 'In-App' },
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
];

export const AlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated } = useAuthStore();
  const { coins } = useCoinStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);


  // Create form state
  const [selectedCoin, setSelectedCoin] = useState<number>(0);
  const [conditionType, setConditionType] = useState('price_above');
  const [conditionValue, setConditionValue] = useState('');
  const [notificationType, setNotificationType] = useState('in_app');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadAlerts();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const state = location.state as { openCreateModal?: boolean; coinId?: number } | null;
    if (!state?.openCreateModal || !state.coinId) return;

    setSelectedCoin(state.coinId);
    setShowCreateModal(true);

    navigate(location.pathname, { replace: true, state: null });
  }, [isAuthenticated, location.pathname, location.state, navigate]);


  const loadAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await createAlert({
        coinId: selectedCoin,
        conditionType,
        conditionValue: parseFloat(conditionValue),
        notificationType,
      });
      setShowCreateModal(false);
      resetForm();
      loadAlerts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (alert: Alert) => {
    try {
      await updateAlert(alert.id, { isActive: !alert.isActive });
      setAlerts(prev =>
        prev.map(a => (a.id === alert.id ? { ...a, isActive: !a.isActive } : a))
      );
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  };

  const resetForm = () => {
    setSelectedCoin(0);
    setConditionType('price_above');
    setConditionValue('');
    setNotificationType('in_app');
    setError('');
  };

  const formatCondition = (alert: Alert) => {
    const type = CONDITION_TYPES.find(t => t.value === alert.conditionType);
    const value = alert.conditionType.includes('change')
      ? `${alert.conditionValue}%`
      : `$${alert.conditionValue.toLocaleString()}`;
    return `${type?.icon || ''} ${type?.label || alert.conditionType}: ${value}`;
  };

  const getCoinDisplay = (alert: Alert) => {
    const coin = coins.find((c) => c.id === alert.coinId);
    const symbol = alert.coinSymbol || coin?.symbol || '??';
    const name = coin?.name || symbol;
    return { symbol, name };
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg">
          Please sign in to manage your alerts.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Price Alerts</h1>
          <p className="text-gray-400">Get notified when prices hit your targets</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Alert
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-xl font-semibold text-white mb-2">No alerts configured</h3>
          <p className="text-gray-400 mb-4">
            Create price alerts to get notified when your conditions are met.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const { symbol, name } = getCoinDisplay(alert);
            const avatarText = (symbol !== '??' ? symbol : name).slice(0, 2).toUpperCase() || '??';

            return (
              <div
                key={alert.id}
                className={`bg-gray-800 rounded-xl border ${alert.isActive ? 'border-gray-700' : 'border-gray-700/50 opacity-60'} p-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {avatarText}
                    </div>
                    <div>
                      <div className="font-medium text-white text-lg flex items-center gap-2">
                        <span>{name}</span>
                        {symbol !== '??' && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">{symbol}</span>
                        )}
                      </div>
                      <div className="text-gray-400">{formatCondition(alert)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="text-gray-400">
                        Triggered: <span className="text-white">{alert.triggeredCount}x</span>
                      </div>
                      <div className="text-gray-500">
                        {alert.notificationType === 'in_app' ? '📱 In-App' :
                         alert.notificationType === 'email' ? '📧 Email' : '✈️ Telegram'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(alert)}
                      className={`w-12 h-6 rounded-full transition-colors ${alert.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform ${alert.isActive ? 'translate-x-6' : 'translate-x-0.5'}`}
                      />
                    </button>

                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deleting === alert.id}
                      className="text-red-400 hover:text-red-300 transition-colors p-2"
                      title="Delete alert"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setShowCreateModal(false);
            resetForm();
          }}
        >
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Create Alert</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Coin</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value={0}>Select a coin...</option>
                  {coins.map((coin) => (
                    <option key={coin.id} value={coin.id}>
                      {coin.symbol} - {coin.name || coin.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Condition</label>
                <select
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                >
                  {CONDITION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {conditionType.includes('change') ? 'Percentage (%)' : 'Price ($)'}
                </label>
                <input
                  type="number"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  placeholder={conditionType.includes('change') ? '5' : '50000'}
                  step="any"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notification</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                >
                  {NOTIFICATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !selectedCoin || !conditionValue}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
