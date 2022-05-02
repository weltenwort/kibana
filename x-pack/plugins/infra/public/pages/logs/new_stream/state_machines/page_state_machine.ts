/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { sendParent } from 'xstate';
import { createModel } from 'xstate/lib/model';
import { LogSourceStatus } from '../../../../../common/http_api/log_sources';
import { ResolvedLogSourceConfiguration } from '../../../../../common/log_sources';
import { timePickerStateMachine, TimeInterval } from './time_picker_machine';

export interface LogStreamPageContext {
  logSourceConfiguration?: ResolvedLogSourceConfiguration;
  logSourceStatus?: LogSourceStatus;
}

export const logStreamPageModel = createModel(
  {
    logSourceConfiguration: undefined,
    logSourceStatus: undefined,
  } as LogStreamPageContext,
  {
    events: {
      RECEIVE_LOG_SOURCE_CONFIGURATION: (
        logSourceConfiguration: ResolvedLogSourceConfiguration
      ) => ({ logSourceConfiguration }),
      RECEIVE_LOG_SOURCE_STATUS: (logSourceStatus: LogSourceStatus) => ({ logSourceStatus }),
      RECEIVE_FULL_INTERVAL: () => ({}),
      LOAD_MORE_BEFORE: () => ({}),
      LOAD_MORE_AFTER: () => ({}),
      CHANGE_TIME_INTERVAL: (interval: TimeInterval) => ({ interval }),
      CHANGE_FILTER: () => ({}),
      START_STREAMING: () => ({}),
      STOP_STREAMING: () => ({}),
      REFRESH: () => ({}),
    },
  }
);
const storeLogSourceConfiguration = logStreamPageModel.assign(
  {
    logSourceConfiguration: (_, { logSourceConfiguration }) => logSourceConfiguration,
  },
  'RECEIVE_LOG_SOURCE_CONFIGURATION'
);

const storeLogSourceStatus = logStreamPageModel.assign(
  {
    logSourceStatus: (_, { logSourceStatus }) => logSourceStatus,
  },
  'RECEIVE_LOG_SOURCE_STATUS'
);

export const logStreamPageStateMachine = logStreamPageModel.createMachine(
  {
    id: 'logStreamPage',
    initial: 'waitingForSource',
    states: {
      waitingForSource: {
        type: 'parallel',
        states: {
          sourceConfiguration: {
            initial: 'waiting',
            states: {
              waiting: {
                on: {
                  RECEIVE_LOG_SOURCE_CONFIGURATION: {
                    target: 'received',
                    actions: [storeLogSourceConfiguration],
                  },
                },
              },
              received: { type: 'final' },
            },
          },
          sourceStatus: {
            initial: 'waiting',
            states: {
              waiting: {
                on: {
                  RECEIVE_LOG_SOURCE_STATUS: {
                    target: 'received',
                    actions: [storeLogSourceStatus],
                  },
                },
              },
              received: { type: 'final' },
            },
          },
        },
        onDone: 'hasLogSource',
      },
      hasLogSource: {
        initial: 'entry',
        states: {
          entry: {
            always: [
              {
                target: 'hasIndices',
                cond: 'isIndexAvailable',
              },
              { target: 'hasNoIndices' },
            ],
          },
          hasNoIndices: {},
          hasIndices: {
            initial: 'staticInterval',
            invoke: [
              {
                id: 'timePicker',
                src: 'timePicker',
              },
            ],
            states: {
              staticInterval: {
                id: 'staticInterval',
                initial: 'loadingFullInterval',
                states: {
                  loadingFullInterval: {
                    invoke: { src: 'loadLogEntriesAround', onDone: 'loaded' },
                  },
                  loadingMoreBefore: {
                    invoke: { src: 'loadLogEntriesBefore', onDone: 'loaded' },
                  },
                  loadingMoreAfter: {
                    invoke: { src: 'loadLogEntriesAfter', onDone: 'loaded' },
                  },
                  loaded: {
                    type: 'parallel',
                    states: {
                      beginning: {
                        initial: 'entry',
                        states: {
                          entry: {
                            always: [
                              { target: 'hasMore', cond: 'hasMoreBefore' },
                              { target: 'hasNoMore' },
                            ],
                          },
                          hasMore: {
                            on: {
                              LOAD_MORE_BEFORE: [{ target: '#staticInterval.loadingMoreBefore' }],
                            },
                          },
                          hasNoMore: {},
                        },
                      },
                      end: {
                        initial: 'entry',
                        states: {
                          entry: {
                            always: [
                              { target: 'hasMore', cond: 'hasMoreAfter' },
                              { target: 'hasNoMore' },
                            ],
                          },
                          hasMore: {
                            on: {
                              LOAD_MORE_AFTER: [{ target: '#staticInterval.loadingMoreAfter' }],
                            },
                          },
                          hasNoMore: {},
                        },
                      },
                    },
                  },
                },
                on: {},
              },
              liveStream: {
                invoke: {
                  src: { type: 'sendInInterval', event: 'REFRESH' },
                },
                initial: 'loadingNewestLogEntries',
                states: {
                  loadingNewestLogEntries: {
                    invoke: { src: 'loadLogEntriesBefore', onDone: 'loaded' },
                  },
                  loadingNewerLogEntries: {
                    invoke: { src: 'loadLogEntriesAfter', onDone: 'loaded' },
                  },
                  loaded: {
                    on: {
                      REFRESH: [{ target: 'loadingNewerLogEntries' }],
                    },
                  },
                },
                on: {
                  STOP_STREAMING: [{ target: 'staticInterval' }],
                },
              },
            },
            on: {
              CHANGE_TIME_INTERVAL: [{ target: '.staticInterval' }],
              START_STREAMING: [{ target: '.liveStream' }],
            },
          },
        },
        on: {
          RECEIVE_LOG_SOURCE_CONFIGURATION: [
            {
              target: '#logStreamPage.waitingForSource.sourceConfiguration.received',
              actions: ['storeLogSourceConfiguration'],
            },
          ],
          RECEIVE_LOG_SOURCE_STATUS: [
            {
              target: '#logStreamPage.waitingForSource.sourceStatus.received',
              actions: ['storeLogSourceStatus'],
            },
          ],
        },
      },
    },
  },
  {
    actions: {},
    guards: {
      hasMoreBefore: () => true,
      hasMoreAfter: () => true,
      isIndexAvailable: (context) => context.logSourceStatus?.logIndexStatus === 'available',
    },
    services: {
      timePicker: timePickerStateMachine.withConfig({
        actions: {
          onHasStaticInterval: sendParent((context) =>
            logStreamPageModel.events.CHANGE_TIME_INTERVAL(context.interval)
          ),
        },
      }),
      loadLogEntriesAround: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('data'), 5000);
        }),
    },
  }
);
