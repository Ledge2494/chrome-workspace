import Popup from '@src/popup/Popup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initElement } from '@src/main';

const queryClient = new QueryClient();

initElement(
  <QueryClientProvider client={queryClient}>
    <Popup />
  </QueryClientProvider>
);
