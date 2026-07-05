import { create } from "zustand";

export interface CharacterSummary {
  id: string;
  name: string;
  class: "warrior" | "mage" | "archer";
  level: number;
  exp: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  gold: number;
}

interface CharacterState {
  characters: CharacterSummary[];
  activeCharacterId: string | null;
  setCharacters: (chars: CharacterSummary[]) => void;
  setActiveCharacter: (id: string) => void;
  updateActiveCharacter: (patch: Partial<CharacterSummary>) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  characters: [],
  activeCharacterId: null,
  setCharacters: (characters) => set({ characters }),
  setActiveCharacter: (activeCharacterId) => set({ activeCharacterId }),
  updateActiveCharacter: (patch) =>
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === state.activeCharacterId ? { ...c, ...patch } : c
      ),
    })),
}));
