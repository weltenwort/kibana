/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { CoreStart } from '@kbn/core/public';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { DatasetQualityContext, DatasetQualityContextValue } from './context';
import { useKibanaContextForPluginProvider } from '../../utils';
import { DatasetQualityStartDeps } from '../../types';
import { Header } from './header';
import { Table } from './table';
import { DataStreamsStatsServiceStart } from '../../services/data_streams_stats';

export interface CreateDatasetQualityArgs {
  core: CoreStart;
  plugins: DatasetQualityStartDeps;
  dataStreamsStatsService: DataStreamsStatsServiceStart;
}

export const createDatasetQuality = ({
  core,
  plugins,
  dataStreamsStatsService,
}: CreateDatasetQualityArgs) => {
  const datasetQualityProviderValue: DatasetQualityContextValue = {
    dataStreamsStatsServiceClient: dataStreamsStatsService.client,
  };

  return () => {
    const KibanaContextProviderForPlugin = useKibanaContextForPluginProvider(core, plugins);

    return (
      <DatasetQualityContext.Provider value={datasetQualityProviderValue}>
        <KibanaContextProviderForPlugin>
          <DatasetQuality />
        </KibanaContextProviderForPlugin>
      </DatasetQualityContext.Provider>
    );
  };
};

function DatasetQuality() {
  return (
    <EuiFlexGroup direction="column" gutterSize="m">
      <EuiFlexItem grow={false}>
        <Header />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <Table />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
