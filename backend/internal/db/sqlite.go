// Package db wraps modernc.org/sqlite to mirror backend/src/db/sqlite.ts.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

func Open(databasePath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(databasePath), 0o755); err != nil {
		return nil, err
	}

	if database, found, err := openExistingRecoveryCopy(databasePath); found {
		if err == nil {
			return database, nil
		}
		log.Printf("sqlite recovery database exists but could not be opened; falling back to primary: %v", err)
	}

	if _, err := archiveInvalidSharedMemorySidecar(databasePath); err != nil {
		return nil, err
	}

	database, err := openWithPragmas(databasePath)
	if err == nil {
		return database, nil
	}
	if !isRecoverableSharedMemoryError(err) {
		return nil, err
	}

	archived, archiveErr := archiveSharedMemorySidecar(databasePath)
	if archiveErr != nil {
		database, fallbackErr := openRecoveryCopy(databasePath)
		if fallbackErr == nil {
			log.Printf(
				"sqlite shared-memory sidecar recovery used copy %s after archive failed: %v",
				recoveryDatabasePath(databasePath),
				archiveErr,
			)
			return database, nil
		}
		return nil, fmt.Errorf(
			"%w; failed to archive sqlite shared-memory sidecar: %v; failed to open recovery copy: %v",
			err,
			archiveErr,
			fallbackErr,
		)
	}
	if !archived {
		database, fallbackErr := openRecoveryCopy(databasePath)
		if fallbackErr == nil {
			log.Printf("sqlite shared-memory sidecar recovery used copy %s", recoveryDatabasePath(databasePath))
			return database, nil
		}
		return nil, fmt.Errorf("%w; failed to open recovery copy: %v", err, fallbackErr)
	}

	return openWithPragmas(databasePath)
}

func openWithPragmas(databasePath string) (*sql.DB, error) {
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(1)

	if err := applyPragmas(database); err != nil {
		_ = database.Close()
		return nil, err
	}
	return database, nil
}

func archiveInvalidSharedMemorySidecar(databasePath string) (bool, error) {
	info, err := os.Stat(sharedMemorySidecarPath(databasePath))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if info.Mode().IsRegular() {
		return false, nil
	}
	return archiveSharedMemorySidecar(databasePath)
}

func archiveSharedMemorySidecar(databasePath string) (bool, error) {
	sidecarPath := sharedMemorySidecarPath(databasePath)
	if _, err := os.Stat(sidecarPath); errors.Is(err, os.ErrNotExist) {
		return false, nil
	} else if err != nil {
		return false, err
	}

	archivePath := fmt.Sprintf(
		"%s.stale-%s",
		sidecarPath,
		time.Now().UTC().Format("20060102T150405.000000000Z"),
	)
	if err := os.Rename(sidecarPath, archivePath); err != nil {
		return false, err
	}
	return true, nil
}

func sharedMemorySidecarPath(databasePath string) string {
	return databasePath + "-shm"
}

func openExistingRecoveryCopy(databasePath string) (*sql.DB, bool, error) {
	recoveryPath := recoveryDatabasePath(databasePath)
	if _, err := os.Stat(recoveryPath); errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	} else if err != nil {
		return nil, true, err
	}

	database, err := openWithPragmas(recoveryPath)
	if err != nil {
		return nil, true, err
	}
	log.Printf("sqlite recovery database already exists; using copy %s", recoveryPath)
	return database, true, nil
}

func openRecoveryCopy(databasePath string) (*sql.DB, error) {
	recoveryPath := recoveryDatabasePath(databasePath)
	if _, err := os.Stat(recoveryPath); errors.Is(err, os.ErrNotExist) {
		if err := seedRecoveryDatabase(databasePath, recoveryPath); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	return openWithPragmas(recoveryPath)
}

func recoveryDatabasePath(databasePath string) string {
	return filepath.Join(filepath.Dir(databasePath), "recovery", filepath.Base(databasePath))
}

func seedRecoveryDatabase(sourcePath string, recoveryPath string) error {
	if err := os.MkdirAll(filepath.Dir(recoveryPath), 0o755); err != nil {
		return err
	}
	if err := copyFile(sourcePath, recoveryPath, 0o644); err != nil {
		return err
	}

	sourceWalPath := sourcePath + "-wal"
	if _, err := os.Stat(sourceWalPath); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}
	return copyFile(sourceWalPath, recoveryPath+"-wal", 0o644)
}

func copyFile(sourcePath string, destinationPath string, mode os.FileMode) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.OpenFile(destinationPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(destination, source)
	closeErr := destination.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}

func isRecoverableSharedMemoryError(err error) bool {
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		switch sqliteErr.Code() {
		case sqlite3.SQLITE_IOERR_SHMOPEN,
			sqlite3.SQLITE_IOERR_SHMMAP,
			sqlite3.SQLITE_IOERR_SHMLOCK,
			sqlite3.SQLITE_IOERR_SHMSIZE:
			return true
		}
	}

	errText := err.Error()
	return strings.Contains(errText, "disk I/O error (4618)") ||
		strings.Contains(errText, "SQLITE_IOERR_SHM")
}
