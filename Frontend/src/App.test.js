import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/DependencyGraph', () => () => null);

test('renders CodeAtlas workspace', () => {
  render(<App />);
  expect(screen.getAllByText(/CodeAtlas/i).length).toBeGreaterThan(0);
});
