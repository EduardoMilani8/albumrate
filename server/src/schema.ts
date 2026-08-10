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
  isAdmin: boolean('is_admin').notNull().default(false),
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

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_follower_following_unique').on(table.followerId, table.followingId),
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
  ],
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

export const albumOfMonth = pgTable(
  'album_of_month',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    votes: integer('votes'),
    position: integer('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('album_of_month_month_year_unique').on(table.month, table.year)],
)

export const monthlyVotes = pgTable(
  'monthly_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    revealAt: timestamp('reveal_at', { withTimezone: true }).notNull(),
    candidatesGeneratedAt: timestamp('candidates_generated_at', { withTimezone: true }),
    tabulatedAt: timestamp('tabulated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('monthly_votes_month_year_unique').on(table.month, table.year)],
)

export const monthlyVoteCandidates = pgTable(
  'monthly_vote_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    voteId: uuid('vote_id')
      .notNull()
      .references(() => monthlyVotes.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    albumTitle: text('album_title').notNull(),
    albumArtist: text('album_artist').notNull(),
    albumArtworkUrl: text('album_artwork_url'),
    reviewCount: integer('review_count').notNull(),
    latestReviewAt: timestamp('latest_review_at', { withTimezone: true }).notNull(),
    averageRating: real('average_rating'),
    position: integer('position').notNull(),
    finalVotes: integer('final_votes'),
    finalRanking: integer('final_ranking'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('monthly_vote_candidates_vote_album_unique').on(table.voteId, table.albumId),
    index('monthly_vote_candidates_vote_idx').on(table.voteId),
  ],
)

export const monthlyVoteBallots = pgTable(
  'monthly_vote_ballots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    voteId: uuid('vote_id')
      .notNull()
      .references(() => monthlyVotes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    albumId: text('album_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('monthly_vote_ballots_vote_user_album_unique').on(
      table.voteId,
      table.userId,
      table.albumId,
    ),
    index('monthly_vote_ballots_vote_user_idx').on(table.voteId, table.userId),
  ],
)

export const albumOfMonthComments = pgTable(
  'album_of_month_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    albumOfMonthId: uuid('album_of_month_id')
      .notNull()
      .references(() => albumOfMonth.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commentText: text('comment_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('album_of_month_comments_aom_idx').on(table.albumOfMonthId)],
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
export type Follow = typeof follows.$inferSelect
export type NewFollow = typeof follows.$inferInsert
export type AlbumOfMonth = typeof albumOfMonth.$inferSelect
export type NewAlbumOfMonth = typeof albumOfMonth.$inferInsert
export type AlbumOfMonthComment = typeof albumOfMonthComments.$inferSelect
export type NewAlbumOfMonthComment = typeof albumOfMonthComments.$inferInsert
export type MonthlyVote = typeof monthlyVotes.$inferSelect
export type NewMonthlyVote = typeof monthlyVotes.$inferInsert
export type MonthlyVoteCandidate = typeof monthlyVoteCandidates.$inferSelect
export type NewMonthlyVoteCandidate = typeof monthlyVoteCandidates.$inferInsert
export type MonthlyVoteBallot = typeof monthlyVoteBallots.$inferSelect
export type NewMonthlyVoteBallot = typeof monthlyVoteBallots.$inferInsert
