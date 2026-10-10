'use client';

import { ItemTimingFields } from './ItemTimingFields';

export type EventFieldsProps = Omit<Parameters<typeof ItemTimingFields>[0], 'kind' | 'startRequired' | 'endRequired' | 'hasWindowEnd' | 'unscheduled'> & { endRequired?: boolean };

export function EventFields(props: EventFieldsProps) {
  return <ItemTimingFields {...props} kind="event" unscheduled={false} startRequired endRequired={props.endRequired ?? true} hasWindowEnd={false} />;
}
