/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import React from 'react';

import { AutocompleteField } from '../components/autocomplete_field';
import { LocalEuiFlexGroup } from '../components/eui';
import { Header } from '../components/header';
import { ColumnarPage, FlexPage } from '../components/page';
import { Waffle } from '../components/waffle';
import { WaffleNodeTypeControls } from '../components/waffle/waffle_node_type_controls';
import { WaffleTimeControls } from '../components/waffle/waffle_time_controls';
import {
  WithWaffleFilter,
  WithWaffleFilterUrlState,
} from '../containers/waffle/with_waffle_filters';

import { WithWaffleNodes } from '../containers/waffle/with_waffle_nodes';
import { WithWaffleTime, WithWaffleTimeUrlState } from '../containers/waffle/with_waffle_time';
import { WithKueryAutocompletion } from '../containers/with_kuery_autocompletion';
import { WithOptions } from '../containers/with_options';

export class HomePage extends React.PureComponent {
  public render() {
    return (
      <ColumnarPage>
        <WithWaffleTimeUrlState />
        <WithWaffleFilterUrlState />
        <Header />
        <FlexPage>
          <LocalEuiFlexGroup direction="column">
            <EuiFlexItem grow={false}>
              <EuiFlexGroup>
                <EuiFlexItem />
                <EuiFlexItem grow={false}>
                  <WaffleNodeTypeControls />
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="m">
                <EuiFlexItem>
                  <WithKueryAutocompletion>
                    {({ isLoadingSuggestions, loadSuggestions, suggestions }) => (
                      <WithWaffleFilter>
                        {({
                          applyFilterQueryFromKueryExpression,
                          filterQueryDraft,
                          isFilterQueryDraftValid,
                          setFilterQueryDraftFromKueryExpression,
                        }) => (
                          <AutocompleteField
                            isLoadingSuggestions={isLoadingSuggestions}
                            isValid={isFilterQueryDraftValid}
                            loadSuggestions={loadSuggestions}
                            onChange={setFilterQueryDraftFromKueryExpression}
                            onSubmit={applyFilterQueryFromKueryExpression}
                            placeholder="Search for infrastructure data... (e.g. host.name:host-1)"
                            suggestions={suggestions}
                            value={filterQueryDraft ? filterQueryDraft.expression : ''}
                          />
                        )}
                      </WithWaffleFilter>
                    )}
                  </WithKueryAutocompletion>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <WithWaffleTime>
                    {({
                      currentTime,
                      isAutoReloading,
                      jumpToTime,
                      startAutoReload,
                      stopAutoReload,
                    }) => (
                      <WaffleTimeControls
                        currentTime={currentTime}
                        isLiveStreaming={isAutoReloading}
                        onChangeTime={jumpToTime}
                        startLiveStreaming={startAutoReload}
                        stopLiveStreaming={stopAutoReload}
                      />
                    )}
                  </WithWaffleTime>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem>
              <WithOptions>
                {({ wafflemap }) => (
                  <WithWaffleFilter>
                    {({ filterQueryAsJson }) => (
                      <WithWaffleTime>
                        {({ currentTimeRange }) => (
                          <WithWaffleNodes
                            filterQuery={filterQueryAsJson}
                            metrics={wafflemap.metrics}
                            path={wafflemap.path}
                            sourceId={wafflemap.sourceId}
                            timerange={currentTimeRange}
                          >
                            {({ nodes }) => <Waffle map={nodes} options={wafflemap} />}
                          </WithWaffleNodes>
                        )}
                      </WithWaffleTime>
                    )}
                  </WithWaffleFilter>
                )}
              </WithOptions>
            </EuiFlexItem>
          </LocalEuiFlexGroup>
        </FlexPage>
      </ColumnarPage>
    );
  }
}
