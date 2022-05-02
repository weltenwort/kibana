/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ActionObject, ActorRefFrom, EventObject } from 'xstate';
import { createModel } from 'xstate/lib/model';

export interface TimeInterval {
  start: string;
  end: string;
}

interface TimePickerContext {
  interval: TimeInterval;
}

const initialTimePickerContext: TimePickerContext = {
  interval: {
    start: 'now - 1d',
    end: 'now',
  },
};

export const timePickerModel = createModel(initialTimePickerContext, {
  events: {
    CHANGE_TIME_INTERVAL: (interval: TimeInterval) => ({ interval }),
    RESET_TIME_INTERVAL: () => ({}),
  },
});

const storeInterval = timePickerModel.assign(
  {
    interval: (_, { interval }) => interval,
  },
  'CHANGE_TIME_INTERVAL'
);

export const getInterval = (context: TimePickerContext) => context.interval;

const placeholder = <TContext, TEvent extends EventObject>(): ActionObject<TContext, TEvent> => ({
  type: 'doNothing',
  exec: () => {},
});

export const timePickerStateMachine = timePickerModel.createMachine(
  {
    initial: 'hasDefaultInterval',
    states: {
      hasDefaultInterval: {
        entry: ['onHasStaticInterval'],
        on: {
          CHANGE_TIME_INTERVAL: {
            target: 'hasCustomInterval',
            actions: [storeInterval],
          },
        },
      },
      hasCustomInterval: {
        entry: ['onHasStaticInterval'],
        on: {
          CHANGE_TIME_INTERVAL: {
            target: 'hasCustomInterval',
            actions: [storeInterval],
          },
          RESET_TIME_INTERVAL: {
            target: 'hasDefaultInterval',
            actions: [timePickerModel.reset],
          },
        },
      },
    },
  },
  {
    actions: {
      onHasStaticInterval: placeholder(),
    },
  }
);

export type TimePickerActor = ActorRefFrom<typeof timePickerStateMachine>;
