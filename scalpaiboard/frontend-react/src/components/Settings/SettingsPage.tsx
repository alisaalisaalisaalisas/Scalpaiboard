import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAIProviders, addAIProvider, testAIProvider, deleteAIProvider, fetchProviderModelsDetailed, updateAIProvider, getProviderModelsByIdDetailed, type AIProviderModelDetail } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useRightPanelStore } from '../../store/rightPanelStore';
import { Pencil, Trash2, RefreshCw, Info } from 'lucide-react';

interface Provider {
  id: number;
  providerType: string;
  providerName: string;
  modelName: string;
  isActive: boolean;
  isDefault: boolean;
  maxTokens: number;
  temperature: number;
  monthlyBudget?: number;
  monthlySpent: number;
}

interface AvailableProvider {
  type: string;
  name: string;
  models: string[];
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

const AVAILABLE_PROVIDERS: AvailableProvider[] = [
  { type: 'openai', name: 'OpenAI', models: ['gpt-5.2', 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-oss-120b'] },
  { type: 'anthropic', name: 'Anthropic', models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { type: 'google', name: 'Google', models: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-pro'] },
  { type: 'xai', name: 'xAI (Grok)', models: ['grok-4.1-fast', 'grok-4-fast', 'grok-code-fast-1', 'grok-2', 'grok-beta'] },
  { type: 'deepseek', name: 'DeepSeek', models: ['deepseek-v3.2', 'deepseek-v3-0324', 'deepseek-coder', 'deepseek-chat'] },
  { type: 'mistral', name: 'Mistral AI', models: ['devstral-2-2512', 'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'] },
  { type: 'groq', name: 'Groq (Fast)', models: ['llama-3.3-70b', 'llama-3.1-70b', 'mixtral-8x7b-32768', 'gemma2-9b'] },
  { type: 'together', name: 'Together AI', models: ['meta-llama/Llama-3.3-70B', 'mistralai/Mixtral-8x22B', 'Qwen/Qwen2.5-72B'] },
  { type: 'openrouter', name: 'OpenRouter', models: ['anthropic/claude-3-opus', 'openai/gpt-4-turbo', 'google/gemini-pro', 'meta-llama/llama-3-70b'] },
  { type: 'xiaomi', name: 'Xiaomi', models: ['mimo-v2-flash'] },
  { type: 'kwaipilot', name: 'Kwaipilot', models: ['kat-coder-pro-v1'] },
];

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const openChat = useRightPanelStore((state) => state.openChat);

  const { isAuthenticated } = useAuthStore();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>(AVAILABLE_PROVIDERS);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);

  // Add provider form
  const [selectedType, setSelectedType] = useState('openai');
  const [providerName, setProviderName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelDetailsById, setModelDetailsById] = useState<Record<string, number>>({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [temperature, setTemperature] = useState(0.7);
  const [hasTouchedMaxTokens, setHasTouchedMaxTokens] = useState(false);
  const [hasTouchedTemperature, setHasTouchedTemperature] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit provider modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editModels, setEditModels] = useState<string[]>([]);
  const [editModelDetailsById, setEditModelDetailsById] = useState<Record<string, number>>({});
  const [editModelsLoading, setEditModelsLoading] = useState(false);
  const [editMaxTokens, setEditMaxTokens] = useState(2000);
  const [editTemperature, setEditTemperature] = useState(0.7);
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadProviders();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Set default models when provider type changes
    const provider = availableProviders.find(p => p.type === selectedType);
    if (!provider) return;

    setHasTouchedMaxTokens(false);
    setHasTouchedTemperature(false);

    setModelDetailsById({});
    setAvailableModels(provider.models);
    if (provider.models.length === 0) return;

    if (!provider.models.includes(modelName)) {
      setModelName(provider.models[0]);
    }
  }, [availableProviders, modelName, selectedType]);

  const loadProviders = async () => {
    try {
      const data = await getAIProviders();
      setProviders(data.configured || []);
      if (data.available && Array.isArray(data.available) && data.available.length > 0) {
        setAvailableProviders(data.available);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);

    try {
      await addAIProvider({
        providerType: selectedType,
        providerName: providerName || availableProviders.find(p => p.type === selectedType)?.name || selectedType,
        apiKey,
        modelName,
        maxTokens,
        temperature,
        isDefault,
      });
      
      setShowAddModal(false);
      resetForm();
      loadProviders();
      window.dispatchEvent(new Event('scalpaiboard-ai-provider-updated'));
    } catch (error: any) {
      setAddError(error.response?.data?.error || 'Failed to add provider');
    } finally {
      setAdding(false);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    
    try {
      const result = await testAIProvider(id);
      setTestResult({ id, success: result.status === 'success', message: result.message });
    } catch (error: any) {
      setTestResult({ id, success: false, message: error.response?.data?.error || 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) return;
    
    try {
      await deleteAIProvider(id);
      loadProviders();
    } catch (error) {
      console.error('Failed to delete provider:', error);
    }
  };

  const loadModelsForProvider = async (provider: Provider) => {
    setEditModelsLoading(true);
    setEditError('');

    try {
      const result = await getProviderModelsByIdDetailed(provider.id);
      const models = result.models;
      const details = result.details;

      const detailMap: Record<string, number> = {};
      for (const d of (details || []) as AIProviderModelDetail[]) {
        if (d?.id && typeof d.contextLength === 'number') {
          detailMap[d.id] = d.contextLength;
        }
      }
      setEditModelDetailsById(detailMap);

      if (models && models.length > 0) {
        setEditModels(models);
        if (!models.includes(provider.modelName)) {
          setEditModelName(models[0]);
        }
      }
    } catch (error: any) {
      setEditError(error.response?.data?.error || error.message || 'Failed to fetch models');
    } finally {
      setEditModelsLoading(false);
    }
  };

  const openEditProvider = async (provider: Provider) => {
    setEditingProvider(provider);
    setEditModelName(provider.modelName);
    setEditModels([]);
    setEditModelDetailsById({});
    setEditMaxTokens(provider.maxTokens);
    setEditTemperature(provider.temperature);
    setEditIsDefault(provider.isDefault);
    setEditError('');

    const fallbackModels = availableProviders.find((p) => p.type === provider.providerType)?.models || [];
    setEditModels(fallbackModels.length > 0 ? fallbackModels : [provider.modelName]);

    setShowEditModal(true);
    await loadModelsForProvider(provider);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    setSavingEdit(true);
    setEditError('');

    try {
      await updateAIProvider(editingProvider.id, {
        modelName: editModelName,
        maxTokens: editMaxTokens,
        temperature: editTemperature,
        isDefault: editIsDefault,
      });

      setShowEditModal(false);
      setEditingProvider(null);
      loadProviders();
      window.dispatchEvent(new Event('scalpaiboard-ai-provider-updated'));
    } catch (error: any) {
      setEditError(error.response?.data?.error || 'Failed to update provider');
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    const state = location.state as { editProviderId?: number } | null;
    if (!state?.editProviderId) return;

    const provider = providers.find((p) => p.id === state.editProviderId);
    if (!provider) return;

    void openEditProvider(provider);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, providers]);

  const handleFetchModels = async () => {
    if (!apiKey) {
      setAddError('Please enter an API key to fetch models');
      return;
    }
    
    setFetchingModels(true);
    setAddError('');
    
    try {
      const result = await fetchProviderModelsDetailed(selectedType, apiKey);
      const models = result.models;
      const details = result.details;

      const detailMap: Record<string, number> = {};
      for (const d of (details || []) as AIProviderModelDetail[]) {
        if (d?.id && typeof d.contextLength === 'number') {
          detailMap[d.id] = d.contextLength;
        }
      }
      setModelDetailsById(detailMap);

      if (models && models.length > 0) {
        setAvailableModels(models);
        setModelName(models[0]);
      } else {
        setAddError('No models found for this API key');
      }
    } catch (error: any) {
      setAddError('Failed to fetch models: ' + (error.response?.data?.error || error.message));
    } finally {
      setFetchingModels(false);
    }
  };

  const resetForm = () => {
    setSelectedType('openai');
    setProviderName('');
    setApiKey('');
    setModelName('');
    setAvailableModels([]);
    setModelDetailsById({});
    setMaxTokens(2000);
    setTemperature(0.7);
    setHasTouchedMaxTokens(false);
    setHasTouchedTemperature(false);
    setIsDefault(false);
    setAddError('');
  };

  const selectedProviderInfo = useMemo(() => {
    return availableProviders.find(p => p.type === selectedType);
  }, [availableProviders, selectedType]);

  const modelSpecs = useMemo(() => {
    if (!selectedProviderInfo || !modelName) return null;

    const lowerModel = modelName.toLowerCase();
    const isCode = /code|coder|codestral|devstral|kat-coder/.test(lowerModel);
    const isFast = /mini|small|flash|lite|fast/.test(lowerModel);
    const isLarge = /opus|pro|large|70b|120b|gpt-5/.test(lowerModel);
    const isVision = /vision/.test(lowerModel);

    const temperatureDefault = isCode ? 0.2 : isFast ? 0.5 : 0.7;

    const contextLength = modelDetailsById[modelName];
    let maxTokensDefault = isLarge ? 4000 : 2000;
    if (typeof contextLength === 'number' && contextLength > 0) {
      // Context length is the total window, not max output.
      // Keep max output well below context to avoid provider errors.
      maxTokensDefault = Math.min(16000, Math.max(2000, Math.floor(contextLength / 8)));
    }

    const badges: string[] = [];
    if (isCode) badges.push('Coding');
    if (isVision) badges.push('Vision');
    if (isFast) badges.push('Fast');
    if (isLarge) badges.push('High quality');

    const useCases: string[] = [];
    if (isCode) useCases.push('Code review, refactors, debugging');
    useCases.push('Market questions, summaries, explanations');
    useCases.push('Trading ideas (non-financial advice)');
    useCases.push('Drafting alerts/watchlist prompts');

    return {
      providerName: selectedProviderInfo.name,
      modelName,
      badges,
      isCode,
      isFast,
      isLarge,
      isVision,
      contextLength,
      maxTokensDefault,
      temperatureDefault,
      useCases,
    };
  }, [modelDetailsById, modelName, selectedProviderInfo]);

  const editModelSpecs = useMemo(() => {
    if (!editingProvider || !editModelName) return null;

    const providerInfo = availableProviders.find((p) => p.type === editingProvider.providerType);

    const lowerModel = editModelName.toLowerCase();
    const isCode = /code|coder|codestral|devstral|kat-coder/.test(lowerModel);
    const isFast = /mini|small|flash|lite|fast/.test(lowerModel);
    const isLarge = /opus|pro|large|70b|120b|gpt-5/.test(lowerModel);
    const isVision = /vision/.test(lowerModel);

    const temperatureDefault = isCode ? 0.2 : isFast ? 0.5 : 0.7;

    const contextLength = editModelDetailsById[editModelName];
    let maxTokensDefault = isLarge ? 4000 : 2000;
    if (typeof contextLength === 'number' && contextLength > 0) {
      maxTokensDefault = Math.min(16000, Math.max(2000, Math.floor(contextLength / 8)));
    }

    const badges: string[] = [];
    if (isCode) badges.push('Coding');
    if (isVision) badges.push('Vision');
    if (isFast) badges.push('Fast');
    if (isLarge) badges.push('High quality');

    const useCases: string[] = [];
    if (isCode) useCases.push('Code review, refactors, debugging');
    useCases.push('Market questions, summaries, explanations');
    useCases.push('Trading ideas (non-financial advice)');
    useCases.push('Drafting alerts/watchlist prompts');

    return {
      providerName: providerInfo?.name || editingProvider.providerName,
      modelName: editModelName,
      badges,
      isCode,
      isFast,
      isLarge,
      isVision,
      contextLength,
      maxTokensDefault,
      temperatureDefault,
      useCases,
    };
  }, [availableProviders, editModelDetailsById, editModelName, editingProvider]);


  useEffect(() => {
    if (!modelSpecs) return;
    if (!hasTouchedMaxTokens) setMaxTokens(modelSpecs.maxTokensDefault);
    if (!hasTouchedTemperature) setTemperature(modelSpecs.temperatureDefault);
  }, [hasTouchedMaxTokens, hasTouchedTemperature, modelSpecs]);

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg">
          Please sign in to configure AI providers.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure your AI providers and preferences</p>
      </div>

      {/* AI Providers Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Providers</h2>
            <p className="text-sm text-gray-400">Add and manage your AI service providers</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Provider
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">No AI providers configured</div>
            <p className="text-sm text-gray-500 mb-4">
              Add an AI provider to enable the AI assistant feature. You'll need an API key from your chosen provider.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {providers.map((provider) => (
              <div key={provider.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${provider.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{provider.providerName}</span>
                      {provider.isDefault && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Default</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">{provider.modelName}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {provider.monthlyBudget && (
                    <div className="text-sm text-gray-400">
                      ${provider.monthlySpent.toFixed(2)} / ${provider.monthlyBudget.toFixed(2)}
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleTest(provider.id)}
                    disabled={testingId === provider.id}
                    className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {testingId === provider.id ? 'Testing...' : 'Test'}
                  </button>

                  <button
                    onClick={() => void openEditProvider(provider)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                    title="Edit Provider"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors"
                    title="Delete Provider"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  {testResult?.id === provider.id && (
                    <div className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? '✓ Working' : '✗ Failed'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Assistant Help */}
      <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
            <p className="text-sm text-gray-400">Example prompts and what the assistant can help with</p>
          </div>
          <button
            type="button"
            onClick={() => openChat()}
            className="text-xs px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
            title="Open AI chat"
          >
            Open Chat
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Quick prompts</div>
            <ul className="text-gray-300 space-y-1">
              <li>• Find coins with &gt;$100M volume and &gt;5% change</li>
              <li>• Analyze BTC on 1h timeframe</li>
              <li>• Summarize today’s market movers</li>
              <li>• Explain RSI + show how to use it</li>
            </ul>
          </div>
          <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Tips</div>
            <ul className="text-gray-300 space-y-1">
              <li>• Be specific: timeframe, symbol, and thresholds</li>
              <li>• Use lower temperature for coding or precise outputs</li>
              <li>• Increase max tokens for longer explanations</li>
              <li>• The assistant provides guidance, not financial advice</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setShowAddModal(false);
            resetForm();
          }}
        >
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add AI Provider</h2>
            
            <form onSubmit={handleAddProvider} className="space-y-4">
              {/* Provider Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="provider-select">Provider</label>
                <select
                  id="provider-select"
                  aria-label="Select AI Provider"
                  title="Select AI Provider"
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    const provider = availableProviders.find(p => p.type === e.target.value);
                    // Default models only if we haven't fetched specialized ones
                    if (provider) setAvailableModels(provider.models);
                  }}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                    {availableProviders.map((p) => (
                      <option key={p.type} value={p.type}>{p.name}</option>
                    ))}

                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    aria-label="API Key"
                    title="Enter API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="sk-..."
                    required
                  />
                </div>
              </div>

              {/* Model */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-300">Model</label>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || !apiKey}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                    {fetchingModels ? 'Fetching...' : 'Fetch Models'}
                  </button>
                </div>
                <select
                  aria-label="Select Model"
                  title="Select AI Model"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select a model</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {modelSpecs && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                      <Info className="w-4 h-4 text-gray-400" />
                      Model specs
                    </div>
                    <div className="text-xs text-gray-400">
                      {typeof modelSpecs.contextLength === 'number' && (
                        <span>Context {modelSpecs.contextLength.toLocaleString()} • </span>
                      )}
                      Suggested output {modelSpecs.maxTokensDefault} • temp {modelSpecs.temperatureDefault}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-300">
                    <div className="text-white font-medium">{modelSpecs.providerName} / {modelSpecs.modelName}</div>
                    {modelSpecs.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {modelSpecs.badges.map((b) => (
                          <span key={b} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-200 rounded-full">{b}</span>
                        ))}
                      </div>
                    )}
                    <ul className="mt-2 text-xs text-gray-400 list-disc pl-4 space-y-1">
                      {modelSpecs.useCases.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Optional Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  aria-label="Display Name"
                  title="Provider Display Name"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder={selectedProviderInfo?.name}
                />
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => { setHasTouchedMaxTokens(true); setMaxTokens(Number(e.target.value)); }}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min={100}
                    max={2000000}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Temperature</label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => { setHasTouchedTemperature(true); setTemperature(Number(e.target.value)); }}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                Set as default provider
              </label>

              {addError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !apiKey}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Provider Modal */}
      {showEditModal && editingProvider && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setShowEditModal(false);
            setEditingProvider(null);
          }}
        >
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Edit AI Provider</h2>
                <p className="text-sm text-gray-400">Update model and generation settings</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProvider(null);
                }}
                className="text-gray-400 hover:text-white"
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-300">Provider</div>
                <div className="text-white font-medium">
                  {editingProvider.providerName} <span className="text-gray-400 font-normal">({editingProvider.providerType})</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-300">Model</label>
                  <button
                    type="button"
                    onClick={() => void loadModelsForProvider(editingProvider)}
                    disabled={editModelsLoading}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${editModelsLoading ? 'animate-spin' : ''}`} />
                    {editModelsLoading ? 'Refreshing...' : 'Refresh models'}
                  </button>
                </div>
                <select
                  aria-label="Select Model"
                  title="Select AI Model"
                  value={editModelName}
                  onChange={(e) => setEditModelName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {editModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {editModelSpecs && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                      <Info className="w-4 h-4 text-gray-400" />
                      Model specs
                    </div>
                    <div className="text-xs text-gray-400">
                      {typeof editModelSpecs.contextLength === 'number' && (
                        <span>Context {editModelSpecs.contextLength.toLocaleString()} • </span>
                      )}
                      Suggested output {editModelSpecs.maxTokensDefault} • temp {editModelSpecs.temperatureDefault}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    <div className="text-white font-medium">{editModelSpecs.providerName} / {editModelSpecs.modelName}</div>
                    {editModelSpecs.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editModelSpecs.badges.map((b) => (
                          <span key={b} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-200 rounded-full">{b}</span>
                        ))}
                      </div>
                    )}
                    <ul className="mt-2 text-xs text-gray-400 list-disc pl-4 space-y-1">
                      {editModelSpecs.useCases.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={editMaxTokens}
                    onChange={(e) => setEditMaxTokens(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min={100}
                    max={2000000}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Temperature</label>
                  <input
                    type="number"
                    value={editTemperature}
                    onChange={(e) => setEditTemperature(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={editIsDefault}
                  onChange={(e) => setEditIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                Set as default provider
              </label>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProvider(null);
                  }}
                  className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
