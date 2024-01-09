/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ISearchGeneric } from '@kbn/data-plugin/common';
import { IDataStreamsStatsClient } from '@kbn/dataset-quality-plugin/public';
import moment from 'moment';
import { createMachine, assign, ActionTypes } from 'xstate';
import { loadDataStreams } from './services/load_data_streams';
import { Agent, DataStream, IngestPathwaysParameters, Relation } from './types';

export const createPureIngestPathwaysStateMachine = (initialContext: IngestPathwaysContext) =>
  createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2NYBcAKBDTAFgO64CesAdAK6oCWdmtuANrQF6QDEA2gAwC6iUAAcA9rFqNRqISAAeiAGwB2CgA4VARjXKArABoQpRJoAspigE5r15crUaATGs2OAvm8NoMOfMTKUzKK4EPRQAIIwqJiwnBDSYBT0AG6iANaJ3nC+hCTkFEEhYZFg0bAIKaIAxvi00nz8DbJiElIySPKIjrrqAMy6lr16hsYIA7wUpjaWdg6KzpoeXujZeLkBBcGh6AAi+LgAypgATmC4ALax8aiJlRkUWVhr-vmF21B7mIcnZ5cVqKkam0Gk0Oi1JHV2qAFAhVMpLIodAYjIheqZHFZprMnC4PJ4QKhRBA4LJHjkXvAweIIdJZDCALS6XoUZSaXiDYYohD0xQUXj8-mORyaTRDbT2XRLEBk555Sg0egQljsSDNaltOmIdEjRAuSZY+w41xSmV+OWbEKqqmtSGasaaKxmXjzKbTSwaHWwkWY6zzXqaXSaRTG-Gm9avLbFKIxNU22kdGGuCi9BbdT2mRTMt3Y+a40MrJ5mjZvMKfb6nC6UkTq20JxCMllsjnI0bC1Su2yG3OLPFAA */
      context: initialContext,
      predictableActionArguments: true,
      id: 'IngestPathways',
      initial: 'uninitialized',
      schema: {
        context: {} as IngestPathwaysContext,
        events: {} as IngestPathwaysEvent,
        services: {} as IngestPathwaysServices,
      },
      states: {
        uninitialized: {
          always: 'loadingDataStreams',
        },

        loaded: {},

        loadingAgents: {
          invoke: {
            src: 'loadAgents',
            onDone: {
              target: 'loaded',
              actions: 'storeAgents',
            },
          },
        },

        loadingDataStreams: {
          invoke: {
            src: 'loadDataStreams',
            onDone: {
              target: 'loadingAgents',
              actions: 'storeDataStreams',
            },
          },
        },
      },
    },
    {
      actions: {
        storeDataStreams: assign({
          data: (context, event) => {
            if (event.type !== 'done.invoke.loadDataStreams') {
              return context.data;
            }

            return {
              ...context.data,
              dataStreams: event.dataStreams,
            };
          },
        }),
      },
    }
  );

export interface IngestPathwaysStateMachineDependencies {
  dataStreamsStatsClient: IDataStreamsStatsClient;
  search: ISearchGeneric;
}

export const createIngestPathwaysStateMachine = ({
  dataStreamsStatsClient,
  search,
}: IngestPathwaysStateMachineDependencies) => {
  const currentDate = new Date();
  const from = moment(currentDate).add(moment.duration(1, 'days')).toISOString();
  const to = currentDate.toISOString();

  return createPureIngestPathwaysStateMachine({
    parameters: {
      dataStreamPattern: 'logs-*',
      timeRange: {
        from,
        to,
      },
    },
    data: {
      dataStreams: [],
      agents: [],
      relations: [],
    },
  }).withConfig({
    services: {
      loadDataStreams: loadDataStreams({ dataStreamsStatsClient, search }),
    },
  });
};

export interface IngestPathwaysContext {
  parameters: IngestPathwaysParameters;
  data: {
    dataStreams: DataStream[];
    agents: Agent[];
    relations: Relation[];
  };
}

export interface IngestPathwaysActions {
  storeDataStreams: () => {};
  storeAgents: () => {};
}

export interface IngestPathwaysServices {
  [service: string]: {
    data: any;
  };
  loadDataStreams: {
    data: null;
  };
  loadAgents: {
    data: null;
  };
}

export type IngestPathwaysEvent =
  | {
      type: 'load';
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadDataStreams`;
      dataStreams: DataStream[];
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadAgents`;
      agents: Agent[];
    };
