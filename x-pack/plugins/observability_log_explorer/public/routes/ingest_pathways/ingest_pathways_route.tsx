/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { EuiEmptyPrompt, EuiLoadingLogo } from '@elastic/eui';
import { useActor } from '@xstate/react';
import React from 'react';
import { IngestPathways } from '../../components/ingest_pathways';
import { ObservabilityLogExplorerPageTemplate } from '../../components/page_template';
import {
  IngestPathwaysPageStateProvider,
  useIngestPathwaysPageStateContext,
} from '../../state_machines/ingest_pathways';
import { ObservabilityLogExplorerHistory } from '../../types';
import { noBreadcrumbs, useBreadcrumbs } from '../../utils/breadcrumbs';
// import { useKbnUrlStateStorageFromRouterContext } from '../../utils/kbn_url_state_context';
import { useKibanaContextForPlugin } from '../../utils/use_kibana';

export const IngestPathwaysRoute = () => {
  const {
    services: {
      chrome,
      data: {
        search: { search },
      },
      datasetQuality: {
        dataStreamsStatsService: { client: dataStreamsStatsClient },
      },
      serverless,
    },
  } = useKibanaContextForPlugin();

  useBreadcrumbs(noBreadcrumbs, chrome, serverless);

  // const urlStateStorageContainer = useKbnUrlStateStorageFromRouterContext();

  return (
    <IngestPathwaysPageStateProvider
      dataStreamsStatsClient={dataStreamsStatsClient}
      search={search}
    >
      <ConnectedContent />
    </IngestPathwaysPageStateProvider>
  );
};

const ConnectedContent = React.memo(() => {
  const {
    services: {
      appParams: { history },
    },
  } = useKibanaContextForPlugin();

  const [state] = useActor(useIngestPathwaysPageStateContext());

  if (state.matches('uninitialized')) {
    return <InitializingContent />;
  } else {
    return <InitializedContent history={history} />;
  }
});

const InitializingContent = React.memo(() => (
  <ObservabilityLogExplorerPageTemplate>
    <EuiEmptyPrompt
      icon={<EuiLoadingLogo logo="logoKibana" size="xl" />}
      title={<h2>Initializing</h2>}
    />
  </ObservabilityLogExplorerPageTemplate>
));

const InitializedContent = React.memo(
  ({ history }: { history: ObservabilityLogExplorerHistory }) => {
    return <IngestPathways />;
  }
);
