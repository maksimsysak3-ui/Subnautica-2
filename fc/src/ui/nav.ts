import { useSyncExternalStore } from 'react';

export type Route =
  | { s: 'hub' } | { s: 'squad' } | { s: 'player'; id: number } | { s: 'tactics' } | { s: 'transfers'; tab?: string }
  | { s: 'fixtures' } | { s: 'comps'; id?: string } | { s: 'club'; id?: string } | { s: 'stats' } | { s: 'inbox' }
  | { s: 'match'; fx: number } | { s: 'seasonEnd' } | { s: 'sacked' } | { s: 'training' } | { s: 'history' };

let route: Route = { s: 'hub' };
const stack: Route[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
export const go = (r: Route) => { stack.push(route); if (stack.length > 30) stack.shift(); route = r; emit(); window.scrollTo?.(0, 0); };
export const back = () => { route = stack.pop() ?? { s: 'hub' }; emit(); };
export const useRoute = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => route);

// toasts
export interface Toast { id: number; text: string; kind?: 'good' | 'bad' | 'info' }
let toasts: Toast[] = [];
let tid = 1;
const tsubs = new Set<() => void>();
export const toast = (text: string, kind: Toast['kind'] = 'info') => {
  const t = { id: tid++, text, kind };
  toasts = [...toasts, t]; tsubs.forEach(f => f());
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); tsubs.forEach(f => f()); }, 4200);
};
export const useToasts = () => useSyncExternalStore(f => { tsubs.add(f); return () => tsubs.delete(f); }, () => toasts);
