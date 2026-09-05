import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
  id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),startedAt:integer('started_at').notNull(),
  name:text('name'),score:integer('score'),distance:integer('distance'),finishedAt:integer('finished_at'),
},table=>[index('runs_score_idx').on(table.score)]);
export const leads=sqliteTable('leads',{
  id:text('id').primaryKey(),runId:text('run_id').notNull(),phone:text('phone').notNull(),consentAt:integer('consent_at').notNull(),
  consentVersion:text('consent_version').notNull(),score:integer('score').notNull(),crmStatus:text('crm_status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),
},table=>[index('leads_status_idx').on(table.crmStatus)]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
