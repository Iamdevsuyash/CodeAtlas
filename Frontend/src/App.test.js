import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/DependencyGraph', () => () => null);

beforeEach(() => {
  // Keep the smoke test offline: TrendingSection fetches on mount.
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
});

test('renders CodeAtlas workspace', async () => {
  render(<App />);
  expect(screen.getAllByText(/CodeAtlas/i).length).toBeGreaterThan(0);
  expect(await screen.findByText('No repositories found')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/trending'),
    expect.anything()
  );
});
