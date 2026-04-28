import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull()
})

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull()
})

export const tabs = sqliteTable('tabs', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().default('default'),
  url: text('url').notNull(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull()
})

export const history = sqliteTable('history', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().default('default'),
  url: text('url').notNull(),
  title: text('title').notNull(),
  visitedAt: integer('visited_at').notNull()
})

export const extensions = sqliteTable('extensions', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  path: text('path').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  installedAt: integer('installed_at').notNull()
})
