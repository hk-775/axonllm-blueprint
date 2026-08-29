import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfigPanel,
  type BlueprintSettings,
} from '../ConfigPanel';

const models = [
  {
    modelId: 'us.amazon.nova-2-lite-v1:0',
    modelName: 'Nova 2 Lite',
    provider: 'Amazon',
  },
  {
    modelId: 'us.anthropic.claude-sonnet-4-6',
    modelName: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
  },
];

const settings: BlueprintSettings = {
  modelId: 'us.amazon.nova-2-lite-v1:0',
  config: {
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
  },
};

function renderPanel(onApply = vi.fn()) {
  return {
    onApply,
    ...render(
      <ConfigPanel
        models={models}
        value={settings}
        region="us-east-1"
        onApply={onApply}
      />,
    ),
  };
}

describe('ConfigPanel', () => {
  it('renders only server-allowlisted models', () => {
    renderPanel();

    const options = screen
      .getByTestId('model-select')
      .querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Nova 2 Lite');
  });

  it('renders the active inference profile', () => {
    renderPanel();

    expect(
      (screen.getByTestId('temperature-input') as HTMLInputElement).value,
    ).toBe('0.3');
    expect(
      (screen.getByTestId('max-tokens-input') as HTMLInputElement).value,
    ).toBe('2048');
    expect(
      (screen.getByTestId('top-p-input') as HTMLInputElement).value,
    ).toBe('0.9');
  });

  it('shows a validation error for an out-of-range temperature', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('temperature-input'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByTestId('save-config'));

    expect(screen.getByTestId('temperature-error').textContent).toContain(
      'between 0 and 1',
    );
  });

  it('shows a validation error for an invalid token budget', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('max-tokens-input'), {
      target: { value: '9999' },
    });
    fireEvent.click(screen.getByTestId('save-config'));

    expect(screen.getByTestId('max-tokens-error').textContent).toContain(
      'between 1 and 4096',
    );
  });

  it('applies a valid profile locally', () => {
    const { onApply } = renderPanel();

    fireEvent.change(screen.getByTestId('model-select'), {
      target: { value: 'us.anthropic.claude-sonnet-4-6' },
    });
    fireEvent.click(screen.getByTestId('save-config'));

    expect(onApply).toHaveBeenCalledWith({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      config: {
        temperature: 0.3,
        maxTokens: 2048,
        topP: 0.9,
      },
    });
    expect(screen.getByTestId('config-status').textContent).toContain(
      'Applied to this session',
    );
  });
});
