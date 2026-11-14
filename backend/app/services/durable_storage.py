import os
import json
import uuid
import time
import shutil
import logging
import threading
from pathlib import Path
from typing import Dict, Any, Optional, Type, TypeVar, Generic, Callable
from pydantic import BaseModel

logger = logging.getLogger("campusos.storage")

T = TypeVar("T", bound=BaseModel)

class StorageError(Exception):
    """Raised when atomic persistence fails."""
    pass

class CorruptStorageError(StorageError):
    """Raised when on-disk storage file is corrupted."""
    pass


class AtomicJsonStorage(Generic[T]):
    """
    Thread-safe, atomic file-backed JSON storage adapter.
    Explicitly labeled as 'development_file_adapter'.
    
    Guarantees:
    1. Atomic replacement via same-directory temp file + flush + fsync + os.replace.
    2. Concurrency control covering the entire read-modify-write operation via threading.RLock.
    3. Failure propagation: failed writes raise StorageError and do NOT mutate in-memory state.
    4. Corrupt files are quarantined to preserve evidence; never silently overwritten with empty state.
    5. Schema validation using Pydantic models.
    """

    def __init__(
        self,
        file_path: Path,
        model_cls: Type[T],
        version: int = 1,
    ):
        self.file_path = file_path
        self.model_cls = model_cls
        self.version = version
        self._lock = threading.RLock()
        self._items: Dict[str, T] = {}
        self.adapter_type = "development_file_adapter"
        
        # Ensure parent directory exists
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.load()

    def load(self) -> None:
        """
        Loads records from disk with corruption quarantine protection.
        """
        with self._lock:
            if not self.file_path.exists():
                self._items = {}
                return

            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
            except Exception as e:
                # Quarantine corrupt file to preserve diagnostic evidence
                timestamp = int(time.time())
                quarantine_path = self.file_path.with_suffix(f".corrupt.{timestamp}")
                try:
                    shutil.copy2(self.file_path, quarantine_path)
                    logger.critical(
                        "Quarantined corrupted storage file %s -> %s: %s",
                        self.file_path,
                        quarantine_path,
                        str(e),
                    )
                except Exception as q_err:
                    logger.critical("Failed to quarantine %s: %s", self.file_path, str(q_err))

                raise CorruptStorageError(
                    f"Storage file {self.file_path} is corrupted and was quarantined to {quarantine_path.name}: {str(e)}"
                ) from e

            # Handle format: either direct dict of items or {"version": 1, "items": {...}}
            items_raw = raw.get("items", raw) if isinstance(raw, dict) else {}
            loaded: Dict[str, T] = {}
            for k, v in items_raw.items():
                if isinstance(v, dict):
                    try:
                        loaded[str(k)] = self.model_cls(**v)
                    except Exception as parse_err:
                        logger.warning("Skipping invalid record %s in %s: %s", k, self.file_path, str(parse_err))
            self._items = loaded

    def _write_atomic(self, items_snapshot: Dict[str, T]) -> None:
        """
        Serializes and writes records to a temp file in the same directory,
        flushes, fsyncs, and atomically replaces the target file.
        """
        temp_file = self.file_path.with_suffix(f".tmp.{uuid.uuid4().hex}")
        payload = {
            "version": self.version,
            "adapter": self.adapter_type,
            "updated_at": time.time(),
            "items": {k: v.model_dump() for k, v in items_snapshot.items()},
        }

        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # Atomic replacement (POSIX atomic rename)
            os.replace(temp_file, self.file_path)
        except Exception as e:
            # Clean up temp file if write failed
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass
            logger.error("Failed atomic write to %s: %s", self.file_path, str(e))
            raise StorageError(f"Atomic write to {self.file_path.name} failed: {str(e)}") from e

    def get_all(self) -> Dict[str, T]:
        with self._lock:
            return dict(self._items)

    def get(self, item_id: str) -> Optional[T]:
        with self._lock:
            return self._items.get(item_id)

    def mutate(self, mutator_fn: Callable[[Dict[str, T]], Any]) -> Any:
        """
        Executes a mutation under the lock.
        The in-memory dictionary is only updated AFTER successful atomic write.
        If write fails, the mutation is rolled back and StorageError is raised.
        """
        with self._lock:
            # Create isolated snapshot
            snapshot = dict(self._items)
            result = mutator_fn(snapshot)
            # Write to disk atomically first!
            self._write_atomic(snapshot)
            # Commit to in-memory state only after write succeeds!
            self._items = snapshot
            return result

    def set(self, item_id: str, item: T) -> None:
        def _set(d: Dict[str, T]):
            d[item_id] = item
        self.mutate(_set)

    def delete(self, item_id: str) -> Optional[T]:
        def _delete(d: Dict[str, T]):
            return d.pop(item_id, None)
        return self.mutate(_delete)
