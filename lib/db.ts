import type { SQLiteDatabase } from 'expo-sqlite'
import type { AlbumStatus, GenreCount, LoggedAlbum } from './types'

export async function initDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      title TEXT,
      artist TEXT,
      artworkUrl TEXT,
      releaseDate TEXT,
      genre TEXT,
      rating REAL,
      review TEXT,
      loggedAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged'
    );
  `)
}

export async function upsertAlbum(db: SQLiteDatabase, album: LoggedAlbum): Promise<void> {
  await db.runAsync(
    `INSERT INTO albums (id, title, artist, artworkUrl, releaseDate, genre, rating, review, loggedAt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       rating = excluded.rating,
       review = excluded.review,
       loggedAt = excluded.loggedAt,
       status = excluded.status`,
    album.id,
    album.title,
    album.artist,
    album.artworkUrl,
    album.releaseDate,
    album.genre,
    album.rating,
    album.review,
    album.loggedAt,
    album.status,
  )
}

export async function getAllAlbums(db: SQLiteDatabase): Promise<LoggedAlbum[]> {
  return db.getAllAsync<LoggedAlbum>('SELECT * FROM albums ORDER BY loggedAt DESC')
}

export async function getAlbumById(db: SQLiteDatabase, id: string): Promise<LoggedAlbum | null> {
  return db.getFirstAsync<LoggedAlbum>('SELECT * FROM albums WHERE id = ?', id)
}

export async function deleteAlbum(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM albums WHERE id = ?', id)
}

export async function getAlbumsByStatus(
  db: SQLiteDatabase,
  status: AlbumStatus,
): Promise<LoggedAlbum[]> {
  return db.getAllAsync<LoggedAlbum>(
    'SELECT * FROM albums WHERE status = ? ORDER BY loggedAt DESC',
    status,
  )
}

export async function getGenreBreakdown(db: SQLiteDatabase): Promise<GenreCount[]> {
  return db.getAllAsync<GenreCount>(`
    SELECT COALESCE(genre, 'Sem gênero') AS genre, COUNT(*) AS count
    FROM albums
    WHERE status = 'logged'
    GROUP BY genre
    ORDER BY count DESC
  `)
}
