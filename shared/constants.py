REPOS_BASE_PATH = "/tmp/pathflow_repos"
CHUNK_SIZE = 1500        # tokens per code chunk
CHUNK_OVERLAP = 200
EMBEDDING_DIM = 1536     # text-embedding-3-small
QDRANT_COLLECTION = "code_chunks"
CACHE_TTL_ANALYSIS = 60 * 60 * 24 * 7   # 7 days
CACHE_TTL_ISSUES = 60 * 60 * 2           # 2 hours
