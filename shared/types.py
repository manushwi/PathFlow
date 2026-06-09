from enum import Enum

class WorkspaceStatus(str, Enum):
    PENDING = "pending"
    CLONING = "cloning"
    ANALYZING = "analyzing"
    EMBEDDING = "embedding"
    GENERATING_DOCS = "generating_docs"
    BUILDING_GRAPH = "building_graph"
    READY = "ready"
    ERROR = "error"

class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class IssueDifficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
