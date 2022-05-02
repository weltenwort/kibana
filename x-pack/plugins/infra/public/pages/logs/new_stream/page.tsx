/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiErrorBoundary } from '@elastic/eui';
import React from 'react';
import { useTrackPageview } from '../../../../../observability/public';
import { useLogsBreadcrumbs } from '../../../hooks/use_logs_breadcrumbs';
import { streamTitle } from '../../../translations';
import { LogStreamPageContent } from './page_content';
import { LogStreamPageProvider } from './page_providers';

export const LogStreamPage = () => {
  useTrackPageview({ app: 'infra_logs', path: 'stream' });
  useTrackPageview({ app: 'infra_logs', path: 'stream', delay: 15000 });

  useLogsBreadcrumbs([
    {
      text: streamTitle,
    },
  ]);

  return (
    <EuiErrorBoundary>
      <LogStreamPageProvider>
        <LogStreamPageContent />
      </LogStreamPageProvider>
    </EuiErrorBoundary>
  );
};
