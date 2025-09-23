import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HttpClient } from '../../../shared/api/httpClient';
import { createProject as createProjectRequest, fetchProjects as fetchProjectsRequest } from '../../../shared/api/projects';
import type { ProjectSummary } from '../../../shared/types/api';

interface UseProjectsParams {
  client: HttpClient | null;
  enabled: boolean;
  allowCreate: boolean;
}

interface UseProjectsResult {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  selectedProject: ProjectSummary | null;
  selectProject: (project: ProjectSummary) => void;
  refresh: () => void;
  createProject: (name: string) => Promise<void>;
}

export function useProjects({ client, enabled, allowCreate }: UseProjectsParams): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!enabled || !client) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      fetchProjectsRequest(client, search.trim() ? search.trim() : undefined)
        .then((response) => {
          if (cancelled) {
            return;
          }

          setProjects(response.projects);
          if (response.projects.length === 0) {
            setSelectedProjectId(null);
            return;
          }

          setSelectedProjectId((current) => {
            if (current && response.projects.some((project) => project.id === current)) {
              return current;
            }

            return response.projects[0]?.id ?? null;
          });
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить проекты');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [client, enabled, search, requestId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const refresh = useCallback(() => {
    setRequestId((id) => id + 1);
  }, []);

  const handleCreate = useCallback(
    async (name: string) => {
      if (!client || !allowCreate) {
        throw new Error('Создание проектов недоступно');
      }

      const response = await createProjectRequest(client, name);
      setProjects((current) => {
        const exists = current.some((project) => project.id === response.project.id);
        const next = exists ? current : [response.project, ...current];
        return next;
      });
      setSelectedProjectId(response.project.id);
    },
    [allowCreate, client],
  );

  const handleSelect = useCallback((project: ProjectSummary) => {
    setSelectedProjectId(project.id);
  }, []);

  return {
    projects,
    isLoading,
    error,
    search,
    setSearch,
    selectedProject,
    selectProject: handleSelect,
    refresh,
    createProject: handleCreate,
  };
}
