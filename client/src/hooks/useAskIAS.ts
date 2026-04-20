import { useCallback } from 'react';
import axios from 'axios';
import { useAskIASStore } from '../store/askIASStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Ask IAS — chat orchestration hook.
 *
 * Drives a single askQuestion flow:
 *   1. Append a user turn with the question text
 *   2. Append an assistant turn in loading state
 *   3. POST /ai/ask with the full prior history (user/assistant string pairs)
 *   4. Resolve the assistant turn with parsed response or error
 *
 * Also exposes retryTurn(id) which undoes a failed exchange and re-asks.
 */

export interface UseAskIAS {
  askQuestion: (question: string) => Promise<void>;
  /** Retry a failed assistant turn: removes the failed exchange and re-asks
   *  with the same question. Safe to call only on assistant turns that have
   *  `error` set. */
  retryTurn: (assistantTurnId: string) => Promise<void>;
}

export function useAskIAS(): UseAskIAS {
  const askQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const store = useAskIASStore.getState();

    // Build the history payload from prior COMPLETED turns.
    const priorHistory = store.history
      .filter(t => {
        if (t.role === 'user') return true;
        return t.role === 'assistant' && !t.loading && !t.error && t.content;
      })
      .map(t => ({ role: t.role, content: t.content }));

    store.appendUserTurn(trimmed);
    const assistantTurnId = store.startAssistantTurn();

    try {
      const { data } = await axios.post(
        `${API}/ai/ask`,
        { question: trimmed, history: priorHistory },
        { timeout: 30_000 }
      );

      if (!data?.success) {
        throw new Error(data?.error || 'Request failed');
      }

      const response = data.data;
      const rawContent = JSON.stringify({
        format: response.format,
        content: response.content,
      });

      useAskIASStore.getState().completeAssistantTurn(assistantTurnId, rawContent, response);
    } catch (err: any) {
      // Distinguish network/timeout errors from server errors so the user
      // gets a useful message instead of a generic 500.
      let msg: string;
      if (err?.code === 'ECONNABORTED') {
        msg = 'The request timed out. Check your connection and try again.';
      } else if (!err?.response) {
        msg = 'Network error. Check your connection and try again.';
      } else if (err.response.status >= 500) {
        msg = 'The AI service is having trouble. Try again in a moment.';
      } else if (err.response.status === 401 || err.response.status === 403) {
        msg = 'Your session expired. Refresh the page and sign in again.';
      } else {
        msg = err.response?.data?.error || err.message || 'Something went wrong';
      }
      useAskIASStore.getState().failAssistantTurn(assistantTurnId, msg);
    }
  }, []);

  const retryTurn = useCallback(async (assistantTurnId: string) => {
    const result = useAskIASStore.getState().retryTruncate(assistantTurnId);
    if (!result) return;
    await askQuestion(result.question);
  }, [askQuestion]);

  return { askQuestion, retryTurn };
}
