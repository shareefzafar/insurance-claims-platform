import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem:    jest.fn(() => null),
    setItem:    jest.fn(),
    removeItem: jest.fn(),
    clear:      jest.fn(),
  },
});

afterEach(() => jest.clearAllMocks());
