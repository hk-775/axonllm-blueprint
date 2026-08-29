import { useEffect, useState } from 'react';
import {
  getConfig,
  getHealth,
  getModels,
  type ModelInfo,
} from './api';
import {
  ChatInterface,
} from './components/ChatInterface';
import {
  ConfigPanel,
  type BlueprintSettings,
} from './components/ConfigPanel';
import { useChat } from './hooks/useChat';

const INITIAL_SETTINGS: BlueprintSettings = {
  modelId: '',
  config: {
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
  },
};

const QUICK_STARTS = [
  {
    id: 'design',
    number: '01',
    label: 'Design',
    detail: 'Map a resilient architecture',
    prompt:
      'Design a secure, multi-account event ingestion platform on AWS. Include trust boundaries, failure modes, and a phased delivery plan.',
  },
  {
    id: 'generate',
    number: '02',
    label: 'Generate',
    detail: 'Create reviewable IaC',
    prompt:
      'Create Terraform for a private API Gateway endpoint backed by Lambda and DynamoDB. Include least-privilege IAM, encryption, logging, variables, and outputs.',
  },
  {
    id: 'review',
    number: '03',
    label: 'Review',
    detail: 'Find configuration risk',
    prompt:
      'Review this CloudFormation for security and reliability issues. Categorize findings by severity and show corrected snippets:\n\nResources:\n  DataBucket:\n    Type: AWS::S3::Bucket\n    Properties:\n      AccessControl: PublicRead',
  },
  {
    id: 'diagnose',
    number: '04',
    label: 'Diagnose',
    detail: 'Trace an operational failure',
    prompt:
      'Troubleshoot an AccessDeniedException from a Lambda function calling Bedrock Converse. Give read-only checks first, then remediation and prevention.',
  },
] as const;

type ApiStatus = 'connecting' | 'ready' | 'offline';

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 44 44"
      role="img"
      aria-label="AxonLLM Blueprint"
    >
      <rect x="1" y="1" width="42" height="42" rx="12" />
      <path d="M11 29.5 17.6 13h8.8L33 29.5" />
      <path d="M14.5 23.5h15" />
      <circle cx="11" cy="29.5" r="2.4" />
      <circle cx="17.6" cy="13" r="2.4" />
      <circle cx="26.4" cy="13" r="2.4" />
      <circle cx="33" cy="29.5" r="2.4" />
    </svg>
  );
}

function App() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] =
    useState<BlueprintSettings>(INITIAL_SETTINGS);
  const [region, setRegion] = useState('');
  const [version, setVersion] = useState('beta');
  const [maxMessageChars, setMaxMessageChars] = useState(50_000);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connecting');
  const [startupError, setStartupError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ text: '', version: 0 });
  const chat = useChat(settings);

  useEffect(() => {
    let active = true;

    Promise.all([getModels(), getConfig(), getHealth()])
      .then(([modelResponse, configResponse, healthResponse]) => {
        if (!active) {
          return;
        }
        const configuredModels = modelResponse.models;
        const modelId = configuredModels.some(
          (model) => model.modelId === configResponse.modelId,
        )
          ? configResponse.modelId
          : (configuredModels[0]?.modelId ?? '');

        setModels(configuredModels);
        setSettings({
          modelId,
          config: configResponse.config,
        });
        setRegion(configResponse.region);
        setVersion(healthResponse.version);
        setMaxMessageChars(configResponse.limits.maxMessageChars);
        setApiStatus('ready');
      })
      .catch((caught) => {
        if (!active) {
          return;
        }
        setStartupError(
          caught instanceof Error
            ? caught.message
            : 'The Blueprint API is unavailable.',
        );
        setApiStatus('offline');
      });

    return () => {
      active = false;
    };
  }, []);

  const chooseQuickStart = (prompt: string): void => {
    setDraft((current) => ({
      text: prompt,
      version: current.version + 1,
    }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand__name">
              AxonLLM <span>Blueprint</span>
            </div>
            <div className="brand__tagline">
              Infrastructure reasoning on Amazon Bedrock
            </div>
          </div>
        </div>

        <div className="topbar__meta">
          <span className="family-label">AXONLLM / BUILD SYSTEMS</span>
          <span className={`api-status api-status--${apiStatus}`}>
            <span />
            {apiStatus === 'ready'
              ? 'API ready'
              : apiStatus === 'offline'
                ? 'API offline'
                : 'Connecting'}
          </span>
          <span className="beta-label">{version}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="mission-rail">
          <div className="mission-rail__intro">
            <p className="eyebrow">Infrastructure copilot</p>
            <h2>Reason first. Deploy with confidence.</h2>
            <p>
              Blueprint turns requirements, code, and failure signals into
              infrastructure decisions your team can inspect.
            </p>
          </div>

          <nav className="quick-starts" aria-label="Quick start prompts">
            <div className="rail-heading">
              <span>Start a workflow</span>
              <span>4 modes</span>
            </div>
            {QUICK_STARTS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="quick-start"
                onClick={() => chooseQuickStart(item.prompt)}
              >
                <span className="quick-start__number">{item.number}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11M11 6l4 4-4 4" />
                </svg>
              </button>
            ))}
          </nav>

          <div className="workflow-map">
            <div className="rail-heading">
              <span>Decision path</span>
              <span>Human gated</span>
            </div>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Frame</strong>
                  <small>Workload and constraints</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Reason</strong>
                  <small>Bedrock model response</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Validate</strong>
                  <small>Native tools and review</small>
                </div>
              </li>
            </ol>
          </div>

          <div className="rail-footer">
            <span>MIT-0</span>
            <span>In-memory sessions</span>
          </div>
        </aside>

        <main className="conversation-column">
          {startupError && (
            <div className="startup-banner" role="alert">
              <strong>Backend connection unavailable.</strong>
              <span>{startupError}</span>
            </div>
          )}
          <ChatInterface
            messages={chat.messages}
            loading={chat.loading}
            error={chat.error}
            sessionId={chat.sessionId}
            lastRun={chat.lastRun}
            draftPrompt={draft.text}
            draftPromptVersion={draft.version}
            maxMessageChars={maxMessageChars}
            onSend={chat.sendMessage}
            onNewSession={chat.newSession}
            onRetry={chat.retryLast}
          />
        </main>

        <ConfigPanel
          models={models}
          value={settings}
          region={region}
          loading={apiStatus !== 'ready'}
          onApply={setSettings}
        />
      </div>
    </div>
  );
}

export default App;
