/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiPageHeaderProps } from '@elastic/eui';
import React, { useMemo } from 'react';
import { ObservabilityLogExplorerPageTemplate } from '../page_template';
import { ConnectedLoadingIndicator } from './loading_indicator';

export const IngestPathways = React.memo(() => {
  const pageHeaderProps = useMemo(
    (): EuiPageHeaderProps => ({
      alignItems: 'center',
      bottomBorder: 'extended',
      pageTitle: 'Ingest Pathways',
      rightSideItems: [<ConnectedLoadingIndicator />],
    }),
    []
  );

  return (
    <ObservabilityLogExplorerPageTemplate pageHeaderProps={pageHeaderProps}>
      x
    </ObservabilityLogExplorerPageTemplate>
  );
});
