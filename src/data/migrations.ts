export const migrations: string[][] = [
  [
    `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        photo TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(name));`,
    `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`,
  ],
  [
    `
      CREATE TABLE IF NOT EXISTS apiaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        box_count INTEGER NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_apiaries_user_id ON apiaries(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_apiaries_updated_at ON apiaries(updated_at DESC);`,
  ],
  [
    `
      CREATE TABLE IF NOT EXISTS boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        apiary_id INTEGER NOT NULL,
        user_id INTEGER,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_boxes_apiary_position ON boxes(apiary_id, position);`,
    `CREATE INDEX IF NOT EXISTS idx_boxes_apiary_name ON boxes(apiary_id, name);`,
    `CREATE INDEX IF NOT EXISTS idx_boxes_user_id ON boxes(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_boxes_archived ON boxes(archived);`,
  ],
  [
    `
      CREATE TABLE IF NOT EXISTS review_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        caixa_id INTEGER NOT NULL,
        caixa_name TEXT NOT NULL,
        apiary_id INTEGER,
        apiary_name TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'apiario',
        checked_options TEXT NOT NULL,
        observacoes TEXT NOT NULL,
        indicacoes TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (caixa_id) REFERENCES boxes(id) ON DELETE CASCADE,
        FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_review_reports_created_at ON review_reports(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_review_reports_apiary_id ON review_reports(apiary_id);`,
    `CREATE INDEX IF NOT EXISTS idx_review_reports_caixa_id ON review_reports(caixa_id);`,
    `CREATE INDEX IF NOT EXISTS idx_review_reports_user_id ON review_reports(user_id);`,
  ],
  [
    `
      CREATE TABLE IF NOT EXISTS manejos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        caixa_id INTEGER NOT NULL,
        caixa_name TEXT NOT NULL,
        apiary_id INTEGER,
        apiary_name TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'apiario',
        revisao_id INTEGER,
        checked_options TEXT NOT NULL,
        observacoes TEXT NOT NULL,
        indicacoes TEXT NOT NULL,
        photo_uri TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (caixa_id) REFERENCES boxes(id) ON DELETE CASCADE,
        FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_manejos_created_at ON manejos(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_manejos_apiary_id ON manejos(apiary_id);`,
    `CREATE INDEX IF NOT EXISTS idx_manejos_caixa_id ON manejos(caixa_id);`,
    `CREATE INDEX IF NOT EXISTS idx_manejos_user_id ON manejos(user_id);`,
  ],
  [
    `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`,
    `
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  ]
];
