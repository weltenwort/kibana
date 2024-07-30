/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
// import { LogStream } from '@kbn/logs-shared-plugin/public';
// import { i18n } from '@kbn/i18n';
import { LogRateAnalysisContent } from '@kbn/aiops-plugin/public';
import useAsync from 'react-use/lib/useAsync';
import moment from 'moment';
import { pick } from 'lodash';
import { InfraLoadingPanel } from '../../../../../../components/loading';
import { useHostsViewContext } from '../../../hooks/use_hosts_view';
import { useUnifiedSearchContext } from '../../../hooks/use_unified_search';
import { useLogsSearchUrlState } from '../../../hooks/use_logs_search_url_state';
// import { LogsLinkToStream } from './logs_link_to_stream';
// import { LogsSearchBar } from './logs_search_bar';
import { buildCombinedAssetFilter } from '../../../../../../utils/filters/build';
// import { useLogViewReference } from '../../../../../../hooks/use_log_view_reference';
import { useKibanaContextForPlugin } from '../../../../../../hooks/use_kibana';

export const LogsTabContent = () => {
  const {
    services: {
      logsShared: { LogsOverview },
    },
  } = useKibanaContextForPlugin();
  const { parsedDateRange } = useUnifiedSearchContext();

  return <LogsOverview dateRange={parsedDateRange} />;
};

export const LogsTabContentOld = () => {
  const { services } = useKibanaContextForPlugin();
  const [filterQuery] = useLogsSearchUrlState();
  const { getDateRangeAsTimestamp } = useUnifiedSearchContext();
  const timeRangeMoments = useMemo(() => {
    const timeStamps = getDateRangeAsTimestamp();
    return {
      min: moment(timeStamps.from),
      max: moment(timeStamps.to),
    };
  }, [getDateRangeAsTimestamp]);
  const { hostNodes, loading } = useHostsViewContext();

  const hostsFilterQuery = useMemo(
    () =>
      buildCombinedAssetFilter({
        field: 'host.name',
        values: hostNodes.map((p) => p.name),
      }),
    [hostNodes]
  );

  const logRateDeps = useMemo(() => {
    return pick(services, [
      'analytics',
      'application',
      'data',
      'executionContext',
      'charts',
      'fieldFormats',
      'http',
      'notifications',
      'share',
      'storage',
      'uiSettings',
      'unifiedSearch',
      'theme',
      'lens',
      'i18n',
    ]);
  }, [services]);

  const dataView = useAsync(() =>
    services.dataViews.create({
      name: 'Logs',
      title: 'logs-*-*',
      timeFieldName: '@timestamp',
    })
  );

  if (loading || dataView.loading) {
    return (
      <EuiFlexGroup style={{ height: 300 }} direction="column" alignItems="stretch">
        <EuiFlexItem grow>
          <InfraLoadingPanel
            width="100%"
            height="100%"
            text={
              <FormattedMessage
                id="xpack.infra.hostsViewPage.tabs.logs.loadingEntriesLabel"
                defaultMessage="Loading entries"
              />
            }
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  if (dataView.error) {
    return `Error: ${dataView.error.message}`;
  }

  if (dataView.value == null) {
    return `Error: No data view`;
  }

  // return <pre>{`Log view: ${JSON.stringify(logView, undefined, 2)}`}</pre>;
  return (
    <LogRateAnalysisContent
      embeddingOrigin="observability_log_threshold_alert_details"
      dataView={dataView.value}
      timeRange={timeRangeMoments}
      esSearchQuery={undefined}
      initialAnalysisStart={undefined}
      appDependencies={logRateDeps}
    />
  );

  // return (
  //   <EuiFlexGroup direction="column" gutterSize="m" data-test-subj="hostsView-logs">
  //     <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false}>
  //       <EuiFlexItem>
  //         <LogsSearchBar />
  //       </EuiFlexItem>
  //       <EuiFlexItem grow={false}>
  //         <LogsLinkToStream
  //           startTime={from}
  //           endTime={to}
  //           query={logsLinkToStreamQuery}
  //           logView={logView}
  //         />
  //       </EuiFlexItem>
  //     </EuiFlexGroup>

  //     <EuiFlexItem>
  //       <LogStream
  //         height={500}
  //         logView={logView}
  //         startTimestamp={from}
  //         endTimestamp={to}
  //         filters={[hostsFilterQuery]}
  //         query={filterQuery}
  //         showFlyoutAction
  //       />
  //     </EuiFlexItem>
  //   </EuiFlexGroup>
  // );
};

const createHostsFilterQueryParam = (hostNodes: string[]): string => {
  if (!hostNodes.length) {
    return '';
  }

  const joinedHosts = hostNodes.join(' or ');
  const hostsQueryParam = `host.name:(${joinedHosts})`;

  return hostsQueryParam;
};
