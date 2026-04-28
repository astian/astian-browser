import { eq, and, desc, like, or } from 'drizzle-orm'
import type { BookmarkEntry, BrowserProfile, BrowserSpace, HistoryEntry, InstalledExtension } from '../../shared/ipc'
import { getDb } from './client'
import * as schema from './schema'

const MAX_HISTORY_ENTRIES = 1000

// ── Profiles ─────────────────────────────────────────────────────────────────

export function dbGetProfiles(): BrowserProfile[] {
  return getDb()
    .select()
    .from(schema.profiles)
    .all()
    .map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt }))
}

export function dbUpsertProfile(profile: BrowserProfile): void {
  getDb()
    .insert(schema.profiles)
    .values({ id: profile.id, name: profile.name, createdAt: profile.createdAt })
    .onConflictDoUpdate({ target: schema.profiles.id, set: { name: profile.name } })
    .run()
}

export function dbDeleteProfile(id: string): void {
  getDb().delete(schema.profiles).where(eq(schema.profiles.id, id)).run()
}

// ── Spaces ────────────────────────────────────────────────────────────────────

export function dbGetSpaces(): BrowserSpace[] {
  return getDb()
    .select()
    .from(schema.spaces)
    .all()
    .map((row) => ({ id: row.id, profileId: row.profileId, name: row.name, createdAt: row.createdAt }))
}

export function dbUpsertSpace(space: BrowserSpace): void {
  getDb()
    .insert(schema.spaces)
    .values({ id: space.id, profileId: space.profileId, name: space.name, createdAt: space.createdAt })
    .onConflictDoUpdate({ target: schema.spaces.id, set: { name: space.name } })
    .run()
}

export function dbDeleteSpace(id: string): void {
  getDb().delete(schema.spaces).where(eq(schema.spaces.id, id)).run()
}

// ── History ───────────────────────────────────────────────────────────────────

export function dbGetHistory(profileId: string, query?: string): HistoryEntry[] {
  const db = getDb()

  if (query && query.trim()) {
    const pattern = `%${query.trim()}%`
    return db
      .select()
      .from(schema.history)
      .where(
        and(
          eq(schema.history.profileId, profileId),
          or(like(schema.history.title, pattern), like(schema.history.url, pattern))
        )
      )
      .orderBy(desc(schema.history.visitedAt))
      .limit(MAX_HISTORY_ENTRIES)
      .all()
      .map((row) => ({ id: row.id, url: row.url, title: row.title, visitedAt: row.visitedAt }))
  }

  return db
    .select()
    .from(schema.history)
    .where(eq(schema.history.profileId, profileId))
    .orderBy(desc(schema.history.visitedAt))
    .limit(MAX_HISTORY_ENTRIES)
    .all()
    .map((row) => ({ id: row.id, url: row.url, title: row.title, visitedAt: row.visitedAt }))
}

export function dbAddHistoryEntry(entry: HistoryEntry, profileId: string): void {
  const db = getDb()
  db.insert(schema.history)
    .values({ id: entry.id, profileId, url: entry.url, title: entry.title, visitedAt: entry.visitedAt })
    .run()

  // Prune excess entries beyond limit
  const rows = db
    .select({ id: schema.history.id })
    .from(schema.history)
    .where(eq(schema.history.profileId, profileId))
    .orderBy(desc(schema.history.visitedAt))
    .limit(MAX_HISTORY_ENTRIES + 500)
    .all()

  const rowsToDelete = rows.slice(MAX_HISTORY_ENTRIES)
  if (rowsToDelete.length > 0) {
    for (const row of rowsToDelete) {
      db.delete(schema.history).where(eq(schema.history.id, row.id)).run()
    }
  }
}

export function dbDeleteHistoryEntry(id: string): void {
  getDb().delete(schema.history).where(eq(schema.history.id, id)).run()
}

