import {
  createContext, useContext, useReducer, useEffect,
  useCallback, useRef, useState, type ReactNode,
} from 'react';
import type {
  UserProfile, EmotionEntry, CareerEvent,
  MicroAction, AppSettings, JournalReflection, Goal, TasteExercise,
} from '../types';
import type { LLMActionState } from '../types/llm';
import { generateSuggestedActions } from '../utils/actionGenerator';
import { useClaudeActions } from '../hooks/useClaudeActions';
import { recordActionOutcome, clearMemory } from '../services/memoryManager';
import {
  db, migrateFromLocalStorage,
  dbPut, dbGet, dbGetAll, dbDelete, dbReplaceAll,
  KV_USER, KV_SETTINGS, KV_AI_STATE,
} from '../services/db';
import { evictKeyFromMemory } from '../services/encryptionService';

// ── State ─────────────────────────────────────────────────────────────────────

interface AiState {
  aiUsageCount: number;
  aiUnlocked: boolean;
}

interface AppState {
  user: UserProfile | null;
  emotions: EmotionEntry[];
  events: CareerEvent[];
  actions: MicroAction[];
  reflections: JournalReflection[];
  goals: Goal[];
  tasteExercises: TasteExercise[];
  settings: AppSettings;
  aiUsageCount: number;
  aiUnlocked: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

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
  | { type: 'ADD_TASTE_EXERCISE'; payload: TasteExercise }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'INCREMENT_AI_USAGE' }
  | { type: 'UNLOCK_AI' }
  | { type: 'CLEAR_ALL' };

// ── Defaults ──────────────────────────────────────────────────────────────────

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
  tasteExercises: [],
  settings: defaultSettings,
  aiUsageCount: 0,
  aiUnlocked: false,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

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
          e.id === action.payload.id ? { ...e, ...action.payload.updates } : e,
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
          e.id === action.payload.id ? { ...e, ...action.payload.updates } : e,
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
          a.id === action.payload ? { ...a, completed: true, completedAt: new Date().toISOString() } : a,
        ),
      };
    case 'SKIP_ACTION':
      return {
        ...state,
        actions: state.actions.map(a =>
          a.id === action.payload ? { ...a, skipped: true } : a,
        ),
      };
    case 'ADD_REFLECTION':
      return { ...state, reflections: [action.payload, ...state.reflections] };
    case 'UPDATE_REFLECTION':
      return {
        ...state,
        reflections: state.reflections.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload.updates } : r,
        ),
      };
    case 'ADD_GOAL':
      return { ...state, goals: [action.payload, ...state.goals] };
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g =>
          g.id === action.payload.id ? { ...g, ...action.payload.updates } : g,
        ),
      };
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };
    case 'ADD_TASTE_EXERCISE':
      return { ...state, tasteExercises: [action.payload, ...state.tasteExercises] };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'INCREMENT_AI_USAGE':
      return { ...state, aiUsageCount: state.aiUsageCount + 1 };
    case 'UNLOCK_AI':
      return { ...state, aiUnlocked: true };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

// ── Context type ──────────────────────────────────────────────────────────────

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
  addTasteExercise: (exercise: TasteExercise) => void;
  clearAllData: () => Promise<void>;
  logout: () => Promise<void>;
  llmState: LLMActionState;
  aiGated: boolean;
  checkAndUseAi: () => boolean;
  unlockAi: () => void;
  /** True once the initial Dexie load completes and state is hydrated. */
  dbReady: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── Dexie persistence helpers ─────────────────────────────────────────────────

async function loadFromDexie(): Promise<Partial<AppState>> {
  const [user, settings, aiState, emotions, events, actions, reflections, goals, tasteExercises] =
    await Promise.all([
      dbGet<UserProfile>(db.keyvalue, KV_USER),
      dbGet<AppSettings>(db.keyvalue, KV_SETTINGS),
      dbGet<AiState>(db.keyvalue, KV_AI_STATE),
      dbGetAll<EmotionEntry>(db.emotions),
      dbGetAll<CareerEvent>(db.events),
      dbGetAll<MicroAction>(db.actions),
      dbGetAll<JournalReflection>(db.reflections),
      dbGetAll<Goal>(db.goals),
      dbGetAll<TasteExercise>(db.exercises),
    ]);

  return {
    user: user ?? null,
    settings: settings ? { ...defaultSettings, ...settings } : defaultSettings,
    aiUsageCount: aiState?.aiUsageCount ?? 0,
    aiUnlocked:   aiState?.aiUnlocked   ?? false,
    emotions,
    events,
    actions,
    reflections,
    goals,
    tasteExercises,
  };
}

