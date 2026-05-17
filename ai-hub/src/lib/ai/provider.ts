export interface UrlMetadata {
  title: string;
  description: string;
  resource_type: string;
  tags: string[];
}

export interface ResourceSummary {
  id: number;
  title: string;
  description: string;
  tags: string[];
}

export interface AIProvider {
  fetchUrlMetadata(url: string): Promise<UrlMetadata>;
  suggestTags(title: string, description: string, existingTags: string[]): Promise<string[]>;
  smartSearch(query: string, resources: ResourceSummary[]): Promise<number[]>;
}