export function dbClearHistory(profileId: string): void {
  getDb().delete(schema.history).where(eq(schema.history.profileId, profileId)).run()
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export function dbGetBookmarks(profileId: string, query?: string): BookmarkEntry[] {
  const db = getDb()

  if (query && query.trim()) {
    const pattern = `%${query.trim()}%`
    return db
      .select()
      .from(schema.bookmarks)
      .where(
        and(
          eq(schema.bookmarks.profileId, profileId),
          or(like(schema.bookmarks.title, pattern), like(schema.bookmarks.url, pattern))
        )
      )
      .orderBy(desc(schema.bookmarks.createdAt))
      .all()
      .map((row) => ({ id: row.id, url: row.url, title: row.title, createdAt: row.createdAt }))
  }

  return db
    .select()
    .from(schema.bookmarks)
    .where(eq(schema.bookmarks.profileId, profileId))
    .orderBy(desc(schema.bookmarks.createdAt))
    .all()
    .map((row) => ({ id: row.id, url: row.url, title: row.title, createdAt: row.createdAt }))
}

export function dbUpsertBookmark(entry: BookmarkEntry, profileId: string): void {
  getDb()
    .insert(schema.bookmarks)
    .values({ id: entry.id, profileId, url: entry.url, title: entry.title, createdAt: entry.createdAt })
    .onConflictDoUpdate({
      target: schema.bookmarks.id,
      set: { url: entry.url, title: entry.title }
    })
    .run()
}

export function dbDeleteBookmark(id: string): void {
  getDb().delete(schema.bookmarks).where(eq(schema.bookmarks.id, id)).run()
}

// ── Extensions ────────────────────────────────────────────────────────────────

export function dbGetExtensions(profileId: string): InstalledExtension[] {
  return getDb()
    .select()
    .from(schema.extensions)
    .where(eq(schema.extensions.profileId, profileId))
    .all()
    .map((row) => ({
      id: row.id,
      profileId: row.profileId,
      name: row.name,
      version: row.version,
      path: row.path,
      enabled: row.enabled ?? true,
      installedAt: row.installedAt
    }))
}

export function dbUpsertExtension(ext: InstalledExtension): void {
  getDb()
    .insert(schema.extensions)
    .values({
      id: ext.id,
      profileId: ext.profileId,
      name: ext.name,
      version: ext.version,
      path: ext.path,
      enabled: ext.enabled,
      installedAt: ext.installedAt ?? Date.now()
    })
    .onConflictDoUpdate({
      target: schema.extensions.id,
      set: { name: ext.name, version: ext.version, path: ext.path, enabled: ext.enabled }
    })
    .run()
}

export function dbSetExtensionEnabled(id: string, enabled: boolean): void {
  getDb()
    .update(schema.extensions)
    .set({ enabled })
    .where(eq(schema.extensions.id, id))
    .run()
}

export function dbDeleteExtension(id: string): void {
  getDb().delete(schema.extensions).where(eq(schema.extensions.id, id)).run()
}

// ── One-time migration from state.json ───────────────────────────────────────

interface LegacyState {
  profiles?: Array<{ id: string; name: string; createdAt?: number }>
  spaces?: Array<{ id: string; profileId: string; name: string; createdAt?: number }>
  history?: Array<{ id: string; url: string; title?: string; visitedAt?: number }>
  bookmarks?: Array<{ id: string; url: string; title?: string; createdAt?: number }>
  extensions?: Array<{ id: string; name: string; version: string; path: string }>
  activeProfileId?: string
}

export function migrateFromStateJsonIfNeeded(statePath: string): void {
  const db = getDb()

  // Only migrate if profiles table is empty (fresh DB)
  const profileCount = db.select({ id: schema.profiles.id }).from(schema.profiles).limit(1).all()
  if (profileCount.length > 0) {
    return
  }

  let raw: string
  try {
    const { readFileSync } = require('node:fs')
    raw = readFileSync(statePath, 'utf-8')
  } catch {
    return // No state.json to migrate from
  }

  let legacyState: LegacyState
  try {
    legacyState = JSON.parse(raw) as LegacyState
  } catch {
    return
  }

  const profileId = legacyState.activeProfileId ?? 'default'

  // Migrate profiles
  const profiles = legacyState.profiles ?? [{ id: 'default', name: 'Default', createdAt: Date.now() }]
  for (const p of profiles) {
    dbUpsertProfile({ id: p.id, name: p.name, createdAt: p.createdAt ?? Date.now() })
  }

  // Migrate spaces
  const spaces = legacyState.spaces ?? []
  for (const s of spaces) {
    dbUpsertSpace({ id: s.id, profileId: s.profileId, name: s.name, createdAt: s.createdAt ?? Date.now() })
  }

  // Migrate history
  const history = legacyState.history ?? []
  for (const h of history) {
    dbAddHistoryEntry(
      { id: h.id, url: h.url, title: h.title ?? h.url, visitedAt: h.visitedAt ?? Date.now() },
      profileId
    )
  }

  // Migrate bookmarks
  const bookmarks = legacyState.bookmarks ?? []
  for (const b of bookmarks) {
    dbUpsertBookmark(
      { id: b.id, url: b.url, title: b.title ?? b.url, createdAt: b.createdAt ?? Date.now() },
      profileId
    )
  }
}
