"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { DocumentStoreAction, DocumentStoreState } from "@/types/store";

const initialState: DocumentStoreState = {
  documents: [],
  activeDocumentId: null,
  answersByDocumentId: {},
  interviewProgressByDocumentId: {},
  attachmentByDocumentId: {},
  reviewConfirmedByDocumentId: {},
  reviewPageStateByDocumentId: {},
};

function documentStoreReducer(
  state: DocumentStoreState,
  action: DocumentStoreAction,
): DocumentStoreState {
  switch (action.type) {
    case "SET_DOCUMENTS":
      return { ...state, documents: action.documents };

    case "SET_ACTIVE_DOCUMENT":
      return { ...state, activeDocumentId: action.documentId };

    case "CREATE_DOCUMENT":
      return {
        ...state,
        documents: [action.document, ...state.documents],
        activeDocumentId: action.document.id,
      };

    case "SAVE_ANSWER": {
      const existingAnswers = state.answersByDocumentId[action.documentId] ?? {};
      return {
        ...state,
        answersByDocumentId: {
          ...state.answersByDocumentId,
          [action.documentId]: {
            ...existingAnswers,
            [action.answer.field]: action.answer,
          },
        },
      };
    }

    case "REMOVE_ANSWER": {
      const existingAnswers = state.answersByDocumentId[action.documentId];
      if (!existingAnswers || !(action.field in existingAnswers)) {
        return state;
      }

      const updatedAnswers = { ...existingAnswers };
      delete updatedAnswers[action.field];

      return {
        ...state,
        answersByDocumentId: {
          ...state.answersByDocumentId,
          [action.documentId]: updatedAnswers,
        },
      };
    }

    case "SET_INTERVIEW_PROGRESS":
      return {
        ...state,
        interviewProgressByDocumentId: {
          ...state.interviewProgressByDocumentId,
          [action.documentId]: action.progress,
        },
      };

    case "COMPLETE_INTERVIEW":
      return {
        ...state,
        documents: state.documents.map((document) =>
          document.id === action.documentId
            ? {
                ...document,
                status: "ready-for-review",
                interviewCompleted: true,
                progressPercent: 100,
                nextAction: "review-inputs",
              }
            : document,
        ),
      };

    case "CONFIRM_REVIEW":
      return {
        ...state,
        reviewConfirmedByDocumentId: {
          ...state.reviewConfirmedByDocumentId,
          [action.documentId]: action.confirmed,
        },
      };

    case "SET_REVIEW_STATE":
      return {
        ...state,
        reviewPageStateByDocumentId: {
          ...state.reviewPageStateByDocumentId,
          [action.documentId]: action.state,
        },
      };

    case "UPDATE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.map((document) =>
          document.id === action.documentId
            ? { ...document, ...action.updates }
            : document,
        ),
      };

    case "SET_ATTACHMENT":
      return {
        ...state,
        attachmentByDocumentId: {
          ...state.attachmentByDocumentId,
          [action.documentId]: action.attachment,
        },
      };

    case "REMOVE_ATTACHMENT": {
      const updated = { ...state.attachmentByDocumentId };
      delete updated[action.documentId];
      return { ...state, attachmentByDocumentId: updated };
    }

    default:
      return state;
  }
}

const DocumentStoreContext = createContext<{
  state: DocumentStoreState;
  dispatch: React.Dispatch<DocumentStoreAction>;
  loading: boolean;
} | null>(null);

export function DocumentStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(documentStoreReducer, initialState);
  const [loading, setLoading] = useState(true);
  const value = useMemo(() => ({ state, dispatch, loading }), [state, loading]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/rami/workspace", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          documents?: DocumentStoreState["documents"];
        };
        if (!cancelled && data.ok && Array.isArray(data.documents)) {
          dispatch({ type: "SET_DOCUMENTS", documents: data.documents });
        }
      } catch {
        /* workspace unavailable — empty state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DocumentStoreContext.Provider value={value}>
      {children}
    </DocumentStoreContext.Provider>
  );
}

export function useDocumentStoreContext() {
  const context = useContext(DocumentStoreContext);

  if (!context) {
    throw new Error("useDocumentStoreContext must be used within DocumentStoreProvider");
  }

  return context;
}
