/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createActor, waitFor } from 'xstate5';
import { CategorizeLogsService, CategorizeLogsServiceDependencies } from './types';
import {
  categorizeLogsStateMachine,
  createCategorizeLogsStateMachineImplementations,
} from './categorize_logs_state_machine';

export const createCategorizeLogsService = ({
  search,
}: CategorizeLogsServiceDependencies): CategorizeLogsService => {
  return {
    categorizeLogs: async (input, { abortSignal = undefined } = {}) => {
      const categorizeLogsActor = createActor(
        categorizeLogsStateMachine.provide(
          createCategorizeLogsStateMachineImplementations({ search })
        ),
        {
          input,
        }
      );

      const { output } = await waitFor(
        categorizeLogsActor,
        (snapshot) => snapshot.status === 'done',
        {
          signal: abortSignal,
        }
      );

      if (output == null) {
        throw new Error('Categorization did not produce an output');
      }

      return output;
    },
  };
};
