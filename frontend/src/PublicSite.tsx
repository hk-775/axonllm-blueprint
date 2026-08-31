import { useEffect, useMemo, useState } from 'react';
import App from './App';
import { BrandMark } from './components/BrandMark';
import { PUBLIC_BASE_PATH } from './runtimeMode';

type PublicRoute = 'landing' | 'workspace' | 'architecture';

const FLOWS = {
  request: [
    ['Frame', 'Engineer supplies requirements, constraints, code, or failure evidence.'],
    ['Guard', 'The API validates size, schema, model allowlist, identity, and rate limits.'],
    ['Reason', 'The prompt engine keeps untrusted content in the user role and selects a workflow.'],
    ['Converse', 'Bedrock Runtime is called with workload credentials and bounded inference settings.'],
    ['Review', 'The engineer inspects assumptions and runs native validation before deployment.'],
  ],
  safety: [
    ['Identity', 'A trusted proxy strips spoofed headers and injects a verified principal.'],
    ['Isolation', 'Sessions are owner-bound, bounded, in-memory, and expire after inactivity.'],
    ['Credentials', 'AWS credentials remain in the server-side credential chain.'],
    ['Advisory', 'Model output cannot deploy infrastructure or retrieve secrets.'],
    ['Approval', 'Deployment remains a separate, explicit human action.'],
  ],
  target: [
    ['Edge', 'CloudFront and AWS WAF serve the private static site and protect the API path.'],
    ['Identity', 'Amazon Cognito and an API Gateway authorizer establish the principal.'],
    ['Runtime', 'ECS on AWS Fargate runs the API across private subnets.'],
    ['State', 'DynamoDB replaces process-local sessions and rate-limit buckets.'],
    ['Observe', 'CloudWatch captures operational telemetry without prompt content by default.'],
  ],
} as const;

function routeFromHash(): PublicRoute {
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (route === 'workspace') return 'workspace';
  if (route === 'architecture') return 'architecture';
  return 'landing';
}

function PublicHeader() {
  return (
    <header className="public-header">
      <a className="brand brand--link" href="#/" aria-label="AxonLLM Blueprint home">
        <BrandMark />
        <div>
          <div className="brand__name">AxonLLM <span>Blueprint</span></div>
          <div className="brand__tagline">Infrastructure reasoning on Amazon Bedrock</div>
        </div>
      </a>
      <nav aria-label="Public site">
        <a href="#/">Overview</a>
        <a href="#/workspace">Synthetic workbench</a>
        <a href="#/architecture">Architecture</a>
        <a href="https://github.com/hk-775/axonllm-blueprint">GitHub</a>
      </nav>
    </header>
  );
}

