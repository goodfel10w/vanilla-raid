import type { RoleName, DayName } from '@/lib/constants'

export type { RoleName, DayName }

export type WowClassName = 'Druide' | 'Hexenmeister' | 'Jäger' | 'Krieger' | 'Magier' | 'Paladin' | 'Priester' | 'Schamane' | 'Schurke'
export type AvailabilityMap = Record<string, 'yes' | 'tentative'>
export type AvailabilityValue = 'yes' | 'tentative'

export interface Entry {
  id: string
  charName: string
  className: WowClassName
  specs: string[]
  roles: RoleName[]
  availability: AvailabilityMap
  notes: string
  userId?: string
  timestamp: string
}

export interface RaidSignup {
  entryId: string
  charName: string
  className: WowClassName
  spec: string
  role: RoleName
  status: 'confirmed' | 'tentative' | 'declined' | 'bench' | 'accepted' | 'benched'
  offeredSpecs?: string[]
  assignedSpec?: string
  note?: string
  addedBy?: string
  userId?: string
  timestamp?: string
}

export interface Raid {
  id: string
  instance: string
  date: string
  time: string
  maxPlayers: number
  deadline?: string
  locked: boolean
  notes: string
  description: string
  createdBy?: string
  createdByName?: string
  signups: RaidSignup[]
  timestamp: string
}

export interface DkpBalance {
  playerName: string
  className: WowClassName
  balance: number
  lastUpdated: string
}

export interface DkpTransaction {
  id: string
  playerName: string
  type: 'earn' | 'spend' | 'decay' | 'adjust'
  amount: number
  reason: string
  createdBy: string
  timestamp: string
}

export interface DkpConfig {
  roles: Record<string, 'admin' | 'officer'>
  defaultDecayPercent: number
  maxDkpAmount: number
  allowNegativeBalance: boolean
  startingBalance: number
  transactionLimit: number
  reasonMaxLength: number
}

export interface AuthUser {
  token: string
  username: string
  userId: string
  isAdmin?: boolean
  discordLinked?: boolean
  discordUsername?: string
  discordGuildMember?: boolean
  isSiteAdmin?: boolean
}

export interface BnetCharacter {
  name: string
  className: WowClassName
  realm: string
  level: number
}
