import type { EquityRepository } from './repository'
import { LocalRepository } from './localRepository'
import { TauriRepository } from './tauriRepository'

export function createRepository(): EquityRepository {
  return '__TAURI_INTERNALS__' in window ? new TauriRepository() : new LocalRepository()
}

export type { EquityRepository } from './repository'
