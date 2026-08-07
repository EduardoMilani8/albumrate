import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  country: text('country'),
  spotifyId: text('spotify_id').unique(),
  spotifyAccessToken: text('spotify_access_token'),
  spotifyRefreshToken: text('spotify_refresh_token'),
  spotifyTokenExpiresAt: timestamp('spotify_token_expires_at', { withTimezone: true }),
  spotifyConnectedAt: timestamp('spotify_connected_at', { withTimezone: true }),
  favoriteGenres: text('favorite_genres').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    albumGenre: text('album_genre'),
    albumYear: integer('album_year'),
    albumCountry: text('album_country'),
    rating: real('rating').notNull(),
    reviewText: text('review_text'),
    listenedAt: date('listened_at', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reviews_user_album_unique').on(table.userId, table.albumId),
    index('reviews_album_idx').on(table.albumId),
    index('reviews_user_idx').on(table.userId),
  ],
)

export const mediaReviews = pgTable(
  'media_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    pressingQualityRating: real('pressing_quality_rating').notNull(),
    editionNote: text('edition_note'),
    condition: text('condition').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('media_reviews_review_unique').on(table.reviewId)],
)

export const listeningLogs = pgTable(
  'listening_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    albumGenre: text('album_genre'),
    albumYear: integer('album_year'),
    albumCountry: text('album_country'),
    listenedAt: date('listened_at', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('listening_logs_user_idx').on(table.userId),
    index('listening_logs_album_idx').on(table.albumId),
  ],
)

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('lists_user_idx').on(table.userId)],
)

export const artists = pgTable('artists', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  country: text('country'),
  source: text('source'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dailyPicks = pgTable(
  'daily_picks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('daily_picks_user_date_unique').on(table.userId, table.date),
    index('daily_picks_user_idx').on(table.userId),
  ],
)

export const listAlbums = pgTable(
  'list_albums',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('list_albums_list_album_unique').on(table.listId, table.albumId),
    index('list_albums_list_position_idx').on(table.listId, table.position),
  ],
)

export const listsRelations = relations(lists, ({ many }) => ({
  albums: many(listAlbums),
}))

export const listAlbumsRelations = relations(listAlbums, ({ one }) => ({
  list: one(lists, {
    fields: [listAlbums.listId],
    references: [lists.id],
  }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  mediaReview: one(mediaReviews, {
    fields: [reviews.id],
    references: [mediaReviews.reviewId],
  }),
}))

export type User = typeof users.$inferSelect
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type MediaReview = typeof mediaReviews.$inferSelect
export type NewMediaReview = typeof mediaReviews.$inferInsert
export type ListeningLog = typeof listeningLogs.$inferSelect
export type NewListeningLog = typeof listeningLogs.$inferInsert
export type AlbumList = typeof lists.$inferSelect
export type NewAlbumList = typeof lists.$inferInsert
export type ListAlbum = typeof listAlbums.$inferSelect
export type NewListAlbum = typeof listAlbums.$inferInsert
export type DailyPick = typeof dailyPicks.$inferSelect
export type NewDailyPick = typeof dailyPicks.$inferInsert
export type Artist = typeof artists.$inferSelect
export type NewArtist = typeof artists.$inferInsert