/** Targeted Dexie write for the specific mutation — avoids full serialisation. */
async function persistMutation(state: AppState, action: Action): Promise<void> {
  try {
    switch (action.type) {
      case 'SET_USER':
      case 'UPDATE_USER':
        if (state.user) await dbPut(db.keyvalue, KV_USER, state.user);
        break;
      case 'UPDATE_SETTINGS':
        await dbPut(db.keyvalue, KV_SETTINGS, state.settings);
        break;
      case 'INCREMENT_AI_USAGE':
      case 'UNLOCK_AI':
        await dbPut(db.keyvalue, KV_AI_STATE, { aiUsageCount: state.aiUsageCount, aiUnlocked: state.aiUnlocked } satisfies AiState);
        break;
      case 'ADD_EMOTION':
        await dbPut(db.emotions, action.payload.id, action.payload);
        break;
      case 'UPDATE_EMOTION': {
        const e = state.emotions.find(x => x.id === action.payload.id);
        if (e) await dbPut(db.emotions, e.id, e);
        break;
      }
      case 'DELETE_EMOTION':
        await dbDelete(db.emotions, action.payload);
        break;
      case 'ADD_EVENT':
        await dbPut(db.events, action.payload.id, action.payload);
        break;
      case 'UPDATE_EVENT': {
        const e = state.events.find(x => x.id === action.payload.id);
        if (e) await dbPut(db.events, e.id, e);
        break;
      }
      case 'DELETE_EVENT':
        await dbDelete(db.events, action.payload);
        break;
      case 'SET_ACTIONS':
        await dbReplaceAll(db.actions, state.actions);
        break;
      case 'COMPLETE_ACTION':
      case 'SKIP_ACTION': {
        const a = state.actions.find(x => x.id === action.payload);
        if (a) await dbPut(db.actions, a.id, a);
        break;
      }
      case 'ADD_REFLECTION':
        await dbPut(db.reflections, action.payload.id, action.payload);
        break;
      case 'UPDATE_REFLECTION': {
        const r = state.reflections.find(x => x.id === action.payload.id);
        if (r) await dbPut(db.reflections, r.id, r);
        break;
      }
      case 'ADD_GOAL':
        await dbPut(db.goals, action.payload.id, action.payload);
        break;
      case 'UPDATE_GOAL': {
        const g = state.goals.find(x => x.id === action.payload.id);
        if (g) await dbPut(db.goals, g.id, g);
        break;
      }
      case 'DELETE_GOAL':
        await dbDelete(db.goals, action.payload);
        break;
      case 'ADD_TASTE_EXERCISE':
        await dbPut(db.exercises, action.payload.id, action.payload);
        break;
      case 'CLEAR_ALL':
        await Promise.all([
          db.keyvalue.clear(), db.emotions.clear(), db.events.clear(),
          db.actions.clear(), db.reflections.clear(), db.goals.clear(), db.exercises.clear(),
        ]);
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn('[HEQ] Dexie persist error', err);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(appReducer, initialState);
  const { llmState, generateActions } = useClaudeActions();
  const [aiGated, setAiGated] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Track the most recent action so the persist effect knows what changed.
  const lastActionRef = useRef<Action | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: Action) => {
    lastActionRef.current = action;
    rawDispatch(action);
  }, []);

  // After every render caused by dispatch, persist the mutation.
  useEffect(() => {
    const action = lastActionRef.current;
    if (!action || !dbReady || action.type === 'LOAD_STATE') return;
    void persistMutation(stateRef.current, action);
  });

  // ── AI gate ───────────────────────────────────────────────────────────────

  const checkAndUseAi = useCallback((): boolean => {
    if (stateRef.current.aiUnlocked) return true;
    if (stateRef.current.aiUsageCount < 5) {
      dispatch({ type: 'INCREMENT_AI_USAGE' });
      return true;
    }
    setAiGated(true);
    return false;
  }, [dispatch]);

  const unlockAi = useCallback(() => {
    dispatch({ type: 'UNLOCK_AI' });
    setAiGated(false);
  }, [dispatch]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      await migrateFromLocalStorage();
      const saved = await loadFromDexie();
      if (cancelled) return;

      if (!saved.user) {
        saved.user = {
          id: `user_${Date.now()}`,
          name: 'Friend',
          role: '',
          onboardingComplete: false,
          createdAt: new Date().toISOString(),
          checkInFrequency: 'as-needed',
        };
        await dbPut(db.keyvalue, KV_USER, saved.user);
      }
      rawDispatch({ type: 'LOAD_STATE', payload: saved });
      setDbReady(true);
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action creators ───────────────────────────────────────────────────────

  const addEmotion       = (entry: EmotionEntry)                           => dispatch({ type: 'ADD_EMOTION', payload: entry });
  const updateEmotion    = (id: string, updates: Partial<EmotionEntry>)    => dispatch({ type: 'UPDATE_EMOTION', payload: { id, updates } });
  const deleteEmotion    = (id: string)                                    => dispatch({ type: 'DELETE_EMOTION', payload: id });
  const addEvent         = (event: CareerEvent)                            => dispatch({ type: 'ADD_EVENT', payload: event });
  const updateEvent      = (id: string, updates: Partial<CareerEvent>)     => dispatch({ type: 'UPDATE_EVENT', payload: { id, updates } });
  const deleteEvent      = (id: string)                                    => dispatch({ type: 'DELETE_EVENT', payload: id });
  const addReflection    = (r: JournalReflection)                          => dispatch({ type: 'ADD_REFLECTION', payload: r });
  const updateReflection = (id: string, updates: Partial<JournalReflection>) => dispatch({ type: 'UPDATE_REFLECTION', payload: { id, updates } });
  const addTasteExercise = (e: TasteExercise)                              => dispatch({ type: 'ADD_TASTE_EXERCISE', payload: e });
  const addGoal          = (g: Goal)                                       => dispatch({ type: 'ADD_GOAL', payload: g });
  const updateGoal       = (id: string, updates: Partial<Goal>)            => dispatch({ type: 'UPDATE_GOAL', payload: { id, updates } });
  const deleteGoal       = (id: string)                                    => dispatch({ type: 'DELETE_GOAL', payload: id });
  const updateUserProfile = (updates: Partial<UserProfile>)                => dispatch({ type: 'UPDATE_USER', payload: updates });
  const updateSettings    = (updates: Partial<AppSettings>)                => dispatch({ type: 'UPDATE_SETTINGS', payload: updates });

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

  const dismissAction = (id: string) => dispatch({ type: 'SKIP_ACTION', payload: id });

  const refreshActions = useCallback(() => {
    if (!checkAndUseAi()) return;
    if (!state.user) {
      const fallback = generateSuggestedActions(state.emotions, state.actions, state.goals);
      dispatch({ type: 'SET_ACTIONS', payload: [...fallback, ...state.actions.filter(a => a.completed)] });
      return;
    }
    void generateActions(state.user, state.emotions, state.events, state.actions, state.goals)
      .then(suggested => {
        dispatch({ type: 'SET_ACTIONS', payload: [...suggested, ...state.actions.filter(a => a.completed)] });
      });
  }, [checkAndUseAi, state, generateActions, dispatch]);

  // Auto-refresh when a new emotion is logged and active actions run low.
  const prevEmotionCountRef = useRef(state.emotions.length);
  useEffect(() => {
    const prev = prevEmotionCountRef.current;
    const curr = state.emotions.length;
    prevEmotionCountRef.current = curr;
    if (curr > prev && state.actions.filter(a => !a.completed && !a.skipped).length < 2) {
      const t = setTimeout(refreshActions, 300);
      return () => clearTimeout(t);
    }
  }, [state.emotions.length, state.actions, refreshActions]);

  const clearAllData = useCallback(async () => {
    dispatch({ type: 'CLEAR_ALL' });
    clearMemory();
    evictKeyFromMemory();
    localStorage.removeItem('heq_migrated_to_idb_v1');
  }, [dispatch]);

  const logout = useCallback(async () => {
    dispatch({ type: 'CLEAR_ALL' });
    clearMemory();
    evictKeyFromMemory();
    localStorage.removeItem('heq_migrated_to_idb_v1');
  }, [dispatch]);

  return (
    <AppContext.Provider value={{
      state, dispatch,
      addEmotion, updateEmotion, deleteEmotion,
      addEvent, updateEvent, deleteEvent,
      completeAction, skipAction, dismissAction, refreshActions,
      updateUserProfile, updateSettings,
      addReflection, updateReflection,
      addGoal, updateGoal, deleteGoal,
      addTasteExercise,
      clearAllData, logout,
      llmState, aiGated, checkAndUseAi, unlockAi,
      dbReady,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
