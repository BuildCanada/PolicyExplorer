-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    external_id TEXT,
    date_published TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',  -- Add language column with default 'en'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Create index on date_published
CREATE INDEX IF NOT EXISTS idx_sources_date_published ON sources(date_published);

-- Create index on language
CREATE INDEX IF NOT EXISTS idx_sources_language ON sources(language);

-- Create index on source_type
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);

-- Create index on party_id
CREATE INDEX IF NOT EXISTS idx_sources_party ON sources(party_id);

-- Create index on external_id
CREATE INDEX IF NOT EXISTS idx_sources_external_id ON sources(external_id); 