import asyncio


class ProductEvents:
    """In-process broadcast, matching the original single-process backend."""

    def __init__(self):
        self.loop = asyncio.get_running_loop()
        self.subscribers = set()

    def broadcast(self, action):
        if not self.loop.is_closed():
            self.loop.call_soon_threadsafe(self._publish, action)

    def _publish(self, action):
        for queue in self.subscribers:
            # Each event triggers a complete catalog refresh; coalesce slow consumers.
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(action)

    async def stream(self):
        queue = asyncio.Queue(maxsize=1)
        self.subscribers.add(queue)
        try:
            yield "event: connected\ndata: ok\n\n"
            while True:
                try:
                    action = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: products-changed\ndata: {action}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            self.subscribers.discard(queue)
