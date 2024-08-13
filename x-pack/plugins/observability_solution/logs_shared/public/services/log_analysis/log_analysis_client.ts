/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import { calculateAuto } from '@kbn/calculate-auto';
import type { HttpStart } from '@kbn/core-http-browser';
import { ISearchGeneric } from '@kbn/search-types';
import moment from 'moment';
import { lastValueFrom } from 'rxjs';
import {
  RandomSamplerWrapper,
  createRandomSamplerWrapper,
  getSampleProbability,
} from '@kbn/ml-random-sampler-utils';
import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';
import {
  ChangePointAnalysisResult,
  ILogAnalysisClient,
  LogCategoriesAnalysisParams,
  LogCategoriesAnalysisResults,
  LogCategoryAnalysisResult,
  LogRateAnalysisParams,
  LogCategoryHistogramBucket,
} from './types';

const isoTimestampFormat = "YYYY-MM-DD'T'HH:mm:ss.SSS'Z'";

interface SamplingPass {
  name: string;
  getSampler: (
    analysisParams: Omit<LogCategoriesAnalysisParams, 'sampling'>,
    previousPassResult: SamplingPassResult
  ) => Promise<RandomSamplerWrapper>;
  getRequestParams: (
    analysisParams: Omit<LogCategoriesAnalysisParams, 'sampling'>,
    previousPassResult: SamplingPassResult,
    sampler: RandomSamplerWrapper
  ) => Promise<SearchRequest>;
}

interface SamplingPassResult {
  histogram: LogCategoryHistogramBucket[];
  logCategories: LogCategoryAnalysisResult[];
}

export class LogAnalysisClient implements ILogAnalysisClient {
  constructor(private readonly http: HttpStart, private readonly search: ISearchGeneric) {}

  public async getLogRateAnalysis(
    params: LogRateAnalysisParams
  ): Promise<AiopsLogRateAnalysisAPIResponse> {
    return await this.http.post<AiopsLogRateAnalysisAPIResponse>(
      '/internal/aiops/simple_log_rate_analysis',
      {
        body: JSON.stringify(params),
      }
    );
  }

  public async getLogCategoriesAnalysis({
    sampling,
    ...analysisParams
  }: LogCategoriesAnalysisParams): Promise<LogCategoriesAnalysisResults> {
    const execStartTime = performance.now();

    // TODO: abstract out sampling modes
    // i.e. samplingPasses = getSamplingPasses(sampling)
    // samplingPasses.reduce to run each pass sequentially
    const samplingPasses = getSamplingPasses(sampling.mode)({ search: this.search });

    const samplingResults: SamplingPassResult = await samplingPasses.reduce(
      async (previousPromise, samplingPass) => {
        const passStartTime = performance.now();

        const previousResult = await previousPromise;
        const sampler = await samplingPass.getSampler(analysisParams, previousResult);
        const requestParams = await samplingPass.getRequestParams(
          analysisParams,
          previousResult,
          sampler
        );
        const { rawResponse } = await lastValueFrom(this.search({ params: requestParams }));

        if (rawResponse.aggregations == null) {
          throw new Error('No aggregations found in large categories response');
        }

        const logCategoriesAggResult = sampler.unwrap(rawResponse.aggregations);

        if (!('categories' in logCategoriesAggResult)) {
          throw new Error('No categorization aggregation found in large categories response');
        }

        const logCategories =
          (logCategoriesAggResult.categories.buckets as unknown[]).map(mapCategoryBucket) ?? [];

        const passEndTime = performance.now();
        console.log(`Pass "${samplingPass.name}" execution time: ${passEndTime - passStartTime}ms`);

        return {
          histogram:
            previousResult.histogram.length > 0
              ? previousResult.histogram
              : mapCategoryHistogram(logCategoriesAggResult.histogram.buckets),
          logCategories: [...previousResult.logCategories, ...logCategories],
        };
      },
      Promise.resolve({ histogram: [], logCategories: [] } as SamplingPassResult)
    );

    const executionTime = performance.now() - execStartTime;
    console.log(`Overall execution time: ${executionTime}ms`);

    return {
      logCategories: samplingResults.logCategories,
      histogram: samplingResults.histogram,
    };
  }
}

const mapCategoryBucket = (bucket: any): LogCategoryAnalysisResult => ({
  changePoint: mapChangePoint(bucket.change),
  docCount: bucket.doc_count,
  histogram: mapCategoryHistogram(bucket.histogram.buckets),
  terms: bucket.key,
});

const mapChangePoint = (changePoint: any): ChangePointAnalysisResult => {
  const changePointType = Object.keys(changePoint?.type)[0];
  const changePointDetails = changePoint?.type[changePointType];

  if (changePointType === 'stationary') {
    return {
      type: 'stationary',
    };
  } else if (
    changePointType === 'dip' ||
    changePointType === 'spike' ||
    changePointType === 'step_change'
  ) {
    return {
      type: changePointType,
      timestamp: changePoint.bucket.key,
      docCount: changePoint.bucket.doc_count,
      pValue: changePointDetails.p_value,
    };
  } else if (changePointType === 'non_stationary') {
    return {
      type: 'non_stationary',
      pValue: changePointDetails.p_value,
      trend: changePointDetails.trend,
    };
  } else if (changePointType === 'distribution_change' || changePointType === 'trend_change') {
    return {
      type: 'distribution_change',
    };
  }

  throw new Error(`Unknown change point type: ${changePointType}`);
};

