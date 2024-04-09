/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { actions, createMachine, interpret, InterpreterFrom, raise } from 'xstate';

export const createPureDiscoverMainController = () =>
  createMachine<DiscoverMainControllerContext, DiscoverMainControllerEvent>({
    /** @xstate-layout N4IgpgJg5mDOIC5QBECWsDGB7AbmATgLICGqAdgMJZkAu+WANgwQHQC2qU+xN5UAyjR5gAxBGpgW5HFgDWkjl2EAFArHQ1Ig4QG0ADAF1EoAA5Z1vasZAAPRAEZ7AThYAmAGwBWd3p-2ALJ5OAMzu7gA0IACeiK7OLE6e3q4AHO7+-o4p-u4AvrmRaJi4BCTkVLT0TKzkqLzEDKgAXnzKxNxsYJr4sGISLLBCmixF2HhEpJTUdIzM+FJkdagNza3txJ3dsPpGSCBmFqhWe3YI9imeLPbpepkpwR6J95ExCEkuwfbBD2meqa56Vz5QroMalSYVGbVea1eqNFpkKBtDpdNQsABm9DYyDA6OIAFcGDRejtrAclsdQKdgikAOxXRK0r4eQFpVwvRCZekpAIhJyOVy0wUpYEgUYlCblaZVOYsfBwRg4Pj8LD4-AYUTiMiSaRySTy2CKsAqtUa0l7cmWMjWU4BYIJWleTyAwVOdzBfwchCO-xXAF6PQpVxOEKeWm00Xi8ZlKaVWasA1GiAm9WiCgACQAggA5ADiAFEAPr8ADyAFUAEoUfPm0zmCnWk6c74sWl6b72PROXzXNK0r3uJz09zh-x6WnZbzt4KR0ESmOQmUJhUMPDJ1WpkQZnMFwvKTMVzOEfMAFXzFf4tf29atNs5ARY33cjmc47C2S9IZSbkBQu+zqcOIRVFMgsAgOBrCjcEpTjaEyRvI5GypRAAFoImiVD6QDANeT-Z9Uk8WdimjCFpXjeZFG4XhEW0TR4MOSlbE5dkMIQFI9BYfwQyHRw3S8Z8ZwKMU5xImCoVlWFlnhNYUS2eiGzvBB-G-fxgj0AVw2cd0gy9NTfW8ZTgicMc0muewiLBSVY3EmpFjhVZEWRDZUR6DEsRxPFCWJeTbybBA3U4tSNKZN0aRY14jPtT4uMCYN2NcZSLPnUjYIkuypIcpF1k2NFMSwNhs2IJUoB4RDaLAHzEMU5TXDcFJjKcNJEhCZ9dMAlhfGU7IeTfLsktE6yl3mRNV2VDcNUqxjTnYtxziZe5+VpYz0NeG5HzSIyR1pP5PHsCMhKgqzF3IuUVzXFMJotBCpsQdwVKA9J-G2jwmU9Vj+V9eLO0CZSBUE-IgA */
    initial: 'migratingState',

    states: {
      migratingState: {
        invoke: {
          src: 'migratePersistedState',
          id: 'migratePersistedState',
          onDone: 'initializingParameters',
        },
      },

      initializingParameters: {
        states: {
          fromDefaults: {
            always: 'fromNavigationState',
            entry: 'initializeDefaultParameters',
          },

          fromNavigationState: {
            type: 'final',
            entry: 'updateParametersFromNavigationState',
          },
        },

        initial: 'fromDefaults',

        onDone: 'resolvingSource',
      },

      resolvingSource: {
        invoke: {
          src: 'resolveSource',
          id: 'resolveSource',
          onDone: 'resolvedSource',
        },
      },

      resolvedSource: {
        on: {
          CHANGE_SOURCE: 'resolvingSource',

          CHANGE_PARAMETERS: {
            target: 'resolvedSource',
            internal: true,
            actions: ['updateParameters', 'updateNavigationState'],
          },
        },

        invoke: {
          src: 'profileController',
          id: 'profileController',
        },
      },
    },
    id: 'DiscoverMainController',
  });

export const createDiscoverMainController = () => createPureDiscoverMainController().withConfig({});

export interface DiscoverMainControllerContext {
  source: unknown;
  parameters: unknown;
}

export type DiscoverMainControllerEvent =
  | { type: 'CHANGE_SOURCE'; source: unknown }
  | { type: 'CHANGE_PARAMETERS'; parameters: unknown };
