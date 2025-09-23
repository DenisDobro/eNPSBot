export interface ProjectSummary {
  id: number;
  name: string;
  createdAt: string;
  responsesCount: number;
  lastResponseAt: string | null;
}
