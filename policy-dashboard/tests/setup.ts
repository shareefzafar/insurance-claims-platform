import '@testing-library/jest-dom';

// Suppress console.warn in tests (e.g. React act() warnings)
global.console.warn = jest.fn();

// Mock fetch globally — unit tests should not make real HTTP calls
global.fetch = jest.fn();

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem:    jest.fn(),
    setItem:    jest.fn(),
    removeItem: jest.fn(),
    clear:      jest.fn(),
  },
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
