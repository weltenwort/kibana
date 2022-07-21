/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import {
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHideFor,
  EuiPage,
  EuiPageBody,
  EuiPageContent,
  EuiSpacer,
} from '@elastic/eui';
import { METRIC_TYPE } from '@kbn/analytics';
import type { SavedObject } from '@kbn/data-plugin/public';
import { generateFilters, ISearchSource } from '@kbn/data-plugin/public';
import type { DataViewAttributes } from '@kbn/data-views-plugin/public';
import { DataView, DataViewField, DataViewType } from '@kbn/data-views-plugin/public';
import type { Query, TimeRange } from '@kbn/es-query';
import { i18n } from '@kbn/i18n';
import { RequestAdapter } from '@kbn/inspector-plugin';
import { InspectorSession } from '@kbn/inspector-plugin/public';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SEARCH_FIELDS_FROM_SOURCE } from '../../../../../common';
import { VIEW_MODE } from '../../../../components/view_mode_toggle';
import { useColumns } from '../../../../hooks/use_data_grid_columns';
import { useDiscoverServices } from '../../../../hooks/use_discover_services';
import { DocViewFilterFn } from '../../../../services/doc_views/doc_views_types';
import { SavedSearch, SavedSearchURLConflictCallout } from '../../../../services/saved_searches';
import { DataTableRecord } from '../../../../types';
import { popularizeField } from '../../../../utils/popularize_field';
import '../../../main/components/layout/discover_layout.scss';
import { hasActiveFilter } from '../../../main/components/layout/utils';
import { LoadingSpinner } from '../../../main/components/loading_spinner/loading_spinner';
import { DiscoverNoResults } from '../../../main/components/no_results';
import { DiscoverSidebarResponsive } from '../../../main/components/sidebar';
import { DiscoverTopNav } from '../../../main/components/top_nav/discover_topnav';
import { DiscoverUninitialized } from '../../../main/components/uninitialized/uninitialized';
import { useDataState } from '../../../main/hooks/use_data_state';
import { DataMainMsg } from '../../../main/hooks/use_saved_search';
import { getResultState } from '../../../main/utils/get_result_state';
import { FetchStatus } from '../../../types';
import { DataRefetch$, SavedSearchData } from '../../../main/hooks/use_saved_search';
import { AppState, GetStateReturn } from '../../../main/services/discover_state';
import { LogExplorer } from './log_explorer';
import { DataAccessService } from '../../state_machines';

/**
 * Local storage key for sidebar persistence state
 */
export const SIDEBAR_CLOSED_KEY = 'discover:sidebarClosed';

const SidebarMemoized = React.memo(DiscoverSidebarResponsive);
const TopNavMemoized = React.memo(DiscoverTopNav);

