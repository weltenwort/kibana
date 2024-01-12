/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpStart } from '@kbn/core-http-browser';
import { ISearchGeneric } from '@kbn/data-plugin/common';
import { IDataStreamsStatsClient } from '@kbn/dataset-quality-plugin/public';
import { ElementDefinition } from 'cytoscape';
import moment from 'moment';
import { ActionTypes, assign, createMachine } from 'xstate';
import { calculateGraph } from './graph';
import { loadDataStreams } from './services/load_data_streams';
import { loadIndexTemplates } from './services/load_index_templates';
import { loadSignalData } from './services/load_signal_data';
import {
  Agent,
  DataStream,
  DataStreamStub,
  IndexTemplate,
  IngestPathwaysData,
  IngestPathwaysParameters,
  IngestPipeline,
  IngestPipelineStub,
} from './types';
import { mergeIngestPathwaysData } from './utils';

export const createPureIngestPathwaysStateMachine = (initialContext: IngestPathwaysContext) =>
  createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2NYBcAKBDTAFgO64CesAdAK6oCWdmtuANrQF6QDEA2gAwC6iUAAcA9rFqNRqISAAeiAGwB2CgA4VARjXKArABoQpRJoAspigE5r15crUaATGs2OAvm8NoMOfMTKUzKK4EPRQ3nA4tMJgrKhwnBDSYBT0AG6iANYpQSERWNjRsfRwfIJIIGISUjIVCgi86pa8io4GRiaOvADMFKY2lnYOrWruniD5voQk5BS5oegAyrRQqCwAIvi4icmpqBnZc8EQy6sbW2WyVZK00rL1Zn263a7txgjdpppWA0NOLh4vOhInhpgEjiEwmgIGA5AAVMAAW2EzHwCSS8T2Bxyx2hsIRyNRmFKAiu4hudzqiAAtI1FKY1KZunpDO9LG0KMp+pZGVzXJpeJZARNgQU-DNAscwptMLhFpgAE5gXCI2A7THpLI4kIyuWK5Wqy4Va41e6IVTKSyKHRvJSPLnWUyKXSWUyObpqbrCyag-yzebSrbypUqtXzI0icmmqkIZzfRyOJ2J3QC3S6OyKVmIFO9PS8fOmFrOLljIE+X0SiELcKoGHwpEotFh44RypR261UD1F6WCiOTRpj3u7qWMyOLMIezfB2Wbou3h2bqlkXl8XggPoH1FOIJcOk43tyldxBztQUbqKAdtS1MvRqCeaR+NXT53iJ5Qj626NTe0VTP2SiEXB7uUkbVB2ZofFafSmDmajsqMXwXg+c6qAMrQvCml5jOMqCiDC8AVD6a7kGS4FHvINKuL2s4sh0CDUooFCvrwT7dC0Ni6MuxFgrMND0DcLDsJAZEUp2lEIG6E4uH0vz2P8ri-quvGATCECidGx4ICmVhmEW3IDBoKHpj81gYQOmjYUpIIkapUJ-oUMQ7oRYFiZB1L2OoWg2g+vAaKZtjySM3EObZVZhKcazMLqGkQTG1I6SW2h0e8CbfAZgxBXG1liip4WbrW+INkScCxRR9TUjJtG2pO359tyvJfP2go5f+lYblAurBgaLltuR4kVc6zG6E6Pn0f0jSJoFj7aJZpgeB4QA */
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

        loaded: {
          on: {
            load: 'loadingSignalData',
          },
        },

        loadingIngestPipelines: {
          invoke: {
            src: 'loadIngestPipelines',

            onDone: {
              target: 'loaded',
              actions: ['storeIngestPipelines', 'updateGraph'],
            },

            id: 'loadIngestPipelines',
          },

          on: {
            load: 'loadingSignalData',
          },
        },

        loadingSignalData: {
          invoke: {
            src: 'loadSignalData',

            onDone: {
              target: 'loadingDataStreams',
              actions: ['storeSignalData', 'updateGraph'],
            },

            id: 'loadSignalData',
          },
        },

        loadingIndexTemplates: {
          invoke: {
            src: 'loadIndexTemplates',
            id: 'loadIndexTemplates',

            onDone: {
              target: 'loadingIngestPipelines',
              actions: ['storeIndexTemplates', 'updateGraph'],
            },
          },

          on: {
            load: 'loadingSignalData',
          },
        },

        loadingDataStreams: {
          invoke: {
            src: 'loadDataStreams',
            id: 'loadDataStreams',

            onDone: {
              target: 'loadingIndexTemplates',
              actions: 'storeDataStreams',
            },
          },

          on: {
            load: 'loadingSignalData',
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
        storeDataStreams: assign({
          data: (context, event) => {
            if (event.type !== 'done.invoke.loadDataStreams') {
              return context.data;
            }

            return mergeIngestPathwaysData(context.data, {
              dataStreams: event.data,
            });
          },
        }),
        storeIndexTemplates: assign({
          data: (context, event) => {
            if (event.type !== 'done.invoke.loadIndexTemplates') {
              return context.data;
            }

            return mergeIngestPathwaysData(context.data, {
              indexTemplates: event.data.indexTemplates,
              ingestPipelines: event.data.ingestPipelines,
            });
          },
        }),
        storeIngestPipelines: assign({
          data: (context, event) => {
            if (event.type !== 'done.invoke.loadIngestPipelines') {
              return context.data;
            }

            return mergeIngestPathwaysData(context.data, {
              ingestPipelines: event.data,
            });
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
  http: HttpStart;
  search: ISearchGeneric;
}

export const createIngestPathwaysStateMachine = ({
  dataStreamsStatsClient,
  http,
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
    },
    graph: {
      elements: [],
    },
  }).withConfig({
    services: {
      loadSignalData: loadSignalData({ dataStreamsStatsClient, search }),
      loadDataStreams: loadDataStreams({ http }),
      loadIndexTemplates: loadIndexTemplates({ http }),
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
    data: {
      agents: Record<string, Agent>;
      dataStreams: Record<string, DataStreamStub>;
    };
  };
  loadDataStreams: {
    data: Record<string, DataStream>;
  };
  loadIndexTemplates: {
    data: {
      indexTemplates: Record<string, IndexTemplate>;
      ingestPipelines: Record<string, IngestPipelineStub>;
    };
  };
  loadIngestPipelines: {
    data: Record<string, IngestPipeline>;
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
      type: `${ActionTypes.DoneInvoke}.loadDataStreams`;
      data: IngestPathwaysServices['loadDataStreams']['data'];
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadIndexTemplates`;
      data: IngestPathwaysServices['loadIndexTemplates']['data'];
    }
  | {
      type: `${ActionTypes.DoneInvoke}.loadIngestPipelines`;
      data: IngestPathwaysServices['loadIngestPipelines']['data'];
    };
