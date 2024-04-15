/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { DataView, DataViewsServicePublic } from '@kbn/data-views-plugin/public';
import { SavedSearch, SavedSearchPublicPluginStart } from '@kbn/saved-search-plugin/public';
import { createMachine } from 'xstate';
import { resolveSource } from './resolve_source';
import { ResolvedDataSource } from './source_types';

export const createPureDiscoverMainController = () =>
  createMachine<DiscoverMainControllerContext, DiscoverMainControllerEvent>({
    /** @xstate-layout N4IgpgJg5mDOIC5QBECWsDGB7AbmATgLICGqAdgMJZkAu+WANgwQHQC2qU+xN5UAyjR5gAxBGpgW5HFgDWkjl2EAFArHQ1Ig4QG0ADAF1EoAA5Z1vasZAAPRAEZ7AThYAmAGwBWd6-ue9TvYAzAAs7kEANCAAnoiuri4hjv5OnkFeTgDsQQC+OVFomLgEJORUtPRMrPhwjDh8-FgArvgYouJkktJykjWwdWCNLW36RkggZhaoVuN2CPYheiwAHO6ZziFpme7Lu1GxCJl6ISuenplOIU7uTk56QU55BejYeESklNR0jMz4LH0DCBDVqiCgACQAggA5ADiAFEAPr8ADyAFUAEoUOGjayTVCWMjWOZhewsdwhC4+ZbZC5ndz7RDLRYsEJBeKuc5OZauJmPfIgQqvEofcrfKp-AEMPBA5ogkTg6HwhHKCHoiGEOEAFTh6P4OPGeIJRMQIRCyxWrm2aUu2T01IZ818nhY9iOensPM9myeApexXeZS+lV+UjI+NQxAYqAAXnwAGL0NjIMAAM2ITQYNFgYgkoZk8hYDCwxAgybTGZoymI3DYYE0+Fg+tM5nDM1Ac0cmRdqSCeguHlZHicDs2pJ5CyZSSy2x9gv9pU+FR+rHI4cjMfjiahxHqUB40zI2k0Oc6eZ6obXUejYCrNbragTWDY293++oR7ATYmLaNs0QPhYW5fCcIIggWMJLmOB0uXcFg+08S13B2TxHFWPJ+TILAIDgaw5zeBdRWDAhcR-A9jQQABaekYkQCiuz0Bj7j0VxQMyJle2WWc-XwkUg2XP5FG4XgyAEIRNBIqY21sE1XAdZYliuW51mcJDvGCLiih4wMl3Ff5ailBpZTaCTW0JP8EHktx7GpTxuTdDjhxohBORdYJ4iOdxXTNTwNKFANFzFENJWlYFjINUipLmHYWV8XZ1iZPR3HdB1HEtFhMhQs0PXOVjXF8+deJ0kNV14ddYxEx8k1TdNM3gcLJLM9sZLgxjrPubxPNNB1eyWBYQPiUCnA5TI8v5PDhW0wKVzDUqr03J8X04N9DzEsATN-JqEBCWSnOWXsXVsi4gl2QIuRCdCciAA */
    initial: 'migratingState',

    states: {
      migratingState: {
        invoke: {
          src: 'migratePersistedState',
          id: 'migratePersistedState',
          onDone: 'initializingFromDefaults',
        },
      },

      resolvingSource: {
        invoke: {
          src: 'resolveSource',
          id: 'resolveSource',
          onDone: {
            target: 'initializingFromNavigationState',
            actions: 'storeResolvedSource',
          },
        },
      },

      resolvedSource: {
        on: {
          CHANGE_SOURCE: {
            target: 'resolvingSource',
            actions: 'updateSourceInNavigationState',
          },

          CHANGE_PARAMETERS: {
            target: 'resolvedSource',
            internal: true,
            actions: ['storeParameters', 'updateParametersInNavigationState'],
          },
        },

        invoke: {
          src: 'profileController',
          id: 'profileController',
        },
      },

      initializingFromDefaults: {
        invoke: {
          src: 'loadDefaultParameters',
          id: 'loadDefaultParameters',
          onDone: {
            target: 'resolvingSource',
            actions: 'storeParameters',
          },
        },
      },

      initializingFromNavigationState: {
        invoke: {
          src: 'initializeParametersFromNavigationState',
          id: 'initializeParametersFromNavigationState',
          onDone: {
            target: 'resolvedSource',
            actions: 'storeParameters',
          },
        },
      },
    },
    id: 'DiscoverMainController',
    predictableActionArguments: true,
  });

interface DiscoverMainControllerDependencies {
  getNavigationState: () => void;
  setNavigationState: () => void;
  dataViews: DataViewsServicePublic;
  savedSearches: SavedSearchPublicPluginStart;
}

export const createDiscoverMainController = ({
  dataViews,
  savedSearches,
}: DiscoverMainControllerDependencies) =>
  createPureDiscoverMainController().withConfig({
    services: {
      resolveSource: (context, event) => {
        const source = null; // TODO: get source from navigation state
        return resolveSource({ dataViews, savedSearches })(source);
      },
    },
  });

export interface DiscoverMainControllerContext {
  source: ResolvedDataSource;
  parameters: unknown;
}

export type DiscoverMainControllerEvent =
  | { type: 'CHANGE_SOURCE'; source: unknown }
  | { type: 'CHANGE_PARAMETERS'; parameters: unknown };
