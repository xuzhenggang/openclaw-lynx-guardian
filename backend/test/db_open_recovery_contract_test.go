package backend_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/openclaw/lynx-guardian/backend/internal/db"
)

func TestOpenRecoversFromStaleSharedMemorySidecar(t *testing.T) {
	dataDir := t.TempDir()
	databasePath := filepath.Join(dataDir, "lynx.db")
	staleSharedMemoryPath := databasePath + "-shm"

	if err := os.Mkdir(staleSharedMemoryPath, 0o755); err != nil {
		t.Fatalf("seed stale shared-memory sidecar: %v", err)
	}

	database, err := db.Open(databasePath)
	if err != nil {
		t.Fatalf("open db with stale shared-memory sidecar: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if _, err := os.Stat(staleSharedMemoryPath); !os.IsNotExist(err) {
		t.Fatalf("expected stale shared-memory sidecar to be archived, stat err=%v", err)
	}

	matches, err := filepath.Glob(staleSharedMemoryPath + ".stale-*")
	if err != nil {
		t.Fatalf("find archived shared-memory sidecar: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected one archived shared-memory sidecar, got %d", len(matches))
	}
}

func TestOpenUsesDeleteJournalModeToAvoidSharedMemorySidecars(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "lynx.db")

	database, err := db.Open(databasePath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	var journalMode string
	if err := database.QueryRow(`PRAGMA journal_mode`).Scan(&journalMode); err != nil {
		t.Fatalf("query journal_mode: %v", err)
	}
	if journalMode != "delete" {
		t.Fatalf("expected delete journal mode, got %q", journalMode)
	}
}

func TestOpenPrefersExistingRecoveryCopy(t *testing.T) {
	dataDir := t.TempDir()
	databasePath := filepath.Join(dataDir, "lynx.db")

	primaryDatabase, err := db.Open(databasePath)
	if err != nil {
		t.Fatalf("open primary db: %v", err)
	}
	seedMarker(t, primaryDatabase, "primary")
	if err := primaryDatabase.Close(); err != nil {
		t.Fatalf("close primary db: %v", err)
	}

	recoveryDatabase, err := db.Open(filepath.Join(dataDir, "recovery", "lynx.db"))
	if err != nil {
		t.Fatalf("open recovery db: %v", err)
	}
	seedMarker(t, recoveryDatabase, "recovery")
	if err := recoveryDatabase.Close(); err != nil {
		t.Fatalf("close recovery db: %v", err)
	}

	reopenedDatabase, err := db.Open(databasePath)
	if err != nil {
		t.Fatalf("reopen primary path with existing recovery db: %v", err)
	}
	t.Cleanup(func() { _ = reopenedDatabase.Close() })

	if marker := readMarker(t, reopenedDatabase); marker != "recovery" {
		t.Fatalf("expected recovery db marker, got %q", marker)
	}
}

func seedMarker(t *testing.T, database *sql.DB, marker string) {
	t.Helper()
	if _, err := database.Exec(`CREATE TABLE IF NOT EXISTS marker (value TEXT NOT NULL)`); err != nil {
		t.Fatalf("create marker table: %v", err)
	}
	if _, err := database.Exec(`DELETE FROM marker`); err != nil {
		t.Fatalf("clear marker table: %v", err)
	}
	if _, err := database.Exec(`INSERT INTO marker (value) VALUES (?)`, marker); err != nil {
		t.Fatalf("insert marker: %v", err)
	}
}

func readMarker(t *testing.T, database *sql.DB) string {
	t.Helper()
	var marker string
	if err := database.QueryRow(`SELECT value FROM marker LIMIT 1`).Scan(&marker); err != nil {
		t.Fatalf("read marker: %v", err)
	}
	return marker
}
