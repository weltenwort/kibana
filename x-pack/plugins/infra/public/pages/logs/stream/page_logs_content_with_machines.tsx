/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useInterpret, useMachine } from '@xstate/react';
import { useMemo } from 'react';
import { IKibanaSearchRequest } from 'src/plugins/data/public';
import { decodeOrThrow } from '../../../../common/runtime_types';
import {
  LogEntriesSearchRequestParams,
  LogEntriesSearchResponsePayload,
  logEntriesSearchResponsePayloadRT,
} from '../../../../common/search_strategies/log_entries/log_entries';
import { useKibanaContextForPlugin } from '../../../hooks/use_kibana';
import {
  normalizeDataSearchResponses,
  ParsedKibanaSearchResponse,
} from '../../../utils/data_search';
import {
  createDataSearchMachine,
  createSearchService,
} from '../../../utils/data_search/data_search_machine';

export const LogsPageLogsContentWithMachines = () => {
  const {
    services: {
      data: {
        search: { search },
      },
    },
  } = useKibanaContextForPlugin();
  const logEntriesSearchService = useMemo(
    () => createSearchService(search, parseLogEntriesSearchResponses),
    [search]
  );
  const [state, send] = useMachine(logEntriesMachine, {
    devTools: true,
    services: {
      search: logEntriesSearchService,
    },
  });

  return null;
};

const logEntriesMachine = createDataSearchMachine<
  IKibanaSearchRequest<LogEntriesSearchRequestParams>,
  ParsedKibanaSearchResponse<LogEntriesSearchResponsePayload>
>();

const parseLogEntriesSearchResponses = normalizeDataSearchResponses(
  null,
  decodeOrThrow(logEntriesSearchResponsePayloadRT)
);
