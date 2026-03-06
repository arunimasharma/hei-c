import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { UserProfile, EmotionEntry, CareerEvent, MicroAction, AppSettings, JournalReflection, Goal } from '../types';
import type { LLMActionState } from '../types/llm';
import { generateSuggestedActions } from '../utils/actionGenerator';
import { useClaudeActions } from '../hooks/useClaudeActions';
import { recordActionOutcome, clearMemory } from '../services/memoryManager';

interface AppState {
  user: UserProfile | null;
  emotions: EmotionEntry[];
  events: CareerEvent[];
  actions: MicroAction[];
  reflections: JournalReflection[];
  goals: Goal[];
  settings: AppSettings;
}

type Action =
  | { type: 'SET_USER'; payload: UserProfile }
  | { type: 'UPDATE_USER'; payload: Partial<UserProfile> }
  | { type: 'ADD_EMOTION'; payload: EmotionEntry }
  | { type: 'UPDATE_EMOTION'; payload: { id: string; updates: Partial<EmotionEntry> } }
  | { type: 'DELETE_EMOTION'; payload: string }
  | { type: 'ADD_EVENT'; payload: CareerEvent }
  | { type: 'UPDATE_EVENT'; payload: { id: string; updates: Partial<CareerEvent> } }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SET_ACTIONS'; payload: MicroAction[] }
  | { type: 'COMPLETE_ACTION'; payload: string }
  | { type: 'SKIP_ACTION'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'ADD_REFLECTION'; payload: JournalReflection }
  | { type: 'UPDATE_REFLECTION'; payload: { id: string; updates: Partial<JournalReflection> } }
  | { type: 'ADD_GOAL'; payload: Goal }
  | { type: 'UPDATE_GOAL'; payload: { id: string; updates: Partial<Goal> } }
  | { type: 'DELETE_GOAL'; payload: string }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'CLEAR_ALL' };

const defaultSettings: AppSettings = {
  theme: 'light',
  notifications: true,
  showDemoData: false,
};

const initialState: AppState = {
  user: null,
  emotions: [],
  events: [],
  actions: [],
  reflections: [],
  goals: [],
  settings: defaultSettings,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'UPDATE_USER':
      return { ...state, user: state.user ? { ...state.user, ...action.payload } : null };
    case 'ADD_EMOTION':
      return { ...state, emotions: [action.payload, ...state.emotions] };
    case 'UPDATE_EMOTION':
      return {
        ...state,
        emotions: state.emotions.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload.updates } : e
        ),
      };
    case 'DELETE_EMOTION':
      return { ...state, emotions: state.emotions.filter(e => e.id !== action.payload) };
    case 'ADD_EVENT':
      return { ...state, events: [action.payload, ...state.events] };
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload.updates } : e
        ),
      };
    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter(e => e.id !== action.payload) };
    case 'SET_ACTIONS':
      return { ...state, actions: action.payload };
    case 'COMPLETE_ACTION':
      return {
        ...state,
        actions: state.actions.map(a =>
          a.id === action.payload ? { ...a, completed: true, completedAt: new Date().toISOString() } : a
        ),
      };
    case 'SKIP_ACTION':
      return {
        ...state,
        actions: state.actions.map(a =>
          a.id === action.payload ? { ...a, skipped: true } : a
        ),
      };
    case 'ADD_REFLECTION':
      return { ...state, reflections: [action.payload, ...state.reflections] };
    case 'UPDATE_REFLECTION':
      return {
        ...state,
        reflections: state.reflections.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload.updates } : r
        ),
      };
    case 'ADD_GOAL':
      return { ...state, goals: [action.payload, ...state.goals] };
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g =>
          g.id === action.payload.id ? { ...g, ...action.payload.updates } : g
        ),
      };
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addEmotion: (entry: EmotionEntry) => void;
  updateEmotion: (id: string, updates: Partial<EmotionEntry>) => void;
  deleteEmotion: (id: string) => void;
  addEvent: (event: CareerEvent) => void;
  updateEvent: (id: string, updates: Partial<CareerEvent>) => void;
  deleteEvent: (id: string) => void;
  completeAction: (id: string) => void;
  skipAction: (id: string) => void;
  dismissAction: (id: string) => void;
  refreshActions: () => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addReflection: (reflection: JournalReflection) => void;
  updateReflection: (id: string, updates: Partial<JournalReflection>) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  clearAllData: () => void;
  logout: () => void;
  llmState: LLMActionState;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  user: 'eicos_user_profile',
  emotions: 'eicos_emotions',
  events: 'eicos_events',
  actions: 'eicos_actions',
  reflections: 'eicos_reflections',
  goals: 'eicos_goals',
  settings: 'eicos_settings',
};


function loadFromStorage(): Partial<AppState> {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.user);
    const emotions = localStorage.getItem(STORAGE_KEYS.emotions);
    const events = localStorage.getItem(STORAGE_KEYS.events);
    const actions = localStorage.getItem(STORAGE_KEYS.actions);
    const reflections = localStorage.getItem(STORAGE_KEYS.reflections);
    const goals = localStorage.getItem(STORAGE_KEYS.goals);
    const settings = localStorage.getItem(STORAGE_KEYS.settings);

    return {
      user: user ? JSON.parse(user) : null,
      emotions: emotions ? JSON.parse(emotions) : [],
      events: events ? JSON.parse(events) : [],
      actions: actions ? JSON.parse(actions) : [],
      reflections: reflections ? JSON.parse(reflections) : [],
      goals: goals ? JSON.parse(goals) : [],
      settings: settings ? { ...defaultSettings, ...JSON.parse(settings) } : defaultSettings,
    };
  } catch {
    console.warn('Failed to load data from localStorage');
    return {};
  }
}

