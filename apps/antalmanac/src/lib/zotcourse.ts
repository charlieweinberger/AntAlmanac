import { RepeatingCustomEvent } from '@packages/antalmanac-types';

import trpc from './api/trpc';
import { QueryZotcourseError } from './customErrors';

import { useScheduleStore } from '$stores/ScheduleStore';

export interface ZotcourseResponse {
    codes: string[];
    customEvents: RepeatingCustomEvent[];
}
export async function queryZotcourse(schedule_name: string) {
    if (!schedule_name) throw new QueryZotcourseError('Cannot import an empty Zotcourse schedule name');
    const response = await trpc.zotcourse.getUserData.mutate({ scheduleName: schedule_name });
    if (!response.success) throw new QueryZotcourseError('Cannot import an invalid Zotcourse');
    // For custom event, there is no course attribute in each.
    const codes = response.data
        .filter((section: { eventType: number }) => section.eventType === 3)
        .map((section: { course: { code: string } }) => section.course.code) as string[];
    const days = [false, false, false, false, false, false, false];
    const customEvents: RepeatingCustomEvent[] = response.data
        .filter((section: { eventType: number }) => section.eventType === 1)
        .map((event: { title: string; start: string; end: string; dow: number[] }) => {
            return {
                title: event.title,
                start: event.start,
                end: event.end,
                days: days.map((_, index) => event.dow.includes(index)),
                scheduleIndices: [useScheduleStore.getState().getCurrentScheduleIndex()],
                customEventID: Date.now(),
                color: '#551a8b',
            };
        }) as RepeatingCustomEvent[];
    return {
        codes: codes,
        customEvents: customEvents,
    };
}
