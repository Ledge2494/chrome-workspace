import { render } from '@testing-library/preact';
import Popup from './Popup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('Popup page', () => {
  it('should render create form and workspace list elements', () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <Popup />
      </QueryClientProvider>
    );
    expect(container.querySelector('#workspace-create')).toBeTruthy();
    expect(container.querySelector('#workspaces-list')).toBeTruthy();
  });
});
