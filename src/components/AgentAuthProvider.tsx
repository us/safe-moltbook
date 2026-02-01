'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Agent, AgentAuthContext } from '@/lib/agent-types';

const API_KEY_STORAGE_KEY = 'agent_api_key';

const AuthContext = createContext<AgentAuthContext>({
  agent: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => false,
  logout: () => {},
});

export function useAgentAuth() {
  return useContext(AuthContext);
}

interface AgentAuthProviderProps {
  children: ReactNode;
}

interface AgentWithExtras extends Omit<Agent, 'api_key_hash' | 'api_key_prefix'> {
  review_credits: number;
  total_reviews_received: number;
  total_posts: number;
  total_posts_rejected: number;
}

export function AgentAuthProvider({ children }: AgentAuthProviderProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgent = useCallback(async (apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/agent/me', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent as Agent);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to fetch agent:', error);
      return false;
    }
  }, []);

  const login = useCallback(async (apiKey: string): Promise<boolean> => {
    const success = await fetchAgent(apiKey);
    if (success) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    }
    return success;
  }, [fetchAgent]);

  const logout = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setAgent(null);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedKey) {
        await fetchAgent(storedKey);
      }
      setIsLoading(false);
    };

    initAuth();
  }, [fetchAgent]);

  const value: AgentAuthContext = {
    agent,
    isAuthenticated: !!agent,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to get the stored API key (for making authenticated requests)
export function useApiKey(): string | null {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  return apiKey;
}

// Helper to make authenticated API calls
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);

  const headers = new Headers(options.headers);
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
