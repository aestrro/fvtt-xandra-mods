import { act } from 'react';
import { describe, expect, it } from 'vitest';
import createReactApplicationV2 from '../src/ReactApplicationV2';

class BaseApplication {
  preCloseCalls = 0;

  async _preClose(): Promise<void> {
    this.preCloseCalls += 1;
  }
}

const ReactApplication = createReactApplicationV2(BaseApplication);

class TestApplication extends ReactApplication {
  label = 'ready';

  renderReact() {
    return <span>{this.label}</span>;
  }
}

describe('createReactApplicationV2', () => {
  it('renders a function-component tree into the Foundry content element', async () => {
    const application = new TestApplication();
    const content = document.createElement('section');

    await act(async () => application._replaceHTML(null, content));
    expect(content.textContent).toBe('ready');

    application.label = 'updated';
    await act(async () => application._replaceHTML(null, content));
    expect(content.querySelectorAll('.xandra-react-application-root')).toHaveLength(1);
    expect(content.textContent).toBe('updated');

    await act(async () => application._preClose());
    expect(application.preCloseCalls).toBe(1);
    expect(content.textContent).toBe('');
  });
});