function saveToStorage(state: AppState) {
  try {
    if (state.user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
    localStorage.setItem(STORAGE_KEYS.emotions, JSON.stringify(state.emotions));
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.actions, JSON.stringify(state.actions));
    localStorage.setItem(STORAGE_KEYS.reflections, JSON.stringify(state.reflections));
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(state.goals));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  } catch {
    console.warn('Failed to save data to localStorage');
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { llmState, generateActions } = useClaudeActions();

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved.user || (saved.emotions && saved.emotions.length > 0)) {
      dispatch({ type: 'LOAD_STATE', payload: saved });
    }
  }, []);

  useEffect(() => {
    if (state.user) {
      saveToStorage(state);
    }
  }, [state]);

  const addEmotion = (entry: EmotionEntry) => dispatch({ type: 'ADD_EMOTION', payload: entry });
  const updateEmotion = (id: string, updates: Partial<EmotionEntry>) => dispatch({ type: 'UPDATE_EMOTION', payload: { id, updates } });
  const deleteEmotion = (id: string) => dispatch({ type: 'DELETE_EMOTION', payload: id });
  const addEvent = (event: CareerEvent) => dispatch({ type: 'ADD_EVENT', payload: event });
  const updateEvent = (id: string, updates: Partial<CareerEvent>) => dispatch({ type: 'UPDATE_EVENT', payload: { id, updates } });
  const deleteEvent = (id: string) => dispatch({ type: 'DELETE_EVENT', payload: id });

  const completeAction = (id: string) => {
    const action = state.actions.find(a => a.id === id);
    if (action) recordActionOutcome(action, true, state.emotions);
    dispatch({ type: 'COMPLETE_ACTION', payload: id });
  };

  const skipAction = (id: string) => {
    const action = state.actions.find(a => a.id === id);
    if (action) recordActionOutcome(action, false, state.emotions);
    dispatch({ type: 'SKIP_ACTION', payload: id });
  };

  // Dismiss for now — hides from view without recording to memory (may suggest again)
  const dismissAction = (id: string) => {
    dispatch({ type: 'SKIP_ACTION', payload: id });
  };

  const refreshActions = useCallback(() => {
    if (!state.user) {
      const suggested = generateSuggestedActions(state.emotions, state.actions, state.goals);
      const completed = state.actions.filter(a => a.completed);
      dispatch({ type: 'SET_ACTIONS', payload: [...suggested, ...completed] });
      return;
    }

    generateActions(state.user, state.emotions, state.events, state.actions, state.goals)
      .then(suggested => {
        const completed = state.actions.filter(a => a.completed);
        dispatch({ type: 'SET_ACTIONS', payload: [...suggested, ...completed] });
      });
  }, [state.user, state.emotions, state.events, state.actions, state.goals, generateActions]);

  // Auto-refresh when a new emotion is logged and active actions are running low
  const prevEmotionCountRef = useRef(state.emotions.length);
  useEffect(() => {
    const prev = prevEmotionCountRef.current;
    const curr = state.emotions.length;
    prevEmotionCountRef.current = curr;
    if (curr > prev) {
      const activeCount = state.actions.filter(a => !a.completed && !a.skipped).length;
      if (activeCount < 2) {
        const timer = setTimeout(() => refreshActions(), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [state.emotions.length, refreshActions]);

  const addReflection = (reflection: JournalReflection) => dispatch({ type: 'ADD_REFLECTION', payload: reflection });
  const updateReflection = (id: string, updates: Partial<JournalReflection>) => dispatch({ type: 'UPDATE_REFLECTION', payload: { id, updates } });

  const addGoal = (goal: Goal) => dispatch({ type: 'ADD_GOAL', payload: goal });
  const updateGoal = (id: string, updates: Partial<Goal>) => dispatch({ type: 'UPDATE_GOAL', payload: { id, updates } });
  const deleteGoal = (id: string) => dispatch({ type: 'DELETE_GOAL', payload: id });

  const updateUserProfile = (updates: Partial<UserProfile>) => dispatch({ type: 'UPDATE_USER', payload: updates });
  const updateSettings = (updates: Partial<AppSettings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates });

  const clearAllData = () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    clearMemory();
    dispatch({ type: 'CLEAR_ALL' });
  };

  const logout = () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    clearMemory();
    dispatch({ type: 'CLEAR_ALL' });
  };

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      addEmotion,
      updateEmotion,
      deleteEmotion,
      addEvent,
      updateEvent,
      deleteEvent,
      completeAction,
      skipAction,
      dismissAction,
      refreshActions,
      updateUserProfile,
      updateSettings,
      addReflection,
      updateReflection,
      addGoal,
      updateGoal,
      deleteGoal,
      clearAllData,
      logout,
      llmState,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
