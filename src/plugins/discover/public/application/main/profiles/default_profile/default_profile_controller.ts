/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { createMachine } from 'xstate';

export const createPureDefaultProfileController = (initialContext: {}) =>
  createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBEwDMCGBXANgFwAUAnAezQEscwBhEgOz1JyqIDpy7y9yMdyAvDlADEAbQAMAXUSgADiVhdy9GSAAeiAIyaAbKwAsAVgDMmgEyGANCACeWgJzjW9l-YAcb8bs2n9xgL6B1nQkEHCqqJi4hKQUVLQMTCyq8orcKkjqiAC0OtZ2CNmGzq5umvo6OmaORkEgkdj4xGSUNPSMJMxgbBxKvAJCKQpKGaAaCPpm+YhlBqWe3r4B-tYN0c1xbYmdLOyc3P38kENpynSq45UGJuZWtogWTq7uCzo+5cuBQA */
    initial: 'initializing',

    states: {
      initializing: {
        entry: 'createStateContainers',

        always: 'initialized',
      },

      initialized: {},
    },

    id: 'DefaultProfileController',
  });

export const createDefaultProfileController = ({}: {}) => createPureDefaultProfileController({});
