import { getDatabase } from '../../lib/database';
import { TelegramUser } from '../../shared/telegram.types';

export class UserRepository {
  private readonly db = getDatabase();
  private readonly selectById = this.db.prepare('SELECT id FROM users WHERE id = ?');
  private readonly insert = this.db.prepare(
    `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, created_at, updated_at)
     VALUES (@id, @first_name, @last_name, @username, @language_code, @photo_url, @created_at, @updated_at)`
  );
  private readonly update = this.db.prepare(
    `UPDATE users
       SET first_name = @first_name,
           last_name = @last_name,
           username = @username,
           language_code = @language_code,
           photo_url = @photo_url,
           updated_at = @updated_at
     WHERE id = @id`
  );

  ensureUser(user: TelegramUser): void {
    const now = new Date().toISOString();
    const payload = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      language_code: user.language_code ?? null,
      photo_url: user.photo_url ?? null,
      created_at: now,
      updated_at: now,
    };

    const existing = this.selectById.get(user.id) as { id: number } | undefined;
    if (!existing) {
      this.insert.run(payload);
      return;
    }

    this.update.run(payload);
  }
}

export const userRepository = new UserRepository();

export function ensureUser(user: TelegramUser): void {
  userRepository.ensureUser(user);
}