const mapCategoryHistogram = (histogramBuckets: unknown[]): LogCategoryHistogramBucket[] => {
  return histogramBuckets.map((bucket: any) => ({
    docCount: bucket.doc_count,
    timestamp: bucket.key_as_string,
  }));
};

const getSamplingPasses =
  (samplingMode: 'auto' | 'none') =>
  ({ search }: { search: ISearchGeneric }): SamplingPass[] => {
    if (samplingMode === 'auto') {
      return [
        getLargeCategoriesSamplingPass({ search }),
        getRemainingCategoriesSamplingPass({ search }),
      ];
    } else {
      return [getRemainingCategoriesSamplingPass({ search })];
    }
  };

const getLargeCategoriesSamplingPass = ({ search }: { search: ISearchGeneric }): SamplingPass => ({
  name: 'large categories',
  getSampler: async ({ index, messageField, timefield, start, end }) => {
    const { rawResponse: totalHitsResponse } = await lastValueFrom(
      search({
        params: {
          index,
          size: 0,
          track_total_hits: true,
          query: getCategorizationQuery(messageField, timefield, start, end, []),
        },
      })
    );

    const overallDocCount =
      totalHitsResponse.hits.total == null
        ? 0
        : typeof totalHitsResponse.hits.total === 'number'
        ? totalHitsResponse.hits.total
        : totalHitsResponse.hits.total.value;
    const sampleProbability = getSampleProbability(overallDocCount);

    console.log(
      `${overallDocCount} documents found, using sample probability of ${sampleProbability}`
    );

    return createRandomSamplerWrapper({
      probability: sampleProbability,
      seed: 1,
    });
  },
  getRequestParams: async (
    { index, messageField, timefield, start, end },
    _previousPassResult,
    sampler
  ) => {
    return getCategorizationRequestParams({
      index,
      timefield,
      messageField,
      start,
      end,
      minDocsPerCategory: 10,
      randomSampler: sampler,
    });
  },
});

const getRemainingCategoriesSamplingPass = ({
  search,
}: {
  search: ISearchGeneric;
}): SamplingPass => ({
  name: 'remaining categories',
  getSampler: async () => {
    return createRandomSamplerWrapper({ probability: 1, seed: 1 });
  },
  getRequestParams: async (
    { index, messageField, timefield, start, end },
    previousPassResult,
    sampler
  ) => {
    return getCategorizationRequestParams({
      index,
      timefield,
      messageField,
      start,
      end,
      ignoredQueries: previousPassResult?.logCategories.map((category) => category.terms),
      randomSampler: sampler,
    });
  },
});

const getCategorizationRequestParams = ({
  index,
  timefield,
  messageField,
  start,
  end,
  minDocsPerCategory = 0,
  ignoredQueries = [],
  randomSampler,
}: {
  start: string;
  end: string;
  index: string;
  timefield: string;
  messageField: string;
  randomSampler: RandomSamplerWrapper;
  minDocsPerCategory?: number;
  ignoredQueries?: string[];
}) => {
  const startMoment = moment(start, isoTimestampFormat);
  const endMoment = moment(end, isoTimestampFormat);
  const fixedIntervalDuration = calculateAuto.atLeast(
    24,
    moment.duration(endMoment.diff(startMoment))
  );
  const fixedIntervalSize = `${fixedIntervalDuration?.asMinutes()}m`;

  return {
    index,
    size: 0,
    track_total_hits: false,
    query: getCategorizationQuery(messageField, timefield, start, end, ignoredQueries),
    aggs: randomSampler.wrap({
      histogram: {
        date_histogram: {
          field: '@timestamp',
          fixed_interval: fixedIntervalSize,
          extended_bounds: {
            min: start,
            max: end,
          },
        },
      },
      categories: {
        categorize_text: {
          field: 'message',
          size: 1000,
          categorization_analyzer: {
            tokenizer: 'standard',
          },
          min_doc_count: minDocsPerCategory,
        },
        aggs: {
          histogram: {
            date_histogram: {
              field: '@timestamp',
              fixed_interval: fixedIntervalSize,
              extended_bounds: {
                min: start,
                max: end,
              },
            },
          },
          change: {
            // @ts-expect-error
            change_point: {
              buckets_path: 'histogram>_count',
            },
          },
        },
      },
    }),
  };
};

const getCategorizationQuery = (
  messageField: string,
  timefield: string,
  start: string,
  end: string,
  ignoredQueries: string[]
) => {
  return {
    bool: {
      filter: [
        {
          exists: {
            field: messageField,
          },
        },
        {
          range: {
            [timefield]: {
              gte: start,
              lte: end,
              format: 'strict_date_time',
            },
          },
        },
      ],
      must_not: ignoredQueries.map((ignoredQuery) => ({
        match: {
          [messageField]: {
            query: ignoredQuery,
            operator: 'AND' as const,

            fuzziness: 0,
            auto_generate_synonyms_phrase_query: false,
          },
        },
      })),
    },
  };
};
