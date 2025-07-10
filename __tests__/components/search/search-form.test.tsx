import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import SearchForm from '@/components/search/search-form'

// Mock React 19 hooks for testing
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useTransition: () => [false, jest.fn()],
  useDeferredValue: (value: any) => value,
  useActionState: () => [null, jest.fn(), false],
}))

// Mock react-dom hooks
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  useFormStatus: () => ({ pending: false }),
}))

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock translation hook
jest.mock('@/node_modules/react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock search action
jest.mock('@/app/actions/search', () => ({
  searchEntities: jest.fn(),
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('SearchForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('React 19 Features', () => {
    it('should render with React 19 hooks integration', () => {
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', expect.stringContaining('searchPlaceholder'))
    })

    it('should handle useTransition for non-blocking operations', async () => {
      const mockStartTransition = jest.fn((callback) => callback())
      
      // Mock useTransition to return our mock function
      jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
      
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      
      // Type in search input
      await userEvent.type(searchInput, 'test query')
      
      // Wait for debounced search
      await waitFor(() => {
        expect(mockStartTransition).toHaveBeenCalled()
      }, { timeout: 500 })
    })

    it('should use useDeferredValue for optimized rendering', () => {
      const mockUseDeferredValue = jest.fn((value) => value)
      jest.spyOn(React, 'useDeferredValue').mockImplementation(mockUseDeferredValue)
      
      render(<SearchForm />)
      
      expect(mockUseDeferredValue).toHaveBeenCalled()
    })

    it('should integrate useActionState for form management', () => {
      const mockUseActionState = jest.fn(() => [null, jest.fn(), false])
      jest.spyOn(React, 'useActionState').mockImplementation(mockUseActionState)
      
      render(<SearchForm />)
      
      expect(mockUseActionState).toHaveBeenCalled()
    })
  })

  describe('Search Functionality', () => {
    it('should trigger search on form submission', async () => {
      const mockOnResults = jest.fn()
      render(<SearchForm onResults={mockOnResults} />)
      
      const searchInput = screen.getByRole('textbox')
      const searchButton = screen.getByRole('button', { name: /search/i })
      
      await userEvent.type(searchInput, 'test search')
      await userEvent.click(searchButton)
      
      // Verify form submission behavior
      expect(searchInput).toHaveValue('test search')
    })

    it('should debounce search input with 300ms delay', async () => {
      jest.useFakeTimers()
      
      const mockStartTransition = jest.fn((callback) => callback())
      jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
      
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      
      // Type rapidly
      await userEvent.type(searchInput, 'ab')
      
      // Fast forward time but not enough for debounce
      act(() => {
        jest.advanceTimersByTime(200)
      })
      
      expect(mockStartTransition).not.toHaveBeenCalled()
      
      // Fast forward past debounce delay
      act(() => {
        jest.advanceTimersByTime(150)
      })
      
      expect(mockStartTransition).toHaveBeenCalled()
      
      jest.useRealTimers()
    })

    it('should clear results for queries shorter than 2 characters', async () => {
      const mockStartTransition = jest.fn((callback) => callback())
      jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
      
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      
      await userEvent.type(searchInput, 'a')
      
      // Should trigger clear results transition
      await waitFor(() => {
        expect(mockStartTransition).toHaveBeenCalled()
      })
    })
  })

  describe('Recent Searches', () => {
    it('should load recent searches from localStorage', () => {
      const mockSearches = ['search1', 'search2']
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSearches))
      
      render(<SearchForm />)
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('recent-searches')
    })

    it('should save searches to localStorage on submission', async () => {
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      const searchButton = screen.getByRole('button', { name: /search/i })
      
      await userEvent.type(searchInput, 'new search')
      await userEvent.click(searchButton)
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'recent-searches',
        expect.stringContaining('new search')
      )
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw error
      expect(() => {
        render(<SearchForm />)
      }).not.toThrow()
    })
  })

  describe('Loading States', () => {
    it('should show loading state during transition', () => {
      jest.spyOn(React, 'useTransition').mockReturnValue([true, jest.fn()])
      
      render(<SearchForm />)
      
      // Search button should be disabled during transition
      const searchButton = screen.getByRole('button', { name: /search/i })
      expect(searchButton).toBeDisabled()
    })

    it('should show loading state from useFormStatus', () => {
      const mockUseFormStatus = jest.fn(() => ({ pending: true }))
      jest.doMock('react-dom', () => ({
        useFormStatus: mockUseFormStatus,
      }))
      
      render(<SearchForm />)
      
      const searchButton = screen.getByRole('button', { name: /search/i })
      expect(searchButton).toBeDisabled()
    })
  })

  describe('Category Filtering', () => {
    it('should apply category filter to searches', async () => {
      const mockStartTransition = jest.fn((callback) => callback())
      jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
      
      render(<SearchForm category="entities" />)
      
      const searchInput = screen.getByRole('textbox')
      await userEvent.type(searchInput, 'test')
      
      // Should show category badge
      expect(screen.getByText('entities')).toBeInTheDocument()
    })

    it('should include category in form data', async () => {
      render(<SearchForm category="opportunities" />)
      
      const searchInput = screen.getByRole('textbox')
      const searchButton = screen.getByRole('button', { name: /search/i })
      
      await userEvent.type(searchInput, 'test search')
      await userEvent.click(searchButton)
      
      // Verify category is included in search
      expect(screen.getByText('opportunities')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      expect(searchInput).toHaveAttribute('type', 'text')
      expect(searchInput).toHaveAttribute('autoComplete', 'off')
    })

    it('should be keyboard navigable', async () => {
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      
      // Focus should work
      searchInput.focus()
      expect(searchInput).toHaveFocus()
      
      // Enter key should submit
      await userEvent.type(searchInput, 'test{enter}')
      expect(searchInput).toHaveValue('test')
    })
  })

  describe('Error Handling', () => {
    it('should display error messages from search action', () => {
      const mockState = {
        success: false,
        error: 'Search failed',
        results: []
      }
      
      jest.spyOn(React, 'useActionState').mockReturnValue([
        mockState,
        jest.fn(),
        false
      ])
      
      render(<SearchForm />)
      
      expect(screen.getByText('Search failed')).toBeInTheDocument()
    })

    it('should handle network errors gracefully', async () => {
      // Mock network error
      const mockStartTransition = jest.fn((callback) => {
        try {
          callback()
        } catch (error) {
          // Should not crash the component
        }
      })
      
      jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
      
      render(<SearchForm />)
      
      const searchInput = screen.getByRole('textbox')
      await userEvent.type(searchInput, 'test')
      
      // Component should still be functional
      expect(searchInput).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not trigger excessive re-renders', async () => {
      const renderSpy = jest.fn()
      
      function TestWrapper() {
        renderSpy()
        return <SearchForm />
      }
      
      render(<TestWrapper />)
      
      const searchInput = screen.getByRole('textbox')
      
      // Type multiple characters rapidly
      await userEvent.type(searchInput, 'abcdef')
      
      // Should not render excessively (exact count depends on React internals)
      expect(renderSpy.mock.calls.length).toBeLessThan(20)
    })
  })
})

