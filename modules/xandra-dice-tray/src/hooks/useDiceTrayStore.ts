import { useStore } from 'zustand';
import type { DiceTrayState, DiceTrayStore } from '../types';

const useDiceTrayStore = <T>(
  store: DiceTrayStore,
  selector: (state: DiceTrayState) => T
): T => useStore(store, selector);

export default useDiceTrayStore;
