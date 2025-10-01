import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { logger } from '../utils/logger';

const searchLogger = logger.child({ context: 'search' });

export interface IndexedMessage {
  message_uuid: string;
  account_id: string;
  message_id: string;
  subject: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  date: Date;
  body_text: string;
  body_html: string;
  folder: string;
  labels: string[];
  has_attachments: boolean;
  attachment_filenames: string[];
  is_read: boolean;
  is_starred: boolean;
}

export interface SearchQuery {
  query?: string;
  accountIds?: string[];
  folders?: string[];
  labels?: string[];
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  fromDate?: Date;
  toDate?: Date;
  fromEmail?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  messages: IndexedMessage[];
  total: number;
  page: number;
  pageSize: number;
  aggregations?: any;
}

export class SearchService {
  private static instance: SearchService;
  private client: Client;
  private indexName: string;

  private constructor() {
    const auth = config.elasticsearchUsername && config.elasticsearchPassword
      ? {
          username: config.elasticsearchUsername,
          password: config.elasticsearchPassword,
        }
      : undefined;

    this.client = new Client({
      node: config.elasticsearchNode,
      auth,
    });

    this.indexName = config.elasticsearchIndex;
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        // Create index with mappings
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
              'index.max_result_window': 100000,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'uax_url_email',
                    filter: ['lowercase', 'stop'],
                  },
                },
              },
            },
            mappings: {
              properties: {
                message_uuid: { type: 'keyword' },
                account_id: { type: 'keyword' },
                message_id: { type: 'keyword' },
                subject: {
                  type: 'text',
                  analyzer: 'standard',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                from_email: {
                  type: 'keyword',
                  fields: {
                    text: {
                      type: 'text',
                      analyzer: 'email_analyzer',
                    },
                  },
                },
                from_name: { type: 'text' },
                to_emails: { type: 'keyword' },
                date: { type: 'date' },
                body_text: {
                  type: 'text',
                  analyzer: 'standard',
                },
                body_html: {
                  type: 'text',
                  analyzer: 'standard',
                },
                folder: { type: 'keyword' },
                labels: { type: 'keyword' },
                has_attachments: { type: 'boolean' },
                attachment_filenames: { type: 'text' },
                is_read: { type: 'boolean' },
                is_starred: { type: 'boolean' },
              },
            },
          },
        });
        searchLogger.info('Created Elasticsearch index', { index: this.indexName });
      } else {
        searchLogger.info('Elasticsearch index already exists', { index: this.indexName });
      }

      searchLogger.info('Search service initialized successfully');
    } catch (error) {
      searchLogger.error('Failed to initialize search service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async indexMessage(message: IndexedMessage): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: message.message_uuid,
        document: message,
        refresh: false, // Bulk indexing will refresh
      });

      searchLogger.debug('Indexed message', {
        messageUuid: message.message_uuid,
        subject: message.subject,
      });
    } catch (error) {
      searchLogger.error('Failed to index message', {
        messageUuid: message.message_uuid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async bulkIndexMessages(messages: IndexedMessage[]): Promise<void> {
    try {
      const operations = messages.flatMap((message) => [
        { index: { _index: this.indexName, _id: message.message_uuid } },
        message,
      ]);

      const response = await this.client.bulk({
        operations,
        refresh: true,
      });

      if (response.errors) {
        const erroredDocuments = response.items.filter((item: any) => item.index?.error);
        searchLogger.warn('Some documents failed to index', {
          count: erroredDocuments.length,
          errors: erroredDocuments.map((item: any) => item.index?.error),
        });
      }

      searchLogger.info('Bulk indexed messages', { count: messages.length });
    } catch (error) {
      searchLogger.error('Failed to bulk index messages', {
        count: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async search(query: SearchQuery): Promise<SearchResult> {
    try {
      const must: any[] = [];
      const filter: any[] = [];

      // Full-text search
      if (query.query) {
        must.push({
          multi_match: {
            query: query.query,
            fields: ['subject^3', 'body_text^2', 'from_name', 'attachment_filenames'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      // Filters
      if (query.accountIds && query.accountIds.length > 0) {
        filter.push({ terms: { account_id: query.accountIds } });
      }

      if (query.folders && query.folders.length > 0) {
        filter.push({ terms: { folder: query.folders } });
      }

      if (query.labels && query.labels.length > 0) {
        filter.push({ terms: { labels: query.labels } });
      }

      if (query.hasAttachments !== undefined) {
        filter.push({ term: { has_attachments: query.hasAttachments } });
      }

      if (query.isRead !== undefined) {
        filter.push({ term: { is_read: query.isRead } });
      }

      if (query.isStarred !== undefined) {
        filter.push({ term: { is_starred: query.isStarred } });
      }

      if (query.fromEmail) {
        filter.push({ term: { from_email: query.fromEmail } });
      }

      if (query.fromDate || query.toDate) {
        const range: any = {};
        if (query.fromDate) range.gte = query.fromDate;
        if (query.toDate) range.lte = query.toDate;
        filter.push({ range: { date: range } });
      }

      const page = query.page || 1;
      const pageSize = query.pageSize || 50;

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              filter,
            },
          },
          sort: [{ date: { order: 'desc' } }],
          from: (page - 1) * pageSize,
          size: pageSize,
          aggs: {
            folders: {
              terms: { field: 'folder', size: 20 },
            },
            labels: {
              terms: { field: 'labels', size: 50 },
            },
            has_attachments: {
              terms: { field: 'has_attachments' },
            },
          },
        },
      });

      const hits = response.hits.hits as any[];
      const messages = hits.map((hit) => hit._source as IndexedMessage);

      return {
        messages,
        total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0,
        page,
        pageSize,
        aggregations: response.aggregations,
      };
    } catch (error) {
      searchLogger.error('Search failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async updateMessage(messageUuid: string, updates: Partial<IndexedMessage>): Promise<void> {
    try {
      await this.client.update({
        index: this.indexName,
        id: messageUuid,
        doc: updates,
        refresh: true,
      });

      searchLogger.debug('Updated message', { messageUuid, updates });
    } catch (error) {
      searchLogger.error('Failed to update message', {
        messageUuid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async deleteMessage(messageUuid: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: messageUuid,
        refresh: true,
      });

      searchLogger.debug('Deleted message from index', { messageUuid });
    } catch (error) {
      searchLogger.error('Failed to delete message from index', {
        messageUuid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health();
      return health.status === 'green' || health.status === 'yellow';
    } catch (error) {
      searchLogger.error('Search health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const searchService = SearchService.getInstance();
