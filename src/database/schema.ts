import Database from 'better-sqlite3';

export function applyBaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      language_code TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      survey_date TEXT NOT NULL,
      project_recommendation INTEGER,
      project_improvement TEXT,
      manager_effectiveness INTEGER,
      manager_improvement TEXT,
      team_comfort INTEGER,
      team_improvement TEXT,
      process_organization INTEGER,
      process_obstacles TEXT,
      contribution_valued TEXT CHECK (contribution_valued IN ('yes', 'no', 'partial')),
      improvement_ideas TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(project_id) REFERENCES projects(id),
      UNIQUE(user_id, project_id, survey_date)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
    CREATE INDEX IF NOT EXISTS idx_surveys_user_project ON surveys(user_id, project_id, survey_date);
  `);
}