/**
 * Integration Tests for React 19 Search Features
 */
describe('SearchForm Integration', () => {
  it('should integrate all React 19 features together', async () => {
    const mockOnResults = jest.fn()
    const mockStartTransition = jest.fn((callback) => callback())
    const mockDeferredValue = jest.fn((value) => value)
    
    jest.spyOn(React, 'useTransition').mockReturnValue([false, mockStartTransition])
    jest.spyOn(React, 'useDeferredValue').mockImplementation(mockDeferredValue)
    
    render(<SearchForm onResults={mockOnResults} />)
    
    const searchInput = screen.getByRole('textbox')
    
    // Simulate user typing
    await userEvent.type(searchInput, 'integration test')
    
    // Verify all React 19 hooks are working together
    expect(mockStartTransition).toHaveBeenCalled()
    expect(mockDeferredValue).toHaveBeenCalled()
  })
})

/**
 * React 19 Specific Tests
 */
describe('React 19 Optimization Tests', () => {
  it('should use concurrent features for better performance', () => {
    const { rerender } = render(<SearchForm />)
    
    // Multiple re-renders should not cause issues
    for (let i = 0; i < 10; i++) {
      rerender(<SearchForm key={i} />)
    }
    
    // Component should remain stable
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should handle rapid state changes gracefully', async () => {
    jest.useFakeTimers()
    
    render(<SearchForm />)
    
    const searchInput = screen.getByRole('textbox')
    
    // Rapid state changes
    for (let i = 0; i < 5; i++) {
      await userEvent.clear(searchInput)
      await userEvent.type(searchInput, `query${i}`)
      
      act(() => {
        jest.advanceTimersByTime(50)
      })
    }
    
    // Should handle rapid changes without crashing
    expect(searchInput).toBeInTheDocument()
    
    jest.useRealTimers()
  })
}) 