export function LogExplorerLayout({
  dataAccessService,
  indexPattern,
  indexPatternList,
  inspectorAdapters,
  expandedDoc,
  navigateTo,
  onChangeIndexPattern,
  onUpdateQuery,
  setExpandedDoc,
  savedSearchRefetch$,
  resetSavedSearch,
  savedSearchData$,
  savedSearch,
  searchSource,
  state,
  stateContainer,
}: {
  dataAccessService: DataAccessService;
  indexPattern: DataView;
  indexPatternList: Array<SavedObject<DataViewAttributes>>;
  inspectorAdapters: { requests: RequestAdapter };
  navigateTo: (url: string) => void;
  onChangeIndexPattern: (id: string) => void;
  onUpdateQuery: (payload: { dateRange: TimeRange; query?: Query }, isUpdate?: boolean) => void;
  resetSavedSearch: () => void;
  expandedDoc?: DataTableRecord;
  setExpandedDoc: (doc?: DataTableRecord) => void;
  savedSearch: SavedSearch;
  savedSearchData$: SavedSearchData;
  savedSearchRefetch$: DataRefetch$;
  searchSource: ISearchSource;
  state: AppState;
  stateContainer: GetStateReturn;
}) {
  const {
    trackUiMetric,
    capabilities,
    indexPatterns,
    data,
    uiSettings,
    filterManager,
    storage,
    history,
    spaces,
    inspector,
  } = useDiscoverServices();
  const { main$ } = savedSearchData$;
  const [inspectorSession, setInspectorSession] = useState<InspectorSession | undefined>(undefined);

  const fetchCounter = useRef<number>(0);
  const dataState: DataMainMsg = useDataState(main$);

  useEffect(() => {
    if (dataState.fetchStatus === FetchStatus.LOADING) {
      fetchCounter.current++;
    }
  }, [dataState.fetchStatus]);

  // We treat rollup v1 data views as non time based in Discover, since we query them
  // in a non time based way using the regular _search API, since the internal
  // representation of those documents does not have the time field that _field_caps
  // reports us.
  const isTimeBased = useMemo(() => {
    return indexPattern.type !== DataViewType.ROLLUP && indexPattern.isTimeBased();
  }, [indexPattern]);

  const initialSidebarClosed = Boolean(storage.get(SIDEBAR_CLOSED_KEY));
  const [isSidebarClosed, setIsSidebarClosed] = useState(initialSidebarClosed);
  const useNewFieldsApi = useMemo(() => !uiSettings.get(SEARCH_FIELDS_FROM_SOURCE), [uiSettings]);

  const resultState = useMemo(
    () => getResultState(dataState.fetchStatus, dataState.foundDocuments!),
    [dataState.fetchStatus, dataState.foundDocuments]
  );

  const onOpenInspector = useCallback(() => {
    // prevent overlapping
    setExpandedDoc(undefined);
    const session = inspector.open(inspectorAdapters, {
      title: savedSearch.title,
    });
    setInspectorSession(session);
  }, [setExpandedDoc, inspectorAdapters, savedSearch, inspector]);

  useEffect(() => {
    return () => {
      if (inspectorSession) {
        // Close the inspector if this scope is destroyed (e.g. because the user navigates away).
        inspectorSession.close();
      }
    };
  }, [inspectorSession]);

  const { columns, onAddColumn, onRemoveColumn } = useColumns({
    capabilities,
    config: uiSettings,
    indexPattern,
    indexPatterns,
    setAppState: stateContainer.setAppState,
    state,
    useNewFieldsApi,
  });

  const onAddFilter = useCallback(
    (field: DataViewField | string, values: unknown, operation: '+' | '-') => {
      const fieldName = typeof field === 'string' ? field : field.name;
      popularizeField(indexPattern, fieldName, indexPatterns, capabilities);
      const newFilters = generateFilters(filterManager, field, values, operation, indexPattern);
      if (trackUiMetric) {
        trackUiMetric(METRIC_TYPE.CLICK, 'filter_added');
      }
      return filterManager.addFilters(newFilters);
    },
    [filterManager, indexPattern, indexPatterns, trackUiMetric, capabilities]
  );

  const onFieldEdited = useCallback(() => {
    savedSearchRefetch$.next('reset');
  }, [savedSearchRefetch$]);

  const onDisableFilters = useCallback(() => {
    const disabledFilters = filterManager
      .getFilters()
      .map((filter) => ({ ...filter, meta: { ...filter.meta, disabled: true } }));
    filterManager.setFilters(disabledFilters);
  }, [filterManager]);

  const toggleSidebarCollapse = useCallback(() => {
    storage.set(SIDEBAR_CLOSED_KEY, !isSidebarClosed);
    setIsSidebarClosed(!isSidebarClosed);
  }, [isSidebarClosed, storage]);

  const contentCentered = resultState === 'uninitialized' || resultState === 'none';
  const onDataViewCreated = useCallback(
    (dataView: DataView) => {
      if (dataView.id) {
        onChangeIndexPattern(dataView.id);
      }
    },
    [onChangeIndexPattern]
  );

  const savedSearchTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    savedSearchTitle.current?.focus();
  }, []);

  return (
    <EuiPage className="dscPage" data-fetch-counter={fetchCounter.current}>
      <h1
        id="savedSearchTitle"
        className="euiScreenReaderOnly"
        data-test-subj="discoverSavedSearchTitle"
        tabIndex={-1}
        ref={savedSearchTitle}
      >
        {savedSearch.title
          ? i18n.translate('discover.pageTitleWithSavedSearch', {
              defaultMessage: 'Discover - {savedSearchTitle}',
              values: {
                savedSearchTitle: savedSearch.title,
              },
            })
          : i18n.translate('discover.pageTitleWithoutSavedSearch', {
              defaultMessage: 'Discover - Search not yet saved',
            })}
      </h1>
      <TopNavMemoized
        indexPattern={indexPattern}
        onOpenInspector={onOpenInspector}
        query={state.query}
        navigateTo={navigateTo}
        savedQuery={state.savedQuery}
        savedSearch={savedSearch}
        searchSource={searchSource}
        stateContainer={stateContainer}
        updateQuery={onUpdateQuery}
        resetSavedSearch={resetSavedSearch}
        onChangeIndexPattern={onChangeIndexPattern}
        onFieldEdited={onFieldEdited}
      />
      <EuiPageBody className="dscPageBody" aria-describedby="savedSearchTitle">
        <SavedSearchURLConflictCallout
          savedSearch={savedSearch}
          spaces={spaces}
          history={history}
        />
        <EuiFlexGroup className="dscPageBody__contents" gutterSize="s">
          <EuiFlexItem grow={false}>
            <SidebarMemoized
              columns={columns}
              documents$={savedSearchData$.documents$}
              indexPatternList={indexPatternList}
              onAddField={onAddColumn}
              onAddFilter={onAddFilter}
              onRemoveField={onRemoveColumn}
              onChangeIndexPattern={onChangeIndexPattern}
              selectedIndexPattern={indexPattern}
              state={state}
              isClosed={isSidebarClosed}
              trackUiMetric={trackUiMetric}
              useNewFieldsApi={useNewFieldsApi}
              onFieldEdited={onFieldEdited}
              viewMode={VIEW_MODE.DOCUMENT_LEVEL}
              onDataViewCreated={onDataViewCreated}
              availableFields$={savedSearchData$.availableFields$}
            />
          </EuiFlexItem>
          <EuiHideFor sizes={['xs', 's']}>
            <EuiFlexItem grow={false}>
              <div>
                <EuiSpacer size="s" />
                <EuiButtonIcon
                  iconType={isSidebarClosed ? 'menuRight' : 'menuLeft'}
                  iconSize="m"
                  size="xs"
                  onClick={toggleSidebarCollapse}
                  data-test-subj="collapseSideBarButton"
                  aria-controls="discover-sidebar"
                  aria-expanded={isSidebarClosed ? 'false' : 'true'}
                  aria-label={i18n.translate('discover.toggleSidebarAriaLabel', {
                    defaultMessage: 'Toggle sidebar',
                  })}
                />
              </div>
            </EuiFlexItem>
          </EuiHideFor>
          <EuiFlexItem className="dscPageContent__wrapper">
            <EuiPageContent
              verticalPosition={contentCentered ? 'center' : undefined}
              horizontalPosition={contentCentered ? 'center' : undefined}
              paddingSize="none"
              hasShadow={false}
              className={classNames('dscPageContent', {
                'dscPageContent--centered': contentCentered,
                'dscPageContent--emptyPrompt': resultState === 'none',
              })}
            >
              {resultState === 'none' && (
                <DiscoverNoResults
                  isTimeBased={isTimeBased}
                  data={data}
                  error={dataState.error}
                  hasQuery={!!state.query?.query}
                  hasFilters={hasActiveFilter(state.filters)}
                  onDisableFilters={onDisableFilters}
                />
              )}
              {resultState === 'uninitialized' && (
                <DiscoverUninitialized onRefresh={() => savedSearchRefetch$.next(undefined)} />
              )}
              {resultState === 'loading' && <LoadingSpinner />}
              {resultState === 'ready' && (
                <EuiFlexGroup
                  className="dscPageContent__inner"
                  direction="column"
                  alignItems="stretch"
                  gutterSize="none"
                  responsive={false}
                >
                  <LogExplorer
                    // documents$={savedSearchData$.documents$}
                    expandedDoc={expandedDoc}
                    dataView={indexPattern}
                    onAddFilter={onAddFilter as DocViewFilterFn}
                    savedSearch={savedSearch}
                    setExpandedDoc={setExpandedDoc}
                    state={state}
                    stateContainer={stateContainer}
                  />
                </EuiFlexGroup>
              )}
            </EuiPageContent>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPageBody>
    </EuiPage>
  );
}
