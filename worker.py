import os
import redis
from rq import Worker, Queue, Connection

def start_worker():
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    redis_conn = redis.from_url(redis_url)
    
    with Connection(redis_conn):
        worker = Worker([Queue()])
        worker.work()

if __name__ == '__main__':
    start_worker()