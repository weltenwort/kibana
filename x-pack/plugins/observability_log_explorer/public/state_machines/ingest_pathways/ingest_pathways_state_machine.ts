/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ISearchGeneric } from '@kbn/data-plugin/common';
import { IDataStreamsStatsClient } from '@kbn/dataset-quality-plugin/public';
import { ElementDefinition } from 'cytoscape';
import moment from 'moment';
import { ActionTypes, assign, createMachine } from 'xstate';
import { calculateGraph } from './graph';
import { loadSignalData } from './services/load_signal_data';
import { Agent, IngestPathwaysData, IngestPathwaysParameters } from './types';
import { mergeIngestPathwaysData } from './utils';

export const createPureIngestPathwaysStateMachine = (initialContext: IngestPathwaysContext) =>
  createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2NYBcAKBDTAFgO64CesAdAK6oCWdmtuANrQF6QDEA2gAwC6iUAAcA9rFqNRqISAAeiAGwB2CgA4VARjXKArABoQpRJoAspigE5r15crUaATGs2OAvm8NoMOfMTKUzKK4EPRQ3nA4tMJgrKhwnBDSYBT0AG6iANYpQSERWNjRsfRwfIJIIGISUjIVCgi86pa8io4GRkqalhSmNpZ2Dq0uHl7okXiEJOQUuaHoAMq0UKgsACL4uInJqagZ2TPBEIvLaxtlslWStNKy9WY9ugDMru3GCI+mmlZ9A07DIyBUKIIHBZPlfJMAhdxFcbnVEABaVyKdRaHSvRG6b7WDSWXRtNTOTSKAHgib+aY0ehXFjsSDQ6rXWqgeqmRyGN4uHo-ex-VyksYFPxTQKHekVS41W6IXRfSxmFqOXp9SwaDmIZSKFF9VrPWWKfmeEBk4UBA4hMJkopxUESmFS+EIBH2VHKbR6dUIXqObG2XlDTQCnzkkXmuZQY4rZjrTC4Bmw5nyTFfZRs90YhCORxfZV+wZEjweIA */
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
          always: 'loadingSignalData',
        },

        loaded: {},

        loadingIngestPipelines: {
          invoke: {
            src: 'loadIngestPipelines',

            onDone: {
              target: 'loaded',
              actions: 'storeIngestPipelines',
            },

            id: 'loadIngestPipelines',
          },
        },

        loadingSignalData: {
          invoke: {
            src: 'loadSignalData',

            onDone: {
              target: 'loadingIngestPipelines',
              actions: ['storeSignalData', 'updateGraph'],
            },

            id: 'loadSignalData',
          },
        },
      },
    },
    {
      actions: {
        storeSignalData: assign({
          data: (context, event) => {
            if (event.type !== 'done.invoke.loadSignalData') {
              return context.data;
            }

            return mergeIngestPathwaysData(context.data, event.data);
          },
        }),
        updateGraph: assign({
          graph: (context, event) => {
            const graph = calculateGraph(context.data);

            return graph;
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
  const from = moment(currentDate).subtract(moment.duration(1, 'days')).toISOString();
  const to = currentDate.toISOString();

  return createPureIngestPathwaysStateMachine({
    parameters: {
      dataStreamPattern: 'logs-*-*,metrics-*-*',
      timeRange: {
        from,
        to,
      },
    },
    data: {
      dataStreams: {},
      agents: {},
      indexTemplates: {},
      ingestPipelines: {},
      relations: [],
    },
    graph: {
      elements: [],
    },
  }).withConfig({
    services: {
      loadSignalData: loadSignalData({ dataStreamsStatsClient, search }),
    },
  });
};

export interface IngestPathwaysContext {
  parameters: IngestPathwaysParameters;
  data: IngestPathwaysData;
  graph: {
    elements: ElementDefinition[];
  };
}

export interface IngestPathwaysServices {
  [service: string]: {
    data: any;
  };
  loadSignalData: {
    data: IngestPathwaysData;
  };
  loadIngestPipelines: {
    data: null;
  };
}

export type IngestPathwaysEvent =
  | {
      type: 'load';
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadSignalData`;
      data: IngestPathwaysServices['loadSignalData']['data'];
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadIngestPipelines`;
      agents: Agent[];
    };
