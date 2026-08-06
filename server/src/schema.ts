import {
  date,
  index,
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
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
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
