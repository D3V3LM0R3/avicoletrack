from enum import Enum


class FarmRole(str, Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    WORKER = "WORKER"