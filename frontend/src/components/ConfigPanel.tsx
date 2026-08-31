import { useEffect, useMemo, useState } from 'react';
import type { InferenceParams, ModelInfo } from '../api';

const PARAM_RANGES = {
  temperature: { min: 0, max: 1, step: 0.1 },
  maxTokens: { min: 1, max: 4096, step: 1 },
  topP: { min: 0, max: 1, step: 0.1 },
} as const;

export interface BlueprintSettings {
  modelId: string;
  config: InferenceParams;
}

export interface ConfigPanelProps {
  models: ModelInfo[];
  value: BlueprintSettings;
  region: string;
  loading?: boolean;
  synthetic?: boolean;
  onApply: (settings: BlueprintSettings) => void;
}

interface ValidationErrors {
  temperature?: string;
  maxTokens?: string;
  topP?: string;
}

function validate(config: InferenceParams): ValidationErrors {
  const errors: ValidationErrors = {};
  if (
    !Number.isFinite(config.temperature) ||
    config.temperature < PARAM_RANGES.temperature.min ||
    config.temperature > PARAM_RANGES.temperature.max
  ) {
    errors.temperature = 'Temperature must be between 0 and 1.';
  }
  if (
    !Number.isInteger(config.maxTokens) ||
    config.maxTokens < PARAM_RANGES.maxTokens.min ||
    config.maxTokens > PARAM_RANGES.maxTokens.max
  ) {
    errors.maxTokens = 'Max tokens must be an integer between 1 and 4096.';
  }
  if (
    !Number.isFinite(config.topP) ||
    config.topP < PARAM_RANGES.topP.min ||
    config.topP > PARAM_RANGES.topP.max
  ) {
    errors.topP = 'Top-P must be between 0 and 1.';
  }
  return errors;
}

export function ConfigPanel({
  models,
  value,
  region,
  loading = false,
  synthetic = false,
  onApply,
}: ConfigPanelProps) {
  const [modelId, setModelId] = useState(value.modelId);
  const [temperature, setTemperature] = useState(
    String(value.config.temperature),
  );
  const [maxTokens, setMaxTokens] = useState(
    String(value.config.maxTokens),
  );
  const [topP, setTopP] = useState(String(value.config.topP));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setModelId(value.modelId);
    setTemperature(String(value.config.temperature));
    setMaxTokens(String(value.config.maxTokens));
    setTopP(String(value.config.topP));
  }, [value]);

  const selectedModel = useMemo(
    () => models.find((model) => model.modelId === modelId),
    [modelId, models],
  );

  const handleApply = (): void => {
    const config: InferenceParams = {
      temperature: Number(temperature),
      maxTokens: Number(maxTokens),
      topP: Number(topP),
    };
    const nextErrors = validate(config);
    setErrors(nextErrors);
    setStatus(null);
    if (Object.keys(nextErrors).length > 0 || !modelId) {
      return;
    }

    onApply({ modelId, config });
    setStatus('Applied to this session');
  };

  return (
    <aside className="settings" data-testid="config-panel">
      <div className="settings__heading">
        <p className="eyebrow">Runtime controls</p>
        <h2>Model profile</h2>
        <p>
          Tune reasoning behavior without exposing arbitrary model IDs to the
          browser.
        </p>
      </div>

      <div className="runtime-card">
        <div>
          <span className="runtime-card__indicator" />
          <span>{synthetic ? 'Synthetic model profile' : 'Amazon Bedrock'}</span>
        </div>
        <strong>{region || 'Loading region'}</strong>
      </div>

      <div className="field-group">
        <label htmlFor="model-select">Foundation model</label>
        <select
          id="model-select"
          data-testid="model-select"
          value={modelId}
          onChange={(event) => {
            setModelId(event.target.value);
            setStatus(null);
          }}
          disabled={loading || models.length === 0}
        >
          {models.length === 0 && <option value="">No model configured</option>}
          {models.map((model) => (
            <option key={model.modelId} value={model.modelId}>
              {model.modelName}
            </option>
          ))}
        </select>
        {selectedModel && (
          <div className="model-detail">
            <span>{selectedModel.provider}</span>
            <code>{selectedModel.modelId}</code>
          </div>
        )}
      </div>

      <div className="settings__divider" />

      <div className="field-group">
        <div className="field-label">
          <label htmlFor="temperature-input">Temperature</label>
          <span>Creativity</span>
        </div>
        <input
          id="temperature-input"
          data-testid="temperature-input"
          type="number"
          min={PARAM_RANGES.temperature.min}
          max={PARAM_RANGES.temperature.max}
          step={PARAM_RANGES.temperature.step}
          value={temperature}
          onChange={(event) => {
            setTemperature(event.target.value);
            setStatus(null);
          }}
        />
        <div className="range-track" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, Number(temperature) * 100))}%` }} />
        </div>
        {errors.temperature && (
          <span
            className="field-error"
            data-testid="temperature-error"
            role="alert"
          >
            {errors.temperature}
          </span>
        )}
      </div>

      <div className="field-group">
        <div className="field-label">
          <label htmlFor="max-tokens-input">Output budget</label>
          <span>Tokens</span>
        </div>
        <input
          id="max-tokens-input"
          data-testid="max-tokens-input"
          type="number"
          min={PARAM_RANGES.maxTokens.min}
          max={PARAM_RANGES.maxTokens.max}
          step={PARAM_RANGES.maxTokens.step}
          value={maxTokens}
          onChange={(event) => {
            setMaxTokens(event.target.value);
            setStatus(null);
          }}
        />
        <div className="range-track" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, (Number(maxTokens) / 4096) * 100))}%` }} />
        </div>
        {errors.maxTokens && (
          <span
            className="field-error"
            data-testid="max-tokens-error"
            role="alert"
          >
            {errors.maxTokens}
          </span>
        )}
      </div>

      <div className="field-group">
        <div className="field-label">
          <label htmlFor="top-p-input">Top-P</label>
          <span>Sampling</span>
        </div>
        <input
          id="top-p-input"
          data-testid="top-p-input"
          type="number"
          min={PARAM_RANGES.topP.min}
          max={PARAM_RANGES.topP.max}
          step={PARAM_RANGES.topP.step}
          value={topP}
          onChange={(event) => {
            setTopP(event.target.value);
            setStatus(null);
          }}
        />
        <div className="range-track" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, Number(topP) * 100))}%` }} />
        </div>
        {errors.topP && (
          <span
            className="field-error"
            data-testid="top-p-error"
            role="alert"
          >
            {errors.topP}
          </span>
        )}
      </div>

      <button
        className="button button--secondary settings__apply"
        type="button"
        data-testid="save-config"
        onClick={handleApply}
        disabled={loading || !modelId}
      >
        Apply profile
      </button>

      {status && (
        <div className="settings__status" data-testid="config-status">
          <span />
          {status}
        </div>
      )}

      <div className="guardrail-note">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2 4 4.5v4.8c0 3.8 2.5 7.2 6 8.7 3.5-1.5 6-4.9 6-8.7V4.5L10 2Z" />
          <path d="m7.5 10 1.7 1.7 3.6-4" />
        </svg>
        <p>
          {synthetic
            ? 'This published profile is browser-local and does not invoke a model or cloud service.'
            : 'Model choices come from the server allowlist. Credentials stay in the standard AWS credential chain.'}
        </p>
      </div>
    </aside>
  );
}

export default ConfigPanel;