function Landing() {
  return (
    <div className="public-page" data-public-route="landing">
      <PublicHeader />
      <main>
        <section className="public-hero">
          <div>
            <p className="eyebrow">Open-source infrastructure workbench</p>
            <h1>Reason about cloud systems before you deploy them.</h1>
            <p className="public-hero__copy">
              AxonLLM Blueprint turns architecture briefs, infrastructure code,
              and failure signals into reviewable guidance while preserving an
              explicit human deployment gate.
            </p>
            <div className="public-actions">
              <a className="button button--primary" href="#/workspace">Open synthetic workbench</a>
              <a className="button button--secondary" href="#/architecture">Explore architecture</a>
            </div>
            <div className="public-boundary" data-public-preview>
              <strong>Published synthetic preview</strong>
              <span>No API, Bedrock, credentials, WebSockets, or cloud resources.</span>
            </div>
          </div>
          <div className="public-signal-card" aria-label="Blueprint workflow">
            {['Frame the workload', 'Reason with explicit assumptions', 'Validate with native tools', 'Deploy through a separate human action'].map((item, index) => (
              <div key={item}><span>0{index + 1}</span><strong>{item}</strong></div>
            ))}
          </div>
        </section>
        <section className="public-section">
          <div className="public-section__head">
            <p className="eyebrow">Four focused modes</p>
            <h2>One workspace for design, generation, review, and diagnosis.</h2>
          </div>
          <div className="public-card-grid">
            {[
              ['Architecture', 'Expose assumptions, trust boundaries, tradeoffs, and failure modes.'],
              ['IaC generation', 'Produce reviewable CloudFormation, Terraform, and AWS CDK drafts.'],
              ['Configuration review', 'Find security, reliability, cost, and operability risks.'],
              ['Troubleshooting', 'Start with read-only checks, then remediation and prevention.'],
            ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>
        <section className="public-section public-section--split">
          <div>
            <p className="eyebrow">Hard boundaries</p>
            <h2>Advisory output stays behind human review.</h2>
          </div>
          <ul>
            <li>Server-side model allowlist and bounded inference parameters</li>
            <li>Trusted-proxy identity mode with owner-bound sessions</li>
            <li>No secret retrieval or browser-side AWS credentials</li>
            <li>No autonomous deployment path in the application</li>
          </ul>
        </section>
      </main>
      <footer className="public-footer"><span>MIT-0 · Beta reference implementation</span><a href="#/architecture">View editable diagrams</a></footer>
    </div>
  );
}

function Architecture() {
  const [flow, setFlow] = useState<keyof typeof FLOWS>('request');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeFlow = useMemo(() => FLOWS[flow], [flow]);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [flow]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= activeFlow.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [activeFlow.length, playing]);

  const asset = (name: string) => `${PUBLIC_BASE_PATH}assets/${name}`;

  return (
    <div className="public-page" data-public-route="architecture">
      <PublicHeader />
      <main>
        <section className="architecture-hero">
          <p className="eyebrow">Inspectable architecture</p>
          <h1>Current application boundaries and a proposed AWS production target.</h1>
          <p>The current diagram reflects version 0.1. The AWS services diagram is a reference only: this repository ships no AWS infrastructure-as-code and does not prove a deployment exists.</p>
        </section>
        <section className="diagram-grid">
          <article>
            <span className="diagram-status">Implemented</span>
            <h2>Current system</h2>
            <a href={asset('axonllm-blueprint-architecture.png')}><img src={asset('axonllm-blueprint-architecture.png')} alt="Current AxonLLM Blueprint architecture" /></a>
            <div><a href={asset('axonllm-blueprint-architecture.png')} download>PNG</a><a href={asset('axonllm-blueprint-architecture.drawio')} download>Editable draw.io</a></div>
          </article>
          <article>
            <span className="diagram-status diagram-status--target">Proposed · not deployed</span>
            <h2>AWS services reference</h2>
            <a href={asset('axonllm-blueprint-aws-services-reference.png')}><img src={asset('axonllm-blueprint-aws-services-reference.png')} alt="Proposed AWS services reference architecture" /></a>
            <div><a href={asset('axonllm-blueprint-aws-services-reference.png')} download>PNG</a><a href={asset('axonllm-blueprint-aws-services-reference.drawio')} download>Editable draw.io</a></div>
          </article>
        </section>
        <section className="flow-explorer" data-flow-explorer>
          <div className="flow-tabs">
            {Object.keys(FLOWS).map((key) => (
              <button key={key} type="button" className={flow === key ? 'active' : ''} onClick={() => setFlow(key as keyof typeof FLOWS)} data-flow-scenario={key}>
                {key === 'request' ? 'Request flow' : key === 'safety' ? 'Safety boundary' : 'Production target'}
              </button>
            ))}
          </div>
          <div className="flow-track">
            {activeFlow.map(([title], index) => (
              <button key={title} type="button" className={index === step ? 'active' : index < step ? 'complete' : ''} onClick={() => setStep(index)} data-flow-step={index}>
                <span>{index + 1}</span><strong>{title}</strong>
              </button>
            ))}
          </div>
          <div className="flow-detail">
            <div><span>Step {step + 1} / {activeFlow.length}</span><h2>{activeFlow[step][0]}</h2><p>{activeFlow[step][1]}</p></div>
            <button className="button button--primary" type="button" onClick={() => setPlaying((value) => !value)} data-flow-play aria-label={playing ? 'Pause architecture flow' : 'Play architecture flow'}>
              {playing ? 'Pause' : 'Play flow'}
            </button>
          </div>
        </section>
      </main>
      <footer className="public-footer"><a href="#/workspace">Try the synthetic workbench</a><a href="#/">Back to overview</a></footer>
    </div>
  );
}

export default function PublicSite() {
  const [route, setRoute] = useState<PublicRoute>(routeFromHash);
  useEffect(() => {
    const update = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', update);
  }, []);

  if (route === 'workspace') return <App />;
  if (route === 'architecture') return <Architecture />;
  return <Landing />;
}
