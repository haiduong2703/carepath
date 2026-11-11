import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts',{
  id:text('id').primaryKey(), email:text('email').notNull().unique(), name:text('name').notNull(),
  passwordHash:text('password_hash').notNull(), createdAt:integer('created_at').notNull()
});
export const sessions = sqliteTable('sessions',{
  tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull()
},t=>[index('sessions_expiry').on(t.expiresAt)]);
export const authAttempts = sqliteTable('auth_attempts',{
  key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()
},t=>[index('attempts_expiry').on(t.expiresAt)]);
