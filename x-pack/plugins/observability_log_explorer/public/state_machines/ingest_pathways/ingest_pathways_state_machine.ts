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

export const createPureIngestPathwaysStateMachine = (initialContext: IngestPathwaysContext) =>
  createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2NYBcAKBDTAFgO64CesAdAK6oCWdmtuANrQF6QDEA2gAwC6iUAAcA9rFqNRqISAAeiAGwB2CgA4VARjXKArABoQpRJoAspigE5r15crUaATGs2OAvm8NoMOfMTKUzKK4EPRQAIIwqJiwnBDSYBT0AG6iANaJQSGRYNGwfIJIIGISUjJFCgiOuuoAzLqWtXqGxggNvBSmNpZ2DorOmh5e6HC+hCTkFFmh6ADKtFCoLAAi+LhxCUmoqRlTwRDziytrBbIlkrTSspVmnbq1rgZGiLWmmlbdvU4uHp4gqKIIHBZN5RnhxgEzuILlcKogALTWCjKUyObTNZ4IeGKCi8PF4xxozRNdFqXRDECgrDg-yTGj0C4sdiQKGlS7lUCVVEtRAuTqfezfVwUqljWmBfYsornMrXRC6d6WMy8fpdbqWDQ8hDKTSKmz9B4KxTCv6imkTCUhMI5PKsmEc+QI5xWZSKXT9J6tUyKCzqr79H6mkbUvwWvZWuYLJbMVaYXB22VwrEK5Go9GexCE95q2yCgODX5AA */
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

        loadingAgents: {
          invoke: {
            src: 'loadAgents',

            onDone: {
              target: 'loaded',
              actions: 'storeAgents',
            },

            id: 'loadAgents',
          },
        },

        loadingSignalData: {
          invoke: {
            src: 'loadSignalData',

            onDone: {
              target: 'loadingAgents',
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

            return {
              dataStreams: { ...context.data.dataStreams, ...event.data.dataStreams },
              agents: { ...context.data.agents, ...event.data.agents },
              relations: [...context.data.relations, ...event.data.relations],
            };
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
  loadAgents: {
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
      type: `${ActionTypes.DoneInvoke}.loadAgents`;
      agents: Agent[];
    };
