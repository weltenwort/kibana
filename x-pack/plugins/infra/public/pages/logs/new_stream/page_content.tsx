/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useActor } from '@xstate/react';
import React from 'react';
import { APP_WRAPPER_CLASS } from '../../../../../../../src/core/public';
import { euiStyled } from '../../../../../../../src/plugins/kibana_react/common';
import { LogSourceErrorPage } from '../../../components/logging/log_source_error_page';
import { SourceLoadingPage } from '../../../components/source_loading_page';
import { LogStreamPageContentStream } from './page_content_stream';
import { LogStreamPageContentMissingIndices } from './page_content_missing_indices';
import { useLogStreamPageStateContext } from './page_providers';

export const LogStreamPageContent = React.memo(() => {
  const pageStateMachineInterpreter = useLogStreamPageStateContext();
  const [state] = useActor(pageStateMachineInterpreter);

  if (state.matches('waitingForSource')) {
    return <SourceLoadingPage />;
  } else if (state.matches({ hasLogSource: 'hasIndices' })) {
    console.log(state.children);
    return (
      <LogStreamPageWrapper className={APP_WRAPPER_CLASS}>
        <LogStreamPageContentStream pageStateMachineInterpreter={pageStateMachineInterpreter} />
      </LogStreamPageWrapper>
    );
  } else if (state.matches({ hasLogSource: 'isMissingIndices' })) {
    return (
      <LogStreamPageWrapper className={APP_WRAPPER_CLASS}>
        <LogStreamPageContentMissingIndices />
      </LogStreamPageWrapper>
    );
  } else {
    return <LogSourceErrorPage />;
    // return <LogSourceErrorPage errors={latestLoadSourceFailures} onRetry={loadSource} />;
  }
});

// This is added to facilitate a full height layout whereby the
// inner container will set it's own height and be scrollable.
// The "fullHeight" prop won't help us as it only applies to certain breakpoints.
const LogStreamPageWrapper = euiStyled.div`
  .euiPage .euiPageContentBody {
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    width: 100%;
    height: 100%;
  }
`;
