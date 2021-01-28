/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { useCallback } from 'react';
import { decodeOrThrow } from '../../../common/runtime_types';
import {
  logEntrySearchRequestParamsRT,
  logEntrySearchResponsePayloadRT,
  LOG_ENTRY_SEARCH_STRATEGY,
} from '../../../common/search_strategies/log_entries/log_entry';
import {
  normalizeDataSearchResponses,
  useDataSearch,
  useLatestPartialDataSearchResponse,
} from '../../utils/data_search';

export const useLogEntry = ({
  sourceId,
  index,
  logEntryId,
}: {
  sourceId: string | null | undefined;
  index: string | null | undefined;
  logEntryId: string | null | undefined;
}) => {
  const { search: fetchLogEntry, requests$: logEntrySearchRequests$ } = useDataSearch({
    getRequest: useCallback(() => {
      if (sourceId == null || index == null || logEntryId == null) {
        return null;
      }
      return {
        request: {
          params: logEntrySearchRequestParamsRT.encode({ sourceId, index, logEntryId }),
        },
        options: { strategy: LOG_ENTRY_SEARCH_STRATEGY },
      };
    }, [sourceId, index, logEntryId]),
    parseResponses: parseLogEntrySearchResponses,
  });

  const {
    cancelRequest,
    isRequestRunning,
    isResponsePartial,
    latestResponseData,
    latestResponseErrors,
    loaded,
    total,
  } = useLatestPartialDataSearchResponse(logEntrySearchRequests$);

  return {
    cancelRequest,
    errors: latestResponseErrors,
    fetchLogEntry,
    isRequestRunning,
    isResponsePartial,
    loaded,
    logEntry: latestResponseData ?? null,
    total,
  };
};

const parseLogEntrySearchResponses = normalizeDataSearchResponses(
  null,
  decodeOrThrow(logEntrySearchResponsePayloadRT)
);
