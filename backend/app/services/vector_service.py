from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import settings
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import QDRANT_COLLECTION, EMBEDDING_DIM
import uuid

client = AsyncQdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)

async def ensure_collection():
    collections = await client.get_collections()
    names = [c.name for c in collections.collections]
    if QDRANT_COLLECTION not in names:
        await client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )

async def upsert_chunks(workspace_id: int, chunks: list[dict], embeddings: list[list[float]]):
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=embedding,
            payload={"workspace_id": workspace_id, "file_path": chunk["file_path"],
                     "content": chunk["content"], "chunk_index": chunk["chunk_index"]},
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]
    await client.upsert(collection_name=QDRANT_COLLECTION, points=points)

async def search_similar(workspace_id: int, query_embedding: list[float], limit: int = 8) -> list[dict]:
    results = await client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=query_embedding,
        query_filter=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))]),
        limit=limit,
    )
    return [{"content": r.payload["content"], "file_path": r.payload["file_path"],
             "score": r.score} for r in results]

async def delete_workspace_vectors(workspace_id: int):
    await client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))]),
    )
