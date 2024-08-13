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
    index,
    timefield,
    messageField,
    start,
    end,
    sampling,
  }: LogCategoriesAnalysisParams): Promise<LogCategoriesAnalysisResults> {
    const execStartTime = performance.now();

    // TODO: abstract out sampling modes
    // i.e. samplingPasses = getSamplingPasses(sampling)
    // samplingPasses.reduce to run each pass sequentially
    // if (sampling.mode === 'auto') {
    const { rawResponse: totalHitsResponse } = await lastValueFrom(
      this.search({
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

    const docCountDoneTime = performance.now();

    console.log(`Doc count time: ${docCountDoneTime - execStartTime}ms`);
    console.log(
      `${overallDocCount} documents found, using sample probability of ${sampleProbability}`
    );

    const largeCategoriesSampler = createRandomSamplerWrapper({
      probability: sampleProbability,
      seed: 0,
    });

    const { rawResponse: largeCategoriesResponse } = await lastValueFrom(
      this.search({
        params: getCategorizationRequestParams({
          index,
          timefield,
          messageField,
          start,
          end,
          minDocsPerCategory: 10,
          randomSampler: largeCategoriesSampler,
        }),
      })
    );

    if (largeCategoriesResponse.aggregations == null) {
      throw new Error('No aggregations found in large categories response');
    }

    const largeCategoriesAggResult = largeCategoriesSampler.unwrap(
      largeCategoriesResponse.aggregations
    );

    if (!('categories' in largeCategoriesAggResult)) {
      throw new Error('No categorization aggregation found in large categories response');
    }

    const largeCategories =
      (largeCategoriesAggResult.categories.buckets as unknown[]).map(mapCategoryBucket) ?? [];

    const largeCategoriesDoneTime = performance.now();
    console.log(`Large categories time: ${largeCategoriesDoneTime - docCountDoneTime}ms`);

    const smallCategoriesSampler = createRandomSamplerWrapper({ probability: 1, seed: 0 });

    const { rawResponse: smallCategoriesResponse } = await lastValueFrom(
      this.search({
        params: getCategorizationRequestParams({
          index,
          timefield,
          messageField,
          start,
          end,
          ignoredQueries: largeCategories.map((category) => category.terms),
          randomSampler: smallCategoriesSampler,
        }),
      })
    );

    if (smallCategoriesResponse.aggregations == null) {
      throw new Error('No aggregations found in small categories response');
    }

    const smallCategoriesAggResult = smallCategoriesSampler.unwrap(
      smallCategoriesResponse.aggregations
    );

    if (!('categories' in smallCategoriesAggResult)) {
      throw new Error('No categorization aggregation found in small categories response');
    }

    const smallCategories =
      (smallCategoriesAggResult.categories.buckets as unknown[]).map(mapCategoryBucket) ?? [];

    const smallCategoriesDoneTime = performance.now();
    console.log(`Small categories time: ${smallCategoriesDoneTime - largeCategoriesDoneTime}ms`);

    const executionTime = smallCategoriesDoneTime - execStartTime;
    console.log(`Overall execution time: ${executionTime}ms`);

    return {
      logCategories: [...largeCategories, ...smallCategories],
      // logCategories: largeCategories,
      histogram: mapCategoryHistogram(largeCategoriesAggResult.histogram.buckets),
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
            operator: 'AND',

            fuzziness: 0,
            auto_generate_synonyms_phrase_query: false,
          },
        },
      })),
    },
  };
};
