import sys
import os
sys.path.append(os.getcwd())
from knowledge_base import index

def check_stats():
    stats = index.describe_index_stats()
    print(f"Total Vectors: {stats.total_vector_count}")
    print(f"Namespaces: {stats.namespaces}")

if __name__ == "__main__":
    check_stats()
