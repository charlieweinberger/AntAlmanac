import { createId } from '@paralleldrive/cuid2';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { users } from '../auth/user';

export const schedules = pgTable('schedules', {
    id: text('id').primaryKey().$defaultFn(createId),

    /**
     * A schedule is owned by a user.
     */
    userId: text('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),

    /**
     * Name of the schedule.
     */
    name: text('name'),

    /**
     * Any custom notes.
     */
    notes: text('notes'),
});

export type Schedule = typeof schedules.$inferSelect;
