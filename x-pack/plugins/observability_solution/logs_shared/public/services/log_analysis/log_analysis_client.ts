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
  ChangePointAnalysisResult,
  ILogAnalysisClient,
  LogCategoriesAnalysisParams,
  LogCategoriesAnalysisResults,
  LogCategoryAnalysisResult,
  LogRateAnalysisParams,
  LogRateCategoryHistogramBucket,
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
  }: LogCategoriesAnalysisParams): Promise<LogCategoriesAnalysisResults> {
    const startMoment = moment(start, isoTimestampFormat);
    const endMoment = moment(end, isoTimestampFormat);
    const fixedIntervalDuration = calculateAuto.atLeast(
      24,
      moment.duration(endMoment.diff(startMoment))
    );
    const fixedIntervalSize = `${fixedIntervalDuration?.asMinutes()}m`;

    console.log(startMoment, endMoment, fixedIntervalDuration);

    const { rawResponse: categoriesResponse } = await lastValueFrom(
      this.search({
        params: {
          index,
          size: 0,
          track_total_hits: false,
          query: {
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
            },
          },
          aggs: {
            categories: {
              categorize_text: {
                field: 'message',
                size: 1000,
                categorization_analyzer: {
                  tokenizer: 'standard',
                },
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
                  change_point: {
                    buckets_path: 'histogram>_count',
                  },
                },
              },
            },
          },
        },
      })
    );

    console.log(categoriesResponse);

    return {
      logCategories:
        categoriesResponse.aggregations?.categories.buckets.map(mapCategoryBucket) ?? [],
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

const mapCategoryHistogram = (histogramBuckets: unknown[]): LogRateCategoryHistogramBucket[] => {
  return histogramBuckets.map((bucket: any) => ({
    docCount: bucket.doc_count,
    timestamp: bucket.key_as_string,
  }));
};
