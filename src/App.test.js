import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Face Recognition App title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Face Recognition App/i);
  expect(titleElement).toBeInTheDocument();
});

test('shows loading state initially', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Loading models/i);
  expect(loadingElement).toBeInTheDocument();
});